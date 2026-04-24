import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { authMiddleware, currentPeriod } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { err } from "../errors.js";

const optionsSchema = z.object({
    format: z.enum(["webp", "avif"]).default("webp"),
    quality: z.coerce.number().int().min(1).max(100).default(config.DEFAULT_QUALITY),
});

const MAX_BATCH_FILES = 20;

// Per-license rate limit for /convert/*. The global @fastify/rate-limit is
// per-IP (app.ts), which does not protect against:
//   · one Unlimited-plan user DoS-ing the API with a rogue script
//   · one IP rotating through many proxies to multiply calls
// This cap sits ON TOP of the IP limiter. Values tuned to stay well above
// any realistic bulk workload (50 thumbnails × 20 batches/min = 1000
// conversions/min for a single site, which is a lot).
const CONVERT_RATE_PER_LICENSE = {
    max: 60,               // 60 batches / minute / license
    timeWindow: "1 minute" as const,
};

export default async function convertRoute(app: FastifyInstance) {
    /**
     * Batch endpoint: receive N variants of one attachment, consume 1 credit,
     * return all converted binaries (base64 JSON). This is how the WordPress
     * plugin converts an upload with all its generated thumbnails.
     */
    app.post("/convert/batch", {
        config: {
            rateLimit: {
                ...CONVERT_RATE_PER_LICENSE,
                // Fall back to IP when there's no license header (the IP
                // limiter will 401 them shortly after anyway).
                keyGenerator: (req) => {
                    const key = req.headers["x-license-key"];
                    return typeof key === "string" && key.length >= 32 ? `lic:${key}` : `ip:${req.ip}`;
                },
            },
        },
    }, async (req, reply) => {
        const license = await authMiddleware(req);

        const ct = req.headers["content-type"] ?? "";
        if (!ct.startsWith("multipart/form-data")) {
            throw err.unprocessable("Batch endpoint requires multipart/form-data");
        }

        const modeHeader = req.headers["x-tempaloo-mode"];
        const mode: "auto" | "bulk" | "api" =
            modeHeader === "bulk" ? "bulk" : modeHeader === "api" ? "api" : "auto";

        // Free-plan daily bulk cap (validated product rule 2026-04-24).
        // Auto-convert on upload stays unlimited; manual bulk runs are capped.
        if (mode === "bulk" && license.planCode === "free") {
            const { rows: dRows } = await query<{ count: number }>(
                `SELECT COUNT(*)::int AS count
                   FROM usage_logs
                  WHERE license_id = $1
                    AND mode = 'bulk'
                    AND status = 'success'
                    AND created_at >= (NOW() AT TIME ZONE 'UTC')::date`,
                [license.licenseId],
            );
            if ((dRows[0]?.count ?? 0) >= config.BULK_DAILY_LIMIT_FREE) {
                throw err.dailyBulkLimit(config.BULK_DAILY_LIMIT_FREE);
            }
        }

        let fmt: "webp" | "avif" = "webp";
        let quality = config.DEFAULT_QUALITY;
        const files: { name: string; buffer: Buffer }[] = [];

        for await (const p of req.parts()) {
            if (p.type === "file") {
                const buf = await p.toBuffer();
                if (buf.length > config.MAX_IMAGE_BYTES) {
                    throw err.payloadTooLarge(config.MAX_IMAGE_BYTES);
                }
                files.push({ name: p.filename ?? `file-${files.length}`, buffer: buf });
                if (files.length > MAX_BATCH_FILES) {
                    throw err.unprocessable(`Batch size exceeds ${MAX_BATCH_FILES} files`);
                }
            } else if (p.type === "field") {
                if (p.fieldname === "format") fmt = String(p.value) === "avif" ? "avif" : "webp";
                if (p.fieldname === "quality") {
                    const q = Number(p.value);
                    if (Number.isFinite(q) && q >= 1 && q <= 100) quality = Math.round(q);
                }
            }
        }

        if (files.length === 0) throw err.unprocessable("No files provided");
        if (fmt === "avif" && !license.supportsAvif) {
            throw err.forbidden("AVIF not included in your plan — upgrade to Starter or above");
        }

        // ONE credit for the whole batch — regardless of how many sizes.
        const period = currentPeriod();
        const consumed = await query<{ consume_quota: boolean }>(
            "SELECT consume_quota($1::uuid, $2::date, 1) AS consume_quota",
            [license.licenseId, period],
        );
        if (!consumed.rows[0]?.consume_quota) throw err.quotaExceeded();

        const start = Date.now();
        const results = await Promise.all(
            files.map(async (f) => {
                const pipeline = sharp(f.buffer, { failOnError: false });
                const out =
                    fmt === "avif"
                        ? await pipeline.avif({ quality }).toBuffer()
                        : await pipeline.webp({ quality }).toBuffer();
                return {
                    name: f.name,
                    input_bytes: f.buffer.length,
                    output_bytes: out.length,
                    data: out.toString("base64"),
                };
            }),
        );
        const durationMs = Date.now() - start;

        const totalIn = results.reduce((a, r) => a + r.input_bytes, 0);
        const totalOut = results.reduce((a, r) => a + r.output_bytes, 0);

        query(
            `INSERT INTO usage_logs (license_id, output_format, input_bytes, output_bytes, quality, duration_ms, status, mode)
             VALUES ($1, $2::output_format, $3, $4, $5, $6, 'success', $7)`,
            [license.licenseId, fmt, totalIn, totalOut, quality, durationMs, mode],
        ).catch((e) => req.log.error({ e }, "usage_log insert failed"));

        const { rows: qRows } = await query<{ used: number; limit: number }>(
            `SELECT uc.images_used AS used, p.images_per_month AS limit
               FROM usage_counters uc
               JOIN licenses l ON l.id = uc.license_id
               JOIN plans p ON p.id = l.plan_id
              WHERE uc.license_id = $1 AND uc.period = $2`,
            [license.licenseId, period],
        );
        const used = qRows[0]?.used ?? 0;
        const limit = qRows[0]?.limit ?? license.imagesPerMonth;

        reply
            .header("X-Quota-Used", used)
            .header("X-Quota-Limit", limit)
            .header("X-Quota-Remaining", limit === -1 ? -1 : Math.max(0, limit - used))
            .header("X-Duration-Ms", durationMs);

        return reply.send({
            format: fmt,
            count: results.length,
            input_bytes: totalIn,
            output_bytes: totalOut,
            files: results,
        });
    });

    app.post("/convert", {
        config: {
            rateLimit: {
                ...CONVERT_RATE_PER_LICENSE,
                keyGenerator: (req) => {
                    const key = req.headers["x-license-key"];
                    return typeof key === "string" && key.length >= 32 ? `lic:${key}` : `ip:${req.ip}`;
                },
            },
        },
    }, async (req, reply) => {
        const license = await authMiddleware(req);

        // Parse multipart (image file) or JSON (image_url)
        let buffer: Buffer;
        let fmt: "webp" | "avif";
        let quality: number;

        const ct = req.headers["content-type"] ?? "";
        if (ct.startsWith("multipart/form-data")) {
            const parts = req.parts();
            let imageBuf: Buffer | undefined;
            const fields: Record<string, string> = {};
            for await (const p of parts) {
                if (p.type === "file" && p.fieldname === "image") {
                    imageBuf = await p.toBuffer();
                    if (imageBuf.length > config.MAX_IMAGE_BYTES) {
                        throw err.payloadTooLarge(config.MAX_IMAGE_BYTES);
                    }
                } else if (p.type === "field") {
                    fields[p.fieldname] = String(p.value);
                }
            }
            if (!imageBuf) throw err.unprocessable("Missing image field");
            const opts = optionsSchema.parse(fields);
            fmt = opts.format;
            quality = opts.quality;
            if (fmt === "avif" && !license.supportsAvif) {
                throw err.forbidden("AVIF not included in your plan — upgrade to Starter or above");
            }
            buffer = imageBuf;
        } else {
            const body = z
                .object({
                    image_url: z.string().url(),
                    format: z.enum(["webp", "avif"]).default("webp"),
                    quality: z.coerce.number().int().min(1).max(100).default(config.DEFAULT_QUALITY),
                })
                .parse(req.body);
            fmt = body.format;
            quality = body.quality;
            if (fmt === "avif" && !license.supportsAvif) {
                throw err.forbidden("AVIF not included in your plan — upgrade to Starter or above");
            }
            const res = await fetch(body.image_url);
            if (!res.ok) throw err.unprocessable(`Failed to fetch: ${res.status}`);
            const ab = await res.arrayBuffer();
            if (ab.byteLength > config.MAX_IMAGE_BYTES) {
                throw err.payloadTooLarge(config.MAX_IMAGE_BYTES);
            }
            buffer = Buffer.from(ab);
        }

        // Atomic quota consume BEFORE conversion work (refund on error would be safer,
        // but for MVP we accept that failed conversions consume 1 unit).
        const period = currentPeriod();
        const ok = await query<{ consume_quota: boolean }>(
            "SELECT consume_quota($1::uuid, $2::date, 1) AS consume_quota",
            [license.licenseId, period],
        );
        if (!ok.rows[0]?.consume_quota) throw err.quotaExceeded();

        // Conversion
        const start = Date.now();
        let output: Buffer;
        try {
            const pipeline = sharp(buffer, { failOnError: false });
            output =
                fmt === "avif"
                    ? await pipeline.avif({ quality }).toBuffer()
                    : await pipeline.webp({ quality }).toBuffer();
        } catch (e) {
            throw err.unprocessable(e instanceof Error ? e.message : "Conversion failed");
        }
        const durationMs = Date.now() - start;

        // Fire-and-forget usage log
        query(
            `INSERT INTO usage_logs (license_id, output_format, input_bytes, output_bytes, quality, duration_ms, status)
             VALUES ($1, $2::output_format, $3, $4, $5, $6, 'success')`,
            [license.licenseId, fmt, buffer.length, output.length, quality, durationMs],
        ).catch((e) => req.log.error({ e }, "usage_log insert failed"));

        // Quota headers
        const { rows: qRows } = await query<{ used: number; limit: number }>(
            `SELECT uc.images_used AS used, p.images_per_month AS limit
             FROM usage_counters uc
             JOIN licenses l ON l.id = uc.license_id
             JOIN plans p ON p.id = l.plan_id
             WHERE uc.license_id = $1 AND uc.period = $2`,
            [license.licenseId, period],
        );
        const used = qRows[0]?.used ?? 0;
        const limit = qRows[0]?.limit ?? license.imagesPerMonth;

        reply
            .header("Content-Type", fmt === "avif" ? "image/avif" : "image/webp")
            .header("X-Quota-Used", used)
            .header("X-Quota-Limit", limit)
            .header("X-Quota-Remaining", limit === -1 ? -1 : Math.max(0, limit - used))
            .header("X-Input-Bytes", buffer.length)
            .header("X-Output-Bytes", output.length)
            .header("X-Duration-Ms", durationMs);
        return reply.send(output);
    });
}
