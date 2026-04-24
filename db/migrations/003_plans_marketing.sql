-- 003_plans_marketing.sql
--
-- Makes `plans` the single source of truth for ALL plan data consumed by:
--   · the Next.js landing + /webp/activate pages
--   · the WordPress plugin admin (Upgrade tab, Overview activate card)
--   · the Freemius checkout overlay (needs plan_id per code)
--
-- Previously this data was duplicated in 3 React components (LandingPage.tsx,
-- ActivatePricing.tsx, plugin Upgrade.tsx/App.tsx), which drifted — see the
-- "150 images" bug where the DB had 250 but the plugin copy still said 150.

BEGIN;

ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS freemius_plan_id BIGINT,
    ADD COLUMN IF NOT EXISTS tagline          TEXT     NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bullets          TEXT[]   NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS badge            TEXT,
    ADD COLUMN IF NOT EXISTS cta_label        TEXT     NOT NULL DEFAULT 'Get started',
    ADD COLUMN IF NOT EXISTS is_featured      BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sort_order       SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_public        BOOLEAN  NOT NULL DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS plans_freemius_plan_id_key
    ON plans (freemius_plan_id) WHERE freemius_plan_id IS NOT NULL;

-- Seed marketing + Freemius IDs from the previous single sources of truth
-- (web landing PLANS array + plugin FREEMIUS constants). These updates are
-- idempotent — running the migration twice doesn't duplicate anything.
UPDATE plans SET
    tagline    = 'Try it. No card required.',
    bullets    = ARRAY['WebP conversion', '1 credit per upload', 'Automatic on upload', 'Rollover 30 days'],
    cta_label  = 'Start free',
    sort_order = 1
    WHERE code = 'free';

UPDATE plans SET
    freemius_plan_id = 46755,
    tagline          = 'For a single blog or portfolio.',
    bullets          = ARRAY['WebP + AVIF', 'Unlimited bulk', 'Rollover 30 days', 'Email support (48h)'],
    cta_label        = 'Start trial',
    sort_order       = 2
    WHERE code = 'starter';

UPDATE plans SET
    freemius_plan_id = 46756,
    tagline          = 'For small agencies with a few sites.',
    bullets          = ARRAY['WebP + AVIF', '5 sites per license', 'Rollover 30 days', 'Email support (24h)'],
    cta_label        = 'Start trial',
    badge            = 'Popular',
    is_featured      = TRUE,
    sort_order       = 3
    WHERE code = 'growth';

UPDATE plans SET
    freemius_plan_id = 46757,
    tagline          = 'For agencies running many sites.',
    bullets          = ARRAY['Everything in Growth', 'Unlimited sites', 'Direct API access', 'Chat support (24h)'],
    cta_label        = 'Start trial',
    sort_order       = 4
    WHERE code = 'business';

UPDATE plans SET
    freemius_plan_id = 46758,
    tagline          = 'For hosts, platforms, agencies at scale.',
    bullets          = ARRAY['Everything in Business', 'Priority SLA', 'Dedicated onboarding', 'White-label (soon)'],
    cta_label        = 'Talk to sales',
    sort_order       = 5
    WHERE code = 'unlimited';

COMMIT;
