import { useEffect, useMemo, useRef, useState } from "react";
import { api, bulk, type AppState, type BulkScanReport, type BulkStatus } from "../api";
import { Badge, Button, Card, CardHeader, CompressionFactory, Confetti, FilesStream, Modal, ProgressRing, toast } from "../components/ui";

const EMPTY_STATUS: BulkStatus = {
    status: "idle", total: 0, processed: 0, succeeded: 0, failed: 0, errors: [],
};

// All distinct UI panes the page can show. Drives a single cross-fade so
// transitions feel continuous instead of snap-swap.
type Pane =
    | "loading"        // initial fetch in flight — show skeleton
    | "idle-fresh"     // never run, no pending scan yet
    | "idle-clean"     // last run completed, library fully converted
    | "idle-canceled"  // last run was canceled
    | "running"
    | "celebrating"    // overlay on top of done, lasts longer
    | "paused-quota"
    | "paused-daily";

function normalizeStatus(partial: Partial<BulkStatus> | null | undefined): BulkStatus {
    if (!partial) return EMPTY_STATUS;
    return {
        status:    partial.status    ?? EMPTY_STATUS.status,
        total:     partial.total     ?? 0,
        processed: partial.processed ?? 0,
        succeeded: partial.succeeded ?? 0,
        failed:    partial.failed    ?? 0,
        errors:    Array.isArray(partial.errors) ? partial.errors : [],
    };
}

function fmtSecs(s: number): string {
    if (!Number.isFinite(s) || s <= 0) return "—";
    if (s < 60) return `${Math.round(s)}s`;
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
}

/** Returns ms until next 00:00 UTC — used by the daily-cap countdown. */
function msUntilUtcMidnight(): number {
    const now = new Date();
    const next = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0
    ));
    return next.getTime() - now.getTime();
}
function fmtCountdown(ms: number): string {
    if (ms <= 0) return "now";
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

export default function Bulk({ state, onState, onUpgrade }: {
    state: AppState;
    /** Refresh global state — called on bulk completion so the Overview
     *  stats reflect the new converted-image counts immediately, instead
     *  of waiting up to 8s for the next polling tick. */
    onState?: (s: AppState) => void;
    onUpgrade?: () => void;
}) {
    const [report, setReport]         = useState<BulkScanReport | null>(null);
    const pending = report?.pending ?? null;

    // Drop the cached scan when the library shrinks. The savings.converted
    // counter only ever decreases on a Restore (every other path adds
    // siblings); when it does, our previous breakdown is lying about
    // what's still on disk and the user shouldn't have to remember to
    // click "Scan again" before trusting the numbers.
    const lastConvertedRef = useRef(state.savings?.converted ?? 0);
    useEffect(() => {
        const curr = state.savings?.converted ?? 0;
        if (curr < lastConvertedRef.current) {
            setReport(null);
        }
        lastConvertedRef.current = curr;
    }, [state.savings?.converted]);
    const [status, setStatus]         = useState<BulkStatus>(EMPTY_STATUS);
    const [pane, setPane]             = useState<Pane>("loading");
    const [scanning, setScanning]     = useState(false);
    const [resuming, setResuming]     = useState(false);
    const [preflightOpen, setPreflightOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const runningRef    = useRef(false);
    const startedAtRef  = useRef<number>(0);
    const celebrationDismissibleRef = useRef(false);

    // Initial status load — drives the loading→correct-pane transition.
    useEffect(() => {
        bulk.status()
            .then((s) => {
                const norm = normalizeStatus(s);
                setStatus(norm);
                setPane(deriveIdlePane(norm));
                // If the server reports running, attach the polling loop right away
                if (norm.status === "running") {
                    runningRef.current = true;
                    startedAtRef.current = Date.now() - 1000; // small offset so ETA isn't infinite
                    setTimeout(loop, 250);
                }
            })
            .catch(() => {
                setPane("idle-fresh");
                toast("error", "Couldn't reach the API to check bulk status");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Translate a server status into the right resting pane.
    function deriveIdlePane(s: BulkStatus): Pane {
        switch (s.status) {
            case "running":             return "running";
            case "paused_quota":        return "paused-quota";
            case "paused_daily_limit":  return "paused-daily";
            case "canceled":            return "idle-canceled";
            case "done":                return "idle-clean";
            default:                    return "idle-fresh";
        }
    }

    const pct = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

    const eta = useMemo(() => {
        if (pane !== "running" || !startedAtRef.current || status.processed < 2) return null;
        const elapsedMs = Date.now() - startedAtRef.current;
        const rate = status.processed / (elapsedMs / 1000);
        const remaining = status.total - status.processed;
        return remaining / rate;
    }, [pane, status]);

    const scan = async () => {
        setScanning(true);
        try {
            const r = await bulk.scan();
            setReport(r);
            if (r.pending > 0) setPreflightOpen(true);
            else {
                setPane("idle-clean");
                const fmtLabel =
                    r.targetFormat === "both"  ? "WebP + AVIF"
                  : r.targetFormat === "avif"  ? "AVIF"
                  :                              "WebP";
                toast("info", `Nothing to convert — every image already has ${fmtLabel} siblings.`);
            }
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Scan failed");
        } finally {
            setScanning(false);
        }
    };

    const loop = async () => {
        if (!runningRef.current) return;
        try {
            const s = await bulk.tick();
            const norm = normalizeStatus(s);
            setStatus(norm);
            if (norm.status === "running") {
                setTimeout(loop, 350);
            } else {
                runningRef.current = false;
                handleTerminalState(norm);
            }
        } catch (e) {
            runningRef.current = false;
            toast("error", e instanceof Error ? e.message : "Bulk error");
            // Keep the running pane so user can see what happened, with a soft warning
        }
    };

    /**
     * The crucial branching: a job that ENDS lands in different panes
     * depending on WHY it ended. Confetti only for genuine "done" — never
     * for "we ran out of credits", which is a downer disguised as success.
     */
    function handleTerminalState(s: BulkStatus) {
        if (s.status === "done") {
            celebrationDismissibleRef.current = false;
            setPane("celebrating");
            // Pull fresh state RIGHT NOW so Overview's PerformanceScorecard
            // and quota counters reflect the just-converted images. Without
            // this the user navigates to Overview and sees stale numbers
            // until the next 8s polling tick runs (and even later if the
            // 10s post-manual-update lock is still active).
            api.refreshState()
                .then((next) => onState?.(next))
                .catch(() => { /* polling will catch up later */ });
            // Long enough to read + celebrate but not annoying
            setTimeout(() => { celebrationDismissibleRef.current = true; }, 2000);
            setTimeout(() => {
                if (celebrationDismissibleRef.current) setPane("idle-clean");
            }, 12000);
        } else if (s.status === "paused_daily_limit") {
            setPane("paused-daily");
            // No toast — the pane itself communicates this clearly
        } else if (s.status === "paused_quota") {
            setPane("paused-quota");
        } else if (s.status === "canceled") {
            setPane("idle-canceled");
        }
    }

    const start = async () => {
        setPreflightOpen(false);

        // Optimistic UI: switch to the running pane IMMEDIATELY, before
        // we even hit the server. The previous flow had a noticeable
        // 0.5–1.5s dead window between popup close and the first poll
        // tick rendering — UI showed the stale idle pane while
        // bulk.start() was in flight, which read as "did my click do
        // anything?". Now the running view is on screen the millisecond
        // the user clicks; bulk.start() runs in the background; the
        // first tick's real status replaces the optimistic one when it
        // arrives. Rollback to idle if the API rejects.
        const previousPane = pane;
        runningRef.current = true;
        startedAtRef.current = Date.now();
        setStatus({
            status: "running",
            total: pending ?? 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            errors: [],
        });
        setPane("running");

        try {
            const s = await bulk.start();
            const norm = normalizeStatus(s);
            setStatus(norm);
            if (norm.status === "running") {
                // Schedule the first tick on the next microtask — no
                // artificial delay. The 350ms between subsequent ticks
                // (inside loop()) is the real polling interval.
                queueMicrotask(loop);
            } else {
                runningRef.current = false;
                handleTerminalState(norm);
            }
        } catch (e) {
            // Rollback: restore the pane the user came from + clear
            // optimistic running flag so the next loop tick can't fire.
            runningRef.current = false;
            setPane(previousPane);
            toast("error", e instanceof Error ? e.message : "Could not start");
        }
    };

    const confirmCancel = async () => {
        setCancelOpen(false);
        runningRef.current = false;
        await bulk.cancel().catch(() => {});
        setStatus(normalizeStatus({ status: "canceled" }));
        setPane("idle-canceled");
        toast("info", "Bulk job canceled — already-converted images are kept.");
    };

    const resume = async () => {
        // Same optimistic pattern as start(). Resuming from paused-quota
        // or paused-daily had the same dead window — instant pane flip
        // here means the user gets the "we picked up where we left off"
        // payoff immediately.
        setResuming(true);
        const previousPane = pane;
        runningRef.current = true;
        startedAtRef.current = Date.now();
        // Keep the existing processed counts visible so the progress bar
        // continues from where it was, instead of jumping back to 0.
        setStatus((prev) => ({ ...prev, status: "running" }));
        setPane("running");

        try {
            const s = await bulk.resume();
            const norm = normalizeStatus(s);
            setStatus(norm);
            if (norm.status === "running") {
                queueMicrotask(loop);
            } else {
                runningRef.current = false;
                handleTerminalState(norm);
            }
        } catch (e) {
            runningRef.current = false;
            setPane(previousPane);
            toast("error", e instanceof Error ? e.message : "Could not resume");
        } finally {
            setResuming(false);
        }
    };

    const isFree = state.license.plan === "free" || !state.license.valid;

    return (
        <div className="grid gap-6">
            <StatePane id={pane}>
                {pane === "loading" && <LoadingSkeleton />}

                {pane === "running" && (
                    <RunningView status={status} pct={pct} eta={eta} onCancel={() => setCancelOpen(true)} />
                )}

                {pane === "celebrating" && (
                    <CompletionCard
                        status={status}
                        onDismiss={() => setPane("idle-clean")}
                        onUpgrade={onUpgrade}
                        isFree={isFree}
                    />
                )}

                {pane === "paused-quota" && (
                    <PausedView
                        kind="quota"
                        status={status}
                        onResume={resume}
                        resuming={resuming}
                        onUpgrade={onUpgrade}
                        license={state.license}
                        quota={state.quota}
                    />
                )}

                {pane === "paused-daily" && (
                    <PausedView
                        kind="daily"
                        status={status}
                        onResume={resume}
                        resuming={resuming}
                        onUpgrade={onUpgrade}
                        license={state.license}
                        quota={state.quota}
                    />
                )}

                {(pane === "idle-fresh" || pane === "idle-clean" || pane === "idle-canceled") && (
                    <IdleView
                        pane={pane}
                        state={state}
                        report={report}
                        scanning={scanning}
                        onScan={scan}
                        lastStatus={status}
                    />
                )}
            </StatePane>

            <HowItWorks />

            <PreflightModal
                open={preflightOpen}
                onClose={() => setPreflightOpen(false)}
                onConfirm={start}
                report={report}
                state={state}
            />

            <Modal
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                title="Cancel the running job?"
                description="The images already converted stay converted. The remaining queue is dropped — you can scan again anytime to pick them back up."
                variant="danger"
                size="sm"
            >
                <div className="flex gap-2 justify-end mt-2">
                    <Button variant="ghost" onClick={() => setCancelOpen(false)}>Keep running</Button>
                    <Button variant="danger" onClick={confirmCancel}>Cancel job</Button>
                </div>
            </Modal>
        </div>
    );
}

/* ── StatePane — cross-fade between panes ───────────────────────────── */
function StatePane({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <div key={id} className="state-pane">
            {children}
            <style>{`
                .state-pane { animation: paneIn 320ms cubic-bezier(.16,1,.3,1) both; }
                @keyframes paneIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
                @media (prefers-reduced-motion: reduce) { .state-pane { animation: none; } }
            `}</style>
        </div>
    );
}

/* ── Loading skeleton ───────────────────────────────────────────────── */
function LoadingSkeleton() {
    return (
        <Card>
            <div className="animate-pulse space-y-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <div className="h-4 w-40 bg-ink-200 rounded" />
                        <div className="h-3 w-72 bg-ink-100 rounded" />
                    </div>
                    <div className="h-6 w-20 bg-ink-100 rounded-full" />
                </div>
                <div className="h-10 w-44 bg-ink-100 rounded-lg" />
                <div className="text-[11px] text-ink-400 font-mono">checking last bulk state…</div>
            </div>
        </Card>
    );
}

/* ── Idle view (fresh / clean / canceled) ───────────────────────────── */
function IdleView({ pane, state, report, scanning, onScan, lastStatus }: {
    pane: "idle-fresh" | "idle-clean" | "idle-canceled";
    state: AppState;
    report: BulkScanReport | null;
    scanning: boolean;
    onScan: () => void;
    lastStatus: BulkStatus;
}) {
    const fmtLabel =
        report?.targetFormat === "both" ? "WebP + AVIF"
      : report?.targetFormat === "avif" ? "AVIF"
      :                                   "WebP";

    const headline =
        pane === "idle-clean"     ? "Library is fully converted ✓"
      : pane === "idle-canceled"  ? "Last run canceled"
      : "Bulk conversion";
    const description =
        pane === "idle-clean"
            ? `Every supported image already has a ${fmtLabel} sibling. Scan again anytime to catch new uploads.`
            : pane === "idle-canceled"
                ? `${lastStatus.processed.toLocaleString()} of ${lastStatus.total.toLocaleString()} images were converted before you canceled. Scan to resume the rest.`
                : "Convert images already in your media library. 1 credit per image — every thumbnail size and every selected format included.";

    return (
        <Card>
            <CardHeader
                title={headline}
                description={description}
                right={<Badge variant={pane === "idle-clean" ? "success" : "brand"}>Resumable</Badge>}
            />

            {!state.license.valid && (
                <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                    You need an active license. Go to <strong>Overview</strong> to activate one.
                </div>
            )}

            {/* Breakdown — visible whenever a scan has run, even at 0 pending */}
            {report && (
                <>
                    <div className="mb-3 rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <Stat label="Library total" value={report.total.toLocaleString()} />
                        <Stat label="Already done" value={report.fullyConverted.toLocaleString()} accent={report.fullyConverted > 0 ? "success" : undefined} />
                        <Stat
                            label={report.targetFormat === "both" ? "Need WebP" : `Pending ${fmtLabel}`}
                            value={(report.targetFormat === "both" ? report.missingWebp : report.pending).toLocaleString()}
                            accent={report.pending > 0 ? "brand" : undefined}
                        />
                        {report.targetFormat === "both" && (
                            <Stat
                                label="Need AVIF"
                                value={report.missingAvif.toLocaleString()}
                                accent={report.missingAvif > 0 ? "brand" : undefined}
                            />
                        )}
                        {report.targetFormat !== "both" && (
                            <Stat label="Format" value={fmtLabel} />
                        )}
                    </div>
                    {report.orphanedSiblings > 0 && (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
                            <strong>{report.orphanedSiblings.toLocaleString()} orphaned sibling{report.orphanedSiblings === 1 ? "" : "s"} detected</strong> —
                            <code className="text-[11px] mx-1">.webp</code>/<code className="text-[11px] mx-0.5">.avif</code>
                            files on disk for attachments that have no <code className="text-[11px] mx-0.5">tempaloo_webp</code> meta. Usually means a previous Restore couldn&apos;t delete every sibling
                            (LiteSpeed cache lock, file permissions). Re-run Restore from Settings — v1.5.1+ falls back to a raw unlink and reports the failures.
                        </div>
                    )}
                    {report.brokenPaths > 0 && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-xs leading-relaxed text-red-900">
                            <strong>{report.brokenPaths.toLocaleString()} broken attachment{report.brokenPaths === 1 ? "" : "s"}</strong> — the original file is missing on disk.
                            These are excluded from bulk (we can&apos;t convert what isn&apos;t there). Check the WP Media Library for any rows that show as missing.
                        </div>
                    )}
                </>
            )}

            <div className="flex gap-2 flex-wrap">
                <Button onClick={onScan} loading={scanning} disabled={!state.license.valid}>
                    {report === null ? "Scan & start" : "Scan again"}
                </Button>
                {report !== null && report.pending > 0 && (
                    <span className="self-center text-sm text-ink-500">
                        {report.pending.toLocaleString()} image{report.pending > 1 ? "s" : ""} need {fmtLabel}
                    </span>
                )}
            </div>

            {lastStatus.errors.length > 0 && (
                <details className="mt-4">
                    <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-700">
                        {lastStatus.errors.length} error{lastStatus.errors.length > 1 ? "s" : ""} from the last run
                    </summary>
                    <ul className="mt-2 text-xs text-red-700 max-h-48 overflow-auto space-y-0.5 font-mono">
                        {lastStatus.errors.map((e, i) => (
                            <li key={i}>#{e.id} — {e.code}: {e.message}</li>
                        ))}
                    </ul>
                </details>
            )}
        </Card>
    );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "brand" | "success" }) {
    const valueClass =
        accent === "success" ? "text-emerald-700"
      : accent === "brand"   ? "text-brand-700"
      :                        "text-ink-900";
    return (
        <div>
            <div className="uppercase tracking-wide text-[10px] font-semibold text-ink-500">{label}</div>
            <div className={`mt-0.5 text-base font-semibold ${valueClass}`}>{value}</div>
        </div>
    );
}

/* ── How it works (kept under everything) ───────────────────────────── */
function HowItWorks() {
    return (
        <Card className="bg-ink-50/50 border-dashed">
            <CardHeader title="How it works" />
            <ul className="space-y-2 text-sm text-ink-600">
                <li>• We scan your media library for JPG, PNG and GIF images that don&apos;t yet have every sibling for your current <strong>Image format(s)</strong> setting (Settings → Conversion).</li>
                <li>• Each attachment is <strong>one batch, one credit</strong> — original + every WordPress thumbnail + both formats when "Both" is selected, all in a single API call.</li>
                <li>• Originals stay untouched. <code className="text-xs bg-white border border-ink-200 rounded px-1">.webp</code> and <code className="text-xs bg-white border border-ink-200 rounded px-1">.avif</code> siblings are written next to each size on disk.</li>
                <li>• Switching formats later (e.g. WebP → Both) re-flags every image whose AVIF sibling is missing — scan again and only the gaps are processed.</li>
                <li>• If the process is interrupted (tab closed, server restart), reopen this page — we resume from where we stopped.</li>
            </ul>
        </Card>
    );
}

/* ── Pre-flight modal ───────────────────────────────────────────────── */
function PreflightModal({
    open, onClose, onConfirm, report, state,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    report: BulkScanReport | null;
    state: AppState;
}) {
    const pending = report?.pending ?? 0;
    const fmtLabel =
        report?.targetFormat === "both" ? "WebP + AVIF"
      : report?.targetFormat === "avif" ? "AVIF"
      :                                   "WebP";

    const checks = useMemo(() => {
        const remaining = state.quota?.imagesRemaining ?? 0;
        const rollover = state.quota?.imagesRollover ?? 0;
        const isUnlimited = state.license.imagesLimit === -1;
        const etaSeconds = pending * 1.2;
        // Daily bulk cap comes from the server now (BULK_DAILY_LIMIT_FREE
        // env), surfaced via /quota → state.quota.dailyBulkLimit. 0 means
        // "no daily cap" (paid plans). Falls back to 0 on legacy installs
        // that haven't refreshed state since the field was added.
        const dailyCap = state.quota?.dailyBulkLimit ?? 0;
        const hasDailyCap = dailyCap > 0;
        const planLabel = state.license.plan
            ? state.license.plan.charAt(0).toUpperCase() + state.license.plan.slice(1)
            : "your";

        const quotaOk = isUnlimited || remaining >= pending;
        const quotaPartial = !quotaOk && remaining > 0;

        return {
            list: [
                {
                    label: "Quota",
                    ok: quotaOk,
                    warn: quotaPartial,
                    detail: isUnlimited
                        ? `Unlimited on your ${planLabel} plan`
                        : quotaOk
                            ? `Will use ${pending.toLocaleString()} of ${remaining.toLocaleString()} left this month` +
                              (rollover > 0 ? ` (incl. ${rollover.toLocaleString()} rollover)` : "")
                            : quotaPartial
                                ? `Only ${remaining.toLocaleString()} credits left — ${pending - remaining} images won't be converted`
                                : `No credits remaining this month`,
                },
                {
                    label: "Daily cap",
                    ok: !hasDailyCap || pending <= dailyCap,
                    warn: hasDailyCap && pending > dailyCap,
                    detail: !hasDailyCap
                        ? `No daily cap on ${planLabel} plan`
                        : pending <= dailyCap
                            ? `${planLabel}: ${dailyCap}/day — your ${pending} images fit`
                            : `${planLabel}: ${dailyCap}/day — only the first ${dailyCap} will run today, then resume tomorrow`,
                },
                {
                    label: "API health",
                    ok: state.apiHealth.ok,
                    detail: state.apiHealth.ok ? "Live" : `Degraded — last error ${state.apiHealth.code || "unknown"}`,
                },
            ],
            etaSeconds,
            blocked: !quotaOk && !quotaPartial,
        };
    }, [pending, state]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Convert ${pending.toLocaleString()} image${pending > 1 ? "s" : ""} to ${fmtLabel}?`}
            description={
                <span>
                    Estimated time: <strong className="text-ink-700">~{fmtSecs(checks.etaSeconds)}</strong>.
                    Long jobs survive page refreshes — you can close this tab and come back.
                </span>
            }
            size="lg"
        >
            <div className="mb-5"><CompressionFactory /></div>

            {report && report.targetFormat === "both" && (
                <div className="mb-5 rounded-lg border border-brand-200 bg-brand-50/60 px-4 py-3 text-sm text-ink-700">
                    <div className="font-medium text-ink-900">Why two siblings per size?</div>
                    <div className="mt-1 text-xs leading-relaxed text-ink-600">
                        <strong>{report.missingWebp.toLocaleString()}</strong> image{report.missingWebp === 1 ? "" : "s"} need WebP ·
                        <strong className="ml-1">{report.missingAvif.toLocaleString()}</strong> need AVIF.
                        Both are produced in a single API call per attachment — <strong>1 credit covers both formats</strong>,
                        same cost as picking just one.
                    </div>
                </div>
            )}

            <div className="space-y-2.5 mb-5">
                {checks.list.map((c) => (
                    <div key={c.label} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-ink-50/70">
                        <div className={c.ok ? "text-emerald-600 mt-0.5" : c.warn ? "text-amber-600 mt-0.5" : "text-red-600 mt-0.5"}>
                            {c.ok ? <CheckIcon /> : c.warn ? <WarnIcon /> : <BadIcon />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-ink-900">{c.label}</div>
                            <div className="text-xs text-ink-600 mt-0.5">{c.detail}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={onConfirm} disabled={checks.blocked}>
                    {checks.blocked ? "Quota exhausted" : "Start conversion"}
                </Button>
            </div>
        </Modal>
    );
}

/* ── Live running view ──────────────────────────────────────────────── */
function RunningView({ status, pct, eta, onCancel }: {
    status: BulkStatus;
    pct: number;
    eta: number | null;
    onCancel: () => void;
}) {
    return (
        <Card className="bg-gradient-to-br from-brand-50/50 to-white border-brand-200">
            <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
                <div className="shrink-0">
                    <ProgressRing
                        value={pct}
                        size={160}
                        label={`${status.processed} / ${status.total}`}
                        sub={eta !== null ? `ETA ${fmtSecs(eta)}` : "computing…"}
                    />
                </div>
                <div className="min-w-0 flex-1 w-full">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                        </span>
                        <h3 className="text-base font-semibold text-ink-900">Converting your media library</h3>
                    </div>
                    <p className="text-sm text-ink-600 mb-4">
                        Processing in batches of 3. The job survives page refreshes — close this tab if you need.
                    </p>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <Mini value={status.succeeded} label="converted" tone="success" />
                        <Mini value={status.failed}    label="failed"    tone={status.failed > 0 ? "error" : "neutral"} />
                        <Mini value={Math.max(0, status.total - status.processed)} label="remaining" tone="neutral" />
                    </div>

                    <Button variant="ghost" size="sm" onClick={onCancel}>Cancel job</Button>
                </div>
            </div>
            <div className="mt-5 pt-4 border-t border-ink-100">
                <div className="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-2">
                    LIVE · processing in batches
                </div>
                <FilesStream count={12} kind="compress" />
            </div>
        </Card>
    );
}

function Mini({ value, label, tone }: { value: number; label: string; tone: "success" | "error" | "neutral" }) {
    const color = tone === "success" ? "text-emerald-600" : tone === "error" ? "text-red-600" : "text-ink-700";
    return (
        <div className="rounded-lg bg-white border border-ink-200 px-3 py-2 text-center">
            <div className={`text-xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</div>
            <div className="text-[11px] uppercase tracking-wider text-ink-500 font-medium">{label}</div>
        </div>
    );
}

/* ── Completion celebration — long-form, dismissible ────────────────── */
function CompletionCard({ status, onDismiss, onUpgrade, isFree }: {
    status: BulkStatus;
    onDismiss: () => void;
    onUpgrade?: () => void;
    isFree: boolean;
}) {
    return (
        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-brand-50 border-emerald-300">
            <Confetti active />
            <div className="relative text-center py-4">
                <div className="inline-flex h-14 w-14 rounded-full bg-emerald-100 items-center justify-center mb-3 mx-auto">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                        <path d="M5 13 L10 18 L20 6" />
                    </svg>
                </div>
                <h3 className="text-2xl font-bold text-ink-900 tracking-tight">All done!</h3>
                <p className="text-sm text-ink-600 mt-1">
                    <strong>{status.succeeded.toLocaleString()}</strong> image{status.succeeded > 1 ? "s" : ""} converted
                    {status.failed > 0 && <> · <span className="text-red-600">{status.failed} failed</span></>}
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto mt-5">
                    <Mini value={status.succeeded} label="converted" tone="success" />
                    <Mini value={status.succeeded * 7} label="sizes processed" tone="neutral" />
                    <Mini value={1} label="credit per image" tone="neutral" />
                </div>
                <div className="mt-6 flex gap-2 justify-center flex-wrap">
                    <Button onClick={onDismiss}>Done</Button>
                    {isFree && onUpgrade && (
                        <Button variant="secondary" onClick={onUpgrade}>
                            Unlock unlimited bulk →
                        </Button>
                    )}
                </div>
                <div className="mt-3 text-[11px] text-ink-400">
                    This card stays open — close it whenever you want.
                </div>
            </div>
        </Card>
    );
}

/* ── PausedView — handles BOTH paused_quota AND paused_daily_limit ──── */
function PausedView({ kind, status, onResume, resuming, onUpgrade, license, quota }: {
    kind: "quota" | "daily";
    status: BulkStatus;
    onResume: () => void;
    resuming: boolean;
    onUpgrade?: () => void;
    license: AppState["license"];
    quota: AppState["quota"];
}) {
    const remaining = Math.max(0, status.total - status.processed);
    const succeeded = status.succeeded;
    const isFree = license.plan === "free";

    // Daily-cap countdown (live)
    const [countdown, setCountdown] = useState(msUntilUtcMidnight());
    useEffect(() => {
        if (kind !== "daily") return;
        const t = setInterval(() => setCountdown(msUntilUtcMidnight()), 1000);
        return () => clearInterval(t);
    }, [kind]);

    const monthlyResetDate = quota?.periodEnd
        ? new Date(quota.periodEnd).toLocaleDateString(undefined, { day: "numeric", month: "long" })
        : null;

    return (
        <Card className="border-amber-300 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/40">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="shrink-0 h-14 w-14 rounded-full bg-amber-100 grid place-items-center text-amber-700 text-2xl">
                    ⏸
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-ink-900 tracking-tight">
                        {kind === "daily" ? "Paused — Free daily cap reached" : "Paused — monthly quota reached"}
                    </h3>
                    <p className="text-sm text-ink-600 mt-1">
                        We converted <strong className="text-emerald-700">{succeeded.toLocaleString()}</strong> image{succeeded > 1 ? "s" : ""} today.
                        <strong className="text-ink-900"> {remaining.toLocaleString()}</strong> image{remaining > 1 ? "s are" : " is"} still pending.
                    </p>

                    {/* Progress bar showing how far the original job got */}
                    {status.total > 0 && (
                        <div className="mt-4">
                            <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                                    style={{ width: `${Math.min(100, (status.processed / status.total) * 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[11px] text-ink-500 mt-1.5 font-mono">
                                <span>{status.processed} / {status.total} processed</span>
                                <span>{Math.round((status.processed / status.total) * 100)}%</span>
                            </div>
                        </div>
                    )}

                    {/* Auto-resume timeline — clear answer to "will it resume tomorrow?" */}
                    <div className="mt-5 rounded-lg bg-white border border-ink-200 p-4">
                        <div className="text-xs font-semibold text-ink-900 uppercase tracking-wider mb-2">
                            What happens next
                        </div>
                        {kind === "daily" ? (
                            <div className="space-y-2.5 text-sm text-ink-700">
                                <div className="flex gap-3">
                                    <span className="text-amber-600 shrink-0">⏰</span>
                                    <div>
                                        Your daily cap resets in <strong className="text-ink-900 font-mono">{fmtCountdown(countdown)}</strong> (at 00:00 UTC).
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-ink-400 shrink-0">↺</span>
                                    <div>
                                        <strong className="text-ink-900">Resume isn&apos;t automatic</strong> — come back tomorrow and click <em>Resume</em>, and we&apos;ll pick up at image #{status.processed + 1}.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-emerald-600 shrink-0">⚡</span>
                                    <div>
                                        Or <strong>upgrade now</strong> to remove the cap and finish the remaining {remaining.toLocaleString()} in one go.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5 text-sm text-ink-700">
                                <div className="flex gap-3">
                                    <span className="text-amber-600 shrink-0">📅</span>
                                    <div>
                                        Your monthly quota resets <strong className="text-ink-900">{monthlyResetDate ? `on ${monthlyResetDate}` : "next month"}</strong>.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-ink-400 shrink-0">↺</span>
                                    <div>
                                        Click <em>Resume</em> after the reset and we&apos;ll continue from image #{status.processed + 1}.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-emerald-600 shrink-0">⚡</span>
                                    <div>
                                        Or upgrade now for instant access — your already-converted images stay where they are.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CTAs */}
                    <div className="mt-5 flex flex-wrap gap-2">
                        {isFree && onUpgrade && (
                            <Button onClick={onUpgrade}>
                                {kind === "daily" ? "Remove the daily cap" : "Upgrade to resume now"} →
                            </Button>
                        )}
                        <Button variant="secondary" onClick={onResume} loading={resuming}>
                            Resume now {kind === "daily" && "(if cap reset)"}
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}

/* ── Tiny inline icons ──────────────────────────────────────────────── */
function CheckIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12" /><path d="M8 12 L11 15 L16 9" /></svg>; }
function WarnIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.12" /><path d="M12 8 V13 M12 16 H12.01" /></svg>; }
function BadIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.12" /><path d="M9 9 L15 15 M15 9 L9 15" /></svg>; }
