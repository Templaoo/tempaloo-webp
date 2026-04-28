import { useEffect, useMemo, useState } from "react";
import { api, type ActivityEvent } from "../api";
import { Button, Card, CardHeader, Modal, toast } from "../components/ui";

type LevelFilter = "all" | "success" | "info" | "warn" | "error";

const LEVEL_LABEL: Record<LevelFilter, string> = {
    all: "All",
    success: "Success",
    info: "Info",
    warn: "Warnings",
    error: "Errors",
};

/**
 * Activity log — chronological event timeline. Reads from the
 * `tempaloo_webp_activity` option (rolling 200-event buffer) via the
 * /v1/activity REST endpoint. Filterable by level, exportable to CSV
 * for agencies that bill clients per conversion.
 */
export default function Activity() {
    const [events, setEvents] = useState<ActivityEvent[] | null>(null);
    const [filter, setFilter] = useState<LevelFilter>("all");
    const [loading, setLoading] = useState(true);
    const [clearOpen, setClearOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        try {
            const r = await api.activity();
            setEvents(r.events);
        } catch (e) {
            toast({ kind: "error", title: "Activity load failed", text: e instanceof Error ? e.message : "Network error" });
            setEvents([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(
        () => (events ?? []).filter((e) => filter === "all" || e.level === filter),
        [events, filter]
    );

    const counts = useMemo(() => {
        const c: Record<LevelFilter, number> = { all: 0, success: 0, info: 0, warn: 0, error: 0 };
        for (const e of events ?? []) {
            c.all++;
            const k = e.level as LevelFilter;
            if (k in c) c[k] += 1;
        }
        return c;
    }, [events]);

    const exportCsv = () => {
        const rows = [["timestamp_utc", "type", "level", "message", "meta"]];
        for (const e of events ?? []) {
            rows.push([
                new Date(e.at * 1000).toISOString(),
                e.type,
                e.level,
                JSON.stringify(e.message),
                JSON.stringify(e.meta),
            ]);
        }
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tempaloo-activity-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast({ kind: "success", title: "CSV exported", text: `${rows.length - 1} events written.` });
    };

    const doClear = async () => {
        try {
            await api.clearActivity();
            setEvents([]);
            setClearOpen(false);
            toast({ kind: "info", title: "Activity log cleared", text: "Future events will keep accumulating." });
        } catch (e) {
            toast({ kind: "error", text: e instanceof Error ? e.message : "Could not clear" });
        }
    };

    return (
        <div className="grid gap-6">
            <Card>
                <CardHeader
                    title="Activity log"
                    description="Last 200 plugin events — conversions, license changes, restores. Filter, refresh, or export to CSV for client invoicing."
                    right={
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => { setRefreshing(true); load(); }} loading={refreshing}>
                                Refresh
                            </Button>
                            <Button variant="ghost" size="sm" onClick={exportCsv} disabled={(events ?? []).length === 0}>
                                Export CSV
                            </Button>
                        </div>
                    }
                />

                {/* Filter pills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {(Object.keys(LEVEL_LABEL) as LevelFilter[]).map((k) => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => setFilter(k)}
                            className={
                                "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition " +
                                (filter === k
                                    ? "bg-ink-900 text-white"
                                    : "bg-ink-100 text-ink-700 hover:bg-ink-200")
                            }
                        >
                            <span>{LEVEL_LABEL[k]}</span>
                            <span className={filter === k ? "text-white/70" : "text-ink-500"}>{counts[k]}</span>
                        </button>
                    ))}
                </div>

                {/* Timeline */}
                {loading ? (
                    <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-12 bg-ink-100 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-center text-sm text-ink-500">
                        {events && events.length === 0
                            ? "No activity yet — upload an image or run a Bulk to populate this log."
                            : "No events match this filter."}
                    </div>
                ) : (
                    <ol className="relative space-y-1">
                        <span className="absolute left-[15px] top-2 bottom-2 w-px bg-ink-200" aria-hidden />
                        {filtered.map((e) => <Row key={e.id} event={e} />)}
                    </ol>
                )}

                {events && events.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-ink-100 flex items-center justify-between text-xs text-ink-500">
                        <span>Showing {filtered.length} of {events.length} events · capped at 200 (rolling)</span>
                        <button
                            onClick={() => setClearOpen(true)}
                            className="text-red-600 hover:text-red-800 underline-offset-2 hover:underline"
                        >
                            Clear log
                        </button>
                    </div>
                )}
            </Card>

            <Modal
                open={clearOpen}
                onClose={() => setClearOpen(false)}
                title="Clear the activity log?"
                description="This wipes the local event history. Future events will be recorded as usual. Your converted images and license aren't affected."
                variant="danger"
                size="sm"
            >
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={() => setClearOpen(false)}>Cancel</Button>
                    <Button variant="danger" onClick={doClear}>Clear log</Button>
                </div>
            </Modal>
        </div>
    );
}

function Row({ event }: { event: ActivityEvent }) {
    const ago = useMemo(() => relativeTime(event.at), [event.at]);
    const palette =
        event.level === "success" ? { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : event.level === "error"   ? { dot: "bg-red-500",     chip: "bg-red-50 text-red-700 border-red-200" }
      : event.level === "warn"    ? { dot: "bg-amber-500",   chip: "bg-amber-50 text-amber-700 border-amber-200" }
      :                              { dot: "bg-ink-400",    chip: "bg-ink-100 text-ink-700 border-ink-200" };

    return (
        <li className="relative flex items-start gap-3 py-2 pl-9 pr-2 group">
            {/* Timeline dot */}
            <span className={`absolute left-3 top-3.5 w-2 h-2 rounded-full ${palette.dot} ring-4 ring-white`} aria-hidden />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-ink-900 leading-tight">{event.message}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${palette.chip}`}>
                        {event.type}
                    </span>
                </div>
                <div className="text-[11px] text-ink-500 font-mono mt-0.5" title={new Date(event.at * 1000).toLocaleString()}>
                    {ago}
                    {event.meta && Object.keys(event.meta).length > 0 && (
                        <span className="ml-2 text-ink-400">· {summarize(event.meta)}</span>
                    )}
                </div>
            </div>
        </li>
    );
}

function relativeTime(unixSec: number): string {
    const diff = Math.floor(Date.now() / 1000) - unixSec;
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function summarize(meta: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(meta)) {
        if (v == null) continue;
        const str = typeof v === "object" ? JSON.stringify(v) : String(v);
        parts.push(`${k}=${str}`);
        if (parts.length >= 3) break;
    }
    return parts.join(" · ");
}
