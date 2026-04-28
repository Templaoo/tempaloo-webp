import Link from "next/link";
import { adminGet } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, EmptyRow, Pager, Pill } from "@/components/admin/Shell";
import { num, relTime, statusTone } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Resp {
    installs: Array<{
        id: string; license_id: string; site_url: string; site_host: string;
        wp_version: string | null; plugin_version: string | null;
        activated_at: string; deactivated_at: string | null; last_seen_at: string | null;
        license_key: string; license_status: string;
        plan_code: string; plan_name: string;
        user_id: string; email: string;
    }>;
    page: number; page_size: number; total: number;
}

export default async function InstallsPage({ searchParams }: { searchParams: { q?: string; active?: string; stale_days?: string; page?: string } }) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) sp.set(k, v);
    const data = await adminGet<Resp>(`/admin/installs?${sp.toString()}`);

    return (
        <>
            <PageHeader eyebrow="INSTALLS" title="Sites & installs"
                subtitle={`${num(data.total)} total · spot stale installs and version drift.`} />

            <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Search host or email…"
                       style={{ flex: 1, minWidth: 240, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <select name="active" defaultValue={searchParams.active ?? ""} style={selectStyle}>
                    <option value="">All</option>
                    <option value="true">Active only</option>
                    <option value="false">Deactivated only</option>
                </select>
                <select name="stale_days" defaultValue={searchParams.stale_days ?? ""} style={selectStyle}>
                    <option value="">Any age</option>
                    <option value="7">{"Stale > 7d"}</option>
                    <option value="30">{"Stale > 30d"}</option>
                    <option value="90">{"Stale > 90d"}</option>
                </select>
                <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
            </form>

            <Table>
                <thead>
                    <tr>
                        <Th>Host</Th>
                        <Th>Email</Th>
                        <Th w={120}>Plan</Th>
                        <Th w={100}>Plugin</Th>
                        <Th w={100}>WP</Th>
                        <Th w={120}>Last seen</Th>
                        <Th w={100}>State</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.installs.length === 0 ? <EmptyRow colSpan={7}>No installs match this filter.</EmptyRow> :
                        data.installs.map((s) => {
                            const lic = statusTone(s.license_status);
                            return (
                                <tr key={s.id}>
                                    <Td>{s.site_host}</Td>
                                    <Td>
                                        <Link href={`/admin/users/${s.user_id}`} style={{ color: "var(--ink)" }}>{s.email}</Link>
                                    </Td>
                                    <Td>
                                        <Pill color={lic.color} bg={lic.bg}>{s.plan_name}</Pill>
                                    </Td>
                                    <Td mono dim>{s.plugin_version ?? "—"}</Td>
                                    <Td mono dim>{s.wp_version ?? "—"}</Td>
                                    <Td dim>{relTime(s.last_seen_at)}</Td>
                                    <Td>
                                        {s.deactivated_at ? (
                                            <Pill color="var(--ink-3)" bg="var(--bg-2)">Inactive</Pill>
                                        ) : (
                                            <Pill color="var(--success)" bg="color-mix(in oklab, var(--success) 14%, transparent)">Active</Pill>
                                        )}
                                    </Td>
                                </tr>
                            );
                        })
                    }
                </tbody>
            </Table>

            <Pager page={data.page} pageSize={data.page_size} total={data.total} basePath="/admin/installs"
                   query={{ q: searchParams.q, active: searchParams.active, stale_days: searchParams.stale_days }} />
        </>
    );
}

const selectStyle: React.CSSProperties = {
    height: 36, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5,
};
