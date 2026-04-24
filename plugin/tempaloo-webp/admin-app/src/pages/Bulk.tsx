import { useEffect, useRef, useState } from "react";
import { bulk, type AppState, type BulkStatus } from "../api";
import { Badge, Button, Card, CardHeader, Progress, toast } from "../components/ui";

const EMPTY_STATUS: BulkStatus = {
    status: "idle", total: 0, processed: 0, succeeded: 0, failed: 0, errors: [],
};

function normalizeStatus(partial: Partial<BulkStatus> | null | undefined): BulkStatus {
    if (!partial) return EMPTY_STATUS;
    return {
        status: partial.status ?? EMPTY_STATUS.status,
        total: partial.total ?? 0,
        processed: partial.processed ?? 0,
        succeeded: partial.succeeded ?? 0,
        failed: partial.failed ?? 0,
        errors: Array.isArray(partial.errors) ? partial.errors : [],
    };
}

export default function Bulk({ state, onUpgrade }: { state: AppState; onUpgrade?: () => void }) {
    const [pending, setPending] = useState<number | null>(null);
    const [status, setStatus] = useState<BulkStatus>(EMPTY_STATUS);
    const [resuming, setResuming] = useState(false);
    const runningRef = useRef(false);

    useEffect(() => {
        bulk.status().then((s) => setStatus(normalizeStatus(s))).catch(() => {});
    }, []);

    const canStart = !!state.license.valid && (pending ?? 0) > 0 && status.status !== "running";
    const pct = status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

    const scan = async () => {
        try {
            const r = await bulk.scan();
            setPending(r.pending);
            toast("info", r.pending === 0 ? "No images to convert" : `${r.pending} images pending`);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Scan failed");
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
                    toast("success", `Done — ${s.succeeded} converted, ${s.failed} failed`);
                } else if (s.status === "paused_quota") {
                    toast("error", "Paused — monthly quota reached");
                }
            }
        } catch (e) {
            runningRef.current = false;
            toast("error", e instanceof Error ? e.message : "Bulk error");
        }
    };

    const start = async () => {
        try {
            const s = await bulk.start();
            setStatus(normalizeStatus(s));
            runningRef.current = true;
            setTimeout(loop, 150);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Could not start");
        }
    };

    const cancel = async () => {
        runningRef.current = false;
        await bulk.cancel().catch(() => {});
        setStatus(normalizeStatus({ status: "canceled" }));
    };

    const resume = async () => {
        setResuming(true);
        try {
            const s = await bulk.resume();
            setStatus(normalizeStatus(s));
            runningRef.current = true;
            setTimeout(loop, 150);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Could not resume");
        } finally {
            setResuming(false);
        }
    };

    return (
        <div className="grid gap-6">
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
                    <Button variant="secondary" onClick={scan} disabled={status.status === "running"}>
                        Scan library
                    </Button>
                    <Button onClick={start} disabled={!canStart}>
                        Start conversion
                    </Button>
                    {status.status === "running" && (
                        <Button variant="ghost" onClick={cancel}>Cancel</Button>
                    )}
                    {pending !== null && status.status !== "running" && (
                        <span className="self-center text-sm text-ink-500">
                            {pending === 0 ? "Library already optimized." : `${pending} pending`}
                        </span>
                    )}
                </div>

                {(status.status === "running" || status.status === "done" || status.status === "paused_quota") && (
                    <div className="mt-5">
                        <Progress
                            value={pct}
                            label={`${status.processed} / ${status.total} · ${status.succeeded} ok · ${status.failed} failed`}
                        />
                    </div>
                )}

                {status.status === "paused_quota" && (
                    <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5 text-amber-700">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-semibold text-amber-900">Paused — monthly quota reached</h4>
                                <p className="mt-1 text-sm text-amber-900/80">
                                    {status.total - status.processed} of {status.total} images still to convert.
                                    Upgrade for instant access, or click Resume after the monthly reset.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {onUpgrade && (
                                        <button
                                            onClick={onUpgrade}
                                            className="inline-flex items-center h-9 px-4 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition shadow-sm"
                                        >
                                            Upgrade plan
                                        </button>
                                    )}
                                    <Button variant="secondary" onClick={resume} loading={resuming}>
                                        Resume
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {status.errors.length > 0 && (
                    <details className="mt-4">
                        <summary className="text-xs text-ink-500 cursor-pointer">
                            {status.errors.length} error{status.errors.length > 1 ? "s" : ""}
                        </summary>
                        <ul className="mt-2 text-xs text-red-700 max-h-48 overflow-auto space-y-0.5">
                            {status.errors.map((e, i) => (
                                <li key={i} className="font-mono">#{e.id} — {e.code}: {e.message}</li>
                            ))}
                        </ul>
                    </details>
                )}
            </Card>

            <Card className="bg-ink-50/50 border-dashed">
                <CardHeader title="How it works" />
                <ul className="space-y-2 text-sm text-ink-600">
                    <li>• We scan your media library for JPG, PNG and GIF images that haven't been optimized yet.</li>
                    <li>• For each attachment we send <strong>one batch</strong> with the original and all generated sizes to our API — that's <strong>1 credit</strong>.</li>
                    <li>• The original files stay untouched. A <code className="text-xs bg-white border border-ink-200 rounded px-1">.webp</code> (or <code className="text-xs bg-white border border-ink-200 rounded px-1">.avif</code>) sibling is written next to each size.</li>
                    <li>• If the process is interrupted (tab closed, server restart), click <em>Start</em> again — it resumes where it stopped.</li>
                </ul>
            </Card>
        </div>
    );
}
