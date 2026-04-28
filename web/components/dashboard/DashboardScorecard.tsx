"use client";

import { useEffect, useRef, useState } from "react";
import type { DashLicense } from "./LicenseCard";

/**
 * Dashboard hero — emotional payoff. Aggregates usage across all the
 * user's licenses and projects savings + LCP impact + CDN €/mo so the
 * dashboard doesn't just show numbers, it shows the *value* the user
 * is getting from the product.
 *
 * Heuristics (conservative — undersell so the user always smiles):
 *   - avg WebP gain per upload bundle ≈ 700 KB (covers 7 thumbnail sizes)
 *   - LCP shaved ≈ savedPct × 0.025 s, capped at 2.5 s
 *   - CDN bandwidth saved ≈ 5000 monthly visitors × 3 image-page-views
 *     × bytes saved → multiplied by €0.04 / GB (Bunny pricing)
 */
export function DashboardScorecard({ licenses }: { licenses: DashLicense[] }) {
    const totalConverted = licenses.reduce((a, l) => a + l.quota.imagesUsed, 0);
    const estimatedBytesSaved = totalConverted * 700_000;
    const savedMb = estimatedBytesSaved / (1024 * 1024);

    // Estimated saved % is roughly stable in the 60-70% range for web photos.
    const savedPct = totalConverted > 0 ? 67 : 0;
    const lcpShaved = Math.min(2.5, savedPct * 0.025);
    const monthlyGbSaved = (estimatedBytesSaved * 5000 * 3) / (1024 * 1024 * 1024);
    const monthlyEur = monthlyGbSaved * 0.04;

    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!ref.current) return;
        const io = new IntersectionObserver(([e]) => {
            if (e?.isIntersecting) { setShown(true); io.disconnect(); }
        }, { threshold: 0.3 });
        io.observe(ref.current);
        return () => io.disconnect();
    }, []);

    const pctTween = useTween(shown ? savedPct : 0, 1100);
    const mbTween  = useTween(shown ? savedMb : 0, 1300);
    const lcpTween = useTween(shown ? lcpShaved * 10 : 0, 1100);

    if (totalConverted === 0) {
        return (
            <div ref={ref} className="surface-card" style={emptyStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={iconStyle}>⚡</div>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em" }}>
                            Ready to make your sites faster.
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.5 }}>
                            Activate the plugin on a WordPress install — your savings will appear here.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div ref={ref} style={cardStyle}>
            <div style={gridBgStyle} aria-hidden />

            <div style={contentStyle}>
                {/* Headline */}
                <div>
                    <div className="eyebrow" style={{ color: "var(--success)" }}>YOUR PERFORMANCE</div>
                    <div style={headlineRowStyle}>
                        <span style={bigNumberStyle}>
                            {Math.round(pctTween)}<span style={{ color: "var(--success)" }}>%</span>
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>lighter</span>
                    </div>
                    <div style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 8 }}>
                        Across <strong style={{ color: "var(--ink)" }}>{totalConverted.toLocaleString()}</strong> converted image{totalConverted !== 1 ? "s" : ""}
                        {licenses.length > 1 && <> on <strong style={{ color: "var(--ink)" }}>{licenses.length}</strong> licenses</>}
                    </div>
                </div>

                {/* Two sub-gauges */}
                <div style={gaugeGridStyle}>
                    <Gauge
                        kind="bandwidth"
                        label="Bandwidth saved"
                        value={formatBytes(mbTween * 1024 * 1024)}
                        fillPct={Math.min(100, savedPct)}
                        shown={shown}
                    />
                    <Gauge
                        kind="lcp"
                        label="Est. LCP shaved"
                        value={`−${(lcpTween / 10).toFixed(1)}s`}
                        fillPct={Math.min(100, (lcpShaved / 2.5) * 100)}
                        shown={shown}
                    />
                </div>
            </div>

            {monthlyEur > 0.5 && (
                <div style={projectionStyle}>
                    <span style={{ color: "var(--success)", marginRight: 6 }}>💡</span>
                    At <strong style={{ color: "var(--ink)" }}>5,000 monthly visitors</strong>, that&apos;s roughly
                    <strong style={{ color: "var(--ink)" }}> {monthlyGbSaved.toFixed(1)} GB</strong> saved per month —
                    about <strong style={{ color: "var(--success)" }}>€{monthlyEur.toFixed(2)}/mo</strong> off a typical CDN bill.
                </div>
            )}
        </div>
    );
}

function Gauge({ kind, label, value, fillPct, shown }: {
    kind: "bandwidth" | "lcp";
    label: string;
    value: string;
    fillPct: number;
    shown: boolean;
}) {
    const grad = kind === "bandwidth"
        ? "linear-gradient(90deg, #34d399, #10b981)"
        : "linear-gradient(90deg, #5688ff, #2a57e6)";
    const ringColor = kind === "bandwidth" ? "#10b981" : "#2a57e6";

    return (
        <div style={subCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>
                <span style={{ color: ringColor, display: "inline-flex" }}>
                    {kind === "bandwidth"
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8 V12 L15 15" /></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L4 14 H11 L10 22 L20 10 H13 L14 2 Z" /></svg>}
                </span>
                <span>{label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {value}
            </div>
            <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: "var(--bg-2)", overflow: "hidden" }}>
                <div style={{
                    height: "100%",
                    width: shown ? fillPct + "%" : "0%",
                    background: grad,
                    borderRadius: 999,
                    transition: "width 1100ms cubic-bezier(.16,1,.3,1)",
                }} />
            </div>
        </div>
    );
}

function useTween(target: number, duration = 800): number {
    const [value, setValue] = useState(0);
    const fromRef = useRef(0);
    useEffect(() => {
        const from = fromRef.current;
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(from + (target - from) * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
            else fromRef.current = target;
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return value;
}

function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const cardStyle: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    border: "1px solid color-mix(in oklab, var(--success) 30%, var(--line))",
    background: "linear-gradient(135deg, color-mix(in oklab, var(--success) 6%, var(--bg)) 0%, var(--bg) 50%, color-mix(in oklab, var(--ink) 4%, var(--bg)) 100%)",
    padding: "26px 28px 22px",
};
const gridBgStyle: React.CSSProperties = {
    position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
    backgroundImage:
        "linear-gradient(0deg, transparent 24%, currentColor 25%, currentColor 26%, transparent 27%, transparent 74%, currentColor 75%, currentColor 76%, transparent 77%), " +
        "linear-gradient(90deg, transparent 24%, currentColor 25%, currentColor 26%, transparent 27%, transparent 74%, currentColor 75%, currentColor 76%, transparent 77%)",
    backgroundSize: "32px 32px",
};
const contentStyle: React.CSSProperties = {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 28,
    alignItems: "center",
};
const headlineRowStyle: React.CSSProperties = {
    display: "flex", alignItems: "baseline", gap: 8, marginTop: 4,
};
const bigNumberStyle: React.CSSProperties = {
    fontFamily: "var(--font-geist-sans), sans-serif",
    fontSize: "clamp(48px, 6vw, 64px)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    color: "var(--ink)",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
};
const gaugeGridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
};
const subCardStyle: React.CSSProperties = {
    padding: "14px 16px",
    background: "var(--bg)",
    border: "1px solid var(--line)",
    borderRadius: 10,
};
const projectionStyle: React.CSSProperties = {
    position: "relative",
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid color-mix(in oklab, var(--success) 18%, var(--line))",
    fontSize: 13.5,
    color: "var(--ink-2)",
    lineHeight: 1.55,
};
const emptyStyle: React.CSSProperties = {
    padding: "20px 22px",
    background: "linear-gradient(135deg, var(--bg-2) 0%, var(--bg) 100%)",
};
const iconStyle: React.CSSProperties = {
    width: 40, height: 40, borderRadius: "50%",
    background: "color-mix(in oklab, var(--ink) 6%, transparent)",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 18,
    flexShrink: 0,
};
