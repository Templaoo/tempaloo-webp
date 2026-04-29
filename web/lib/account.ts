import type { DashLicense } from "@/components/dashboard/LicenseCard";

const API_BASE = process.env.TEMPALOO_API_BASE ?? "http://localhost:3000/v1";
const INTERNAL_KEY = process.env.TEMPALOO_INTERNAL_KEY ?? "dev-internal-17f4e6a9-please-change-in-prod";

/** Server-only. Fetches licenses for a verified email from our Fastify API. */
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
    return data.licenses;
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
