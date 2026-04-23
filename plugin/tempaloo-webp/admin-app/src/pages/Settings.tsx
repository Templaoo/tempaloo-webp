import { useState } from "react";
import { api, type AppState } from "../api";
import { Button, Card, CardHeader, Switch, toast } from "../components/ui";

export default function Settings({ state, onState }: { state: AppState; onState: (s: AppState) => void }) {
    const [s, setS] = useState(state.settings);
    const [saving, setSaving] = useState(false);
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

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader title="Conversion" description="How images should be optimized." />

                <div className="grid gap-5">
                    <label className="grid gap-1.5 max-w-sm">
                        <span className="text-sm font-medium text-ink-900">Quality</span>
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
                        <span className="text-xs text-ink-500">Default is 82. Under 70 you'll start to see artifacts.</span>
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
