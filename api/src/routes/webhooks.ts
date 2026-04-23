import type { FastifyInstance } from "fastify";
import { generateLicenseKey } from "../auth.js";
import { query, withTx } from "../db.js";
import { getFreemius, planCodeFromFreemius } from "../freemius.js";

/**
 * Freemius webhook receiver.
 *
 * Uses the official @freemius/sdk which:
 *   1. Verifies the HMAC signature against our secret key.
 *   2. Parses + dispatches events by type through a typed listener.
 *   3. Returns the correct HTTP response (200 ack, 401 on bad signature).
 *
 * We only handle the handful of events that affect license lifecycle.
 * Anything else is ack'd silently so Freemius doesn't keep retrying.
 */
export default async function webhooksRoute(app: FastifyInstance) {
    app.post("/webhooks/freemius", async (req, reply) => {
        const fs = getFreemius();
        if (!fs) {
            return reply.code(503).send({ error: { code: "not_configured", message: "Freemius not configured on this server" } });
        }

        const listener = fs.webhook.createListener();

        listener.on("license.created", async ({ objects }) => {
            await upsertLicenseFromEvent(objects);
        });
        listener.on("license.updated", async ({ objects }) => {
            await upsertLicenseFromEvent(objects);
        });
        listener.on("license.extended", async ({ objects }) => {
            await upsertLicenseFromEvent(objects);
        });
        listener.on("license.cancelled", async ({ objects }) => {
            await markLicenseStatus(objects, "canceled");
        });
        listener.on("license.expired", async ({ objects }) => {
            await markLicenseStatus(objects, "expired");
        });
        listener.on("subscription.cancelled", async ({ objects }) => {
            await markLicenseStatus(objects, "canceled");
        });
        listener.on("license.plan.changed", async ({ objects }) => {
            await upsertLicenseFromEvent(objects);
        });
        listener.on("license.deleted", async ({ objects }) => {
            await markLicenseStatus(objects, "canceled");
        });

        return fs.webhook.processFetch(listener, new Request(
            `http://internal${req.url}`,
            {
                method: "POST",
                headers: req.headers as Record<string, string>,
                body: JSON.stringify(req.body),
            },
        ));
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface WebhookLicense {
    id?: number | string;
    user_id?: number | string;
    plan_id?: number | string;
    plan?: { name?: string };
    is_cancelled?: boolean;
    expiration?: string | null;
    billing_cycle?: number;
    activations_limit?: number | null;
}
interface WebhookUser {
    id?: number | string;
    email?: string;
    first?: string;
    last?: string;
}
interface WebhookObjects {
    license?: WebhookLicense;
    user?: WebhookUser;
    install?: { id?: number | string; url?: string };
}

async function upsertLicenseFromEvent(objects: unknown) {
    const o = objects as WebhookObjects;
    const lic = o?.license;
    const usr = o?.user;
    if (!lic?.id || !usr?.email) return;

    const planCode = planCodeFromFreemius(lic.plan?.name);
    const status = lic.is_cancelled ? "canceled" : "active";
    const billing = lic.billing_cycle === 12 ? "annual" : lic.billing_cycle === 1 ? "monthly" : "lifetime";
    const periodEnd = lic.expiration ? new Date(lic.expiration) : null;

    await withTx(async (client) => {
        const { rows: userRows } = await client.query<{ id: string }>(
            `INSERT INTO users (email, freemius_user_id) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET freemius_user_id = EXCLUDED.freemius_user_id, updated_at = NOW()
             RETURNING id`,
            [usr.email, usr.id != null ? Number(usr.id) : null],
        );
        const userId = userRows[0]!.id;

        const { rows: planRows } = await client.query<{ id: string }>(
            `SELECT id FROM plans WHERE code = $1 LIMIT 1`,
            [planCode],
        );
        const planId = planRows[0]?.id;
        if (!planId) throw new Error(`Plan ${planCode} not found`);

        const { rowCount } = await client.query(
            `UPDATE licenses
                SET plan_id = $2, status = $3::license_status,
                    billing = $4::billing_cycle, current_period_end = $5,
                    canceled_at = CASE WHEN $3 = 'canceled' THEN NOW() ELSE canceled_at END,
                    updated_at = NOW()
              WHERE freemius_license_id = $1`,
            [Number(lic.id), planId, status, billing, periodEnd],
        );
        if (!rowCount) {
            await client.query(
                `INSERT INTO licenses (user_id, plan_id, license_key, freemius_license_id, status, billing, current_period_end)
                 VALUES ($1, $2, $3, $4, $5::license_status, $6::billing_cycle, $7)`,
                [userId, planId, generateLicenseKey(), Number(lic.id), status, billing, periodEnd],
            );
        }
    });
}

async function markLicenseStatus(objects: unknown, status: "canceled" | "expired") {
    const o = objects as WebhookObjects;
    const licId = o?.license?.id;
    if (licId == null) return;
    await query(
        `UPDATE licenses
            SET status = $2::license_status,
                canceled_at = CASE WHEN $2 = 'canceled' THEN NOW() ELSE canceled_at END,
                updated_at = NOW()
          WHERE freemius_license_id = $1`,
        [Number(licId), status],
    );
}

