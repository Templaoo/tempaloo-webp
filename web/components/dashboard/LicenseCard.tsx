"use client";
import { useState } from "react";

export interface DashLicense {
    id: string;
    licenseKey: string;
    status: string;
    billing: string;
    plan: {
        code: string;
        name: string;
        imagesPerMonth: number;
        maxSites: number;
        supportsAvif: boolean;
    };
    quota: {
        imagesUsed: number;
        imagesLimit: number;
        imagesRemaining: number;
    };
    sites: { url: string; host: string; lastSeenAt: string | null }[];
    currentPeriodEnd: string | null;
    createdAt: string;
}

export function LicenseCard({ license }: { license: DashLicense }) {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sites, setSites] = useState(license.sites);
    const [removing, setRemoving] = useState<string | null>(null);
    const [errorHost, setErrorHost] = useState<string | null>(null);

    const masked = `${license.licenseKey.slice(0, 8)}${"•".repeat(24)}${license.licenseKey.slice(-8)}`;
    const unlimited = license.plan.imagesPerMonth === -1;
    const pct = unlimited
        ? 8
        : Math.min(100, license.plan.imagesPerMonth > 0 ? (license.quota.imagesUsed / license.plan.imagesPerMonth) * 100 : 0);

    const slotsLabel = license.plan.maxSites === -1 ? `${sites.length} active` : `${sites.length} / ${license.plan.maxSites}`;
    const slotsFull = license.plan.maxSites !== -1 && sites.length >= license.plan.maxSites;

    const copy = async () => {
        await navigator.clipboard.writeText(license.licenseKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const deactivate = async (host: string) => {
        if (!confirm(`Deactivate ${host}? The plugin on this site will stop converting until reactivated.`)) return;
        setRemoving(host);
        setErrorHost(null);
        try {
            const res = await fetch("/api/sites/deactivate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ licenseId: license.id, siteHost: host }),
            });
            if (!res.ok && res.status !== 204) {
                const data = await res.json().catch(() => null);
                throw new Error((data && data.error) || `Deactivate failed (${res.status})`);
            }
            setSites((cur) => cur.filter((s) => s.host !== host));
        } catch (e) {
            setErrorHost(host);
            console.error(e);
        } finally {
            setRemoving(null);
        }
    };

    return (
        <div className="surface-card" style={{ padding: "24px 24px 22px" }}>
            <style dangerouslySetInnerHTML={{ __html: licenseCardCss }} />

            <div className="lc-head">
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>
                            {license.plan.name}
                        </h3>
                        <StatusPill status={license.status} />
                        {license.billing !== "free" && (
                            <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                · {license.billing}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>
                        Since {new Date(license.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                </div>
                {license.plan.code === "free" && (
                    <a href="/webp/activate?plan=growth" className="btn btn-primary btn-sm">
                        Upgrade →
                    </a>
                )}
            </div>

            <div className="lc-body">
                <QuotaGauge used={license.quota.imagesUsed} limit={license.plan.imagesPerMonth} pct={pct} />

                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                        <div className="eyebrow" style={{ marginBottom: 8 }}>License key</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <code className="font-mono" style={{ flex: 1, fontSize: 12, padding: "9px 12px", border: "1px solid var(--line-2)", borderRadius: 7, background: "var(--bg-2)", color: "var(--ink)", wordBreak: "break-all" }}>
                                {revealed ? license.licenseKey : masked}
                            </code>
                            <button onClick={() => setRevealed((v) => !v)} className="btn btn-ghost" style={{ width: 36, height: 36, padding: 0, borderRadius: 7 }} aria-label={revealed ? "Hide key" : "Reveal key"}>
                                {revealed ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                            <button onClick={copy} className="btn btn-primary btn-sm" style={{ minWidth: 68 }}>
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <span className="eyebrow">Sites ({slotsLabel})</span>
                            {slotsFull && (
                                <span className="font-mono" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(245, 165, 36, 0.15)", color: "var(--warn)", fontWeight: 500 }}>
                                    LIMIT REACHED
                                </span>
                            )}
                        </div>
                        {sites.length === 0 ? (
                            <div style={{ fontSize: 13, color: "var(--ink-3)", border: "1px dashed var(--line-2)", borderRadius: 7, padding: "12px 14px" }}>
                                No site activated yet. Paste the key into your plugin to claim this license.
                            </div>
                        ) : (
                            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                                {sites.map((s) => (
                                    <li key={s.host} className="surface-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.host}</div>
                                            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                                                {s.lastSeenAt ? `active ${timeAgo(new Date(s.lastSeenAt))}` : "waiting first request"}
                                                {errorHost === s.host && <span style={{ marginLeft: 8, color: "var(--danger)" }}>— retry</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deactivate(s.host)}
                                            disabled={removing === s.host}
                                            className="btn btn-ghost btn-sm"
                                            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                                        >
                                            {removing === s.host ? "Removing…" : "Deactivate"}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {slotsFull && (
                            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
                                Deactivate one to add a new site, or <a href="/webp/activate?plan=growth" style={{ color: "var(--ink)", fontWeight: 500, textDecoration: "underline" }}>upgrade for more slots</a>.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function QuotaGauge({ used, limit, pct }: { used: number; limit: number; pct: number }) {
    const unlimited = limit === -1;
    const size = 132;
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const dash = (pct / 100) * c;
    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="8" fill="none" />
                <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--ink)" strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} style={{ transition: "stroke-dasharray 500ms ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div className="h-display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.04em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                    {used.toLocaleString()}
                </div>
                <div className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, letterSpacing: "0.02em" }}>
                    of {unlimited ? "∞" : limit.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>this month</div>
            </div>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const map: Record<string, { text: string; bg: string; fg: string }> = {
        active:   { text: "Active",   bg: "rgba(23, 201, 100, 0.15)", fg: "var(--success)" },
        trialing: { text: "Trialing", bg: "var(--accent-wash)",       fg: "var(--ink)"     },
        past_due: { text: "Past due", bg: "rgba(245, 165, 36, 0.15)", fg: "var(--warn)"    },
        canceled: { text: "Canceled", bg: "var(--bg-2)",              fg: "var(--ink-3)"   },
        expired:  { text: "Expired",  bg: "rgba(229, 72, 77, 0.15)",  fg: "var(--danger)"  },
    };
    const s = map[status] ?? { text: status, bg: "var(--bg-2)", fg: "var(--ink-3)" };
    return (
        <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: s.bg, color: s.fg, fontWeight: 500, letterSpacing: "0.01em" }}>
            {s.text}
        </span>
    );
}

function timeAgo(d: Date): string {
    const diff = Date.now() - d.getTime();
    const mins = Math.round(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

function EyeIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function EyeOffIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}

const licenseCardCss = `
.lc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.lc-body { display: grid; grid-template-columns: 132px 1fr; gap: 28px; align-items: start; }
@media (max-width: 640px) {
  .lc-body { grid-template-columns: 1fr; }
}
`;
