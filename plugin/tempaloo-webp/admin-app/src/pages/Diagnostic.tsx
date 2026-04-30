import { useEffect, useState } from "react";
import { api, type StateAuditReport, type ReconcileOp, type ReconcileResult, type AttachmentDebugReport } from "../api";
import { Badge, Button, Card, CardHeader, Input, Skeleton, toast } from "../components/ui";

/**
 * Diagnostic page — surfaces drift between the 4 sources of truth so the
 * user can SEE why "Overview says X but Bulk says Y" instead of guessing.
 *
 *   1. Attachments table (WP)         — what WordPress thinks exists
 *   2. tempaloo_webp meta              — what the plugin claims to have converted
 *   3. Filesystem siblings             — what's actually on disk
 *   4. Bulk state + retry queue        — what's pending / stuck
 *
 * Each card shows raw counts. Drift indicators (orphans, ghosts, stuck
 * bulk, overage retries) are highlighted. The "Reconcile" button runs
 * a dry-run first, shows the user what would change, then asks for
 * confirmation before mutating anything.
 */
export default function Diagnostic() {
    const [report, setReport] = useState<StateAuditReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);
    const [reconcileBusy, setReconcileBusy] = useState(false);
    const [previewResult, setPreviewResult] = useState<ReconcileResult | null>(null);

    const fetchAudit = async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await api.stateAudit();
            setReport(r);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Audit failed");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAudit(); }, []);

    const previewReconcile = async () => {
        setReconcileBusy(true);
        try {
            const r = await api.stateReconcile({
                dryRun: true,
                fix: ["stuck_bulk", "overage_retries", "ghost_meta"],
            });
            setPreviewResult(r);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Reconcile preview failed");
        } finally {
            setReconcileBusy(false);
        }
    };

    const applyReconcile = async (ops: ReconcileOp[]) => {
        setReconcileBusy(true);
        try {
            const r = await api.stateReconcile({ dryRun: false, fix: ops });
            const total = r.stuckBulkReset + r.retriesDropped + r.ghostMetaCleared + r.orphanFilesRemoved;
            toast("success", `Reconciled — ${total} change${total === 1 ? "" : "s"} applied`);
            setPreviewResult(null);
            await fetchAudit();
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Reconcile failed");
        } finally {
            setReconcileBusy(false);
        }
    };

    if (loading && !report) {
        return (
            <div className="grid gap-6">
                <Card>
                    <CardHeader title="Diagnostic" description="Loading state inventory…" />
                    <div className="space-y-3">
                        {[0, 1, 2].map((i) => <Skeleton key={i} height={64} className="rounded-lg" />)}
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader title="Diagnostic" />
                <div className="text-sm text-red-700">Couldn&apos;t fetch audit: {error}</div>
                <Button onClick={fetchAudit} className="mt-3">Retry</Button>
            </Card>
        );
    }

    if (!report) return null;

    const driftIssues = computeDriftIssues(report);

    return (
        <div className="grid gap-6">
            {/* Drift summary */}
            <Card>
                <CardHeader
                    title="State consistency"
                    description="The plugin's view of your library spread across 4 sources of truth. They should all agree — when they don't, here's where."
                    right={<Button variant="ghost" onClick={fetchAudit} loading={loading}>Refresh</Button>}
                />

                {driftIssues.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900 flex items-center gap-3">
                        <span className="text-lg" aria-hidden>✓</span>
                        All four sources agree — no drift detected.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {driftIssues.map((d, i) => (
                            <div key={i} className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${
                                d.severity === "warn"
                                    ? "border-amber-200 bg-amber-50/70 text-amber-900"
                                    : "border-red-200 bg-red-50/70 text-red-900"
                            }`}>
                                <span className="text-lg mt-0.5" aria-hidden>{d.severity === "warn" ? "⚠" : "✗"}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold">{d.title}</div>
                                    <div className="text-xs mt-0.5 opacity-90 leading-relaxed">{d.detail}</div>
                                </div>
                            </div>
                        ))}
                        <div className="flex gap-2 mt-4">
                            <Button onClick={previewReconcile} loading={reconcileBusy} disabled={!!previewResult}>
                                Preview reconcile (dry-run)
                            </Button>
                            {previewResult && (
                                <Button
                                    variant="primary"
                                    onClick={() => applyReconcile(["stuck_bulk", "overage_retries", "ghost_meta"])}
                                    loading={reconcileBusy}
                                >
                                    Apply fixes
                                </Button>
                            )}
                        </div>

                        {previewResult && (
                            <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50/50 p-4 text-xs space-y-1.5 font-mono">
                                <div>{previewResult.stuckBulkReset > 0 ? "→" : "·"} Stuck bulk reset: <strong>{previewResult.stuckBulkReset}</strong></div>
                                <div>{previewResult.retriesDropped > 0 ? "→" : "·"} Retries past max-attempts dropped: <strong>{previewResult.retriesDropped}</strong></div>
                                <div>{previewResult.ghostMetaCleared > 0 ? "→" : "·"} Ghost meta cleared: <strong>{previewResult.ghostMetaCleared}</strong></div>
                                <div className="text-ink-500">(Orphan file deletion is opt-in — use the dedicated button below if needed.)</div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Source 1: Attachments */}
            <Card>
                <CardHeader title="Source 1 — WordPress attachments" description="Counts straight from wp_posts + wp_postmeta." />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                    <Stat label="Total (jpg/png/gif)" value={report.attachments.total} />
                    <Stat label="With tempaloo_webp meta" value={report.attachments.withMeta} accent="brand" />
                    <Stat label="With converted > 0" value={report.attachments.withConverted} accent="success" />
                    <Stat label="With skipped flags" value={report.attachments.withSkipped} accent={report.attachments.withSkipped > 0 ? "warn" : undefined} />
                    <Stat label="Broken paths" value={report.attachments.brokenPaths} accent={report.attachments.brokenPaths > 0 ? "danger" : undefined} />
                </div>
            </Card>

            {/* Source 2: Filesystem */}
            <Card>
                <CardHeader title="Source 2 — filesystem (uploads/)" description="Actual .webp/.avif files on disk, walked from each attachment's path." />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <Stat label=".webp siblings" value={report.filesystem.webpSiblings} />
                    <Stat label=".avif siblings" value={report.filesystem.avifSiblings} />
                    <Stat label="Orphans" value={report.filesystem.orphans} accent={report.filesystem.orphans > 0 ? "warn" : "success"} />
                    <Stat label="Ghosts" value={report.filesystem.ghosts} accent={report.filesystem.ghosts > 0 ? "danger" : "success"} />
                </div>

                {report.filesystem.orphanSamples.length > 0 && (
                    <details className="mt-4">
                        <summary className="text-xs text-amber-700 cursor-pointer hover:text-amber-800">
                            {report.filesystem.orphans} orphan{report.filesystem.orphans === 1 ? "" : "s"} (siblings on disk, no meta) — show first {report.filesystem.orphanSamples.length}
                        </summary>
                        <ul className="mt-2 text-[11px] font-mono text-ink-700 space-y-0.5">
                            {report.filesystem.orphanSamples.map((s) => (
                                <li key={s.id}>#{s.id} · {s.title || "(no title)"} · {s.file}</li>
                            ))}
                        </ul>
                    </details>
                )}
                {report.filesystem.ghostSamples.length > 0 && (
                    <details className="mt-2">
                        <summary className="text-xs text-red-700 cursor-pointer hover:text-red-800">
                            {report.filesystem.ghosts} ghost{report.filesystem.ghosts === 1 ? "" : "s"} (meta says converted, no siblings on disk) — show first {report.filesystem.ghostSamples.length}
                        </summary>
                        <ul className="mt-2 text-[11px] font-mono text-ink-700 space-y-0.5">
                            {report.filesystem.ghostSamples.map((s) => (
                                <li key={s.id}>#{s.id} · {s.title || "(no title)"} · {s.file}</li>
                            ))}
                        </ul>
                    </details>
                )}
            </Card>

            {/* Source 3: Bulk state */}
            <Card>
                <CardHeader title="Source 3 — bulk state option" description="What tempaloo_webp_bulk_state currently holds." />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <Stat label="Status" value={report.bulkState.status || "idle"} />
                    <Stat label="Total" value={report.bulkState.total} />
                    <Stat label="Processed" value={report.bulkState.processed} />
                    <Stat label="Remaining queue" value={report.bulkState.remaining} accent={report.bulkState.stuckRunning ? "danger" : undefined} />
                </div>
                {report.bulkState.stuckRunning && (
                    <div className="mt-3 text-xs text-red-700">
                        ⚠ Status is &quot;running&quot; for &gt;30 min with no tick. Almost always a closed tab mid-run. Reconcile resets it to idle.
                    </div>
                )}
            </Card>

            {/* Source 4: Retry queue */}
            <Card>
                <CardHeader title="Source 4 — retry queue option" description="Background retry queue (cron-driven, every 5 min)." />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <Stat label="Pending" value={report.retryQueue.pending} />
                    <Stat label="Due now" value={report.retryQueue.dueNow} accent={report.retryQueue.dueNow > 0 ? "brand" : undefined} />
                    <Stat label="Past max-attempts" value={report.retryQueue.overMaxAttempts} accent={report.retryQueue.overMaxAttempts > 0 ? "warn" : undefined} />
                    <Stat
                        label="Oldest enqueued"
                        value={report.retryQueue.oldestEnqueuedAt > 0 ? formatRelative(report.retryQueue.oldestEnqueuedAt) : "—"}
                    />
                </div>
            </Card>

            {/* Settings snapshot */}
            <Card>
                <CardHeader title="Settings (effective values)" description="What every other code path is reading. If something here is off, conversions silently skip." />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <Stat label="License valid" value={report.settings.licenseValid ? "yes" : "NO"} accent={report.settings.licenseValid ? "success" : "danger"} />
                    <Stat label="Plan" value={report.settings.plan || "—"} />
                    <Stat label="Auto-convert" value={report.settings.autoConvert ? "on" : "OFF"} accent={report.settings.autoConvert ? "success" : "warn"} />
                    <Stat label="Output format" value={report.settings.outputFormat} />
                    <Stat label="Serve WebP" value={report.settings.serveWebp ? "on" : "OFF"} accent={report.settings.serveWebp ? "success" : "warn"} />
                    <Stat label="Delivery mode" value={report.settings.deliveryMode} />
                    <Stat label="CDN passthrough" value={report.settings.cdnPassthrough ? "ON" : "off"} accent={report.settings.cdnPassthrough ? "warn" : undefined} />
                    <Stat label="AVIF allowed" value={report.settings.supportsAvif ? "yes" : "no"} />
                </div>
            </Card>

            <AttachmentInspector />

            <div className="text-[10px] text-ink-400 text-right font-mono">
                Audit took {report.durationMs}ms · last refreshed {new Date().toLocaleTimeString()}
            </div>
        </div>
    );
}

/* ── Inspect-by-ID forensic ─────────────────────────────────────────
 * The "Activity log says converted but Optimized column says no" case
 * needs a per-attachment ground-truth check. Type the ID, hit
 * Inspect, see exactly what's on disk + which meta locations are
 * populated. No more guessing whether the converter wrote files
 * that LiteSpeed (or anything) deleted right after.
 */
function AttachmentInspector() {
    const [id, setId] = useState("");
    const [busy, setBusy] = useState(false);
    const [report, setReport] = useState<AttachmentDebugReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    const inspect = async () => {
        const n = Number(id);
        if (!Number.isFinite(n) || n <= 0) {
            toast("error", "Enter a positive attachment ID");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const r = await api.attachmentDebug(n);
            setReport(r);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Inspect failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <CardHeader
                title="Inspect attachment by ID"
                description="Per-attachment forensic. Returns the meta in both storage locations side-by-side and the actual disk state of every size + format. Use this when Activity says converted but the Optimized column says no."
            />
            <div className="flex gap-2 max-w-md">
                <Input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="e.g. 45"
                    onKeyDown={(e) => { if (e.key === "Enter") inspect(); }}
                />
                <Button onClick={inspect} loading={busy}>Inspect</Button>
            </div>

            {error && (
                <div className="mt-3 text-sm text-red-700">Error: {error}</div>
            )}

            {report && (
                <div className="mt-5 space-y-4">
                    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-4 text-xs">
                        <div className="font-semibold text-ink-900 mb-2">#{report.attachmentId} · {report.title || "(no title)"}</div>
                        <div className="font-mono space-y-0.5 text-ink-700">
                            <div>mime: <strong>{report.mime}</strong></div>
                            <div>attached: <strong className={report.attachedExists ? "text-emerald-700" : "text-red-700"}>{report.attachedExists ? "exists" : "MISSING"}</strong> · {report.attachedBytes.toLocaleString()} bytes</div>
                            <div className="text-ink-500 break-all">{report.attachedFile}</div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-ink-200 p-4">
                        <div className="text-sm font-semibold text-ink-900 mb-2">Conversion meta — TWO storage locations</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div className={`rounded border p-3 ${report.metaPostMetaKey ? "border-emerald-300 bg-emerald-50/60" : "border-ink-200 bg-ink-50/40"}`}>
                                <div className="font-mono font-semibold mb-1">_tempaloo_webp post_meta</div>
                                <div className="text-[11px] text-ink-700 break-all">
                                    {report.metaPostMetaKey ? JSON.stringify(report.metaPostMetaKey) : <em className="text-ink-400">empty</em>}
                                </div>
                            </div>
                            <div className={`rounded border p-3 ${report.metaInsideMetadata ? "border-amber-300 bg-amber-50/50" : "border-ink-200 bg-ink-50/40"}`}>
                                <div className="font-mono font-semibold mb-1">_wp_attachment_metadata.tempaloo_webp (legacy)</div>
                                <div className="text-[11px] text-ink-700 break-all">
                                    {report.metaInsideMetadata ? JSON.stringify(report.metaInsideMetadata) : <em className="text-ink-400">empty (LiteSpeed strip footprint if it was here moments ago)</em>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-ink-200 p-4">
                        <div className="text-sm font-semibold text-ink-900 mb-2">Disk state — every size × format</div>
                        <div className="space-y-2">
                            {report.sizes.map((entry, i) => (
                                <div key={i} className="text-xs font-mono border-l-4 border-ink-200 pl-3 py-1">
                                    <div className="font-semibold text-ink-900">{entry.size}</div>
                                    <div className={entry.exists ? "text-emerald-700" : "text-red-700"}>
                                        {entry.exists ? "✓" : "✗"} original · {entry.bytes.toLocaleString()} B
                                    </div>
                                    {entry.webp && (
                                        <div className={entry.webp.exists ? "text-emerald-700" : "text-amber-700"}>
                                            {entry.webp.exists ? "✓" : "✗"} .webp · {entry.webp.bytes.toLocaleString()} B
                                        </div>
                                    )}
                                    {entry.avif && entry.avif.exists && (
                                        <div className="text-emerald-700">
                                            ✓ .avif · {entry.avif.bytes.toLocaleString()} B
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
}

interface DriftIssue { title: string; detail: string; severity: "warn" | "danger" }

function computeDriftIssues(r: StateAuditReport): DriftIssue[] {
    const issues: DriftIssue[] = [];

    if (r.bulkState.stuckRunning) {
        issues.push({
            severity: "danger",
            title: "Bulk run stuck on \"running\" for >30 min",
            detail: "A bulk job didn't finish cleanly — almost always because the tab was closed mid-tick. Reconcile resets the state to idle so you can scan again.",
        });
    }

    if (r.retryQueue.overMaxAttempts > 0) {
        issues.push({
            severity: "warn",
            title: `${r.retryQueue.overMaxAttempts} retry queue entr${r.retryQueue.overMaxAttempts === 1 ? "y" : "ies"} past max-attempts`,
            detail: "Background retries that exceeded the 6-attempt cap should auto-drop, but stragglers can persist if MAX_ATTEMPTS was bumped. Reconcile drops them so the queue stops trying.",
        });
    }

    if (r.filesystem.ghosts > 0) {
        issues.push({
            severity: "danger",
            title: `${r.filesystem.ghosts} ghost meta entr${r.filesystem.ghosts === 1 ? "y" : "ies"} (meta says converted, no file)`,
            detail: "These attachments have a tempaloo_webp meta block claiming conversion succeeded, but the .webp/.avif files are missing. Reconcile clears the meta so the next bulk re-flags them as pending.",
        });
    }

    if (r.filesystem.orphans > 0) {
        issues.push({
            severity: "warn",
            title: `${r.filesystem.orphans} orphan sibling${r.filesystem.orphans === 1 ? "" : "s"} (file on disk, no meta)`,
            detail: "Optimized files are sitting on disk for attachments that have no tempaloo_webp meta. Usually a leftover from a Restore that hit a permission lock. Use the dedicated orphan cleanup tool if you want to remove them.",
        });
    }

    if (r.attachments.brokenPaths > 0) {
        issues.push({
            severity: "warn",
            title: `${r.attachments.brokenPaths} attachment${r.attachments.brokenPaths === 1 ? "" : "s"} have broken paths`,
            detail: "WordPress thinks these attachments exist but their original file is missing on disk. Bulk skips them (we can't convert what isn't there). Check the Media Library for any rows showing as missing.",
        });
    }

    if (!r.settings.licenseValid) {
        issues.push({
            severity: "danger",
            title: "License is not valid",
            detail: "Every conversion is silently skipped because license_valid is false. Activate or refresh the license from the Overview tab.",
        });
    } else if (!r.settings.autoConvert) {
        issues.push({
            severity: "warn",
            title: "Auto-convert on upload is OFF",
            detail: "New uploads aren't being converted automatically. If you expect them to be — go to Settings → Conversion → toggle \"Auto-convert new uploads\" on.",
        });
    }

    if (r.settings.cdnPassthrough && r.attachments.withConverted > 0) {
        issues.push({
            severity: "warn",
            title: "CDN passthrough is ON",
            detail: "Plugin output is suppressed (no <picture> wrap, no URL rewriting). If your CDN doesn't actually serve WebP/AVIF, your visitors are getting plain JPGs.",
        });
    }

    return issues;
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: "brand" | "success" | "warn" | "danger" }) {
    const valueClass =
        accent === "success" ? "text-emerald-700"
      : accent === "warn"    ? "text-amber-700"
      : accent === "danger"  ? "text-red-700"
      : accent === "brand"   ? "text-brand-700"
      :                        "text-ink-900";
    return (
        <div>
            <div className="uppercase tracking-wide text-[10px] font-semibold text-ink-500">{label}</div>
            <div className={`mt-0.5 text-base font-semibold ${valueClass}`}>{value}</div>
        </div>
    );
}

function formatRelative(unix: number): string {
    if (!unix) return "—";
    const diffSec = Math.floor((Date.now() / 1000) - unix);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
}
