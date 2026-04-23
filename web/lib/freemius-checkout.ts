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

    const options = {
        product_id: FREEMIUS_PRODUCT_ID,
        public_key: FREEMIUS_PUBLIC_KEY,
        plan_id: plan.freemiusPlanId,
        billing_cycle: billing, // "monthly" | "annual"
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
