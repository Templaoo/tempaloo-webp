import { useState } from "react";
import clsx from "clsx";
import { FREEMIUS, type AppState, type PaidPlanCode } from "../api";
import { Badge, Button, Card, CardHeader, Progress, toast } from "../components/ui";

type Billing = "monthly" | "annual";

interface TierDef {
    code: PaidPlanCode;
    name: string;
    tagline: string;
    images: string;
    sites: string;
    bullets: string[];
    badge?: string;
}

const TIERS: TierDef[] = [
    {
        code: "starter",
        name: "Starter",
        tagline: "Single blog or portfolio",
        images: "5 000 / month",
        sites: "1 site",
        bullets: ["WebP + AVIF", "Unlimited bulk", "Credit rollover 30 days", "Email support (48h)"],
    },
    {
        code: "growth",
        name: "Growth",
        tagline: "Small agency, a few sites",
        images: "25 000 / month",
        sites: "5 sites",
        bullets: ["Everything in Starter", "5 sites / license", "Priority queue", "Email support (24h)"],
        badge: "Most popular",
    },
    {
        code: "business",
        name: "Business",
        tagline: "Agency running many sites",
        images: "150 000 / month",
        sites: "Unlimited sites",
        bullets: ["Everything in Growth", "Unlimited sites", "Direct API access", "Chat support"],
    },
    {
        code: "unlimited",
        name: "Unlimited",
        tagline: "Hosts, platforms, scale",
        images: "Unlimited",
        sites: "Unlimited",
        bullets: ["Everything in Business", "Priority SLA", "Dedicated onboarding", "White-label (soon)"],
    },
];

export default function Upgrade({ state }: { state: AppState }) {
    const [billing, setBilling] = useState<Billing>("annual");
    const [opening, setOpening] = useState<PaidPlanCode | null>(null);

    const usagePct = computeUsagePct(state);
    const daysToReset = daysUntilMonthReset();
    const currentCode = state.license.valid ? state.license.plan : "free";

    const openCheckout = async (code: PaidPlanCode) => {
        setOpening(code);
        try {
            const mod = await import("@freemius/checkout");
            const Ctor = mod.Checkout as unknown as new (o: unknown) => { open(): void };
            const planCfg = FREEMIUS.plans[code];

            const options = {
                product_id: FREEMIUS.productId,
                public_key: FREEMIUS.publicKey,
                plan_id: planCfg.id,
                licenses: planCfg.licenses,
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {TIERS.map((t) => {
                    const cfg = FREEMIUS.plans[t.code];
                    const price = billing === "annual" ? cfg.annual / 12 : cfg.monthly;
                    const isCurrent = currentCode === t.code;
                    return (
                        <div
                            key={t.code}
                            className={clsx(
                                "rounded-xl border p-5 flex flex-col",
                                t.badge ? "border-brand-500 ring-2 ring-brand-100 relative" : "border-ink-200",
                                isCurrent && "bg-ink-50",
                            )}
                        >
                            {t.badge && (
                                <span className="absolute -top-2.5 left-4 rounded-full bg-gradient-to-r from-brand-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                                    {t.badge}
                                </span>
                            )}
                            <div className="flex items-baseline justify-between">
                                <h3 className="text-base font-semibold text-ink-900">{t.name}</h3>
                                {isCurrent && <Badge variant="success">Current</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-ink-500">{t.tagline}</p>
                            <div className="mt-4">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-ink-900">€{price % 1 === 0 ? price : price.toFixed(2)}</span>
                                    <span className="text-xs text-ink-500">/mo</span>
                                </div>
                                <div className="text-[11px] text-ink-500">
                                    {billing === "annual" ? `€${cfg.annual} billed yearly` : "billed monthly"}
                                </div>
                            </div>
                            <div className="mt-3 text-sm font-medium text-ink-900">{t.images}</div>
                            <div className="text-xs text-ink-500">{t.sites}</div>
                            <ul className="mt-3 space-y-1.5 text-xs text-ink-700 flex-1">
                                {t.bullets.map((b) => (
                                    <li key={b} className="flex items-start gap-1.5">
                                        <span className="mt-1 h-1 w-1 rounded-full bg-brand-500" /> {b}
                                    </li>
                                ))}
                            </ul>
                            <Button
                                onClick={() => openCheckout(t.code)}
                                loading={opening === t.code}
                                variant={t.badge ? "primary" : "secondary"}
                                className="mt-4 w-full"
                                disabled={isCurrent}
                            >
                                {isCurrent ? "Current plan" : "Try 7 days free →"}
                            </Button>
                        </div>
                    );
                })}
            </div>

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
