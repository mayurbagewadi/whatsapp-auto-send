-- ============================================
-- Migration: 010_admin_activity_log.sql
-- Description: Create admin audit log table
-- Feature: Admin Activity Tracking
-- Created: 2026-02-19
-- ============================================

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id           UUID NOT NULL DEFAULT extensions.uuid_generate_v4(),
  admin_id     UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  admin_email  TEXT NOT NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN (
                 'login',
                 'logout',
                 'create_user',
                 'update_user',
                 'delete_user',
                 'update_selector',
                 'update_plan',
                 'view_analytics'
               )),
  target_type  TEXT,
  target_id    TEXT,
  old_value    JSONB,
  new_value    JSONB,
  created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_log_admin
  ON public.admin_activity_log(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_log_action
  ON public.admin_activity_log(action_type, created_at DESC);

-- RLS
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_log_blocked
  ON public.admin_activity_log
  FOR ALL
  USING (FALSE);

-- Grant service_role full access
GRANT ALL ON public.admin_activity_log TO service_role;
