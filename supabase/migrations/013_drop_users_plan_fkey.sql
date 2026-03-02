-- ============================================
-- Migration: 013_drop_users_plan_fkey.sql
-- Description: Drop users_plan_fkey FK constraint
-- Problem: ON DELETE SET DEFAULT fires when deleting a plan and tries to
--          set users.plan = 'free' (column default). If 'free' plan was
--          also deleted, this cascade fails with FK violation — making
--          it impossible to delete any plan.
-- Solution: Drop the FK. Plan validity is enforced at the application
--           layer (admin panel) which already handles reassignment.
-- ============================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_fkey;
