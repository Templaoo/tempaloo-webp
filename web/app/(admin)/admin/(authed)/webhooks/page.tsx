import Link from "next/link";
import { adminGet } from "@/lib/admin/api";
import { PageHeader, Table, Th, Td, EmptyRow, Pager, Pill } from "@/components/admin/Shell";
import { num, relTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Resp {
    events: Array<{
        id: string; provider: string; event_id: string; event_type: string;
        received_at: string; processed_at: string | null; processing_error: string | null;
        payload_size: number;
    }>;
    page: number; page_size: number; total: number;
}

export default async function WebhooksPage({ searchParams }: { searchParams: { provider?: string; type?: string; error?: string; page?: string } }) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v) sp.set(k, v);
    const data = await adminGet<Resp>(`/admin/webhooks/events?${sp.toString()}`);

    return (
        <>
            <PageHeader eyebrow="WEBHOOKS" title="Webhook events" subtitle={`${num(data.total)} total · filter by provider, event type, or errors only.`} />

            <form method="get" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input name="type" defaultValue={searchParams.type ?? ""} placeholder="Event type (license.created…)"
                       style={{ flex: 1, minWidth: 240, height: 36, padding: "0 12px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5 }} />
                <select name="provider" defaultValue={searchParams.provider ?? ""} style={selectStyle}>
                    <option value="">All providers</option>
                    <option value="freemius">Freemius</option>
                </select>
                <select name="error" defaultValue={searchParams.error ?? ""} style={selectStyle}>
                    <option value="">All</option>
                    <option value="true">With error</option>
                    <option value="false">Successful</option>
                </select>
                <button type="submit" className="btn btn-ghost btn-sm">Apply</button>
            </form>

            <Table>
                <thead>
                    <tr>
                        <Th w={140}>Received</Th>
                        <Th w={110}>Provider</Th>
                        <Th>Event type</Th>
                        <Th w={180}>Event id</Th>
                        <Th w={130}>Status</Th>
                        <Th w={100}>Size</Th>
                    </tr>
                </thead>
                <tbody>
                    {data.events.length === 0 ? <EmptyRow colSpan={6}>No webhook events.</EmptyRow> :
                        data.events.map((e) => (
                            <tr key={e.id}>
                                <Td dim>{relTime(e.received_at)}</Td>
                                <Td mono dim>{e.provider}</Td>
                                <Td>
                                    <Link href={`/admin/webhooks/${e.id}`} style={{ color: "var(--ink)", fontWeight: 500 }}>
                                        {e.event_type}
                                    </Link>
                                </Td>
                                <Td mono dim>{e.event_id.slice(0, 16)}{e.event_id.length > 16 ? "…" : ""}</Td>
                                <Td>
                                    {e.processing_error ? (
                                        <Pill color="var(--danger)" bg="color-mix(in oklab, var(--danger) 14%, transparent)">Error</Pill>
                                    ) : e.processed_at ? (
                                        <Pill color="var(--success)" bg="color-mix(in oklab, var(--success) 14%, transparent)">Processed</Pill>
                                    ) : (
                                        <Pill color="var(--warn)" bg="color-mix(in oklab, var(--warn) 14%, transparent)">Pending</Pill>
                                    )}
                                </Td>
                                <Td mono dim>{(e.payload_size / 1024).toFixed(1)} kb</Td>
                            </tr>
                        ))
                    }
                </tbody>
            </Table>

            <Pager page={data.page} pageSize={data.page_size} total={data.total} basePath="/admin/webhooks"
                   query={{ provider: searchParams.provider, type: searchParams.type, error: searchParams.error }} />
        </>
    );
}

const selectStyle: React.CSSProperties = {
    height: 36, padding: "0 12px", borderRadius: 8,
    border: "1px solid var(--line-2)", background: "var(--bg)", color: "var(--ink)", fontSize: 13.5,
};
