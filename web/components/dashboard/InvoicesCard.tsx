import type { DashInvoice } from "@/lib/account";

/**
 * Invoices & payments — replaces the previous "Open Freemius portal"
 * link. Lists every payment + refund tied to the user's account, with
 * inline PDF download. The download passes through our /api/invoices
 * proxy so the Freemius internal key never touches the browser.
 *
 * Empty state covers two cases:
 *   · Never paid (free user only)               → friendly nudge to upgrade
 *   · Paid but Freemius API failed gracefully   → "couldn't load right now"
 *
 * Server component on purpose: invoice data already comes from the
 * server-side fetchInvoicesByEmail in the dashboard page; no need to
 * re-fetch client-side.
 */
export function InvoicesCard({ invoices }: { invoices: DashInvoice[] }) {
    const visible = invoices.slice(0, 6); // most recent 6, expand later if needed

    return (
        <div className="surface-card" style={{ padding: 18 }}>
            <div className="eyebrow">INVOICES &amp; PAYMENTS</div>

            {invoices.length === 0 ? (
                <>
                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                        No payments yet
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
                        You&apos;re on the Free plan — nothing to bill. Upgrade any time.
                    </p>
                </>
            ) : (
                <>
                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
                        {invoices.length === 1 ? "1 receipt" : `${invoices.length} receipts`}
                    </div>
                    <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {visible.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
                    </ul>
                    {invoices.length > visible.length && (
                        <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--ink-3)" }}>
                            Showing {visible.length} of {invoices.length}.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

function InvoiceRow({ invoice }: { invoice: DashInvoice }) {
    const amount = formatMoney(invoice.amountCents, invoice.currency);
    const date = invoice.createdAt
        ? new Date(invoice.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
        : "—";

    return (
        <li style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px",
            border: "1px solid var(--line)",
            borderRadius: 8,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 500, color: invoice.isRefund ? "var(--danger)" : "var(--ink)" }}>
                        {invoice.isRefund ? "−" : ""}{amount}
                    </span>
                    {invoice.planName && (
                        <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>· {invoice.planName}</span>
                    )}
                    {invoice.isRefund && (
                        <span className="font-mono" style={{ fontSize: 9.5, padding: "1px 5px", borderRadius: 3, background: "color-mix(in oklab, var(--danger) 14%, transparent)", color: "var(--danger)", fontWeight: 500, letterSpacing: "0.04em" }}>
                            REFUND
                        </span>
                    )}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{date}</div>
            </div>
            <a
                href={`/api/invoices?id=${encodeURIComponent(invoice.id)}`}
                title="Download PDF receipt"
                className="btn btn-ghost btn-sm"
                style={{ height: 28, padding: "0 10px", fontSize: 12 }}
            >
                PDF ↓
            </a>
        </li>
    );
}

function formatMoney(cents: number, currency: string): string {
    try {
        return new Intl.NumberFormat("en-EU", {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
        }).format(Math.abs(cents) / 100);
    } catch {
        return `${(Math.abs(cents) / 100).toFixed(2)} ${currency}`;
    }
}
