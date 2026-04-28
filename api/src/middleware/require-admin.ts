import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { query } from "../db.js";
import { hashToken } from "../lib/admin-crypto.js";

/**
 * Admin session guard.
 *
 * Reads the opaque session cookie, hashes it, looks up the live row in
 * admin_sessions, refuses if:
 *   · cookie missing
 *   · session revoked or expired
 *   · MFA step not yet completed
 *   · admin_user is_active = false
 *
 * On success: refreshes last_seen_at and stashes the resolved admin
 * onto `req.admin` for downstream handlers to use.
 */
export interface AdminContext {
    id: string;
    email: string;
    name: string;
    role: "owner" | "staff" | "readonly";
}

declare module "fastify" {
    interface FastifyRequest {
        admin?: AdminContext;
    }
}

interface SessionRow {
    id: string;
    admin_user_id: string;
    email: string;
    name: string;
    role: "owner" | "staff" | "readonly";
    is_active: boolean;
    mfa_passed: boolean;
}

const COOKIE_RE = /(?:^|;\s*)([^=;]+)=([^;]*)/g;
function readCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;
    let match: RegExpExecArray | null;
    COOKIE_RE.lastIndex = 0;
    while ((match = COOKIE_RE.exec(header)) !== null) {
        if (match[1] === name) {
            try { return decodeURIComponent(match[2] ?? ""); } catch { return null; }
        }
    }
    return null;
}

/**
 * `requireMfa = false` is used only by `/admin/auth/totp` so the MFA
 * step itself can authenticate against a half-open session.
 */
export function requireAdmin(opts: { requireMfa?: boolean } = {}) {
    const requireMfa = opts.requireMfa !== false;

    return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
        const token = readCookie(req.headers.cookie, config.ADMIN_COOKIE_NAME);
        if (!token) {
            await reply.code(401).send({ error: { code: "no_session", message: "Sign in required" } });
            return;
        }

        const hash = hashToken(token);
        const { rows } = await query<SessionRow>(
            `SELECT s.id, s.admin_user_id, s.mfa_passed,
                    u.email, u.name, u.role, u.is_active
               FROM admin_sessions s
               JOIN admin_users u ON u.id = s.admin_user_id
              WHERE s.token_hash = $1
                AND s.revoked_at IS NULL
                AND s.expires_at > NOW()`,
            [hash],
        );

        const row = rows[0];
        if (!row || !row.is_active) {
            await reply.code(401).send({ error: { code: "no_session", message: "Sign in required" } });
            return;
        }

        if (requireMfa && !row.mfa_passed) {
            await reply.code(401).send({ error: { code: "mfa_required", message: "Complete 2FA" } });
            return;
        }

        // Best-effort touch — failure here doesn't block the request.
        query(
            `UPDATE admin_sessions SET last_seen_at = NOW() WHERE id = $1`,
            [row.id],
        ).catch(() => { /* logging only */ });

        req.admin = {
            id: row.admin_user_id,
            email: row.email,
            name: row.name,
            role: row.role,
        };
    };
}
