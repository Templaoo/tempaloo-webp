import type { FastifyRequest } from "fastify";
import { query } from "../db.js";

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
}

/**
 * Resolve the real client IP. Fastify's `trustProxy: true` already does
 * the X-Forwarded-For parsing for us, so `req.ip` is the rightmost
 * untrusted hop — which is what we want.
 */
export function clientIp(req: FastifyRequest): string {
    return req.ip || "0.0.0.0";
}
