/**
 * Competitor data for /webp/vs-* pages. Numbers are public knowledge,
 * sourced from each vendor's pricing page (April 2026). Calculator math
 * uses these as the per-month effective cost-per-image.
 */

export type CompetitorSlug = "shortpixel" | "imagify" | "tinypng";

export interface Competitor {
    slug: CompetitorSlug;
    name: string;
    site: string;

    // The killer angle — "1 credit per thumbnail" vs our "1 credit per upload".
    // avgThumbnailsPerUpload is what WordPress generates by default + a
    // typical Woo/Elementor add-on. 7 is realistic on most installs.
    countingModel: string;
    avgThumbnailsPerUpload: number;

    // Pricing snapshot (EUR, monthly, paid entry tier)
    freeMonthlyImagesEffective: number;     // real photos you can convert/mo on free
    freeMonthlyClaimed: string;             // what they advertise (claim)
    paidEntryName: string;
    paidEntryPriceEur: number;
    paidEntryImagesEffective: number;       // real photos /mo at paid entry tier

    // Feature parity matrix
    avif: boolean;
    cdn: "no" | "yes" | "addon";
    restore: boolean;
    resizeOnUpload: boolean;
    multisite: boolean;
    wpCli: boolean;
    hooks: "few" | "standard" | "extensive";
    euHosted: boolean;
    pricingTransparency: "clear" | "complex" | "tiered-credits";

    // Marketing color used for the muted accent on the page
    accent: string;
}

export const COMPETITORS: Record<CompetitorSlug, Competitor> = {
    shortpixel: {
        slug: "shortpixel",
        name: "ShortPixel",
        site: "shortpixel.com",
        countingModel: "1 credit per thumbnail (full + medium + medium_large + thumbnail + …)",
        avgThumbnailsPerUpload: 7,
        freeMonthlyImagesEffective: 14,           // 100 credits ÷ 7 thumbs ≈ 14
        freeMonthlyClaimed: "100 credits / month",
        paidEntryName: "Short Plan",
        paidEntryPriceEur: 9.99,
        paidEntryImagesEffective: 4285,           // 30k credits ÷ 7 thumbs
        avif: true,
        cdn: "yes",
        restore: true,
        resizeOnUpload: true,
        multisite: true,
        wpCli: true,
        hooks: "extensive",
        euHosted: false,                          // RO + AWS US
        pricingTransparency: "tiered-credits",
        accent: "#7c4dff",
    },
    imagify: {
        slug: "imagify",
        name: "Imagify",
        site: "imagify.io",
        countingModel: "by file weight (MB), each thumbnail counted",
        avgThumbnailsPerUpload: 7,
        freeMonthlyImagesEffective: 28,           // 20 MB ÷ ~700 KB per upload
        freeMonthlyClaimed: "20 MB / month",
        paidEntryName: "Growth",
        paidEntryPriceEur: 5.99,
        paidEntryImagesEffective: 700,            // 500 MB ÷ ~700 KB
        avif: true,
        cdn: "yes",
        restore: true,
        resizeOnUpload: true,
        multisite: true,
        wpCli: false,
        hooks: "few",
        euHosted: true,
        pricingTransparency: "complex",
        accent: "#ff7050",
    },
    tinypng: {
        slug: "tinypng",
        name: "TinyPNG",
        site: "tinify.com",
        countingModel: "1 compression per thumbnail (PNG/JPEG only on free)",
        avgThumbnailsPerUpload: 7,
        freeMonthlyImagesEffective: 71,           // 500 compressions ÷ 7
        freeMonthlyClaimed: "500 compressions / month",
        paidEntryName: "Pay-as-you-go",
        paidEntryPriceEur: 9,                     // ~$9 for 1000 imgs (excess)
        paidEntryImagesEffective: 142,            // 1000 compressions ÷ 7
        avif: true,
        cdn: "no",
        restore: false,
        resizeOnUpload: true,
        multisite: true,
        wpCli: false,
        hooks: "few",
        euHosted: false,
        pricingTransparency: "complex",
        accent: "#ff5050",
    },
};

// Tempaloo pricing — kept inline so the calculator doesn't need an API call
// at render time. Values mirror the DB seed in db/migrations/003_plans_marketing.sql.
export const TEMPALOO = {
    name: "Tempaloo",
    accent: "#10b981",
    avif: true,
    cdn: "no" as const,             // honest — we don't have a CDN yet
    restore: true,
    resizeOnUpload: true,
    multisite: true,
    wpCli: true,
    hooks: "standard" as const,
    euHosted: true,
    pricingTransparency: "clear" as const,
    countingModel: "1 credit per upload — every thumbnail size included",
    avgThumbnailsPerUpload: 1,        // the whole point
    plans: [
        { code: "free",      name: "Free",      images: 250,    priceEur: 0 },
        { code: "starter",   name: "Starter",   images: 5000,   priceEur: 5 },
        { code: "growth",    name: "Growth",    images: 25000,  priceEur: 12 },
        { code: "business",  name: "Business",  images: 150000, priceEur: 29 },
        { code: "unlimited", name: "Unlimited", images: -1,     priceEur: 59 },
    ],
};

/**
 * Pick the cheapest Tempaloo plan that fits a given monthly upload count.
 */
export function tempalooPlanFor(monthlyImages: number): { name: string; priceEur: number } {
    for (const p of TEMPALOO.plans) {
        if (p.images === -1 || p.images >= monthlyImages) {
            return { name: p.name, priceEur: p.priceEur };
        }
    }
    return { name: "Unlimited", priceEur: 59 };
}

/**
 * Estimate the monthly cost on a competitor for N uploads, given they count
 * by thumbnail and we assume the typical 7 thumbnails per upload.
 */
export function competitorCostFor(c: Competitor, monthlyImages: number): { priceEur: number; planName: string; covered: boolean } {
    const thumbsPerMonth = monthlyImages * c.avgThumbnailsPerUpload;

    if (monthlyImages <= c.freeMonthlyImagesEffective) {
        return { priceEur: 0, planName: "Free", covered: true };
    }

    // Linear extrapolation from their entry tier — buying more credits
    // scales roughly proportionally on each vendor's bigger plans.
    const ratePerImageEur = c.paidEntryPriceEur / c.paidEntryImagesEffective;
    const priceEur = Math.max(c.paidEntryPriceEur, Math.ceil(monthlyImages * ratePerImageEur));

    return {
        priceEur,
        planName: c.paidEntryName,
        covered: monthlyImages <= c.paidEntryImagesEffective,
    };
}
