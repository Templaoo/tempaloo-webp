import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware, generateLicenseKey, resolveLicense } from "../auth.js";
import { query, withTx } from "../db.js";
import { ApiError, err } from "../errors.js";
import { sendTransactional } from "../lib/email.js";
import { welcomeFreeEmail } from "../lib/email-templates.js";
import { normalizeEmail } from "../lib/email-normalize.js";

function normalizeHost(siteUrl: string): string {
    try {
        const u = new URL(siteUrl);
        return u.host.toLowerCase();
    } catch {
        throw err.unprocessable("Invalid site_url");
    }
}

const verifyBody = z.object({
    license_key: z.string().min(32),
    site_url: z.string().url(),
    wp_version: z.string().optional(),
    plugin_version: z.string().optional(),
});

const deactivateBody = z.object({
    site_url: z.string().url(),
});

const generateBody = z.object({
    email: z.string().email(),
    site_url: z.string().url(),
    captcha: z.string().optional(),
});

export default async function licenseRoutes(app: FastifyInstance) {
    // Verify/activate: called by plugin on activation AND on a daily cron
    // for re-verification. We cannot use the strict `resolveLicense` path
    // here — it throws 401 for expired/canceled licenses, which is exactly
    // the state the plugin needs to LEARN about (so it can show the
    // "Your license expired" notice). So we do a lenient lookup and return:
    //   · valid:true                            → license active or trialing
    //   · valid:false + status:'expired'|'canceled'|'past_due' → known but inactive
    //   · 401                                    → license_key not found at all
    app.post("/license/verify", async (req, reply) => {
        const body = verifyBody.parse(req.body);

        const { rows } = await query<{
            license_id: string; plan_code: string; plan_name: string;
            images_per_month: number; max_sites: number; supports_avif: boolean;
            status: string; current_period_end: Date | null;
            user_email: string;
        }>(
            `SELECT l.id AS license_id, p.code AS plan_code, p.name AS plan_name,
                    p.images_per_month, p.max_sites, p.supports_avif,
                    l.status::text AS status, l.current_period_end,
                    u.email AS user_email
               FROM licenses l
               JOIN plans p ON p.id = l.plan_id
               JOIN users u ON u.id = l.user_id
              WHERE l.license_key = $1
              LIMIT 1`,
            [body.license_key],
        );
        const row = rows[0];
        if (!row) return reply.code(401).send({ error: { code: "unauthorized", message: "Unknown license key" } });

        // Lenient path: surface the known-bad status to the plugin so it
        // can render the right CTA, without granting any privileges.
        if (row.status !== "active" && row.status !== "trialing") {
            return {
                valid: false,
                plan: row.plan_code,
                plan_name: row.plan_name,
                status: row.status,
                supports_avif: row.supports_avif,
                images_limit: row.images_per_month,
                sites_limit: row.max_sites,
                period_end: row.current_period_end?.toISOString() ?? null,
                user_email: row.user_email,
            };
        }

        // Active / trialing: re-fetch via the strict path so we run the
        // same site-limit / activation logic as before.
        const license = await resolveLicense(body.license_key);
        const host = normalizeHost(body.site_url);
        const activationIp = req.ip || null;

        return withTx(async (client) => {
            // ─── Site-claim enforcement ────────────────────────────
            // The rule: a site_host can only ever be claimed by ONE
            // tempaloo user. If someone tries to activate a license
            // belonging to a DIFFERENT user on a host already in use,
            // refuse — this is the path a fraudster takes when they
            // exhaust their Free quota and try to chain a fresh key
            // from a new account onto the same site.
            //
            // Same-user activation IS allowed even if the OLD row is
            // tied to a different license (e.g. user upgraded Free →
            // Starter and is now activating the new key on their site).
            // We deactivate the old site row inside the transaction
            // and create a fresh one for the new license — so the
            // sites table always reflects the live binding.
            const { rows: claimRows } = await client.query<{
                id: string; license_id: string; deactivated_at: Date | null;
                owner_user_id: string;
            }>(
                `SELECT s.id, s.license_id, s.deactivated_at, l.user_id AS owner_user_id
                   FROM sites s
                   JOIN licenses l ON l.id = s.license_id
                  WHERE s.site_host = $1
                    AND s.deactivated_at IS NULL
                  LIMIT 1`,
                [host],
            );
            const claim = claimRows[0];

            if (claim && claim.owner_user_id !== license.userId) {
                // Different user owns this host. Refuse, with a clear
                // code so the plugin can render the right message.
                throw new ApiError(
                    403,
                    "site_already_claimed",
                    "This WordPress site is already linked to another Tempaloo account. " +
                    "Sign in with the original account, or contact support if you've changed accounts.",
                );
            }

            // ─── Existing-row swap path (same user, possibly different key) ───
            if (claim && claim.license_id !== license.licenseId) {
                // Same user, but they're moving from one of their own
                // licenses to another (e.g. Free → Starter). Deactivate
                // the old site row so the slot is freed on the previous
                // license, then fall through to the normal create path.
                await client.query(
                    `UPDATE sites
                        SET deactivated_at = NOW()
                      WHERE id = $1`,
                    [claim.id],
                );
            }

            // ─── Normal flow: register or refresh the site row ─────
            const { rows: existing } = await client.query<{ id: string; deactivated_at: Date | null }>(
                `SELECT id, deactivated_at FROM sites
                 WHERE license_id = $1 AND site_host = $2
                 LIMIT 1`,
                [license.licenseId, host],
            );

            if (existing.length === 0) {
                if (license.maxSites !== -1) {
                    const { rows: countRows } = await client.query<{ active: number }>(
                        `SELECT COUNT(*)::int AS active FROM sites
                         WHERE license_id = $1 AND deactivated_at IS NULL`,
                        [license.licenseId],
                    );
                    if ((countRows[0]?.active ?? 0) >= license.maxSites) {
                        throw err.siteLimit();
                    }
                }
                await client.query(
                    `INSERT INTO sites (license_id, site_url, site_host, wp_version, plugin_version, last_seen_at, activation_ip)
                     VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
                    [license.licenseId, body.site_url, host, body.wp_version ?? null, body.plugin_version ?? null, activationIp],
                );
            } else {
                await client.query(
                    `UPDATE sites
                        SET deactivated_at = NULL,
                            last_seen_at = NOW(),
                            wp_version = COALESCE($3, wp_version),
                            plugin_version = COALESCE($4, plugin_version),
                            activation_ip = COALESCE(activation_ip, $5)
                      WHERE id = $1 AND license_id = $2`,
                    [existing[0]!.id, license.licenseId, body.wp_version ?? null, body.plugin_version ?? null, activationIp],
                );
            }

            return {
                valid: true,
                plan: license.planCode,
                status: license.status,
                supports_avif: license.supportsAvif,
                images_limit: license.imagesPerMonth,
                sites_limit: license.maxSites,
                user_email: row.user_email,
            };
        });
    });

    // Create a Free license (activation flow, tempaloo.com/webp/activate).
    app.post(
        "/license/generate",
        {
            config: {
                rateLimit: { max: 5, timeWindow: "1 hour" },
            },
        },
        async (req, reply) => {
            const body = generateBody.parse(req.body);
            // TODO: verify captcha (Turnstile/hCaptcha) when in prod.

            // Normalize for de-dup. Gmail aliases (john+spam@gmail.com,
            // j.o.h.n@gmail.com) all collapse to the same canonical form
            // so we never create separate users for the same inbox.
            const normalized = normalizeEmail(body.email);

            return withTx(async (client) => {
                const { rows: planRows } = await client.query<{ id: string }>(
                    `SELECT id FROM plans WHERE code = 'free' LIMIT 1`,
                );
                const planId = planRows[0]?.id;
                if (!planId) throw err.unprocessable("Free plan not configured");

                // Conflict target is email_normalized (the new UNIQUE column)
                // so two visually different Gmail addresses that resolve to
                // the same inbox merge into one row. We keep the user's
                // typed `email` for display / sending.
                const { rows: userRows } = await client.query<{ id: string }>(
                    `INSERT INTO users (email, email_normalized) VALUES ($1, $2)
                     ON CONFLICT (email_normalized) DO UPDATE SET updated_at = NOW()
                     RETURNING id`,
                    [body.email, normalized],
                );
                const userId = userRows[0]!.id;

                const { rows: existing } = await client.query<{ license_key: string }>(
                    `SELECT l.license_key FROM licenses l
                      JOIN plans p ON p.id = l.plan_id
                      WHERE l.user_id = $1 AND p.code = 'free' AND l.status IN ('active','trialing')
                      LIMIT 1`,
                    [userId],
                );
                if (existing[0]) {
                    return reply.code(200).send({
                        license_key: existing[0].license_key,
                        plan: "free",
                        message: "Existing license returned",
                    });
                }

                const licenseKey = generateLicenseKey();
                await client.query(
                    `INSERT INTO licenses (user_id, plan_id, license_key, status, billing)
                     VALUES ($1, $2, $3, 'active', 'free')`,
                    [userId, planId, licenseKey],
                );

                // Fire welcome email — fire-and-forget so a Brevo hiccup
                // never makes the signup itself fail. The wrapper logs
                // failures internally; we don't await on the response.
                sendTransactional(
                    welcomeFreeEmail({ email: body.email, licenseKey, planName: "Free" }),
                    req.log,
                ).catch((e) => req.log.error({ e }, "welcome email send failed"));

                return reply.code(201).send({
                    license_key: licenseKey,
                    plan: "free",
                });
            });
        },
    );

    // Deactivate a site (free up a slot).
    app.post("/license/deactivate", async (req, reply) => {
        const license = await authMiddleware(req);
        const body = deactivateBody.parse(req.body);
        const host = normalizeHost(body.site_url);

        const { rowCount } = await query(
            `UPDATE sites SET deactivated_at = NOW()
              WHERE license_id = $1 AND site_host = $2 AND deactivated_at IS NULL`,
            [license.licenseId, host],
        );
        if (!rowCount) return reply.code(404).send({ error: { code: "not_found", message: "Site not found" } });
        return reply.code(204).send();
    });
}
