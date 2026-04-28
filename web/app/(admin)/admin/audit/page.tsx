import { adminGet } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, Pager, Pill, EmptyRow } from "@/components/admin/Shell";
import { relTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Resp {
    entries: Array<{
        id: number; admin_user_id: string | null; admin_email: string;
        action: string; severity: string;
        target_type: string | null; target_id: string | null;
        ip: string; user_agent: string | null;
        metadata: Record<string, unknown>; reason: string | null;
        created_at: string;
    }>;
    page: number; page_size: number;
}

export default async function AuditPage({ searchParams }: { searchParams: { admin_email?: string; action?: string; severity?: string; page?: string } }) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) sp.set(k, v);
    const data = await adminGet<Resp>(`/admin/audit?${sp.toString()}`);

    return (
        <>
            <PageHeader eyebrow="AUDIT" title="Audit log"
                subtitle="Every admin action — append-only. Refreshing this page is itself NOT logged (would loop)." />

            <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input name="action" defaultValue={searchParams.action ?? ""} placeholder="Action (e.g. licenses.list)"
                       style={{ flex: 1, minWidth: 220, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <input name="admin_email" defaultValue={searchParams.admin_email ?? ""} placeholder="Admin email"
                       style={{ flex: 1, minWidth: 220, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <select name="severity" defaultValue={searchParams.severity ?? ""} style={selectStyle}>
                    <option value="">All severity</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="critical">Critical</option>
                </select>
                <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
            </form>

            <Table>
                <thead>
                    <tr>
                        <Th w={150}>When</Th>
                        <Th>Action</Th>
                        <Th w={100}>Severity</Th>
                        <Th w={220}>By</Th>
                        <Th>Target</Th>
                        <Th w={130}>IP</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.entries.length === 0 ? <EmptyRow colSpan={6}>No audit entries.</EmptyRow> :
                        data.entries.map((e) => (
                            <tr key={e.id}>
                                <Td dim>{relTime(e.created_at)}</Td>
                                <Td mono>{e.action}</Td>
                                <Td><SevPill s={e.severity} /></Td>
                                <Td dim>{e.admin_email}</Td>
                                <Td mono dim>{e.target_type ? `${e.target_type}:${(e.target_id ?? "").slice(0, 12)}…` : "—"}</Td>
                                <Td mono dim>{e.ip}</Td>
                            </tr>
                        ))
                    }
                </tbody>
            </Table>
        </>
    );
}

function SevPill({ s }: { s: string }) {
    const m: Record<string, { color: string; bg: string }> = {
        info:     { color: "var(--ink-3)",  bg: "var(--bg-2)" },
        warn:     { color: "var(--warn)",   bg: "color-mix(in oklab, var(--warn) 14%, transparent)" },
        critical: { color: "var(--danger)", bg: "color-mix(in oklab, var(--danger) 14%, transparent)" },
    };
    const { color, bg } = m[s] ?? m.info!;
    return <Pill color={color} bg={bg}>{s}</Pill>;
}

const selectStyle: React.CSSProperties = {
    height: 36, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5,
};
