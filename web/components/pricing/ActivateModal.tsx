"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Plan } from "@/lib/plans";
import type { Billing } from "./BillingToggle";
import { openFreemiusCheckout } from "@/lib/freemius-checkout";

type Step = "loading" | "choose" | "email" | "success";

export function ActivateModal({
    plan,
    billing,
    open,
    onClose,
}: {
    plan: Plan | null;
    billing: Billing;
    open: boolean;
    onClose: () => void;
}) {
    const [step, setStep] = useState<Step>("loading");
    const [email, setEmail] = useState("");
    const [site, setSite] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [licenseKey, setLicenseKey] = useState<string | null>(null);
    const [sessionEmail, setSessionEmail] = useState<string | null>(null);
    const firstFieldRef = useRef<HTMLInputElement>(null);

    // Reset + detect existing session on open.
    useEffect(() => {
        if (!open || !plan) return;
        let cancelled = false;

        setStep("loading");
        setError(null);
        setLicenseKey(null);
        setEmail("");
        setSite("");

        (async () => {
            // Check Neon Auth session.
            let authedEmail: string | null = null;
            try {
                const res = await fetch("/api/me", { cache: "no-store" });
                const data = await res.json();
                if (data?.user?.email) authedEmail = data.user.email;
            } catch { /* no-op */ }

            if (cancelled) return;
            setSessionEmail(authedEmail);

            if (authedEmail) {
                setEmail(authedEmail);
                if (plan.priceMonthly > 0) {
                    // Authed + paid: skip straight to Freemius Checkout.
                    try {
                        await openFreemiusCheckout({ plan, billing, email: authedEmail });
                    } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not open checkout");
                        setStep("email");
                        return;
                    }
                    // Close our modal immediately — Freemius overlay takes over.
                    onClose();
                    return;
                }
                // Authed + free: just ask for the site URL.
                setStep("email");
                return;
            }

            setStep("choose");
        })();

        return () => { cancelled = true; };
    }, [open, plan, billing, onClose]);

    // Escape to close.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [open, onClose]);

    // Auto-focus first field when we switch to the email step.
    useEffect(() => {
        if (step === "email") {
            setTimeout(() => firstFieldRef.current?.focus(), 50);
        }
    }, [step]);

    if (!open || !plan) return null;

    const isPaid = plan.priceMonthly > 0;
    const priceLine = isPaid
        ? billing === "annual"
            ? `€${plan.priceAnnual} billed yearly · ${plan.imagesLabel}`
            : `€${plan.priceMonthly}/month · ${plan.imagesLabel}`
        : `Free forever · ${plan.imagesLabel}`;

    async function onGoogle() {
        if (!plan) return;
        setLoading(true);
        setError(null);
        try {
            // Better Auth's social sign-in: callbackURL must be ABSOLUTE
            // for trustedOrigins matching to accept it; relative URLs
            // were silently dropped in some versions and the user landed
            // on the site root after OAuth. Using window.location.origin
            // guarantees same-origin.
            //
            // Belt-and-braces: stash the desired post-auth path in
            // sessionStorage too, so the /webp/post-auth router can
            // recover the redirect target even if Better Auth itself
            // strips the param somewhere along the OAuth chain (state
            // cookie loss across the Google round-trip is a known issue
            // with strict third-party cookie policies on Safari).
            const path = isPaid
                ? `/webp/activate?plan=${plan.code}&billing=${billing}&checkout=1`
                : `/webp/dashboard?signup=1`;
            const callbackURL = `${window.location.origin}${path}`;
            try { sessionStorage.setItem("tempaloo_post_auth", path); } catch { /* private mode */ }

            const res = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",   // ← was missing; some Better Auth
                                          // versions attach a CSRF token cookie
                                          // on the first request and need it
                                          // echoed on the second
                body: JSON.stringify({ provider: "google", callbackURL }),
            });
            const data = await res.json().catch(() => null);

            // Better Auth's social-signin response shape varies:
            //   { url: "..." }                — current
            //   { redirect: true, url: "..." } — newer
            //   { data: { url: "..." } }       — older / Supabase adapter
            // Accept any of them so an SDK bump doesn't silently break us.
            const target: string | null =
                (typeof data?.url === "string" && data.url) ||
                (typeof data?.data?.url === "string" && data.data.url) ||
                null;

            if (res.ok && target) {
                window.location.href = target;
                return;
            }

            // Log the real cause so anyone debugging "Google sign-in isn't
            // ready" in the wild can see the upstream status + body.
            // eslint-disable-next-line no-console
            console.error("[tempaloo] sign-in/social failed", {
                status: res.status,
                ok: res.ok,
                body: data,
            });
            setStep("email");
            setError(
                res.status === 401 || res.status === 403
                    ? "Sign-in session expired — try again."
                    : data?.error?.message
                        ? `Google sign-in: ${String(data.error.message).slice(0, 120)}. Use email instead.`
                        : "Google sign-in isn't ready yet — continue with your email below.",
            );
        } catch {
            setStep("email");
            setError("Could not reach the auth server. Use your email instead.");
        } finally {
            setLoading(false);
        }
    }

    async function onEmailSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!plan) return;
        setError(null);

        if (!email || !/.+@.+\..+/.test(email)) {
            setError("Enter a valid email address.");
            return;
        }

        setLoading(true);
        try {
            if (isPaid) {
                await openFreemiusCheckout({ plan, billing, email, siteUrl: site || undefined });
                // Freemius overlay is now on top. Keep our modal open silently — the user
                // can close it after; the success callback there handles the redirect.
                setLoading(false);
                return;
            }

            // Free path: generate the key in our API.
            if (!site) {
                setError("Enter your WordPress site URL.");
                setLoading(false);
                return;
            }
            const res = await fetch("/api/activate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, site_url: site, plan: "free" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message ?? "Could not generate your key.");
            setLicenseKey(String(data.license_key));
            setStep("success");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-[fadeIn_200ms_ease]"
            aria-modal="true"
            role="dialog"
        >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div
                className={clsx(
                    "relative w-full max-w-md rounded-2xl glass-strong shadow-pop overflow-hidden",
                    "border border-white/10",
                )}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
                </button>

                {/* Header */}
                <div className="p-6 pb-5 border-b border-white/10">
                    <div className="flex items-baseline gap-2">
                        <span className="text-xs uppercase tracking-wider text-brand-300 font-semibold">Start with</span>
                        <span className="text-xs text-white/50">{plan.tagline}</span>
                    </div>
                    <h2 className="mt-1 text-2xl font-bold text-white">{plan.name}</h2>
                    <p className="mt-1 text-sm text-white/70">{priceLine}</p>
                    {isPaid && (
                        <p className="mt-2 text-[11px] text-emerald-300">
                            7-day free trial · No charge until day 8 · Cancel anytime · 30-day money-back
                        </p>
                    )}
                </div>

                {/* Body */}
                <div className="p-6">
                    {step === "loading" && <LoadingStep />}
                    {step === "choose" && (
                        <ChooseStep
                            onGoogle={onGoogle}
                            onEmail={() => setStep("email")}
                            loading={loading}
                            error={error}
                        />
                    )}
                    {step === "email" && (
                        <EmailStep
                            firstFieldRef={firstFieldRef}
                            email={email}
                            setEmail={setEmail}
                            emailReadOnly={!!sessionEmail}
                            site={site}
                            setSite={setSite}
                            isPaid={isPaid}
                            loading={loading}
                            error={error}
                            onSubmit={onEmailSubmit}
                            onBack={sessionEmail ? null : () => setStep("choose")}
                        />
                    )}
                    {step === "success" && licenseKey && (
                        <SuccessStep
                            licenseKey={licenseKey}
                            email={email}
                            onClose={onClose}
                        />
                    )}
                </div>
            </div>

            <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
        </div>
    );
}

function ChooseStep({
    onGoogle, onEmail, loading, error,
}: { onGoogle: () => void; onEmail: () => void; loading: boolean; error: string | null }) {
    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={onGoogle}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-white text-ink-950 font-semibold text-sm hover:bg-white/90 transition flex items-center justify-center gap-3 disabled:opacity-60"
            >
                <GoogleIcon />
                {loading ? "Connecting…" : "Continue with Google"}
            </button>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/40">
                <span className="flex-1 h-px bg-white/10" />
                <span>or</span>
                <span className="flex-1 h-px bg-white/10" />
            </div>

            <button
                type="button"
                onClick={onEmail}
                className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition border border-white/10"
            >
                Continue with email →
            </button>

            {error && (
                <p role="alert" className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-200">
                    {error}
                </p>
            )}

            <p className="text-center text-[10px] text-white/40 mt-3">
                By continuing you agree to our Terms and Privacy Policy.
            </p>
        </div>
    );
}

function LoadingStep() {
    return (
        <div className="flex items-center justify-center py-10" aria-label="Loading">
            <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
    );
}

function EmailStep({
    firstFieldRef, email, setEmail, emailReadOnly, site, setSite, isPaid, loading, error, onSubmit, onBack,
}: {
    firstFieldRef: React.RefObject<HTMLInputElement>;
    email: string; setEmail: (v: string) => void;
    emailReadOnly?: boolean;
    site: string; setSite: (v: string) => void;
    isPaid: boolean; loading: boolean; error: string | null;
    onSubmit: (e: React.FormEvent) => void;
    onBack: (() => void) | null;
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {emailReadOnly ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-2 text-emerald-200 min-w-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                        <span className="truncate">Signed in as <strong className="font-semibold">{email}</strong></span>
                    </div>
                </div>
            ) : (
                <label className="block">
                    <span className="block text-xs font-medium text-white/60 mb-1.5">Email</span>
                    <input
                        ref={firstFieldRef}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input"
                    />
                </label>
            )}

            {!isPaid && (
                <label className="block">
                    <span className="block text-xs font-medium text-white/60 mb-1.5">WordPress site URL</span>
                    <input
                        type="url"
                        required
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                        placeholder="https://yoursite.com"
                        className="input"
                    />
                </label>
            )}

            {error && (
                <p role="alert" className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-200">
                    {error}
                </p>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-500 to-purple-500 text-white font-semibold text-sm glow disabled:opacity-60 disabled:cursor-wait"
            >
                {loading
                    ? (isPaid ? "Opening checkout…" : "Generating key…")
                    : (isPaid ? "Continue to payment →" : "Generate free key →")}
            </button>

            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    className="w-full text-center text-xs text-white/50 hover:text-white/80 mt-1"
                >
                    ← Back
                </button>
            )}

            <style>{`
                .input { display: block; width: 100%; height: 44px; border-radius: 10px;
                    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
                    padding: 0 12px; color: #f1f5f9; font-size: 14px; outline: none;
                    transition: border-color 150ms, background 150ms; }
                .input::placeholder { color: rgba(255,255,255,0.35); }
                .input:focus { border-color: #818cf8; background: rgba(255,255,255,0.06); }
            `}</style>
        </form>
    );
}

function SuccessStep({ licenseKey, email, onClose }: { licenseKey: string; email: string; onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(licenseKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-4 shadow-pop">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-white">You're in.</h3>
            <p className="mt-1 text-xs text-white/60">We also sent the key to {email}.</p>

            <div className="mt-5 text-left rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-white/40">License key</div>
                <code className="block mt-1 break-all font-mono text-xs text-brand-300">{licenseKey}</code>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={copy}
                    className="flex-1 h-10 rounded-lg bg-white text-ink-950 text-sm font-semibold"
                >
                    {copied ? "Copied" : "Copy key"}
                </button>
                <button
                    onClick={onClose}
                    className="flex-1 h-10 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-sm font-semibold glow"
                >
                    Done
                </button>
            </div>

            <p className="mt-4 text-[10px] text-white/40">
                Paste the key into the plugin's Activate field to turn on conversions.
            </p>
        </div>
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
