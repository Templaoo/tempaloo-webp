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
}

export const PLANS: Plan[] = [
    {
        code: "free",
        name: "Free",
        tagline: "Try it. No card required.",
        priceMonthly: 0,
        priceAnnual: 0,
        imagesLabel: "150 images / month",
        imagesLimit: 150,
        sites: "1 site",
        features: [
            "WebP conversion",
            "All thumbnail sizes included (1 credit per image)",
            "Automatic on upload",
            "Community support",
        ],
        cta: "Start free",
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
            "Email support (48h)",
            "Priority queue",
        ],
        cta: "Start 7-day trial",
    },
    {
        code: "growth",
        name: "Growth",
        tagline: "For agencies with a handful of sites.",
        priceMonthly: 12,
        priceAnnual: 115,
        imagesLabel: "25 000 images / month",
        imagesLimit: 25000,
        sites: "3 sites",
        features: [
            "WebP + AVIF + CDN",
            "3 sites per licence",
            "Email support (24h)",
            "Usage analytics",
        ],
        cta: "Start 7-day trial",
        highlight: true,
        badge: "Most popular",
    },
    {
        code: "business",
        name: "Business",
        tagline: "For high-traffic stores and publishers.",
        priceMonthly: 29,
        priceAnnual: 278,
        imagesLabel: "150 000 images / month",
        imagesLimit: 150000,
        sites: "10 sites",
        features: [
            "Everything in Growth",
            "Direct API access",
            "Chat support (24h)",
            "99.9% SLA",
        ],
        cta: "Start 7-day trial",
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
            "Unlimited sites",
            "Priority SLA",
            "Dedicated onboarding",
        ],
        cta: "Talk to sales",
    },
];

export function findPlan(code: string): Plan | undefined {
    return PLANS.find((p) => p.code === code);
}
