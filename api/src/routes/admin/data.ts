import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../../db.js";
import { auditLog } from "../../lib/audit.js";
import { sendTransactional } from "../../lib/email.js";
import {
    paymentReceivedEmail, quotaExceededEmail, quotaWarnEmail,
    subscriptionCancelledEmail, trialEndingEmail, trialStartedEmail,
    welcomeFreeEmail,
} from "../../lib/email-templates.js";
import { requireAdmin } from "../../middleware/require-admin.js";

/**
 * Admin data routes — strictly READ-ONLY in v1. Every endpoint:
 *   · is gated by requireAdmin() (cookie + MFA)
 *   · writes an audit log entry (read access is itself a data event)
 *   · uses parameterized SQL only (no string interpolation)
 *   · paginates with LIMIT/OFFSET, capped to 200/page
 *
 * If we ever introduce a destructive endpoint here, gate it on
 * `req.admin!.role !== 'readonly'` AND require a non-empty `reason`
 * in the body, then audit at severity = 'critical'.
 */
export default async function adminDataRoutes(app: FastifyInstance) {
    const guard = { preHandler: requireAdmin() };

    // ─── /admin/metrics/overview ────────────────────────────────────
    // The single landing-page query. Computed in one round-trip via
    // CTEs — Neon EU latency makes per-card queries painful at ~30ms each.
    app.get("/admin/metrics/overview", guard, async (req) => {
        const { rows } = await query<{
            mrr_cents: string;
            arr_cents: string;
            paying_users: string;
            free_users: string;
            trialing_users: string;
            signups_7d: string;
            signups_30d: string;
            churned_30d: string;
            active_sites_30d: string;
            total_licenses: string;
            licenses_per_day: { day: string; count: number }[];
        }>(
            `WITH paying AS (
                SELECT l.user_id, p.code, p.price_monthly_cents, p.price_annual_cents, l.billing
                FROM licenses l
                JOIN plans p ON p.id = l.plan_id
                WHERE l.status IN ('active', 'trialing') AND p.code <> 'free'
            ),
            mrr AS (
                SELECT COALESCE(SUM(
                    CASE
                        WHEN billing = 'monthly' THEN price_monthly_cents
                        WHEN billing = 'annual'  THEN price_annual_cents / 12
                        ELSE 0
                    END
                ), 0)::bigint AS cents
                FROM paying
            ),
            users_breakdown AS (
                SELECT
                    COUNT(DISTINCT u.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1 FROM licenses l2
                            JOIN plans p2 ON p2.id = l2.plan_id
                            WHERE l2.user_id = u.id AND l2.status IN ('active','trialing')
                              AND p2.code <> 'free'
                        )
                    ) AS paying,
                    COUNT(DISTINCT u.id) FILTER (
                        WHERE NOT EXISTS (
                            SELECT 1 FROM licenses l2
                            JOIN plans p2 ON p2.id = l2.plan_id
                            WHERE l2.user_id = u.id AND l2.status IN ('active','trialing')
                              AND p2.code <> 'free'
                        )
                    ) AS free,
                    COUNT(DISTINCT u.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1 FROM licenses l2
                            WHERE l2.user_id = u.id AND l2.status = 'trialing'
                        )
                    ) AS trialing
                FROM users u
            ),
            signups AS (
                SELECT
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS d7,
                    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS d30
                FROM users
            ),
            churn AS (
                SELECT COUNT(DISTINCT user_id) AS n
                FROM licenses
                WHERE status = 'canceled' AND canceled_at >= NOW() - INTERVAL '30 days'
            ),
            sites_active AS (
                SELECT COUNT(DISTINCT s.id) AS n
                FROM sites s
                WHERE s.deactivated_at IS NULL
                  AND s.last_seen_at >= NOW() - INTERVAL '30 days'
            ),
            licenses_total AS (
                SELECT COUNT(*) AS n FROM licenses
            ),
            per_day AS (
                SELECT TO_CHAR(d::date, 'YYYY-MM-DD') AS day,
                       COUNT(l.id)::int AS count
                FROM generate_series(NOW() - INTERVAL '29 days', NOW(), '1 day') d
                LEFT JOIN licenses l
                  ON l.created_at >= d::date AND l.created_at < (d::date + INTERVAL '1 day')
                GROUP BY d::date
                ORDER BY d::date
            )
            SELECT
                (SELECT cents FROM mrr) AS mrr_cents,
                ((SELECT cents FROM mrr) * 12)::bigint AS arr_cents,
                (SELECT paying FROM users_breakdown)::bigint AS paying_users,
                (SELECT free FROM users_breakdown)::bigint AS free_users,
                (SELECT trialing FROM users_breakdown)::bigint AS trialing_users,
                (SELECT d7 FROM signups)::bigint  AS signups_7d,
                (SELECT d30 FROM signups)::bigint AS signups_30d,
                (SELECT n FROM churn)::bigint AS churned_30d,
                (SELECT n FROM sites_active)::bigint AS active_sites_30d,
                (SELECT n FROM licenses_total)::bigint AS total_licenses,
                (SELECT json_agg(json_build_object('day', day, 'count', count)) FROM per_day) AS licenses_per_day`,
        );

        const row = rows[0]!;
        await auditLog({
            admin: req.admin!, req,
            action: "metrics.view", severity: "info",
        });
        return {
            mrr_cents: Number(row.mrr_cents),
            arr_cents: Number(row.arr_cents),
            paying_users: Number(row.paying_users),
            free_users: Number(row.free_users),
            trialing_users: Number(row.trialing_users),
            signups_7d: Number(row.signups_7d),
            signups_30d: Number(row.signups_30d),
            churned_30d: Number(row.churned_30d),
            active_sites_30d: Number(row.active_sites_30d),
            total_licenses: Number(row.total_licenses),
            licenses_per_day: row.licenses_per_day ?? [],
        };
    });

    // ─── /admin/users ───────────────────────────────────────────────
    const usersListQuery = z.object({
        q: z.string().trim().min(1).max(120).optional(),
        plan: z.string().trim().min(1).max(40).optional(),
        status: z.enum(["active", "trialing", "past_due", "canceled", "expired"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(200).default(50),
    });

    app.get("/admin/users", guard, async (req, reply) => {
        const parsed = usersListQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_query", message: "Invalid filters", details: parsed.error.flatten() } });
        }
        const { q, plan, status, page, page_size } = parsed.data;
        const offset = (page - 1) * page_size;

        // We aggregate per-user fields — license count, top plan, MRR,
        // last activity — so the table is useful at a glance without
        // requiring a click-through.
        const params: unknown[] = [];
        const where: string[] = [];
        if (q) {
            params.push(`%${q}%`);
            where.push(`u.email ILIKE $${params.length}`);
        }
        if (plan) {
            params.push(plan);
            where.push(`EXISTS (SELECT 1 FROM licenses l2 JOIN plans p2 ON p2.id=l2.plan_id WHERE l2.user_id=u.id AND p2.code = $${params.length})`);
        }
        if (status) {
            params.push(status);
            where.push(`EXISTS (SELECT 1 FROM licenses l3 WHERE l3.user_id=u.id AND l3.status::text = $${params.length})`);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

        params.push(page_size, offset);
        const limitSql = `LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const { rows } = await query(
            `SELECT
                u.id, u.email, u.created_at, u.freemius_user_id,
                COUNT(l.id) AS license_count,
                COALESCE(MAX(l.updated_at), u.created_at) AS last_activity,
                COALESCE(MAX(p.price_monthly_cents), 0) AS top_plan_monthly_cents,
                MAX(p.code) FILTER (WHERE p.code <> 'free') AS top_paid_plan,
                BOOL_OR(l.status = 'trialing') AS has_trial,
                BOOL_OR(l.status = 'active' AND p.code <> 'free') AS has_paid_active
            FROM users u
            LEFT JOIN licenses l ON l.user_id = u.id
            LEFT JOIN plans p ON p.id = l.plan_id
            ${whereSql}
            GROUP BY u.id
            ORDER BY last_activity DESC
            ${limitSql}`,
            params,
        );

        const { rows: countRows } = await query<{ n: string }>(
            `SELECT COUNT(*)::bigint AS n FROM users u ${whereSql}`,
            params.slice(0, params.length - 2),
        );

        await auditLog({
            admin: req.admin!, req,
            action: "users.list", severity: "info",
            metadata: { q: q ?? null, plan: plan ?? null, status: status ?? null, page, page_size },
        });

        return {
            users: rows,
            page, page_size,
            total: Number(countRows[0]!.n),
        };
    });

    // ─── /admin/users/:id ───────────────────────────────────────────
    app.get<{ Params: { id: string } }>("/admin/users/:id", guard, async (req, reply) => {
        const id = req.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return reply.code(400).send({ error: { code: "bad_id", message: "Invalid user id" } });
        }

        const { rows: userRows } = await query(
            `SELECT id, email, freemius_user_id, created_at, updated_at
               FROM users WHERE id = $1`,
            [id],
        );
        const user = userRows[0];
        if (!user) {
            return reply.code(404).send({ error: { code: "not_found", message: "User not found" } });
        }

        const { rows: licenses } = await query(
            `SELECT l.id, l.license_key, l.status, l.billing,
                    l.current_period_start, l.current_period_end, l.canceled_at,
                    l.created_at, l.updated_at,
                    p.code AS plan_code, p.name AS plan_name,
                    p.images_per_month, p.max_sites,
                    (SELECT COUNT(*) FROM sites s
                       WHERE s.license_id = l.id AND s.deactivated_at IS NULL) AS active_sites,
                    (SELECT images_used FROM usage_counters uc
                       WHERE uc.license_id = l.id
                         AND uc.period = DATE_TRUNC('month', NOW())::date) AS images_used_this_month
               FROM licenses l
               JOIN plans p ON p.id = l.plan_id
              WHERE l.user_id = $1
              ORDER BY l.created_at DESC`,
            [id],
        );

        const { rows: sites } = await query(
            `SELECT s.id, s.license_id, s.site_url, s.site_host, s.wp_version,
                    s.plugin_version, s.activated_at, s.deactivated_at, s.last_seen_at
               FROM sites s
               JOIN licenses l ON l.id = s.license_id
              WHERE l.user_id = $1
              ORDER BY s.activated_at DESC`,
            [id],
        );

        const { rows: audit } = await query(
            `SELECT id, action, severity, metadata, ip, created_at, admin_email
               FROM admin_audit_log
              WHERE target_type = 'user' AND target_id = $1
              ORDER BY created_at DESC LIMIT 50`,
            [id],
        );

        await auditLog({
            admin: req.admin!, req,
            action: "user.view", severity: "info",
            targetType: "user", targetId: id,
        });

        return { user, licenses, sites, audit };
    });

    // ─── /admin/licenses ────────────────────────────────────────────
    const licensesQuery = z.object({
        q: z.string().trim().min(1).max(120).optional(),
        plan: z.string().trim().min(1).max(40).optional(),
        status: z.enum(["active", "trialing", "past_due", "canceled", "expired"]).optional(),
        billing: z.enum(["monthly", "annual", "lifetime", "free"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(200).default(50),
    });

    app.get("/admin/licenses", guard, async (req, reply) => {
        const parsed = licensesQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_query", message: "Invalid filters", details: parsed.error.flatten() } });
        }
        const { q, plan, status, billing, page, page_size } = parsed.data;
        const offset = (page - 1) * page_size;

        const params: unknown[] = [];
        const where: string[] = [];
        if (q) {
            params.push(`%${q}%`);
            // Search by email OR license_key prefix (license keys are 64-hex,
            // we don't want a wildcard %% blast — match prefix only).
            where.push(`(u.email ILIKE $${params.length} OR l.license_key ILIKE $${params.length})`);
        }
        if (plan)    { params.push(plan);    where.push(`p.code = $${params.length}`); }
        if (status)  { params.push(status);  where.push(`l.status::text = $${params.length}`); }
        if (billing) { params.push(billing); where.push(`l.billing::text = $${params.length}`); }
        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

        params.push(page_size, offset);

        const { rows } = await query(
            `SELECT
                l.id, l.license_key, l.status, l.billing,
                l.current_period_end, l.canceled_at, l.created_at,
                u.id AS user_id, u.email,
                p.code AS plan_code, p.name AS plan_name,
                (SELECT COUNT(*) FROM sites s
                   WHERE s.license_id = l.id AND s.deactivated_at IS NULL) AS active_sites,
                (SELECT images_used FROM usage_counters uc
                   WHERE uc.license_id = l.id
                     AND uc.period = DATE_TRUNC('month', NOW())::date) AS images_used_this_month
             FROM licenses l
             JOIN users u ON u.id = l.user_id
             JOIN plans p ON p.id = l.plan_id
             ${whereSql}
             ORDER BY l.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );

        const { rows: countRows } = await query<{ n: string }>(
            `SELECT COUNT(*)::bigint AS n
               FROM licenses l
               JOIN users u ON u.id = l.user_id
               JOIN plans p ON p.id = l.plan_id
               ${whereSql}`,
            params.slice(0, params.length - 2),
        );

        await auditLog({
            admin: req.admin!, req,
            action: "licenses.list", severity: "info",
            metadata: { q: q ?? null, plan: plan ?? null, status: status ?? null, billing: billing ?? null, page, page_size },
        });

        return { licenses: rows, page, page_size, total: Number(countRows[0]!.n) };
    });

    // ─── /admin/installs ────────────────────────────────────────────
    // Site-level view. Useful to detect license abuse (1 Starter on 50 sites,
    // a stale install never deactivated, plugin versions drift).
    const installsQuery = z.object({
        q: z.string().trim().min(1).max(120).optional(),
        active: z.coerce.boolean().optional(),
        stale_days: z.coerce.number().int().min(1).max(365).optional(),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(200).default(50),
    });

    app.get("/admin/installs", guard, async (req, reply) => {
        const parsed = installsQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_query", message: "Invalid filters", details: parsed.error.flatten() } });
        }
        const { q, active, stale_days, page, page_size } = parsed.data;
        const offset = (page - 1) * page_size;

        const params: unknown[] = [];
        const where: string[] = [];
        if (q) {
            params.push(`%${q}%`);
            where.push(`(s.site_host ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }
        if (active === true)  where.push(`s.deactivated_at IS NULL`);
        if (active === false) where.push(`s.deactivated_at IS NOT NULL`);
        if (stale_days != null) {
            params.push(stale_days);
            where.push(`(s.last_seen_at IS NULL OR s.last_seen_at < NOW() - ($${params.length} || ' days')::interval)`);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

        params.push(page_size, offset);

        const { rows } = await query(
            `SELECT s.id, s.license_id, s.site_url, s.site_host,
                    s.wp_version, s.plugin_version,
                    s.activated_at, s.deactivated_at, s.last_seen_at,
                    l.license_key, l.status AS license_status,
                    p.code AS plan_code, p.name AS plan_name,
                    u.id AS user_id, u.email
             FROM sites s
             JOIN licenses l ON l.id = s.license_id
             JOIN plans p    ON p.id = l.plan_id
             JOIN users u    ON u.id = l.user_id
             ${whereSql}
             ORDER BY s.last_seen_at DESC NULLS LAST
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );

        const { rows: countRows } = await query<{ n: string }>(
            `SELECT COUNT(*)::bigint AS n
               FROM sites s
               JOIN licenses l ON l.id = s.license_id
               JOIN users u ON u.id = l.user_id
               ${whereSql}`,
            params.slice(0, params.length - 2),
        );

        await auditLog({
            admin: req.admin!, req,
            action: "installs.list", severity: "info",
            metadata: { q: q ?? null, active: active ?? null, stale_days: stale_days ?? null, page, page_size },
        });

        return { installs: rows, page, page_size, total: Number(countRows[0]!.n) };
    });

    // ─── /admin/webhooks/events ─────────────────────────────────────
    // Recent webhook deliveries — pending, processed, errored. Filter
    // by `error=1` to surface signature failures and retries quickly.
    const webhooksQuery = z.object({
        provider: z.string().trim().min(1).max(40).optional(),
        type: z.string().trim().min(1).max(80).optional(),
        error: z.coerce.boolean().optional(),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(200).default(50),
    });

    app.get("/admin/webhooks/events", guard, async (req, reply) => {
        const parsed = webhooksQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_query", message: "Invalid filters", details: parsed.error.flatten() } });
        }
        const { provider, type, error, page, page_size } = parsed.data;
        const offset = (page - 1) * page_size;

        const params: unknown[] = [];
        const where: string[] = [];
        if (provider) { params.push(provider); where.push(`provider = $${params.length}`); }
        if (type)     { params.push(type);     where.push(`event_type = $${params.length}`); }
        if (error === true)  where.push(`processing_error IS NOT NULL`);
        if (error === false) where.push(`processing_error IS NULL`);
        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

        params.push(page_size, offset);

        // Don't return full payload in the list (can be huge) — drill-down
        // endpoint for that. List view only shows an excerpt.
        const { rows } = await query(
            `SELECT id, provider, event_id, event_type,
                    received_at, processed_at, processing_error,
                    LENGTH(payload::text) AS payload_size
             FROM webhooks_events
             ${whereSql}
             ORDER BY received_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );

        const { rows: countRows } = await query<{ n: string }>(
            `SELECT COUNT(*)::bigint AS n FROM webhooks_events ${whereSql}`,
            params.slice(0, params.length - 2),
        );

        await auditLog({
            admin: req.admin!, req,
            action: "webhooks.list", severity: "info",
            metadata: { provider: provider ?? null, type: type ?? null, error: error ?? null, page, page_size },
        });

        return { events: rows, page, page_size, total: Number(countRows[0]!.n) };
    });

    app.get<{ Params: { id: string } }>("/admin/webhooks/events/:id", guard, async (req, reply) => {
        const id = req.params.id;
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
            return reply.code(400).send({ error: { code: "bad_id", message: "Invalid event id" } });
        }
        const { rows } = await query(
            `SELECT id, provider, event_id, event_type, payload,
                    received_at, processed_at, processing_error
               FROM webhooks_events WHERE id = $1`,
            [id],
        );
        const event = rows[0];
        if (!event) {
            return reply.code(404).send({ error: { code: "not_found", message: "Event not found" } });
        }
        await auditLog({
            admin: req.admin!, req,
            action: "webhook.view", severity: "info",
            targetType: "webhook", targetId: id,
        });
        return { event };
    });

    // ─── /admin/audit ───────────────────────────────────────────────
    // Self-observation. Read-only view of admin_audit_log.
    const auditQuery = z.object({
        admin_email: z.string().email().optional(),
        action: z.string().trim().min(1).max(80).optional(),
        severity: z.enum(["info", "warn", "critical"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(200).default(100),
    });

    // ─── /admin/email/test ──────────────────────────────────────────
    // Fire any transactional template to any recipient — for QA without
    // creating real signups in the DB. Audited at warn so we always know
    // an admin sent a fake email (could otherwise be confused for prod).
    const emailTestBody = z.object({
        to: z.string().email(),
        template: z.enum([
            "welcome-free", "trial-started", "trial-ending",
            "payment-received", "quota-warn", "quota-exceeded",
            "subscription-cancelled",
        ]),
    });
    app.post("/admin/email/test", guard, async (req, reply) => {
        const parsed = emailTestBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_body", message: "to + template required", details: parsed.error.flatten() } });
        }
        const { to, template } = parsed.data;

        const sample = sampleCtx(to);
        let payload;
        switch (template) {
            case "welcome-free":           payload = welcomeFreeEmail(sample); break;
            case "trial-started":          payload = trialStartedEmail(sample); break;
            case "trial-ending":           payload = trialEndingEmail(sample); break;
            case "payment-received":       payload = paymentReceivedEmail(sample); break;
            case "quota-warn":             payload = quotaWarnEmail(sample); break;
            case "quota-exceeded":         payload = quotaExceededEmail(sample); break;
            case "subscription-cancelled": payload = subscriptionCancelledEmail(sample); break;
        }

        const result = await sendTransactional(payload, req.log);
        await auditLog({
            admin: req.admin!, req,
            action: "email.test", severity: "warn",
            metadata: { to, template, ok: result.ok, reason: result.reason ?? null },
        });
        return reply.code(result.ok ? 200 : 502).send({ ok: result.ok, reason: result.reason, messageId: result.messageId });
    });

    app.get("/admin/audit", guard, async (req, reply) => {
        const parsed = auditQuery.safeParse(req.query);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_query", message: "Invalid filters", details: parsed.error.flatten() } });
        }
        const { admin_email, action, severity, page, page_size } = parsed.data;
        const offset = (page - 1) * page_size;

        const params: unknown[] = [];
        const where: string[] = [];
        if (admin_email) { params.push(admin_email); where.push(`admin_email = $${params.length}`); }
        if (action)      { params.push(action);      where.push(`action = $${params.length}`); }
        if (severity)    { params.push(severity);    where.push(`severity = $${params.length}`); }
        const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

        params.push(page_size, offset);

        const { rows } = await query(
            `SELECT id, admin_user_id, admin_email, action, severity,
                    target_type, target_id, ip, user_agent,
                    metadata, reason, created_at
             FROM admin_audit_log
             ${whereSql}
             ORDER BY created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params,
        );

        // Note: do NOT audit the audit-list view itself. Otherwise every
        // refresh of the page generates a row → infinite growth.

        return { entries: rows, page, page_size };
    });
}

/**
 * Realistic but obviously-fake context for /admin/email/test.
 * Uses a clearly-test license key + plan so the recipient can tell at
 * a glance that this isn't a real notification.
 */
function sampleCtx(toEmail: string) {
    const fakeKey = "TEST00000000000000000000000000000000000000000000000000000000TEST";
    return {
        email: toEmail,
        firstName: "Otmane",
        licenseKey: fakeKey,
        planName: "Growth",
        daysLeft: 3,
        trialEndsOn: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
        amountCents: 1200,
        currency: "EUR",
        nextBillingOn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        usedPct: 80,
        imagesUsed: 20_000,
        imagesQuota: 25_000,
    };
}
