import type { FastifyInstance } from "fastify";
import { query } from "../db.js";

/**
 * Public plans feed — the single source of truth shared by:
 *   · the Next.js landing page + /webp/activate (ISR fetch)
 *   · the WordPress plugin admin (Upgrade tab, activate banner)
 *
 * No auth: these are marketing prices anyone can already see.
 * Cached aggressively — plans change a few times a year, not per request.
 */
export default async function plansRoute(app: FastifyInstance) {
    app.get("/plans", async (req, reply) => {
        const { rows } = await query<{
            code: string;
            name: string;
            tagline: string;
            images_per_month: number;
            max_sites: number;
            supports_avif: boolean;
            supports_cdn: boolean;
            supports_api_direct: boolean;
            price_monthly_cents: number;
            price_annual_cents: number;
            fair_use_cap: number | null;
            freemius_plan_id: string | null;
            bullets: string[];
            badge: string | null;
            cta_label: string;
            is_featured: boolean;
            sort_order: number;
        }>(
            `SELECT code, name, tagline,
                    images_per_month, max_sites,
                    supports_avif, supports_cdn, supports_api_direct,
                    price_monthly_cents, price_annual_cents, fair_use_cap,
                    freemius_plan_id::text AS freemius_plan_id,
                    bullets, badge, cta_label, is_featured, sort_order
               FROM plans
              WHERE is_active = TRUE AND is_public = TRUE
              ORDER BY sort_order`,
        );

        // 5 min browser cache, 5 min CDN cache, 10 min stale-while-revalidate.
        // Plan changes don't need to propagate instantly — a short delay is fine.
        reply.header("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=600");

        return {
            plans: rows.map((r) => ({
                code: r.code,
                name: r.name,
                tagline: r.tagline,
                imagesPerMonth: r.images_per_month,
                maxSites: r.max_sites,
                supportsAvif: r.supports_avif,
                supportsCdn: r.supports_cdn,
                supportsApiDirect: r.supports_api_direct,
                priceMonthlyCents: r.price_monthly_cents,
                priceAnnualCents: r.price_annual_cents,
                fairUseCap: r.fair_use_cap,
                freemiusPlanId: r.freemius_plan_id ? Number(r.freemius_plan_id) : null,
                bullets: r.bullets,
                badge: r.badge,
                ctaLabel: r.cta_label,
                isFeatured: r.is_featured,
            })),
        };
    });
}
