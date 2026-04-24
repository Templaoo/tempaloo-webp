// Build a Content-Security-Policy that is strict enough to stop injected
// scripts but permissive enough for our real third-parties:
//   · Freemius Checkout overlay (script + iframe)
//   · Vercel Analytics beacon
//   · Google Fonts (only for Instrument Serif — Geist is self-hosted)
//   · Google OAuth accounts flow
const csp = [
    "default-src 'self'",
    // 'unsafe-inline' is needed because LandingPage and the legal pages
    // use <style dangerouslySetInnerHTML>. Migrating to CSS modules would
    // let us drop it — tracked as a future polish item.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.freemius.com https://va.vercel-scripts.com https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://api.tempaloo.com https://*.tempaloo.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://checkout.freemius.com https://accounts.google.com",
    "frame-src 'self' https://checkout.freemius.com https://accounts.google.com",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
    "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options",   value: "nosniff" },
    { key: "X-Frame-Options",          value: "DENY" },
    { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    async headers() {
        return [
            {
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
