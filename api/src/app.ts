import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import helmet from "@fastify/helmet";
import sharp from "sharp";
import { ZodError } from "zod";
import { config } from "./config.js";
import { ApiError } from "./errors.js";

// ─── Sharp memory tuning for the 512MB Render Starter dyno ──────────
//
// Sharp picks its libvips thread-pool size from libuv defaults — on a
// machine with N cores it spawns N threads, each holding its own
// working memory. On a 0.5 vCPU dyno that translated into 4–8 threads
// each grabbing 50–150MB during AVIF encoding, which OOM-killed the
// dyno mid-batch (observed live on real bulk runs). Pinning to 1
// thread keeps RSS predictable; a single AVIF encode peaks ~150MB
// instead of N × 150MB.
//
// `cache(false)` disables the libvips operation cache entirely. The
// cache speeds up repeated encodes of the same buffer, which never
// happens in our workflow — we encode each file once and ship the
// bytes. Keeping it enabled holds onto recently-decoded pixel data
// long after we're done with it, which is pure heap pressure.
sharp.concurrency(1);
sharp.cache(false);
sharp.simd(true); // SIMD is fine — it's CPU vectorization, not extra memory
import accountRoutes from "./routes/account.js";
import adminAuthRoutes from "./routes/admin/auth.js";
import adminDataRoutes from "./routes/admin/data.js";
import convertRoute from "./routes/convert.js";
import licenseRoutes from "./routes/license.js";
import notifyRoute from "./routes/notify.js";
import plansRoute from "./routes/plans.js";
import quotaRoute from "./routes/quota.js";
import webhooksRoute from "./routes/webhooks.js";

export interface BuildAppOptions {
    logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
    const app = Fastify({
        logger: opts.logger === false ? false : { level: config.LOG_LEVEL },
        bodyLimit: config.MAX_IMAGE_BYTES + 1_000_000,
        trustProxy: true,
    });

    // Security headers. We serve JSON only, so no CSP is attached here
    // (the Next.js web app handles its own CSP). `crossOriginResourcePolicy`
    // stops random pages from embedding our responses; the rest are
    // Helmet's sensible defaults (X-Content-Type-Options, Referrer-Policy,
    // Strict-Transport-Security via the Render proxy, …).
    await app.register(helmet, {
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "same-origin" },
    });

    await app.register(multipart, {
        limits: { fileSize: config.MAX_IMAGE_BYTES, files: 20 },
    });

    await app.register(rateLimit, {
        global: false,
        max: 120,
        timeWindow: "1 minute",
    });

    app.setErrorHandler((err, req, reply) => {
        if (err instanceof ApiError) {
            return reply.code(err.status).send({
                error: { code: err.code, message: err.message, details: err.details },
            });
        }
        if (err instanceof ZodError) {
            return reply.code(400).send({
                error: { code: "validation_failed", message: "Invalid request body", details: err.flatten() },
            });
        }
        if (err.validation) {
            return reply.code(400).send({
                error: { code: "validation_failed", message: err.message, details: err.validation },
            });
        }
        req.log.error({ err }, "unhandled error");
        return reply.code(500).send({ error: { code: "internal_error", message: "Internal error" } });
    });

    app.get("/health", async () => ({ ok: true, env: config.NODE_ENV }));

    await app.register(
        async (api) => {
            await api.register(convertRoute);
            await api.register(quotaRoute);
            await api.register(licenseRoutes);
            await api.register(notifyRoute);
            await api.register(plansRoute);
            await api.register(webhooksRoute);
            await api.register(accountRoutes);
            await api.register(adminAuthRoutes);
            await api.register(adminDataRoutes);
        },
        { prefix: "/v1" },
    );

    return app;
}
