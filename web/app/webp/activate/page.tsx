import { Suspense } from "react";
import type { Metadata } from "next";
import { loadPlans } from "@/lib/plans";
import { ActivateClient } from "./ActivateClient";

// ISR on the same cadence as the landing page — a single source of truth.
export const revalidate = 300;

export const metadata: Metadata = {
    title: "Activate Tempaloo WebP — Get your license key",
    description:
        "Pick a plan and get your Tempaloo WebP license key. Free plan: 250 images / month, no credit card. Paid plans from €5/month with AVIF support.",
    openGraph: {
        title: "Activate Tempaloo WebP",
        description:
            "Pick a plan, get a license key, paste it in WordPress. 30 seconds to active conversion.",
        url: "https://tempaloo.com/webp/activate",
        type: "website",
    },
    alternates: { canonical: "https://tempaloo.com/webp/activate" },
};

export default async function ActivatePage() {
    const plans = await loadPlans();
    return (
        <Suspense fallback={<main style={{ padding: "96px 24px", textAlign: "center", color: "var(--ink-3)" }}>Loading…</main>}>
            <ActivateClient plans={plans} />
        </Suspense>
    );
}
