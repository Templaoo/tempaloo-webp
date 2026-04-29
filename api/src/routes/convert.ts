import type { FastifyInstance, FastifyBaseLogger } from "fastify";
import sharp from "sharp";
import { z } from "zod";
import { authMiddleware, currentPeriod, type LicenseContext } from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";
import { err } from "../errors.js";
import { sendTransactional } from "../lib/email.js";
import { quotaExceededEmail, quotaWarnEmail } from "../lib/email-templates.js";
import { claimNotification, currentMonthBucket } from "../lib/notifications.js";

const optionsSchema = z.object({
    // 'both' generates AVIF + WebP siblings in a single batch (1 credit
    // total). Same approach ShortPixel uses — best browser coverage:
    // AVIF for Chrome/Edge/Safari 16+/Firefox 113+/iOS 16+, WebP for
    // older modern browsers, JPG for the long tail.
    format: z.enum(["webp", "avif", "both"]).default("webp"),
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

        let fmt: "webp" | "avif" | "both" = "webp";
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
                if (p.fieldname === "format") {
                    const v = String(p.value);
                    fmt = v === "avif" ? "avif" : v === "both" ? "both" : "webp";
                }
                if (p.fieldname === "quality") {
                    const q = Number(p.value);
                    if (Number.isFinite(q) && q >= 1 && q <= 100) quality = Math.round(q);
                }
            }
        }

        if (files.length === 0) throw err.unprocessable("No files provided");
        if ((fmt === "avif" || fmt === "both") && !license.supportsAvif) {
            throw err.forbidden("AVIF not included in your plan — upgrade to Starter or above");
        }

        // ONE credit for the whole batch — regardless of how many sizes
        // OR how many output formats. 'both' costs the same as 'webp'.
        const period = currentPeriod();
        const consumed = await query<{ consume_quota: boolean }>(
            "SELECT consume_quota($1::uuid, $2::date, 1) AS consume_quota",
            [license.licenseId, period],
        );
        if (!consumed.rows[0]?.consume_quota) throw err.quotaExceeded();

        // Build the format list to encode. 'both' fans out to webp + avif
        // for each source file; the response carries one entry per
        // (file × format), and the plugin uses the `format` field to
        // choose the sibling extension when writing back to disk.
        const targetFormats: ("webp" | "avif")[] = fmt === "both" ? ["webp", "avif"] : [fmt];

        // Encoding strategy on a 512MB Render dyno (post-OOM tuning):
        //   * v1.4.1 capped AVIF concurrency at 2; that STILL OOM'd on
        //     real WordPress thumbnails (observed live at 18:37 UTC —
        //     "Ran out of memory used over 512MB"). libavif peak is
        //     closer to 200MB per encode than the 50-150MB I estimated.
        //     With concurrency=2 + Node baseline + Fastify + the input
        //     buffer array, RSS spikes past 512MB on the second encode.
        //   * Fix v1.5.2: AVIF strictly sequential (concurrency=1) so
        //     RSS only carries one libavif working set at a time. Plus
        //     `sharp.concurrency(1)` at app boot pins the libvips
        //     thread pool to 1 thread, removing per-thread working
        //     memory multiplication.
        //   * effort=3 instead of Sharp's default 4 for AVIF — cuts
        //     encode time ~30% and peak heap ~10-15%, files are 3-5%
        //     larger which is the right trade on a 512MB dyno. Revisit
        //     if we move to Standard (2GB) later.
        //   * WebP concurrency stays at 3 (was 4) — small headroom
        //     reduction so a parallel WebP batch can't compound with
        //     the libvips thread pool to push us close to the limit.
        //   * Promise.allSettled means one bad encode doesn't poison
        //     the rest of the batch (kept from v1.4.1).
        const AVIF_CONCURRENCY = 1;
        const WEBP_CONCURRENCY = 3;
        const AVIF_EFFORT      = 3;

        type EncodeResult = {
            name: string;
            format: "webp" | "avif";
            input_bytes: number;
            output_bytes: number;
            data: string;
        };

        const start = Date.now();
        const results: EncodeResult[] = [];
        const failures: { name: string; format: "webp" | "avif"; reason: string }[] = [];

        // Hard limit on AVIF input dimensions for the 512MB Render dyno.
        // libavif needs ~6 bytes per pixel of working heap; a 3000×3000
        // original (typical WP "full-size" upload) needs ~600MB and OOM-
        // kills the worker even at concurrency=1. We pre-read the image
        // header (cheap — 5-10ms, no full decode) and refuse to start an
        // AVIF encode that would exceed the budget. WebP is unaffected;
        // it handles 4000+ px inputs in ~50MB.
        //
        // 2_250_000 px ≈ 1500×1500 — a 1024×1024 thumbnail fits easily,
        // a 1920×1080 hero image fits, but anything bigger gets cleanly
        // rejected with `avif_oversized_input` instead of crashing the
        // dyno. The plugin's wrap_img_in_picture then naturally skips
        // the missing AVIF sibling and falls back to WebP for that size.
        //
        // Move this to env (AVIF_MAX_PIXELS) when we have a paid Render
        // plan with more RAM to lift the limit on demand.
        // Tuned from live usage_logs after v1.5.2 shipped: AVIF
        // successfully encoded inputs up to ~4.2 MB JPEG / ~2400×2400
        // px on the 512MB Render Starter dyno (3.9 sec wall clock).
        // Anything bigger is borderline. 6 MP threshold (~2450×2450)
        // gives margin without over-rejecting; 12 MP (~3464×3464) does
        // OOM. Override with env var when on a bigger plan.
        const AVIF_MAX_PIXELS = Number(process.env.AVIF_MAX_PIXELS ?? 6_000_000);

        for (const tf of targetFormats) {
            const limit = tf === "avif" ? AVIF_CONCURRENCY : WEBP_CONCURRENCY;
            const settled = await mapWithConcurrency(files, limit, async (f) => {
                try {
                    const pipeline = sharp(f.buffer, { failOnError: false });

                    // AVIF size guard. Read the header without decoding
                    // pixels, bail before allocating the encoder heap if
                    // the input is too big to fit in the dyno budget.
                    if (tf === "avif") {
                        const meta = await pipeline.metadata();
                        const pixels = (meta.width ?? 0) * (meta.height ?? 0);
                        if (pixels > AVIF_MAX_PIXELS) {
                            return {
                                ok: false as const,
                                name: f.name,
                                format: tf,
                                reason: `avif_oversized_input:${meta.width}x${meta.height}_${pixels}px`,
                            };
                        }
                    }

                    const out = tf === "avif"
                        ? await pipeline.avif({ quality, effort: AVIF_EFFORT }).toBuffer()
                        : await pipeline.webp({ quality }).toBuffer();
                    return {
                        ok: true as const,
                        value: {
                            name: f.name,
                            format: tf,
                            input_bytes: f.buffer.length,
                            output_bytes: out.length,
                            data: out.toString("base64"),
                        },
                    };
                } catch (e) {
                    const reason = e instanceof Error ? e.message : String(e);
                    return { ok: false as const, name: f.name, format: tf, reason };
                }
            });
            for (const r of settled) {
                if (r.ok) results.push(r.value);
                else {
                    failures.push({ name: r.name, format: r.format, reason: r.reason });
                    req.log.warn({ name: r.name, format: r.format, reason: r.reason }, "sharp encode failed");
                }
            }
            // Free libvips internal state between formats. cache(false) at
            // boot disables persistent caching, but per-encode scratch
            // buffers can still linger until the next libvips call. A
            // no-op cache reconfigure flushes them deterministically.
            sharp.cache({ items: 0 });
            // Suggest GC if Node was started with --expose-gc (Render's
            // default node command doesn't pass that flag, so this is a
            // no-op there but useful in local profiling).
            if (typeof globalThis.gc === "function") {
                globalThis.gc();
            }
        }

        const durationMs = Date.now() - start;

        // Per-format usage logs — only count successes so analytics
        // reflect actual delivered output. Failed encodes are logged
        // separately by the warn() above.
        for (const tf of targetFormats) {
            const formatRows = results.filter((r) => r.format === tf);
            if (formatRows.length === 0) continue;
            const totalIn = formatRows.reduce((a, r) => a + r.input_bytes, 0);
            const totalOut = formatRows.reduce((a, r) => a + r.output_bytes, 0);
            query(
                `INSERT INTO usage_logs (license_id, output_format, input_bytes, output_bytes, quality, duration_ms, status, mode)
                 VALUES ($1, $2::output_format, $3, $4, $5, $6, 'success', $7)`,
                [license.licenseId, tf, totalIn, totalOut, quality, durationMs, mode],
            ).catch((e) => req.log.error({ e, tf }, "usage_log insert failed"));
        }

        // If EVERY encode failed, refund the credit — the user got
        // literally nothing for it. Two distinct sub-cases:
        //
        //   (a) ALL failures are server-side skips (avif_oversized_input
        //       on every input). This is a known-outcome refusal, not a
        //       crash. We return 200 with empty files + the skipped
        //       array so the plugin can record the skips on the
        //       attachment meta and stop re-flagging these in future
        //       scans. Without this branch the plugin saw an HTTP error
        //       and the bulk loop kept retrying the same too-big input
        //       indefinitely.
        //
        //   (b) Genuine encode errors (input corruption, libvips crash,
        //       etc.). 422 with an error payload is right — the plugin
        //       puts the attachment in the retry queue and the user
        //       can investigate.
        if (results.length === 0) {
            await query(
                `UPDATE usage_counters SET images_used = GREATEST(0, images_used - 1)
                  WHERE license_id = $1 AND period = $2`,
                [license.licenseId, period],
            ).catch((e) => req.log.error({ e }, "quota refund failed"));

            const onlySkipped = failures.length > 0
                && failures.every((f) => f.reason.startsWith("avif_oversized_input"));
            if (onlySkipped) {
                req.log.warn({ failures, files: files.length, fmt }, "all encodes server-side skipped (oversized) — credit refunded");
                return reply.send({
                    format: fmt,
                    count: 0,
                    input_bytes: 0,
                    output_bytes: 0,
                    files: [],
                    skipped: failures.map((f) => ({ name: f.name, format: f.format, reason: f.reason })),
                });
            }

            req.log.error({ failures, files: files.length, fmt }, "every encode failed — credit refunded");
            throw err.unprocessable(
                `Conversion failed for every file (${failures.length} encode error(s)). The credit has been refunded.`
            );
        }

        // input_bytes appears once per (name × format) entry; collapse to
        // unique source files for the response so the plugin reads back
        // a comparable "before" number rather than 2x with format=both.
        const uniqueInputs = new Map<string, number>();
        for (const r of results) {
            if (!uniqueInputs.has(r.name)) uniqueInputs.set(r.name, r.input_bytes);
        }
        const totalIn = Array.from(uniqueInputs.values()).reduce((a, v) => a + v, 0);
        const totalOut = results.reduce((a, r) => a + r.output_bytes, 0);

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

        // Fire-and-forget quota warn/exceeded — exactly-once per month per
        // license (claimNotification gates the actual send). Skipped for
        // unlimited plans (limit=-1) and for the free 250-image plan when
        // we'd spam users on cheap quotas (still warns at 100%, just not 80%).
        triggerQuotaEmails(license, used, limit, req.log).catch((e) =>
            req.log.error({ e }, "quota email trigger failed"));

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
            // Per-(file × format) entries that the encoder declined to
            // attempt — currently only AVIF inputs over AVIF_MAX_PIXELS
            // on small dynos. The plugin records these on the attachment
            // meta so the next bulk scan stops flagging the same files
            // as pending forever.
            skipped: failures.map((f) => ({ name: f.name, format: f.format, reason: f.reason })),
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
            // Single-file /convert returns a single binary with one Content-Type
            // header — 'both' makes no sense here. Use /convert/batch instead.
            if (opts.format === "both") {
                throw err.unprocessable("format=both is only supported on /convert/batch — use that endpoint to receive WebP + AVIF together");
            }
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
                    // format=both isn't accepted on single /convert — see comment above.
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

        triggerQuotaEmails(license, used, limit, req.log).catch((e) =>
            req.log.error({ e }, "quota email trigger failed"));

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

/**
 * Quota email trigger.
 *
 * Fires:
 *   · quota-warn      when usedPct crosses 80% (once per month per license)
 *   · quota-exceeded  when usedPct hits 100%   (once per month per license)
 *
 * Uses claimNotification → exactly-once even if N batches arrive
 * concurrently right at the threshold. The DB UNIQUE constraint
 * arbitrates the race — only one INSERT wins.
 *
 * Skipped on unlimited plans (limit = -1) and when used < 80%.
 *
 * Resolves user email + plan name on-demand to avoid widening the
 * convert hot-path query (this branch only runs near thresholds).
 */
async function triggerQuotaEmails(license: LicenseContext, used: number, limit: number, log: FastifyBaseLogger): Promise<void> {
    if (limit === -1 || used < Math.floor(limit * 0.8)) return;

    const period = currentMonthBucket();
    const usedPct = Math.min(100, Math.floor((used / limit) * 100));
    const exceeded = used >= limit;
    const kind = exceeded ? "quota-exceeded" : "quota-warn";

    const won = await claimNotification(license.licenseId, kind, period, { usedPct, used, limit });
    if (!won) return;

    const { rows } = await query<{ email: string; plan_name: string }>(
        `SELECT u.email, p.name AS plan_name
           FROM licenses l
           JOIN users u ON u.id = l.user_id
           JOIN plans p ON p.id = l.plan_id
          WHERE l.id = $1`,
        [license.licenseId],
    );
    const r = rows[0];
    if (!r) return;

    const ctx = {
        email: r.email, planName: r.plan_name,
        usedPct, imagesUsed: used, imagesQuota: limit,
    };
    sendTransactional(exceeded ? quotaExceededEmail(ctx) : quotaWarnEmail(ctx), log)
        .catch((e) => log.error({ e, kind }, "quota email send failed"));
}

/**
 * Bounded-concurrency parallel map. Workers pull from a shared cursor
 * so we never exceed `limit` in-flight encodes — critical when AVIF
 * peak heap can blow past Render's 512MB dyno if 10+ encodes race.
 *
 * Same shape as Promise.all but with a max-active cap. Order in the
 * returned array matches the input order.
 */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    if (items.length === 0) return [];
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const worker = async () => {
        while (true) {
            const i = cursor++;
            if (i >= items.length) return;
            results[i] = await fn(items[i]!, i);
        }
    };
    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
    return results;
}
