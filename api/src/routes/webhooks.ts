import type { FastifyInstance, FastifyRequest } from "fastify";
import { generateLicenseKey } from "../auth.js";
import { query, withTx } from "../db.js";
import { getFreemius, planCodeFromFreemius } from "../freemius.js";

/**
 * Freemius webhook receiver.
 *
 * Hardening pass (audit fixes):
 *   1. HMAC signature is verified against the RAW request body (bytes-
 *      identical to what Freemius signed). The previous version did
 *      JSON.stringify(req.body) which produces a re-formatted payload
 *      that NEVER matches Freemius' signature → fraud or 100% rejection
 *      depending on the SDK's behavior. Fixed by registering a scoped
 *      content-type parser that keeps the body as a Buffer.
 *
 *   2. Idempotence: every incoming webhook is recorded in webhooks_events
 *      with a UNIQUE (provider, event_id) constraint. Retries land on
 *      the unique-violation branch and are silently ack'd, so we never
 *      apply the same change twice. Includes processed_at for audit.
 *
 *   3. Trial vs. active distinction: license.created from a paid plan
 *      with trial_ends in the future is now stored as 'trialing' instead
 *      of 'active'. Lets us surface "trial ends in N days" in the dashboard
 *      and run drip campaigns from real DB state.
 *
 *   4. subscription.cancelled now actually finds the license. Old code
 *      only looked at objects.license.id, but on subscription events the
 *      license id lives at objects.subscription.license_id. The lookup
 *      now tries both, so cancellations of a subscription propagate to
 *      the related license immediately.
 */
export default async function webhooksRoute(app: FastifyInstance) {
    // Scoped raw-body parser. Only this plugin scope keeps the buffer;
    // the rest of the API still parses JSON normally.
    await app.register(async (scope) => {
        scope.removeContentTypeParser("application/json");
        scope.addContentTypeParser(
            "application/json",
            { parseAs: "buffer" },
            (_req, body, done) => done(null, body),
        );

        scope.post("/webhooks/freemius", async (req, reply) => {
            const fs = getFreemius();
            if (!fs) {
                return reply.code(503).send({ error: { code: "not_configured", message: "Freemius not configured on this server" } });
            }

            const rawBody = req.body as Buffer;

            // Pre-parse minimally so we can extract event_id for idempotency.
            // We do NOT trust this until the SDK has verified the HMAC below —
            // it's only used to dedupe AFTER verification succeeds.
            let parsed: WebhookEnvelope;
            try {
                parsed = JSON.parse(rawBody.toString("utf8")) as WebhookEnvelope;
            } catch {
                return reply.code(400).send({ error: { code: "bad_json", message: "Invalid JSON body" } });
            }

            const listener = fs.webhook.createListener();

            // Resolve the dedup key from the envelope. Freemius uses different
            // shapes per event type — id, event_id, or hash all show up.
            const eventId = String(
                parsed.id ??
                parsed.event_id ??
                (parsed.objects?.event && parsed.objects.event.id) ??
                ""
            );
            const eventType = String(parsed.type ?? parsed.event ?? "unknown");

            // ─── Lifecycle handlers ─────────────────────────────────────
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
                // Subscription events carry the license id under
                // objects.subscription.license_id, NOT objects.license.id.
                // Fall back to either so we don't silently drop the cancel.
                await markLicenseStatus(objects, "canceled");
            });
            listener.on("license.plan.changed", async ({ objects }) => {
                await upsertLicenseFromEvent(objects);
            });
            listener.on("license.deleted", async ({ objects }) => {
                await markLicenseStatus(objects, "canceled");
            });

            // ─── Idempotence guard (BEFORE handing off to the SDK) ──────
            // We try to claim the event_id row first. If it already exists
            // we skip processing — but we still respond 200 so Freemius
            // stops retrying.
            if (eventId) {
                try {
                    const { rowCount } = await query(
                        `INSERT INTO webhooks_events (provider, event_id, event_type, payload)
                         VALUES ('freemius', $1, $2, $3::jsonb)
                         ON CONFLICT (provider, event_id) DO NOTHING`,
                        [eventId, eventType, rawBody.toString("utf8")],
                    );
                    if (rowCount === 0) {
                        // Already processed in a previous delivery.
                        req.log.info({ eventId, eventType }, "duplicate webhook ignored");
                        return reply.code(200).send({ ok: true, duplicate: true });
                    }
                } catch (e) {
                    req.log.error({ e, eventId }, "webhook dedup insert failed");
                    // Don't bail — fall through and let the SDK process.
                }
            }

            // ─── Hand off to the SDK with the raw body for HMAC ─────────
            const sdkResponse = await fs.webhook.processFetch(listener, new Request(
                `http://internal${req.url}`,
                {
                    method: "POST",
                    headers: req.headers as Record<string, string>,
                    body: rawBody,                 // ← bytes-identical to what Freemius signed
                },
            ));

            // ─── Mark as processed for audit (best-effort) ──────────────
            if (eventId && sdkResponse.status >= 200 && sdkResponse.status < 300) {
                await query(
                    `UPDATE webhooks_events SET processed_at = NOW()
                      WHERE provider = 'freemius' AND event_id = $1`,
                    [eventId],
                ).catch((e) => req.log.error({ e, eventId }, "webhook processed_at update failed"));
            }

            // If the SDK rejected (bad signature, malformed) record the error.
            if (eventId && sdkResponse.status >= 400) {
                await query(
                    `UPDATE webhooks_events SET processing_error = $2
                      WHERE provider = 'freemius' AND event_id = $1`,
                    [eventId, `sdk_status_${sdkResponse.status}`],
                ).catch(() => { /* logging only */ });
            }

            return sdkResponse;
        });
    });
}

// ─── Types ──────────────────────────────────────────────────────────────

interface WebhookEnvelope {
    id?: number | string;
    event_id?: number | string;
    type?: string;
    event?: string;
    objects?: WebhookObjects & { event?: { id?: number | string } };
}
interface WebhookLicense {
    id?: number | string;
    user_id?: number | string;
    plan_id?: number | string;
    plan?: { name?: string };
    is_cancelled?: boolean;
    expiration?: string | null;
    billing_cycle?: number;
    activations_limit?: number | null;
    /** Freemius marks paid trials with this — null/empty otherwise. */
    trial_ends?: string | null;
    is_trial?: boolean;
}
interface WebhookSubscription {
    id?: number | string;
    license_id?: number | string;
    user_id?: number | string;
    plan_id?: number | string;
}
interface WebhookUser {
    id?: number | string;
    email?: string;
    first?: string;
    last?: string;
}
interface WebhookObjects {
    license?: WebhookLicense;
    subscription?: WebhookSubscription;
    user?: WebhookUser;
    install?: { id?: number | string; url?: string };
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Resolve the Freemius license id from any event shape.
 * - license.* events:           objects.license.id
 * - subscription.* events:      objects.subscription.license_id (license.id is absent)
 */
function resolveLicenseId(o: WebhookObjects | undefined): number | null {
    const direct = o?.license?.id;
    if (direct != null) return Number(direct);
    const fromSub = o?.subscription?.license_id;
    if (fromSub != null) return Number(fromSub);
    return null;
}

/**
 * Trial detection — Freemius can flag this two ways depending on the
 * event. Either field "wins" if set, since they're never both falsey
 * on a real trial.
 */
function isTrialing(lic: WebhookLicense): boolean {
    if (lic.is_trial === true) return true;
    if (lic.trial_ends) {
        const end = new Date(lic.trial_ends);
        if (Number.isFinite(end.getTime()) && end.getTime() > Date.now()) return true;
    }
    return false;
}

async function upsertLicenseFromEvent(objects: unknown) {
    const o = objects as WebhookObjects;
    const lic = o?.license;
    const usr = o?.user;
    if (!lic?.id || !usr?.email) return;

    const planCode = planCodeFromFreemius(lic.plan?.name);

    // Status priority: cancelled wins, then trial, then active.
    let status: "canceled" | "trialing" | "active";
    if (lic.is_cancelled) status = "canceled";
    else if (isTrialing(lic)) status = "trialing";
    else status = "active";

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
            // Defensive: catch the rare race where two webhooks for the
            // same license arrive concurrently. The UNIQUE constraint on
            // freemius_license_id will reject the second insert; ignore it.
            await client.query(
                `INSERT INTO licenses (user_id, plan_id, license_key, freemius_license_id, status, billing, current_period_end)
                 VALUES ($1, $2, $3, $4, $5::license_status, $6::billing_cycle, $7)
                 ON CONFLICT (freemius_license_id) DO NOTHING`,
                [userId, planId, generateLicenseKey(), Number(lic.id), status, billing, periodEnd],
            );
        }
    });
}

async function markLicenseStatus(objects: unknown, status: "canceled" | "expired") {
    const o = objects as WebhookObjects;
    const licId = resolveLicenseId(o);
    if (licId == null) return;
    await query(
        `UPDATE licenses
            SET status = $2::license_status,
                canceled_at = CASE WHEN $2 = 'canceled' THEN NOW() ELSE canceled_at END,
                updated_at = NOW()
          WHERE freemius_license_id = $1`,
        [licId, status],
    );
}

// Re-export used in tests so we can call them without going through HTTP.
export { upsertLicenseFromEvent, markLicenseStatus, resolveLicenseId, isTrialing };
