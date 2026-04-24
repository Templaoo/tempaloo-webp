import { useState } from "react";
import { api, boot, formatBytes, type AppState } from "../api";
import { Badge, Button, Card, CardHeader, Input, QuotaRing, Stat, toast } from "../components/ui";

export default function Overview({ state, onState, freeQuota }: { state: AppState; onState: (s: AppState) => void; freeQuota: number | null }) {
    const [key, setKey] = useState(state.license.key);
    const [activating, setActivating] = useState(false);

    const activate = async () => {
        if (!key.trim()) {
            toast("error", "Enter a license key");
            return;
        }
        setActivating(true);
        try {
            const next = await api.activate(key.trim());
            onState(next);
            toast("success", "License activated");
        } catch (e) {
            toast("error", e instanceof Error ? e.message : "Activation failed");
        } finally {
            setActivating(false);
        }
    };

    const quota = state.quota;
    const limit = quota?.imagesLimit ?? state.license.imagesLimit;
    const used = quota?.imagesUsed ?? 0;
    const remaining = limit === -1 ? "∞" : Math.max(0, limit - used).toLocaleString();
    const resetDate = quota?.periodEnd
        ? new Date(quota.periodEnd).toLocaleDateString(undefined, { day: "numeric", month: "short" })
        : "—";

    return (
        <div className="grid gap-6">
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
                            <div className="font-semibold text-ink-900">{used}</div>
                        </div>
                        <div>
                            <div className="text-xs text-ink-500">Left</div>
                            <div className="font-semibold text-ink-900">{remaining}</div>
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
                                sub={"attachments across all sizes"}
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

            {state.license.valid && (
                <Card>
                    <CardHeader
                        title="Change license"
                        description="Paste a different key if you're switching plans or sites."
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            className="font-mono text-xs"
                            placeholder="Paste a license key"
                        />
                        <Button onClick={activate} loading={activating} variant="secondary">
                            Replace
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
