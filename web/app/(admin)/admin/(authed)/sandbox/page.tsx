import { adminGet } from "@/lib/admin/api";
import { PageHeader } from "@/components/admin/Shell";
import { SandboxButtons } from "@/components/admin/SandboxButtons";

export const dynamic = "force-dynamic";

// /plans returns camelCase keys (freemiusPlanId, priceMonthlyCents…),
// see api/src/routes/plans.ts. Keep this interface in sync.
interface PlansResp { plans: Array<{ code: string; name: string; freemiusPlanId: number | null; priceMonthlyCents: number; priceAnnualCents: number }> }

export default async function SandboxPage() {
    // Re-use the public /plans endpoint via the server fetch — keeps the
    // page strictly a wrapper around the existing pricing source.
    // Falls back to empty list if the API is down so the page never
    // hard-errors during demo work.
    let plans: PlansResp["plans"] = [];
    try {
        const data = await adminGet<PlansResp>("/plans");
        plans = data.plans.filter((p) => p.freemiusPlanId != null);
    } catch { /* render empty state */ }

    return (
        <>
            <PageHeader
                eyebrow="QA · SANDBOX"
                title="Freemius sandbox checkout"
                subtitle="Opens the real prod overlay in sandbox mode. Pay with 4242 4242 4242 4242 — no money actually moves."
            />

            <div className="surface-card" style={{ padding: 18, marginBottom: 16, fontSize: 13.5, color: "var(--ink-2)" }}>
                <strong>Test cards</strong> ·
                Visa OK <span className="font-mono" style={{ color: "var(--ink)" }}> 4242 4242 4242 4242</span> ·
                Mastercard OK <span className="font-mono" style={{ color: "var(--ink)" }}> 5555 5555 5555 4444</span> ·
                Refused <span className="font-mono" style={{ color: "var(--danger)" }}> 4000 0000 0000 0002</span> ·
                CVC any 3 digits, any future expiry. After Pay → redirect to /webp/dashboard?purchase=1, webhook fires, email arrives.
            </div>

            <SandboxButtons plans={plans} />
        </>
    );
}
