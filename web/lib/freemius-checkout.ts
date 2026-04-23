// Client-side helper to open the Freemius Checkout overlay.
// Lazy-loads @freemius/checkout on first call to keep the landing bundle small.

import type { Plan } from "./plans";
import { FREEMIUS_PRODUCT_ID, FREEMIUS_PUBLIC_KEY } from "./plans";
import type { Billing } from "@/components/pricing/BillingToggle";

interface OpenCheckoutArgs {
    plan: Plan;
    billing: Billing;
    email?: string;
    siteUrl?: string;
}

export async function openFreemiusCheckout({ plan, billing, email, siteUrl }: OpenCheckoutArgs): Promise<void> {
    if (!plan.freemiusPlanId) {
        throw new Error("This plan is not yet available for checkout.");
    }
    const mod = await import("@freemius/checkout");
    const CheckoutCtor = mod.Checkout as unknown as new (o: unknown) => { open(): void };

    // Match the exact `licenses` value on the pricing row we created in Freemius.
    // The create-plans script posted pricing with licenses = license_activations
    // (1 for starter, 5 for growth, 0 for business/unlimited).
    // Freemius treats 0 as "unlimited" in pricing lookups.
    const licenses: number = plan.code === "starter"
        ? 1
        : plan.code === "growth"
            ? 5
            : 0;

    const options = {
        product_id: FREEMIUS_PRODUCT_ID,
        public_key: FREEMIUS_PUBLIC_KEY,
        plan_id: plan.freemiusPlanId,
        licenses,                    // REQUIRED for Freemius to match a pricing row
        currency: "eur",             // REQUIRED for same reason
        billing_cycle: billing,      // "monthly" | "annual"
        trial: plan.priceMonthly > 0 ? "paid" : undefined,
        ...(email ? { user_email: email } : {}),
        success() {
            // Freemius also fires the webhook; we bounce the user to the dashboard.
            const qs = new URLSearchParams({ purchase: "1" });
            if (siteUrl) qs.set("site", siteUrl);
            window.location.href = `/webp/dashboard?${qs.toString()}`;
        },
        cancel() {
            // User closed the overlay — stay where they were.
        },
    };

    const checkout = new CheckoutCtor(options);
    checkout.open();
}
