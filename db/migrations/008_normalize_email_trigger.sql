-- 008_normalize_email_trigger.sql
--
-- Defense-in-depth for the email_normalized column.
--
-- Migration 006 introduced `users.email_normalized` as NOT NULL + UNIQUE,
-- relying on the application layer (lib/email-normalize.ts) to compute
-- and INSERT it. Every code path that wrote to `users` had to remember.
-- The webhook upsert didn't, and Postgres validates NOT NULL on the
-- proposed row BEFORE the ON CONFLICT branch can fire — so every paid
-- checkout webhook crashed with sdk_status_500, the license never landed,
-- and the user was stuck on Free with no way to recover.
--
-- This migration moves the safety net DOWN to the database:
--   1. `normalize_email(text) → citext` — same Gmail rules as the JS code
--      (ignore dots, strip + aliases, googlemail → gmail). Marked IMMUTABLE
--      so it's safe to use in indexes / generated columns later.
--   2. BEFORE INSERT/UPDATE trigger that fills email_normalized from
--      `email` when it's NULL. Existing call sites that already provide
--      it keep working untouched.
--
-- The application normalization helper stays — it's still the single
-- source of truth for de-dup checks BEFORE hitting the DB. The trigger
-- only kicks in when a writer forgot.
--
-- Reversible: drop the trigger + function. The column itself isn't
-- touched.

BEGIN;

CREATE OR REPLACE FUNCTION normalize_email(addr text)
RETURNS citext
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    local_part  text;
    domain_part text;
BEGIN
    IF addr IS NULL THEN
        RETURN NULL;
    END IF;

    local_part  := LOWER(SPLIT_PART(addr, '@', 1));
    domain_part := LOWER(SPLIT_PART(addr, '@', 2));

    IF domain_part IN ('gmail.com', 'googlemail.com') THEN
        -- Strip + aliases, then strip dots.
        local_part := REPLACE(SPLIT_PART(local_part, '+', 1), '.', '');
        RETURN (local_part || '@gmail.com')::citext;
    END IF;

    RETURN (local_part || '@' || domain_part)::citext;
END;
$$;

CREATE OR REPLACE FUNCTION users_fill_email_normalized()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.email_normalized IS NULL AND NEW.email IS NOT NULL THEN
        NEW.email_normalized := normalize_email(NEW.email::text);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_fill_email_normalized ON users;
CREATE TRIGGER trg_users_fill_email_normalized
    BEFORE INSERT OR UPDATE OF email, email_normalized ON users
    FOR EACH ROW
    EXECUTE FUNCTION users_fill_email_normalized();

COMMIT;
