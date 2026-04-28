import { useEffect, useMemo, useRef, useState } from "react";
import { bulk, type AppState, type BulkStatus } from "../api";
import { Badge, Button, Card, CardHeader, Confetti, Modal, ProgressRing, toast } from "../components/ui";

const EMPTY_STATUS: BulkStatus = {
    status: "idle", total: 0, processed: 0, succeeded: 0, failed: 0, errors: [],
};

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

export default function Bulk({ state, onUpgrade }: { state: AppState; onUpgrade?: () => void }) {
    const [pending, setPending] = useState<number | null>(null);
    const [status, setStatus] = useState<BulkStatus>(EMPTY_STATUS);
    const [resuming, setResuming] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [preflightOpen, setPreflightOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const runningRef = useRef(false);
    const startedAtRef = useRef<number>(0);

    useEffect(() => {
        bulk.status().then((s) => setStatus(normalizeStatus(s))).catch(() => {});
    }, []);

    const pct = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

    // ETA computed off the running average since the job started.
    const eta = useMemo(() => {
        if (status.status !== "running" || !startedAtRef.current || status.processed < 2) return null;
        const elapsedMs = Date.now() - startedAtRef.current;
        const rate = status.processed / (elapsedMs / 1000);
        const remaining = status.total - status.processed;
        return remaining / rate;
    }, [status]);

    const scan = async () => {
        setScanning(true);
        try {
            const r = await bulk.scan();
            setPending(r.pending);
            if (r.pending > 0) setPreflightOpen(true);
            else toast("info", "Nothing to convert — your library is already optimized.");
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
            setStatus(normalizeStatus(s));
            if (s.status === "running") {
                setTimeout(loop, 350);
            } else {
                runningRef.current = false;
                if (s.status === "done") {
                    setShowCelebration(true);
                    // Auto-hide celebration after 6 s; users can also dismiss
                    setTimeout(() => setShowCelebration(false), 6000);
                } else if (s.status === "paused_quota") {
                    toast("error", "Paused — monthly quota reached");
                } else if (s.status === "paused_daily_limit") {
                    toast("error", "Paused — daily bulk limit reached (Free plan)");
                }
            }
        } catch (e) {
            runningRef.current = false;
            toast("error", e instanceof Error ? e.message : "Bulk error");
        }
    };

    const start = async () => {
        setPreflightOpen(false);
        try {
            const s = await bulk.start();
            setStatus(normalizeStatus(s));
            runningRef.current = true;
            startedAtRef.current = Date.now();
            setTimeout(loop, 150);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Could not start");
        }
    };

    const confirmCancel = async () => {
        setCancelOpen(false);
        runningRef.current = false;
        await bulk.cancel().catch(() => {});
        setStatus(normalizeStatus({ status: "canceled" }));
        toast("info", "Bulk job canceled — already-converted images are kept.");
    };

    const resume = async () => {
        setResuming(true);
        try {
            const s = await bulk.resume();
            setStatus(normalizeStatus(s));
            runningRef.current = true;
            startedAtRef.current = Date.now();
            setTimeout(loop, 150);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Could not resume");
        } finally {
            setResuming(false);
        }
    };

    return (
        <div className="grid gap-6">
            {/* ─── Live processing view (running) ────────────────────────── */}
            {status.status === "running" && (
                <RunningView
                    status={status}
                    pct={pct}
                    eta={eta}
                    onCancel={() => setCancelOpen(true)}
                />
            )}

            {/* ─── Completion celebration ────────────────────────────────── */}
            {showCelebration && status.status === "done" && (
                <CompletionCard
                    status={status}
                    onDismiss={() => setShowCelebration(false)}
                    onUpgrade={onUpgrade}
                    isFree={state.license.plan === "free"}
                />
            )}

            {/* ─── Idle / paused / done — normal CTA card ────────────────── */}
            {status.status !== "running" && !showCelebration && (
                <Card>
                    <CardHeader
                        title="Bulk conversion"
                        description="Convert images already in your media library. 1 credit per image — all sizes included."
                        right={<Badge variant="brand">Resumable</Badge>}
                    />

                    {!state.license.valid && (
                        <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                            You need an active license. Go to <strong>Overview</strong> to activate one.
                        </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={scan} loading={scanning} disabled={!state.license.valid}>
                            {pending === null ? "Scan & start" : "Scan again"}
                        </Button>
                        {pending !== null && pending > 0 && (
                            <span className="self-center text-sm text-ink-500">
                                {pending} attachment{pending > 1 ? "s" : ""} pending
                            </span>
                        )}
                    </div>

                    {(status.status === "paused_quota" || status.status === "paused_daily_limit") && (
                        <PausedCard
                            status={status.status}
                            remaining={status.total - status.processed}
                            total={status.total}
                            onUpgrade={onUpgrade}
                            onResume={resume}
                            resuming={resuming}
                        />
                    )}

                    {status.status === "canceled" && (
                        <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
                            Last run was canceled — <strong>{status.processed}</strong> images converted before stopping.
                        </div>
                    )}

                    {status.errors.length > 0 && (
                        <details className="mt-4">
                            <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-700">
                                {status.errors.length} error{status.errors.length > 1 ? "s" : ""} from the last run
                            </summary>
                            <ul className="mt-2 text-xs text-red-700 max-h-48 overflow-auto space-y-0.5 font-mono">
                                {status.errors.map((e, i) => (
                                    <li key={i}>#{e.id} — {e.code}: {e.message}</li>
                                ))}
                            </ul>
                        </details>
                    )}
                </Card>
            )}

            {/* ─── How it works ──────────────────────────────────────────── */}
            <Card className="bg-ink-50/50 border-dashed">
                <CardHeader title="How it works" />
                <ul className="space-y-2 text-sm text-ink-600">
                    <li>• We scan your media library for JPG, PNG and GIF images that haven&apos;t been optimized yet.</li>
                    <li>• For each attachment we send <strong>one batch</strong> with the original and all generated sizes — that&apos;s <strong>1 credit</strong>.</li>
                    <li>• Originals stay untouched. A <code className="text-xs bg-white border border-ink-200 rounded px-1">.webp</code> sibling is written next to each size.</li>
                    <li>• If the process is interrupted (tab closed, server restart), click <em>Scan & start</em> again — it picks up where it stopped.</li>
                </ul>
            </Card>

            {/* ─── Pre-flight modal ──────────────────────────────────────── */}
            <PreflightModal
                open={preflightOpen}
                onClose={() => setPreflightOpen(false)}
                onConfirm={start}
                pending={pending ?? 0}
                state={state}
            />

            {/* ─── Cancel confirmation modal ─────────────────────────────── */}
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

/* ── Pre-flight modal ───────────────────────────────────────────────── */
function PreflightModal({
    open, onClose, onConfirm, pending, state,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    pending: number;
    state: AppState;
}) {
    const checks = useMemo(() => {
        const remaining = state.quota?.imagesRemaining ?? 0;
        const isUnlimited = state.license.imagesLimit === -1;
        const isFree = state.license.plan === "free";

        // Estimated time: ~1.2s per image (API round-trip + libvips encode)
        const etaSeconds = pending * 1.2;

        const quotaOk = isUnlimited || remaining >= pending;
        const quotaPartial = !quotaOk && remaining > 0;

        return {
            list: [
                {
                    label: "Quota",
                    ok: quotaOk,
                    warn: quotaPartial,
                    detail: isUnlimited
                        ? `Unlimited on your ${state.license.plan} plan`
                        : quotaOk
                            ? `Will use ${pending.toLocaleString()} / ${remaining.toLocaleString()} remaining this month`
                            : quotaPartial
                                ? `Only ${remaining.toLocaleString()} credits left — ${pending - remaining} images won't be converted`
                                : `No credits remaining this month`,
                },
                {
                    label: "Daily cap",
                    ok: !isFree,
                    warn: isFree && pending > 50,
                    detail: !isFree
                        ? `No daily cap on ${state.license.plan} plan`
                        : pending <= 50
                            ? `Free: 50/day — your ${pending} images fit`
                            : `Free: 50/day — only the first 50 will run today, then resume tomorrow`,
                },
                {
                    label: "API health",
                    ok: state.apiHealth.ok,
                    detail: state.apiHealth.ok ? "Live" : `Degraded — last error ${state.apiHealth.code || "unknown"}`,
                },
            ],
            etaSeconds,
            blocked: !quotaOk && !quotaPartial, // hard block only when 0 credits
        };
    }, [pending, state]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Convert ${pending.toLocaleString()} image${pending > 1 ? "s" : ""}?`}
            description={
                <span>
                    Estimated time: <strong className="text-ink-700">~{fmtSecs(checks.etaSeconds)}</strong>.
                    Long jobs survive page refreshes — you can close this tab and come back.
                </span>
            }
            size="md"
        >
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

/* ── Completion celebration ─────────────────────────────────────────── */
function CompletionCard({ status, onDismiss, onUpgrade, isFree }: {
    status: BulkStatus;
    onDismiss: () => void;
    onUpgrade?: () => void;
    isFree: boolean;
}) {
    return (
        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-blue-50 border-emerald-300">
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
            </div>
        </Card>
    );
}

/* ── Paused (existing logic, lightly retouched) ─────────────────────── */
function PausedCard({
    status, remaining, total, onUpgrade, onResume, resuming,
}: {
    status: "paused_quota" | "paused_daily_limit";
    remaining: number;
    total: number;
    onUpgrade?: () => void;
    onResume: () => void;
    resuming: boolean;
}) {
    const isDaily = status === "paused_daily_limit";
    const title = isDaily ? "Paused — daily bulk limit reached" : "Paused — monthly quota reached";
    const body = isDaily
        ? `${remaining} of ${total} images still to convert. Free plans cap bulk at 50 conversions per day. Resume tomorrow, or upgrade for unlimited bulk.`
        : `${remaining} of ${total} images still to convert. Upgrade for instant access, or click Resume after the monthly reset.`;
    return (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 text-amber-700">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-amber-900">{title}</h4>
                    <p className="mt-1 text-sm text-amber-900/80">{body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {onUpgrade && (
                            <button
                                onClick={onUpgrade}
                                className="inline-flex items-center h-9 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition shadow-sm"
                            >
                                {isDaily ? "Unlock unlimited bulk" : "Upgrade plan"}
                            </button>
                        )}
                        <Button variant="secondary" onClick={onResume} loading={resuming}>
                            Resume
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Tiny inline icons ──────────────────────────────────────────────── */
function CheckIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.12" /><path d="M8 12 L11 15 L16 9" /></svg>; }
function WarnIcon()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.12" /><path d="M12 8 V13 M12 16 H12.01" /></svg>; }
function BadIcon()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.12" /><path d="M9 9 L15 15 M15 9 L9 15" /></svg>; }
