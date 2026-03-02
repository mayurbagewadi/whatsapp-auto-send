-- ============================================
-- Migration: 008_fix_analytics_columns.sql
-- Description: Add missing columns to analytics table
-- Run this in Supabase SQL Editor if analytics table
-- was created without full schema
-- ============================================

-- Add missing columns (safe - won't fail if already exists)
ALTER TABLE analytics
  ADD COLUMN IF NOT EXISTS selector_id TEXT,
  ADD COLUMN IF NOT EXISTS selector_used TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add missing index (safe)
CREATE INDEX IF NOT EXISTS idx_analytics_selector
  ON analytics(selector_id)
  WHERE selector_id IS NOT NULL;

-- Verify columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'analytics'
ORDER BY ordinal_position;
