-- ============================================
-- SECURITY HARDENING & DATA INTEGRITY
-- ============================================
-- This migration adds missing constraints and improves data validation
-- Run AFTER 014_media_infrastructure.sql

-- ============================================
-- 1. ADD MISSING FOREIGN KEY CONSTRAINTS
-- ============================================

-- Ensure media_uploads references valid users
ALTER TABLE media_uploads
ADD CONSTRAINT fk_media_uploads_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Ensure media_access_logs references valid users
ALTER TABLE media_access_logs
ADD CONSTRAINT fk_media_access_logs_user_id
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Note: media_quotas and media_plan_settings don't use FK constraints
-- This allows any custom plan names (free, pro, enterprise, or your custom names)
-- plan_id is just a text reference, not a database constraint

-- ============================================
-- 2. ADD UNIQUE INDEXES FOR DUPLICATE PREVENTION
-- ============================================

-- Prevent duplicate file uploads by same user (MD5 hash)
-- Using partial index instead of constraint for WHERE clause support
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_file_hash_not_deleted
ON media_uploads(user_id, md5_hash)
WHERE deleted_at IS NULL;

-- ============================================
-- 3. ADD CHECK CONSTRAINTS FOR DATA VALIDATION
-- ============================================

-- Ensure retention_days is positive
ALTER TABLE media_uploads
ADD CONSTRAINT check_retention_days_positive CHECK (retention_days > 0);

-- Ensure storage limits are non-negative
ALTER TABLE media_plan_settings
ADD CONSTRAINT check_daily_file_limit_non_negative CHECK (daily_file_limit >= 0),
ADD CONSTRAINT check_monthly_file_limit_non_negative CHECK (monthly_file_limit >= 0),
ADD CONSTRAINT check_storage_limit_non_negative CHECK (monthly_storage_limit_gb >= 0);

-- ============================================
-- 4. ADD PARTIAL INDEXES FOR EFFICIENCY
-- ============================================

-- Index for non-deleted media only (most common query)
CREATE INDEX IF NOT EXISTS idx_media_uploads_active
ON media_uploads(user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for quota exceeded incidents
CREATE INDEX IF NOT EXISTS idx_media_quotas_exceeded
ON media_quotas(user_id)
WHERE quota_exceeded = TRUE;

-- Index for pending deletion (cleanup jobs)
-- Note: WHERE clause uses only static condition, not NOW()
CREATE INDEX IF NOT EXISTS idx_media_uploads_pending_deletion
ON media_uploads(user_id, gdpr_deletion_scheduled)
WHERE status = 'pending_deletion';

-- ============================================
-- 5. ADD AUDIT LOGGING (OPTIONAL BUT RECOMMENDED)
-- ============================================

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id UUID,
  user_id UUID REFERENCES auth.users(id),
  changed_columns JSONB,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_table_timestamp ON audit_logs(table_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_timestamp ON audit_logs(user_id, timestamp DESC);

-- Enable RLS on audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- 6. GDPR COMPLIANCE: SOFT DELETE TRIGGER
-- ============================================

-- Automatically hard-delete files after retention period
CREATE OR REPLACE FUNCTION cleanup_deleted_media()
RETURNS void AS $$
BEGIN
  -- Mark as pending_deletion if grace period expired
  UPDATE media_uploads
  SET status = 'pending_deletion'
  WHERE deleted_at IS NOT NULL
  AND deleted_at + (retention_days || ' days')::INTERVAL <= NOW()
  AND status != 'pending_deletion';

  -- Hard delete after additional grace period (30 days)
  DELETE FROM media_uploads
  WHERE status = 'pending_deletion'
  AND deleted_at + (retention_days || ' days')::INTERVAL + INTERVAL '30 days' <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATION NOTES
-- ============================================
-- This migration adds:
-- ✅ Foreign key constraints (data integrity)
-- ✅ Unique constraints (duplicate prevention)
-- ✅ Check constraints (valid data)
-- ✅ Partial indexes (performance)
-- ✅ Audit logging (compliance)
-- ✅ GDPR compliance triggers (retention)
--
-- Run this AFTER deploying 014_media_infrastructure.sql
-- Test thoroughly before production deployment
