import { boot, type AppState } from "../api";
import { Badge, Button, Card, CardHeader, Skeleton } from "../components/ui";

/**
 * Sites tab — visible only when the user is on a multi-site plan
 * (Growth = 5 sites, Business / Unlimited = ∞). Shows the current
 * site as activated + a quota visualisation, and links out to
 * tempaloo.com/dashboard for cross-site management (since the
 * full list lives there, not in this plugin).
 */
export default function Sites({ state, onUpgrade }: { state: AppState; onUpgrade?: () => void }) {
    // While the parent is still hydrating quota counts (rare but possible
    // right after activate), show a skeleton instead of "1 / 5" placeholder.
    if (!state.quota) {
        return (
            <div className="grid gap-6">
                <Card>
                    <div className="space-y-4">
                        <Skeleton height={20} width={180} />
                        <Skeleton height={14} width="60%" />
                        <Skeleton height={8}  width="100%" />
                        <Skeleton height={64} width="100%" />
                        <div className="flex gap-2">
                            <Skeleton height={36} width={220} />
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    const sitesUsed = state.quota?.sitesUsed ?? 1;
    const sitesLimit = state.license.sitesLimit;
    const isUnlimited = sitesLimit === -1;
    const usagePct = isUnlimited ? 0 : Math.min(100, (sitesUsed / Math.max(1, sitesLimit)) * 100);
    const dashboardUrl = "https://tempaloo.com/webp/dashboard";

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader
                    title="Sites on your license"
                    description={
                        isUnlimited
                            ? `You're on ${state.license.plan.toUpperCase()} — unlimited sites per license.`
                            : `${state.license.plan.toUpperCase()} plan covers up to ${sitesLimit} sites per license.`
                    }
                    right={
                        <Badge variant={isUnlimited ? "success" : "brand"}>
                            {isUnlimited ? "Unlimited" : `${sitesUsed} / ${sitesLimit}`}
                        </Badge>
                    }
                />

                {/* Usage bar */}
                {!isUnlimited && (
                    <div className="mb-5">
                        <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                                style={{ width: `${usagePct}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] text-ink-500 mt-1.5 font-mono">
                            <span>{sitesUsed} site{sitesUsed > 1 ? "s" : ""} active</span>
                            <span>{sitesLimit - sitesUsed} slot{sitesLimit - sitesUsed !== 1 ? "s" : ""} free</span>
                        </div>
                    </div>
                )}

                {/* Current site card */}
                <div className="rounded-lg border border-ink-200 bg-ink-50/40 p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-100 grid place-items-center text-emerald-700 text-base shrink-0">
                        ●
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink-900 truncate">{boot.siteUrl || "(this site)"}</div>
                        <div className="text-xs text-ink-500 mt-0.5">
                            <strong className="text-emerald-700">Active</strong> · this is the WordPress install you&apos;re currently in.
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 items-center">
                    <a href={dashboardUrl} target="_blank" rel="noopener" className="inline-flex">
                        <Button variant="secondary">
                            Manage all sites on tempaloo.com →
                        </Button>
                    </a>
                    {!isUnlimited && sitesUsed >= sitesLimit && onUpgrade && (
                        <Button onClick={onUpgrade}>
                            Upgrade for more sites
                        </Button>
                    )}
                </div>
            </Card>

            {/* Help card */}
            <Card className="bg-ink-50/50 border-dashed">
                <CardHeader title="How sites work" />
                <ul className="space-y-2 text-sm text-ink-600">
                    <li>• A <strong>site</strong> = one WordPress install (one URL). Your license slot is consumed the first time the plugin pings the API from that URL.</li>
                    <li>• Subdomains (<code className="text-xs bg-white border border-ink-200 rounded px-1">staging.acme.com</code> + <code className="text-xs bg-white border border-ink-200 rounded px-1">acme.com</code>) count as <strong>two</strong>.</li>
                    <li>• To free a slot, deactivate the site from this plugin (Overview → Change license) or remove it from the dashboard on tempaloo.com.</li>
                    <li>• Quota (images per month) is shared across all sites on the same license.</li>
                </ul>
            </Card>
        </div>
    );
}
