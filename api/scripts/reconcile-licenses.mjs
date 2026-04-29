#!/usr/bin/env node
/**
 * Reconcile every license row against the Freemius API.
 *
 *   cd api && npm run reconcile-licenses
 *   cd api && npm run reconcile-licenses -- --dry-run
 *   cd api && npm run reconcile-licenses -- --license=1925037
 *
 * What it does for each license that has a freemius_license_id:
 *   1. GET license from Freemius (plan_id, expiration, is_cancelled, trial_ends)
 *   2. If billing_cycle absent on the license, fetch related Subscription
 *      and read billing_cycle there (Subscription is the authoritative
 *      source for recurring cadence)
 *   3. UPDATE our row with the truth: plan, status, billing, expiration
 *
 * Why exists: Freemius webhook payloads sometimes ship without a
 * billing_cycle on `license.created` (verified empirically — every
 * paid sandbox checkout landed with billing='lifetime' until we fixed
 * the resolver). When the webhook path was already buggy or when an
 * upstream change ever drifts our state, this script repairs the DB
 * without touching emails or notification side-effects.
 *
 * Idempotent: re-running is safe, only writes when values actually differ.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

function loadEnv(file) {
    try {
        for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
            const line = raw.trim(); if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("="); if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            let v = line.slice(eq + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            if (!(k in process.env)) process.env[k] = v;
        }
    } catch { /* env from shell */ }
}
loadEnv(path.join(apiRoot, ".env"));

for (const k of ["DATABASE_URL", "FREEMIUS_PRODUCT_ID", "FREEMIUS_API_KEY", "FREEMIUS_SECRET_KEY", "FREEMIUS_PUBLIC_KEY"]) {
    if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(1); }
}

const dryRun = process.argv.includes("--dry-run");
const oneArg = process.argv.find((a) => a.startsWith("--license="));
const onlyOne = oneArg ? oneArg.slice("--license=".length) : null;

const { Freemius } = await import("@freemius/sdk");
const { query, closePool } = await import(pathToFileURL(path.join(apiRoot, "dist", "db.js")).href);

const fs = new Freemius({
    productId: process.env.FREEMIUS_PRODUCT_ID,
    apiKey: process.env.FREEMIUS_API_KEY,
    secretKey: process.env.FREEMIUS_SECRET_KEY,
    publicKey: process.env.FREEMIUS_PUBLIC_KEY,
});

// ─── Fetch local rows ───────────────────────────────────────────────
const where = onlyOne ? `WHERE l.freemius_license_id = ${Number(onlyOne)}` : `WHERE l.freemius_license_id IS NOT NULL`;
const { rows } = await query(`
    SELECT l.id, l.freemius_license_id, l.plan_id, l.status, l.billing,
           l.current_period_end,
           p.code AS local_plan_code,
           u.email
      FROM licenses l
      JOIN plans p ON p.id = l.plan_id
      JOIN users u ON u.id = l.user_id
     ${where}
     ORDER BY l.created_at DESC
`);

console.log(`→ ${rows.length} license(s) to reconcile${dryRun ? " (dry-run)" : ""}.`);

let changed = 0, skipped = 0, errored = 0;

for (const row of rows) {
    const fsLicId = String(row.freemius_license_id);
    try {
        const remote = await fs.api.license.retrieve(fsLicId);
        if (!remote) { console.warn(`  ? ${fsLicId} not found on Freemius — leaving as-is`); skipped++; continue; }

        // ─── billing_cycle resolution ───────────────────────────────
        // Try the license itself first (some accounts populate it),
        // then look up subscriptions filtered by license_id.
        let cycle = remote.billing_cycle;
        if (cycle === undefined || cycle === null) {
            const subs = await fs.api.subscription.retrieveMany({ license_id: fsLicId });
            cycle = subs[0]?.billing_cycle;
        }
        const billing =
            cycle === 12 ? "annual"
            : cycle === 1 ? "monthly"
            : cycle === 0 ? "lifetime"
            : (remote.expiration ? "monthly" : "lifetime");

        // ─── status ───────────────────────────────────────────────
        const status =
            remote.is_cancelled ? "canceled"
            : (remote.trial_ends && new Date(remote.trial_ends).getTime() > Date.now()) ? "trialing"
            : (remote.expiration && new Date(remote.expiration).getTime() < Date.now()) ? "expired"
            : "active";

        // ─── plan resolution ──────────────────────────────────────
        let planRow;
        if (remote.plan_id != null) {
            const r = await query(`SELECT id, code FROM plans WHERE freemius_plan_id = $1 LIMIT 1`, [Number(remote.plan_id)]);
            planRow = r.rows[0];
        }
        if (!planRow) {
            console.warn(`  ? ${fsLicId} plan_id ${remote.plan_id} not in our plans table — skipping`);
            skipped++;
            continue;
        }

        const periodEnd = remote.expiration ? new Date(remote.expiration) : null;

        // ─── Diff vs local ─────────────────────────────────────────
        const localPeriodEnd = row.current_period_end ? new Date(row.current_period_end).toISOString() : null;
        const remotePeriodEnd = periodEnd ? periodEnd.toISOString() : null;

        const diffs = [];
        if (row.local_plan_code !== planRow.code) diffs.push(`plan ${row.local_plan_code}→${planRow.code}`);
        if (row.status !== status)                diffs.push(`status ${row.status}→${status}`);
        if (row.billing !== billing)              diffs.push(`billing ${row.billing}→${billing}`);
        if (localPeriodEnd !== remotePeriodEnd)   diffs.push(`period_end ${localPeriodEnd}→${remotePeriodEnd}`);

        if (diffs.length === 0) {
            skipped++;
            continue;
        }

        console.log(`  ${dryRun ? "·" : "✓"} ${fsLicId} (${row.email}) — ${diffs.join(", ")}`);

        if (!dryRun) {
            await query(
                `UPDATE licenses
                    SET plan_id = $2, status = $3::license_status, billing = $4::billing_cycle,
                        current_period_end = $5,
                        canceled_at = CASE WHEN $3 = 'canceled' AND canceled_at IS NULL THEN NOW() ELSE canceled_at END,
                        updated_at = NOW()
                  WHERE id = $1`,
                [row.id, planRow.id, status, billing, periodEnd],
            );
        }
        changed++;
    } catch (e) {
        errored++;
        console.error(`  ✗ ${fsLicId}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

console.log(`\n${dryRun ? "Would update" : "Updated"} ${changed} | unchanged ${skipped} | errors ${errored}`);

await closePool();
