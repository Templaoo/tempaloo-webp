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
    const pct = license.plan.imagesPerMonth === -1
        ? 10
        : Math.min(100, license.plan.imagesPerMonth > 0 ? (license.quota.imagesUsed / license.plan.imagesPerMonth) * 100 : 0);

    const slotsLabel = license.plan.maxSites === -1
        ? `${sites.length} active`
        : `${sites.length} / ${license.plan.maxSites}`;
    const slotsFull = license.plan.maxSites !== -1 && sites.length >= license.plan.maxSites;

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

    const copy = async () => {
        await navigator.clipboard.writeText(license.licenseKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="glass-strong rounded-2xl p-6 md:p-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">{license.plan.name}</h3>
                        <StatusPill status={license.status} />
                        {license.billing !== "free" && (
                            <span className="text-xs rounded-full bg-white/10 px-2 py-0.5 text-white/70 capitalize">{license.billing}</span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-white/60">
                        Since {new Date(license.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                </div>
                {license.plan.code === "free" && (
                    <a
                        href="/webp/activate?plan=growth"
                        className="inline-flex h-9 items-center px-3 rounded-lg bg-gradient-to-r from-brand-500 to-purple-500 text-white text-xs font-semibold glow"
                    >
                        Upgrade →
                    </a>
                )}
            </div>

            <div className="mt-6 grid md:grid-cols-[auto_1fr] gap-8 items-start">
                <QuotaGauge used={license.quota.imagesUsed} limit={license.plan.imagesPerMonth} pct={pct} />

                <div className="min-w-0 space-y-5">
                    <div>
                        <div className="text-xs uppercase tracking-wider text-white/50 mb-2">License key</div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 font-mono text-xs break-all rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white/90">
                                {revealed ? license.licenseKey : masked}
                            </code>
                            <button
                                onClick={() => setRevealed((v) => !v)}
                                className="h-9 w-9 rounded-lg glass hover:bg-white/10 flex items-center justify-center"
                                title={revealed ? "Hide" : "Reveal"}
                                aria-label={revealed ? "Hide key" : "Reveal key"}
                            >
                                {revealed ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                            <button
                                onClick={copy}
                                className="h-9 px-3 rounded-lg bg-white text-ink-950 text-xs font-semibold"
                            >
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between text-xs text-white/60 mb-1.5">
                            <span>Sites ({slotsLabel})</span>
                            {slotsFull && (
                                <span className="rounded-full bg-amber-500/15 text-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                                    Limit reached
                                </span>
                            )}
                        </div>
                        {sites.length === 0 ? (
                            <div className="text-sm text-white/50 rounded-lg border border-dashed border-white/15 px-3 py-3">
                                No site activated yet. Paste the key into your plugin to claim this license.
                            </div>
                        ) : (
                            <ul className="space-y-1.5">
                                {sites.map((s) => (
                                    <li
                                        key={s.host}
                                        className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-white/90 truncate">{s.host}</div>
                                            <div className="text-xs text-white/50 mt-0.5">
                                                {s.lastSeenAt
                                                    ? `active ${timeAgo(new Date(s.lastSeenAt))}`
                                                    : "waiting first request"}
                                                {errorHost === s.host && (
                                                    <span className="ml-2 text-rose-300">— deactivate failed, try again</span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deactivate(s.host)}
                                            disabled={removing === s.host}
                                            className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium text-white/70 hover:text-rose-200 hover:bg-rose-500/10 border border-white/10 hover:border-rose-400/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Free up this slot"
                                        >
                                            {removing === s.host ? "Removing…" : "Deactivate"}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {slotsFull && (
                            <p className="mt-2 text-xs text-white/50">
                                Deactivate one to add a new site, or{" "}
                                <a href="/webp/activate?plan=growth" className="text-brand-300 hover:underline">upgrade for more slots</a>.
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
    const size = 140;
    const r = size / 2 - 8;
    const c = 2 * Math.PI * r;
    const dash = (pct / 100) * c;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="url(#dashgrad)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${c - dash}`}
                    style={{ transition: "stroke-dasharray 600ms ease" }}
                />
                <defs>
                    <linearGradient id="dashgrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-white tabular-nums">{used.toLocaleString()}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/50 mt-0.5">
                    of {unlimited ? "∞" : limit.toLocaleString()}
                </div>
                <div className="text-[11px] text-white/50 mt-0.5">this month</div>
            </div>
        </div>
    );
}

function StatusPill({ status }: { status: string }) {
    const s = {
        active:   { text: "Active",   bg: "bg-emerald-500/15", fg: "text-emerald-300" },
        trialing: { text: "Trialing", bg: "bg-blue-500/15",    fg: "text-blue-300" },
        past_due: { text: "Past due", bg: "bg-amber-500/15",   fg: "text-amber-300" },
        canceled: { text: "Canceled", bg: "bg-white/10",       fg: "text-white/60" },
        expired:  { text: "Expired",  bg: "bg-rose-500/15",    fg: "text-rose-300" },
    }[status] ?? { text: status, bg: "bg-white/10", fg: "text-white/60" };
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.fg}`}>{s.text}</span>;
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
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}
function EyeOffIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}
