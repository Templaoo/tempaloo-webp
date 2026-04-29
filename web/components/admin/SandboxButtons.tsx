"use client";

import { useState } from "react";

// Mirrors the camelCase response from /v1/plans.
interface Plan {
    code: string;
    name: string;
    freemiusPlanId: number | null;
    priceMonthlyCents: number;
    priceAnnualCents: number;
}

interface SandboxData { sandbox: { token: string; ctx: string } }

const PRODUCT_ID = "28337";
const PUBLIC_KEY = "pk_259a7f9b6c36048a8ee79c2f9dd0b";

const BILLING_OPTS = ["monthly", "annual", "lifetime"] as const;
type Billing = typeof BILLING_OPTS[number];

/**
 * Loads @freemius/checkout on demand, fetches sandbox params from our
 * backend, and opens the overlay. After success, redirects to the
 * customer dashboard — same prod path users follow, just with sandbox
 * credentials so no real money moves.
 *
 * Why this fixes the "Invalid pricing" + "no redirect" problem at once:
 *   · Hosted checkout (page mode) doesn't have a JS success callback,
 *     so the redirect can't happen there.
 *   · Overlay checkout DOES have a success callback. Same code path
 *     real users go through — sandbox token is the only difference.
 */
export function SandboxButtons({ plans }: { plans: Plan[] }) {
    const [busy, setBusy] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    async function open(plan: Plan, billing: Billing) {
        if (!plan.freemiusPlanId) return;
        const key = `${plan.code}:${billing}`;
        if (busy) return;
        setBusy(key);
        setErr(null);

        try {
            const res = await fetch("/api/admin/freemius-sandbox", { cache: "no-store" });
            const j = (await res.json().catch(() => null)) as SandboxData | { error?: { message?: string } } | null;
            if (!res.ok || !j || !("sandbox" in j)) {
                throw new Error((j as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${res.status}`);
            }
            const sandbox = (j as SandboxData).sandbox;

            // Mirrors web/lib/freemius-checkout.ts — same shape so we
            // exercise the same code path real users follow.
            const licenses = plan.code === "starter" ? 1 : plan.code === "growth" ? 5 : 0;
            const mod = await import("@freemius/checkout");
            const CheckoutCtor = mod.Checkout as unknown as new (o: unknown) => { open(): void };

            const checkout = new CheckoutCtor({
                product_id: PRODUCT_ID,
                public_key: PUBLIC_KEY,
                plan_id: plan.freemiusPlanId,
                licenses,
                currency: "eur",
                billing_cycle: billing,
                trial: billing === "lifetime" ? undefined : "paid",
                sandbox,
                success() {
                    window.location.href = `/webp/dashboard?purchase=1&sandbox=1`;
                },
                cancel() { /* user closed overlay */ },
            });
            checkout.open();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Sandbox open failed");
        } finally {
            setBusy(null);
        }
    }

    if (plans.length === 0) {
        return (
            <div className="surface-card" style={{ padding: 24, textAlign: "center", color: "var(--ink-3)" }}>
                No paid plans available. Check that <code>freemius_plan_id</code> is set on the plans table.
            </div>
        );
    }

    const eur = (cents: number) => `€${(cents / 100).toFixed(0)}`;

    return (
        <div style={{ display: "grid", gap: 12 }}>
            {err && (
                <div style={{ padding: 12, borderRadius: 8, background: "color-mix(in oklab, var(--danger) 12%, transparent)", color: "var(--danger)", fontSize: 13 }}>
                    ✗ {err}
                </div>
            )}
            {plans.map((p) => (
                <div key={p.code} className="surface-card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div>
                        <div className="eyebrow">PLAN</div>
                        <div style={{ marginTop: 4, fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{p.name}</div>
                        <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                            {eur(p.priceMonthlyCents)}/mo · {eur(p.priceAnnualCents)}/yr · {p.code}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {BILLING_OPTS.map((b) => (
                            <button
                                key={b}
                                onClick={() => open(p, b)}
                                disabled={busy !== null}
                                className="btn btn-ghost btn-sm"
                            >
                                {busy === `${p.code}:${b}` ? "Opening…" : `Buy ${b}`}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
