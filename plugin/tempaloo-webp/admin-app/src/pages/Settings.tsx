import { useState } from "react";
import { api, type AppState } from "../api";
import { Button, Card, CardHeader, DecompressionWave, FilesStream, Input, Modal, Switch, toast } from "../components/ui";

// Three quality presets — covers ~95% of use cases without exposing
// the slider's full range. The slider stays for power users.
const PRESETS: { label: string; quality: number; hint: string }[] = [
    { label: "Normal",     quality: 85, hint: "Visually identical, ~50% smaller" },
    { label: "Aggressive", quality: 75, hint: "Indistinguishable on web, ~65% smaller" },
    { label: "Ultra",      quality: 60, hint: "Smallest files, slight artifacts" },
];

const RESIZE_PRESETS: { label: string; width: number }[] = [
    { label: "Off",   width: 0    },
    { label: "1920", width: 1920 },
    { label: "2560", width: 2560 },
    { label: "3840", width: 3840 },
];

type RestoreStage = "idle" | "confirm" | "running" | "done";

export default function Settings({ state, onState }: { state: AppState; onState: (s: AppState) => void }) {
    const [s, setS] = useState(state.settings);
    const [saving, setSaving] = useState(false);
    const [restoreStage, setRestoreStage] = useState<RestoreStage>("idle");
    const [restoreConfirmText, setRestoreConfirmText] = useState("");
    const [restoreResult, setRestoreResult] = useState<{ restored: number; filesRemoved: number } | null>(null);
    const dirty = JSON.stringify(s) !== JSON.stringify(state.settings);

    const convertedCount = state.savings?.converted ?? 0;

    const save = async () => {
        setSaving(true);
        try {
            const next = await api.saveSettings(s);
            onState(next);
            toast("success", "Settings saved");
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const openRestore = () => {
        if (convertedCount === 0) {
            toast("info", "Nothing to restore — no images converted yet.");
            return;
        }
        setRestoreConfirmText("");
        setRestoreResult(null);
        setRestoreStage("confirm");
    };

    const closeRestore = () => {
        if (restoreStage === "running") return; // prevent close mid-deletion
        setRestoreStage("idle");
    };

    const runRestore = async () => {
        setRestoreStage("running");
        try {
            const res = await api.restore();
            onState(res.state);
            setRestoreResult({ restored: res.restored, filesRemoved: res.filesRemoved });
            setRestoreStage("done");
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Restore failed");
            setRestoreStage("confirm");
        }
    };

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader title="Conversion" description="How images should be optimized." />

                <div className="grid gap-5">
                    <div>
                        <div className="text-sm font-medium text-ink-900 mb-2">Compression preset</div>
                        <div className="grid grid-cols-3 gap-2 max-w-md">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => setS({ ...s, quality: p.quality })}
                                    className={
                                        "text-left rounded-lg border p-3 transition " +
                                        (s.quality === p.quality
                                            ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                                            : "border-ink-200 hover:border-ink-300")
                                    }
                                >
                                    <div className="text-sm font-semibold text-ink-900">{p.label}</div>
                                    <div className="text-xs text-ink-500 mt-0.5 leading-tight">{p.hint}</div>
                                    <div className="text-[10px] font-mono text-ink-400 mt-1">q={p.quality}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <label className="grid gap-1.5 max-w-sm">
                        <span className="text-sm font-medium text-ink-900">Custom quality</span>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={1}
                                max={100}
                                value={s.quality}
                                onChange={(e) => setS({ ...s, quality: Number(e.target.value) })}
                                className="flex-1 accent-brand-600"
                            />
                            <input
                                type="number"
                                min={1}
                                max={100}
                                value={s.quality}
                                onChange={(e) => setS({ ...s, quality: Math.min(100, Math.max(1, Number(e.target.value) || 82)) })}
                                className="h-9 w-16 rounded-lg border border-ink-200 text-center text-sm"
                            />
                        </div>
                        <span className="text-xs text-ink-500">Picking a preset above sets this. Under 60 you'll see artifacts on photos.</span>
                    </label>

                    <div>
                        <div className="text-sm font-medium text-ink-900 mb-2">Output format</div>
                        <div className="grid grid-cols-2 gap-2 max-w-sm">
                            <FormatOption
                                value="webp"
                                current={s.outputFormat}
                                onSelect={() => setS({ ...s, outputFormat: "webp" })}
                                title="WebP"
                                subtitle="Best compatibility"
                            />
                            <FormatOption
                                value="avif"
                                current={s.outputFormat}
                                onSelect={() => state.license.supportsAvif && setS({ ...s, outputFormat: "avif" })}
                                title="AVIF"
                                subtitle={state.license.supportsAvif ? "Smaller files" : "Requires Starter+"}
                                disabled={!state.license.supportsAvif}
                            />
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Resize on upload"
                    description="Shrink huge photos down to a sensible web width before WordPress generates thumbnails. Saves quota and disk space."
                />
                <div className="grid grid-cols-4 gap-2 max-w-md">
                    {RESIZE_PRESETS.map((p) => (
                        <button
                            key={p.label}
                            type="button"
                            onClick={() => setS({ ...s, resizeMaxWidth: p.width })}
                            className={
                                "rounded-lg border py-2 text-sm font-medium transition " +
                                (s.resizeMaxWidth === p.width
                                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100 text-ink-900"
                                    : "border-ink-200 text-ink-700 hover:border-ink-300")
                            }
                        >
                            {p.label}
                            {p.width > 0 && <span className="text-[10px] text-ink-500 ml-1">px</span>}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-ink-500 mt-3 max-w-md">
                    Uses WordPress core's built-in scaler (since WP 5.3). The
                    original is preserved as a <code className="text-[11px] bg-ink-100 px-1 rounded">-scaled-original</code> sibling
                    so nothing is lost.
                </p>
            </Card>

            <Card>
                <CardHeader title="Automation" description="When should the plugin kick in?" />
                <div className="grid gap-4">
                    <Switch
                        checked={s.autoConvert}
                        onChange={(v) => setS({ ...s, autoConvert: v })}
                        label="Convert on upload"
                        description="Every new image added to the library is optimized automatically."
                    />
                    <Switch
                        checked={s.serveWebp}
                        onChange={(v) => setS({ ...s, serveWebp: v })}
                        label="Serve WebP/AVIF"
                        description="Replace image URLs at render time for browsers that support the new formats. Originals remain untouched."
                    />
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Restore originals"
                    description="One-click delete of every .webp/.avif file we generated. Your original JPEG/PNG/GIF files are never touched and remain on the server."
                />
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <Button
                        variant="secondary"
                        onClick={openRestore}
                        disabled={convertedCount === 0}
                    >
                        Restore {convertedCount ? `(${convertedCount.toLocaleString()} images)` : "originals"}
                    </Button>
                    <span className="text-xs text-ink-500">
                        Safe: only the converted siblings are removed. You can re-run a Bulk conversion afterward.
                    </span>
                </div>
            </Card>

            {/* ─── Restore modal — 3-state machine ───────────────────────── */}
            <RestoreModal
                stage={restoreStage}
                onClose={closeRestore}
                onConfirm={runRestore}
                onDone={() => setRestoreStage("idle")}
                convertedCount={convertedCount}
                confirmText={restoreConfirmText}
                onConfirmTextChange={setRestoreConfirmText}
                result={restoreResult}
            />

            <div className="flex justify-end gap-2 sticky bottom-4">
                <Button variant="secondary" onClick={() => setS(state.settings)} disabled={!dirty || saving}>Reset</Button>
                <Button onClick={save} disabled={!dirty} loading={saving}>Save changes</Button>
            </div>
        </div>
    );
}

function FormatOption({ value, current, onSelect, title, subtitle, disabled }: {
    value: string;
    current: string;
    onSelect: () => void;
    title: string;
    subtitle: string;
    disabled?: boolean;
}) {
    const selected = current === value;
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            className={
                "text-left rounded-lg border p-3 transition " +
                (selected
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-ink-200 hover:border-ink-300") +
                (disabled ? " opacity-50 cursor-not-allowed" : "")
            }
        >
            <div className="text-sm font-semibold text-ink-900">{title}</div>
            <div className="text-xs text-ink-500 mt-0.5">{subtitle}</div>
        </button>
    );
}

/* ── Restore modal — confirm → running → done ───────────────────────── */
function RestoreModal({
    stage, onClose, onConfirm, onDone, convertedCount, confirmText, onConfirmTextChange, result,
}: {
    stage: RestoreStage;
    onClose: () => void;
    onConfirm: () => void;
    onDone: () => void;
    convertedCount: number;
    confirmText: string;
    onConfirmTextChange: (v: string) => void;
    result: { restored: number; filesRemoved: number } | null;
}) {
    const open = stage !== "idle";
    const isConfirm = stage === "confirm";
    const isRunning = stage === "running";
    const isDone    = stage === "done";

    const canConfirm = confirmText.trim().toUpperCase() === "RESTORE";

    const title = isDone
        ? "Restore complete"
        : isRunning
            ? "Restoring…"
            : "Restore originals?";

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            size="lg"
            variant={isDone ? "success" : "danger"}
        >
            {/* CONFIRM stage */}
            {isConfirm && (
                <div className="space-y-5">
                    <DecompressionWave />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3.5">
                            <div className="flex items-start gap-2">
                                <span className="text-red-600 text-base leading-none mt-0.5">⚠</span>
                                <div>
                                    <div className="text-sm font-semibold text-red-900">Will be deleted</div>
                                    <ul className="text-xs text-red-800 mt-1 space-y-1">
                                        <li>• ~{(convertedCount * 7).toLocaleString()} <code className="bg-white/60 px-1 rounded">.webp</code> / <code className="bg-white/60 px-1 rounded">.avif</code> files</li>
                                        <li>• The <code className="bg-white/60 px-1 rounded">tempaloo_webp</code> meta block on {convertedCount.toLocaleString()} attachments</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5">
                            <div className="flex items-start gap-2">
                                <span className="text-emerald-600 text-base leading-none mt-0.5">🛡</span>
                                <div>
                                    <div className="text-sm font-semibold text-emerald-900">Will NOT be touched</div>
                                    <ul className="text-xs text-emerald-800 mt-1 space-y-1">
                                        <li>• Your <code className="bg-white/60 px-1 rounded">.jpg</code> / <code className="bg-white/60 px-1 rounded">.png</code> / <code className="bg-white/60 px-1 rounded">.gif</code> originals</li>
                                        <li>• Your monthly quota (refunds aren&apos;t given)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-ink-900 mb-1.5">
                            Type <code className="bg-ink-100 px-1.5 py-0.5 rounded font-mono text-[12px]">RESTORE</code> to confirm:
                        </label>
                        <Input
                            value={confirmText}
                            onChange={(e) => onConfirmTextChange(e.target.value)}
                            placeholder="RESTORE"
                            className="font-mono uppercase"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && canConfirm) onConfirm();
                            }}
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button variant="danger" onClick={onConfirm} disabled={!canConfirm}>
                            Restore {convertedCount.toLocaleString()} attachments
                        </Button>
                    </div>
                </div>
            )}

            {/* RUNNING stage */}
            {isRunning && (
                <div className="py-2 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10">
                            <div className="absolute inset-0 rounded-full border-4 border-amber-200" />
                            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold text-ink-900">Removing converted siblings…</div>
                            <div className="text-xs text-ink-500">Originals on disk are untouched.</div>
                        </div>
                    </div>
                    <FilesStream count={12} kind="restore" />
                </div>
            )}

            {/* DONE stage */}
            {isDone && result && (
                <div className="py-2 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-emerald-100 grid place-items-center text-emerald-600 text-2xl">
                            ✓
                        </div>
                        <div>
                            <div className="text-base font-semibold text-ink-900">All clean.</div>
                            <div className="text-sm text-ink-600">
                                <strong className="text-ink-900">{result.restored.toLocaleString()}</strong> attachment{result.restored !== 1 ? "s" : ""} restored ·
                                <strong className="text-ink-900">{" "}{result.filesRemoved.toLocaleString()}</strong> sibling file{result.filesRemoved !== 1 ? "s" : ""} removed
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm text-ink-700">
                        <div className="font-semibold text-ink-900 mb-1.5">What&apos;s next?</div>
                        <ul className="text-xs text-ink-600 space-y-1.5">
                            <li>→ Re-run <strong>Bulk</strong> to regenerate WebP/AVIF with current settings</li>
                            <li>→ Or change quality / format settings first, then run Bulk</li>
                            <li>→ Or just leave it — your originals serve as-is from now on</li>
                        </ul>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={onDone}>Close</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
