-- ============================================
-- PRODUCTION MEDIA INFRASTRUCTURE
-- ============================================
-- This migration sets up enterprise-grade media handling
-- with encryption, audit trails, and quota management

-- ============================================
-- 1. MEDIA UPLOADS TABLE (Main storage metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS media_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- File info
  filename TEXT NOT NULL,
  original_filename TEXT,
  file_type VARCHAR(100) NOT NULL CHECK (file_type IN ('image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf')),
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 52428800), -- Max 50MB

  -- Storage info
  storage_path TEXT NOT NULL UNIQUE,
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'media-files',

  -- Security
  md5_hash VARCHAR(32) NOT NULL,
  encryption_key TEXT NOT NULL, -- Encrypted encryption key for AES-256
  iv VARCHAR(32) NOT NULL, -- Initialization vector

  -- Tracking
  whatsapp_message_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'sent', 'failed', 'deleted', 'pending_deletion')),

  -- Compliance
  retention_days INT NOT NULL DEFAULT 90,
  gdpr_deletion_scheduled TIMESTAMP WITH TIME ZONE,
  scanned_for_malware BOOLEAN DEFAULT FALSE,
  malware_scan_result VARCHAR(20),

  -- Metadata
  upload_ip INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraint
  CONSTRAINT unique_user_file_hash UNIQUE NULLS NOT DISTINCT (user_id, md5_hash, deleted_at)
);

-- ============================================
-- 2. MEDIA QUOTAS TABLE (Daily tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS media_quotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan info
  plan_id TEXT NOT NULL,
  quota_date DATE NOT NULL,

  -- Usage tracking
  files_uploaded INT NOT NULL DEFAULT 0,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  quota_exceeded BOOLEAN DEFAULT FALSE,

  -- Plan limits (cached for performance)
  files_limit INT NOT NULL,
  size_limit_bytes BIGINT NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, quota_date)
);

-- ============================================
-- 3. MEDIA ACCESS LOGS (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS media_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  media_id UUID REFERENCES media_uploads(id) ON DELETE SET NULL,

  -- Action tracking
  action VARCHAR(50) NOT NULL CHECK (action IN ('upload', 'send', 'delete', 'download', 'access', 'quota_exceeded')),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,

  -- Network info
  ip_address INET NOT NULL,
  user_agent TEXT,

  -- Timestamps
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. MEDIA ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS media_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id TEXT NOT NULL,
  analytics_date DATE NOT NULL,

  -- Upload stats
  total_uploads INT DEFAULT 0,
  successful_uploads INT DEFAULT 0,
  failed_uploads INT DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  avg_file_size_bytes BIGINT,

  -- Usage stats
  unique_users_uploaded INT DEFAULT 0,
  quota_exceeded_incidents INT DEFAULT 0,

  -- Deletion stats
  total_deleted INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(plan_id, analytics_date)
);

-- ============================================
-- 5. MEDIA SETTINGS TABLE (Per-plan configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS media_plan_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id TEXT NOT NULL UNIQUE,

  -- Feature flags
  media_upload_enabled BOOLEAN DEFAULT FALSE,

  -- Quotas
  daily_file_limit INT NOT NULL DEFAULT 0, -- 0 = unlimited
  monthly_file_limit INT NOT NULL DEFAULT 0, -- 0 = unlimited
  max_file_size_bytes BIGINT NOT NULL DEFAULT 52428800, -- 50MB
  monthly_storage_limit_gb INT NOT NULL DEFAULT 0, -- 0 = unlimited (10GB max)

  -- Retention
  default_retention_days INT NOT NULL DEFAULT 90,
  allow_permanent_storage BOOLEAN DEFAULT FALSE,

  -- Features
  allow_all_file_types BOOLEAN DEFAULT FALSE, -- If false, only images, videos, PDF
  compression_enabled BOOLEAN DEFAULT FALSE,
  encryption_enabled BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all media tables
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_plan_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own media
CREATE POLICY "Users can view own media"
ON media_uploads FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media"
ON media_uploads FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media"
ON media_uploads FOR DELETE
USING (auth.uid() = user_id);

-- Users can view their own quotas
CREATE POLICY "Users can view own quotas"
ON media_quotas FOR SELECT
USING (auth.uid() = user_id);

-- Users can only view their own access logs
CREATE POLICY "Users can view own access logs"
ON media_access_logs FOR SELECT
USING (auth.uid() = user_id);

-- Media analytics are public (read-only)
CREATE POLICY "Anyone can view analytics"
ON media_analytics FOR SELECT
USING (true);

-- Plan settings are public (read-only)
CREATE POLICY "Anyone can view plan settings"
ON media_plan_settings FOR SELECT
USING (true);

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_user_id ON media_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_created_at ON media_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_status ON media_uploads(status);
CREATE INDEX IF NOT EXISTS idx_md5_user ON media_uploads(md5_hash, user_id);

CREATE INDEX IF NOT EXISTS idx_user_date ON media_quotas(user_id, quota_date);
CREATE INDEX IF NOT EXISTS idx_quota_exceeded ON media_quotas(user_id) WHERE quota_exceeded = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_timestamp ON media_access_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_action ON media_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_timestamp ON media_access_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_plan_date ON media_analytics(plan_id, analytics_date);

CREATE INDEX IF NOT EXISTS idx_plan_id ON media_plan_settings(plan_id);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_media_uploads_created ON media_uploads(created_at);
CREATE INDEX IF NOT EXISTS idx_media_quotas_date ON media_quotas(quota_date);
CREATE INDEX IF NOT EXISTS idx_media_access_logs_time ON media_access_logs(timestamp);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_user_date ON media_uploads(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quotas_user_exceeded ON media_quotas(user_id, quota_exceeded);

-- ============================================
-- 8. FUNCTIONS FOR QUOTA MANAGEMENT
-- ============================================

-- Function to check quota
CREATE OR REPLACE FUNCTION check_media_quota(
  p_user_id UUID,
  p_file_size BIGINT
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  files_remaining INT,
  size_remaining BIGINT
) AS $$
DECLARE
  v_user_plan_id TEXT;
  v_settings RECORD;
  v_today_quota RECORD;
  v_new_total_size BIGINT;
BEGIN
  -- Get user's plan
  SELECT plan FROM auth.users WHERE id = p_user_id INTO v_user_plan_id;

  -- Get plan settings
  SELECT * FROM media_plan_settings WHERE plan_id = v_user_plan_id INTO v_settings;

  -- If media not enabled, reject
  IF NOT v_settings.media_upload_enabled THEN
    RETURN QUERY SELECT false, 'FEATURE_NOT_ENABLED'::TEXT, 0::INT, 0::BIGINT;
    RETURN;
  END IF;

  -- Get today's quota
  SELECT * FROM media_quotas
  WHERE user_id = p_user_id AND quota_date = CURRENT_DATE
  INTO v_today_quota;

  -- Initialize if not exists
  IF v_today_quota IS NULL THEN
    INSERT INTO media_quotas (user_id, plan_id, quota_date, files_limit, size_limit_bytes)
    VALUES (p_user_id, v_user_plan_id, CURRENT_DATE, v_settings.daily_file_limit, v_settings.monthly_storage_limit_gb * 1024 * 1024 * 1024)
    RETURNING * INTO v_today_quota;
  END IF;

  v_new_total_size := COALESCE(v_today_quota.total_size_bytes, 0) + p_file_size;

  -- Check file count limit
  IF v_settings.daily_file_limit > 0 AND v_today_quota.files_uploaded >= v_settings.daily_file_limit THEN
    RETURN QUERY SELECT false, 'QUOTA_EXCEEDED_FILES'::TEXT, 0::INT, (v_settings.monthly_storage_limit_gb * 1024 * 1024 * 1024 - v_new_total_size)::BIGINT;
    RETURN;
  END IF;

  -- Check storage limit
  IF v_settings.monthly_storage_limit_gb > 0 AND v_new_total_size > (v_settings.monthly_storage_limit_gb * 1024 * 1024 * 1024) THEN
    RETURN QUERY SELECT false, 'QUOTA_EXCEEDED_STORAGE'::TEXT, (v_settings.daily_file_limit - v_today_quota.files_uploaded)::INT, (v_settings.monthly_storage_limit_gb * 1024 * 1024 * 1024 - COALESCE(v_today_quota.total_size_bytes, 0))::BIGINT;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, 'ALLOWED'::TEXT, (v_settings.daily_file_limit - v_today_quota.files_uploaded - 1)::INT, (v_settings.monthly_storage_limit_gb * 1024 * 1024 * 1024 - v_new_total_size)::BIGINT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. INSERT DEFAULT PLAN SETTINGS
-- ============================================

INSERT INTO media_plan_settings (plan_id, media_upload_enabled, daily_file_limit, monthly_file_limit, max_file_size_bytes, monthly_storage_limit_gb, default_retention_days)
VALUES
  ('free', false, 0, 0, 52428800, 0, 30), -- No media for free
  ('pro', true, 10, 500, 52428800, 10, 90),
  ('enterprise', true, 0, 0, 52428800, 0, 365) -- Unlimited
ON CONFLICT (plan_id) DO NOTHING;

-- ============================================
-- 10. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Update media_uploads.updated_at on change
CREATE OR REPLACE FUNCTION update_media_uploads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_media_uploads_timestamp
BEFORE UPDATE ON media_uploads
FOR EACH ROW
EXECUTE FUNCTION update_media_uploads_timestamp();

-- Update quotas when media is uploaded
CREATE OR REPLACE FUNCTION update_quota_on_media_upload()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'uploaded' AND OLD.status IS DISTINCT FROM 'uploaded' THEN
    INSERT INTO media_quotas (user_id, plan_id, quota_date, files_uploaded, total_size_bytes, files_limit, size_limit_bytes)
    VALUES (
      NEW.user_id,
      (SELECT plan FROM auth.users WHERE id = NEW.user_id),
      CURRENT_DATE,
      1,
      NEW.file_size,
      COALESCE((SELECT daily_file_limit FROM media_plan_settings WHERE plan_id = (SELECT plan FROM auth.users WHERE id = NEW.user_id)), 0),
      COALESCE((SELECT monthly_storage_limit_gb FROM media_plan_settings WHERE plan_id = (SELECT plan FROM auth.users WHERE id = NEW.user_id)), 0) * 1024 * 1024 * 1024
    )
    ON CONFLICT (user_id, quota_date) DO UPDATE
    SET files_uploaded = media_quotas.files_uploaded + 1,
        total_size_bytes = media_quotas.total_size_bytes + NEW.file_size,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quota_on_media_upload
AFTER INSERT OR UPDATE ON media_uploads
FOR EACH ROW
EXECUTE FUNCTION update_quota_on_media_upload();

-- Log access on media view
CREATE OR REPLACE FUNCTION log_media_access()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'SELECT' THEN
    INSERT INTO media_access_logs (user_id, media_id, action, success, ip_address, user_agent)
    VALUES (NEW.user_id, NEW.id, 'access', true, inet_client_addr(), current_setting('app.user_agent', true));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
COMMIT;
