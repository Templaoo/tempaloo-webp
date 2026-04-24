-- Tempaloo WebP — Postgres schema
-- Target: PostgreSQL 15+ (Neon compatible)
-- Convention: snake_case, UUID primary keys, timestamps in UTC.

-- ---------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email

-- ---------------------------------------------------------------
-- plans — pricing tiers (seeded, referenced by licenses)
-- ---------------------------------------------------------------
CREATE TABLE plans (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                 TEXT UNIQUE NOT NULL,          -- free | starter | growth | business | unlimited
    name                 TEXT NOT NULL,
    images_per_month     INTEGER NOT NULL,              -- -1 = unlimited (fair use handled in app)
    max_sites            INTEGER NOT NULL,              -- -1 = unlimited
    supports_avif        BOOLEAN NOT NULL DEFAULT FALSE,
    supports_cdn         BOOLEAN NOT NULL DEFAULT FALSE,
    supports_api_direct  BOOLEAN NOT NULL DEFAULT FALSE,
    price_monthly_cents  INTEGER NOT NULL DEFAULT 0,    -- EUR cents
    price_annual_cents   INTEGER NOT NULL DEFAULT 0,    -- EUR cents
    fair_use_cap         INTEGER,                       -- for Unlimited
    -- Marketing + Freemius fields (added in 003_plans_marketing.sql) so that
    -- the landing page, plugin admin, and checkout overlay all read the same
    -- source of truth instead of hardcoding copy.
    freemius_plan_id     BIGINT UNIQUE,                 -- Freemius plan id per code (NULL for free)
    tagline              TEXT NOT NULL DEFAULT '',
    bullets              TEXT[] NOT NULL DEFAULT '{}',
    badge                TEXT,                          -- e.g. 'Popular' on the Growth card
    cta_label            TEXT NOT NULL DEFAULT 'Get started',
    is_featured          BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order           SMALLINT NOT NULL DEFAULT 0,
    is_public            BOOLEAN NOT NULL DEFAULT TRUE,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (code, name, images_per_month, max_sites, supports_avif, supports_cdn, supports_api_direct, price_monthly_cents, price_annual_cents, fair_use_cap, freemius_plan_id, tagline, bullets, badge, cta_label, is_featured, sort_order) VALUES
    ('free',      'Free',      250,       1,  FALSE, FALSE, FALSE,     0,      0, NULL,   NULL,  'Try it. No card required.',                 ARRAY['WebP conversion','1 credit per upload','Automatic on upload','Rollover 30 days'],  NULL,      'Start free',    FALSE, 1),
    ('starter',   'Starter',   5000,      1,  TRUE,  FALSE, FALSE,   500,   4800, NULL,  46755,  'For a single blog or portfolio.',            ARRAY['WebP + AVIF','Unlimited bulk','Rollover 30 days','Email support (48h)'],            NULL,      'Start trial',   FALSE, 2),
    ('growth',    'Growth',    25000,     5,  TRUE,  TRUE,  FALSE,  1200,  11500, NULL,  46756,  'For small agencies with a few sites.',       ARRAY['WebP + AVIF','5 sites per license','Rollover 30 days','Email support (24h)'],       'Popular', 'Start trial',   TRUE,  3),
    ('business',  'Business',  150000,   -1,  TRUE,  TRUE,  TRUE,   2900,  27800, NULL,  46757,  'For agencies running many sites.',           ARRAY['Everything in Growth','Unlimited sites','Direct API access','Chat support (24h)'],  NULL,      'Start trial',   FALSE, 4),
    ('unlimited', 'Unlimited', -1,       -1,  TRUE,  TRUE,  TRUE,   5900,  56600, 500000, 46758, 'For hosts, platforms, agencies at scale.',   ARRAY['Everything in Business','Priority SLA','Dedicated onboarding','White-label (soon)'], NULL,      'Talk to sales', FALSE, 5);

-- ---------------------------------------------------------------
-- users — customers (linked to Freemius user)
-- ---------------------------------------------------------------
CREATE TABLE users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                CITEXT UNIQUE NOT NULL,
    freemius_user_id     BIGINT UNIQUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_freemius ON users (freemius_user_id) WHERE freemius_user_id IS NOT NULL;

-- ---------------------------------------------------------------
-- licenses — one row per active subscription
-- ---------------------------------------------------------------
CREATE TYPE license_status   AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'expired');
CREATE TYPE billing_cycle    AS ENUM ('monthly', 'annual', 'lifetime', 'free');

CREATE TABLE licenses (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    plan_id              UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    -- license_key is the secret shown to the user and stored in their plugin.
    -- 64 hex chars = 32 bytes entropy. Generated by the API, never by Freemius.
    license_key          TEXT UNIQUE NOT NULL,
    freemius_license_id  BIGINT UNIQUE,
    status               license_status NOT NULL DEFAULT 'active',
    billing              billing_cycle NOT NULL DEFAULT 'free',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ,                   -- NULL for free
    canceled_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_licenses_user ON licenses (user_id);
CREATE INDEX idx_licenses_status ON licenses (status);
CREATE INDEX idx_licenses_freemius ON licenses (freemius_license_id) WHERE freemius_license_id IS NOT NULL;

-- ---------------------------------------------------------------
-- sites — WP installations activated with a license
-- Enforces per-plan site cap via application logic (count active rows).
-- ---------------------------------------------------------------
CREATE TABLE sites (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id           UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    site_url             TEXT NOT NULL,
    site_host            TEXT NOT NULL,                 -- normalized host (lowercase, no trailing slash)
    wp_version           TEXT,
    plugin_version       TEXT,
    activated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at       TIMESTAMPTZ,
    last_seen_at         TIMESTAMPTZ,
    CONSTRAINT uniq_active_site_per_license UNIQUE (license_id, site_host)
);

CREATE INDEX idx_sites_active ON sites (license_id) WHERE deactivated_at IS NULL;

-- ---------------------------------------------------------------
-- usage_counters — monthly rolling quota counter (atomic decrement)
-- One row per (license, period). Period = YYYY-MM (UTC).
-- ---------------------------------------------------------------
CREATE TABLE usage_counters (
    license_id           UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    period               DATE NOT NULL,                 -- first day of month, UTC
    images_used          INTEGER NOT NULL DEFAULT 0,
    bytes_in             BIGINT  NOT NULL DEFAULT 0,
    bytes_out            BIGINT  NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (license_id, period)
);

-- ---------------------------------------------------------------
-- usage_logs — per-conversion audit log (sample or full, TBD)
-- Keep 90 days, then aggregate. For MVP we log every conversion.
-- ---------------------------------------------------------------
CREATE TYPE output_format AS ENUM ('webp', 'avif');
CREATE TYPE conversion_status AS ENUM ('success', 'error_quota', 'error_input', 'error_internal');

CREATE TABLE usage_logs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id           UUID REFERENCES licenses(id) ON DELETE SET NULL,
    site_id              UUID REFERENCES sites(id) ON DELETE SET NULL,
    output_format        output_format,
    input_bytes          INTEGER,
    output_bytes         INTEGER,
    quality              INTEGER,
    duration_ms          INTEGER,
    status               conversion_status NOT NULL,
    error_code           TEXT,
    -- "auto"  = wp_handle_upload hook (unlimited on Free within monthly quota)
    -- "bulk"  = manual "Start conversion" from the admin (capped on Free)
    -- "api"   = future direct API clients
    mode                 TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto','bulk','api')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_license_time ON usage_logs (license_id, created_at DESC);
CREATE INDEX idx_usage_logs_bulk_today
    ON usage_logs (license_id, created_at DESC)
    WHERE mode = 'bulk';

-- ---------------------------------------------------------------
-- webhooks_events — Freemius (and future providers) idempotency store
-- ---------------------------------------------------------------
CREATE TABLE webhooks_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider             TEXT NOT NULL DEFAULT 'freemius',
    event_id             TEXT NOT NULL,
    event_type           TEXT NOT NULL,
    payload              JSONB NOT NULL,
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at         TIMESTAMPTZ,
    processing_error     TEXT,
    CONSTRAINT uniq_webhook_event UNIQUE (provider, event_id)
);

CREATE INDEX idx_webhooks_pending ON webhooks_events (received_at) WHERE processed_at IS NULL;

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_plans    BEFORE UPDATE ON plans    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at_users    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at_licenses BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- Effective quota = plan.images_per_month + credit rollover from previous month.
-- Rollover is capped at 1× plan (so never exceeds 2× plan in a burst month).
CREATE OR REPLACE FUNCTION effective_quota(p_license_id UUID, p_period DATE)
RETURNS INTEGER AS $$
DECLARE
    v_plan_limit INTEGER;
    v_prev_used  INTEGER;
    v_rollover   INTEGER;
BEGIN
    SELECT p.images_per_month INTO v_plan_limit
    FROM licenses l JOIN plans p ON p.id = l.plan_id
    WHERE l.id = p_license_id AND l.status IN ('active','trialing');

    IF v_plan_limit IS NULL THEN RETURN NULL; END IF;
    IF v_plan_limit = -1 THEN RETURN -1; END IF;

    SELECT COALESCE(images_used, 0) INTO v_prev_used
    FROM usage_counters
    WHERE license_id = p_license_id
      AND period = (p_period - INTERVAL '1 month')::date;

    v_rollover := LEAST(v_plan_limit, GREATEST(0, v_plan_limit - COALESCE(v_prev_used, 0)));
    RETURN v_plan_limit + v_rollover;
END;
$$ LANGUAGE plpgsql;

-- Atomic quota consume: returns TRUE if consumed, FALSE if over effective limit.
CREATE OR REPLACE FUNCTION consume_quota(p_license_id UUID, p_period DATE, p_count INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_new   INTEGER;
BEGIN
    v_limit := effective_quota(p_license_id, p_period);
    IF v_limit IS NULL THEN
        RETURN FALSE;
    END IF;

    INSERT INTO usage_counters (license_id, period, images_used)
    VALUES (p_license_id, p_period, 0)
    ON CONFLICT (license_id, period) DO NOTHING;

    IF v_limit = -1 THEN
        UPDATE usage_counters SET images_used = images_used + p_count, updated_at = NOW()
         WHERE license_id = p_license_id AND period = p_period;
        RETURN TRUE;
    END IF;

    UPDATE usage_counters
       SET images_used = images_used + p_count, updated_at = NOW()
     WHERE license_id = p_license_id AND period = p_period
       AND images_used + p_count <= v_limit
    RETURNING images_used INTO v_new;

    RETURN v_new IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
