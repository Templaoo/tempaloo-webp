"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashLicense } from "./LicenseCard";

/**
 * Smart upgrade card. Personalises the pitch based on the user's actual
 * usage so it reads as advice, not advertising.
 *
 * Three states:
 *   - paid:           congrats card (no upsell)
 *   - free + idle:    classic upgrade pitch (calculator + plan grid)
 *   - free + engaged: usage-anchored pitch ("at this pace you'll hit
 *                     the cap on day X — Starter would buy you 20× more")
 */

interface PlanRow {
    code: "starter" | "growth" | "business";
    name: string;
    images: number;
    sites: string;
    priceEur: number;
}

const PAID: PlanRow[] = [
    { code: "starter",  name: "Starter",  images: 5_000,    sites: "1 site",      priceEur: 5  },
    { code: "growth",   name: "Growth",   images: 25_000,   sites: "5 sites",     priceEur: 12 },
    { code: "business", name: "Business", images: 150_000,  sites: "Unlimited",   priceEur: 29 },
];

export function UpgradeCardSmart({ licenses }: { licenses: DashLicense[] }) {
    // Only "live" licenses (active or trialing) count toward the
    // upgrade-vs-already-paid decision. An expired Free row from a
    // previous lifetime should NOT trigger the Free upsell.
    const live = licenses.filter((l) => l.status === "active" || l.status === "trialing");
    const hasPaid = live.some((l) => l.plan.code !== "free");
    const freeLicense = live.find((l) => l.plan.code === "free");

    if (hasPaid) {
        return (
            <div className="surface-card" style={{ padding: 18 }}>
                <div className="eyebrow">PLAN</div>
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                    ✓ You&apos;re on a paid plan
                </div>
                <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                    Need higher quotas or more sites? See pricing.
                </p>
                <Link
                    href="/webp#pricing"
                    style={{ fontSize: 12.5, color: "var(--ink)", borderBottom: "1px solid var(--line-2)", paddingBottom: 1 }}
                >
                    Compare plans →
                </Link>
            </div>
        );
    }

    return <FreeUpgradeCard freeLicense={freeLicense} />;
}

function FreeUpgradeCard({ freeLicense }: { freeLicense: DashLicense | undefined }) {
    const used = freeLicense?.quota.imagesUsed ?? 0;
    const limit = freeLicense?.plan.imagesPerMonth ?? 250;
    const usagePct = Math.min(100, (used / Math.max(1, limit)) * 100);
    const engaged = usagePct >= 30;

    // Project end-of-month usage based on day-of-month rate
    const now = new Date();
    const dayOfMonth = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const projected = used > 0 ? Math.round((used / Math.max(1, dayOfMonth)) * daysInMonth) : 0;
    const willHitCap = projected >= limit && used > 0;
    const dayCapHit = used > 0 ? Math.ceil(limit / Math.max(1, used / dayOfMonth)) : daysInMonth;

    // Pick the best plan to recommend based on projected need
    const recommended =
        projected >= 25_000 ? PAID[2]      // Business
      : projected >= 5_000  ? PAID[1]      // Growth
      :                       PAID[0];     // Starter

    // Mini calculator state
    const [sliderValue, setSliderValue] = useState(Math.max(500, projected || 1500));
    useEffect(() => {
        // Re-anchor if projected changes (rare on a static page but safe)
        if (projected > 0) setSliderValue(Math.max(500, projected));
    }, [projected]);

    const planForVolume = useMemo<PlanRow>(() => {
        if (sliderValue <= 5_000)   return PAID[0];
        if (sliderValue <= 25_000)  return PAID[1];
        return PAID[2];
    }, [sliderValue]);

    const yearlyEur = planForVolume.priceEur * 12;
    const yearlyAnnual = Math.round(yearlyEur * 0.8); // 20% off annual

    return (
        <div style={cardStyle}>
            {/* Subtle accent */}
            <div style={accentBarStyle} aria-hidden />

            <div style={{ position: "relative" }}>
                <div className="eyebrow" style={{ color: "var(--ink-3)" }}>
                    {engaged ? "RECOMMENDED FOR YOU" : "UPGRADE"}
                </div>

                {engaged ? (
                    <>
                        <div className="h-display" style={headlineStyle}>
                            {willHitCap
                                ? `You'll hit the Free cap around day ${Math.min(daysInMonth, dayCapHit)}.`
                                : `You're using Tempaloo actively.`}
                        </div>

                        {/* Side-by-side comparison */}
                        <div style={comparisonStyle}>
                            <div style={comparisonRow}>
                                <span style={comparisonLabel}>Free (current)</span>
                                <span style={{ ...comparisonValue, color: willHitCap ? "var(--warn)" : "var(--ink)" }}>
                                    {used.toLocaleString()} / {limit.toLocaleString()}
                                </span>
                            </div>
                            <div style={{ ...barTrackStyle, marginBottom: 14 }}>
                                <div style={{ ...barFillStyle, width: `${usagePct}%`, background: willHitCap ? "var(--warn)" : "var(--ink)" }} />
                            </div>
                            <div style={comparisonRow}>
                                <span style={comparisonLabel}>{recommended.name} (€{recommended.priceEur}/mo)</span>
                                <span style={{ ...comparisonValue, color: "var(--success)" }}>
                                    {used.toLocaleString()} / {recommended.images.toLocaleString()}
                                </span>
                            </div>
                            <div style={barTrackStyle}>
                                <div style={{ ...barFillStyle, width: `${(used / recommended.images) * 100}%`, background: "var(--success)" }} />
                            </div>
                            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-3)", textAlign: "right" }}>
                                {Math.round(recommended.images / Math.max(1, limit))}× the headroom
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="h-display" style={headlineStyle}>
                            Pick the plan that fits your volume.
                        </div>
                        <p style={{ margin: "8px 0 18px", fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
                            Drag the slider to your monthly upload volume — we&apos;ll suggest the right plan.
                        </p>
                    </>
                )}

                {/* Mini calculator (always visible) */}
                <div style={calcBoxStyle}>
                    <div style={calcLabelRow}>
                        <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>
                            Monthly photos:
                        </span>
                        <strong style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 14, color: "var(--ink)" }}>
                            {sliderValue.toLocaleString()}
                        </strong>
                    </div>
                    <input
                        type="range"
                        min={100}
                        max={50_000}
                        step={100}
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                        style={sliderStyle}
                        aria-label="Monthly photo uploads"
                    />
                    <div style={calcResultStyle}>
                        <div>
                            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>You&apos;d need</div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{planForVolume.name}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>From</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                                €{Math.round(yearlyAnnual / 12)}<span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>/mo</span>
                            </div>
                            <div style={{ fontSize: 10, color: "var(--success)", fontFamily: "var(--font-geist-mono), monospace" }}>
                                annual · save 20%
                            </div>
                        </div>
                    </div>
                </div>

                {/* CTAs */}
                <div style={ctaRowStyle}>
                    <Link
                        href={`/webp/activate?plan=${planForVolume.code}&billing=annual`}
                        style={ctaPrimary}
                    >
                        Try {planForVolume.name} — 7 days free →
                    </Link>
                    <Link href="/webp#pricing" style={ctaGhost}>
                        Compare all plans
                    </Link>
                </div>

                <div style={trustRowStyle}>
                    <span>✓ 30-day money back</span>
                    <span>✓ Cancel anytime</span>
                </div>
            </div>
        </div>
    );
}

const cardStyle: React.CSSProperties = {
    position: "relative",
    padding: 22,
    borderRadius: 12,
    background: "linear-gradient(180deg, var(--surface) 0%, color-mix(in oklab, var(--ink) 3%, var(--surface)) 100%)",
    border: "1px solid var(--line-2)",
    overflow: "hidden",
};
const accentBarStyle: React.CSSProperties = {
    position: "absolute", top: 0, left: 0, right: 0,
    height: 3,
    background: "linear-gradient(90deg, var(--success), #2a57e6)",
};
const headlineStyle: React.CSSProperties = {
    marginTop: 10,
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "var(--ink)",
    lineHeight: 1.3,
};
const comparisonStyle: React.CSSProperties = { marginTop: 14 };
const comparisonRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline",
    fontSize: 11.5, marginBottom: 4,
};
const comparisonLabel: React.CSSProperties = { color: "var(--ink-3)" };
const comparisonValue: React.CSSProperties = {
    fontFamily: "var(--font-geist-mono), monospace",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
};
const barTrackStyle: React.CSSProperties = {
    height: 5, background: "var(--bg-2)", borderRadius: 999, overflow: "hidden",
};
const barFillStyle: React.CSSProperties = {
    height: "100%", borderRadius: 999, transition: "width 600ms cubic-bezier(.16,1,.3,1)",
};
const calcBoxStyle: React.CSSProperties = {
    marginTop: 16,
    padding: "14px 14px 12px",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--bg)",
};
const calcLabelRow: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8,
};
const sliderStyle: React.CSSProperties = {
    width: "100%",
    height: 4,
    appearance: "none" as React.CSSProperties["appearance"],
    background: "var(--bg-2)",
    borderRadius: 2,
    outline: "none",
    cursor: "grab",
};
const calcResultStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)",
};
const ctaRowStyle: React.CSSProperties = {
    marginTop: 16,
    display: "flex", flexDirection: "column", gap: 8,
};
const ctaPrimary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 38, padding: "0 16px",
    borderRadius: 8,
    background: "var(--ink)", color: "var(--bg)",
    fontSize: 13.5, fontWeight: 500,
    textDecoration: "none",
    transition: "transform .15s",
};
const ctaGhost: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 32,
    color: "var(--ink-2)",
    fontSize: 12.5,
    textDecoration: "none",
};
const trustRowStyle: React.CSSProperties = {
    marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)",
    display: "flex", justifyContent: "space-between",
    fontSize: 11, color: "var(--ink-3)",
    fontFamily: "var(--font-geist-mono), monospace",
};
