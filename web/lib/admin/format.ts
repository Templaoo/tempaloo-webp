/**
 * Display helpers shared by admin pages.
 * EUR formatting + relative-time + status pills.
 */

export function eur(cents: number | string | null | undefined): string {
    const n = typeof cents === "string" ? Number(cents) : (cents ?? 0);
    if (!Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-EU", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: n >= 1000 ? 0 : 2,
    }).format(n / 100);
}

export function num(n: number | string | null | undefined): string {
    const v = typeof n === "string" ? Number(n) : (n ?? 0);
    if (!Number.isFinite(v)) return "—";
    return new Intl.NumberFormat("en-EU").format(v);
}

export function relTime(iso: string | Date | null | undefined): string {
    if (!iso) return "never";
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const ms = Date.now() - d.getTime();
    if (ms < 0) return "in the future";
    const min = Math.floor(ms / 60_000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

export function shortDate(iso: string | Date | null | undefined): string {
    if (!iso) return "—";
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/** Returns CSS color tokens (text + background-with-alpha) for a license status. */
export function statusTone(status: string): { color: string; bg: string; label: string } {
    switch (status) {
        case "active":   return { color: "var(--success)", bg: "color-mix(in oklab, var(--success) 14%, transparent)", label: "Active" };
        case "trialing": return { color: "var(--warn)",    bg: "color-mix(in oklab, var(--warn) 14%, transparent)",    label: "Trial" };
        case "past_due": return { color: "var(--danger)",  bg: "color-mix(in oklab, var(--danger) 14%, transparent)",  label: "Past due" };
        case "canceled": return { color: "var(--ink-3)",   bg: "var(--bg-2)",                                          label: "Canceled" };
        case "expired":  return { color: "var(--ink-3)",   bg: "var(--bg-2)",                                          label: "Expired" };
        default:         return { color: "var(--ink-3)",   bg: "var(--bg-2)",                                          label: status };
    }
}
