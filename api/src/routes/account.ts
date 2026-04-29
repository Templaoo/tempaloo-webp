import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { query } from "../db.js";
import { currentPeriod } from "../auth.js";
import { getFreemius } from "../freemius.js";

/**
 * Constant-time equality. Prevents timing-oracle attacks on the internal
 * auth key (purely theoretical at our scale — network jitter dwarfs the
 * leaked bits — but it costs one import and removes a class of CVEs).
 */
function safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
}

/**
 * Account endpoints. Authenticated by a shared INTERNAL_API_KEY so that only
 * our own Next.js server (which holds the user's session) can call them.
 * The client-side React never sees this key.
 */
export default async function accountRoutes(app: FastifyInstance) {
    app.addHook("onRequest", async (req, reply) => {
        if (!req.url.startsWith("/account") && !req.url.startsWith("/v1/account")) return;
        const key = req.headers["x-internal-key"];
        if (typeof key !== "string" || !safeEqual(key, config.INTERNAL_API_KEY)) {
            return reply.code(401).send({ error: { code: "unauthorized", message: "Missing or invalid internal key" } });
        }
    });

    // Self-service: dashboard user deactivates a site to free a license slot.
    // We re-verify ownership server-side so the route can't be abused even if
    // the internal key leaks — the email comes from the Next.js session.
    app.post("/account/sites/deactivate", async (req, reply) => {
        const body = z
            .object({
                email: z.string().email(),
                license_id: z.string().uuid(),
                site_host: z.string().min(1),
            })
            .parse(req.body);

        const { rowCount } = await query(
            `UPDATE sites
                SET deactivated_at = NOW()
              WHERE license_id = $1
                AND site_host = $2
                AND deactivated_at IS NULL
                AND license_id IN (
                  SELECT l.id FROM licenses l
                    JOIN users u ON u.id = l.user_id
                   WHERE u.email = $3
                )`,
            [body.license_id, body.site_host.toLowerCase(), body.email.toLowerCase()],
        );
        if (!rowCount) {
            return reply.code(404).send({
                error: { code: "not_found", message: "Site not found for this license" },
            });
        }
        return reply.code(204).send();
    });

    app.post("/account/licenses", async (req) => {
        const body = z.object({ email: z.string().email() }).parse(req.body);
        const email = body.email.toLowerCase();
        const period = currentPeriod();

        const { rows: licRows } = await query<{
            license_id: string;
            license_key: string;
            status: string;
            billing: string;
            plan_code: string;
            plan_name: string;
            images_per_month: number;
            max_sites: number;
            supports_avif: boolean;
            current_period_end: Date | null;
            created_at: Date;
        }>(
            `SELECT l.id AS license_id, l.license_key, l.status::text AS status,
                    l.billing::text AS billing,
                    p.code AS plan_code, p.name AS plan_name, p.images_per_month,
                    p.max_sites, p.supports_avif,
                    l.current_period_end, l.created_at
               FROM licenses l
               JOIN users u ON u.id = l.user_id
               JOIN plans p ON p.id = l.plan_id
              WHERE u.email = $1
              ORDER BY l.created_at DESC`,
            [email],
        );

        if (licRows.length === 0) {
            return { email, licenses: [] };
        }

        const ids = licRows.map((r) => r.license_id);

        // Per-period usage.
        const { rows: usageRows } = await query<{ license_id: string; images_used: number }>(
            `SELECT license_id, images_used FROM usage_counters
              WHERE license_id = ANY($1::uuid[]) AND period = $2`,
            [ids, period],
        );
        const usageMap = new Map(usageRows.map((r) => [r.license_id, Number(r.images_used)]));

        // Daily usage for the last 30 days — feeds the dashboard sparkline.
        // GROUP BY day, then we materialize the gap-filled timeline client-side.
        const { rows: dailyRows } = await query<{ license_id: string; day: Date; n: number }>(
            `SELECT license_id,
                    DATE_TRUNC('day', created_at AT TIME ZONE 'UTC')::date AS day,
                    COUNT(*)::int AS n
               FROM usage_logs
              WHERE license_id = ANY($1::uuid[])
                AND created_at >= NOW() - INTERVAL '30 days'
                AND status = 'success'
              GROUP BY license_id, day
              ORDER BY license_id, day`,
            [ids],
        );
        const dailyMap = new Map<string, { day: string; n: number }[]>();
        for (const r of dailyRows) {
            const key = r.license_id;
            const arr = dailyMap.get(key) ?? [];
            arr.push({ day: r.day.toISOString().slice(0, 10), n: Number(r.n) });
            dailyMap.set(key, arr);
        }

        // Active sites per license.
        const { rows: siteRows } = await query<{
            license_id: string; site_url: string; site_host: string; last_seen_at: Date | null;
        }>(
            `SELECT license_id, site_url, site_host, last_seen_at FROM sites
              WHERE license_id = ANY($1::uuid[]) AND deactivated_at IS NULL
              ORDER BY activated_at DESC`,
            [ids],
        );
        const sitesMap = new Map<string, typeof siteRows>();
        for (const s of siteRows) {
            const arr = sitesMap.get(s.license_id) ?? [];
            arr.push(s);
            sitesMap.set(s.license_id, arr);
        }

        return {
            email,
            licenses: licRows.map((l) => {
                const used = usageMap.get(l.license_id) ?? 0;
                const sites = sitesMap.get(l.license_id) ?? [];
                return {
                    id: l.license_id,
                    licenseKey: l.license_key,
                    status: l.status,
                    billing: l.billing,
                    plan: {
                        code: l.plan_code,
                        name: l.plan_name,
                        imagesPerMonth: l.images_per_month,
                        maxSites: l.max_sites,
                        supportsAvif: l.supports_avif,
                    },
                    quota: {
                        imagesUsed: used,
                        imagesLimit: l.images_per_month,
                        imagesRemaining: l.images_per_month === -1 ? -1 : Math.max(0, l.images_per_month - used),
                    },
                    sites: sites.map((s) => ({
                        url: s.site_url,
                        host: s.site_host,
                        lastSeenAt: s.last_seen_at,
                    })),
                    daily30: dailyMap.get(l.license_id) ?? [],
                    currentPeriodEnd: l.current_period_end,
                    createdAt: l.created_at,
                };
            }),
        };
    });

    /**
     * Invoices list — proxies Freemius's payments API behind our own
     * surface so the user never has to log into the Freemius portal
     * to see / download a receipt. Joins each payment against our
     * `plans` table for a friendly plan name, since the Freemius
     * Payment entity only carries plan_id.
     *
     * Email comes from the trusted Next.js session (the X-Internal-Key
     * gate above guarantees it's our own server calling). Free accounts
     * (no freemius_user_id) just return an empty list — no Freemius API
     * call needed.
     */
    app.post("/account/invoices", async (req, reply) => {
        const body = z.object({ email: z.string().email() }).parse(req.body);

        const { rows: u } = await query<{ freemius_user_id: number | null }>(
            `SELECT freemius_user_id FROM users WHERE email = $1 LIMIT 1`,
            [body.email],
        );
        const freemiusUserId = u[0]?.freemius_user_id;
        if (!freemiusUserId) return reply.send({ invoices: [] });

        const fs = getFreemius();
        if (!fs) return reply.code(503).send({ error: { code: "freemius_not_configured", message: "Freemius keys missing" } });

        try {
            const payments = await fs.api.user.retrievePayments(String(freemiusUserId));
            // Plan name lookup — one DB roundtrip for the union of plan ids.
            const planIds = Array.from(new Set(payments.map((p) => p.plan_id).filter(Boolean) as (string | number)[])).map(Number);
            const planMap = new Map<number, string>();
            if (planIds.length) {
                const { rows: planRows } = await query<{ freemius_plan_id: string; name: string }>(
                    `SELECT freemius_plan_id::text AS freemius_plan_id, name FROM plans
                      WHERE freemius_plan_id = ANY($1::bigint[])`,
                    [planIds],
                );
                for (const r of planRows) planMap.set(Number(r.freemius_plan_id), r.name);
            }

            const invoices = payments.map((p) => ({
                id: String(p.id),
                amountCents: Math.round(Number(p.gross ?? 0) * 100),
                currency: (p.currency ?? "EUR").toUpperCase(),
                createdAt: p.created ? new Date(p.created).toISOString() : null,
                planName: p.plan_id ? (planMap.get(Number(p.plan_id)) ?? null) : null,
                isRefund: Number(p.gross ?? 0) < 0,
                gateway: p.gateway ?? null,
                externalId: p.external_id ?? null,
            }));
            // Most recent first.
            invoices.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
            return reply.send({ invoices });
        } catch (e) {
            req.log.error({ e }, "freemius payments lookup failed");
            return reply.code(502).send({ error: { code: "freemius_error", message: e instanceof Error ? e.message : "lookup failed" } });
        }
    });

    /**
     * Single-invoice PDF download. Verifies the payment actually belongs
     * to the email (Next.js session) before streaming the blob — even
     * though X-Internal-Key gates the route, an extra ownership check
     * means a leaked key still can't pull arbitrary invoices.
     */
    app.post("/account/invoices/download", async (req, reply) => {
        const body = z.object({
            email: z.string().email(),
            paymentId: z.string().min(1).max(40),
        }).parse(req.body);

        const { rows: u } = await query<{ freemius_user_id: number | null }>(
            `SELECT freemius_user_id FROM users WHERE email = $1 LIMIT 1`,
            [body.email],
        );
        const freemiusUserId = u[0]?.freemius_user_id;
        if (!freemiusUserId) return reply.code(404).send({ error: { code: "no_freemius_account", message: "No paid history for this email" } });

        const fs = getFreemius();
        if (!fs) return reply.code(503).send({ error: { code: "freemius_not_configured", message: "Freemius keys missing" } });

        try {
            // Defense in depth: confirm the payment belongs to this user
            // before generating an invoice URL for it. Otherwise a leaked
            // INTERNAL_API_KEY + a guessed payment id would pull anyone's PDF.
            const payment = await fs.api.payment.retrieve(body.paymentId);
            if (!payment || String(payment.user_id) !== String(freemiusUserId)) {
                return reply.code(404).send({ error: { code: "not_found", message: "Invoice not found" } });
            }

            const blob = await fs.api.user.retrieveInvoice(String(freemiusUserId), body.paymentId);
            if (!blob) return reply.code(404).send({ error: { code: "not_found", message: "Invoice unavailable" } });

            const buffer = Buffer.from(await blob.arrayBuffer());
            return reply
                .code(200)
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition", `attachment; filename="tempaloo-invoice-${body.paymentId}.pdf"`)
                .header("Cache-Control", "no-store")
                .send(buffer);
        } catch (e) {
            req.log.error({ e, paymentId: body.paymentId }, "invoice download failed");
            return reply.code(502).send({ error: { code: "freemius_error", message: e instanceof Error ? e.message : "download failed" } });
        }
    });
}
