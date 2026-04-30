"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

/**
 * Pro sign-in screen. Centred glass card on top of an animated mesh
 * background — three colour blobs drift slowly across the viewport with
 * mix-blend-mode, plus a subtle SVG grain to break the gradient banding.
 *
 * Two auth paths:
 *   1. Google OAuth via Neon Auth (Better Auth under the hood)
 *      → POST /api/auth/sign-in/social { provider: "google" }
 *      → returns { url } pointing at Google's consent screen
 *   2. Email magic link (passwordless) via the same Better Auth instance
 *      → POST /api/auth/sign-in/magic-link { email }
 *      → returns 200 with no body; we show "Check your inbox" state
 *
 * Both fall back to a clear inline error when Neon Auth env vars
 * aren't set on the server (the API returns 404 in that case).
 */
export function SignInClient({
    redirectTo,
    initialError,
}: {
    redirectTo: string;
    initialError?: string;
}) {
    const [email, setEmail] = useState("");
    const [step, setStep] = useState<"idle" | "loading-google" | "loading-email" | "email-sent">("idle");
    const [error, setError] = useState<string | null>(initialError ? errorMessage(initialError) : null);

    async function continueWithGoogle() {
        if (step !== "idle") return;
        setStep("loading-google");
        setError(null);
        try {
            // Warmup GET — same pattern the activate modal uses, ensures
            // Better Auth has a fresh CSRF cookie before the social
            // sign-in POST.
            await fetch("/api/auth/get-session", { credentials: "include", cache: "no-store" }).catch(() => null);

            const res = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: "google", callbackURL: redirectTo }),
            });
            const data = await res.json().catch(() => null);

            // Better Auth ships a few response shapes; accept any.
            const target =
                (typeof data?.url === "string" && data.url) ||
                (typeof data?.data?.url === "string" && data.data.url) ||
                null;

            if (res.ok && target) {
                window.location.href = target;
                return;
            }

            setStep("idle");
            setError(
                res.status === 404
                    ? "Google sign-in isn't configured yet. Use email below or contact support."
                    : "Google sign-in failed. Try again or use email below.",
            );
        } catch {
            setStep("idle");
            setError("Network error. Check your connection and try again.");
        }
    }

    async function sendMagicLink(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (step !== "idle") return;
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError("Enter a valid email.");
            return;
        }
        setStep("loading-email");
        setError(null);
        try {
            const res = await fetch("/api/auth/sign-in/magic-link", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed, callbackURL: redirectTo }),
            });
            if (res.ok) {
                setStep("email-sent");
                return;
            }
            const data = await res.json().catch(() => null);
            setStep("idle");
            setError(
                res.status === 404
                    ? "Email sign-in isn't configured yet. Try Google above or contact support."
                    : (data && typeof data.message === "string"
                        ? data.message
                        : "We couldn't send the link. Try again in a moment."),
            );
        } catch {
            setStep("idle");
            setError("Network error. Check your connection and try again.");
        }
    }

    if (step === "email-sent") {
        return (
            <Shell>
                <div className="si-success">
                    <div className="si-success-icon" aria-hidden>
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                    </div>
                    <h1 className="si-h1">Check your inbox</h1>
                    <p className="si-p">
                        We sent a sign-in link to <strong>{email}</strong>. Click it to land
                        straight in your dashboard. The link is valid for 15 minutes.
                    </p>
                    <p className="si-fineprint">
                        Wrong email?{" "}
                        <button type="button" className="si-linklike" onClick={() => { setStep("idle"); setError(null); }}>
                            Try a different one
                        </button>
                    </p>
                </div>
            </Shell>
        );
    }

    return (
        <Shell>
            <header className="si-card-head">
                <h1 className="si-h1">Welcome back</h1>
                <p className="si-p">Sign in to manage your license, billing, and connected sites.</p>
            </header>

            <button
                type="button"
                className="si-btn si-btn-google"
                onClick={continueWithGoogle}
                disabled={step !== "idle"}
                aria-busy={step === "loading-google"}
            >
                {step === "loading-google" ? (
                    <span className="si-spinner" aria-hidden />
                ) : (
                    <GoogleIcon />
                )}
                <span>{step === "loading-google" ? "Redirecting…" : "Continue with Google"}</span>
            </button>

            <div className="si-divider" role="separator" aria-orientation="horizontal">
                <span>or</span>
            </div>

            <form className="si-form" onSubmit={sendMagicLink} noValidate>
                <label htmlFor="si-email" className="si-label">Email</label>
                <input
                    id="si-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="si-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={step !== "idle"}
                    required
                />
                <button
                    type="submit"
                    className="si-btn si-btn-primary"
                    disabled={step !== "idle"}
                    aria-busy={step === "loading-email"}
                >
                    {step === "loading-email" ? (
                        <>
                            <span className="si-spinner" aria-hidden />
                            <span>Sending magic link…</span>
                        </>
                    ) : (
                        <>
                            <span>Email me a sign-in link</span>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 8 H13 M9 4 L13 8 L9 12" />
                            </svg>
                        </>
                    )}
                </button>
            </form>

            {error && (
                <div className="si-error" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            <p className="si-fineprint">
                New to Tempaloo?{" "}
                <Link href="/webp/activate?plan=free" className="si-link">Create a free account →</Link>
            </p>
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <main className="si-root">
            <style dangerouslySetInnerHTML={{ __html: css }} />

            {/* Animated mesh background — three drifting colour blobs +
                grain overlay. Pure CSS, no library, GPU-friendly. */}
            <div className="si-bg" aria-hidden>
                <div className="si-blob si-blob-1" />
                <div className="si-blob si-blob-2" />
                <div className="si-blob si-blob-3" />
                <svg className="si-grain" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
                    <filter id="si-noise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
                        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#si-noise)" />
                </svg>
            </div>

            <header className="si-nav">
                <Link href="/" className="si-nav-logo" aria-label="Tempaloo home">
                    <LogoMark size={28} />
                </Link>
                <Link href="/webp" className="si-nav-back">← Back to home</Link>
            </header>

            <section className="si-card-wrap">
                <div className="si-card">{children}</div>

                <p className="si-legal">
                    By signing in you agree to our{" "}
                    <Link href="/terms">Terms</Link> and{" "}
                    <Link href="/privacy">Privacy Policy</Link>.
                </p>
            </section>
        </main>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92a8.78 8.78 0 0 0 2.68-6.61z" />
            <path fill="#34A853" d="M9 18a8.6 8.6 0 0 0 5.96-2.18l-2.91-2.26a5.4 5.4 0 0 1-8.09-2.85H.96v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.96l3 2.33A5.36 5.36 0 0 1 9 3.58z" />
        </svg>
    );
}

function errorMessage(code: string): string {
    switch (code) {
        case "session_expired":   return "Your session expired. Sign in again to continue.";
        case "oauth_cancelled":   return "Google sign-in was cancelled. Try again or use email below.";
        case "account_not_found": return "No account matches that sign-in. Create one first.";
        default:                  return "Something went wrong. Try again.";
    }
}

const css = `
.si-root {
    position: relative;
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    overflow: hidden;
    font-family: var(--font-geist-sans), sans-serif;
    display: flex;
    flex-direction: column;
}

/* ── Animated mesh background ─────────────────────────────── */
.si-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
}
.si-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(110px);
    opacity: 0.55;
    mix-blend-mode: screen;
    will-change: transform;
}
[data-theme="light"] .si-blob {
    mix-blend-mode: multiply;
    opacity: 0.32;
}
.si-blob-1 {
    width: 620px; height: 620px;
    top: -180px; left: -120px;
    background: radial-gradient(circle, #2a57e6 0%, transparent 60%);
    animation: si-drift-1 22s ease-in-out infinite alternate;
}
.si-blob-2 {
    width: 560px; height: 560px;
    bottom: -160px; right: -120px;
    background: radial-gradient(circle, #10b981 0%, transparent 60%);
    animation: si-drift-2 28s ease-in-out infinite alternate;
}
.si-blob-3 {
    width: 480px; height: 480px;
    top: 38%; left: 52%;
    background: radial-gradient(circle, #7c4dff 0%, transparent 60%);
    animation: si-drift-3 32s ease-in-out infinite alternate;
    transform: translate(-50%, -50%);
}
@keyframes si-drift-1 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(180px, 90px) scale(1.08); }
    100% { transform: translate(80px, 220px) scale(0.96); }
}
@keyframes si-drift-2 {
    0%   { transform: translate(0, 0) scale(1); }
    50%  { transform: translate(-160px, -110px) scale(1.06); }
    100% { transform: translate(-80px, -220px) scale(1.02); }
}
@keyframes si-drift-3 {
    0%   { transform: translate(-50%, -50%) scale(1); }
    50%  { transform: translate(-58%, -42%) scale(1.1); }
    100% { transform: translate(-46%, -54%) scale(0.94); }
}
.si-grain {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.07;
    mix-blend-mode: overlay;
    pointer-events: none;
}
[data-theme="light"] .si-grain { opacity: 0.04; }

/* Reduced motion: stop the drift, keep the static glow. */
@media (prefers-reduced-motion: reduce) {
    .si-blob, .si-grain { animation: none !important; }
}

/* ── Top nav ──────────────────────────────────────────────── */
.si-nav {
    position: relative; z-index: 10;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 20px clamp(16px, 3vw, 24px);
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.si-nav-logo { color: var(--ink); display: inline-flex; }
.si-nav-back {
    font-size: 13px;
    color: var(--ink-3);
    transition: color .15s;
}
.si-nav-back:hover { color: var(--ink); }

/* ── Card wrap ────────────────────────────────────────────── */
.si-card-wrap {
    position: relative; z-index: 10;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px clamp(16px, 3vw, 24px) 64px;
    gap: 16px;
}

.si-card {
    width: 100%;
    max-width: 420px;
    padding: 36px clamp(24px, 4vw, 36px);
    background: color-mix(in oklab, var(--bg) 88%, transparent);
    backdrop-filter: blur(18px) saturate(180%);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    border: 1px solid var(--line);
    border-radius: 16px;
    box-shadow:
        0 1px 0 0 color-mix(in oklab, var(--ink) 4%, transparent) inset,
        0 8px 32px -12px rgba(0, 0, 0, 0.18),
        0 32px 64px -32px rgba(0, 0, 0, 0.12);
    animation: si-card-in 320ms cubic-bezier(.16, 1, .3, 1) both;
}
@keyframes si-card-in {
    from { opacity: 0; transform: translateY(6px) scale(.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

.si-card-head { margin-bottom: 24px; text-align: center; }
.si-h1 {
    font-size: 26px;
    letter-spacing: -0.025em;
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 6px;
    line-height: 1.2;
}
.si-p {
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-2);
    margin: 0;
}
.si-p strong { color: var(--ink); font-weight: 600; }

/* ── Buttons ──────────────────────────────────────────────── */
.si-btn {
    width: 100%;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: transform .12s, background .15s, border-color .15s, opacity .15s;
}
.si-btn:disabled { opacity: 0.65; cursor: not-allowed; }
.si-btn:active:not(:disabled) { transform: translateY(1px); }

.si-btn-google {
    background: var(--surface, var(--bg));
    color: var(--ink);
    border: 1px solid var(--line-2);
}
.si-btn-google:hover:not(:disabled) {
    border-color: var(--ink-3);
    background: var(--bg-2);
}

.si-btn-primary {
    margin-top: 12px;
    background: var(--ink);
    color: var(--bg);
    border: 1px solid var(--ink);
}
.si-btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px -4px color-mix(in oklab, var(--ink) 40%, transparent);
}

/* ── Divider ──────────────────────────────────────────────── */
.si-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 18px 0;
    color: var(--ink-3);
    font-size: 12px;
    font-family: var(--font-geist-mono), monospace;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}
.si-divider::before,
.si-divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--line);
}

/* ── Form ─────────────────────────────────────────────────── */
.si-form { display: flex; flex-direction: column; gap: 8px; }
.si-label {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--ink-2);
    margin-bottom: 2px;
}
.si-input {
    width: 100%;
    height: 42px;
    padding: 0 12px;
    border: 1px solid var(--line-2);
    background: var(--surface, var(--bg));
    color: var(--ink);
    border-radius: 10px;
    font-size: 14.5px;
    font-family: inherit;
    transition: border-color .15s, box-shadow .15s;
}
.si-input:focus {
    outline: none;
    border-color: var(--ink);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--ink) 12%, transparent);
}
.si-input:disabled { opacity: 0.6; }

/* ── Spinner ──────────────────────────────────────────────── */
.si-spinner {
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-top-color: transparent;
    animation: si-spin .8s linear infinite;
    flex-shrink: 0;
}
@keyframes si-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
    .si-spinner { animation: none; }
}

/* ── Error ────────────────────────────────────────────────── */
.si-error {
    margin-top: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: color-mix(in oklab, #dc2626 10%, transparent);
    border: 1px solid color-mix(in oklab, #dc2626 35%, transparent);
    border-radius: 8px;
    color: #b91c1c;
    font-size: 13px;
    line-height: 1.45;
}
[data-theme="dark"] .si-error { color: #fca5a5; }

/* ── Fineprint + legal ────────────────────────────────────── */
.si-fineprint {
    margin: 18px 0 0;
    text-align: center;
    font-size: 13px;
    color: var(--ink-3);
}
.si-link, .si-linklike {
    color: var(--ink);
    border-bottom: 1px solid var(--line-2);
    padding-bottom: 1px;
    background: none;
    border-top: 0; border-left: 0; border-right: 0;
    font: inherit;
    cursor: pointer;
    transition: border-color .15s;
}
.si-link:hover, .si-linklike:hover { border-bottom-color: var(--ink); }

.si-legal {
    font-size: 12px;
    color: var(--ink-3);
    text-align: center;
    margin: 0;
    max-width: 420px;
}
.si-legal a {
    color: var(--ink-2);
    border-bottom: 1px solid var(--line-2);
    padding-bottom: 1px;
}
.si-legal a:hover { color: var(--ink); }

/* ── Email-sent success state ────────────────────────────── */
.si-success {
    text-align: center;
    padding: 8px 0;
}
.si-success-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px; height: 64px;
    border-radius: 50%;
    background: color-mix(in oklab, #10b981 18%, var(--bg));
    color: #10b981;
    margin-bottom: 18px;
}
`;
