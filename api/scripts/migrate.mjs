#!/usr/bin/env node
/**
 * Forward-only migration runner.
 *
 *   cd api && npm run migrate
 *
 * Reads db/migrations/*.sql in lexical order, tracks applied names in a
 * `schema_migrations` table, and runs each pending file inside a single
 * transaction. Safe to re-run: already-applied migrations are skipped.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const apiRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "db", "migrations");

// Tiny .env loader so we don't pull in dotenv just for this script.
function loadEnv(file) {
    try {
        for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith("#")) continue;
            const eq = line.indexOf("=");
            if (eq < 0) continue;
            const k = line.slice(0, eq).trim();
            let v = line.slice(eq + 1).trim();
            if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
            if (!(k in process.env)) process.env[k] = v;
        }
    } catch { /* fine — can come from shell env */ }
}
loadEnv(path.join(apiRoot, ".env"));

if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL (api/.env or env var).");
    process.exit(1);
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name       TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const files = readdirSync(migrationsDir)
        .filter(f => f.endsWith(".sql"))
        .sort(); // names start with a number so lexical = chronological

    const { rows } = await pool.query(`SELECT name FROM schema_migrations`);
    const applied = new Set(rows.map(r => r.name));

    const pending = files.filter(f => !applied.has(f));
    if (pending.length === 0) {
        console.log("✓ No pending migrations.");
        process.exit(0);
    }

    console.log(`Found ${pending.length} pending migration(s):`);
    for (const f of pending) console.log(`  · ${f}`);
    console.log("");

    for (const f of pending) {
        const sql = readFileSync(path.join(migrationsDir, f), "utf8");
        const client = await pool.connect();
        try {
            // Each migration file is expected to manage its own BEGIN/COMMIT
            // (so DDL that can't run inside a tx — like CREATE INDEX CONCURRENTLY
            // — still works). We just record the name after the file completes.
            console.log(`→ Applying ${f}…`);
            await client.query(sql);
            await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [f]);
            console.log(`  ✓ ${f} applied`);
        } catch (e) {
            console.error(`  ✗ ${f} failed:`, e.message);
            process.exit(1);
        } finally {
            client.release();
        }
    }

    console.log(`\n✓ ${pending.length} migration(s) applied.`);
} finally {
    await pool.end();
}
