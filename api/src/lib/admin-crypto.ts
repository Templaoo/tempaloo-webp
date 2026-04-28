import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM at-rest encryption for the TOTP shared secret.
 *
 * Layout (single BYTEA column):
 *   [ 12-byte IV ][ ciphertext ][ 16-byte auth tag ]
 *
 * Key comes from `ADMIN_TOTP_KEY` env — must be 32 bytes (hex or base64
 * accepted; we hash whatever is provided to a deterministic 32 bytes,
 * so even a long passphrase works). Lose the env value → all TOTP
 * secrets are unrecoverable. That is by design.
 */
function loadKey(): Buffer {
    const raw = process.env.ADMIN_TOTP_KEY;
    if (!raw || raw.length < 16) {
        throw new Error("ADMIN_TOTP_KEY env is missing or too short (≥16 chars required)");
    }
    return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plaintext: string): Buffer {
    const key = loadKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, enc, tag]);
}

export function decryptSecret(blob: Buffer): string {
    if (blob.length < 12 + 16) {
        throw new Error("ciphertext too short");
    }
    const key = loadKey();
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(blob.length - 16);
    const enc = blob.subarray(12, blob.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

// ─── Session token helpers ──────────────────────────────────────────

/** Returns { token, hash } — store hash in DB, send token in cookie. */
export function newSessionToken(): { token: string; hash: Buffer } {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest();
    return { token, hash };
}

export function hashToken(token: string): Buffer {
    return createHash("sha256").update(token).digest();
}

// ─── Backup-code helpers ────────────────────────────────────────────

/** 8 codes, formatted XXXX-XXXX (uppercase alnum, no ambiguous chars). */
export function generateBackupCodes(count = 8): string[] {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const left = pick(alphabet, 4);
        const right = pick(alphabet, 4);
        codes.push(`${left}-${right}`);
    }
    return codes;
}

function pick(alphabet: string, n: number): string {
    const buf = randomBytes(n);
    let out = "";
    for (let i = 0; i < n; i++) out += alphabet[buf[i]! % alphabet.length];
    return out;
}

export function hashBackupCode(code: string): Buffer {
    // Normalize: uppercase, strip dashes/spaces. So user typing
    // "abcd1234" or "ABCD-1234" both verify against the same hash.
    const normalized = code.replace(/[-\s]/g, "").toUpperCase();
    return createHash("sha256").update(normalized).digest();
}

export function constantTimeEqual(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}
