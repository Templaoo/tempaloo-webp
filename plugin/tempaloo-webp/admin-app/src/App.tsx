import { useEffect, useMemo, useRef, useState } from "react";
import { api, boot, fetchPlans, type AppState, type Plan } from "./api";
import { Badge, SkeletonStyles, Tabs, Toasts, toast } from "./components/ui";
import { LicenseAlertBanner } from "./components/LicenseAlertBanner";
import Overview from "./pages/Overview";
import Bulk from "./pages/Bulk";
import Settings from "./pages/Settings";
import Upgrade from "./pages/Upgrade";
import Activity from "./pages/Activity";
import Sites from "./pages/Sites";
import Diagnostic from "./pages/Diagnostic";

type Tab = "overview" | "bulk" | "activity" | "sites" | "settings" | "upgrade" | "diagnostic";

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
                        {pending} image{pending > 1 ? "s" : ""} queued for retry — no need to wait
                    </h3>
                    <p className="mt-1 text-sm text-sky-900/80">
                        These uploads couldn't reach the API on the first try. WP-cron will retry them in the background every 5 min. {nextLabel}. We'll email you a summary the moment the queue is empty — feel free to close this tab.
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
 * Manual "sync now" — calls /tempaloo-webp/v1/refresh-license, which
 * re-runs /license/verify upstream and persists the latest plan +
 * status + email + supports_avif. Useful right after the user upgrades
 * their plan on tempaloo.com — the daily cron would catch up within
 * 24h, this lets them see the new plan immediately.
 */
function RefreshLicenseButton({ onUpdated }: { onUpdated: (s: AppState) => void }) {
    const [busy, setBusy] = useState(false);
    async function go() {
        if (busy) return;
        setBusy(true);
        try {
            const next = await api.refreshLicense();
            onUpdated(next);
            toast("success", "License synced");
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Sync failed");
        } finally {
            setBusy(false);
        }
    }
    return (
        <button
            onClick={go}
            disabled={busy}
            className="inline-flex items-center justify-center h-6 w-6 rounded-full text-ink-400 hover:text-ink-900 hover:bg-ink-50 transition-colors disabled:opacity-50"
            title="Sync license — pulls the latest plan + status from Tempaloo"
            aria-label="Sync license"
        >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className={busy ? "animate-spin" : ""}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a5 5 0 0 1 8.5-3.5L13 6M13 8a5 5 0 0 1-8.5 3.5L3 10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v3h-3M3 13v-3h3" />
            </svg>
        </button>
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

/**
 * Tiny pulsing dot shown next to the API status chip while a /state
 * refetch is in flight. Discreet on purpose — we don't want to flash
 * a big "Loading…" each 8 seconds, just signal that numbers are being
 * pulled from the server. Tooltip explains it.
 */
function RefreshingDot() {
    return (
        <span
            title="Syncing latest stats from the server"
            className="inline-flex items-center gap-1 text-[11px] text-ink-400"
            style={{ lineHeight: 1 }}
        >
            <span
                className="inline-block rounded-full bg-brand-500"
                style={{ width: 6, height: 6, animation: "tempaloo-pulse 1s ease-in-out infinite" }}
            />
            updating
        </span>
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
    // Subtle "updating…" indicator on the top-bar while polling, so users
    // see why their numbers tick up after a conversion without thinking
    // the page is broken.
    const [refreshing, setRefreshing] = useState(false);
    // Wall-clock of the last successful /state response. Drives the
    // "Updated Xs ago · ↻" pill on the Overview header so users have
    // a transparent signal when numbers might be stale and a one-click
    // way to force a refresh — without having to find the heavier
    // "Sync license" button (which also re-verifies the license).
    const [lastStateAt, setLastStateAt] = useState<number>(Date.now());
    // Manual-action lock for the polling.
    //
    // Bug it fixes: user pastes license key → activate succeeds → local
    // state shows valid=true → 4–8s later the polling tick (which had
    // a stale or in-flight request from before the activate) writes its
    // older snapshot back, flipping valid to false. UI "reverts" — looked
    // like activation failed, was actually a race.
    //
    // Solution: every manual action that mutates license/settings stamps
    // a timestamp into this ref. The polling skips its setState when a
    // manual action happened in the last 10s, so the polling can never
    // clobber a fresh user-driven change. After 10s the lock expires
    // and polling resumes normal merging.
    const lastManualUpdateRef = useRef<number>(0);
    const markManualUpdate = () => { lastManualUpdateRef.current = Date.now(); };

    // Wrap setState so any caller that flows through onState (Activate,
    // Disconnect, RefreshLicense, Settings save) stamps the lock for
    // free — no per-call boilerplate.
    const setStateLockingPolling: typeof setState = (next) => {
        markManualUpdate();
        setState(next);
    };
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

    /**
     * State refresh strategy — event-driven, NOT periodic.
     *
     * Earlier versions ran an 8-second polling tick. Users found that
     * cadence intrusive ("the page keeps refreshing on its own"), so
     * we replaced periodic polling with three event-driven triggers:
     *
     *   1. Tab switch — useEffect below, keyed on `tab`. Switching
     *      between Overview / Bulk / Activity / Settings / Sites /
     *      Upgrade refetches /state immediately.
     *   2. Window focus — visibilitychange listener. The user came
     *      back from another tab → they probably want fresh numbers.
     *   3. Post-action — explicit api.refreshState() call sites
     *      (Bulk completion, license activate / disconnect / refresh,
     *      retry queue run, settings save).
     *
     * Result: zero idle polling. The UI only re-fetches when there's
     * a strong signal that data may have changed. Quieter, cheaper.
     * Numbers stay fresh because every realistic "I just did something
     * that changed the data" path triggers a refresh.
     */
    /**
     * Single source of truth for "go fetch /state now". Called by the
     * three triggers below (visibility, tab change, periodic polling)
     * and by the on-screen "↻ Refresh" pill. Always updates
     * lastStateAt so the "Updated Xs ago" indicator stays honest even
     * when the response is silently dropped by the manual-update lock.
     *
     * Returns a promise so callers can chain UI feedback (toast,
     * disabled state) on completion.
     */
    const refreshNow = async () => {
        setRefreshing(true);
        try {
            const next = await api.refreshState();
            // Manual-update lock — a recent click (within 10s) takes
            // precedence over a polled refresh. We still record the
            // refresh attempt timestamp so the indicator updates;
            // dropping the setState only blocks the data clobber, not
            // the freshness signal.
            const sinceManual = Date.now() - lastManualUpdateRef.current;
            if (sinceManual >= 10_000) setState(next);
            setLastStateAt(Date.now());
        } catch {
            // Silent — next trigger will retry. We don't update
            // lastStateAt on failure so the user sees stale-time grow.
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        const onVis = () => {
            if (document.hidden) return;
            refreshNow();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Refresh on tab switch.
    //
    // Common path: user runs a bulk → switches to Overview to see the
    // results. Without this, the Overview would show whatever state
    // was last fetched (potentially stale). Triggering a fresh /state
    // fetch on every tab change gives ~200ms-fresh numbers everywhere
    // they actually look.
    useEffect(() => {
        refreshNow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    /**
     * Polling — Overview tab only, only while the page is actually
     * visible. Adaptive cadence:
     *   · Default 20s (no pending work).
     *   · Drops to 3s while async-pending count > 0, so the user sees
     *     the "this month" counter and savings catch up within seconds
     *     of an upload finishing — without hammering the API for a
     *     user who just keeps Overview open and walks away.
     *
     * Bulk has its own 350ms tick during a run; Settings / Activity /
     * Sites / Diagnostic / Upgrade are inherently short-lived views
     * users don't watch passively. Pauses on tab hide
     * (visibilitychange) and on tab navigate (effect cleanup).
     */
    const asyncPendingCount = state.asyncPending?.count ?? 0;
    useEffect(() => {
        if (tab !== "overview") return;
        const cadence = asyncPendingCount > 0 ? 3_000 : 20_000;
        const id = window.setInterval(() => {
            if (document.hidden) return;
            refreshNow();
        }, cadence);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, asyncPendingCount]);

    const freeQuota = plans?.find(p => p.code === "free")?.imagesPerMonth ?? null;

    const runRetry = async () => {
        setRetrying(true);
        try {
            const res = await api.runRetry();
            setStateLockingPolling(res.state);
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
                    {refreshing && <RefreshingDot />}
                    <Badge variant={state.license.valid ? "brand" : "neutral"}>
                        {state.license.valid ? `${planLabel} plan` : "No license"}
                    </Badge>
                    {state.license.email && (
                        <AccountChip email={state.license.email} plan={planLabel} />
                    )}
                    {state.license.key && (
                        <RefreshLicenseButton onUpdated={setStateLockingPolling} />
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
                            { value: "diagnostic", label: "Diagnostic", icon: <IconDiagnostic /> },
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
                            {/* Solid white bg + brand-700 text — guaranteed
                                AAA contrast on the gradient card. The previous
                                white/20 ghost button blended into the brand
                                gradient on dark themes. */}
                            <a
                                href={boot.activateUrl}
                                target="_blank"
                                rel="noopener"
                                className="mt-3 inline-flex items-center text-xs font-semibold rounded-md bg-white text-brand-700 hover:bg-brand-50 px-3 py-1.5 shadow-sm transition-colors"
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
                                setStateLockingPolling(next);
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
                        onState={setStateLockingPolling}
                        freeQuota={freeQuota}
                        refreshing={refreshing}
                        lastStateAt={lastStateAt}
                        onRefresh={refreshNow}
                        asyncPending={state.asyncPending?.count ?? 0}
                        onGoToUpgrade={() => setTab("upgrade")}
                        onGoToBulk={() => setTab("bulk")}
                        onGoToActivity={() => setTab("activity")}
                    />}
                    {tab === "bulk"     && <Bulk state={state} onState={setStateLockingPolling} onUpgrade={() => setTab("upgrade")} />}
                    {tab === "activity" && <Activity />}
                    {tab === "sites"    && <Sites state={state} onUpgrade={() => setTab("upgrade")} />}
                    {tab === "settings" && <Settings state={state} onState={setStateLockingPolling} />}
                    {tab === "upgrade"  && <Upgrade state={state} />}
                    {tab === "diagnostic" && <Diagnostic />}
                </main>
            </div>
        </div>
    );
}

function Logo() {
    // Canonical Tempaloo brand mark — synced with web/public/favicon.svg
    // and web/components/Logo.tsx LogoMark variant="brand". Source paths
    // from logos/logo templaoo (1).svg, transparent background.
    return (
        <svg
            width="40"
            height="40"
            viewBox="0 240 1560 1080"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Tempaloo"
            className="text-ink-900"
        >
            <path
                fill="currentColor"
                transform="translate(3,259)"
                d="m0 0h385l33 2 34 4 32 5 28 6 26 7 25 8 24 9 26 11 25 12 21 11 21 12 19 12 20 14 16 12 9 7 10 8 14 12 24 22 8 8 2 1v2h2l7 8 11 11 7 8 10 11 9 11 12 15 14 19 14 20 17 28 9 16 15 29 12 26 13 34 12 36 10 41 7 36 4 31 3 37v56l-4 44-4 27-7 34-10 37-13 38-11 27-11 25-12 26-13 28-14 30-16 34-11 24-1 1h-448l-1-2 13-28 17-35 13-28 16-34 17-36 16-34 9-20 18-38 16-34 19-41 17-36 16-34 12-26 19-40 16-34 13-28 18-38 13-28 15-31 3-8-480-1-5-6-13-22-16-28-9-15-17-29-15-26-10-17-12-21-13-22-15-26-8-13-11-20-14-23-15-26-16-27-15-26-10-17-10-18-6-11z"
            />
            <path
                fill="currentColor"
                transform="translate(884,259)"
                d="m0 0h446l8 13 16 28 13 22 17 29 16 28 15 25 13 22 13 23 17 29 17 28 15 27 14 24 17 29 13 22 14 24 10 18 2 4v4h-234l-33-2-27-4-23-5-33-10-21-8-20-9-28-15-17-11-17-12-12-9-10-9-8-7-7-7-8-7-9-9-7-8-11-13-10-13-13-18-13-21-12-21-15-26-12-21-12-20-11-19-34-58-20-34z"
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

function IconDiagnostic() {
    // Stethoscope-ish: a magnifying glass over a heart-rate line. Makes
    // the "look at the state" intent visually unambiguous next to the
    // other tabs that all use simpler shapes.
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12 H7 L9 7 L12 17 L14 12 H17" />
            <circle cx="19" cy="14" r="2" />
            <path d="M20.5 15.5 L22 17" />
        </svg>
    );
}
