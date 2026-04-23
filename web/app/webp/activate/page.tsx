"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { PLANS, findPlan } from "@/lib/plans";
import { BillingToggle, type Billing } from "@/components/pricing/BillingToggle";
import { PricingCard } from "@/components/pricing/PricingCard";
import { FAQ } from "@/components/pricing/FAQ";
import { TrustRow } from "@/components/pricing/TrustRow";

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
    const siteParam = params.get("site") ?? "";
    const returnParam = params.get("return") ?? "";

    const [plan, setPlan] = useState<PlanCode>(initialPlan);
    const [billing, setBilling] = useState<Billing>("annual");
    const [email, setEmail] = useState("");
    const [site, setSite] = useState(siteParam);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ key: string; plan: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selectedPlan = useMemo(() => findPlan(plan) ?? PLANS[0]!, [plan]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (plan !== "free") {
            setError("Paid plans will be available when Freemius checkout is wired up. Start Free for now, or contact us.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, site_url: site, plan }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message ?? "Could not generate a license");
            setResult({ key: data.license_key, plan: data.plan });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    // Key delivered — celebration screen.
    if (result) {
        return <LicenseSuccess licenseKey={result.key} plan={result.plan} returnUrl={returnParam} email={email} />;
    }

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
                        selected={plan === p.code}
                        onSelect={() => setPlan(p.code)}
                    />
                ))}
            </section>

            {/* Trust row */}
            <section className="rise rise-delay-3">
                <TrustRow />
            </section>

            {/* Checkout / Activate panel */}
            <section className="grid md:grid-cols-5 gap-6 items-start rise rise-delay-4">
                <aside className="md:col-span-2 glass-strong rounded-2xl p-6">
                    <div className="text-xs uppercase tracking-wider text-white/50">Your selection</div>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-semibold text-white">{selectedPlan.name}</span>
                        <span className="text-sm text-white/60">— {selectedPlan.imagesLabel}</span>
                    </div>
                    <div className="mt-2 text-white/70 text-sm">{selectedPlan.tagline}</div>
                    <hr className="my-5 border-white/10" />
                    <div className="flex justify-between items-baseline">
                        <span className="text-sm text-white/60">Billed {billing}</span>
                        <span className="text-white text-lg font-semibold">
                            {selectedPlan.priceMonthly === 0
                                ? "Free"
                                : billing === "annual"
                                    ? `€${selectedPlan.priceAnnual}/yr`
                                    : `€${selectedPlan.priceMonthly}/mo`}
                        </span>
                    </div>
                    {billing === "annual" && selectedPlan.priceMonthly > 0 && (
                        <div className="mt-1 text-xs text-emerald-300">
                            You save €{(selectedPlan.priceMonthly * 12 - selectedPlan.priceAnnual).toFixed(0)} / year
                        </div>
                    )}
                    <ul className="mt-5 space-y-2 text-sm text-white/80">
                        {selectedPlan.features.slice(0, 4).map((f) => (
                            <li key={f} className="flex items-start gap-2">
                                <span className="mt-1 h-1 w-1 rounded-full bg-brand-400" />
                                <span>{f}</span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <div className="md:col-span-3 glass-strong rounded-2xl p-6">
                    <h2 className="text-xl font-semibold text-white">Get your key</h2>
                    <p className="mt-1 text-sm text-white/70">
                        {plan === "free"
                            ? "Instant. No credit card."
                            : "Paid plans: sign in, we'll redirect you to secure checkout."}
                    </p>

                    <div className="mt-5 space-y-3">
                        <GoogleSignInButton plan={plan} />

                        <DividerOr />

                        <form onSubmit={submit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field label="Email">
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        className="input"
                                    />
                                </Field>
                                <Field label="WordPress site URL">
                                    <input
                                        type="url"
                                        required
                                        value={site}
                                        onChange={(e) => setSite(e.target.value)}
                                        placeholder="https://yoursite.com"
                                        className="input"
                                    />
                                </Field>
                            </div>

                            {error && (
                                <p role="alert" className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm text-rose-200">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={clsx(
                                    "w-full h-12 rounded-xl text-sm font-semibold transition",
                                    plan === "free"
                                        ? "bg-gradient-to-r from-brand-500 to-purple-500 text-white glow"
                                        : "bg-white/10 text-white/80 hover:bg-white/15",
                                    loading && "opacity-60 cursor-not-allowed",
                                )}
                            >
                                {loading
                                    ? "Generating…"
                                    : plan === "free"
                                        ? "Generate free key"
                                        : "Continue to checkout"}
                            </button>

                            <p className="text-center text-xs text-white/50">
                                By continuing you agree to our Terms and Privacy Policy. 30-day money-back on paid plans.
                            </p>
                        </form>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="space-y-6 rise rise-delay-5">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white text-center">Frequently asked</h2>
                <FAQ />
            </section>

            <footer className="text-center text-xs text-white/40 py-10">
                © {new Date().getFullYear()} Tempaloo. Made with care for WordPress creators.
            </footer>

            <FieldStyles />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-xs font-medium text-white/60 mb-1.5">{label}</span>
            {children}
        </label>
    );
}

function DividerOr() {
    return (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/40">
            <span className="flex-1 h-px bg-white/10" />
            <span>or continue with email</span>
            <span className="flex-1 h-px bg-white/10" />
        </div>
    );
}

function GoogleSignInButton({ plan }: { plan: PlanCode }) {
    const [pending, setPending] = useState(false);
    const onClick = async () => {
        setPending(true);
        try {
            // After Google sign-in, land on the dashboard. If the user picked a paid
            // plan, the dashboard will surface the checkout step.
            const callbackURL = plan === "free"
                ? "/webp/dashboard?signup=1"
                : `/webp/dashboard?plan=${plan}&checkout=1`;
            const res = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: "google", callbackURL }),
            });
            const data = await res.json().catch(() => null);
            if (res.ok && data?.url) {
                window.location.href = data.url;
                return;
            }
            alert(data?.error?.message ?? data?.error ?? "Google sign-in is not available yet. Use the email form below.");
        } catch {
            alert("Could not reach the auth server.");
        } finally {
            setPending(false);
        }
    };
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending}
            className="w-full h-12 rounded-xl bg-white text-ink-950 font-semibold text-sm hover:bg-white/90 transition flex items-center justify-center gap-3 disabled:opacity-60"
        >
            <GoogleIcon />
            {pending ? "Connecting…" : "Continue with Google"}
        </button>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.1 0 9.8-2 13.3-5.2l-6.2-5.2C29.1 35 26.6 36 24 36c-5.2 0-9.6-3.4-11.2-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.2 5.2C41.6 35.2 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
    );
}

function FieldStyles() {
    return (
        <style>{`
            .input {
                display: block;
                width: 100%;
                height: 44px;
                border-radius: 10px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.1);
                padding: 0 12px;
                color: #f1f5f9;
                font-size: 14px;
                outline: none;
                transition: border-color 150ms, background 150ms;
            }
            .input::placeholder { color: rgba(255,255,255,0.35); }
            .input:focus { border-color: #818cf8; background: rgba(255,255,255,0.06); }
        `}</style>
    );
}

function LicenseSuccess({ licenseKey, plan, returnUrl, email }: { licenseKey: string; plan: string; returnUrl: string; email: string }) {
    return (
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mb-6 shadow-pop">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
            <h1 className="text-3xl font-semibold text-white">You're in.</h1>
            <p className="mt-2 text-white/70 text-sm">
                {plan === "free" ? "Free plan" : plan} key generated{email ? ` for ${email}` : ""}.
            </p>
            <div className="mt-8 glass-strong rounded-2xl p-5 text-left">
                <div className="text-xs uppercase tracking-wider text-white/50">License key</div>
                <code className="block mt-2 break-all font-mono text-xs text-brand-300">{licenseKey}</code>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={() => navigator.clipboard.writeText(licenseKey)}
                        className="flex-1 h-10 rounded-lg bg-white text-ink-950 text-sm font-medium hover:bg-white/90"
                    >
                        Copy key
                    </button>
                    {returnUrl && (
                        <a
                            href={returnUrl}
                            className="flex-1 h-10 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold flex items-center justify-center glow"
                        >
                            Back to WordPress →
                        </a>
                    )}
                </div>
            </div>
            <p className="mt-6 text-xs text-white/40">
                Paste this key into the plugin's Activate field and click Activate. The key is your API credential — keep it safe.
            </p>
        </main>
    );
}
