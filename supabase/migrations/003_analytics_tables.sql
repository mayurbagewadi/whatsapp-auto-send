-- ============================================
-- Migration: 003_analytics_tables.sql
-- Description: Usage analytics and monitoring
-- Feature: Analytics & Monitoring
-- Created: 2026-02-16
-- ============================================

-- Analytics Table (Event Tracking)
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User Reference
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Event Data
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'message_sent',
      'message_failed',
      'selector_failed',
      'extension_loaded',
      'license_validated'
    )),

  -- Selector Tracking (for selector_failed events)
  selector_id TEXT,
  selector_used TEXT,

  -- Error Tracking
  error_message TEXT,

  -- Additional Data
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_analytics_user_date
  ON analytics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type
  ON analytics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_selector
  ON analytics(selector_id)
  WHERE selector_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_created_at
  ON analytics(created_at DESC);

-- Partitioning by month (for large datasets - optional)
-- Uncomment when you have millions of records
/*
CREATE TABLE analytics_2026_02 PARTITION OF analytics
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
*/

-- Comments
COMMENT ON TABLE analytics IS
  'Event tracking for usage analytics, monitoring, and debugging';

COMMENT ON COLUMN analytics.event_type IS
  'Type of event: message_sent, message_failed, selector_failed, etc.';

COMMENT ON COLUMN analytics.metadata IS
  'Additional event data stored as JSON (flexible schema)';

-- View: Daily Statistics (for dashboards)
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(created_at) as date,
  user_id,
  COUNT(*) FILTER (WHERE event_type = 'message_sent') as messages_sent,
  COUNT(*) FILTER (WHERE event_type = 'message_failed') as messages_failed,
  COUNT(*) FILTER (WHERE event_type = 'selector_failed') as selector_errors
FROM analytics
GROUP BY DATE(created_at), user_id
ORDER BY date DESC;

-- View: Selector Performance
CREATE OR REPLACE VIEW selector_performance AS
SELECT
  selector_id,
  selector_used,
  COUNT(*) as usage_count,
  COUNT(*) FILTER (WHERE event_type = 'selector_failed') as failure_count,
  ROUND(
    (COUNT(*) FILTER (WHERE event_type != 'selector_failed')::DECIMAL / COUNT(*)) * 100,
    2
  ) as success_rate
FROM analytics
WHERE selector_id IS NOT NULL
GROUP BY selector_id, selector_used
ORDER BY usage_count DESC;

COMMENT ON VIEW daily_stats IS
  'Daily aggregated statistics per user - use for dashboards';

COMMENT ON VIEW selector_performance IS
  'Selector success rates - monitor which selectors are failing';
