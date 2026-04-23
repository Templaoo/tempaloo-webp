"use client";
import clsx from "clsx";
import type { Plan } from "@/lib/plans";
import type { Billing } from "./BillingToggle";

export function PricingCard({
    plan,
    billing,
    selected,
    onChoose,
}: {
    plan: Plan;
    billing: Billing;
    selected: boolean;
    /** Fired when the user wants to start onboarding for this plan. */
    onChoose: () => void;
}) {
    const priceNum =
        plan.priceMonthly === 0
            ? 0
            : billing === "annual"
                ? plan.priceAnnual / 12
                : plan.priceMonthly;
    const rightSub =
        plan.priceMonthly === 0
            ? "forever"
            : billing === "annual"
                ? `€${plan.priceAnnual} billed yearly`
                : "billed monthly";

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onChoose}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChoose(); } }}
            className={clsx(
                "group relative text-left rounded-2xl p-6 transition overflow-hidden cursor-pointer",
                plan.highlight
                    ? "glass-strong ring-1 ring-brand-400/50"
                    : "glass hover:border-white/20",
                selected && "ring-2 ring-brand-400 shadow-pop",
            )}
        >
            {plan.badge && (
                <span className="absolute top-4 right-4 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                    {plan.badge}
                </span>
            )}

            <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
            </div>
            <p className="mt-1 text-xs text-white/60">{plan.tagline}</p>

            <div className="mt-5 flex items-baseline gap-1.5">
                {plan.priceMonthly === 0 ? (
                    <span className="text-4xl font-bold text-white tracking-tight">Free</span>
                ) : (
                    <>
                        <span className="text-4xl font-bold text-white tracking-tight">{formatPrice(priceNum)}</span>
                        <span className="text-sm text-white/60">/ mo</span>
                    </>
                )}
            </div>
            <p className="mt-0.5 text-xs text-white/50">{rightSub}</p>

            <div className="mt-5 text-sm font-medium text-white">{plan.imagesLabel}</div>
            <div className="text-xs text-white/60">{plan.sites}</div>

            <ul className="mt-5 space-y-2">
                {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                        <CheckIcon />
                        <span>{f}</span>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChoose(); }}
                className={clsx(
                    "mt-6 inline-flex items-center justify-center w-full h-10 rounded-lg text-sm font-semibold transition",
                    plan.highlight
                        ? "bg-gradient-to-r from-brand-500 to-purple-500 text-white glow"
                        : "bg-white/10 text-white hover:bg-white/20",
                )}
            >
                {plan.cta} <span className="ml-1">→</span>
            </button>
        </div>
    );
}

function formatPrice(n: number): string {
    const rounded = Math.round(n * 100) / 100;
    return `€${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2)}`;
}

function CheckIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="rgba(99, 102, 241, 0.15)" />
            <path d="M8 12.5l3 3 5-6" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
