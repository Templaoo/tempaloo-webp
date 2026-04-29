import { useEffect, useMemo, useState } from "react";
import { api, boot, fetchPlans, type AppState, type Plan } from "./api";
import { Badge, SkeletonStyles, Tabs, Toasts, toast } from "./components/ui";
import { LicenseAlertBanner } from "./components/LicenseAlertBanner";
import Overview from "./pages/Overview";
import Bulk from "./pages/Bulk";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";
import Activity from "./pages/Activity";
import Sites from "./pages/Sites";

type Tab = "overview" | "bulk" | "activity" | "sites" | "settings" | "upgrade";

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

/**
 * Account chip — shows the subscriber's email next to the plan badge so
 * the site owner immediately knows WHICH Tempaloo account this site is
 * tied to. Click → opens the dashboard. Tooltip shows the full email
 * (truncated visually for narrow viewports).
 */
function AccountChip({ email, plan }: { email: string; plan: string }) {
    const initial = email.trim()[0]?.toUpperCase() ?? "?";
    return (
        <a
            href="https://tempaloo.com/webp/dashboard"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white pr-3 pl-1 py-0.5 text-[12px] font-medium text-ink-700 hover:border-ink-400 hover:text-ink-900 transition-colors"
            title={`Signed in as ${email} · ${plan} plan — click to open the web dashboard`}
        >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 text-[10px] font-semibold text-white">
                {initial}
            </span>
            <span className="max-w-[180px] truncate">{email}</span>
        </a>
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
            <SkeletonStyles />

            {/* In-plugin license-inactive banner — always visible (no dismiss).
                The dismissable surface is the global wp-admin notice. */}
            <LicenseAlertBanner status={state.license.status} />

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
                    {state.license.email && (
                        <AccountChip email={state.license.email} plan={planLabel} />
                    )}
                    <a
                        className="text-xs font-medium text-ink-500 hover:text-ink-900"
                        href="https://tempaloo.com/webp/dashboard"
                        target="_blank"
                        rel="noopener"
                        title="Open the web dashboard — sign in if needed"
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
                            { value: "activity", label: "Activity", icon: <IconActivity /> },
                            // Sites tab only shown when the plan allows multiple sites
                            ...(state.license.valid && state.license.sitesLimit !== 1
                                ? [{ value: "sites" as Tab, label: "Sites", icon: <IconSites /> }]
                                : []),
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
                    {tab === "overview" && <Overview
                        state={state}
                        onState={setState}
                        freeQuota={freeQuota}
                        onGoToUpgrade={() => setTab("upgrade")}
                        onGoToBulk={() => setTab("bulk")}
                        onGoToActivity={() => setTab("activity")}
                    />}
                    {tab === "bulk"     && <Bulk state={state} onUpgrade={() => setTab("upgrade")} />}
                    {tab === "activity" && <Activity />}
                    {tab === "sites"    && <Sites state={state} onUpgrade={() => setTab("upgrade")} />}
                    {tab === "settings" && <Settings state={state} onState={setState} />}
                    {tab === "upgrade"  && <Upgrade state={state} />}
                </main>
            </div>
        </div>
    );
}

function Logo() {
    // Canonical Tempaloo brand mark — same geometric T as the public web
    // app's LogoMark variant="brand". currentColor keeps it theme-neutral.
    return (
        <svg
            width="36"
            height="36"
            viewBox="334 334 1380 1380"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Tempaloo"
            className="text-ink-900"
        >
            <path
                fill="currentColor"
                transform="translate(334,334)"
                d="m0 0h29l25 2 36 6 30 7 37 12 29 12 29 14 24 14 24 16 16 12 16 13 11 9 7 7 8 7 15 15 7 8 13 15 13 17 13 18 12 19 12 21 9 17 13 30 10 27 9 31 7 34 5 36 1 14 3-34 6-35 8-32 12-36 13-30 8-16 10-19 12-19 10-15 12-16 8-10 12-14 7-8 12-13 5-5h2v-2l8-7 14-13 28-22 27-18 15-9 24-13 21-10 28-11 30-10 33-8 36-6 27-2h489v461l-875 1 30 4 31 6 26 7 27 9 29 12 32 16 20 12 22 15 16 12 10 8 13 11 13 12 27 27 9 11 12 14 14 19 18 27 14 26 14 28 9 24 10 30 7 27 6 29 4 28 2 26v478h-460v-919h-460z"
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
function IconActivity() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12 H7 L10 4 L14 20 L17 12 H21" />
        </svg>
    );
}
function IconSites() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12 H21 M12 3 C8 8 8 16 12 21 M12 3 C16 8 16 16 12 21" />
        </svg>
    );
}
