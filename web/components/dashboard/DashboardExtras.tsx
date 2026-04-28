"use client";

import { useEffect, useMemo, useState } from "react";
import type { DashLicense } from "./LicenseCard";

/* ──────────────────────────────────────────────────────────────────── */
/* 1. ThemeToggle — flips data-theme on <html>, persisted in localStorage */
/* ──────────────────────────────────────────────────────────────────── */
type Theme = "light" | "dark";

export function ThemeToggle() {
    const [theme, setTheme] = useState<Theme>("dark");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = (localStorage.getItem("tempaloo-theme") || document.documentElement.getAttribute("data-theme")) as Theme | null;
        if (stored === "light" || stored === "dark") setTheme(stored);
    }, []);

    const flip = () => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("tempaloo-theme", next); } catch { /* no-op */ }
    };

    if (!mounted) return <span style={{ width: 30, height: 30, display: "inline-block" }} aria-hidden />;

    return (
        <button
            type="button"
            onClick={flip}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{
                width: 30, height: 30, padding: 0,
                background: "transparent",
                border: "1px solid var(--line-2)",
                borderRadius: 7,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-2)",
                transition: "color .15s, background .15s, border-color .15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.background = "var(--bg-2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.background = "transparent"; }}
        >
            {theme === "dark" ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="3" />
                    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1.1 1.1M11.9 11.9L13 13M3 13l1.1-1.1M11.9 4.1L13 3" />
                </svg>
            ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.5 10.2A5.5 5.5 0 0 1 5.8 2.5 5.5 5.5 0 1 0 13.5 10.2z" />
                </svg>
            )}
        </button>
    );
}

/* ──────────────────────────────────────────────────────────────────── */
/* 2. ActivationConfetti — fires once per session when ?signup=1 lands  */
/* ──────────────────────────────────────────────────────────────────── */
export function ActivationConfetti({ signup }: { signup: boolean }) {
    const [active, setActive] = useState(false);
    useEffect(() => {
        if (!signup) return;
        if (typeof window === "undefined") return;
        const seenKey = "tempaloo-confetti-seen";
        if (sessionStorage.getItem(seenKey)) return;
        sessionStorage.setItem(seenKey, "1");
        // Respect reduced motion
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        setActive(true);
        const t = setTimeout(() => setActive(false), 2200);
        return () => clearTimeout(t);
    }, [signup]);

    if (!active) return null;

    const colors = ["#10b981", "#3b6cff", "#f59e0b", "#1e42b8", "#94a3b8", "#047857"];

    return (
        <div
            aria-hidden
            style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 100,
            }}
        >
            {Array.from({ length: 32 }, (_, i) => {
                const left = (i / 32) * 100 + (Math.random() - 0.5) * 6;
                const delay = Math.random() * 250;
                const duration = 1500 + Math.random() * 700;
                const rotate = Math.random() * 720 - 360;
                const w = 6 + Math.random() * 8;
                const h = 8 + Math.random() * 10;
                return (
                    <span
                        key={i}
                        style={{
                            position: "absolute",
                            top: -20,
                            left: `${left}%`,
                            width: w, height: h,
                            background: colors[i % colors.length],
                            borderRadius: 2,
                            opacity: 0,
                            animation: `tempalooDashConf ${duration}ms cubic-bezier(.16,1,.3,1) ${delay}ms forwards`,
                            ["--rot" as never]: `${rotate}deg`,
                        }}
                    />
                );
            })}
            <style>{`
                @keyframes tempalooDashConf {
                    0%   { opacity: 0; transform: translateY(-20px) rotate(0deg); }
                    8%   { opacity: 1; }
                    100% { opacity: 0; transform: translateY(105vh) rotate(var(--rot, 360deg)); }
                }
            `}</style>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────── */
/* 3. QuotaAlertBanner — fires when any license is at ≥80% usage        */
/* ──────────────────────────────────────────────────────────────────── */
export function QuotaAlertBanner({ licenses }: { licenses: DashLicense[] }) {
    const [dismissed, setDismissed] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined") return;
        const key = "tempaloo-quota-alert-dismissed";
        const until = Number(sessionStorage.getItem(key) || 0);
        setDismissed(Date.now() < until);
    }, []);

    const hot = licenses
        .filter((l) => l.plan.imagesPerMonth > 0 && l.quota.imagesUsed / l.plan.imagesPerMonth >= 0.8)
        .map((l) => ({
            license: l,
            pct: Math.round((l.quota.imagesUsed / l.plan.imagesPerMonth) * 100),
        }));

    if (dismissed || hot.length === 0) return null;

    const dismiss = () => {
        try { sessionStorage.setItem("tempaloo-quota-alert-dismissed", String(Date.now() + 8 * 3600 * 1000)); } catch { /* no-op */ }
        setDismissed(true);
    };

    const first = hot[0];

    return (
        <div
            role="alert"
            style={{
                position: "relative",
                marginBottom: 24,
                padding: "14px 18px 14px 18px",
                borderRadius: 12,
                border: "1px solid color-mix(in oklab, var(--warn) 35%, var(--line))",
                background: "linear-gradient(135deg, color-mix(in oklab, var(--warn) 10%, var(--bg)) 0%, var(--bg) 100%)",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
            }}
        >
            <span style={{ flexShrink: 0, marginTop: 1, color: "var(--warn)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
                    {hot.length === 1
                        ? `Your ${first.license.plan.name} license is at ${first.pct}% this month`
                        : `${hot.length} of your licenses are above 80% this month`}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.5 }}>
                    {hot.length === 1
                        ? `${first.license.quota.imagesUsed.toLocaleString()} of ${first.license.plan.imagesPerMonth.toLocaleString()} images used. Upgrade to avoid hitting the cap before the reset.`
                        : "Heads up — at this pace you'll hit the cap before the monthly reset."}
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                    <a
                        href="/webp#pricing"
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 13, fontWeight: 500, color: "var(--ink)",
                            borderBottom: "1px solid var(--ink-3)", paddingBottom: 1,
                            textDecoration: "none",
                        }}
                    >
                        See plans →
                    </a>
                    <button
                        onClick={dismiss}
                        style={{
                            background: "transparent", border: "none", cursor: "pointer",
                            fontSize: 12, color: "var(--ink-3)", padding: 0,
                        }}
                    >
                        Dismiss for 8h
                    </button>
                </div>
            </div>
            <button
                onClick={dismiss}
                aria-label="Dismiss"
                style={{
                    flexShrink: 0,
                    width: 24, height: 24,
                    background: "transparent", border: "none", cursor: "pointer",
                    color: "var(--ink-3)", fontSize: 14,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 4,
                }}
            >
                ×
            </button>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────── */
/* 4. LicenseFilter — only renders when there are 2+ licenses           */
/* ──────────────────────────────────────────────────────────────────── */
export type SortKey = "newest" | "oldest" | "usage-desc" | "usage-asc";
export type FilterPlan = "all" | "free" | "starter" | "growth" | "business" | "unlimited";

export function LicenseFilter({
    total, sort, onSort, filter, onFilter,
}: {
    total: number;
    sort: SortKey;
    onSort: (s: SortKey) => void;
    filter: FilterPlan;
    onFilter: (f: FilterPlan) => void;
}) {
    if (total < 2) return null;
    return (
        <div style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-geist-mono), monospace", letterSpacing: "0.02em" }}>
                {total} license{total > 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={lblStyle} htmlFor="lic-filter">Plan</label>
                <select id="lic-filter" value={filter} onChange={(e) => onFilter(e.target.value as FilterPlan)} style={selectStyle}>
                    <option value="all">All</option>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="business">Business</option>
                    <option value="unlimited">Unlimited</option>
                </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={lblStyle} htmlFor="lic-sort">Sort by</label>
                <select id="lic-sort" value={sort} onChange={(e) => onSort(e.target.value as SortKey)} style={selectStyle}>
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="usage-desc">Usage (high → low)</option>
                    <option value="usage-asc">Usage (low → high)</option>
                </select>
            </div>
        </div>
    );
}

const lblStyle: React.CSSProperties = {
    fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-geist-mono), monospace",
};
const selectStyle: React.CSSProperties = {
    height: 28, padding: "0 8px",
    borderRadius: 6, border: "1px solid var(--line-2)",
    background: "var(--surface)", color: "var(--ink)",
    fontSize: 12.5, fontFamily: "inherit",
    cursor: "pointer",
};

/**
 * Apply the filter + sort to the licenses array. Pure function so the
 * dashboard page can use it inside a useMemo or even at render time.
 */
export function applyLicenseFilter(licenses: DashLicense[], filter: FilterPlan, sort: SortKey): DashLicense[] {
    let out = filter === "all" ? licenses : licenses.filter((l) => l.plan.code === filter);
    out = [...out];
    switch (sort) {
        case "newest":
            out.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
            break;
        case "oldest":
            out.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
            break;
        case "usage-desc":
            out.sort((a, b) => b.quota.imagesUsed - a.quota.imagesUsed);
            break;
        case "usage-asc":
            out.sort((a, b) => a.quota.imagesUsed - b.quota.imagesUsed);
            break;
    }
    return out;
}

/* ──────────────────────────────────────────────────────────────────── */
/* 5. CsvExportButton — sites + usage breakdown for client invoicing    */
/* ──────────────────────────────────────────────────────────────────── */
export function CsvExportButton({ licenses }: { licenses: DashLicense[] }) {
    const exportable = licenses.length > 0 && licenses.some((l) => l.sites.length > 0 || l.quota.imagesUsed > 0);

    const onClick = () => {
        const rows: string[][] = [["license_id", "plan", "status", "site_host", "site_url", "last_seen_utc", "license_used_images", "license_limit", "created_utc"]];
        for (const l of licenses) {
            if (l.sites.length === 0) {
                rows.push([
                    l.id, l.plan.code, l.status, "", "", "",
                    String(l.quota.imagesUsed), String(l.plan.imagesPerMonth),
                    new Date(l.createdAt).toISOString(),
                ]);
            } else {
                for (const s of l.sites) {
                    rows.push([
                        l.id, l.plan.code, l.status, s.host, s.url,
                        s.lastSeenAt ? new Date(s.lastSeenAt).toISOString() : "",
                        String(l.quota.imagesUsed), String(l.plan.imagesPerMonth),
                        new Date(l.createdAt).toISOString(),
                    ]);
                }
            }
        }
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tempaloo-licenses-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!exportable}
            title={exportable ? "Download CSV (sites + usage per license)" : "Nothing to export yet"}
            style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 30, padding: "0 12px",
                borderRadius: 7,
                background: "transparent", color: exportable ? "var(--ink-2)" : "var(--ink-3)",
                border: "1px solid var(--line-2)",
                fontSize: 12.5, fontWeight: 500,
                cursor: exportable ? "pointer" : "not-allowed",
                opacity: exportable ? 1 : 0.55,
                transition: "color .15s, border-color .15s, background .15s",
            }}
            onMouseEnter={(e) => { if (exportable) { e.currentTarget.style.color = "var(--ink)"; e.currentTarget.style.borderColor = "var(--ink-3)"; } }}
            onMouseLeave={(e) => { if (exportable) { e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.borderColor = "var(--line-2)"; } }}
        >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4 V16 M7 11 L12 16 L17 11 M5 20 H19" />
            </svg>
            Export CSV
        </button>
    );
}

/* ──────────────────────────────────────────────────────────────────── */
/* 6. DashboardSkeleton — for the rare slow-network initial render      */
/* ──────────────────────────────────────────────────────────────────── */
export function DashboardSkeleton() {
    return (
        <div className="grid" style={{ gap: 24 }}>
            <SkeletonCard height={140} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <SkeletonCard height={84} />
                <SkeletonCard height={84} />
                <SkeletonCard height={84} />
                <SkeletonCard height={84} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 20 }}>
                <SkeletonCard height={320} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <SkeletonCard height={140} />
                    <SkeletonCard height={100} />
                    <SkeletonCard height={100} />
                </div>
            </div>
            <SkeletonStyles />
        </div>
    );
}

function SkeletonCard({ height }: { height: number }) {
    return (
        <div className="dash-skel" style={{ height, borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg-2)" }} aria-hidden />
    );
}

function SkeletonStyles() {
    return (
        <style>{`
            .dash-skel {
                background: linear-gradient(90deg, var(--bg-2) 0%, color-mix(in oklab, var(--ink) 6%, var(--bg-2)) 50%, var(--bg-2) 100%);
                background-size: 200% 100%;
                animation: dashSkel 1.4s ease-in-out infinite;
            }
            @keyframes dashSkel {
                from { background-position: 200% 0; }
                to   { background-position: -200% 0; }
            }
            @media (prefers-reduced-motion: reduce) {
                .dash-skel { animation: none; }
            }
        `}</style>
    );
}
