import { useEffect, useState } from "react";
import { api, boot, formatBytes, type AppState } from "../api";
import { Badge, Button, Card, CardHeader, Input, Modal, QuotaRing, Stat, toast } from "../components/ui";

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
export default function Overview({ state, onState, freeQuota, onGoToUpgrade }: {
    state: AppState;
    onState: (s: AppState) => void;
    freeQuota: number | null;
    onGoToUpgrade?: () => void;
}) {
    const [key, setKey] = useState(state.license.key);
    const [activating, setActivating] = useState(false);
    const [changeOpen, setChangeOpen] = useState(false);
    const [reveal, setReveal] = useState(false);
    const [nudgeDismissed, setNudgeDismissed] = useState(false);

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
        try {
            const next = await api.activate(key.trim());
            onState(next);
            toast("success", "License activated");
            setChangeOpen(false);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Activation failed");
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
            {/* ─── Activate (only when no valid license) ─────────────────── */}
            {!state.license.valid && (
                <Card className="bg-gradient-to-br from-brand-50 to-white border-brand-200">
                    <CardHeader
                        title="Activate Tempaloo WebP"
                        description={
                            freeQuota === null
                                ? "Generate a free key or paste one you already have."
                                : `Generate a free key (${freeQuota.toLocaleString()} images / month) or paste one you already have.`
                        }
                        right={<Badge variant="brand">Free plan available</Badge>}
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Paste your license key"
                            className="font-mono text-xs"
                        />
                        <Button variant="secondary" onClick={() => window.open(boot.activateUrl, "_blank")}>
                            Generate a key
                        </Button>
                        <Button onClick={activate} loading={activating}>
                            Activate
                        </Button>
                    </div>
                </Card>
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
        <Card className="relative bg-gradient-to-br from-purple-50 via-pink-50/50 to-amber-50/40 border-purple-200">
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
                    <div className="text-xs font-mono uppercase tracking-wider text-purple-700 mb-1">Heads up</div>
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
