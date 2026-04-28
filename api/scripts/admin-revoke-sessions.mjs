#!/usr/bin/env node
/**
 * Emergency kill switch — invalidates every live admin session.
 *
 *   cd api && npm run admin:revoke-sessions
 *   cd api && npm run admin:revoke-sessions -- --user=admin@example.com
 *
 * Use cases:
 *   · Suspected breach (TOTP shared, laptop stolen, credential phishing)
 *   · Rotating ADMIN_TOTP_KEY (TOTP secrets become unreadable, force fresh
 *     login)
 *   · Routine hygiene before rotating server keys
 *
 * Effect: every active admin will see "Session expired" on their next
 * page load and must re-enter password + TOTP.
 *
 * Append-only audit row written under admin_email='cli:revoke-script' so
 * the action is visible in /admin/audit.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

// Optional --user=... filter to revoke a single account's sessions.
const userArg = process.argv.find((a) => a.startsWith("--user="));
const targetEmail = userArg ? userArg.slice("--user=".length) : null;

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

try {
    let rowCount;
    if (targetEmail) {
        const res = await pool.query(
            `UPDATE admin_sessions s
                SET revoked_at = NOW()
              WHERE revoked_at IS NULL
                AND admin_user_id IN (SELECT id FROM admin_users WHERE email = $1)`,
            [targetEmail],
        );
        rowCount = res.rowCount;
        console.log(`✓ Revoked ${rowCount} session(s) for ${targetEmail}`);
    } else {
        const res = await pool.query(
            `UPDATE admin_sessions SET revoked_at = NOW() WHERE revoked_at IS NULL`,
        );
        rowCount = res.rowCount;
        console.log(`✓ Revoked ${rowCount} active session(s) (ALL admins)`);
    }

    // Append-only audit so this action shows up in /admin/audit.
    await pool.query(
        `INSERT INTO admin_audit_log
            (admin_user_id, admin_email, action, severity, ip, metadata, reason)
         VALUES (NULL, $1, 'admin.sessions.revoke_all', 'critical', '0.0.0.0'::inet, $2::jsonb, $3)`,
        [
            "cli:revoke-script",
            JSON.stringify({ revoked_count: rowCount, target_email: targetEmail }),
            "operator-initiated kill switch",
        ],
    );
    console.log("✓ Audit entry written (severity=critical → owner admins will receive an alert email).");
} finally {
    await pool.end();
}
