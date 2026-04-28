import type { ReactNode } from "react";

/** Common page header — eyebrow + h1 + optional subtitle + right-side slot. */
export function PageHeader({ eyebrow, title, subtitle, right }: {
    eyebrow?: string;
    title: string;
    subtitle?: string;
    right?: ReactNode;
}) {
    return (
        <header style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            gap: 16, marginBottom: 24, flexWrap: "wrap",
        }}>
            <div>
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em" }}>{title}</h1>
                {subtitle && <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--ink-3)" }}>{subtitle}</p>}
            </div>
            {right && <div>{right}</div>}
        </header>
    );
}

/** Dense table primitive — borrowed from the dashboard surface look. */
export function Table({ children }: { children: ReactNode }) {
    return (
        <div className="surface-card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                {children}
            </table>
        </div>
    );
}

export function Th({ children, w }: { children: ReactNode; w?: number | string }) {
    return (
        <th style={{
            textAlign: "left", padding: "12px 16px",
            fontSize: 11, fontWeight: 500, color: "var(--ink-3)",
            letterSpacing: "0.04em", textTransform: "uppercase",
            borderBottom: "1px solid var(--line)",
            width: w,
        }}>{children}</th>
    );
}

export function Td({ children, mono, dim }: { children: ReactNode; mono?: boolean; dim?: boolean }) {
    return (
        <td style={{
            padding: "12px 16px", borderBottom: "1px solid var(--line)",
            color: dim ? "var(--ink-3)" : "var(--ink)",
            fontFamily: mono ? "var(--font-geist-mono), ui-monospace, monospace" : "inherit",
            fontSize: mono ? 12 : 13.5,
            whiteSpace: "nowrap",
        }}>{children}</td>
    );
}

/** A 4-card metric strip for the dashboard. */
export function MetricCard({ label, value, sub, accent }: {
    label: string;
    value: string;
    sub?: string;
    accent?: string;
}) {
    return (
        <div className="surface-card" style={{ padding: 20 }}>
            <div className="eyebrow">{label}</div>
            <div style={{
                marginTop: 8, fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em",
                color: accent ?? "var(--ink)",
            }}>{value}</div>
            {sub && <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-3)" }}>{sub}</div>}
        </div>
    );
}

/** Pill — used for license status, role, etc. */
export function Pill({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "3px 10px", borderRadius: 999,
            fontSize: 11, fontWeight: 500, letterSpacing: "0.01em",
            color, background: bg,
        }}>{children}</span>
    );
}

/** Empty-state for lists with no rows. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
    return (
        <tr>
            <td colSpan={colSpan} style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                {children}
            </td>
        </tr>
    );
}

/** Pagination. Replaces query-string `page` param via Link navigation. */
export function Pager({ page, pageSize, total, basePath, query }: {
    page: number; pageSize: number; total: number;
    basePath: string; query: Record<string, string | undefined>;
}) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return null;
    const make = (p: number) => {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v);
        sp.set("page", String(p));
        return `${basePath}?${sp.toString()}`;
    };
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: 12.5, color: "var(--ink-3)" }}>
            <div>Page {page} of {pages} · {total.toLocaleString()} total</div>
            <div style={{ display: "flex", gap: 6 }}>
                {page > 1 && <a href={make(page - 1)} className="btn btn-ghost btn-sm">← Prev</a>}
                {page < pages && <a href={make(page + 1)} className="btn btn-ghost btn-sm">Next →</a>}
            </div>
        </div>
    );
}
