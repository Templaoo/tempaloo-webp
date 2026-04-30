"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Post-checkout race-bridge — shimmer skeleton + progress timeline.
 *
 * Replaces the previous "spinner + 's elapsed' counter" with:
 *   1. A 3-step progress timeline (Payment / License / Dashboard) that
 *      morphs as time passes, so the user always feels something is
 *      happening rather than "is it stuck?".
 *   2. A shimmer skeleton that mimics the SHAPE of the upcoming
 *      LicenseCard (header, quota gauge, key, site list). Industry-
 *      standard pattern (Stripe / Vercel / Linear) — sets the user's
 *      expectation about what's coming + makes wait feel shorter.
 *
 * Polling cadence:
 *   First 10 attempts: every 1s   (covers the typical 2-4s arrival)
 *   Then  25 attempts: every 2s   (slow tail for sandbox / cold starts)
 *   Total budget ~60s before degrading to a manual-retry message.
 *
 * Stops polling automatically by being unmounted (parent re-renders
 * with licenses.length > 0 → renders LicenseListClient instead).
 */
const FAST_POLLS = 10;       // 10 × 1s = 10s
const SLOW_POLLS = 25;       // 25 × 2s = 50s
const FAST_MS = 1_000;
const SLOW_MS = 2_000;
const MAX_ATTEMPTS = FAST_POLLS + SLOW_POLLS;

export function PostPurchaseWaiting() {
    const router = useRouter();
    const [attempts, setAttempts] = useState(0);
    const [gaveUp, setGaveUp] = useState(false);

    useEffect(() => {
        if (gaveUp) return;
        if (attempts >= MAX_ATTEMPTS) {
            setGaveUp(true);
            return;
        }
        const delay = attempts < FAST_POLLS ? FAST_MS : SLOW_MS;
        const t = setTimeout(() => {
            router.refresh();
            setAttempts((n) => n + 1);
        }, delay);
        return () => clearTimeout(t);
    }, [attempts, gaveUp, router]);

    const elapsedSec = attempts < FAST_POLLS
        ? attempts * (FAST_MS / 1000)
        : (FAST_POLLS * FAST_MS + (attempts - FAST_POLLS) * SLOW_MS) / 1000;

    if (gaveUp) {
        return <GaveUpPanel onRetry={() => { setAttempts(0); setGaveUp(false); }} />;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ProgressTimeline elapsedSec={elapsedSec} />
            <LicenseCardSkeleton />
        </div>
    );
}

/* ─── Progress timeline ───────────────────────────────────────────────
 * Three steps, time-driven. Done at 0s, In-progress 1-3s, In-progress
 * 3-7s, In-progress 7+s. Each step has a state: done / live / pending.
 * Live step pulses; done step gets a checkmark; pending is gray.
 */
function ProgressTimeline({ elapsedSec }: { elapsedSec: number }) {
    const steps = [
        { label: "Payment confirmed",  state: stateAt(elapsedSec, 0, 0.5) },
        { label: "Creating license",   state: stateAt(elapsedSec, 0.5, 5) },
        { label: "Preparing dashboard", state: stateAt(elapsedSec, 5, 999) },
    ] as const;

    return (
        <div className="surface-card" style={{ padding: "20px 24px" }}>
            <div className="eyebrow" style={{ color: "var(--success)" }}>SETTING UP YOUR ACCOUNT</div>
            <div style={{
                marginTop: 16,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 12, position: "relative",
            }}>
                {/* Connecting line behind the dots */}
                <div style={{
                    position: "absolute",
                    top: 13, left: 13, right: 13, height: 2,
                    background: "var(--line)", zIndex: 0,
                }} />
                <div style={{
                    position: "absolute",
                    top: 13, left: 13, height: 2,
                    width: `calc(${Math.min(100, (elapsedSec / 7) * 100)}% - 26px)`,
                    background: "var(--success)", zIndex: 1,
                    transition: "width 600ms cubic-bezier(.16,1,.3,1)",
                }} />

                {steps.map((s, i) => (
                    <div key={i} style={{
                        position: "relative", zIndex: 2,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                        flex: "1 1 0", minWidth: 0,
                    }}>
                        <StepDot state={s.state} />
                        <div style={{
                            fontSize: 12, lineHeight: 1.3, textAlign: "center",
                            color: s.state === "pending" ? "var(--ink-3)" : "var(--ink-2)",
                            fontWeight: s.state === "live" ? 500 : 400,
                            maxWidth: 140,
                        }}>
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

type StepState = "done" | "live" | "pending";

function stateAt(elapsed: number, start: number, end: number): StepState {
    if (elapsed < start) return "pending";
    if (elapsed < end) return "live";
    return "done";
}

function StepDot({ state }: { state: StepState }) {
    const size = 26;
    if (state === "done") {
        return (
            <div style={{
                width: size, height: size, borderRadius: "50%",
                background: "var(--success)", color: "white",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, lineHeight: 1, fontWeight: 700,
                boxShadow: "0 0 0 4px color-mix(in oklab, var(--success) 12%, transparent)",
                transition: "background 300ms ease, box-shadow 300ms ease",
            }} aria-hidden>✓</div>
        );
    }
    if (state === "live") {
        return (
            <div style={{
                width: size, height: size, borderRadius: "50%",
                background: "var(--bg)",
                border: "2px solid var(--success)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                position: "relative",
            }} aria-hidden>
                <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--success)",
                    animation: "tempaloo-pulse 1.2s ease-in-out infinite",
                }} />
            </div>
        );
    }
    return (
        <div style={{
            width: size, height: size, borderRadius: "50%",
            background: "var(--bg-2)",
            border: "2px solid var(--line-2)",
        }} aria-hidden />
    );
}

/* ─── License card skeleton ──────────────────────────────────────────
 * Matches the real LicenseCard layout:
 *   header  : title pill + status pill (right: change-plan button)
 *   body    : 132px gauge | content (key + sites)
 * Each rectangle uses .tempaloo-shimmer (defined in globals.css).
 */
function LicenseCardSkeleton() {
    return (
        <div className="surface-card" style={{ padding: "26px 28px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <Bar w={120} h={22} radius={6} />
                        <Bar w={70}  h={20} radius={999} />
                        <Bar w={48}  h={14} radius={4} />
                    </div>
                    <Bar w={180} h={12} radius={4} />
                </div>
                <Bar w={120} h={32} radius={8} />
            </div>

            <div className="lc-body" style={{ display: "grid", gridTemplateColumns: "132px 1fr", gap: 28, alignItems: "start" }}>
                {/* Quota gauge */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 132, height: 132, borderRadius: "50%", background: "transparent", border: "10px solid var(--line)", position: "relative" }}>
                        <div style={{
                            position: "absolute", inset: 14, borderRadius: "50%",
                            background: "var(--bg)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            <Bar w={50} h={18} radius={4} />
                        </div>
                    </div>
                    <Bar w={100} h={28} radius={6} />
                </div>

                {/* Right column: key + sites */}
                <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
                    <div>
                        <Bar w={80} h={11} radius={3} />
                        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ flex: 1 }}><Bar w="100%" h={36} radius={7} /></div>
                            <Bar w={36} h={36} radius={7} />
                            <Bar w={68} h={34} radius={7} />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <Bar w="80%" h={36} radius={7} />
                        </div>
                    </div>
                    <div>
                        <Bar w={60} h={11} radius={3} />
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                            <Bar w="100%" h={44} radius={8} />
                            <Bar w="100%" h={44} radius={8} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Bar({ w, h, radius }: { w: number | string; h: number; radius: number }) {
    return (
        <div
            className="tempaloo-shimmer"
            style={{
                width: typeof w === "number" ? `${w}px` : w,
                height: h,
                borderRadius: radius,
            }}
            aria-hidden
        />
    );
}

/* ─── Failure state ─────────────────────────────────────────────── */
function GaveUpPanel({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="surface-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <span className="eyebrow" style={{ color: "var(--warn)" }}>STILL WAITING</span>
            <h3 style={{ margin: "12px 0 6px", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                Your license isn&apos;t showing up yet
            </h3>
            <p style={{ margin: "0 auto", maxWidth: 460, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
                This sometimes happens if your purchase email doesn&apos;t match the email you signed in with.
                Check your inbox for the receipt — if you got one, the license is valid; we just need to link
                it to this account.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
                <button onClick={onRetry} className="btn btn-primary btn-sm" style={{ display: "inline-flex" }}>
                    Try again
                </button>
                <a href="/contact?topic=support&subject=Purchase%20not%20linked"
                   className="btn btn-ghost btn-sm"
                   style={{ display: "inline-flex" }}>
                    Contact support
                </a>
            </div>
        </div>
    );
}
