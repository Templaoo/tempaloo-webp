/**
 * IP allowlist parsing for the /admin/* surface.
 * `ADMIN_IP_ALLOWLIST` env is a comma-separated list of:
 *   · single IPv4: 1.2.3.4
 *   · CIDR IPv4:   1.2.3.0/24
 *   · "*"          → allow all (dev only, log a warning)
 *
 * Empty / unset → allow all (so a misconfigured deploy doesn't lock you
 * out of your own admin while testing the rest of the chain).
 *
 * Bare-bones IPv4 only — IPv6 admins are rare. If we ever need v6,
 * swap to the `cidr-tools` lib.
 */
export function isIpAllowed(ip: string, list: string | undefined | null): boolean {
    if (!list || !list.trim()) return true;
    const entries = list.split(",").map((s) => s.trim()).filter(Boolean);
    if (entries.includes("*")) return true;

    // Vercel / Cloudflare can put a trailing port or "::ffff:" prefix.
    const cleaned = ip.replace(/^::ffff:/, "").replace(/:\d+$/, "");
    const ipNum = ipv4ToInt(cleaned);
    if (ipNum == null) return false;

    for (const entry of entries) {
        if (entry.includes("/")) {
            const [base, bits] = entry.split("/");
            const baseNum = ipv4ToInt(base!);
            const bitsN = Number(bits);
            if (baseNum == null || !Number.isFinite(bitsN) || bitsN < 0 || bitsN > 32) continue;
            const mask = bitsN === 0 ? 0 : (~0 << (32 - bitsN)) >>> 0;
            if ((ipNum & mask) === (baseNum & mask)) return true;
        } else {
            if (ipv4ToInt(entry) === ipNum) return true;
        }
    }
    return false;
}

function ipv4ToInt(ip: string): number | null {
    const parts = ip.split(".");
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
        const x = Number(p);
        if (!Number.isInteger(x) || x < 0 || x > 255) return null;
        n = (n << 8) | x;
    }
    return n >>> 0;
}
