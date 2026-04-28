-- 005_notifications_sent.sql
--
-- Exactly-once tracking for transactional emails so neither the cron
-- nor the convert hot-path can ever send the same notification twice.
--
-- Examples:
--   · quota-warn for license X in period 2026-04-01 → row with kind='quota-warn'
--   · trial-ending for license Y on 2026-04-25       → row with kind='trial-ending'
--
-- The UNIQUE constraint is the source of truth — the app always uses
-- INSERT ... ON CONFLICT DO NOTHING and treats `rowCount > 0` as the
-- "I won, I should send the email" signal. This is race-safe across
-- multiple workers / cron retries.

BEGIN;

CREATE TABLE IF NOT EXISTS notifications_sent (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id      UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,

    -- Dotted notification name. Keep stable — it's the dedupe key.
    -- 'quota-warn', 'quota-exceeded', 'trial-ending', …
    kind            TEXT NOT NULL,

    -- Period bucket so monthly notifs reset cleanly. For one-shot events
    -- (e.g. trial-ending), use the trial-end date as the bucket.
    -- Format: YYYY-MM-DD (UTC), 1st of month for monthly buckets.
    period          DATE NOT NULL,

    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    /** Brevo message id (when known) for traceability. */
    message_id      TEXT,
    /** Free-form metadata: usedPct snapshot, daysLeft snapshot, … */
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

    CONSTRAINT uniq_notification UNIQUE (license_id, kind, period)
);

CREATE INDEX IF NOT EXISTS idx_notifications_license_kind
    ON notifications_sent (license_id, kind);

COMMIT;
