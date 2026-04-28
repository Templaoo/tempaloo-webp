import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGet, AdminApiError } from "@/lib/admin/api";
import { PageHeader, Pill } from "@/components/admin/Shell";
import { shortDate, relTime } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

interface Resp {
    event: {
        id: string; provider: string; event_id: string; event_type: string;
        payload: unknown;
        received_at: string; processed_at: string | null; processing_error: string | null;
    };
}

export default async function WebhookEventPage({ params }: { params: { id: string } }) {
    let data: Resp;
    try {
        data = await adminGet<Resp>(`/admin/webhooks/events/${encodeURIComponent(params.id)}`);
    } catch (e) {
        if (e instanceof AdminApiError && e.status === 404) notFound();
        throw e;
    }
    const ev = data.event;

    return (
        <>
            <PageHeader
                eyebrow="WEBHOOK"
                title={ev.event_type}
                subtitle={`${ev.provider} · ${shortDate(ev.received_at)} (${relTime(ev.received_at)})`}
                right={<Link href="/admin/webhooks" className="btn btn-ghost btn-sm">← All webhooks</Link>}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                <KV label="Event ID" value={ev.event_id} mono />
                <KV label="Provider" value={ev.provider} />
                <KV label="Status" value={
                    ev.processing_error ? <Pill color="var(--danger)" bg="color-mix(in oklab, var(--danger) 14%, transparent)">Error</Pill>
                    : ev.processed_at  ? <Pill color="var(--success)" bg="color-mix(in oklab, var(--success) 14%, transparent)">Processed</Pill>
                    :                    <Pill color="var(--warn)" bg="color-mix(in oklab, var(--warn) 14%, transparent)">Pending</Pill>
                } />
                <KV label="Processed at" value={ev.processed_at ? shortDate(ev.processed_at) : "—"} />
            </div>

            {ev.processing_error && (
                <div className="surface-card" style={{ padding: 16, marginBottom: 16, borderColor: "color-mix(in oklab, var(--danger) 30%, var(--line))" }}>
                    <div className="eyebrow" style={{ color: "var(--danger)" }}>ERROR</div>
                    <div style={{ marginTop: 6, fontFamily: "var(--font-geist-mono), ui-monospace, monospace", fontSize: 12.5 }}>
                        {ev.processing_error}
                    </div>
                </div>
            )}

            <div className="surface-card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="eyebrow" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>RAW PAYLOAD</div>
                <pre style={{
                    margin: 0, padding: 16, overflow: "auto", maxHeight: 600,
                    fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                    fontSize: 12, color: "var(--ink-2)", background: "var(--bg-2)",
                }}>
                    {JSON.stringify(ev.payload, null, 2)}
                </pre>
            </div>
        </>
    );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="surface-card" style={{ padding: 14 }}>
            <div className="eyebrow">{label}</div>
            <div style={{
                marginTop: 6, fontSize: mono ? 12 : 13.5,
                fontFamily: mono ? "var(--font-geist-mono), ui-monospace, monospace" : "inherit",
                wordBreak: "break-all",
            }}>{value}</div>
        </div>
    );
}
