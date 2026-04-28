import { Suspense } from "react";
import { LogoutClient } from "./LogoutClient";

export const metadata = {
    title: "Signing out — Tempaloo",
    robots: { index: false, follow: false },
};

export default function LogoutPage() {
    return (
        <Suspense fallback={<main style={{ padding: "96px 24px", textAlign: "center", color: "var(--ink-3)" }}>Loading…</main>}>
            <LogoutClient />
        </Suspense>
    );
}
