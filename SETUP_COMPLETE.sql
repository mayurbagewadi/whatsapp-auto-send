-- ============================================
-- Complete Database Setup for WhatsApp Pro
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SELECTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS selectors (
  id TEXT PRIMARY KEY,
  selectors JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  success_rate DECIMAL(5,2) DEFAULT 100.0,
  total_attempts INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,
  last_tested_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system'
);

-- Insert default selectors
INSERT INTO selectors (id, selectors, version) VALUES
('send_button', '["button[data-testid=\"compose-btn-send\"]", "button[aria-label=\"Send\"]", "span[data-icon=\"send\"]"]'::jsonb, 1),
('input_box', '["div[contenteditable=\"true\"][data-tab=\"10\"]", "div[data-testid=\"conversation-compose-box-input\"]"]'::jsonb, 1),
('modal_confirm', '["div[data-animate-modal-popup=\"true\"] button:last-child", "div[role=\"dialog\"] button"]'::jsonb, 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('message_sent', 'message_failed', 'selector_failed', 'extension_loaded')),
  selector_id TEXT,
  selector_used TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type, created_at DESC);

-- ============================================
-- 3. SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_interval TEXT DEFAULT 'monthly' CHECK (billing_interval IN ('monthly', 'yearly')),
  payment_provider TEXT,
  payment_id TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);

-- ============================================
-- 4. ERROR REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS error_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  selector_id TEXT NOT NULL,
  selector_value TEXT NOT NULL,
  error_count INTEGER DEFAULT 1,
  last_error_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  UNIQUE(selector_id, selector_value)
);

-- ============================================
-- 5. DATABASE FUNCTIONS
-- ============================================

-- Function: Increment error report
CREATE OR REPLACE FUNCTION increment_error_report(
  p_selector_id TEXT,
  p_selector_value TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO error_reports (selector_id, selector_value, error_count, last_error_at)
  VALUES (p_selector_id, p_selector_value, 1, NOW())
  ON CONFLICT (selector_id, selector_value)
  DO UPDATE SET
    error_count = error_reports.error_count + 1,
    last_error_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VERIFY SETUP
-- ============================================

-- Check all tables exist
SELECT
  'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'admin_users', COUNT(*) FROM admin_users
UNION ALL
SELECT 'plans', COUNT(*) FROM plans
UNION ALL
SELECT 'selectors', COUNT(*) FROM selectors
UNION ALL
SELECT 'analytics', COUNT(*) FROM analytics
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions;
