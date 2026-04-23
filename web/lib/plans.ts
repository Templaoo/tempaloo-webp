export interface Plan {
    code: "free" | "starter" | "growth" | "business" | "unlimited";
    name: string;
    tagline: string;
    priceMonthly: number;   // EUR
    priceAnnual: number;    // EUR (total per year)
    imagesLabel: string;
    imagesLimit: number;    // -1 = unlimited
    sites: string;
    features: string[];
    cta: string;
    highlight?: boolean;
    badge?: string;
    freemiusPlanId?: number;  // numeric id from Freemius Dashboard
}

// Tempaloo WebP product ID on Freemius (safe to expose — it's public).
export const FREEMIUS_PRODUCT_ID = 28337;
// Public key is also safe on the client — it identifies the product in Checkout.
export const FREEMIUS_PUBLIC_KEY = "pk_259a7f9b6c36048a8ee79c2f9dd0b";

export const PLANS: Plan[] = [
    {
        code: "free",
        name: "Free",
        tagline: "Try it. No card required.",
        priceMonthly: 0,
        priceAnnual: 0,
        imagesLabel: "250 images / month",
        imagesLimit: 250,
        sites: "1 site",
        features: [
            "WebP conversion",
            "1 credit per upload (all sizes included)",
            "Automatic on upload",
            "Unused credits roll over (30 days)",
        ],
        cta: "Start free",
        freemiusPlanId: 46754,
    },
    {
        code: "starter",
        name: "Starter",
        tagline: "For a single blog or portfolio.",
        priceMonthly: 5,
        priceAnnual: 48,
        imagesLabel: "5 000 images / month",
        imagesLimit: 5000,
        sites: "1 site",
        features: [
            "WebP + AVIF",
            "Unlimited bulk",
            "Credit rollover (30 days)",
            "Email support (48h)",
        ],
        cta: "Start 7-day trial",
        freemiusPlanId: 46755,
    },
    {
        code: "growth",
        name: "Growth",
        tagline: "For small agencies with a few sites.",
        priceMonthly: 12,
        priceAnnual: 115,
        imagesLabel: "25 000 images / month",
        imagesLimit: 25000,
        sites: "5 sites",
        features: [
            "WebP + AVIF",
            "5 sites per license",
            "Credit rollover (30 days)",
            "Email support (24h)",
        ],
        cta: "Start 7-day trial",
        highlight: true,
        badge: "Most popular",
        freemiusPlanId: 46756,
    },
    {
        code: "business",
        name: "Business",
        tagline: "For agencies running many client sites.",
        priceMonthly: 29,
        priceAnnual: 278,
        imagesLabel: "150 000 images / month",
        imagesLimit: 150000,
        sites: "Unlimited sites",
        features: [
            "Everything in Growth",
            "Unlimited sites",
            "Direct API access",
            "Chat support (24h)",
        ],
        cta: "Start 7-day trial",
        freemiusPlanId: 46757,
    },
    {
        code: "unlimited",
        name: "Unlimited",
        tagline: "For hosts, platforms, and agencies at scale.",
        priceMonthly: 59,
        priceAnnual: 566,
        imagesLabel: "Unlimited (fair use 500k)",
        imagesLimit: -1,
        sites: "Unlimited",
        features: [
            "Everything in Business",
            "Priority SLA",
            "Dedicated onboarding",
            "White-label reports (soon)",
        ],
        cta: "Talk to sales",
        freemiusPlanId: 46758,
    },
];

export function findPlan(code: string): Plan | undefined {
    return PLANS.find((p) => p.code === code);
}
