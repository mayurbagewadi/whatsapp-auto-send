-- ============================================
-- Migration: 019_sync_media_plan_settings.sql
-- Description: Sync media_plan_settings from plans table
--              so the extension quota check recognises
--              plans that have media_upload enabled.
-- ============================================

INSERT INTO media_plan_settings
  (plan_id, media_upload_enabled, daily_file_limit, monthly_file_limit, max_file_size_bytes,
   monthly_storage_limit_gb, default_retention_days)
SELECT
  id,
  (features->>'media_upload')::boolean,
  10, 500, 52428800, 10, 90
FROM plans
WHERE (features->>'media_upload')::boolean = true
ON CONFLICT (plan_id) DO UPDATE
  SET media_upload_enabled = EXCLUDED.media_upload_enabled;
