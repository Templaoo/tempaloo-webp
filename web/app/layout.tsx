import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

// Geist is self-hosted via Vercel's `geist` package (preloaded, zero CLS).
// Instrument Serif still comes from Google Fonts — small display-only font,
// negligible perf impact.
const instrumentSerif = Instrument_Serif({
    subsets: ["latin"],
    weight: "400",
    style: "italic",
    display: "swap",
    variable: "--font-serif",
});

export const metadata: Metadata = {
    title: "Tempaloo — WordPress plugins & tools",
    description: "Faster WordPress sites. Modern tools for creators.",
    icons: {
        icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
        apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    },
    openGraph: {
        title: "Tempaloo — WordPress plugins & tools",
        description: "Faster WordPress sites. Modern tools for creators.",
        images: [{ url: "/og-image.png", width: 1200, height: 1200 }],
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        images: ["/og-image.png"],
    },
};

// `viewport-fit=cover` makes the sticky CTA/safe-area-inset math correct on
// iPhones with a home indicator.
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            data-theme="dark"
            className={`${GeistSans.variable} ${GeistMono.variable} ${instrumentSerif.variable}`}
        >
            <body>
                {children}
                <Analytics />
            </body>
        </html>
    );
}
