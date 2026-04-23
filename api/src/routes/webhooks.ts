import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { config } from "../config.js";
import { query, withTx } from "../db.js";
import { generateLicenseKey } from "../auth.js";

interface FreemiusEvent {
    id?: string;
    type?: string;
    objects?: { license?: FreemiusLicense; user?: FreemiusUser };
}

interface FreemiusLicense {
    id?: number;
    user_id?: number;
    plan_id?: number;
    plan_name?: string;
    is_cancelled?: boolean;
    expiration?: string | null;
    billing_cycle?: number;
}

interface FreemiusUser {
    id?: number;
    email?: string;
}

function verifySignature(rawBody: string, signature: string | undefined): boolean {
    if (!config.FREEMIUS_SECRET_KEY) return true; // dev: accept
    if (!signature) return false;
    const expected = crypto
        .createHmac("sha256", config.FREEMIUS_SECRET_KEY)
        .update(rawBody)
        .digest("hex");
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
        return false;
    }
}

function planCodeFromFreemius(planName?: string): string {
    const n = (planName ?? "").toLowerCase();
    if (n.includes("unlimited")) return "unlimited";
    if (n.includes("business")) return "business";
    if (n.includes("growth")) return "growth";
    if (n.includes("starter")) return "starter";
    return "free";
}

export default async function webhooksRoute(app: FastifyInstance) {
    // Capture raw body for signature verification.
    app.addContentTypeParser(
        "application/json",
        { parseAs: "string" },
        (_req, body, done) => {
            try {
                done(null, { raw: body, parsed: JSON.parse(String(body)) });
            } catch (e) {
                done(e as Error, undefined);
            }
        },
    );

    app.post("/webhooks/freemius", async (req, reply) => {
        const wrapped = req.body as { raw: string; parsed: FreemiusEvent };
        const signature = req.headers["x-freemius-signature"] as string | undefined;

        if (!verifySignature(wrapped.raw, signature)) {
            return reply.code(401).send({ error: { code: "invalid_signature", message: "Bad signature" } });
        }

        const event = wrapped.parsed;
        const eventId = event.id ?? crypto.randomUUID();
        const eventType = event.type ?? "unknown";

        // Idempotency insert
        const { rowCount } = await query(
            `INSERT INTO webhooks_events (provider, event_id, event_type, payload)
             VALUES ('freemius', $1, $2, $3)
             ON CONFLICT (provider, event_id) DO NOTHING`,
            [eventId, eventType, JSON.stringify(event)],
        );
        if (!rowCount) return reply.code(204).send(); // already processed

        try {
            await processEvent(event);
            await query(
                `UPDATE webhooks_events SET processed_at = NOW()
                 WHERE provider = 'freemius' AND event_id = $1`,
                [eventId],
            );
        } catch (e) {
            await query(
                `UPDATE webhooks_events SET processing_error = $2
                 WHERE provider = 'freemius' AND event_id = $1`,
                [eventId, (e as Error).message],
            );
            req.log.error({ e, eventId, eventType }, "webhook processing failed");
            return reply.code(500).send({ error: { code: "processing_failed", message: "Will retry" } });
        }

        return reply.code(204).send();
    });
}

async function processEvent(event: FreemiusEvent) {
    const lic = event.objects?.license;
    const usr = event.objects?.user;
    if (!lic || !usr?.email) return;

    const planCode = planCodeFromFreemius(lic.plan_name);
    const status = lic.is_cancelled ? "canceled" : "active";
    const billing = lic.billing_cycle === 12 ? "annual" : lic.billing_cycle === 1 ? "monthly" : "lifetime";
    const periodEnd = lic.expiration ? new Date(lic.expiration) : null;

    await withTx(async (client) => {
        const { rows: userRows } = await client.query<{ id: string }>(
            `INSERT INTO users (email, freemius_user_id) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET freemius_user_id = EXCLUDED.freemius_user_id, updated_at = NOW()
             RETURNING id`,
            [usr.email, usr.id ?? null],
        );
        const userId = userRows[0]!.id;

        const { rows: planRows } = await client.query<{ id: string }>(
            `SELECT id FROM plans WHERE code = $1 LIMIT 1`,
            [planCode],
        );
        const planId = planRows[0]?.id;
        if (!planId) throw new Error(`Plan ${planCode} not found`);

        // Upsert by freemius_license_id
        const { rowCount } = await client.query(
            `UPDATE licenses
                SET plan_id = $2, status = $3::license_status,
                    billing = $4::billing_cycle, current_period_end = $5,
                    canceled_at = CASE WHEN $3 = 'canceled' THEN NOW() ELSE NULL END,
                    updated_at = NOW()
              WHERE freemius_license_id = $1`,
            [lic.id ?? null, planId, status, billing, periodEnd],
        );
        if (!rowCount) {
            await client.query(
                `INSERT INTO licenses (user_id, plan_id, license_key, freemius_license_id, status, billing, current_period_end)
                 VALUES ($1, $2, $3, $4, $5::license_status, $6::billing_cycle, $7)`,
                [userId, planId, generateLicenseKey(), lic.id ?? null, status, billing, periodEnd],
            );
            // TODO: send email with license key
        }
    });
}
