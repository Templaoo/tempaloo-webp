"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Plan } from "@/lib/plans";
import { FREEMIUS_PRODUCT_ID, FREEMIUS_PUBLIC_KEY } from "@/lib/plans";
import type { Billing } from "./BillingToggle";

/**
 * Opens the Freemius Checkout overlay for a paid plan.
 *
 * Loads @freemius/checkout lazily on first click to avoid shipping 30+ KB
 * to visitors who just browse pricing.
 */
export function CheckoutButton({
    plan,
    billing,
    email,
    siteUrl,
    className,
    children,
}: {
    plan: Plan;
    billing: Billing;
    email?: string;
    siteUrl?: string;
    className?: string;
    children: React.ReactNode;
}) {
    const [loading, setLoading] = useState(false);

    const onClick = async () => {
        if (!plan.freemiusPlanId) {
            alert("Plan not yet available. Please contact us.");
            return;
        }
        setLoading(true);
        try {
            const { Checkout } = await import("@freemius/checkout");
            const options = {
                product_id: FREEMIUS_PRODUCT_ID,
                public_key: FREEMIUS_PUBLIC_KEY,
                plan_id: plan.freemiusPlanId,
                billing_cycle: billing, // "monthly" | "annual"
                trial: plan.priceMonthly > 0 ? "paid" : undefined,
                ...(email ? { user_email: email } : {}),
                success(purchase: unknown) {
                    console.log("purchase success", purchase);
                    // Freemius also fires the webhook; we just bounce the user to the dashboard.
                    window.location.href = `/webp/dashboard?purchase=1${siteUrl ? `&site=${encodeURIComponent(siteUrl)}` : ""}`;
                },
                cancel() {
                    // User closed the overlay — stay on the page.
                },
            };
            const checkout = new (Checkout as unknown as new (o: typeof options) => { open(): void })(options);

            checkout.open();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Could not open checkout");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className={clsx(
                "inline-flex items-center justify-center gap-2 transition disabled:opacity-60",
                className,
            )}
        >
            {loading ? "Opening checkout…" : children}
        </button>
    );
}
