-- Migration: pricing grid update + credit rollover
-- Apply once on existing databases. New databases get these values via schema.sql.

-- 1. Bump plan caps to the new competitive grid.
UPDATE plans SET images_per_month = 250 WHERE code = 'free';       -- was 150
UPDATE plans SET max_sites        = 5   WHERE code = 'growth';     -- was 3
UPDATE plans SET max_sites        = -1  WHERE code = 'business';   -- was 10 (now unlimited)

-- 2. Effective quota = plan limit + unused carryover from the previous month.
--    Unused carryover is capped at one month's worth (so you never exceed 2× plan).
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

-- 3. consume_quota now respects rollover.
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
