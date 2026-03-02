-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
-- This ensures users can only see their own data

-- ============================================
-- 0. DROP EXISTING POLICIES (If they exist from 014)
-- ============================================

DROP POLICY IF EXISTS "Users can view own media" ON media_uploads;
DROP POLICY IF EXISTS "Users can insert own media" ON media_uploads;
DROP POLICY IF EXISTS "Users can delete own media" ON media_uploads;
DROP POLICY IF EXISTS "Users can view own quotas" ON media_quotas;
DROP POLICY IF EXISTS "Users can view own access logs" ON media_access_logs;
DROP POLICY IF EXISTS "Anyone can view analytics" ON media_analytics;
DROP POLICY IF EXISTS "Anyone can view plan settings" ON media_plan_settings;

-- ============================================
-- 1. ENABLE RLS ON MEDIA TABLES
-- ============================================

ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE RLS POLICIES FOR MEDIA UPLOADS
-- ============================================

-- Users can only view their own media
CREATE POLICY "Users can view own media"
ON media_uploads FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own media
CREATE POLICY "Users can insert own media"
ON media_uploads FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own media
CREATE POLICY "Users can delete own media"
ON media_uploads FOR DELETE
USING (auth.uid() = user_id);

-- Users cannot update media (immutable after upload)
CREATE POLICY "Users cannot update media"
ON media_uploads FOR UPDATE
USING (false);

-- ============================================
-- 3. CREATE RLS POLICIES FOR MEDIA QUOTAS
-- ============================================

-- Users can only view their own quotas
CREATE POLICY "Users can view own media quotas"
ON media_quotas FOR SELECT
USING (auth.uid() = user_id);

-- Nobody can directly insert/update/delete quotas (managed by triggers)
CREATE POLICY "Only system can manage quotas"
ON media_quotas FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only system can update quotas"
ON media_quotas FOR UPDATE
USING (false);

CREATE POLICY "Only system can delete quotas"
ON media_quotas FOR DELETE
USING (false);

-- ============================================
-- 4. CREATE RLS POLICIES FOR ACCESS LOGS
-- ============================================

-- Users can only view their own access logs
CREATE POLICY "Users can view own access logs"
ON media_access_logs FOR SELECT
USING (auth.uid() = user_id);

-- Nobody can directly modify logs (managed by system)
CREATE POLICY "Only system can manage access logs"
ON media_access_logs FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only system can update access logs"
ON media_access_logs FOR UPDATE
USING (false);

CREATE POLICY "Only system can delete access logs"
ON media_access_logs FOR DELETE
USING (false);

-- ============================================
-- 5. CREATE RLS POLICIES FOR ANALYTICS
-- ============================================

-- Analytics are public read-only (everyone can view trends)
CREATE POLICY "Anyone can view media analytics"
ON media_analytics FOR SELECT
USING (true);

-- Nobody can modify analytics directly
CREATE POLICY "Only system can manage analytics"
ON media_analytics FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only system can update analytics"
ON media_analytics FOR UPDATE
USING (false);

CREATE POLICY "Only system can delete analytics"
ON media_analytics FOR DELETE
USING (false);

-- ============================================
-- 6. CREATE RLS POLICIES FOR PLAN SETTINGS
-- ============================================

-- Plan settings are public read-only (everyone sees available plans)
CREATE POLICY "Anyone can view media plan settings"
ON media_plan_settings FOR SELECT
USING (true);

-- Nobody can modify plans directly
CREATE POLICY "Only admins can manage plan settings"
ON media_plan_settings FOR INSERT
WITH CHECK (false);

CREATE POLICY "Only admins can update plan settings"
ON media_plan_settings FOR UPDATE
USING (false);

CREATE POLICY "Only admins can delete plan settings"
ON media_plan_settings FOR DELETE
USING (false);

-- ============================================
-- 7. CREATE RLS POLICIES FOR AUDIT LOGS
-- ============================================

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs"
ON audit_logs FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'service_role');

-- Only system can create audit logs
CREATE POLICY "Only system can create audit logs"
ON audit_logs FOR INSERT
WITH CHECK (false);

-- Nobody can modify audit logs (immutable)
CREATE POLICY "Audit logs are immutable"
ON audit_logs FOR UPDATE
USING (false);

CREATE POLICY "Audit logs cannot be deleted"
ON audit_logs FOR DELETE
USING (false);

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- This migration enables RLS on all media tables
-- and creates comprehensive security policies
--
-- SECURITY RULES:
-- ✅ Users see only their own data
-- ✅ Analytics are public (aggregated data)
-- ✅ Plan settings are public (show available plans)
-- ✅ Audit logs are admin-only
-- ✅ Quota and log tables are system-managed (read-only for users)
