#!/usr/bin/env node
/**
 * Reprocess stored webhooks_events through the latest upsert logic.
 *
 *   cd api && npm run reprocess-webhooks               # all events
 *   cd api && npm run reprocess-webhooks -- --type=license.created
 *
 * Use case: a bug in upsertLicenseFromEvent let bad data into the
 * licenses table (e.g. all paid sandbox checkouts landing as Free
 * because the plan name didn't match our hardcoded list). Once the
 * code is fixed and deployed, this script walks every previously
 * stored webhook and re-runs the handler against it — so the licenses
 * table converges to what the events SHOULD have produced.
 *
 * Safe: webhooks_events is the source-of-truth payload Freemius sent
 * us, signed and persisted. Re-applying it is idempotent because
 * upsertLicenseFromEvent is itself idempotent (UPDATE then INSERT
 * ON CONFLICT). No emails are sent — we go through the helper
 * functions directly, bypassing the SDK listener layer.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

function loadEnv(file) {
    try {
        for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("=");
            if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            let v = line.slice(eq + 1).trim();
            if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            if (!(k in process.env)) process.env[k] = v;
        }
    } catch { /* env from shell */ }
}
loadEnv(path.join(apiRoot, ".env"));

if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL.");
    process.exit(1);
}

// Optional --type=... filter to reprocess only one event type.
const typeArg = process.argv.find((a) => a.startsWith("--type="));
const filterType = typeArg ? typeArg.slice("--type=".length) : null;

// Lazy import — needs the compiled dist/ to exist. On Windows, dynamic
// imports require file:// URLs (not raw c:\ paths).
import { pathToFileURL } from "node:url";
const { query, closePool } = await import(pathToFileURL(path.join(apiRoot, "dist", "db.js")).href);
const { upsertLicenseFromEvent, markLicenseStatus } = await import(pathToFileURL(path.join(apiRoot, "dist", "routes", "webhooks.js")).href);

console.log(`→ Loading webhooks_events${filterType ? ` (type = ${filterType})` : ""}…`);
const { rows } = await query(
    filterType
        ? `SELECT id, event_type, payload, received_at FROM webhooks_events
            WHERE provider = 'freemius' AND event_type = $1
            ORDER BY received_at ASC`
        : `SELECT id, event_type, payload, received_at FROM webhooks_events
            WHERE provider = 'freemius'
            ORDER BY received_at ASC`,
    filterType ? [filterType] : [],
);

console.log(`→ ${rows.length} event(s) to reprocess.`);

let upserted = 0, marked = 0, skipped = 0, failed = 0;

for (const row of rows) {
    const payload = row.payload;
    const objects = payload?.objects ?? null;
    if (!objects) { skipped++; continue; }

    try {
        switch (row.event_type) {
            case "license.created":
            case "license.updated":
            case "license.extended":
            case "license.plan.changed": {
                const r = await upsertLicenseFromEvent(objects);
                if (r) upserted++; else skipped++;
                break;
            }
            case "license.cancelled":
            case "subscription.cancelled":
            case "license.deleted":
                await markLicenseStatus(objects, "canceled");
                marked++;
                break;
            case "license.expired":
                await markLicenseStatus(objects, "expired");
                marked++;
                break;
            default:
                skipped++;
        }
    } catch (e) {
        failed++;
        console.error(`  ✗ ${row.event_type} (id=${row.id}): ${e instanceof Error ? e.message : String(e)}`);
    }
}

console.log(`\n✓ Done — upserted=${upserted} marked=${marked} skipped=${skipped} failed=${failed}`);

await closePool();
