import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Tempaloo — WordPress plugins & tools",
    description: "Faster WordPress sites. Modern tools for creators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen antialiased selection:bg-indigo-500/30">
                <div className="ambient" aria-hidden />
                <div className="relative z-10">{children}</div>
            </body>
        </html>
    );
}
