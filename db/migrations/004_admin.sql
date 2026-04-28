-- 004_admin.sql
--
-- Backoffice admin (admin.tempaloo.com / /admin/*).
--
-- Strict isolation from `users` (clients):
--   · Separate table — an admin is NOT a client. Compromising a customer
--     account must never leak into admin.
--   · No FK between admin_users and users.
--   · Argon2id passwords (PHC string format), TOTP 2FA, opaque session
--     tokens (sha256 stored, raw never persisted).
--
-- Append-only audit log:
--   · admin_audit_log has no app-level UPDATE/DELETE call sites.
--   · In production, the runtime DB role should be granted only
--     INSERT + SELECT on this table (REVOKE UPDATE, DELETE).

BEGIN;

-- ─── admin_users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,

    -- Argon2id PHC string. Never bcrypt/sha.
    password_hash   TEXT NOT NULL,

    -- AES-GCM ciphertext (iv || ciphertext || tag), key in ADMIN_TOTP_KEY env.
    -- NULL until the user completes TOTP enrollment.
    totp_secret_enc BYTEA,
    totp_enabled    BOOLEAN NOT NULL DEFAULT FALSE,

    role            TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'readonly')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Anti brute-force
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email_active
    ON admin_users (email) WHERE is_active = TRUE;

-- ─── admin_sessions ─────────────────────────────────────────────────
-- Opaque token (32 random bytes), we store sha256(token) only.
-- Sessions are short (30 min absolute) and can be revoked instantly.
CREATE TABLE IF NOT EXISTS admin_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id   UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,

    token_hash      BYTEA NOT NULL UNIQUE,

    -- Two-step login: row created on password-OK, mfa_passed flips on TOTP-OK.
    -- All admin routes require mfa_passed = TRUE.
    mfa_passed      BOOLEAN NOT NULL DEFAULT FALSE,

    ip              INET NOT NULL,
    user_agent      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_live
    ON admin_sessions (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
    ON admin_sessions (admin_user_id);

-- ─── admin_backup_codes ─────────────────────────────────────────────
-- 8 codes per admin, hashed individually. Used once, then used_at set.
CREATE TABLE IF NOT EXISTS admin_backup_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id   UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    code_hash       BYTEA NOT NULL,
    used_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_unused
    ON admin_backup_codes (admin_user_id) WHERE used_at IS NULL;

-- ─── admin_audit_log ────────────────────────────────────────────────
-- Append-only. Every admin-side action lands here. Snapshot of email
-- preserved so audit history survives admin_users deletion.
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id              BIGSERIAL PRIMARY KEY,

    admin_user_id   UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    admin_email     CITEXT NOT NULL,

    -- Dotted action name: 'license.cancel', 'user.view', 'login.success',
    -- 'login.failure', 'totp.enroll', 'session.revoke'…
    action          TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('info', 'warn', 'critical')),

    target_type     TEXT,
    target_id       TEXT,

    ip              INET NOT NULL,
    user_agent      TEXT,

    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- App enforces: any destructive action must supply a non-empty reason.
    reason          TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_time
    ON admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_time
    ON admin_audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target
    ON admin_audit_log (target_type, target_id) WHERE target_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_critical_time
    ON admin_audit_log (created_at DESC) WHERE severity = 'critical';

-- updated_at autotouch on admin_users
CREATE OR REPLACE FUNCTION admin_users_touch() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_users_touch ON admin_users;
CREATE TRIGGER trg_admin_users_touch
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION admin_users_touch();

COMMIT;
