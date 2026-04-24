import { useEffect, useMemo, useState } from "react";
import { api, boot, fetchPlans, type AppState, type Plan } from "./api";
import { Badge, Tabs, Toasts, toast } from "./components/ui";
import Overview from "./pages/Overview";
import Bulk from "./pages/Bulk";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";

type Tab = "overview" | "bulk" | "settings" | "upgrade";

function daysUntil(iso: string): number | null {
    if (!iso) return null;
    const end = new Date(iso).getTime();
    if (!Number.isFinite(end)) return null;
    return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
}

function RetryQueueBanner({ state, onRunRetry, busy }: { state: AppState; onRunRetry: () => void; busy: boolean }) {
    const { pending, dueNow, nextRetryAt } = state.retryQueue;
    if (pending === 0) return null;

    const next = nextRetryAt
        ? Math.max(0, Math.ceil((nextRetryAt * 1000 - Date.now()) / 60000))
        : 0;
    const nextLabel = dueNow > 0
        ? "Some are due now"
        : next <= 1 ? "Next retry in <1 min" : `Next retry in ~${next} min`;

    return (
        <div className="mb-5 rounded-xl border border-sky-300 bg-gradient-to-br from-sky-50 to-sky-100/70 p-4 shadow-card">
            <div className="flex items-start gap-4">
                <div className="shrink-0 h-10 w-10 rounded-lg bg-sky-200 flex items-center justify-center text-sky-900">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 12a9 9 0 1 1-3-6.7" />
                        <polyline points="21 4 21 10 15 10" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-sky-900">
                        {pending} image{pending > 1 ? "s" : ""} queued for retry
                    </h3>
                    <p className="mt-1 text-sm text-sky-900/80">
                        These earlier uploads couldn't reach the API and will retry automatically. {nextLabel}.
                    </p>
                </div>
                <button
                    onClick={onRunRetry}
                    disabled={busy}
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {busy ? "Retrying…" : "Retry now"}
                </button>
            </div>
        </div>
    );
}

function ApiStatusChip({ ok }: { ok: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
            title={ok ? "API healthy" : "API unreachable"}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500 animate-pulse"}`} />
            API {ok ? "live" : "down"}
        </span>
    );
}

function ApiHealthBanner({ state, onRetry }: { state: AppState; onRetry: () => void }) {
    const h = state.apiHealth;
    if (h.ok || !h.failedAt) return null;

    const minsAgo = Math.max(0, Math.floor((Date.now() / 1000 - h.failedAt) / 60));
    const sinceLabel = minsAgo < 1 ? "just now" : minsAgo === 1 ? "1 min ago" : `${minsAgo} min ago`;

    return (
        <div className="mb-5 rounded-xl border border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100/70 p-4 shadow-card">
            <div className="flex items-start gap-4">
                <div className="shrink-0 h-10 w-10 rounded-lg bg-rose-200 flex items-center justify-center text-rose-900">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 12a9 9 0 1 0 9-9" />
                        <path d="M3 4v5h5" />
                        <line x1="12" y1="8" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-rose-900">Tempaloo API unreachable</h3>
                    <p className="mt-1 text-sm text-rose-900/80">
                        New uploads are stored as-is — no conversion until the API responds.
                        Last attempt failed {sinceLabel} ({h.code || "network error"}).
                        We'll auto-retry on the next upload.
                    </p>
                </div>
                <button
                    onClick={onRetry}
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition shadow-sm"
                >
                    Retry now
                </button>
            </div>
        </div>
    );
}

function QuotaBanner({ state, onUpgrade }: { state: AppState; onUpgrade: () => void }) {
    const days = useMemo(() => daysUntil(state.quota?.periodEnd ?? ""), [state.quota?.periodEnd]);
    if (!state.quotaExceededAt || state.quota === null) return null;
    if (state.quota.imagesRemaining > 0) return null;

    const resetLabel = days === null
        ? "at the start of next month"
        : days <= 1 ? "in less than a day" : `in ${days} days`;
    const planLabel = state.license.plan ? state.license.plan[0]!.toUpperCase() + state.license.plan.slice(1) : "Free";

    return (
        <div className="mb-5 rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/70 p-4 shadow-card">
            <div className="flex items-start gap-4">
                <div className="shrink-0 h-10 w-10 rounded-lg bg-amber-200 flex items-center justify-center text-amber-900">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-amber-900">Monthly quota reached</h3>
                        <Badge variant="warn">{planLabel} plan</Badge>
                    </div>
                    <p className="mt-1 text-sm text-amber-900/80">
                        New uploads are served as-is (no conversion) until your quota resets {resetLabel}.
                        Upgrade for instant access to more credits — your converted images are unaffected.
                    </p>
                </div>
                <button
                    onClick={onUpgrade}
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition shadow-sm"
                >
                    Upgrade
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export default function App() {
    const [state, setState] = useState<AppState>(boot.state);
    const [tab, setTab] = useState<Tab>("overview");
    const [retrying, setRetrying] = useState(false);
    // Cache plans at the root so every child (Overview banner, Upgrade grid)
    // gets the same copy without re-fetching. If the feed fails we fall back
    // to null everywhere — each component handles that gracefully.
    const [plans, setPlans] = useState<Plan[] | null>(null);

    useEffect(() => {
        let alive = true;
        fetchPlans()
            .then((all) => { if (alive) setPlans(all); })
            .catch(() => { /* silent — each consumer shows its own fallback */ });
        return () => { alive = false; };
    }, []);

    const freeQuota = plans?.find(p => p.code === "free")?.imagesPerMonth ?? null;

    const runRetry = async () => {
        setRetrying(true);
        try {
            const res = await api.runRetry();
            setState(res.state);
            const msg = res.ran === 0
                ? "Nothing to retry"
                : `${res.succeeded} converted · ${res.failed} still failing`;
            toast(res.failed === 0 && res.ran > 0 ? "success" : "info", msg);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Retry failed");
        } finally {
            setRetrying(false);
        }
    };

    const plan = state.license.valid ? state.license.plan : "free";
    const planLabel = plan ? plan[0]!.toUpperCase() + plan.slice(1) : "Free";

    return (
        <div className="tempaloo-wrap">
            <Toasts />

            {/* Top bar */}
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Logo />
                    <div>
                        <h1 className="text-xl font-semibold text-ink-900">Tempaloo WebP</h1>
                        <p className="text-xs text-ink-500">Image optimizer &amp; AVIF converter</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <ApiStatusChip ok={state.apiHealth.ok} />
                    <Badge variant={state.license.valid ? "brand" : "neutral"}>
                        {state.license.valid ? `${planLabel} plan` : "No license"}
                    </Badge>
                    <a
                        className="text-xs font-medium text-ink-500 hover:text-ink-900"
                        href="https://tempaloo.com/webp"
                        target="_blank"
                        rel="noopener"
                    >
                        Dashboard ↗
                    </a>
                </div>
            </header>

            {/* Sidebar + content */}
            <div className="grid grid-cols-[180px_1fr] gap-6 items-start">
                <aside className="sticky top-8">
                    <Tabs
                        value={tab}
                        onChange={setTab}
                        items={[
                            { value: "overview", label: "Overview", icon: <IconOverview /> },
                            { value: "bulk",     label: "Bulk",     icon: <IconBulk /> },
                            { value: "settings", label: "Settings", icon: <IconSettings /> },
                            { value: "upgrade",  label: "Upgrade",  icon: <IconUpgrade /> },
                        ]}
                    />
                    {!state.license.valid && (
                        <div className="mt-6 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white">
                            <div className="text-xs uppercase tracking-wider opacity-80">Free plan</div>
                            <div className="mt-1 text-sm font-semibold leading-tight">
                                {freeQuota === null
                                    ? "Free plan — no credit card."
                                    : `${freeQuota.toLocaleString()} images per month — no credit card.`}
                            </div>
                            <a
                                href={boot.activateUrl}
                                target="_blank"
                                rel="noopener"
                                className="mt-3 inline-flex text-xs font-medium rounded-md bg-white/20 hover:bg-white/30 px-2.5 py-1"
                            >
                                Get my key →
                            </a>
                        </div>
                    )}
                </aside>

                <main className="min-w-0">
                    <ApiHealthBanner
                        state={state}
                        onRetry={async () => {
                            try {
                                const next = await api.refreshState();
                                setState(next);
                                toast(next.apiHealth.ok ? "success" : "error",
                                    next.apiHealth.ok ? "API is back" : "Still unreachable");
                            } catch (e) {
                                toast("error", e instanceof Error ? e.message : "Refresh failed");
                            }
                        }}
                    />
                    <RetryQueueBanner state={state} onRunRetry={runRetry} busy={retrying} />
                    <QuotaBanner state={state} onUpgrade={() => setTab("upgrade")} />
                    {tab === "overview" && <Overview state={state} onState={setState} freeQuota={freeQuota} />}
                    {tab === "bulk"     && <Bulk state={state} onUpgrade={() => setTab("upgrade")} />}
                    {tab === "settings" && <Settings state={state} onState={setState} />}
                    {tab === "upgrade"  && <Upgrade state={state} />}
                </main>
            </div>
        </div>
    );
}

function Logo() {
    // Canonical Tempaloo brand mark, same SVG paths as the web app's
    // LogoMark variant="brand". `currentColor` keeps it theme-neutral
    // (renders black on WP admin's white chrome, dark accent at 35%).
    return (
        <svg
            width="36"
            height="36"
            viewBox="390 600 1130 860"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Tempaloo"
            className="text-ink-900"
        >
            <g fill="currentColor">
                <path d="m1200 621h288l-3 10-23 62-15 41-26 70-16 43-1 2-246 1-9 3-8 7-5 10-5 18-18 94-10 54-13 71-12 63-13 70-20 107-15 79-1 1-7 1h-187l-12-1 2-14 14-74 12-64 21-111 24-129 24-128 7-37 8-32 11-33 10-23 12-24 12-19 13-17 12-14 17-17 14-11 15-11 15-9 19-10 27-11 15-5 24-6 29-5z" />
                <path d="m746 621h315l-4 2-22 8-24 12-24 16-11 9-12 11-10 10-3 1-204 1-19 4-19 8-11 7-10 8-11 11-12 16-10 18-8 18 253-1-2 9-10 30-8 29-1 1h-319l6-35 7-28 9-27 8-18 10-20 10-16 10-14 12-14 12-12 11-9 18-12 15-8 22-8 21-5z" />
            </g>
            <path
                d="m1372 689h19l-1 6-19 51-13 34-1 1h-194l-18 2-16 5-14 7-12 9-12 12-9 14-7 15-6 18-6 28-14 74-18 95-23 122-17 90-15 80-2 7h-66l1-9 17-89 46-242 21-110 9-42 8-27 11-28 12-23 11-16 9-11 9-10 8-8 14-11 13-9 16-9 19-9 24-8 22-5 23-3z"
                fill="currentColor"
                opacity="0.35"
            />
        </svg>
    );
}
function IconOverview() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
    );
}
function IconBulk() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.22-8.56" />
            <polyline points="21 4 21 10 15 10" />
        </svg>
    );
}
function IconUpgrade() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" fillOpacity="0.15" />
        </svg>
    );
}
function IconSettings() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.14.46.56.99 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}
