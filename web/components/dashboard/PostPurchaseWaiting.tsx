"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Post-checkout race-bridge.
 *
 * Freemius redirects the browser to /webp/dashboard?purchase=1 the
 * INSTANT the card is charged — but the license.created webhook
 * usually arrives ~1-3 seconds later (HMAC verify + DB upsert + email
 * fire). Without this component, users land on the EmptyState ("no
 * license") for those few seconds and panic.
 *
 * UX contract:
 *   · Render this whenever `purchase=1` is set AND licenses are empty.
 *   · Show a clear "we're setting things up" state with a spinner.
 *   · Re-fetch the page every 2 seconds (router.refresh re-runs the
 *     server component without a full reload — keeps confetti, theme,
 *     scroll position).
 *   · Stop after ~30 seconds and degrade to a manual-refresh prompt.
 *     If we're still empty after 30s the webhook probably failed or
 *     the email mismatches the session — both warrant a real human
 *     looking.
 *
 * Stops polling automatically by being unmounted (parent re-renders
 * with licenses.length > 0 → renders LicenseListClient instead).
 */
const POLL_MS = 2_000;
const MAX_ATTEMPTS = 15;     // 15 × 2s = 30s

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
        const t = setTimeout(() => {
            router.refresh();
            setAttempts((n) => n + 1);
        }, POLL_MS);
        return () => clearTimeout(t);
    }, [attempts, gaveUp, router]);

    const elapsed = attempts * (POLL_MS / 1000);

    return (
        <div className="surface-card" style={{ padding: "48px 32px", textAlign: "center" }}>
            {!gaveUp ? (
                <>
                    <Spinner />
                    <h3 style={{ margin: "16px 0 6px", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                        Setting up your license…
                    </h3>
                    <p style={{ margin: "0 auto", maxWidth: 420, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
                        Your payment cleared. Your license usually appears within a few seconds.
                    </p>
                    <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
                        {elapsed > 0 ? `${elapsed}s elapsed` : "Just a moment…"}
                    </p>
                </>
            ) : (
                <>
                    <span className="eyebrow" style={{ color: "var(--warn)" }}>STILL WAITING</span>
                    <h3 style={{ margin: "12px 0 6px", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                        Your license isn&apos;t showing up yet
                    </h3>
                    <p style={{ margin: "0 auto", maxWidth: 460, fontSize: 14, color: "var(--ink-3)", lineHeight: 1.55 }}>
                        This sometimes happens if your purchase email doesn&apos;t match the email you signed in with. Check your inbox for the receipt — if you got one, the license is valid; we just need to link it to this account.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
                        <button
                            onClick={() => { setAttempts(0); setGaveUp(false); }}
                            className="btn btn-primary btn-sm"
                            style={{ display: "inline-flex" }}
                        >
                            Try again
                        </button>
                        <a
                            href="mailto:support@tempaloo.com?subject=Purchase%20not%20linked"
                            className="btn btn-ghost btn-sm"
                            style={{ display: "inline-flex" }}
                        >
                            Contact support
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}

function Spinner() {
    return (
        <span
            aria-hidden="true"
            style={{
                display: "inline-block",
                width: 22,
                height: 22,
                border: "2.5px solid var(--line-2)",
                borderTopColor: "var(--ink)",
                borderRadius: "50%",
                animation: "tempaloo-spin 0.8s linear infinite",
            }}
        />
    );
}
