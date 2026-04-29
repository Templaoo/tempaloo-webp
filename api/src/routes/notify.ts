import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authMiddleware } from "../auth.js";
import { query } from "../db.js";
import { err } from "../errors.js";
import { sendTransactional } from "../lib/email.js";
import { bulkRetryCompleteEmail } from "../lib/email-templates.js";
import { claimNotification, currentMonthBucket } from "../lib/notifications.js";

/**
 * Plugin-side notification triggers. Endpoints here are authed by the
 * site's license key (X-License-Key header) and let the WordPress
 * plugin ask the API to fire a transactional email on its behalf.
 *
 * Why route through the API at all rather than wp_mail() directly:
 *   * Brevo deliverability is meaningfully better than wp_mail's
 *     local SMTP / sendmail path on most shared hosts.
 *   * Templates live next to the rest of our brand styling instead of
 *     being duplicated in PHP.
 *   * Rate-limit / dedup state is shared across sites — one user with
 *     three sites firing the same retry-complete signal in 60s gets
 *     ONE email, not three (claimNotification arbitrates).
 */
export default async function notifyRoute(app: FastifyInstance) {
    /**
     * Background bulk retries finished — every queued attachment has
     * either succeeded or been abandoned after the 6-retry cap. The
     * plugin calls this once per license per ~24h (see the dedup
     * window below) so the user gets a single "all done" email even
     * if they cancel + restart bulk a few times in a row.
     */
    app.post("/notify/bulk-retry-complete", async (req, reply) => {
        const license = await authMiddleware(req);

        const body = z.object({
            converted: z.coerce.number().int().min(0),
            abandoned: z.coerce.number().int().min(0).default(0),
            site_url: z.string().url(),
        }).parse(req.body);

        // Nothing to celebrate — don't fire on empty completions.
        if (body.converted === 0 && body.abandoned === 0) {
            return reply.code(204).send();
        }

        // Dedup: one bulk-retry-complete email per license per UTC day.
        // claimNotification's UNIQUE (license, kind, period) constraint
        // arbitrates concurrent calls deterministically — if two sites
        // on the same license finish their queues within the same day,
        // only the first INSERT wins and the email goes out once.
        const period = currentMonthBucket(); // YYYY-MM-DD on a daily bucket
        const won = await claimNotification(
            license.licenseId,
            "bulk-retry-complete",
            period,
            { converted: body.converted, abandoned: body.abandoned, site_url: body.site_url },
        );
        if (!won) {
            return reply.code(200).send({ ok: true, deduped: true });
        }

        const { rows } = await query<{ email: string }>(
            `SELECT u.email FROM licenses l
              JOIN users u ON u.id = l.user_id
             WHERE l.id = $1
             LIMIT 1`,
            [license.licenseId],
        );
        const r = rows[0];
        if (!r) {
            // The license resolved (auth passed), but the user join
            // came up empty — should never happen, log + drop.
            req.log.error({ licenseId: license.licenseId }, "bulk-retry-complete: user not found");
            throw err.unprocessable("User not found for license");
        }

        sendTransactional(
            bulkRetryCompleteEmail({
                email: r.email,
                siteUrl: body.site_url,
                converted: body.converted,
                abandoned: body.abandoned,
            }),
            req.log,
        ).catch((e) => req.log.error({ e }, "bulk-retry-complete email send failed"));

        return reply.code(200).send({ ok: true });
    });
}
