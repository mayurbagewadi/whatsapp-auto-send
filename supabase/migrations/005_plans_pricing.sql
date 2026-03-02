-- ============================================
-- Migration: 005_plans_pricing.sql
-- Description: Subscription plans and pricing
-- Feature: Plans & Pricing Management
-- Created: 2026-02-16
-- ============================================

-- Plans Table (Subscription Plans)
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,

  -- Plan Details
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,

  -- Limits & Features
  messages_limit INTEGER NOT NULL,
  features JSONB,

  -- Status
  active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert Default Plans
INSERT INTO plans (id, name, description, price, messages_limit, features, display_order) VALUES
(
  'free',
  'Free Plan',
  'Perfect for testing and small batches',
  0.00,
  10,
  '{
    "support": "community",
    "priority": "low",
    "analytics": false,
    "features": [
      "10 messages per day",
      "Community support",
      "Basic analytics"
    ]
  }'::jsonb,
  1
),
(
  'pro',
  'Pro Plan',
  'Best for small businesses and freelancers',
  9.99,
  500,
  '{
    "support": "email",
    "priority": "medium",
    "analytics": true,
    "features": [
      "500 messages per day",
      "Email support",
      "Advanced analytics",
      "Priority updates",
      "Custom delays"
    ]
  }'::jsonb,
  2
),
(
  'enterprise',
  'Enterprise Plan',
  'For agencies and high-volume senders',
  49.99,
  999999,
  '{
    "support": "priority",
    "priority": "high",
    "analytics": true,
    "custom_limits": true,
    "features": [
      "Unlimited messages",
      "Priority support",
      "Advanced analytics",
      "Custom features",
      "Dedicated account manager",
      "API access"
    ]
  }'::jsonb,
  3
);

-- Subscriptions Table (User Plan History)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Reference
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Plan Details
  plan_id TEXT REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),

  -- Billing
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  billing_interval TEXT DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'yearly', 'lifetime')),

  -- Payment Gateway
  payment_provider TEXT,  -- 'stripe', 'paypal', 'manual'
  payment_id TEXT,        -- Stripe subscription ID, etc.

  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Metadata
  metadata JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_active
  ON plans(active, display_order)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON subscriptions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_payment
  ON subscriptions(payment_provider, payment_id);

-- Comments
COMMENT ON TABLE plans IS
  'Available subscription plans with pricing and features';

COMMENT ON COLUMN plans.features IS
  'JSON object with plan features and metadata';

COMMENT ON TABLE subscriptions IS
  'User subscription history and payment tracking';

-- View: Active Subscriptions
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT
  s.id as subscription_id,
  u.email,
  u.license_key,
  p.name as plan_name,
  s.amount,
  s.status,
  s.expires_at,
  s.payment_provider
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
  AND (s.expires_at IS NULL OR s.expires_at > NOW())
ORDER BY s.created_at DESC;

-- View: Revenue Analytics
CREATE OR REPLACE VIEW revenue_analytics AS
SELECT
  DATE(s.created_at) as date,
  p.name as plan_name,
  COUNT(*) as subscriptions_count,
  SUM(s.amount) as total_revenue,
  s.billing_interval
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE s.status = 'active'
GROUP BY DATE(s.created_at), p.name, s.billing_interval
ORDER BY date DESC;

COMMENT ON VIEW active_subscriptions IS
  'All active subscriptions with user and plan details';

COMMENT ON VIEW revenue_analytics IS
  'Daily revenue breakdown by plan - use for admin dashboard';
