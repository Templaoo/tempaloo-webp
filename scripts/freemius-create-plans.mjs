/**
 * Creates (or updates) the 5 Tempaloo WebP plans in your Freemius product
 * via the Developer-scope API.
 *
 * USAGE:
 *   cd scripts
 *   FREEMIUS_DEV_ID=123 \
 *   FREEMIUS_DEV_PUBLIC_KEY=pk_xxx \
 *   FREEMIUS_DEV_SECRET_KEY=sk_xxx \
 *   FREEMIUS_PRODUCT_ID=4567 \
 *   node freemius-create-plans.mjs
 *
 * CREDENTIALS TO COLLECT
 *   • FREEMIUS_DEV_ID          — Freemius Dashboard → top-right avatar → My Profile → Keys
 *   • FREEMIUS_DEV_PUBLIC_KEY  — same page (pk_…)
 *   • FREEMIUS_DEV_SECRET_KEY  — same page (sk_…, click Reveal)
 *   • FREEMIUS_PRODUCT_ID      — Dashboard → your product → Settings → Keys → "Plugin ID"
 *
 * Safe to re-run: if a plan with the same `name` already exists, we skip the
 * create call and only attempt to (re-)add pricing.
 */

import Freemius from "freemius-node-sdk";

const need = (k) => {
    const v = process.env[k];
    if (!v) { console.error(`Missing env var: ${k}`); process.exit(1); }
    return v;
};

const DEV_ID     = Number(need("FREEMIUS_DEV_ID"));
const PUB_KEY    = need("FREEMIUS_DEV_PUBLIC_KEY");
const SEC_KEY    = need("FREEMIUS_DEV_SECRET_KEY");
const PRODUCT_ID = Number(need("FREEMIUS_PRODUCT_ID"));

const dev = new Freemius("developer", DEV_ID, PUB_KEY, SEC_KEY);

// ─── Plan definitions (source of truth, mirrors web/lib/plans.ts) ────────────

const PLANS = [
    {
        name: "free",
        title: "Free",
        description: "250 images per month, renewable forever. No card required.",
        is_free_plan: true,
        license_activations: 1,
        trial_period: 0,
        pricing: [],
    },
    {
        name: "starter",
        title: "Starter",
        description: "5 000 images/month, for a single blog or portfolio.",
        license_activations: 1,
        trial_period: 7,
        pricing: [
            { monthly_price: 5 },
            { annual_price: 48 },
        ],
    },
    {
        name: "growth",
        title: "Growth",
        description: "25 000 images/month, up to 5 sites. For small agencies.",
        license_activations: 5,
        trial_period: 7,
        is_featured: true,
        pricing: [
            { monthly_price: 12 },
            { annual_price: 115 },
        ],
    },
    {
        name: "business",
        title: "Business",
        description: "150 000 images/month, unlimited sites. For agencies managing many client sites.",
        license_activations: 0, // 0 = unlimited in Freemius
        trial_period: 7,
        pricing: [
            { monthly_price: 29 },
            { annual_price: 278 },
        ],
    },
    {
        name: "unlimited",
        title: "Unlimited",
        description: "Unlimited images (fair use 500k/mo), unlimited sites. For hosts and platforms.",
        license_activations: 0,
        trial_period: 7,
        pricing: [
            { monthly_price: 59 },
            { annual_price: 566 },
        ],
    },
];

// ─── Promise wrapper around the SDK's callback API ───────────────────────────
// NOTE: developer-scope paths are auto-prefixed with /developers/{dev_id}/
// by the SDK, so we only pass the product-relative portion.

function api(path, method = "GET", params = {}) {
    return new Promise((resolve, reject) => {
        const body = method === "GET" ? [] : params;
        dev.Api(path, method, body, [], (raw) => {
            try {
                const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                if (parsed?.error) return reject(new Error(`${method} ${path} → ${parsed.error.message || JSON.stringify(parsed.error)}`));
                resolve(parsed);
            } catch (e) {
                reject(e);
            }
        });
    });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n→ Connecting as developer ${DEV_ID}, product ${PRODUCT_ID}…\n`);

    const listResp = await api(`/products/${PRODUCT_ID}/plans.json`, "GET");
    const existingByName = new Map(
        (listResp?.plans ?? []).map((p) => [p.name, p]),
    );
    console.log(`  Found ${existingByName.size} existing plan(s): ${[...existingByName.keys()].join(", ") || "(none)"}\n`);

    for (const plan of PLANS) {
        console.log(`◆ ${plan.title} (name=${plan.name})`);

        let row = existingByName.get(plan.name);
        if (!row) {
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
            row = await api(`/products/${PRODUCT_ID}/plans.json`, "POST", body);
            console.log(`  ✓ created plan id=${row?.id}`);
        } else {
            console.log(`  = already exists (id=${row.id}), skipping create`);
        }

        const planId = row?.id;
        if (!planId || plan.pricing.length === 0) {
            console.log("");
            continue;
        }

        for (const price of plan.pricing) {
            const priceBody = {
                licenses: plan.license_activations === 0 ? 0 : plan.license_activations,
                currency: "eur",
                ...(price.monthly_price != null ? { monthly_price: price.monthly_price } : {}),
                ...(price.annual_price  != null ? { annual_price:  price.annual_price  } : {}),
            };
            try {
                await api(`/products/${PRODUCT_ID}/plans/${planId}/pricing.json`, "POST", priceBody);
                const label = price.monthly_price != null ? `${price.monthly_price} €/mo` : `${price.annual_price} €/yr`;
                console.log(`  + pricing: ${label}`);
            } catch (e) {
                console.warn(`  ⚠ pricing ${JSON.stringify(priceBody)} failed: ${e.message}`);
            }
        }
        console.log("");
    }

    console.log("✓ Done. Open your Freemius Dashboard → Product → Plans to verify.\n");
}

main().catch((e) => {
    console.error("\n✗ Fatal:", e.message || e);
    process.exit(1);
});
