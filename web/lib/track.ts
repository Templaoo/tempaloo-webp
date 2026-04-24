"use client";

import { track as vercelTrack } from "@vercel/analytics";

/**
 * Conversion funnel we track on tempaloo.com:
 *
 *   page_view_landing
 *     │
 *     ▼
 *   cta_click  ── { location: 'hero|nav|pricing|final|sticky|uc-card', plan: 'free|starter|...' }
 *     │
 *     ▼
 *   activate_open       (user lands on /webp/activate)
 *     │
 *     ▼
 *   activate_complete   (license generated — free OR paid flow entered)
 *     │
 *     ▼
 *   checkout_open       (Freemius overlay opened — paid flows only)
 *     │
 *     ▼
 *   checkout_complete   (webhook confirmed, activate=true in DB)
 *
 * `location` and `plan` keep the cardinality low so Vercel Analytics'
 * free tier (10k events/mo) isn't burned by high-variance values.
 */

export type TrackLocation =
    | "nav" | "nav_mobile" | "hero" | "hero_install_copy"
    | "pricing" | "sticky_mobile" | "final_cta"
    | "uc_card" | "stats" | "faq";

export type TrackPlan = "free" | "starter" | "growth" | "business" | "unlimited";

export function trackCtaClick(location: TrackLocation, plan: TrackPlan = "free"): void {
    try { vercelTrack("cta_click", { location, plan }); } catch { /* analytics blocked — ignore */ }
}

export function trackActivateOpen(plan: TrackPlan, billing: "monthly" | "annual" | "free"): void {
    try { vercelTrack("activate_open", { plan, billing }); } catch { /* ignore */ }
}

export function trackActivateComplete(plan: TrackPlan): void {
    try { vercelTrack("activate_complete", { plan }); } catch { /* ignore */ }
}

export function trackCheckoutOpen(plan: TrackPlan): void {
    try { vercelTrack("checkout_open", { plan }); } catch { /* ignore */ }
}

/**
 * Minimal feature-flag primitive for A/B testing.
 *
 * Priority, highest first:
 *   1. `?flag=<value>` in the URL (sticky — writes to localStorage)
 *   2. previously-set localStorage value
 *   3. deterministic hash of `visitorId` → pick a variant by modulo
 *
 * Usage:
 *   const variant = useFlag("hero_headline", ["control", "outcome", "painkiller"]);
 *   → variant is "control" | "outcome" | "painkiller"
 *
 * Upgrade path: swap this for PostHog / GrowthBook SDK when traffic
 * ≥ 1k/week and you need real analytics joins.
 */
import { useEffect, useState } from "react";

function hashStr(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h = (h ^ s.charCodeAt(i)) * 16777619;
    }
    return h >>> 0;
}

function getVisitorId(): string {
    if (typeof window === "undefined") return "ssr";
    const key = "tmp-vid";
    let id = localStorage.getItem(key);
    if (!id) {
        id = crypto.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(key, id);
    }
    return id;
}

export function useFlag<T extends string>(flagKey: string, variants: readonly T[]): T {
    const [variant, setVariant] = useState<T>(variants[0]!);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const storageKey = `tmp-flag-${flagKey}`;

        // 1. URL override wins and is sticky.
        const url = new URL(window.location.href);
        const override = url.searchParams.get(flagKey);
        if (override && (variants as readonly string[]).includes(override)) {
            localStorage.setItem(storageKey, override);
            setVariant(override as T);
            return;
        }

        // 2. Previously chosen variant.
        const stored = localStorage.getItem(storageKey);
        if (stored && (variants as readonly string[]).includes(stored)) {
            setVariant(stored as T);
            return;
        }

        // 3. Deterministic bucket from visitor id + flag key.
        const bucket = hashStr(`${getVisitorId()}:${flagKey}`) % variants.length;
        const picked = variants[bucket]!;
        localStorage.setItem(storageKey, picked);
        setVariant(picked);

        try {
            // Record assignment for later funnel analysis.
            vercelTrack("flag_assigned", { flag: flagKey, variant: picked });
        } catch { /* ignore */ }
    }, [flagKey, variants]);

    return variant;
}
