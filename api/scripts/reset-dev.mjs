#!/usr/bin/env node
/**
 * Dev-only: reset a test account end-to-end so onboarding can be replayed
 * from scratch.
 *
 *   npm run reset:dev -- you@example.com
 *
 * Wipes:
 *   · Neon DB rows for that email (user + cascade on licenses/sites/usage)
 *   · LocalWP plugin options (API key, quota flag, api_health, retry_queue,
 *     bulk_state) — so the WP admin shows the "enter API key" screen again
 *
 * Does NOT wipe (still manual):
 *   · Freemius subscriptions — cancel at https://dashboard.freemius.com
 *   · Next.js / Better-Auth session cookie — logout or open incognito
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

// Load api/.env (DATABASE_URL) and api/.env.reset (WP_DB_*) without adding
// a dotenv dep — the files are tiny KEY=VALUE lines.
function loadEnv(file) {
    try {
        const txt = readFileSync(file, "utf8");
        for (const raw of txt.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("=");
            if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            let v = line.slice(eq + 1).trim();
            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                v = v.slice(1, -1);
            }
            if (!(k in process.env)) process.env[k] = v;
        }
    } catch { /* file missing — that's OK for .env.reset if user uses env vars */ }
}
loadEnv(path.join(apiRoot, ".env"));
loadEnv(path.join(apiRoot, ".env.reset"));

const EMAIL = (process.argv[2] || "").toLowerCase().trim();
if (!EMAIL || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(EMAIL)) {
    console.error("Usage: npm run reset:dev -- <email>");
    process.exit(1);
}

const { DATABASE_URL, WP_DB_HOST, WP_DB_PORT, WP_DB_USER, WP_DB_PASSWORD, WP_DB_NAME, WP_TABLE_PREFIX } = process.env;
if (!DATABASE_URL) {
    console.error("Missing DATABASE_URL in api/.env");
    process.exit(1);
}
const wpPrefix = WP_TABLE_PREFIX || "wp_";

const MASK = (url) => url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");

console.log("");
console.log(`🧨  Reset dev state for: ${EMAIL}`);
console.log("");
console.log("Will DELETE from:");
console.log(`  · Neon  ${MASK(DATABASE_URL)}`);
console.log(`      → user + all licenses (cascade sites/usage), usage_logs orphaned`);
if (WP_DB_HOST && WP_DB_NAME) {
    console.log(`  · WP    mysql://${WP_DB_USER}:****@${WP_DB_HOST}:${WP_DB_PORT || 3306}/${WP_DB_NAME}`);
    console.log(`      → 5 rows in ${wpPrefix}options (tempaloo_webp_*)`);
} else {
    console.log(`  · WP    (skipped — set WP_DB_* in api/.env.reset to wipe plugin options)`);
}
console.log("");
console.log("Will NOT touch:");
console.log("  · Freemius subscriptions → https://dashboard.freemius.com");
console.log("  · Session cookie → logout or open /webp/activate in incognito");
console.log("");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const typed = (await rl.question(`Re-type the email to confirm (or Ctrl-C): `)).trim().toLowerCase();
rl.close();
if (typed !== EMAIL) {
    console.error("\n✗ Email does not match. Aborting (nothing was touched).");
    process.exit(1);
}

// ── Neon ────────────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
let neonSummary = "skipped";
try {
    const { rows: userRows } = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [EMAIL],
    );
    if (userRows.length === 0) {
        neonSummary = "no user found (already clean)";
    } else {
        const userId = userRows[0].id;
        const { rows: licRows } = await pool.query(`SELECT id FROM licenses WHERE user_id = $1`, [userId]);
        const licenseIds = licRows.map(r => r.id);

        // usage_logs.license_id is ON DELETE SET NULL — we NULL them explicitly
        // so analytics history stays but stops being attributable to this user.
        let zeroed = 0;
        if (licenseIds.length > 0) {
            const { rowCount } = await pool.query(
                `UPDATE usage_logs SET license_id = NULL, site_id = NULL WHERE license_id = ANY($1::uuid[])`,
                [licenseIds],
            );
            zeroed = rowCount;
        }

        // licenses cascade → sites + usage_counters
        const { rowCount: licDel } = await pool.query(`DELETE FROM licenses WHERE user_id = $1`, [userId]);
        const { rowCount: userDel } = await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
        neonSummary = `deleted 1 user, ${licDel} licenses (cascade sites/usage), ${zeroed} usage_logs anonymised`;
    }
} finally {
    await pool.end();
}

// ── LocalWP MySQL ───────────────────────────────────────────────────────
let wpSummary = "skipped (no WP_DB_* env)";
if (WP_DB_HOST && WP_DB_NAME) {
    const conn = await mysql.createConnection({
        host: WP_DB_HOST,
        port: Number(WP_DB_PORT || 3306),
        user: WP_DB_USER,
        password: WP_DB_PASSWORD,
        database: WP_DB_NAME,
    });
    try {
        const OPTIONS = [
            "tempaloo_webp_settings",
            "tempaloo_webp_quota_exceeded_at",
            "tempaloo_webp_api_health",
            "tempaloo_webp_retry_queue",
            "tempaloo_webp_bulk_state",
        ];
        const placeholders = OPTIONS.map(() => "?").join(",");
        const [res] = await conn.execute(
            `DELETE FROM \`${wpPrefix}options\` WHERE option_name IN (${placeholders})`,
            OPTIONS,
        );
        wpSummary = `deleted ${res.affectedRows}/5 options`;
    } finally {
        await conn.end();
    }
}

console.log("");
console.log("✓ Neon: " + neonSummary);
console.log("✓ WP:   " + wpSummary);
console.log("");
console.log("Next steps:");
console.log("  1. Logout: open /webp/activate in an incognito window (or clear cookies for tempaloo.com)");
console.log("  2. Freemius: if you were on a paid trial, cancel at https://dashboard.freemius.com");
console.log("  3. WP admin: refresh Tempaloo WebP → you should see the \"enter API key\" screen again");
console.log("");
