import { adminGet } from "@/lib/admin/api";
import { PageHeader, MetricCard } from "@/components/admin/Shell";
import { eur, num } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Overview {
    mrr_cents: number;
    arr_cents: number;
    paying_users: number;
    free_users: number;
    trialing_users: number;
    signups_7d: number;
    signups_30d: number;
    churned_30d: number;
    active_sites_30d: number;
    total_licenses: number;
    licenses_per_day: { day: string; count: number }[];
}

export default async function AdminDashboardPage() {
    const data = await adminGet<Overview>("/admin/metrics/overview");
    const arpu = data.paying_users > 0 ? data.mrr_cents / data.paying_users : 0;

    return (
        <>
            <PageHeader eyebrow="OVERVIEW" title="Dashboard" subtitle="Live revenue, growth and install state." />

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
                <MetricCard label="MRR" value={eur(data.mrr_cents)} sub={`ARR ${eur(data.arr_cents)}`} />
                <MetricCard label="PAYING" value={num(data.paying_users)} sub={`ARPU ${eur(Math.round(arpu))}`} />
                <MetricCard label="TRIALING" value={num(data.trialing_users)} sub="Active trials" />
                <MetricCard label="FREE" value={num(data.free_users)} sub="On free plan" />
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
                <MetricCard label="SIGNUPS 7D" value={num(data.signups_7d)} sub={`30d: ${num(data.signups_30d)}`} />
                <MetricCard label="CHURN 30D" value={num(data.churned_30d)} sub="Canceled licenses" accent={data.churned_30d > 0 ? "var(--danger)" : undefined} />
                <MetricCard label="ACTIVE SITES" value={num(data.active_sites_30d)} sub="Pinged < 30d" />
                <MetricCard label="LICENSES" value={num(data.total_licenses)} sub="All-time" />
            </section>

            <section className="surface-card" style={{ padding: 20 }}>
                <div className="eyebrow">LICENSES CREATED · LAST 30 DAYS</div>
                <DailyChart series={data.licenses_per_day} />
            </section>
        </>
    );
}

function DailyChart({ series }: { series: { day: string; count: number }[] }) {
    if (!series || series.length === 0) {
        return <div style={{ marginTop: 24, color: "var(--ink-3)", fontSize: 13 }}>No data.</div>;
    }
    const max = Math.max(1, ...series.map((d) => d.count));
    const W = 720, H = 140, pad = 12;
    const innerW = W - pad * 2;
    const innerH = H - pad * 2;
    const barW = innerW / series.length;
    return (
        <div style={{ marginTop: 16, overflow: "auto" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
                {series.map((d, i) => {
                    const h = (d.count / max) * innerH;
                    const x = pad + i * barW;
                    const y = pad + innerH - h;
                    return (
                        <g key={d.day}>
                            <rect x={x + 1} y={y} width={Math.max(2, barW - 2)} height={Math.max(1, h)}
                                  fill="var(--ink-2)" rx={2} opacity={0.85}>
                                <title>{`${d.day}: ${d.count}`}</title>
                            </rect>
                        </g>
                    );
                })}
                <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--line)" />
            </svg>
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--ink-3)" }}>
                <span>{series[0]?.day}</span>
                <span>peak {max}</span>
                <span>{series[series.length - 1]?.day}</span>
            </div>
        </div>
    );
}
