import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db.js";
import { currentPeriod } from "../auth.js";

/**
 * Account endpoints. Authenticated by a shared INTERNAL_API_KEY so that only
 * our own Next.js server (which holds the user's session) can call them.
 * The client-side React never sees this key.
 */
export default async function accountRoutes(app: FastifyInstance) {
    app.addHook("onRequest", async (req, reply) => {
        if (!req.url.startsWith("/account") && !req.url.startsWith("/v1/account")) return;
        const key = req.headers["x-internal-key"];
        if (typeof key !== "string" || key !== config.INTERNAL_API_KEY) {
            return reply.code(401).send({ error: { code: "unauthorized", message: "Missing or invalid internal key" } });
        }
    });

    app.post("/account/licenses", async (req) => {
        const body = z.object({ email: z.string().email() }).parse(req.body);
        const email = body.email.toLowerCase();
        const period = currentPeriod();

        const { rows: licRows } = await query<{
            license_id: string;
            license_key: string;
            status: string;
            billing: string;
            plan_code: string;
            plan_name: string;
            images_per_month: number;
            max_sites: number;
            supports_avif: boolean;
            current_period_end: Date | null;
            created_at: Date;
        }>(
            `SELECT l.id AS license_id, l.license_key, l.status::text AS status,
                    l.billing::text AS billing,
                    p.code AS plan_code, p.name AS plan_name, p.images_per_month,
                    p.max_sites, p.supports_avif,
                    l.current_period_end, l.created_at
               FROM licenses l
               JOIN users u ON u.id = l.user_id
               JOIN plans p ON p.id = l.plan_id
              WHERE u.email = $1
              ORDER BY l.created_at DESC`,
            [email],
        );

        if (licRows.length === 0) {
            return { email, licenses: [] };
        }

        const ids = licRows.map((r) => r.license_id);

        // Per-period usage.
        const { rows: usageRows } = await query<{ license_id: string; images_used: number }>(
            `SELECT license_id, images_used FROM usage_counters
              WHERE license_id = ANY($1::uuid[]) AND period = $2`,
            [ids, period],
        );
        const usageMap = new Map(usageRows.map((r) => [r.license_id, Number(r.images_used)]));

        // Active sites per license.
        const { rows: siteRows } = await query<{
            license_id: string; site_url: string; site_host: string; last_seen_at: Date | null;
        }>(
            `SELECT license_id, site_url, site_host, last_seen_at FROM sites
              WHERE license_id = ANY($1::uuid[]) AND deactivated_at IS NULL
              ORDER BY activated_at DESC`,
            [ids],
        );
        const sitesMap = new Map<string, typeof siteRows>();
        for (const s of siteRows) {
            const arr = sitesMap.get(s.license_id) ?? [];
            arr.push(s);
            sitesMap.set(s.license_id, arr);
        }

        return {
            email,
            licenses: licRows.map((l) => {
                const used = usageMap.get(l.license_id) ?? 0;
                const sites = sitesMap.get(l.license_id) ?? [];
                return {
                    id: l.license_id,
                    licenseKey: l.license_key,
                    status: l.status,
                    billing: l.billing,
                    plan: {
                        code: l.plan_code,
                        name: l.plan_name,
                        imagesPerMonth: l.images_per_month,
                        maxSites: l.max_sites,
                        supportsAvif: l.supports_avif,
                    },
                    quota: {
                        imagesUsed: used,
                        imagesLimit: l.images_per_month,
                        imagesRemaining: l.images_per_month === -1 ? -1 : Math.max(0, l.images_per_month - used),
                    },
                    sites: sites.map((s) => ({
                        url: s.site_url,
                        host: s.site_host,
                        lastSeenAt: s.last_seen_at,
                    })),
                    currentPeriodEnd: l.current_period_end,
                    createdAt: l.created_at,
                };
            }),
        };
    });
}
