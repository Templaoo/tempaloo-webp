import type { ReactNode } from "react";

/**
 * Top-level admin layout — intentionally bare.
 *
 * Auth + chrome (sidebar, top bar, /me fetch) live in the nested
 * (authed)/layout.tsx so the /admin/login page does NOT inherit any
 * code that depends on a session cookie. Without this split, a stale
 * rejected cookie would render the "Session expired" panel even on
 * the login page itself, with a Sign-in button that loops back here.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata = {
    title: "Admin — Tempaloo",
    robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
    return (
        <main style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100vh" }}>
            {children}
        </main>
    );
}
