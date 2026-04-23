// Usage: DATABASE_URL=... node scripts/run-schema.mjs
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const sqlPath = path.resolve(here, "../db/schema.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected. Applying schema...");
try {
    await client.query(sql);
    console.log("Schema applied OK.");
    const { rows } = await client.query("SELECT code, name, images_per_month, max_sites FROM plans ORDER BY price_monthly_cents");
    console.table(rows);
} catch (err) {
    console.error("Schema failed:", err.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
