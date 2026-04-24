"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { findPlan, type Plan } from "@/lib/plans";
import type { Billing } from "@/components/pricing/BillingToggle";
import { ActivateModal } from "@/components/pricing/ActivateModal";
import { ActivatePricing } from "@/components/activate/ActivatePricing";
import { openFreemiusCheckout } from "@/lib/freemius-checkout";
import { trackActivateOpen, type TrackPlan } from "@/lib/track";

type PlanCode = Plan["code"];

export function ActivateClient({ plans }: { plans: Plan[] }) {
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

    const activePlan = useMemo(() => (modalPlan ? findPlan(plans, modalPlan) ?? null : null), [modalPlan, plans]);

    useEffect(() => {
        trackActivateOpen(initialPlan as TrackPlan, initialBilling);
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json();
                if (!cancelled && data?.user?.email) setAuthedEmail(data.user.email);
            } catch { /* non-blocking */ }
        })();
        return () => { cancelled = true; };
    }, [initialPlan, initialBilling]);

    useEffect(() => {
        if (checkoutTriggered.current) return;
        const wantCheckout = params.get("checkout") === "1";
        if (!wantCheckout) return;

        const planCode = (params.get("plan") as PlanCode | null) ?? "growth";
        const billingCycle = (params.get("billing") as Billing | null) ?? "annual";
        const plan = findPlan(plans, planCode);
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
    }, [params, plans]);

    return (
        <>
            {banner && (
                <div
                    style={{
                        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 100,
                        padding: "8px 18px", borderRadius: 999,
                        background: "var(--ink)", color: "var(--bg)",
                        fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8,
                        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)",
                    }}
                >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
                    {banner}
                </div>
            )}

            <ActivatePricing
                plans={plans}
                billing={billing}
                onBillingChange={setBilling}
                onChoose={openModal}
                initialPlan={initialPlan}
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
