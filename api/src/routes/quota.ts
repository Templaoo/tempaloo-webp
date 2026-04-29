import type { FastifyInstance } from "fastify";
import { authMiddleware, currentPeriod } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";

export default async function quotaRoute(app: FastifyInstance) {
    app.get("/quota", async (req) => {
        const license = await authMiddleware(req);
        const period = currentPeriod();

        const { rows } = await query<{
            images_used: number;
            sites_used: number;
            effective_limit: number;
            prev_used: number;
            period_start: Date;
            period_end: Date;
        }>(
            `SELECT COALESCE(uc.images_used, 0) AS images_used,
                    (SELECT COUNT(*)::int FROM sites s
                      WHERE s.license_id = $1 AND s.deactivated_at IS NULL) AS sites_used,
                    effective_quota($1::uuid, $2::date) AS effective_limit,
                    COALESCE((SELECT images_used FROM usage_counters
                               WHERE license_id = $1 AND period = ($2::date - INTERVAL '1 month')::date), 0) AS prev_used,
                    $2::date AS period_start,
                    ($2::date + INTERVAL '1 month')::date AS period_end
             FROM (SELECT 1) _
             LEFT JOIN usage_counters uc
               ON uc.license_id = $1 AND uc.period = $2`,
            [license.licenseId, period],
        );
        const r = rows[0]!;

        const planLimit = license.imagesPerMonth;
        const isUnlimited = planLimit === -1;
        const rollover = isUnlimited ? 0 : Math.max(0, Math.min(planLimit, planLimit - Number(r.prev_used)));

        return {
            plan: license.planCode,
            images_used: r.images_used,
            images_limit: planLimit,            // base plan cap (kept for compat)
            images_rollover: rollover,           // unused from previous month
            images_effective: isUnlimited ? -1 : Number(r.effective_limit),
            images_remaining:
                isUnlimited
                    ? -1
                    : Math.max(0, Number(r.effective_limit) - r.images_used),
            sites_used: r.sites_used,
            sites_limit: license.maxSites,
            period_start: r.period_start,
            period_end: r.period_end,
            // Daily bulk cap exposed from server config so the plugin
            // doesn't hardcode "50/day". Only meaningful for Free —
            // every paid plan returns 0 here meaning "no daily cap".
            daily_bulk_limit:
                license.planCode === "free" ? config.BULK_DAILY_LIMIT_FREE : 0,
        };
    });
}
