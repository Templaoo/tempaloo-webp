"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PLANS, findPlan } from "@/lib/plans";
import { BillingToggle, type Billing } from "@/components/pricing/BillingToggle";
import { PricingCard } from "@/components/pricing/PricingCard";
import { FAQ } from "@/components/pricing/FAQ";
import { TrustRow } from "@/components/pricing/TrustRow";
import { CreditComparison } from "@/components/pricing/CreditComparison";
import { ActivateModal } from "@/components/pricing/ActivateModal";

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

    const [billing, setBilling] = useState<Billing>("annual");
    const [selected, setSelected] = useState<PlanCode>(initialPlan);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalPlan, setModalPlan] = useState<PlanCode | null>(null);

    const openModal = (code: PlanCode) => {
        setSelected(code);
        setModalPlan(code);
        setModalOpen(true);
    };

    const activePlan = useMemo(() => (modalPlan ? findPlan(modalPlan) ?? null : null), [modalPlan]);

    return (
        <main className="mx-auto max-w-6xl px-6 py-12 md:py-20 space-y-16">
            <Header />

            {/* Hero */}
            <section className="text-center rise">
                <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-white/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Trusted by WordPress creators worldwide
                </span>
                <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
                    <span className="text-white">Lighter images.</span>
                    <br />
                    <span className="text-gradient">Pick your plan.</span>
                </h1>
                <p className="mt-5 text-lg text-white/70 max-w-xl mx-auto">
                    1 credit per image — all thumbnail sizes included. No visit counting. No surprise bills.
                </p>

                <div className="mt-8 flex justify-center rise rise-delay-1">
                    <BillingToggle value={billing} onChange={setBilling} />
                </div>
            </section>

            {/* Pricing grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 rise rise-delay-2">
                {PLANS.map((p) => (
                    <PricingCard
                        key={p.code}
                        plan={p}
                        billing={billing}
                        selected={selected === p.code}
                        onChoose={() => openModal(p.code)}
                    />
                ))}
            </section>

            {/* Trust row */}
            <section className="rise rise-delay-3">
                <TrustRow />
            </section>

            {/* Killer differentiator */}
            <section className="rise rise-delay-3">
                <CreditComparison />
            </section>

            {/* FAQ */}
            <section className="space-y-6 rise rise-delay-4">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white text-center">Frequently asked</h2>
                <FAQ />
            </section>

            <footer className="text-center text-xs text-white/40 py-10">
                © {new Date().getFullYear()} Tempaloo. Made with care for WordPress creators.
            </footer>

            <ActivateModal
                plan={activePlan}
                billing={billing}
                open={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </main>
    );
}

function Header() {
    return (
        <div className="flex items-center justify-between">
            <Link href="/webp" className="flex items-center gap-2.5 group">
                <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                    T
                </span>
                <span className="text-sm font-semibold text-white/90 group-hover:text-white">Tempaloo WebP</span>
            </Link>
            <Link href="/webp" className="text-sm text-white/60 hover:text-white">
                ← Back to overview
            </Link>
        </div>
    );
}
