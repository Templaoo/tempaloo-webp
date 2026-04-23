import { Freemius } from "@freemius/sdk";
import { config } from "./config.js";

let _client: Freemius | null = null;

export function getFreemius(): Freemius | null {
    if (_client) return _client;
    if (!config.FREEMIUS_PRODUCT_ID || !config.FREEMIUS_API_KEY || !config.FREEMIUS_SECRET_KEY || !config.FREEMIUS_PUBLIC_KEY) {
        return null;
    }
    _client = new Freemius({
        productId: config.FREEMIUS_PRODUCT_ID,
        apiKey: config.FREEMIUS_API_KEY,
        secretKey: config.FREEMIUS_SECRET_KEY,
        publicKey: config.FREEMIUS_PUBLIC_KEY,
    });
    return _client;
}

/**
 * Maps a Freemius plan name (free/starter/growth/business/unlimited) to our
 * internal plan code — identical today, but kept behind a helper so we can
 * diverge (e.g. renaming) without touching call sites.
 */
export function planCodeFromFreemius(planName: string | undefined | null): string {
    const n = (planName ?? "").toLowerCase().trim();
    if (["free", "starter", "growth", "business", "unlimited"].includes(n)) return n;
    return "free";
}
