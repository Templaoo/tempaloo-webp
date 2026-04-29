import { useEffect, useState } from "react";
import { api, ApiError, boot, formatBytes, type AppState } from "../api";
import { Badge, Button, Card, CardHeader, Input, Modal, PerformanceScorecard, QuotaRing, Skeleton, Stat, toast } from "../components/ui";

const NUDGE_DISMISS_KEY = "tempaloo_upgrade_nudge_dismissed_until";

/**
 * Overview tab — landing dashboard.
 *
 * Sprint 1 changes:
 *   - License key is locked & masked once active. A "Change" button opens a
 *     confirmation modal — kills the old footgun where users could wipe
 *     their key by tapping the input.
 *   - Smart upgrade nudge for engaged Free users (>=40% quota used), with
 *     30-day dismiss memory in localStorage so we don't pester users who
 *     said "no thanks".
 */
export default function Overview({ state, onState, freeQuota, refreshing = false, onGoToUpgrade, onGoToBulk, onGoToActivity }: {
    state: AppState;
    onState: (s: AppState) => void;
    freeQuota: number | null;
    /** True while App.tsx is fetching fresh state (tab-switch refresh
     *  or polling tick). Drives skeletons over the stat cards instead
     *  of leaving stale numbers on screen. */
    refreshing?: boolean;
    onGoToUpgrade?: () => void;
    onGoToBulk?: () => void;
    onGoToActivity?: () => void;
}) {
    const [key, setKey] = useState(state.license.key);
    const [activating, setActivating] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [nudgeDismissed, setNudgeDismissed] = useState(false);
    // When activation hits a site-limit error we show a dedicated
    // panel below the input (with deactivate + upgrade CTAs) instead
    // of a generic toast that disappears in 3s.
    const [activateError, setActivateError] = useState<{ code: string; message: string } | null>(null);

    // Keep the local input in sync if the parent state changes (e.g. after
    // activate, restore, or a bulk run that nukes the key remotely).
    useEffect(() => { setKey(state.license.key); }, [state.license.key]);

    useEffect(() => {
        try {
            const until = Number(localStorage.getItem(NUDGE_DISMISS_KEY) || 0);
            setNudgeDismissed(Date.now() < until);
        } catch { /* private mode */ }
    }, []);

    const activate = async () => {
        if (!key.trim()) { toast("error", "Enter a license key"); return; }
        setActivating(true);
        setActivateError(null);
        try {
            const next = await api.activate(key.trim());
            onState(next);
            toast({
                kind: "success",
                title: "License activated",
                text: `You're on the ${next.license.plan.toUpperCase()} plan.`,
                duration: 5000,
            });
            setChangeOpen(false);
        } catch (e) {
            const code = e instanceof ApiError ? e.code : "unknown";
            const message = e instanceof Error ? e.message : "Unknown error";
            // For site-limit specifically we render an inline panel
            // (see <SiteLimitPanel/> below) with deactivate + upgrade
            // CTAs that stay on screen — toast disappears too fast for
            // a "what do I do now" decision.
            if (code === "site_limit_reached" || code === "site_already_claimed") {
                setActivateError({ code, message });
            } else {
                toast({
                    kind: "error",
                    title: "Activation failed",
                    text: message,
                    action: { label: "Get a key", onClick: () => window.open(boot.activateUrl, "_blank") },
                });
            }
        } finally {
            setActivating(false);
        }
    };

    const dismissNudge = () => {
        const until = Date.now() + 30 * 24 * 3600 * 1000; // 30 days
        try { localStorage.setItem(NUDGE_DISMISS_KEY, String(until)); } catch { /* no-op */ }
        setNudgeDismissed(true);
    };

    const quota = state.quota;
    const limit = quota?.imagesLimit ?? state.license.imagesLimit;
    const used = quota?.imagesUsed ?? 0;
    const remaining = limit === -1 ? "∞" : Math.max(0, limit - used).toLocaleString();
    const usagePct = limit > 0 && limit !== -1 ? Math.min(100, (used / limit) * 100) : 0;
    const resetDate = quota?.periodEnd
        ? new Date(quota.periodEnd).toLocaleDateString(undefined, { day: "numeric", month: "short" })
        : "—";

    const isFree = state.license.plan === "free" || !state.license.valid;
    const showUpgradeNudge =
        state.license.valid && isFree && usagePct >= 40 && !nudgeDismissed;

    const maskedKey = state.license.key
        ? state.license.key.length > 12
            ? `${state.license.key.slice(0, 8)}${"•".repeat(20)}${state.license.key.slice(-4)}`
            : "•".repeat(state.license.key.length)
        : "";

    return (
        <div className="grid gap-6">
            {/* ─── Performance scorecard (hero) ──────────────────────────── */}
            {state.license.valid && (
                refreshing && (state.savings?.converted ?? 0) === 0 ? (
                    // First-load case: no savings yet but a refresh is in
                    // flight — skeleton instead of "0 converted" so the
                    // user doesn't think the bulk failed for the 200ms
                    // the round-trip takes.
                    <div className="rounded-xl border border-ink-200 bg-white p-6 space-y-4">
                        <Skeleton height={18} width={160} />
                        <div className="grid grid-cols-3 gap-4">
                            <Skeleton height={56} />
                            <Skeleton height={56} />
                            <Skeleton height={56} />
                        </div>
                        <Skeleton height={12} width="60%" />
                    </div>
                ) : (
                    <PerformanceScorecard
                        bytesIn={state.savings?.bytesIn ?? 0}
                        bytesOut={state.savings?.bytesOut ?? 0}
                        converted={state.savings?.converted ?? 0}
                    />
                )
            )}

            {/* ─── Activate (only when no valid license) ─────────────────── */}
            {!state.license.valid && (
                <ActivateHero
                    freeQuota={freeQuota}
                    activateUrl={boot.activateUrl}
                    pasteKey={key}
                    onPasteKeyChange={setKey}
                    onActivate={activate}
                    activating={activating}
                />
            )}
            {!state.license.valid && activateError?.code === "site_limit_reached" && (
                <SiteLimitPanel onGoToUpgrade={onGoToUpgrade} onDismiss={() => setActivateError(null)} />
            )}
            {!state.license.valid && activateError?.code === "site_already_claimed" && (
                <SiteAlreadyClaimedPanel onDismiss={() => setActivateError(null)} />
            )}

            {/* ─── Smart upgrade nudge (engaged Free users only) ─────────── */}
            {showUpgradeNudge && (
                <UpgradeNudge
                    used={used}
                    limit={limit}
                    onDismiss={dismissNudge}
                    onUpgrade={() => { onGoToUpgrade?.(); }}
                />
            )}

            {/* ─── Main 3-card row ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 flex flex-col items-center">
                    <CardHeader
                        title="This month"
                        right={
                            <Badge variant={state.license.valid ? "brand" : "neutral"}>
                                {state.license.valid ? state.license.plan.toUpperCase() : "No license"}
                            </Badge>
                        }
                    />
                    <QuotaRing used={used} limit={limit} />

                    {/* Plan capacity callout — explicit "X / Y per month" */}
                    {state.license.valid && (
                        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                            <span className="font-mono tabular-nums">
                                {limit === -1
                                    ? "Unlimited"
                                    : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
                            </span>
                            <span className="text-brand-600/70">
                                {limit === -1 ? "fair use 500k/mo" : "images this month"}
                            </span>
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 w-full text-center gap-2">
                        <div>
                            <div className="text-xs text-ink-500">Used</div>
                            <div className="font-semibold text-ink-900 tabular-nums">{used.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-ink-500">Left</div>
                            <div className="font-semibold text-ink-900 tabular-nums">{remaining}</div>
                        </div>
                        <div>
                            <div className="text-xs text-ink-500">Resets</div>
                            <div className="font-semibold text-ink-900">{resetDate}</div>
                        </div>
                    </div>

                    {/* Plan capacity bar — visual gauge of monthly allowance */}
                    {state.license.valid && limit > 0 && limit !== -1 && (
                        <div className="mt-4 w-full">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-1.5">
                                Plan capacity
                            </div>
                            <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-brand-500 transition-all duration-500"
                                    style={{ width: `${Math.min(100, usagePct)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-ink-400 font-mono mt-1">
                                <span>0</span>
                                <span>{Math.round(limit / 2).toLocaleString()}</span>
                                <span>{limit.toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader
                        title="Savings on your site"
                        description="Total bandwidth saved since conversion started."
                    />
                    {state.savings && state.savings.converted > 0 ? (
                        <div className="grid grid-cols-3 gap-6">
                            <Stat
                                label="Images converted"
                                value={state.savings.converted.toLocaleString()}
                                sub="attachments across all sizes"
                            />
                            <Stat
                                label="Original size"
                                value={formatBytes(state.savings.bytesIn)}
                            />
                            <Stat
                                label="After WebP"
                                value={<span className="text-emerald-600">{formatBytes(state.savings.bytesOut)}</span>}
                                sub={
                                    state.savings.bytesIn > 0
                                        ? `−${Math.round((1 - state.savings.bytesOut / state.savings.bytesIn) * 100)}% lighter`
                                        : undefined
                                }
                            />
                        </div>
                    ) : (
                        <div className="py-8 text-center text-sm text-ink-500">
                            No conversions yet. Head to <strong>Bulk</strong> or upload a new image.
                        </div>
                    )}
                </Card>
            </div>

            {/* ─── Quick actions ─────────────────────────────────────────── */}
            {state.license.valid && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <QuickAction
                        icon="↻"
                        title="Run Bulk"
                        sub="Convert your existing library"
                        onClick={() => onGoToBulk?.()}
                    />
                    <QuickAction
                        icon="≡"
                        title="View activity"
                        sub="Last 200 events · CSV export"
                        onClick={() => onGoToActivity?.()}
                    />
                    <QuickAction
                        icon="↗"
                        title="Open dashboard"
                        sub="Manage license · all sites"
                        href="https://tempaloo.com/webp/dashboard"
                    />
                </div>
            )}

            {/* ─── License panel (locked once valid) ─────────────────────── */}
            {state.license.valid && (
                <Card>
                    <CardHeader
                        title="License"
                        description="Your active license key — locked to prevent accidental edits."
                        right={
                            <Badge variant="success">
                                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                                Active
                            </Badge>
                        }
                    />
                    <div className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 flex items-center gap-3 flex-wrap">
                        <code className="text-xs font-mono text-ink-800 flex-1 min-w-0 truncate select-all">
                            {reveal ? state.license.key : maskedKey}
                        </code>
                        <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => setReveal(v => !v)}>
                                {reveal ? "Hide" : "Reveal"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                                navigator.clipboard?.writeText(state.license.key);
                                toast("success", "Copied");
                            }}>Copy</Button>
                            <Button variant="secondary" size="sm" onClick={() => setChangeOpen(true)}>
                                Change
                            </Button>
                            <Button variant="ghost" size="sm" onClick={async () => {
                                if (!confirm("Disconnect this site from Tempaloo? You can reconnect any time by re-entering a license key.")) return;
                                try {
                                    const next = await api.disconnectLicense();
                                    onState(next);
                                    toast("success", "Disconnected");
                                } catch (e) {
                                    toast("error", e instanceof Error ? e.message : "Disconnect failed");
                                }
                            }}>
                                Disconnect
                            </Button>
                        </div>
                    </div>
                    <div className="text-xs text-ink-500 mt-2">
                        Plan: <strong className="text-ink-700">{state.license.plan.toUpperCase()}</strong>
                        &nbsp;·&nbsp; Sites limit: <strong className="text-ink-700">{state.license.sitesLimit === -1 ? "Unlimited" : state.license.sitesLimit}</strong>
                        {state.license.supportsAvif && <> &nbsp;·&nbsp; <strong className="text-ink-700">AVIF enabled</strong></>}
                    </div>
                </Card>
            )}

            {/* ─── Change-license modal ──────────────────────────────────── */}
            <Modal
                open={changeOpen}
                onClose={() => setChangeOpen(false)}
                title="Change license key"
                description="The current site will be re-bound to the new license. Your existing converted images stay where they are."
                size="md"
            >
                <div className="space-y-3">
                    <Input
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Paste the new license key"
                        className="font-mono text-xs"
                        autoFocus
                    />
                    <p className="text-xs text-ink-500">
                        The current key (<code className="font-mono text-[11px]">{maskedKey}</code>) will be replaced.
                        If you only want to disconnect this site, use the <em>Sites</em> page on tempaloo.com instead.
                    </p>
                </div>
                <div className="flex justify-end gap-2 mt-5">
                    <Button variant="ghost" onClick={() => { setKey(state.license.key); setChangeOpen(false); }}>
                        Cancel
                    </Button>
                    <Button onClick={activate} loading={activating} disabled={!key.trim() || key.trim() === state.license.key}>
                        Verify & switch
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

/* ── Smart upgrade nudge ────────────────────────────────────────────── */
/**
 * Activation hero — replaces the previous 3-control row (input + Generate
 * + Activate) with a single brand CTA + progressive disclosure for users
 * who already have a key.
 *
 * Why one button:
 *   The two-step "go get a key, then come back and paste" was the
 *   slowest part of the funnel. Most users don't have a key yet —
 *   showing them an empty input first added a "what do I type?" beat.
 *   The new default is the action they actually want: generate a key.
 *
 * Animations (CSS only, no JS):
 *   · Gradient sheen sliding across on hover (fakes a real CTA's
 *     polish without a video file)
 *   · Soft scale + drop-shadow lift on hover
 *   · Sparkle SVG that gently rotates while idle (3 keyframes only,
 *     respects prefers-reduced-motion)
 *
 * Progressive disclosure:
 *   · "I already have a key →" text-link below the CTA
 *   · Click reveals the input + small Activate button below — same
 *     code path as before, just hidden until the user opts in.
 */
function ActivateHero({
    freeQuota, activateUrl, pasteKey, onPasteKeyChange, onActivate, activating,
}: {
    freeQuota: number | null;
    activateUrl: string;
    pasteKey: string;
    onPasteKeyChange: (v: string) => void;
    onActivate: () => void;
    activating: boolean;
}) {
    const [showPaste, setShowPaste] = useState(false);
    const quotaLabel = freeQuota !== null
        ? `${freeQuota.toLocaleString()} images / month, free forever`
        : "Free plan, no card required";

    return (
        <Card className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-50/40 border-brand-200">
            {/* Decorative blurred orbs in the background — pure CSS,
                fixed in place so they don't fight the content. */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-brand-300/30 blur-3xl" />
                <div className="absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-brand-400/20 blur-3xl" />
            </div>

            <div className="relative">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-ink-900">Activate Tempaloo WebP</h3>
                    <Badge variant="brand">Free</Badge>
                </div>
                <p className="text-sm text-ink-600 mb-5">
                    {quotaLabel}. Click below to create your free license — it takes 10 seconds.
                </p>

                <a
                    href={activateUrl}
                    target="_blank"
                    rel="noopener"
                    className="tempaloo-cta group relative inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-3.5 text-[15px] font-semibold text-white shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 overflow-hidden"
                >
                    <span className="tempaloo-cta-sheen" aria-hidden />
                    <SparkleIcon />
                    <span className="relative">Get my free license key</span>
                    <span className="relative inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
                </a>

                <div className="mt-4 text-xs text-ink-500">
                    {showPaste ? (
                        <button
                            type="button"
                            onClick={() => setShowPaste(false)}
                            className="text-ink-500 hover:text-ink-900 underline"
                        >
                            Cancel
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowPaste(true)}
                            className="text-ink-500 hover:text-ink-900 underline"
                        >
                            I already have a license key →
                        </button>
                    )}
                </div>

                {showPaste && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <Input
                            value={pasteKey}
                            onChange={(e) => onPasteKeyChange(e.target.value)}
                            placeholder="Paste your license key"
                            className="font-mono text-xs"
                            autoFocus
                        />
                        <Button onClick={onActivate} loading={activating}>
                            Activate
                        </Button>
                    </div>
                )}
            </div>

            <style>{`
                /* Sliding sheen effect — runs once on hover, gives the
                   button a polished "premium" feel without being noisy. */
                .tempaloo-cta-sheen {
                    position: absolute; inset: 0;
                    background: linear-gradient(
                        100deg,
                        transparent 25%,
                        rgba(255,255,255,0.35) 50%,
                        transparent 75%
                    );
                    background-size: 200% 100%;
                    background-position: -100% 0;
                    transition: background-position 0.65s cubic-bezier(.16,1,.3,1);
                    pointer-events: none;
                }
                .tempaloo-cta:hover .tempaloo-cta-sheen { background-position: 200% 0; }

                /* Sparkle gentle rotation (idle only — calms on hover so
                   the sheen takes the spotlight). */
                @keyframes tempaloo-sparkle-rot {
                    0%, 100% { transform: rotate(-6deg) scale(1); }
                    50%      { transform: rotate(6deg)  scale(1.1); }
                }
                .tempaloo-cta .tempaloo-sparkle {
                    animation: tempaloo-sparkle-rot 3s ease-in-out infinite;
                    transform-origin: center;
                }
                .tempaloo-cta:hover .tempaloo-sparkle { animation-play-state: paused; }

                @media (prefers-reduced-motion: reduce) {
                    .tempaloo-cta:hover { transform: none; }
                    .tempaloo-cta-sheen { display: none; }
                    .tempaloo-cta .tempaloo-sparkle { animation: none; }
                }
            `}</style>
        </Card>
    );
}

function SparkleIcon() {
    return (
        <svg
            className="tempaloo-sparkle relative"
            width="18" height="18" viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
        >
            <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" opacity="0.95"/>
            <circle cx="19" cy="5" r="1.4" opacity="0.7"/>
            <circle cx="5" cy="18" r="1" opacity="0.5"/>
        </svg>
    );
}

function UpgradeNudge({ used, limit, onDismiss, onUpgrade }: {
    used: number;
    limit: number;
    onDismiss: () => void;
    onUpgrade: () => void;
}) {
    // Project usage to end-of-month based on day-of-month.
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = Math.round((used / Math.max(1, dayOfMonth)) * daysInMonth);
    const willHitCap = projected >= limit;
    const dayCapHit = limit > 0 ? Math.ceil(limit / Math.max(1, used / dayOfMonth)) : 0;

    const usagePct = Math.min(100, (used / Math.max(1, limit)) * 100);
    const projectedPct = Math.min(100, (projected / Math.max(1, limit)) * 100);

    return (
        <Card className="relative bg-gradient-to-br from-brand-50 via-white to-amber-50/40 border-brand-200">
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss for 30 days"
                className="absolute top-3 right-3 h-7 w-7 rounded-md text-ink-400 hover:text-ink-700 hover:bg-white/60 transition flex items-center justify-center"
            >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M3 3 L13 13 M13 3 L3 13" />
                </svg>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
                <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-brand-700 mb-1">Heads up</div>
                    <h3 className="text-lg font-semibold text-ink-900 tracking-tight">
                        {willHitCap
                            ? `You'll hit the Free cap around day ${Math.min(daysInMonth, dayCapHit)}`
                            : `You're using Tempaloo actively`}
                    </h3>
                    <p className="text-sm text-ink-700 mt-1.5">
                        You've converted <strong>{used.toLocaleString()}</strong> of <strong>{limit.toLocaleString()}</strong> images this month
                        {willHitCap && <> — at this pace you'll reach the cap before reset.</>}
                    </p>

                    {/* Comparison bars */}
                    <div className="mt-4 space-y-3 max-w-md">
                        <BarRow
                            label="Free (current)"
                            usedPct={usagePct}
                            projPct={projectedPct}
                            text={`${used.toLocaleString()} / ${limit.toLocaleString()}`}
                            tone="warn"
                        />
                        <BarRow
                            label="Starter (+€5/mo)"
                            usedPct={(used / 5000) * 100}
                            projPct={Math.min(100, (projected / 5000) * 100)}
                            text={`${used.toLocaleString()} / 5,000 — 20× the headroom`}
                            tone="good"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2 md:items-end shrink-0">
                    <Button onClick={onUpgrade} className="whitespace-nowrap">
                        See pricing →
                    </Button>
                    <button onClick={onDismiss} className="text-xs text-ink-500 hover:text-ink-700 underline-offset-2 hover:underline">
                        Not now
                    </button>
                </div>
            </div>
        </Card>
    );
}

function BarRow({ label, usedPct, projPct, text, tone }: {
    label: string;
    usedPct: number;
    projPct: number;
    text: string;
    tone: "warn" | "good";
}) {
    const usedColor = tone === "warn" ? "bg-amber-500" : "bg-emerald-500";
    const projColor = tone === "warn" ? "bg-amber-300" : "bg-emerald-200";
    return (
        <div>
            <div className="flex justify-between text-[11px] text-ink-600 mb-1">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums font-mono">{text}</span>
            </div>
            <div className="relative h-2.5 rounded-full bg-ink-100 overflow-hidden">
                {/* projected layer behind */}
                <div className={`absolute inset-y-0 left-0 ${projColor} opacity-60`} style={{ width: `${Math.min(100, projPct)}%`, transition: "width 600ms cubic-bezier(.16,1,.3,1)" }} />
                {/* actual usage in front */}
                <div className={`absolute inset-y-0 left-0 ${usedColor}`} style={{ width: `${Math.min(100, usedPct)}%`, transition: "width 600ms cubic-bezier(.16,1,.3,1)" }} />
            </div>
        </div>
    );
}

function QuickAction({ icon, title, sub, onClick, href }: {
    icon: string;
    title: string;
    sub: string;
    onClick?: () => void;
    href?: string;
}) {
    const inner = (
        <>
            <div className="h-9 w-9 rounded-lg bg-brand-50 grid place-items-center text-brand-600 text-base font-semibold shrink-0 group-hover:bg-brand-100 transition">
                {icon}
            </div>
            <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition">{title}</div>
                <div className="text-xs text-ink-500 mt-0.5">{sub}</div>
            </div>
            <div className="text-ink-300 group-hover:text-brand-500 transition">→</div>
        </>
    );
    const className = "group flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3.5 hover:border-brand-300 hover:shadow-card transition cursor-pointer";
    if (href) {
        return <a href={href} target="_blank" rel="noopener" className={className}>{inner}</a>;
    }
    return <button type="button" onClick={onClick} className={`${className} w-full text-left`}>{inner}</button>;
}

/**
 * Inline panel for the "site_already_claimed" error path.
 *
 * Triggered when the user pastes a license_key that belongs to a
 * different Tempaloo account than the one that originally activated
 * this WordPress site. Anti-fraud rule: a site can only be linked to
 * ONE account at a time. Otherwise users would chain free quotas by
 * creating new accounts when one runs out.
 *
 * Honest UX: tell the user exactly why we blocked, and give them two
 * legitimate paths (use the original account, or contact support to
 * transfer ownership). Don't pretend the key is "invalid" — it isn't.
 */
function SiteAlreadyClaimedPanel({ onDismiss }: { onDismiss: () => void }) {
    return (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
                <span className="text-rose-600 text-base leading-none mt-0.5">🔒</span>
                <div className="flex-1 min-w-0">
                    <p className="m-0 text-sm font-semibold text-ink-900">
                        This site is already linked to another Tempaloo account
                    </p>
                    <p className="mt-1 mb-3 text-[13px] text-ink-700 leading-snug">
                        Each WordPress install can be linked to only one Tempaloo account.
                        Sign in to the original account that activated this site, or contact
                        support if you&apos;ve changed accounts and need to transfer ownership.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href="https://tempaloo.com/webp/dashboard"
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-700"
                        >
                            Open my dashboard ↗
                        </a>
                        <a
                            href="mailto:support@tempaloo.com?subject=Transfer%20site%20ownership"
                            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-900 hover:border-ink-400"
                        >
                            Contact support
                        </a>
                        <button
                            onClick={onDismiss}
                            className="ml-auto text-xs text-ink-500 hover:text-ink-900 underline"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Inline panel for the "site_limit_reached" error path.
 *
 * Toasts disappear in 3-5 seconds — too fast for a "what should I do
 * next" decision. This stays on screen with two clear paths:
 *   1. Free a slot — links to the dashboard's Sites tab where the user
 *      can deactivate one of their existing sites.
 *   2. Upgrade — jumps directly to the Upgrade tab in this plugin.
 *
 * The Upgrade jump is the primary CTA: site-limit hits are the
 * highest-intent upgrade trigger we have (the user actively WANTS
 * another site).
 */
function SiteLimitPanel({ onGoToUpgrade, onDismiss }: { onGoToUpgrade?: () => void; onDismiss: () => void }) {
    const dashUrl = "https://tempaloo.com/webp/dashboard";
    return (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
                <span className="text-amber-600 text-base leading-none mt-0.5">⚠</span>
                <div className="flex-1 min-w-0">
                    <p className="m-0 text-sm font-semibold text-ink-900">
                        Site limit reached for this plan
                    </p>
                    <p className="mt-1 mb-3 text-[13px] text-ink-700 leading-snug">
                        Each Tempaloo plan covers a fixed number of WordPress sites
                        (1 for Starter, 5 for Growth, unlimited for Business+).
                        Free a slot by deactivating an existing site, or upgrade to a
                        plan with more sites.
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={dashUrl}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-ink-700"
                        >
                            Deactivate a site ↗
                        </a>
                        {onGoToUpgrade && (
                            <button
                                onClick={onGoToUpgrade}
                                className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm font-medium text-ink-900 hover:border-ink-400"
                            >
                                See plans
                            </button>
                        )}
                        <button
                            onClick={onDismiss}
                            className="ml-auto text-xs text-ink-500 hover:text-ink-900 underline"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
