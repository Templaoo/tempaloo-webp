"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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
    /** Last 30 days of usage, gap-filled client-side. */
    daily30?: { day: string; n: number }[];
    currentPeriodEnd: string | null;
    createdAt: string;
}

export function LicenseCard({ license }: { license: DashLicense }) {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [sites, setSites] = useState(license.sites);
    const [removing, setRemoving] = useState<string | null>(null);
    const [errorHost, setErrorHost] = useState<string | null>(null);
    const [confirmHost, setConfirmHost] = useState<string | null>(null);

    // Lock body scroll while the deactivate modal is open
    useEffect(() => {
        if (!confirmHost) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setConfirmHost(null); };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [confirmHost]);

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
        setConfirmHost(null);
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
                {/* Plan switch CTA — sensitive to current plan:
                      Free  → "Upgrade →" goes straight to /activate (Stripe-style overlay)
                      Paid  → "Change plan ↗" opens the Freemius portal where the user
                              can upgrade or downgrade with proration. We deliberately
                              don't render an in-overlay downgrade flow because Freemius
                              handles refund/proration math better than we can mock. */}
                {license.plan.code === "free" ? (
                    <Link href="/webp/activate?plan=growth" className="btn btn-primary btn-sm" style={{ display: "inline-flex" }}>
                        Upgrade →
                    </Link>
                ) : (license.status === "active" || license.status === "trialing") && (
                    <a
                        href="https://users.freemius.com/"
                        target="_blank"
                        rel="noopener"
                        className="btn btn-ghost btn-sm"
                        style={{ display: "inline-flex" }}
                        title="Manage your subscription — change plan, update card, view invoices"
                    >
                        Change plan ↗
                    </a>
                )}
            </div>

            <div className="lc-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                    <QuotaGauge used={license.quota.imagesUsed} limit={license.plan.imagesPerMonth} pct={pct} />
                    {license.daily30 && license.daily30.some((d) => d.n > 0) && (
                        <Sparkline daily={license.daily30} />
                    )}
                </div>

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
                        {/* Add-site instruction — answers "I bought Growth, how do
                            I put it on my 2nd / 3rd / 4th site?" without leaving
                            the dashboard. Hidden when license is dead (no point
                            showing add-site copy on a canceled license). */}
                        {(license.status === "active" || license.status === "trialing") && license.plan.maxSites !== 1 && (
                            <AddSiteHint slotsAvailable={license.plan.maxSites === -1 || sites.length < license.plan.maxSites} />
                        )}
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
                                {sites.map((s) => {
                                    // 90 days without a ping = stale. Most likely the
                                    // user migrated/uninstalled and forgot to free the
                                    // slot. Surface it so they can deactivate before
                                    // they hit site-limit on a new install.
                                    const stale = s.lastSeenAt
                                        ? (Date.now() - new Date(s.lastSeenAt).getTime()) > 90 * 86_400_000
                                        : false;
                                    return (
                                    <li key={s.host} className="surface-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, ...(stale ? { borderColor: "color-mix(in oklab, var(--warn) 35%, var(--line))" } : {}) }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                <span style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{s.host}</span>
                                                {stale && (
                                                    <span className="font-mono" style={{ fontSize: 9.5, padding: "1px 6px", borderRadius: 4, background: "color-mix(in oklab, var(--warn) 18%, transparent)", color: "var(--warn)", letterSpacing: "0.04em", fontWeight: 500 }}>
                                                        STALE
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                                                {s.lastSeenAt ? `${stale ? "last seen" : "active"} ${timeAgo(new Date(s.lastSeenAt))}` : "waiting first request"}
                                                {errorHost === s.host && <span style={{ marginLeft: 8, color: "var(--danger)" }}>— retry</span>}
                                            </div>
                                        </div>
                                        <a
                                            href={wpAdminUrl(s.url, s.host)}
                                            target="_blank"
                                            rel="noopener"
                                            title="Open WP admin → Tempaloo WebP page"
                                            className="btn btn-ghost btn-sm"
                                            style={{ height: 28, padding: "0 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                                        >
                                            WP admin <span aria-hidden>↗</span>
                                        </a>
                                        <button
                                            onClick={() => setConfirmHost(s.host)}
                                            disabled={removing === s.host}
                                            className="btn btn-ghost btn-sm"
                                            style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                                        >
                                            {removing === s.host ? "Removing…" : "Deactivate"}
                                        </button>
                                    </li>
                                    );
                                })}
                            </ul>
                        )}
                        {slotsFull && (
                            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
                                Deactivate one to add a new site, or <Link href="/webp/activate?plan=growth" style={{ color: "var(--ink)", fontWeight: 500, textDecoration: "underline" }}>upgrade for more slots</Link>.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Deactivate confirmation modal — replaces window.confirm() */}
            {confirmHost && (
                <DeactivateModal
                    host={confirmHost}
                    onCancel={() => setConfirmHost(null)}
                    onConfirm={() => deactivate(confirmHost)}
                />
            )}
        </div>
    );
}

function DeactivateModal({ host, onCancel, onConfirm }: {
    host: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Deactivate site"
            style={{
                position: "fixed", inset: 0, zIndex: 100,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 16,
                animation: "lcModalIn 200ms ease forwards",
            }}
        >
            <button
                aria-label="Close"
                onClick={onCancel}
                style={{
                    position: "absolute", inset: 0,
                    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                    border: "none", cursor: "pointer", padding: 0,
                }}
            />
            <div
                style={{
                    position: "relative", width: "100%", maxWidth: 460,
                    background: "var(--surface)",
                    border: "1px solid var(--line-2)",
                    borderTop: "3px solid var(--danger)",
                    borderRadius: 14,
                    padding: "24px 26px",
                    boxShadow: "0 24px 48px -16px rgba(0,0,0,0.4)",
                    animation: "lcCardIn 240ms cubic-bezier(.16,1,.3,1) forwards",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em" }}>
                    Deactivate this site?
                </h3>
                <code className="font-mono" style={{
                    display: "block", marginTop: 10, padding: "8px 10px",
                    background: "var(--bg-2)", border: "1px solid var(--line)",
                    borderRadius: 6, fontSize: 12.5, color: "var(--ink)",
                    wordBreak: "break-all",
                }}>
                    {host}
                </code>
                <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
                    The plugin on this site will <strong>stop converting new uploads</strong> immediately.
                    Existing converted images stay where they are.
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                    Reactivate any time by re-entering the license key in the plugin.
                </p>
                <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                        onClick={onCancel}
                        style={{
                            height: 36, padding: "0 14px", borderRadius: 8,
                            background: "transparent", color: "var(--ink-2)",
                            border: "1px solid var(--line-2)",
                            fontSize: 13, fontWeight: 500, cursor: "pointer",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            height: 36, padding: "0 16px", borderRadius: 8,
                            background: "var(--danger)", color: "white",
                            border: "1px solid var(--danger)",
                            fontSize: 13, fontWeight: 500, cursor: "pointer",
                        }}
                    >
                        Deactivate site
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes lcModalIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes lcCardIn  {
                    from { opacity: 0; transform: translateY(8px) scale(0.96) }
                    to   { opacity: 1; transform: none }
                }
            `}</style>
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

/**
 * Compact 30-day sparkline. Gap-fills missing days, normalizes to the
 * card's left rail width, draws a smooth cubic-Bezier path so the
 * trend reads at a glance. Tooltip on hover via native <title>.
 */
function Sparkline({ daily }: { daily: { day: string; n: number }[] }) {
    // Build a contiguous 30-day window ending today, filling zeros.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const lookup = new Map(daily.map((d) => [d.day, d.n]));
    const points: { day: string; n: number }[] = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        points.push({ day: key, n: lookup.get(key) ?? 0 });
    }
    const max = Math.max(1, ...points.map((p) => p.n));
    const total7 = points.slice(-7).reduce((a, p) => a + p.n, 0);
    const W = 132, H = 36, PAD = 2;

    // Build the area + line path with smoothed segments
    const stepX = (W - PAD * 2) / (points.length - 1);
    const yFor = (n: number) => H - PAD - ((n / max) * (H - PAD * 2));
    const linePts = points.map((p, i) => [PAD + i * stepX, yFor(p.n)] as const);

    const linePath = linePts
        .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
        .join(" ");
    const areaPath = `${linePath} L ${linePts[linePts.length - 1][0]} ${H - PAD} L ${linePts[0][0]} ${H - PAD} Z`;

    return (
        <div style={{ width: 132, lineHeight: 1.2 }}>
            <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4, textAlign: "center" }}>
                30-day usage
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }} aria-label={`30-day usage sparkline · ${total7} converted in last 7 days`}>
                <defs>
                    <linearGradient id={`spark-grad-${daily.length}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="var(--success)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#spark-grad-${daily.length})`} />
                <path d={linePath} fill="none" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                {linePts.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={i === linePts.length - 1 ? 2.5 : 1.2} fill="var(--success)">
                        <title>{points[i].day} · {points[i].n} converted</title>
                    </circle>
                ))}
            </svg>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 2 }}>
                <strong style={{ color: "var(--ink)" }}>{total7.toLocaleString()}</strong> last 7 days
            </div>
        </div>
    );
}

/**
 * Build the WP admin deep-link to our settings page from a stored
 * site_url. Falls back to bare https://{host}/wp-admin/ if site_url
 * is malformed.
 */
function wpAdminUrl(siteUrl: string, host: string): string {
    try {
        const u = new URL(siteUrl);
        return `${u.origin}/wp-admin/admin.php?page=tempaloo-webp`;
    } catch {
        return `https://${host}/wp-admin/admin.php?page=tempaloo-webp`;
    }
}

function EyeIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function EyeOffIcon() {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}

/**
 * Tiny "how to use this on another site" reminder. Lives below the
 * key + Reveal/Copy controls so the natural reading order is:
 *   key → Copy button → instruction. Three-line callout so it stays
 * visually quiet but unmistakable when scanning the card.
 */
function AddSiteHint({ slotsAvailable }: { slotsAvailable: boolean }) {
    return (
        <div style={{
            marginTop: 10, padding: "10px 12px",
            background: "var(--bg-2)", border: "1px solid var(--line)",
            borderRadius: 7, fontSize: 12.5, color: "var(--ink-3)",
            lineHeight: 1.5,
        }}>
            <strong style={{ color: "var(--ink-2)" }}>Add to another site:</strong>{" "}
            {slotsAvailable ? (
                <>install <Link href="https://wordpress.org/plugins/tempaloo-webp/" target="_blank" rel="noopener" style={{ color: "var(--ink)", borderBottom: "1px solid var(--line-2)" }}>Tempaloo WebP</Link>, open the plugin&apos;s <strong style={{ color: "var(--ink-2)" }}>License</strong> tab, paste the key above and click <em>Activate</em>.</>
            ) : (
                <>your plan&apos;s site limit is reached. <Link href="#sites" style={{ color: "var(--ink)", borderBottom: "1px solid var(--line-2)" }}>Deactivate one below</Link> to free a slot, or upgrade for more sites.</>
            )}
        </div>
    );
}

const licenseCardCss = `
.lc-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.lc-body { display: grid; grid-template-columns: 132px 1fr; gap: 28px; align-items: start; }
@media (max-width: 640px) {
  .lc-body { grid-template-columns: 1fr; }
}
`;
