-- ============================================
-- Migration: 006_functions.sql
-- Description: Database functions and triggers
-- Feature: Automated Functions & Helpers
-- Created: 2026-02-16
-- ============================================

-- ============================================
-- FUNCTION: Reset Daily Message Limits
-- ============================================
-- Called daily via cron job or manually
CREATE OR REPLACE FUNCTION reset_daily_limits()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE users
  SET
    messages_sent_today = 0,
    last_reset_at = NOW()
  WHERE last_reset_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_daily_limits IS
  'Resets messages_sent_today for all users - run daily via cron';

-- ============================================
-- FUNCTION: Track Selector Usage
-- ============================================
CREATE OR REPLACE FUNCTION track_selector_usage(
  p_selector_id TEXT,
  p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE selectors
  SET
    total_attempts = total_attempts + 1,
    total_successes = CASE
      WHEN p_success THEN total_successes + 1
      ELSE total_successes
    END,
    success_rate = ROUND(
      (
        CASE WHEN p_success THEN total_successes + 1 ELSE total_successes END::DECIMAL /
        NULLIF(total_attempts + 1, 0)
      ) * 100,
      2
    ),
    last_tested_at = NOW()
  WHERE id = p_selector_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION track_selector_usage IS
  'Track selector success/failure rate - called after each selector use';

-- ============================================
-- FUNCTION: Increment Error Report
-- ============================================
CREATE OR REPLACE FUNCTION increment_error_report(
  p_selector_id TEXT,
  p_selector_value TEXT
)
RETURNS VOID AS $$
DECLARE
  error_count_1h INTEGER;
BEGIN
  -- Insert or update error report
  INSERT INTO error_reports (selector_id, selector_value, error_count, last_error_at)
  VALUES (p_selector_id, p_selector_value, 1, NOW())
  ON CONFLICT (selector_id, selector_value)
  DO UPDATE SET
    error_count = error_reports.error_count + 1,
    last_error_at = NOW();

  -- Check if errors exceed threshold (10 errors in 1 hour)
  SELECT COUNT(*) INTO error_count_1h
  FROM error_reports
  WHERE selector_id = p_selector_id
    AND last_error_at > NOW() - INTERVAL '1 hour'
    AND resolved = FALSE;

  -- Raise notice for monitoring (can be caught by logging systems)
  IF error_count_1h > 10 THEN
    RAISE NOTICE 'ALERT: Selector % is failing frequently (% errors in last hour)',
      p_selector_id, error_count_1h;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_error_report IS
  'Track selector failures and alert when threshold exceeded';

-- ============================================
-- FUNCTION: Check User Message Limit
-- ============================================
CREATE OR REPLACE FUNCTION check_message_limit(
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT
    messages_sent_today,
    messages_limit,
    status
  INTO user_record
  FROM users
  WHERE id = p_user_id;

  -- User not found or inactive
  IF user_record IS NULL OR user_record.status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- Check if limit reached
  IF user_record.messages_sent_today >= user_record.messages_limit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_message_limit IS
  'Check if user can send more messages today - returns TRUE if allowed';

-- ============================================
-- FUNCTION: Increment User Message Count
-- ============================================
CREATE OR REPLACE FUNCTION increment_message_count(
  p_user_id UUID,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET
    messages_sent_today = messages_sent_today + 1,
    messages_sent_total = CASE
      WHEN p_success THEN messages_sent_total + 1
      ELSE messages_sent_total
    END,
    last_active_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_message_count IS
  'Increment user message counters - call after each message attempt';

-- ============================================
-- FUNCTION: Generate License Key
-- ============================================
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
  key_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate key format: XXXX-XXXX-XXXX
    key := UPPER(
      SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4) || '-' ||
      SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)
    );

    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE license_key = key)
    INTO key_exists;

    -- Exit loop if unique
    EXIT WHEN NOT key_exists;
  END LOOP;

  RETURN key;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_license_key IS
  'Generate unique license key in format XXXX-XXXX-XXXX';

-- ============================================
-- TRIGGER: Update timestamps
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_selectors_updated_at
  BEFORE UPDATE ON selectors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column IS
  'Auto-update updated_at column on row modification';

-- ============================================
-- HELPER: Get User Stats
-- ============================================
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  messages_today INTEGER,
  messages_total INTEGER,
  messages_limit INTEGER,
  limit_remaining INTEGER,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.messages_sent_today,
    u.messages_sent_total,
    u.messages_limit,
    (u.messages_limit - u.messages_sent_today) as limit_remaining,
    CASE
      WHEN u.messages_sent_total > 0 THEN
        ROUND(
          (
            SELECT COUNT(*)::DECIMAL
            FROM analytics
            WHERE user_id = p_user_id
              AND event_type = 'message_sent'
          ) / u.messages_sent_total * 100,
          2
        )
      ELSE 100.0
    END as success_rate
  FROM users u
  WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_stats IS
  'Get comprehensive user statistics - use for dashboards';
