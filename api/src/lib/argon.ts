import argon2 from "argon2";

/**
 * Argon2id password hashing.
 *
 * Parameters tuned for ~150–250ms on a typical Render small instance.
 * Memory dominates: 64MB makes GPU/ASIC attacks expensive while staying
 * inside Render free-tier RAM headroom. Output is the standard PHC string
 * `$argon2id$v=19$m=...$t=...$p=...$<salt>$<hash>` so we can change the
 * params later without breaking existing hashes (verify auto-detects).
 */
const PARAMS = {
    type: argon2.argon2id,
    memoryCost: 65_536, // 64 MB
    timeCost: 3,
    parallelism: 4,
} as const;

export async function hashPassword(plain: string): Promise<string> {
    if (plain.length < 12) {
        throw new Error("password must be at least 12 chars");
    }
    return argon2.hash(plain, PARAMS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
        return await argon2.verify(hash, plain);
    } catch {
        return false;
    }
}
