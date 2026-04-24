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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const config = parsed.data;
