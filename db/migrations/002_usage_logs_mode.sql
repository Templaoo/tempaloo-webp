-- Migration 002 — per-call mode tag on usage_logs
-- Used by the API to enforce the Free plan daily bulk cap (Option A,
-- validated 2026-04-24): auto-convert on upload stays unlimited, manual
-- bulk runs cap at BULK_DAILY_LIMIT_FREE (default 50) per UTC day.

ALTER TABLE usage_logs
    ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (mode IN ('auto', 'bulk', 'api'));

-- Partial index for the common "how many bulk calls in the last 24h" query.
CREATE INDEX IF NOT EXISTS idx_usage_logs_bulk_today
    ON usage_logs (license_id, created_at DESC)
    WHERE mode = 'bulk';
