/**
 * Creates (or updates) the 5 Tempaloo WebP plans in your Freemius product
 * via the Developer-scope API.
 *
 * USAGE:
 *   FREEMIUS_DEV_ID=... FREEMIUS_DEV_PUBLIC_KEY=pk_... FREEMIUS_DEV_SECRET_KEY=sk_... \
 *   FREEMIUS_PRODUCT_ID=... node scripts/freemius-create-plans.mjs
 *
 * Safe to re-run: plans with an existing `name` are skipped on create, then
 * pricing is attempted (which is itself idempotent-ish — Freemius rejects
 * duplicate pricing tiers).
 */

import { createClient } from "./freemius-api.mjs";

const need = (k) => {
    const v = process.env[k];
    if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
    return v;
};

const DEV_ID     = Number(need("FREEMIUS_DEV_ID"));
const PUB_KEY    = need("FREEMIUS_DEV_PUBLIC_KEY");
const SEC_KEY    = need("FREEMIUS_DEV_SECRET_KEY");
const PRODUCT_ID = Number(need("FREEMIUS_PRODUCT_ID"));

const dev = createClient({ scope: "developer", id: DEV_ID, publicKey: PUB_KEY, secretKey: SEC_KEY });

// ─── Plan definitions (mirrors web/lib/plans.ts) ─────────────────────────────

const PLANS = [
    {
        name: "free", title: "Free",
        description: "250 images per month, renewable forever. No card required.",
        is_free_plan: true, license_activations: 1, trial_period: 0,
        pricing: [],
    },
    {
        name: "starter", title: "Starter",
        description: "5 000 images/month, for a single blog or portfolio.",
        license_activations: 1, trial_period: 7,
        pricing: [{ monthly_price: 5, annual_price: 48 }],
    },
    {
        name: "growth", title: "Growth",
        description: "25 000 images/month, up to 5 sites. For small agencies.",
        license_activations: 5, trial_period: 7, is_featured: true,
        pricing: [{ monthly_price: 12, annual_price: 115 }],
    },
    {
        name: "business", title: "Business",
        description: "150 000 images/month, unlimited sites. For agencies managing many client sites.",
        license_activations: 0, trial_period: 7,
        pricing: [{ monthly_price: 29, annual_price: 278 }],
    },
    {
        name: "unlimited", title: "Unlimited",
        description: "Unlimited images (fair use 500k/mo), unlimited sites. For hosts and platforms.",
        license_activations: 0, trial_period: 7,
        pricing: [{ monthly_price: 59, annual_price: 566 }],
    },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n→ Connecting as developer ${DEV_ID}, product ${PRODUCT_ID}…\n`);

    // Fetch existing plans so re-runs don't try to recreate them.
    const listResp = await dev.get(`/plugins/${PRODUCT_ID}/plans.json`);
    if (!listResp.ok) {
        console.warn(`  ⚠ Could not list existing plans (${listResp.status}). Proceeding blind.`);
    }
    const existing = new Map(
        (listResp.data?.plans ?? []).map((p) => [p.name, p]),
    );
    console.log(`  Existing plans: ${[...existing.keys()].join(", ") || "(none)"}\n`);

    for (const plan of PLANS) {
        console.log(`◆ ${plan.title} (name=${plan.name})`);

        let row = existing.get(plan.name);
        if (row) {
            console.log(`  = already exists (id=${row.id})`);
        } else {
            const body = {
                name: plan.name,
                title: plan.title,
                description: plan.description,
                license_activations: plan.license_activations,
                trial_period: plan.trial_period || 0,
                is_require_subscription: false,
                is_featured: plan.is_featured ? true : false,
                is_free_plan: plan.is_free_plan ? true : false,
                is_hidden: false,
            };
            const res = await dev.post(`/plugins/${PRODUCT_ID}/plans.json`, body);
            if (res.ok || res.status === 201) {
                row = res.data;
                console.log(`  ✓ created (id=${row.id})`);
            } else {
                const msg = res.data?.error?.message ?? JSON.stringify(res.data);
                console.warn(`  ⚠ create failed (HTTP ${res.status}): ${msg}`);
                console.log("");
                continue;
            }
        }

        if (!row?.id || plan.pricing.length === 0) {
            console.log("");
            continue;
        }

        // Fetch existing pricing for this plan to avoid duplicate POSTs.
        const priceListRes = await dev.get(`/plugins/${PRODUCT_ID}/plans/${row.id}/pricing.json`);
        const existingPricing = priceListRes.data?.pricing ?? [];

        for (const price of plan.pricing) {
            const label = `M=${price.monthly_price ?? "-"} A=${price.annual_price ?? "-"} €`;

            // Does this plan already have a pricing row for (licenses, eur)?
            const lic = plan.license_activations === 0 ? 0 : plan.license_activations;
            const match = existingPricing.find((p) =>
                Number(p.licenses) === Number(lic) && String(p.currency).toLowerCase() === "eur"
            );

            if (match) {
                // Update it to ensure both monthly + annual are present.
                const patch = {
                    ...(price.monthly_price != null ? { monthly_price: price.monthly_price } : {}),
                    ...(price.annual_price  != null ? { annual_price:  price.annual_price  } : {}),
                };
                const res = await dev.put(`/plugins/${PRODUCT_ID}/plans/${row.id}/pricing/${match.id}.json`, patch);
                if (res.ok) {
                    console.log(`  ~ pricing updated: ${label}`);
                } else {
                    console.warn(`  ⚠ pricing update failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
                }
            } else {
                const res = await dev.post(`/plugins/${PRODUCT_ID}/plans/${row.id}/pricing.json`, {
                    licenses: lic,
                    currency: "eur",
                    ...(price.monthly_price != null ? { monthly_price: price.monthly_price } : {}),
                    ...(price.annual_price  != null ? { annual_price:  price.annual_price  } : {}),
                });
                if (res.ok || res.status === 201) {
                    console.log(`  + pricing created: ${label}`);
                } else {
                    console.warn(`  ⚠ pricing create failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
                }
            }
        }
        console.log("");
    }

    console.log("✓ Done. Verify in the Freemius Dashboard → Product → Plans.\n");
}

main().catch((e) => {
    console.error("\n✗ Fatal:", e.stack || e.message || e);
    process.exit(1);
});
