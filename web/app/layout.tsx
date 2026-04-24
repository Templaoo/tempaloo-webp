import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Tempaloo — WordPress plugins & tools",
    description: "Faster WordPress sites. Modern tools for creators.",
    icons: {
        icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" data-theme="dark">
            <body>{children}</body>
        </html>
    );
}
