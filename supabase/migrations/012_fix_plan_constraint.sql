-- ============================================
-- Migration: 012_fix_plan_constraint.sql
-- Description: Replace rigid plan CHECK constraint with FK to plans table
-- Problem: users_plan_check only allowed ('free','pro','enterprise')
--          blocking assignment of any new plans created via admin panel
-- ============================================

-- Step 1: Drop the old rigid CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

-- Step 2: Add a proper FK constraint so users.plan must match a valid plans.id
-- This auto-validates against whatever plans exist in the plans table
ALTER TABLE users
  ADD CONSTRAINT users_plan_fkey
  FOREIGN KEY (plan) REFERENCES plans(id)
  ON UPDATE CASCADE
  ON DELETE SET DEFAULT;
