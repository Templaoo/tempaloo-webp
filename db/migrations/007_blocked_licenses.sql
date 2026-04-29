-- 007_blocked_licenses.sql
--
-- Adds an admin-driven block flag to licenses so we can shut down
-- abuse (key sharing, automated quota chaining, leaked keys) without
-- waiting for a Freemius cancellation. Block check runs in the same
-- code path as the "is the license active" check, so a blocked key
-- behaves exactly like a canceled one toward the plugin/API: 401.
--
-- Why a flag instead of just setting status='canceled':
--   · Keeps the Freemius truth (status comes from the webhook) separate
--     from our admin override. Reconcile won't accidentally un-block.
--   · Makes "blocked" visible in /admin/licenses + /admin/abuse without
--     conflating with regular cancellation analytics.
--   · Cheap to revert: clear blocked_at and the license is live again
--     (assuming Freemius status is still active).

BEGIN;

ALTER TABLE licenses
    ADD COLUMN IF NOT EXISTS blocked_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS blocked_reason      TEXT,
    ADD COLUMN IF NOT EXISTS blocked_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_licenses_blocked
    ON licenses (blocked_at) WHERE blocked_at IS NOT NULL;

COMMIT;
