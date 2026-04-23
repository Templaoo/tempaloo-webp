import type { FastifyInstance } from "fastify";
import { authMiddleware, currentPeriod } from "../auth.js";
import { query } from "../db.js";

export default async function quotaRoute(app: FastifyInstance) {
    app.get("/quota", async (req) => {
        const license = await authMiddleware(req);
        const period = currentPeriod();

        const { rows } = await query<{
            images_used: number;
            sites_used: number;
            period_start: Date;
            period_end: Date;
        }>(
            `SELECT COALESCE(uc.images_used, 0) AS images_used,
                    (SELECT COUNT(*)::int FROM sites s
                      WHERE s.license_id = $1 AND s.deactivated_at IS NULL) AS sites_used,
                    $2::date AS period_start,
                    ($2::date + INTERVAL '1 month')::date AS period_end
             FROM (SELECT 1) _
             LEFT JOIN usage_counters uc
               ON uc.license_id = $1 AND uc.period = $2`,
            [license.licenseId, period],
        );
        const r = rows[0]!;

        return {
            plan: license.planCode,
            images_used: r.images_used,
            images_limit: license.imagesPerMonth,
            images_remaining:
                license.imagesPerMonth === -1
                    ? -1
                    : Math.max(0, license.imagesPerMonth - r.images_used),
            sites_used: r.sites_used,
            sites_limit: license.maxSites,
            period_start: r.period_start,
            period_end: r.period_end,
        };
    });
}
