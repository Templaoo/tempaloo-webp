import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { query, withTx } from "../../db.js";
import { auditLog, clientIp } from "../../lib/audit.js";
import {
    constantTimeEqual,
    decryptSecret,
    hashBackupCode,
    hashToken,
    newSessionToken,
} from "../../lib/admin-crypto.js";
import { verifyPassword } from "../../lib/argon.js";
import { verifyTotp } from "../../lib/totp.js";
import { requireAdmin } from "../../middleware/require-admin.js";

/**
 * Admin auth flow:
 *
 *   1. POST /admin/auth/login   { email, password }
 *      → 200, sets a half-open session cookie (mfa_passed = false).
 *      → 401 on bad creds, increments failed_attempts; auto-locks after 5.
 *
 *   2. POST /admin/auth/totp    { code }      ← cookie required
 *      → flips mfa_passed = true. Now the session can hit /admin/* data
 *        routes. Backup-code path: { backup_code } instead of { code }.
 *
 *   3. POST /admin/auth/logout                ← cookie required
 *      → revokes the session row. Even if the cookie leaks afterwards,
 *        it can't be replayed.
 *
 * Session cookie:
 *   · Name: ADMIN_COOKIE_NAME (env, defaults tempaloo_admin_sid)
 *   · HttpOnly, Secure (in prod), SameSite=Strict, Path=/, no Domain
 *   · Lifetime: ADMIN_SESSION_TTL_MIN minutes
 */
const LOGIN_LOCK_THRESHOLD = 5;
const LOGIN_LOCK_MINUTES = 15;

const loginBody = z.object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1).max(200),
});
const totpBody = z.object({
    code: z.string().regex(/^\d{6}$/).optional(),
    backup_code: z.string().min(8).max(20).optional(),
}).refine((v) => !!v.code || !!v.backup_code, {
    message: "Provide either code or backup_code",
});

interface AdminRow {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    totp_secret_enc: Buffer | null;
    totp_enabled: boolean;
    is_active: boolean;
    failed_attempts: number;
    locked_until: Date | null;
}

export default async function adminAuthRoutes(app: FastifyInstance) {
    // Tighter rate limit on the login surface — 10 attempts / 15 min / IP.
    // Per-account lock kicks in at 5 failures (handled in the handler).
    const loginLimit = { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } };

    app.post("/admin/auth/login", loginLimit, async (req, reply) => {
        const parsed = loginBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_request", message: "Invalid email or password format" } });
        }
        const { email, password } = parsed.data;

        const { rows } = await query<AdminRow>(
            `SELECT id, email, name, password_hash, totp_secret_enc,
                    totp_enabled, is_active, failed_attempts, locked_until
               FROM admin_users
              WHERE email = $1
              LIMIT 1`,
            [email],
        );
        const user = rows[0];

        // Constant-time-ish: even if the user doesn't exist, we run a
        // dummy verify so timing doesn't reveal account existence.
        if (!user) {
            await verifyPassword(
                "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                password,
            ).catch(() => false);
            await auditLog({
                admin: null, fallbackEmail: email, req,
                action: "login.failure", severity: "warn",
                metadata: { reason: "unknown_email" },
            });
            return reply.code(401).send({ error: { code: "invalid_credentials", message: "Invalid credentials" } });
        }

        if (!user.is_active) {
            await auditLog({
                admin: { id: user.id, email: user.email }, req,
                action: "login.failure", severity: "warn",
                metadata: { reason: "user_disabled" },
            });
            return reply.code(401).send({ error: { code: "invalid_credentials", message: "Invalid credentials" } });
        }

        if (user.locked_until && user.locked_until.getTime() > Date.now()) {
            await auditLog({
                admin: { id: user.id, email: user.email }, req,
                action: "login.failure", severity: "warn",
                metadata: { reason: "account_locked", until: user.locked_until.toISOString() },
            });
            return reply.code(429).send({ error: { code: "locked", message: "Too many attempts, try again later" } });
        }

        const ok = await verifyPassword(user.password_hash, password);
        if (!ok) {
            const next = user.failed_attempts + 1;
            const shouldLock = next >= LOGIN_LOCK_THRESHOLD;
            await query(
                `UPDATE admin_users
                    SET failed_attempts = $2,
                        locked_until = CASE WHEN $3::boolean
                                            THEN NOW() + ($4 || ' minutes')::interval
                                            ELSE locked_until END
                  WHERE id = $1`,
                [user.id, next, shouldLock, LOGIN_LOCK_MINUTES],
            );
            await auditLog({
                admin: { id: user.id, email: user.email }, req,
                action: "login.failure", severity: shouldLock ? "critical" : "warn",
                metadata: { reason: "bad_password", failed_attempts: next, locked: shouldLock },
            });
            return reply.code(401).send({ error: { code: "invalid_credentials", message: "Invalid credentials" } });
        }

        // Password OK — open a half-session, MFA pending.
        // We DO NOT yet zero failed_attempts: that happens after MFA,
        // so a stolen password but no second factor still trips the lock.
        const session = await openSession(user.id, req, /* mfaPassed */ !user.totp_enabled);

        await auditLog({
            admin: { id: user.id, email: user.email }, req,
            action: "login.password_ok",
            severity: "info",
            metadata: { mfa_required: user.totp_enabled },
        });

        setSessionCookie(reply, session.token);

        return reply.code(200).send({
            ok: true,
            mfa_required: user.totp_enabled,
            user: { id: user.id, email: user.email, name: user.name },
        });
    });

    app.post("/admin/auth/totp", { preHandler: requireAdmin({ requireMfa: false }) }, async (req, reply) => {
        const parsed = totpBody.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send({ error: { code: "bad_request", message: "code or backup_code required" } });
        }
        const admin = req.admin!;
        const token = readSessionToken(req);
        if (!token) {
            return reply.code(401).send({ error: { code: "no_session", message: "Sign in required" } });
        }

        const { rows } = await query<{ totp_secret_enc: Buffer | null; totp_enabled: boolean }>(
            `SELECT totp_secret_enc, totp_enabled FROM admin_users WHERE id = $1`,
            [admin.id],
        );
        const row = rows[0];
        if (!row || !row.totp_enabled || !row.totp_secret_enc) {
            return reply.code(400).send({ error: { code: "totp_not_enrolled", message: "2FA not enrolled" } });
        }

        let pass = false;
        let usedBackup = false;

        if (parsed.data.code) {
            const secret = decryptSecret(row.totp_secret_enc);
            pass = verifyTotp(secret, parsed.data.code);
        } else if (parsed.data.backup_code) {
            // Try every unused backup code in constant time per row.
            const target = hashBackupCode(parsed.data.backup_code);
            const { rows: codes } = await query<{ id: string; code_hash: Buffer }>(
                `SELECT id, code_hash FROM admin_backup_codes
                  WHERE admin_user_id = $1 AND used_at IS NULL`,
                [admin.id],
            );
            for (const c of codes) {
                if (constantTimeEqual(c.code_hash, target)) {
                    pass = true;
                    usedBackup = true;
                    await query(
                        `UPDATE admin_backup_codes SET used_at = NOW() WHERE id = $1`,
                        [c.id],
                    );
                    break;
                }
            }
        }

        if (!pass) {
            await auditLog({
                admin: { id: admin.id, email: admin.email }, req,
                action: "login.totp_failure", severity: "warn",
                metadata: { backup_attempt: !!parsed.data.backup_code },
            });
            return reply.code(401).send({ error: { code: "invalid_totp", message: "Invalid 2FA code" } });
        }

        await withTx(async (client) => {
            await client.query(
                `UPDATE admin_sessions SET mfa_passed = TRUE WHERE token_hash = $1`,
                [hashToken(token)],
            );
            await client.query(
                `UPDATE admin_users
                    SET failed_attempts = 0,
                        locked_until = NULL,
                        last_login_at = NOW(),
                        last_login_ip = $2
                  WHERE id = $1`,
                [admin.id, clientIp(req)],
            );
        });

        await auditLog({
            admin: { id: admin.id, email: admin.email }, req,
            action: "login.success", severity: "info",
            metadata: { used_backup_code: usedBackup },
        });

        return reply.code(200).send({
            ok: true,
            user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
        });
    });

    app.post("/admin/auth/logout", { preHandler: requireAdmin({ requireMfa: false }) }, async (req, reply) => {
        const token = readSessionToken(req);
        if (token) {
            await query(
                `UPDATE admin_sessions
                    SET revoked_at = NOW()
                  WHERE token_hash = $1 AND revoked_at IS NULL`,
                [hashToken(token)],
            );
        }
        await auditLog({
            admin: req.admin ? { id: req.admin.id, email: req.admin.email } : null,
            req, action: "logout", severity: "info",
        });
        clearSessionCookie(reply);
        return reply.code(200).send({ ok: true });
    });

    app.get("/admin/auth/me", { preHandler: requireAdmin() }, async (req) => ({
        ok: true,
        user: req.admin,
    }));
}

// ─── Cookie + session helpers ───────────────────────────────────────

async function openSession(adminUserId: string, req: FastifyRequest, mfaPassed: boolean) {
    const { token, hash } = newSessionToken();
    const ttlMs = config.ADMIN_SESSION_TTL_MIN * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    await query(
        `INSERT INTO admin_sessions
            (admin_user_id, token_hash, mfa_passed, ip, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            adminUserId, hash, mfaPassed,
            clientIp(req),
            (req.headers["user-agent"] ?? "").toString().slice(0, 500),
            expiresAt,
        ],
    );
    return { token };
}

function setSessionCookie(reply: FastifyReply, token: string) {
    const ttl = config.ADMIN_SESSION_TTL_MIN * 60;
    const secure = config.NODE_ENV === "production";
    const parts = [
        `${config.ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        `Max-Age=${ttl}`,
    ];
    if (secure) parts.push("Secure");
    reply.header("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(reply: FastifyReply) {
    const secure = config.NODE_ENV === "production";
    const parts = [
        `${config.ADMIN_COOKIE_NAME}=`,
        "Path=/",
        "HttpOnly",
        "SameSite=Strict",
        "Max-Age=0",
    ];
    if (secure) parts.push("Secure");
    reply.header("Set-Cookie", parts.join("; "));
}

function readSessionToken(req: FastifyRequest): string | null {
    const header = req.headers.cookie;
    if (!header) return null;
    const re = new RegExp(`(?:^|;\\s*)${config.ADMIN_COOKIE_NAME}=([^;]*)`);
    const m = re.exec(header);
    if (!m) return null;
    try { return decodeURIComponent(m[1]!); } catch { return null; }
}
