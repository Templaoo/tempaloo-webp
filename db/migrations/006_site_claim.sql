-- 006_site_claim.sql
--
-- Two changes that work together to enforce the "1 site = 1 user" rule:
--
-- 1. activation_ip on sites — IP recorded at activation time, kept for
--    forensics only (not a gate). Useful for /admin/abuse triage.
-- 2. email_normalized on users — strips Gmail aliases (john+x@gmail.com,
--    j.o.h.n@gmail.com → johndoe@gmail.com) so multiple "different"
--    Gmail accounts collapse into the same user row at signup time.
--    Without this, a user can ALWAYS bypass the site-claim rule by
--    creating an aliased Gmail and a fresh license, then activating
--    on the same site.
--
-- The rule itself (refuse activation when site_host belongs to another
-- user) is enforced in app code, not in the DB constraint, because it
-- needs the cross-table lookup against users.id.

BEGIN;

-- ─── activation_ip on sites ────────────────────────────────────────
ALTER TABLE sites
    ADD COLUMN IF NOT EXISTS activation_ip INET;

-- ─── email_normalized on users ─────────────────────────────────────
-- Stored separately from `email` so we can rebuild it later if the
-- rules change (Gmail edge cases, new providers). The active rule is
-- in app code (lib/email-normalize.ts) — DB just enforces uniqueness.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_normalized CITEXT;

-- Backfill: copy existing emails through the same normalization the
-- app code applies. Done in SQL for correctness on dots + aliases for
-- Gmail; everything else passes through lowercased.
UPDATE users
   SET email_normalized = CASE
       WHEN LOWER(SPLIT_PART(email::text, '@', 2)) IN ('gmail.com', 'googlemail.com') THEN
           REPLACE(SPLIT_PART(LOWER(SPLIT_PART(email::text, '@', 1)), '+', 1), '.', '') || '@gmail.com'
       ELSE LOWER(email::text)
   END
 WHERE email_normalized IS NULL;

ALTER TABLE users
    ALTER COLUMN email_normalized SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized
    ON users (email_normalized);

COMMIT;
