/**
 * Plans live in the API (GET /v1/plans — fed by the `plans` table).
 * This module defines the client-facing shape + a server-only loader with
 * ISR caching, so the landing page, /webp/activate and the plugin admin
 * never drift from the canonical DB.
 */

export interface Plan {
    code: "free" | "starter" | "growth" | "business" | "unlimited";
    name: string;
    tagline: string;
    priceMonthly: number;   // EUR (float, derived from *_cents)
    priceAnnual: number;    // EUR total per year (derived from *_cents)
    imagesLabel: string;    // humanised, e.g. "5 000 images / month"
    imagesLimit: number;    // raw, -1 = unlimited
    sites: string;          // humanised, e.g. "5 sites"
    features: string[];     // bullets[] from the API
    cta: string;            // ctaLabel from the API
    highlight?: boolean;    // isFeatured from the API
    badge?: string;
    freemiusPlanId?: number;  // numeric id from Freemius Dashboard (null for free)
    fairUseCap?: number;    // for Unlimited, null/undefined otherwise
}

// Product-level identifiers stay hardcoded — they're global, never per-plan.
export const FREEMIUS_PRODUCT_ID = 28337;
export const FREEMIUS_PUBLIC_KEY = "pk_259a7f9b6c36048a8ee79c2f9dd0b";

// Raw shape returned by /v1/plans — mirrors api/src/routes/plans.ts.
interface ApiPlan {
    code: Plan["code"];
    name: string;
    tagline: string;
    imagesPerMonth: number;
    maxSites: number;
    supportsAvif: boolean;
    supportsCdn: boolean;
    supportsApiDirect: boolean;
    priceMonthlyCents: number;
    priceAnnualCents: number;
    fairUseCap: number | null;
    freemiusPlanId: number | null;
    bullets: string[];
    badge: string | null;
    ctaLabel: string;
    isFeatured: boolean;
}

function formatImages(p: ApiPlan): string {
    if (p.imagesPerMonth === -1) {
        return p.fairUseCap ? `Unlimited (fair use ${(p.fairUseCap / 1000).toFixed(0)}k)` : "Unlimited";
    }
    // Group thousands with a thin space for readability in EU locales.
    return `${p.imagesPerMonth.toLocaleString("en-US").replace(/,/g, " ")} images / month`;
}

function formatSites(p: ApiPlan): string {
    if (p.maxSites === -1) return "Unlimited sites";
    return p.maxSites === 1 ? "1 site" : `${p.maxSites} sites`;
}

function fromApi(p: ApiPlan): Plan {
    return {
        code: p.code,
        name: p.name,
        tagline: p.tagline,
        priceMonthly: p.priceMonthlyCents / 100,
        priceAnnual: p.priceAnnualCents / 100,
        imagesLabel: formatImages(p),
        imagesLimit: p.imagesPerMonth,
        sites: formatSites(p),
        features: p.bullets,
        cta: p.ctaLabel,
        highlight: p.isFeatured || undefined,
        badge: p.badge ?? undefined,
        freemiusPlanId: p.freemiusPlanId ?? undefined,
        fairUseCap: p.fairUseCap ?? undefined,
    };
}

/**
 * Server-only: fetches the plans feed with ISR (5 min). Throws if the feed
 * is unavailable — callers should let Next.js render its error boundary.
 */
export async function loadPlans(): Promise<Plan[]> {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.tempaloo.com/v1";
    const res = await fetch(`${base}/plans`, {
        next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Plans feed ${res.status}`);
    const data = (await res.json()) as { plans: ApiPlan[] };
    return data.plans.map(fromApi);
}

export function findPlan(plans: readonly Plan[], code: string): Plan | undefined {
    return plans.find((p) => p.code === code);
}
