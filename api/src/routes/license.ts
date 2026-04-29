import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware, generateLicenseKey, resolveLicense } from "../auth.js";
import { query, withTx } from "../db.js";
import { err } from "../errors.js";
import { sendTransactional } from "../lib/email.js";
import { welcomeFreeEmail } from "../lib/email-templates.js";

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

        return withTx(async (client) => {
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
                    `INSERT INTO sites (license_id, site_url, site_host, wp_version, plugin_version, last_seen_at)
                     VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [license.licenseId, body.site_url, host, body.wp_version ?? null, body.plugin_version ?? null],
                );
            } else {
                await client.query(
                    `UPDATE sites
                        SET deactivated_at = NULL,
                            last_seen_at = NOW(),
                            wp_version = COALESCE($3, wp_version),
                            plugin_version = COALESCE($4, plugin_version)
                      WHERE id = $1 AND license_id = $2`,
                    [existing[0]!.id, license.licenseId, body.wp_version ?? null, body.plugin_version ?? null],
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

            return withTx(async (client) => {
                const { rows: planRows } = await client.query<{ id: string }>(
                    `SELECT id FROM plans WHERE code = 'free' LIMIT 1`,
                );
                const planId = planRows[0]?.id;
                if (!planId) throw err.unprocessable("Free plan not configured");

                const { rows: userRows } = await client.query<{ id: string }>(
                    `INSERT INTO users (email) VALUES ($1)
                     ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
                     RETURNING id`,
                    [body.email],
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
