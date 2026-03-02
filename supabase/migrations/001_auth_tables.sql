-- ============================================
-- Migration: 001_auth_tables.sql
-- Description: Create users and licensing tables
-- Feature: Authentication & License Management
-- Created: 2026-02-16
-- ============================================

-- Users Table (Customer Accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  email TEXT UNIQUE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,

  -- Plan & Status
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'expired', 'cancelled')),

  -- Usage Limits & Tracking
  messages_limit INTEGER NOT NULL DEFAULT 10,
  messages_sent_today INTEGER DEFAULT 0,
  messages_sent_total INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_reset_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP,

  -- Metadata
  created_by TEXT DEFAULT 'system',
  notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_license
  ON users(license_key);

CREATE INDEX IF NOT EXISTS idx_users_email
  ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_users_plan
  ON users(plan);

-- Comments (documentation)
COMMENT ON TABLE users IS
  'Customer accounts with license keys and usage tracking';

COMMENT ON COLUMN users.license_key IS
  'Unique license key for extension activation (format: XXX-XXX-XXX)';

COMMENT ON COLUMN users.messages_limit IS
  'Daily message limit based on plan (10=free, 500=pro, 999999=enterprise)';

COMMENT ON COLUMN users.messages_sent_today IS
  'Messages sent today - resets daily via reset_daily_limits()';
