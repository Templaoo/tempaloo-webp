import { useState } from "react";
import { api, type AppState } from "../api";
import { Button, Card, CardHeader, Switch, toast } from "../components/ui";

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

export default function Settings({ state, onState }: { state: AppState; onState: (s: AppState) => void }) {
    const [s, setS] = useState(state.settings);
    const [saving, setSaving] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const dirty = JSON.stringify(s) !== JSON.stringify(state.settings);

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

    const restore = async () => {
        const converted = state.savings?.converted ?? 0;
        if (converted === 0) {
            toast("info", "Nothing to restore — no images converted yet.");
            return;
        }
        // Browser confirm() is plain but it's the WP-admin convention and
        // doesn't pull in a modal lib. Good enough for a destructive action
        // gated behind capability check.
        if (!window.confirm(
            `Delete the .webp/.avif files for ${converted} converted images?\n\n` +
            `Your originals (.jpg / .png / .gif) are NOT touched. The plugin will ` +
            `re-convert images on the next upload or bulk run.`
        )) return;
        setRestoring(true);
        try {
            const res = await api.restore();
            onState(res.state);
            toast("success", `Restored ${res.restored} images (${res.filesRemoved} files removed).`);
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Restore failed");
        } finally {
            setRestoring(false);
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
                        onClick={restore}
                        loading={restoring}
                        disabled={(state.savings?.converted ?? 0) === 0}
                    >
                        Restore {state.savings?.converted ? `(${state.savings.converted} images)` : "originals"}
                    </Button>
                    <span className="text-xs text-ink-500">
                        Safe: only the converted siblings are removed. You can re-run a Bulk conversion afterward.
                    </span>
                </div>
            </Card>

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
