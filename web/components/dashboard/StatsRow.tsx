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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Active licenses" value={active.toString()} />
            <Stat label="Images this month" value={totalUsed.toLocaleString()} sub={`of ${totalLimit}`} />
            <Stat label="Sites optimized" value={totalSites.toString()} />
            <Stat label="Next reset" value={formatNextReset()} />
        </div>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="glass rounded-2xl p-5">
            <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
            <div className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</div>
            {sub && <div className="mt-0.5 text-xs text-white/50">{sub}</div>}
        </div>
    );
}

function formatNextReset(): string {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const days = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return days === 0 ? "Today" : `in ${days}d`;
}
