import type { FastifyRequest } from "fastify";
import { query } from "../db.js";
import { sendTransactional } from "./email.js";
import { adminCriticalAlertEmail } from "./email-templates.js";

/**
 * Append-only audit log writer.
 *
 * Every admin-side action — read OR write — should call this. The DB
 * runtime role is expected to have INSERT+SELECT only on this table,
 * so even a SQL-injection in the admin API can't tamper with the log.
 *
 * `admin_email` is snapshotted at write time so the audit trail survives
 * deletion of the admin_users row (FK is ON DELETE SET NULL).
 *
 * Failures here are LOGGED, never thrown. We don't want a missing audit
 * row to break a destructive action mid-flight (the action has already
 * happened by the time we write the log).
 */
export type AuditSeverity = "info" | "warn" | "critical";

export interface AuditAdmin {
    id: string;
    email: string;
}

export interface AuditOpts {
    admin: AuditAdmin | null;
    /** Snapshot email for unauthenticated events (e.g. login failure). */
    fallbackEmail?: string;
    action: string;
    severity?: AuditSeverity;
    targetType?: string;
    targetId?: string | number;
    metadata?: Record<string, unknown>;
    reason?: string;
    req: FastifyRequest;
}

export async function auditLog(opts: AuditOpts): Promise<void> {
    const email = opts.admin?.email ?? opts.fallbackEmail ?? "unknown";
    const ip = clientIp(opts.req);
    const ua = (opts.req.headers["user-agent"] ?? "").toString().slice(0, 500);

    try {
        await query(
            `INSERT INTO admin_audit_log
                (admin_user_id, admin_email, action, severity,
                 target_type, target_id, ip, user_agent, metadata, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)`,
            [
                opts.admin?.id ?? null,
                email,
                opts.action,
                opts.severity ?? "info",
                opts.targetType ?? null,
                opts.targetId != null ? String(opts.targetId) : null,
                ip,
                ua || null,
                JSON.stringify(opts.metadata ?? {}),
                opts.reason ?? null,
            ],
        );
    } catch (e) {
        opts.req.log.error({ e, action: opts.action }, "audit log write failed");
    }

    // Fire critical alerts AFTER the audit row is persisted. Failures are
    // logged-only — a Brevo hiccup must not stop the action that triggered
    // this audit entry.
    if ((opts.severity ?? "info") === "critical") {
        fireCriticalAlert(opts, email, ip, ua).catch((e) =>
            opts.req.log.error({ e, action: opts.action }, "critical alert email failed"),
        );
    }
}

/**
 * Email every active OWNER admin when a critical audit event lands.
 * Debounced: if the same `action` was alerted in the last 5 minutes,
 * skip — otherwise a brute-force burst would generate one email per
 * failed attempt.
 */
const recentAlertCache = new Map<string, number>();
const DEBOUNCE_MS = 5 * 60 * 1000;

async function fireCriticalAlert(opts: AuditOpts, email: string, ip: string, ua: string): Promise<void> {
    const debounceKey = `${opts.action}::${email}`;
    const now = Date.now();
    const last = recentAlertCache.get(debounceKey);
    if (last && now - last < DEBOUNCE_MS) return;
    recentAlertCache.set(debounceKey, now);

    // Cleanup old entries lazily — the cache is intentionally process-local
    // (one alert per worker per 5min is acceptable; we'd rather over-notify
    // than store debounce state in DB on every audit write).
    if (recentAlertCache.size > 1000) {
        const cutoff = now - DEBOUNCE_MS;
        for (const [k, t] of recentAlertCache) if (t < cutoff) recentAlertCache.delete(k);
    }

    const { rows } = await query<{ email: string }>(
        `SELECT email FROM admin_users
          WHERE is_active = TRUE AND role = 'owner'`,
    );
    if (rows.length === 0) return;

    const meta = {
        ...opts.metadata,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        userAgent: ua,
        reason: opts.reason ?? null,
    };

    await Promise.all(rows.map((r) =>
        sendTransactional(adminCriticalAlertEmail({
            to: r.email,
            action: opts.action,
            actorEmail: email,
            ip,
            metadata: meta,
        })),
    ));
}

/**
 * Resolve the real client IP. Fastify's `trustProxy: true` already does
 * the X-Forwarded-For parsing for us, so `req.ip` is the rightmost
 * untrusted hop — which is what we want.
 */
export function clientIp(req: FastifyRequest): string {
    return req.ip || "0.0.0.0";
}
