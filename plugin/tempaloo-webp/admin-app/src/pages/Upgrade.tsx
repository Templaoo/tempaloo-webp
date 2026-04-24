import { useEffect, useState } from "react";
import clsx from "clsx";
import { FREEMIUS, fetchPlans, type AppState, type PaidPlanCode, type Plan } from "../api";
import { Badge, Button, Card, CardHeader, Progress, toast } from "../components/ui";

type Billing = "monthly" | "annual";

/**
 * Upgrade tab — pricing card grid. Plans are now fetched from GET /v1/plans
 * (the public plans feed), so copy and prices can't drift from the DB /
 * landing page. The fallback skeleton shows while the feed loads; if it fails
 * we surface a toast so the user isn't stuck staring at a blank grid.
 */
export default function Upgrade({ state }: { state: AppState }) {
    const [billing, setBilling] = useState<Billing>("annual");
    const [opening, setOpening] = useState<PaidPlanCode | null>(null);
    const [plans, setPlans] = useState<Plan[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        fetchPlans()
            .then((all) => { if (alive) setPlans(all); })
            .catch((e: unknown) => {
                if (!alive) return;
                const msg = e instanceof Error ? e.message : "Could not load plans";
                setLoadError(msg);
                toast("error", msg);
            });
        return () => { alive = false; };
    }, []);

    const paidPlans = (plans ?? []).filter((p): p is Plan & { freemiusPlanId: number } =>
        p.code !== "free" && p.freemiusPlanId !== null);

    const usagePct = computeUsagePct(state);
    const daysToReset = daysUntilMonthReset();
    const currentCode = state.license.valid ? state.license.plan : "free";

    const openCheckout = async (p: Plan & { freemiusPlanId: number }) => {
        setOpening(p.code as PaidPlanCode);
        try {
            const mod = await import("@freemius/checkout");
            const Ctor = mod.Checkout as unknown as new (o: unknown) => { open(): void };

            const options = {
                product_id: FREEMIUS.productId,
                public_key: FREEMIUS.publicKey,
                plan_id: p.freemiusPlanId,
                // maxSites: -1 (unlimited) → 0 tells Freemius "site-less license".
                licenses: p.maxSites === -1 ? 0 : p.maxSites,
                currency: "eur",
                billing_cycle: billing,
                trial: "paid",
                ...(state.license.key ? { license_key: state.license.key } : {}),
                success() {
                    toast("success", "Purchase complete — refreshing your license…");
                    setTimeout(() => window.location.reload(), 800);
                },
                cancel() {
                    // no-op
                },
            };

            const checkout = new Ctor(options);
            checkout.open();
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Could not open checkout");
        } finally {
            setOpening(null);
        }
    };

    return (
        <div className="grid gap-6">
            {/* Usage context */}
            <Card>
                <CardHeader
                    title={
                        currentCode === "free"
                            ? "You're on the Free plan"
                            : `You're on ${capitalize(currentCode)}`
                    }
                    description={
                        currentCode === "free"
                            ? "Unlock AVIF, higher quotas, and multi-site licenses."
                            : "Scale up to more images, sites, or features whenever you're ready."
                    }
                    right={<Badge variant="brand">{capitalize(currentCode)}</Badge>}
                />

                {state.license.valid && state.quota && state.license.imagesLimit !== -1 && (
                    <div className="space-y-2">
                        <Progress
                            value={usagePct}
                            label={`${state.quota.imagesUsed.toLocaleString()} / ${state.license.imagesLimit.toLocaleString()} images · resets in ${daysToReset}d`}
                        />
                        {usagePct >= 80 && (
                            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-sm text-amber-800">
                                ⚡ You've used {usagePct}% of this month's quota. Upgrade to avoid interruptions.
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Billing toggle */}
            <div className="flex items-center justify-center">
                <div className="inline-flex rounded-full bg-ink-100 p-1">
                    <ToggleBtn active={billing === "monthly"} onClick={() => setBilling("monthly")}>Monthly</ToggleBtn>
                    <ToggleBtn active={billing === "annual"} onClick={() => setBilling("annual")}>
                        Annual <span className="ml-1 text-[10px] font-semibold text-emerald-600">−20%</span>
                    </ToggleBtn>
                </div>
            </div>

            {/* Tier grid */}
            {plans === null && !loadError ? (
                <TierSkeleton />
            ) : loadError ? (
                <div className="text-center text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                    Couldn't load plans: {loadError}. <button onClick={() => window.location.reload()} className="underline">Reload</button>.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {paidPlans.map((p) => {
                        const priceMonthly = p.priceMonthlyCents / 100;
                        const priceAnnualPerMonth = p.priceAnnualCents / 12 / 100;
                        const price = billing === "annual" ? priceAnnualPerMonth : priceMonthly;
                        const isCurrent = currentCode === p.code;
                        return (
                            <div
                                key={p.code}
                                className={clsx(
                                    "rounded-xl border p-5 flex flex-col",
                                    p.badge ? "border-brand-500 ring-2 ring-brand-100 relative" : "border-ink-200",
                                    isCurrent && "bg-ink-50",
                                )}
                            >
                                {p.badge && (
                                    <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                                        {p.badge}
                                    </span>
                                )}
                                <div className="flex items-baseline justify-between">
                                    <h3 className="text-base font-semibold text-ink-900">{p.name}</h3>
                                    {isCurrent && <Badge variant="success">Current</Badge>}
                                </div>
                                <p className="mt-1 text-xs text-ink-500">{p.tagline}</p>
                                <div className="mt-4">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-ink-900">€{price % 1 === 0 ? price : price.toFixed(2)}</span>
                                        <span className="text-xs text-ink-500">/mo</span>
                                    </div>
                                    <div className="text-[11px] text-ink-500">
                                        {billing === "annual" ? `€${(p.priceAnnualCents / 100).toFixed(0)} billed yearly` : "billed monthly"}
                                    </div>
                                </div>
                                <div className="mt-3 text-sm font-medium text-ink-900">{formatImages(p)}</div>
                                <div className="text-xs text-ink-500">{formatSites(p)}</div>
                                <ul className="mt-3 space-y-1.5 text-xs text-ink-700 flex-1">
                                    {p.bullets.map((b) => (
                                        <li key={b} className="flex items-start gap-1.5">
                                            <span className="mt-1 h-1 w-1 rounded-full bg-brand-500" /> {b}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    onClick={() => openCheckout(p)}
                                    loading={opening === p.code}
                                    variant={p.badge ? "primary" : "secondary"}
                                    className="mt-4 w-full"
                                    disabled={isCurrent}
                                >
                                    {isCurrent ? "Current plan" : "Try 7 days free →"}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs">
                <TrustChip icon="🛡" text="30-day money-back guarantee" />
                <TrustChip icon="⏱" text="7-day free trial on every plan" />
                <TrustChip icon="✕" text="Cancel anytime — one click" />
            </div>

            <p className="text-center text-[11px] text-ink-500">
                Payments securely handled by Freemius · Instant upgrade, no manual migration · Your original images stay untouched.
            </p>
        </div>
    );
}

function formatImages(p: Plan): string {
    if (p.imagesPerMonth === -1) {
        return p.fairUseCap ? `Unlimited (fair use ${(p.fairUseCap / 1000).toFixed(0)}k)` : "Unlimited";
    }
    return `${p.imagesPerMonth.toLocaleString()} / month`;
}

function formatSites(p: Plan): string {
    if (p.maxSites === -1) return "Unlimited sites";
    return p.maxSites === 1 ? "1 site" : `${p.maxSites} sites`;
}

function TierSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-ink-200 p-5 h-[360px] bg-ink-50/50 animate-pulse" />
            ))}
        </div>
    );
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={clsx(
                "h-8 px-4 rounded-full text-xs font-medium transition",
                active ? "bg-white shadow text-ink-900" : "text-ink-500 hover:text-ink-900",
            )}
        >
            {children}
        </button>
    );
}

function TrustChip({ icon, text }: { icon: string; text: string }) {
    return (
        <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 flex items-center justify-center gap-2">
            <span className="text-base" aria-hidden>{icon}</span>
            <span className="text-ink-700 font-medium">{text}</span>
        </div>
    );
}

function computeUsagePct(state: AppState): number {
    if (!state.quota || state.license.imagesLimit === -1 || state.license.imagesLimit === 0) return 0;
    return Math.min(100, Math.round((state.quota.imagesUsed / state.license.imagesLimit) * 100));
}

function daysUntilMonthReset(): number {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function capitalize(s: string): string {
    return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
