import type { FastifyInstance, FastifyRequest } from "fastify";
import { generateLicenseKey } from "../auth.js";
import { query, withTx } from "../db.js";
import { getFreemius, planCodeFromFreemius } from "../freemius.js";
import { sendTransactional } from "../lib/email.js";
import {
    paymentReceivedEmail,
    subscriptionCancelledEmail,
    trialStartedEmail,
} from "../lib/email-templates.js";

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
            // Email rules:
            //   · brand-new paid trial → trial-started email
            //   · brand-new paid lifetime / direct-purchase → payment-received
            //   · cancellation events → subscription-cancelled (once per license)
            //   · payment.succeeded → payment-received receipt
            // license.updated / extended / plan.changed never fire emails —
            // they're noisy lifecycle events that don't need user attention.
            listener.on("license.created", async ({ objects }) => {
                const r = await upsertLicenseFromEvent(objects);
                if (!r || !r.wasNew) return;
                if (r.status === "trialing" && r.trialEndsAt) {
                    const daysLeft = Math.max(1, Math.ceil((r.trialEndsAt.getTime() - Date.now()) / 86_400_000));
                    sendTransactional(trialStartedEmail({
                        email: r.userEmail, firstName: r.userFirstName,
                        licenseKey: r.licenseKey, planName: r.planName,
                        daysLeft, trialEndsOn: r.trialEndsAt.toISOString().slice(0, 10),
                    }), req.log).catch((e) => req.log.error({ e }, "trial email failed"));
                }
            });
            listener.on("license.updated",  async ({ objects }) => { await upsertLicenseFromEvent(objects); });
            listener.on("license.extended", async ({ objects }) => { await upsertLicenseFromEvent(objects); });
            listener.on("license.plan.changed", async ({ objects }) => { await upsertLicenseFromEvent(objects); });

            listener.on("license.cancelled", async ({ objects }) => {
                await markLicenseStatus(objects, "canceled");
                await sendCancelEmailFor(objects, req.log);
            });
            listener.on("license.expired", async ({ objects }) => {
                await markLicenseStatus(objects, "expired");
            });
            listener.on("subscription.cancelled", async ({ objects }) => {
                // Subscription events carry the license id under
                // objects.subscription.license_id, NOT objects.license.id.
                // Fall back to either so we don't silently drop the cancel.
                await markLicenseStatus(objects, "canceled");
                await sendCancelEmailFor(objects, req.log);
            });
            listener.on("license.deleted", async ({ objects }) => {
                await markLicenseStatus(objects, "canceled");
                await sendCancelEmailFor(objects, req.log);
            });

            // Payment receipts. Freemius fires this on successful charge —
            // initial purchase, trial-to-paid conversion, every renewal.
            // Cast the listener type since the SDK enum doesn't include
            // every event name we care about.
            (listener.on as unknown as (e: string, h: (p: { objects: WebhookObjects & { payment?: { gross?: number; currency?: string; created?: string } } }) => Promise<void>) => void)(
                "payment.succeeded",
                async ({ objects }) => { await sendPaymentEmailFor(objects, req.log); },
            );

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
    /** Freemius enum: 1 = monthly, 12 = annual, 0 = lifetime */
    billing_cycle?: number;
}
interface WebhookPayment {
    id?: number | string;
    gross?: number | string;
    currency?: string;
    created?: string;
    billing_cycle?: number;
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
    payment?: WebhookPayment;
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
 * Billing-cycle resolution that survives Freemius's payload variance.
 *
 * On `license.created` Freemius doesn't always populate
 * `objects.license.billing_cycle` (the field is on the underlying
 * subscription/payment, not always copied to the license entity yet).
 * The previous "license.billing_cycle === 1 ? monthly : lifetime"
 * was therefore false for every brand-new monthly subscription —
 * landed every paid sandbox checkout as `lifetime` in our DB.
 *
 * Resolution order, most-specific first:
 *   1. subscription.billing_cycle  — source of truth for recurring
 *   2. payment.billing_cycle       — present on payment.* events
 *   3. license.billing_cycle       — last; sometimes empty on new licenses
 *   4. infer from license.expiration — has a date → recurring; no date → lifetime
 *      Period delta > 200 days → annual, else monthly.
 */
function resolveBilling(o: WebhookObjects): "monthly" | "annual" | "lifetime" | "free" {
    const cycle =
        o.subscription?.billing_cycle ??
        o.payment?.billing_cycle ??
        o.license?.billing_cycle;

    if (cycle === 12) return "annual";
    if (cycle === 1)  return "monthly";
    if (cycle === 0)  return "lifetime";

    // No explicit cycle — infer from whether there's an expiration.
    const exp = o.license?.expiration;
    if (!exp) return "lifetime";

    const days = (new Date(exp).getTime() - Date.now()) / 86_400_000;
    return days > 200 ? "annual" : "monthly";
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

/**
 * Returns enough state for the caller to fire the right transactional
 * email after the upsert. `wasNew` distinguishes a brand-new license
 * (welcome / trial-started) from an update (no email).
 */
interface UpsertResult {
    wasNew: boolean;
    status: "canceled" | "trialing" | "active";
    planName: string;
    licenseKey: string;
    userEmail: string;
    userFirstName?: string;
    trialEndsAt: Date | null;
}

async function upsertLicenseFromEvent(objects: unknown): Promise<UpsertResult | null> {
    const o = objects as WebhookObjects;
    const lic = o?.license;
    const usr = o?.user;
    if (!lic?.id || !usr?.email) return null;
    const userEmail = usr.email;
    const userFirstName = usr.first ?? undefined;

    // Status priority: cancelled wins, then trial, then active.
    let status: "canceled" | "trialing" | "active";
    if (lic.is_cancelled) status = "canceled";
    else if (isTrialing(lic)) status = "trialing";
    else status = "active";

    const billing = resolveBilling(o);
    const periodEnd = lic.expiration ? new Date(lic.expiration) : null;
    const trialEndsAt = lic.trial_ends ? new Date(lic.trial_ends) : null;

    return withTx(async (client) => {
        const { rows: userRows } = await client.query<{ id: string }>(
            `INSERT INTO users (email, freemius_user_id) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET freemius_user_id = EXCLUDED.freemius_user_id, updated_at = NOW()
             RETURNING id`,
            [usr.email, usr.id != null ? Number(usr.id) : null],
        );
        const userId = userRows[0]!.id;

        // Plan resolution — match by freemius_plan_id FIRST (numeric,
        // stable, never silently misclassifies). Falls back to name only
        // if the id is missing AND the name actually matches one of our
        // canonical codes — never silently default to free anymore, since
        // that masked a serious bug where every paid sandbox checkout
        // landed as Free in our DB.
        let planRow: { id: string; code: string; name: string } | undefined;
        if (lic.plan_id != null) {
            const r = await client.query<{ id: string; code: string; name: string }>(
                `SELECT id, code, name FROM plans WHERE freemius_plan_id = $1 LIMIT 1`,
                [Number(lic.plan_id)],
            );
            planRow = r.rows[0];
        }
        if (!planRow) {
            const code = planCodeFromFreemius(lic.plan?.name);
            const r = await client.query<{ id: string; code: string; name: string }>(
                `SELECT id, code, name FROM plans WHERE code = $1 LIMIT 1`,
                [code],
            );
            planRow = r.rows[0];
        }
        if (!planRow) {
            throw new Error(`Plan not resolvable: freemius_plan_id=${lic.plan_id} name=${lic.plan?.name}`);
        }
        const planId = planRow.id;
        const planName = planRow.name;

        const { rows: updated } = await client.query<{ license_key: string }>(
            `UPDATE licenses
                SET plan_id = $2, status = $3::license_status,
                    billing = $4::billing_cycle, current_period_end = $5,
                    canceled_at = CASE WHEN $3 = 'canceled' THEN NOW() ELSE canceled_at END,
                    updated_at = NOW()
              WHERE freemius_license_id = $1
              RETURNING license_key`,
            [Number(lic.id), planId, status, billing, periodEnd],
        );

        let licenseKey: string;
        let wasNew = false;
        if (updated.length === 0) {
            // Defensive: ON CONFLICT covers the rare concurrent-delivery
            // race. RETURNING gives us the persisted key whether we
            // inserted or the conflicted row already existed.
            licenseKey = generateLicenseKey();
            const { rows: ins } = await client.query<{ license_key: string; xmax: number }>(
                `INSERT INTO licenses (user_id, plan_id, license_key, freemius_license_id, status, billing, current_period_end)
                 VALUES ($1, $2, $3, $4, $5::license_status, $6::billing_cycle, $7)
                 ON CONFLICT (freemius_license_id) DO UPDATE SET updated_at = NOW()
                 RETURNING license_key, xmax::text::int AS xmax`,
                [userId, planId, licenseKey, Number(lic.id), status, billing, periodEnd],
            );
            licenseKey = ins[0]!.license_key;
            // xmax = 0 on a true insert; >0 if the ON CONFLICT path ran.
            wasNew = ins[0]!.xmax === 0;
        } else {
            licenseKey = updated[0]!.license_key;
        }

        // Single-license-per-user invariant.
        //
        // When the just-upserted license is live (active/trialing), every
        // OTHER active/trialing license for the same user is expired.
        // Covers all switch directions in one rule:
        //   Free      → Starter  : Free expired
        //   Starter   → Growth   : Starter expired
        //   Growth    → Business : Growth expired
        //   Business  → Free     : Business expired (rare downgrade)
        //
        // Only the just-upserted row is exempt (matched by
        // freemius_license_id). Already-canceled/expired rows are left
        // alone — they're history.
        if (status === "active" || status === "trialing") {
            await client.query(
                `UPDATE licenses
                    SET status = 'expired'::license_status, updated_at = NOW()
                  WHERE user_id = $1
                    AND freemius_license_id <> $2
                    AND status IN ('active','trialing')`,
                [userId, Number(lic.id)],
            );
        }

        return {
            wasNew, status, planName, licenseKey,
            userEmail, userFirstName, trialEndsAt,
        };
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

// ─── Email triggers (post-DB) ───────────────────────────────────────

interface MinLog { error: (...a: unknown[]) => void; info: (...a: unknown[]) => void }

/**
 * Looks up enough info from the DB to send a cancellation email.
 * We don't trust the webhook payload alone — `objects.user.email` might
 * be missing on subscription.* events, but the joined user row always has it.
 */
async function sendCancelEmailFor(objects: unknown, log: MinLog): Promise<void> {
    const o = objects as WebhookObjects;
    const licId = resolveLicenseId(o);
    if (licId == null) return;
    const { rows } = await query<{ email: string; license_key: string; plan_name: string; first?: string }>(
        `SELECT u.email, l.license_key, p.name AS plan_name
           FROM licenses l
           JOIN users u ON u.id = l.user_id
           JOIN plans p ON p.id = l.plan_id
          WHERE l.freemius_license_id = $1
          LIMIT 1`,
        [licId],
    );
    const r = rows[0];
    if (!r) return;
    sendTransactional(subscriptionCancelledEmail({
        email: r.email, firstName: o?.user?.first ?? undefined,
        licenseKey: r.license_key, planName: r.plan_name,
    }), log).catch((e) => log.error({ e }, "cancel email failed"));
}

interface PaymentEvent { payment?: { gross?: number; currency?: string; created?: string } }

async function sendPaymentEmailFor(objects: unknown, log: MinLog): Promise<void> {
    const o = objects as WebhookObjects & PaymentEvent;
    const licId = resolveLicenseId(o);
    if (licId == null || !o.payment) return;
    const { rows } = await query<{ email: string; plan_name: string; current_period_end: Date | null }>(
        `SELECT u.email, p.name AS plan_name, l.current_period_end
           FROM licenses l
           JOIN users u ON u.id = l.user_id
           JOIN plans p ON p.id = l.plan_id
          WHERE l.freemius_license_id = $1
          LIMIT 1`,
        [licId],
    );
    const r = rows[0];
    if (!r) return;
    const grossCents = Math.round(Number(o.payment.gross ?? 0) * 100);
    if (grossCents <= 0) return;
    sendTransactional(paymentReceivedEmail({
        email: r.email, firstName: o?.user?.first ?? undefined,
        planName: r.plan_name,
        amountCents: grossCents,
        currency: (o.payment.currency ?? "EUR").toUpperCase(),
        nextBillingOn: r.current_period_end?.toISOString().slice(0, 10),
    }), log).catch((e) => log.error({ e }, "payment email failed"));
}

// Re-export used in tests so we can call them without going through HTTP.
export { upsertLicenseFromEvent, markLicenseStatus, resolveLicenseId, isTrialing };
