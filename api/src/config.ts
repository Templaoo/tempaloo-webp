import "dotenv/config";
import { z } from "zod";

const schema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.string().default("info"),
    DATABASE_URL: z.string().url(),
    MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(26_214_400),
    DEFAULT_QUALITY: z.coerce.number().int().min(1).max(100).default(82),
    FREEMIUS_PRODUCT_ID: z.coerce.number().int().positive().optional(),
    FREEMIUS_SECRET_KEY: z.string().optional(),
    FREEMIUS_PUBLIC_KEY: z.string().optional(),
    FREEMIUS_API_KEY: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    INTERNAL_API_KEY: z.string().min(16).default("dev-internal-please-change"),
    UNLIMITED_FAIR_USE: z.coerce.number().int().positive().default(500_000),
    UNLIMITED_NOTIFY_WEBHOOK: z.string().url().optional(),
    BULK_DAILY_LIMIT_FREE: z.coerce.number().int().positive().default(50),

    // ─── Admin backoffice ───────────────────────────────────────────
    // 32+ char passphrase — derives the AES-GCM key for TOTP secrets.
    // Loss = all enrolled TOTPs unrecoverable; rotate ⇒ force re-enroll.
    ADMIN_TOTP_KEY: z.string().min(16).optional(),
    // Cookie name for admin session. Different from the customer cookie.
    ADMIN_COOKIE_NAME: z.string().default("tempaloo_admin_sid"),
    // Session lifetime in minutes. Default 30 days (43200 min) — the
    // longest "still safe" value given the surrounding controls:
    //   · httpOnly cookie (no JS access)
    //   · SameSite=Strict (no CSRF/cross-site replay)
    //   · 2FA passed flag required on every request
    //   · IP allowlist (web middleware) when ADMIN_IP_ALLOWLIST is set
    //   · admin:revoke-sessions kill switch invalidates every session in 1 sec
    // Drop this back to 30/60/240 in security-sensitive deployments.
    ADMIN_SESSION_TTL_MIN: z.coerce.number().int().positive().default(43200),
    // Comma-separated CIDR allowlist for the /admin/* surface (web layer).
    // The API layer mostly trusts the cookie, but accepts an optional
    // ALLOWLIST too for defense-in-depth.
    ADMIN_IP_ALLOWLIST: z.string().optional(),

    // ─── Email (Brevo / Sendinblue) ─────────────────────────────────
    // Optional in dev — when missing, emails are logged to stdout instead
    // of being sent. Lets you boot the API without burning Brevo quota.
    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().default("julia.paterson@tempaloo.com"),
    EMAIL_FROM_NAME: z.string().default("Julia Paterson"),
    EMAIL_REPLY_TO: z.string().email().optional(),
    // Public web base for links inside emails (e.g. dashboard URL).
    WEB_BASE_URL: z.string().url().default("https://tempaloo.com"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = parsed.data;
