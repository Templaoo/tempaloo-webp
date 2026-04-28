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
    // Verify/activate: called by plugin on activation.
    // Idempotent: same site on same license is accepted; different site triggers site-limit check.
    app.post("/license/verify", async (req) => {
        const body = verifyBody.parse(req.body);
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
