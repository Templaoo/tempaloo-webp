import { LandingPage } from "@/components/webp/LandingPage";
import { loadPlans } from "@/lib/plans";
import { PostAuthRedirector } from "@/components/PostAuthRedirector";

export const metadata = {
    title: "Tempaloo WebP — Drop-in WebP & AVIF for WordPress",
    description:
        "One credit per image, every thumbnail size included. No visit counting, no surprise bills.",
    openGraph: {
        title: "Tempaloo WebP — Drop-in WebP & AVIF for WordPress",
        description:
            "One credit per image, every thumbnail size bundled. WebP and AVIF for any WordPress site, no setup.",
        url: "https://tempaloo.com/webp",
        type: "website",
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "https://tempaloo.com/webp" },
};

// ISR: plans change a few times a year, not per request.
export const revalidate = 300;

/**
 * SoftwareApplication structured data for the plugin landing.
 * Surfaces the plugin name, category, supported OS / engine, and
 * pricing range to search engines as a rich result. Pricing is
 * computed from the live plans data so it never drifts. We omit
 * aggregateRating until the WordPress.org listing accumulates real
 * reviews — fake review data triggers Google penalties.
 */
function buildSoftwareApplicationLd(plans: Awaited<ReturnType<typeof loadPlans>>) {
    const paid = plans.filter((p) => p.code !== "free" && p.priceMonthly > 0);
    const minPrice = paid.length > 0 ? Math.min(...paid.map((p) => p.priceMonthly)) : 0;
    const maxPrice = paid.length > 0 ? Math.max(...paid.map((p) => p.priceMonthly)) : 0;

    return {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "Tempaloo WebP",
        applicationCategory: "WebApplication",
        applicationSubCategory: "WordPress Plugin",
        operatingSystem: "WordPress 6.0+, PHP 7.4+",
        description:
            "Convert WordPress images to WebP and AVIF automatically. One credit per image, every thumbnail size bundled. Async upload pipeline, per-image restore, Diagnostic tab, cache compatibility.",
        url: "https://tempaloo.com/webp",
        downloadUrl: "https://wordpress.org/plugins/tempaloo-webp/",
        softwareVersion: "1.0.0",
        author: { "@type": "Organization", name: "Tempaloo", url: "https://tempaloo.com" },
        publisher: { "@type": "Organization", name: "Tempaloo", url: "https://tempaloo.com" },
        offers: paid.length > 0
            ? {
                "@type": "AggregateOffer",
                priceCurrency: "EUR",
                lowPrice: minPrice.toFixed(2),
                highPrice: maxPrice.toFixed(2),
                offerCount: paid.length,
                availability: "https://schema.org/InStock",
            }
            : {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
            },
        featureList: [
            "WebP and AVIF conversion",
            "Async upload pipeline",
            "Per-image restore",
            "Bulk row-actions",
            "Diagnostic & repair tab",
            "WP-CLI commands",
            "Developer hooks",
            "LiteSpeed / WP Rocket / W3TC compatibility",
        ],
    };
}

export default async function WebPLanding() {
    const plans = await loadPlans();
    const ld = buildSoftwareApplicationLd(plans);
    return (
        <>
            <script
                type="application/ld+json"
                // Schema.org payload built from typed plans data —
                // no XSS surface, not user-rendered.
                dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
            />
            <PostAuthRedirector />
            <LandingPage plans={plans} />
        </>
    );
}
