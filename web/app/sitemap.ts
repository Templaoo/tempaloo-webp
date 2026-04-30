import type { MetadataRoute } from "next";

const SITE_URL = "https://tempaloo.com";

/**
 * Static sitemap — every public, indexable page. Update this when a
 * new top-level route ships. Search engines re-fetch the sitemap on
 * their own cadence, so just keeping it in sync is enough.
 *
 * Admin / dashboard / API routes are intentionally omitted — they're
 * either authenticated (can't crawl) or already noindex'd.
 */
export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    return [
        // Top-level landing
        { url: `${SITE_URL}/`,                lastModified: now, changeFrequency: "weekly",  priority: 1.0 },

        // Plugin landing + conversion funnel
        { url: `${SITE_URL}/webp`,            lastModified: now, changeFrequency: "weekly",  priority: 0.95 },
        { url: `${SITE_URL}/webp/activate`,   lastModified: now, changeFrequency: "monthly", priority: 0.9 },

        // Comparison pages — high SEO value (long-tail "X vs Y" queries)
        { url: `${SITE_URL}/webp/vs-imagify`,    lastModified: now, changeFrequency: "monthly", priority: 0.8 },
        { url: `${SITE_URL}/webp/vs-shortpixel`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
        { url: `${SITE_URL}/webp/vs-tinypng`,    lastModified: now, changeFrequency: "monthly", priority: 0.8 },

        // Documentation
        { url: `${SITE_URL}/docs`,            lastModified: now, changeFrequency: "weekly",  priority: 0.85 },
        { url: `${SITE_URL}/docs/features`,   lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
        { url: `${SITE_URL}/docs/cli`,        lastModified: now, changeFrequency: "monthly", priority: 0.6 },
        { url: `${SITE_URL}/docs/hooks`,      lastModified: now, changeFrequency: "monthly", priority: 0.6 },

        // Trust + reachability
        { url: `${SITE_URL}/about`,           lastModified: now, changeFrequency: "monthly", priority: 0.6 },
        { url: `${SITE_URL}/changelog`,       lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
        { url: `${SITE_URL}/contact`,         lastModified: now, changeFrequency: "monthly", priority: 0.7 },
        { url: `${SITE_URL}/privacy`,         lastModified: now, changeFrequency: "yearly",  priority: 0.4 },
        { url: `${SITE_URL}/terms`,           lastModified: now, changeFrequency: "yearly",  priority: 0.4 },
    ];
}
