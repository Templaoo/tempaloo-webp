"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PLANS, findPlan } from "@/lib/plans";
import type { Billing } from "@/components/pricing/BillingToggle";
import { ActivateModal } from "@/components/pricing/ActivateModal";
import { PricingRefined } from "@/components/activate/PricingRefined";
import { openFreemiusCheckout } from "@/lib/freemius-checkout";

type PlanCode = typeof PLANS[number]["code"];

export default function ActivatePage() {
    return (
        <Suspense fallback={<main className="mx-auto max-w-5xl px-6 py-24 text-center text-white/60">Loading…</main>}>
            <ActivateInner />
        </Suspense>
    );
}

function ActivateInner() {
    const params = useSearchParams();
    const initialPlan = (params.get("plan") as PlanCode | null) ?? "growth";
    const initialBilling = (params.get("billing") as Billing | null) ?? "annual";

    const [billing, setBilling] = useState<Billing>(initialBilling);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalPlan, setModalPlan] = useState<PlanCode | null>(null);
    const [banner, setBanner] = useState<string | null>(null);
    const [authedEmail, setAuthedEmail] = useState<string | null>(null);
    const checkoutTriggered = useRef(false);

    const openModal = (code: PlanCode) => {
        setModalPlan(code);
        setModalOpen(true);
    };

    const activePlan = useMemo(() => (modalPlan ? findPlan(modalPlan) ?? null : null), [modalPlan]);

    // Best-effort session lookup so the header can swap "Sign in" → "Dashboard".
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json();
                if (!cancelled && data?.user?.email) setAuthedEmail(data.user.email);
            } catch { /* non-blocking */ }
        })();
        return () => { cancelled = true; };
    }, []);

    // Auto-open Freemius Checkout after returning from Google (?checkout=1).
    useEffect(() => {
        if (checkoutTriggered.current) return;
        const wantCheckout = params.get("checkout") === "1";
        if (!wantCheckout) return;

        const planCode = (params.get("plan") as PlanCode | null) ?? "growth";
        const billingCycle = (params.get("billing") as Billing | null) ?? "annual";
        const plan = findPlan(planCode);
        if (!plan || plan.priceMonthly === 0) return;

        checkoutTriggered.current = true;

        (async () => {
            let email: string | undefined;
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json();
                if (data?.user?.email) email = data.user.email;
            } catch { /* non-blocking */ }

            setBanner(email ? `Opening secure checkout for ${email}…` : "Opening secure checkout…");
            try {
                await openFreemiusCheckout({ plan, billing: billingCycle, email });
            } catch (e) {
                setBanner(null);
                alert(e instanceof Error ? e.message : "Could not open checkout");
            }

            const clean = new URL(window.location.href);
            clean.searchParams.delete("checkout");
            clean.searchParams.delete("neon_auth_session_verifier");
            window.history.replaceState({}, "", clean.toString());
        })();
    }, [params]);

    return (
        <>
            {banner && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] rounded-full glass-strong px-5 py-2.5 text-sm text-white shadow-pop flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {banner}
                </div>
            )}

            <PricingRefined
                billing={billing}
                onBillingChange={setBilling}
                onChoose={openModal}
                authedEmail={authedEmail}
            />

            <ActivateModal
                plan={activePlan}
                billing={billing}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}
