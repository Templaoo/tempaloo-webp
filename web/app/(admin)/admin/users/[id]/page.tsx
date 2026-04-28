import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGet, AdminApiError } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, Pill, EmptyRow } from "@/components/admin/Shell";
import { eur, num, relTime, shortDate, statusTone } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Resp {
    user: { id: string; email: string; freemius_user_id: number | null; created_at: string; updated_at: string };
    licenses: Array<{
        id: string; license_key: string; status: string; billing: string;
        current_period_start: string; current_period_end: string | null; canceled_at: string | null;
        created_at: string; plan_code: string; plan_name: string;
        images_per_month: number; max_sites: number;
        active_sites: string; images_used_this_month: number | null;
    }>;
    sites: Array<{
        id: string; license_id: string; site_url: string; site_host: string;
        wp_version: string | null; plugin_version: string | null;
        activated_at: string; deactivated_at: string | null; last_seen_at: string | null;
    }>;
    audit: Array<{ id: string; action: string; severity: string; ip: string; created_at: string; admin_email: string }>;
}

export default async function UserDetailPage({ params }: { params: { id: string } }) {
    let data: Resp;
    try {
        data = await adminGet<Resp>(`/admin/users/${encodeURIComponent(params.id)}`);
    } catch (e) {
        if (e instanceof AdminApiError && e.status === 404) notFound();
        throw e;
    }

    return (
        <>
            <PageHeader
                eyebrow="USER"
                title={data.user.email}
                subtitle={`Joined ${shortDate(data.user.created_at)} · Freemius #${data.user.freemius_user_id ?? "—"}`}
                right={<Link href="/admin/users" className="btn btn-ghost btn-sm">← All users</Link>}
            />

            <h2 style={sectionH}>Licenses ({data.licenses.length})</h2>
            <Table>
                <thead>
                    <tr>
                        <Th>Plan</Th>
                        <Th w={120}>Status</Th>
                        <Th w={100}>Billing</Th>
                        <Th w={120}>Sites</Th>
                        <Th w={140}>Used (mo)</Th>
                        <Th w={140}>Renews</Th>
                        <Th w={300}>License key</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.licenses.length === 0 ? <EmptyRow colSpan={7}>No licenses.</EmptyRow> :
                        data.licenses.map((l) => {
                            const tone = statusTone(l.status);
                            return (
                                <tr key={l.id}>
                                    <Td>{l.plan_name}</Td>
                                    <Td><Pill color={tone.color} bg={tone.bg}>{tone.label}</Pill></Td>
                                    <Td dim>{l.billing}</Td>
                                    <Td>{l.active_sites} / {l.max_sites === -1 ? "∞" : l.max_sites}</Td>
                                    <Td>{l.images_used_this_month != null ? num(l.images_used_this_month) : "0"} / {l.images_per_month === -1 ? "∞" : num(l.images_per_month)}</Td>
                                    <Td dim>{l.current_period_end ? shortDate(l.current_period_end) : "—"}</Td>
                                    <Td mono dim>{l.license_key}</Td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </Table>

            <h2 style={sectionH}>Sites ({data.sites.length})</h2>
            <Table>
                <thead>
                    <tr>
                        <Th>Host</Th>
                        <Th w={120}>Plugin</Th>
                        <Th w={120}>WP</Th>
                        <Th w={140}>Activated</Th>
                        <Th w={140}>Last seen</Th>
                        <Th w={120}>State</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.sites.length === 0 ? <EmptyRow colSpan={6}>No installs.</EmptyRow> :
                        data.sites.map((s) => (
                            <tr key={s.id}>
                                <Td>{s.site_host}</Td>
                                <Td mono dim>{s.plugin_version ?? "—"}</Td>
                                <Td mono dim>{s.wp_version ?? "—"}</Td>
                                <Td dim>{relTime(s.activated_at)}</Td>
                                <Td dim>{relTime(s.last_seen_at)}</Td>
                                <Td>
                                    {s.deactivated_at ? (
                                        <Pill color="var(--ink-3)" bg="var(--bg-2)">Inactive</Pill>
                                    ) : (
                                        <Pill color="var(--success)" bg="color-mix(in oklab, var(--success) 14%, transparent)">Active</Pill>
                                    )}
                                </Td>
                            </tr>
                        ))
                    }
                </tbody>
            </Table>

            <h2 style={sectionH}>Recent admin activity</h2>
            <Table>
                <thead>
                    <tr>
                        <Th w={180}>When</Th>
                        <Th>Action</Th>
                        <Th w={100}>Severity</Th>
                        <Th w={220}>By</Th>
                        <Th w={140}>IP</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.audit.length === 0 ? <EmptyRow colSpan={5}>No admin activity logged for this user.</EmptyRow> :
                        data.audit.map((a) => (
                            <tr key={a.id}>
                                <Td dim>{relTime(a.created_at)}</Td>
                                <Td mono>{a.action}</Td>
                                <Td><SeverityPill s={a.severity} /></Td>
                                <Td dim>{a.admin_email}</Td>
                                <Td mono dim>{a.ip}</Td>
                            </tr>
                        ))
                    }
                </tbody>
            </Table>
        </>
    );
}

function SeverityPill({ s }: { s: string }) {
    const m: Record<string, { color: string; bg: string }> = {
        info:     { color: "var(--ink-3)",  bg: "var(--bg-2)" },
        warn:     { color: "var(--warn)",   bg: "color-mix(in oklab, var(--warn) 14%, transparent)" },
        critical: { color: "var(--danger)", bg: "color-mix(in oklab, var(--danger) 14%, transparent)" },
    };
    const { color, bg } = m[s] ?? m.info!;
    return <Pill color={color} bg={bg}>{s}</Pill>;
}

const sectionH: React.CSSProperties = {
    margin: "32px 0 12px", fontSize: 14, fontWeight: 500,
    color: "var(--ink-2)", letterSpacing: "-0.01em",
};
