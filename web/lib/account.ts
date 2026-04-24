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
