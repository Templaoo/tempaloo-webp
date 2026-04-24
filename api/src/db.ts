import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
    console.error("[db] unexpected pool error", err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: readonly unknown[],
): Promise<pg.QueryResult<T>> {
    return pool.query<T>(text, params as unknown[] | undefined);
}

export async function withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

export async function closePool(): Promise<void> {
    await pool.end();
}
