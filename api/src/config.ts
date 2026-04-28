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
    // Session lifetime in minutes — 30 by default, tighten to 15 in prod.
    ADMIN_SESSION_TTL_MIN: z.coerce.number().int().positive().default(30),
    // Comma-separated CIDR allowlist for the /admin/* surface (web layer).
    // The API layer mostly trusts the cookie, but accepts an optional
    // ALLOWLIST too for defense-in-depth.
    ADMIN_IP_ALLOWLIST: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = parsed.data;
