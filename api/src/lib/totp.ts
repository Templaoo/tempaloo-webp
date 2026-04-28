import * as OTPAuth from "otpauth";

/**
 * RFC 6238 TOTP. SHA-1, 30-second window, 6 digits — the values every
 * authenticator app (Google, 1Password, Authy, Aegis…) supports out of
 * the box. Don't switch to SHA-256 unless you control the client app.
 *
 * Verification window of 1 means we accept the previous, current, and
 * next 30s code — covers small clock drift without weakening the scheme.
 */
const ISSUER = "Tempaloo Admin";
const PERIOD = 30;
const DIGITS = 6;
const ALGORITHM = "SHA1";

export function generateTotpSecret(): string {
    // 20 bytes of entropy, base32 — RFC 4226 recommends ≥160 bits.
    return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildOtpauthUri(label: string, secretBase32: string): string {
    const totp = new OTPAuth.TOTP({
        issuer: ISSUER,
        label,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
        algorithm: ALGORITHM,
        digits: DIGITS,
        period: PERIOD,
    });
    return totp.toString();
}

export function verifyTotp(secretBase32: string, code: string): boolean {
    const cleaned = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleaned)) return false;

    const totp = new OTPAuth.TOTP({
        issuer: ISSUER,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
        algorithm: ALGORITHM,
        digits: DIGITS,
        period: PERIOD,
    });
    // window=1 → ±30s. delta is null on no-match.
    const delta = totp.validate({ token: cleaned, window: 1 });
    return delta !== null;
}
