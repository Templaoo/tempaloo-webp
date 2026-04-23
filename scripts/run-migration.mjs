// Usage: DATABASE_URL=... node scripts/run-migration.mjs <file>
// Example: node scripts/run-migration.mjs db/migrations/001_grid_update_and_rollover.sql
import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2];
if (!file) { console.error("pass a migration file path"); process.exit(1); }
const sql = fs.readFileSync(path.resolve(file), "utf8");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration applied:", file);
    const { rows } = await client.query("SELECT code, name, images_per_month, max_sites FROM plans ORDER BY price_monthly_cents");
    console.table(rows);
} catch (e) {
    await client.query("ROLLBACK");
    console.error("Failed:", e.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
