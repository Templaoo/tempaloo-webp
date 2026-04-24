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
 * Server-only: fetches the plans feed with ISR (5 min). Falls back to a
 * hardcoded seed if the API is unreachable, so a stale /v1/plans (or a
 * build that happens before the API redeploys) never takes the landing
 * page down. Runtime ISR keeps using fresh data as soon as the API is
 * back up.
 */
export async function loadPlans(): Promise<Plan[]> {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.tempaloo.com/v1";
    try {
        const res = await fetch(`${base}/plans`, { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`Plans feed ${res.status}`);
        const data = (await res.json()) as { plans: ApiPlan[] };
        return data.plans.map(fromApi);
    } catch (e) {
        // Log-and-fallback: visible in Vercel build logs, non-fatal.
        // eslint-disable-next-line no-console
        console.warn("[plans] API unreachable, using seed fallback:", e instanceof Error ? e.message : e);
        return FALLBACK_PLANS;
    }
}

/**
 * Seed fallback — mirrors migration 003's UPDATE statements. Kept in sync
 * by the same PR that changes the DB. If the two drift, the build still
 * succeeds but the cards may briefly look wrong until ISR recovers, which
 * is strictly better than a crashed build.
 */
const FALLBACK_PLANS: Plan[] = [
    {
        code: "free", name: "Free", tagline: "Try it. No card required.",
        priceMonthly: 0, priceAnnual: 0,
        imagesLabel: "250 images / month", imagesLimit: 250,
        sites: "1 site",
        features: ["WebP conversion", "1 credit per upload", "Automatic on upload", "Rollover 30 days"],
        cta: "Start free",
    },
    {
        code: "starter", name: "Starter", tagline: "For a single blog or portfolio.",
        priceMonthly: 5, priceAnnual: 48,
        imagesLabel: "5 000 images / month", imagesLimit: 5000,
        sites: "1 site",
        features: ["WebP + AVIF", "Unlimited bulk", "Rollover 30 days", "Email support (48h)"],
        cta: "Start trial",
        freemiusPlanId: 46755,
    },
    {
        code: "growth", name: "Growth", tagline: "For small agencies with a few sites.",
        priceMonthly: 12, priceAnnual: 115,
        imagesLabel: "25 000 images / month", imagesLimit: 25000,
        sites: "5 sites",
        features: ["WebP + AVIF", "5 sites per license", "Rollover 30 days", "Email support (24h)"],
        cta: "Start trial",
        highlight: true, badge: "Popular",
        freemiusPlanId: 46756,
    },
    {
        code: "business", name: "Business", tagline: "For agencies running many sites.",
        priceMonthly: 29, priceAnnual: 278,
        imagesLabel: "150 000 images / month", imagesLimit: 150000,
        sites: "Unlimited sites",
        features: ["Everything in Growth", "Unlimited sites", "Direct API access", "Chat support (24h)"],
        cta: "Start trial",
        freemiusPlanId: 46757,
    },
    {
        code: "unlimited", name: "Unlimited", tagline: "For hosts, platforms, agencies at scale.",
        priceMonthly: 59, priceAnnual: 566,
        imagesLabel: "Unlimited (fair use 500k)", imagesLimit: -1,
        sites: "Unlimited sites",
        features: ["Everything in Business", "Priority SLA", "Dedicated onboarding", "White-label (soon)"],
        cta: "Talk to sales",
        freemiusPlanId: 46758, fairUseCap: 500000,
    },
];

export function findPlan(plans: readonly Plan[], code: string): Plan | undefined {
    return plans.find((p) => p.code === code);
}
