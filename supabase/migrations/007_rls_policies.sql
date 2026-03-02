-- ============================================
-- Migration: 007_rls_policies.sql
-- Description: Row Level Security (RLS) policies
-- Feature: Data Security & Access Control
-- Created: 2026-02-16
-- ============================================

-- ============================================
-- USERS TABLE RLS
-- ============================================

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own data
CREATE POLICY users_select_own
  ON users
  FOR SELECT
  USING (
    auth.uid() = id
    OR
    -- Allow if license_key is provided (for extension validation)
    license_key = current_setting('request.jwt.claims', true)::json->>'license_key'
  );

-- Policy: No direct user updates (must use functions or backend)
CREATE POLICY users_update_blocked
  ON users
  FOR UPDATE
  USING (FALSE);

-- Policy: No direct user creation (must use backend)
CREATE POLICY users_insert_blocked
  ON users
  FOR INSERT
  WITH CHECK (FALSE);

-- Policy: No user deletion
CREATE POLICY users_delete_blocked
  ON users
  FOR DELETE
  USING (FALSE);

-- ============================================
-- SELECTORS TABLE RLS
-- ============================================

ALTER TABLE selectors ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read selectors (needed for extension)
CREATE POLICY selectors_select_all
  ON selectors
  FOR SELECT
  USING (TRUE);

-- Policy: Only admins can update selectors
CREATE POLICY selectors_update_admin_only
  ON selectors
  FOR UPDATE
  USING (FALSE);  -- Block client updates, use backend API

-- ============================================
-- ANALYTICS TABLE RLS
-- ============================================

ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own analytics
CREATE POLICY analytics_insert_own
  ON analytics
  FOR INSERT
  WITH CHECK (TRUE);  -- Allow all inserts (user_id tracked in app)

-- Policy: Users can view their own analytics
CREATE POLICY analytics_select_own
  ON analytics
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: No updates or deletes
CREATE POLICY analytics_update_blocked
  ON analytics
  FOR UPDATE
  USING (FALSE);

CREATE POLICY analytics_delete_blocked
  ON analytics
  FOR DELETE
  USING (FALSE);

-- ============================================
-- ERROR_REPORTS TABLE RLS
-- ============================================

ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert error reports
CREATE POLICY error_reports_insert_all
  ON error_reports
  FOR INSERT
  WITH CHECK (TRUE);

-- Policy: Anyone can read error reports (for monitoring)
CREATE POLICY error_reports_select_all
  ON error_reports
  FOR SELECT
  USING (TRUE);

-- Policy: Only admins can update/delete
CREATE POLICY error_reports_update_blocked
  ON error_reports
  FOR UPDATE
  USING (FALSE);

CREATE POLICY error_reports_delete_blocked
  ON error_reports
  FOR DELETE
  USING (FALSE);

-- ============================================
-- PLANS TABLE RLS
-- ============================================

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active plans
CREATE POLICY plans_select_active
  ON plans
  FOR SELECT
  USING (active = TRUE);

-- Policy: No client-side modifications
CREATE POLICY plans_update_blocked
  ON plans
  FOR UPDATE
  USING (FALSE);

-- ============================================
-- ADMIN TABLES RLS
-- ============================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Block all client access (admin panel uses backend)
CREATE POLICY admin_users_select_blocked
  ON admin_users
  FOR SELECT
  USING (FALSE);

CREATE POLICY admin_log_select_blocked
  ON admin_activity_log
  FOR SELECT
  USING (FALSE);

-- ============================================
-- SUBSCRIPTIONS TABLE RLS
-- ============================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own subscriptions
CREATE POLICY subscriptions_select_own
  ON subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: No client-side modifications
CREATE POLICY subscriptions_update_blocked
  ON subscriptions
  FOR UPDATE
  USING (FALSE);

-- ============================================
-- BYPASS RLS FOR SERVICE ROLE
-- ============================================
-- Note: service_role key automatically bypasses all RLS
-- This is why we keep it SECRET and only use in backend

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON POLICY users_select_own ON users IS
  'Users can only view their own data - prevents data leaks';

COMMENT ON POLICY selectors_select_all ON selectors IS
  'All users can read selectors (needed for extension to work)';

COMMENT ON POLICY analytics_insert_own ON analytics IS
  'Users can track their own usage events';

COMMENT ON POLICY plans_select_active ON plans IS
  'Users can view available plans for upgrades';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant authenticated users access to tables
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON selectors TO authenticated, anon;
GRANT INSERT ON analytics TO authenticated, anon;
GRANT SELECT ON plans TO authenticated, anon;
GRANT INSERT ON error_reports TO authenticated, anon;

-- Grant service_role full access (backend API)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
