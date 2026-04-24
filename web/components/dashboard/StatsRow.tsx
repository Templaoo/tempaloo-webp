import type { DashLicense } from "./LicenseCard";

export function StatsRow({ licenses }: { licenses: DashLicense[] }) {
    const active = licenses.filter((l) => l.status === "active" || l.status === "trialing").length;
    const totalUsed = licenses.reduce((a, l) => a + l.quota.imagesUsed, 0);
    const totalSites = licenses.reduce((a, l) => a + l.sites.length, 0);
    const hasUnlimited = licenses.some((l) => l.plan.imagesPerMonth === -1);
    const totalLimit = hasUnlimited
        ? "∞"
        : licenses.reduce((a, l) => a + Math.max(0, l.plan.imagesPerMonth), 0).toLocaleString();

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Stat label="Active licenses" value={active.toString()} />
            <Stat label="Images this month" value={totalUsed.toLocaleString()} sub={`of ${totalLimit}`} />
            <Stat label="Sites optimized" value={totalSites.toString()} />
            <Stat label="Next reset" value={formatNextReset()} />
        </div>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div
            className="surface-card"
            style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 2 }}
        >
            <div className="eyebrow">{label}</div>
            <div className="h-display" style={{ marginTop: 6, fontSize: 24, fontWeight: 500, letterSpacing: "-0.03em", color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                {value}
            </div>
            {sub && (
                <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "'Geist Mono', monospace" }}>
                    {sub}
                </div>
            )}
        </div>
    );
}

function formatNextReset(): string {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const days = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return days === 0 ? "Today" : `in ${days}d`;
}
