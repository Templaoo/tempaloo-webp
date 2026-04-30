import type { MetadataRoute } from "next";

const SITE_URL = "https://tempaloo.com";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                // Admin surface + API endpoints don't belong in any crawler's
                // index. The middleware already gates them at the edge, but
                // robots.txt + per-page noindex is the belt-and-suspenders
                // discoverability story.
                disallow: ["/admin", "/api/"],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
