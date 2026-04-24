import { Suspense } from "react";
import { loadPlans } from "@/lib/plans";
import { ActivateClient } from "./ActivateClient";

// ISR on the same cadence as the landing page — a single source of truth.
export const revalidate = 300;

export default async function ActivatePage() {
    const plans = await loadPlans();
    return (
        <Suspense fallback={<main style={{ padding: "96px 24px", textAlign: "center", color: "var(--ink-3)" }}>Loading…</main>}>
            <ActivateClient plans={plans} />
        </Suspense>
    );
}
