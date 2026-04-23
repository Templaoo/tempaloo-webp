// Creates a test user + Free license. Prints the license_key to stdout.
// Usage: DATABASE_URL=... node scripts/create-test-license.mjs [email] [plan-code]
import pg from "pg";
import { randomBytes } from "node:crypto";

const email = process.argv[2] ?? `test+${Date.now()}@tempaloo.local`;
const planCode = process.argv[3] ?? "free";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const licenseKey = randomBytes(32).toString("hex");

try {
    await client.query("BEGIN");
    const { rows: [user] } = await client.query(
        `INSERT INTO users (email) VALUES ($1)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [email],
    );
    const { rows: [plan] } = await client.query(`SELECT id FROM plans WHERE code = $1`, [planCode]);
    if (!plan) throw new Error(`Plan not found: ${planCode}`);

    await client.query(
        `INSERT INTO licenses (user_id, plan_id, license_key, status, billing)
         VALUES ($1, $2, $3, 'active', $4)`,
        [user.id, plan.id, licenseKey, planCode === "free" ? "free" : "monthly"],
    );
    await client.query("COMMIT");
    console.log(JSON.stringify({ email, plan: planCode, license_key: licenseKey }, null, 2));
} catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    process.exitCode = 1;
} finally {
    await client.end();
}
