import type { DashLicense } from "@/components/dashboard/LicenseCard";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
const INTERNAL_KEY = process.env.TEMPALOO_INTERNAL_KEY ?? "dev-internal-17f4e6a9-please-change-in-prod";

/**
 * Customer-facing license fetch.
 *
 * Strict rule: the customer dashboard surfaces AT MOST ONE license per
 * user. The webhook handler enforces single-active-per-user server-side
 * (see api/src/routes/webhooks.ts), but the dashboard adds a defensive
 * second layer here — even if drift / sandbox quirks / a Freemius reconcile
 * leaves multiple rows live, the user only ever sees one.
 *
 * Admin views (/admin/licenses, /admin/users/[id]) call the API directly
 * and are unaffected — admins need the full history to diagnose.
 *
 * Selection priority:
 *   1. trialing or active   (the live ones)
 *   2. past_due             (still recoverable, show so the user can fix)
 *   3. canceled or expired  (history fallback — beats showing EmptyState
 *      since it explains WHY the user is locked out + offers Reactivate)
 *
 * Within each tier: most recent createdAt wins.
 */
export async function fetchLicensesByEmail(email: string): Promise<DashLicense[]> {
    const res = await fetch(`${API_BASE}/account/licenses`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": INTERNAL_KEY,
        },
        body: JSON.stringify({ email }),
        cache: "no-store",
    });
    if (!res.ok) {
        throw new Error(`Account API returned ${res.status}`);
    }
    const data = (await res.json()) as { licenses: DashLicense[] };
    const primary = pickPrimaryLicense(data.licenses);
    return primary ? [primary] : [];
}

/** Customer-dashboard primary-license picker. Exported so other surfaces
 *  (Upgrade page, plugin Activate flow) can apply the same rule. */
export function pickPrimaryLicense(licenses: DashLicense[]): DashLicense | null {
    if (licenses.length === 0) return null;
    const tier = (s: string) =>
        s === "trialing" || s === "active" ? 0
        : s === "past_due" ? 1
        : 2;
    return [...licenses].sort((a, b) => {
        const t = tier(a.status) - tier(b.status);
        if (t !== 0) return t;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })[0] ?? null;
}

export interface DashInvoice {
    id: string;
    amountCents: number;
    currency: string;
    createdAt: string | null;
    planName: string | null;
    isRefund: boolean;
    gateway: string | null;
    externalId: string | null;
}

/** Server-only. Lists payments + refund history for the verified email. */
export async function fetchInvoicesByEmail(email: string): Promise<DashInvoice[]> {
    const res = await fetch(`${API_BASE}/account/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-Key": INTERNAL_KEY },
        body: JSON.stringify({ email }),
        cache: "no-store",
    });
    if (!res.ok) {
        if (res.status === 503) return []; // Freemius not configured — degrade gracefully
        throw new Error(`Invoice API returned ${res.status}`);
    }
    const data = (await res.json()) as { invoices: DashInvoice[] };
    return data.invoices;
}

/** Server-only. Deactivates a site so the slot can be reassigned. */
export async function deactivateSite(input: { email: string; licenseId: string; siteHost: string }): Promise<void> {
    const res = await fetch(`${API_BASE}/account/sites/deactivate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": INTERNAL_KEY,
        },
        body: JSON.stringify({
            email: input.email,
            license_id: input.licenseId,
            site_host: input.siteHost,
        }),
        cache: "no-store",
    });
    if (res.status === 204) return;
    const body = await res.json().catch(() => null);
    const msg = (body && (body.error?.message || body.message)) || `Account API returned ${res.status}`;
    throw new Error(msg);
}
