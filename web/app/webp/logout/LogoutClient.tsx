"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/Logo";

type State = "signing-out" | "done" | "error";

/**
 * /webp/logout — the safe, brand-colored alternative to GETting
 * /api/auth/sign-out (which Better Auth refuses for CSRF reasons).
 *
 * On mount: POST to the auth endpoint with the right Content-Type, then
 * redirect to ?return=<path> (defaults to "/"). Always works whether
 * the user is hitting this from a link, the dashboard button, or the
 * plugin admin opening it in a new tab.
 */
export function LogoutClient() {
    const router = useRouter();
    const params = useSearchParams();
    const returnTo = params.get("return") || "/";
    const [state, setState] = useState<State>("signing-out");
    const [errMsg, setErrMsg] = useState<string>("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/auth/sign-out", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                    credentials: "include",
                });
                // 200, 204 or even 404 (no session) all mean "you're signed out".
                if (cancelled) return;
                if (res.status >= 500) {
                    setErrMsg(`Server error (${res.status})`);
                    setState("error");
                    return;
                }
                setState("done");
                // Tiny pause so the success state is visible before we redirect.
                setTimeout(() => router.replace(safeReturn(returnTo)), 600);
            } catch (e) {
                if (cancelled) return;
                setErrMsg(e instanceof Error ? e.message : "Network error");
                setState("error");
            }
        })();
        return () => { cancelled = true; };
    }, [returnTo, router]);

    return (
        <main style={mainStyle}>
            <div style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                    <LogoMark size={28} />
                </div>

                {state === "signing-out" && (
                    <>
                        <Spinner />
                        <h1 style={titleStyle}>Signing you out…</h1>
                        <p style={subStyle}>Clearing your session, one moment.</p>
                    </>
                )}

                {state === "done" && (
                    <>
                        <CheckBadge />
                        <h1 style={titleStyle}>You&apos;re signed out</h1>
                        <p style={subStyle}>Redirecting…</p>
                    </>
                )}

                {state === "error" && (
                    <>
                        <ErrorBadge />
                        <h1 style={titleStyle}>Couldn&apos;t sign you out</h1>
                        <p style={subStyle}>
                            {errMsg ? errMsg + " · " : ""}
                            Try clearing cookies for this site, or contact <a href="mailto:support@tempaloo.com" style={{ color: "var(--ink)" }}>support</a>.
                        </p>
                        <div style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
                            <Link href="/webp" style={btnGhostStyle}>Back to home</Link>
                            <button onClick={() => location.reload()} style={btnPrimaryStyle}>Retry</button>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}

/**
 * Only allow same-origin paths to avoid an open-redirect via ?return=.
 */
function safeReturn(value: string): string {
    if (!value) return "/";
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    return "/";
}

const mainStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
};
const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 380,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: "32px 28px",
    textAlign: "center",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 24px 48px -24px rgba(0,0,0,0.18)",
};
const titleStyle: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans), sans-serif",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--ink)",
    margin: "16px 0 6px",
    letterSpacing: "-0.015em",
};
const subStyle: React.CSSProperties = {
    fontSize: 14,
    color: "var(--ink-3)",
    margin: 0,
    lineHeight: 1.55,
};
const btnPrimaryStyle: React.CSSProperties = {
    height: 36, padding: "0 14px", borderRadius: 8,
    background: "var(--ink)", color: "var(--bg)",
    fontSize: 13, fontWeight: 500, border: "1px solid var(--ink)", cursor: "pointer",
};
const btnGhostStyle: React.CSSProperties = {
    height: 36, padding: "0 14px", borderRadius: 8,
    background: "transparent", color: "var(--ink)",
    fontSize: 13, fontWeight: 500, border: "1px solid var(--line-2)",
    display: "inline-flex", alignItems: "center", textDecoration: "none",
};

function Spinner() {
    return (
        <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: 4 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: "var(--ink-3)" }}>
                <circle cx="12" cy="12" r="9" strokeWidth="2.5" opacity="0.25" />
                <path d="M21 12a9 9 0 1 0 -9 9" strokeWidth="2.5" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite" />
                </path>
            </svg>
        </div>
    );
}
function CheckBadge() {
    return (
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "color-mix(in oklab, var(--success) 18%, transparent)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13 L10 18 L20 6" /></svg>
        </div>
    );
}
function ErrorBadge() {
    return (
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "color-mix(in oklab, var(--danger) 14%, transparent)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--danger)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
        </div>
    );
}
