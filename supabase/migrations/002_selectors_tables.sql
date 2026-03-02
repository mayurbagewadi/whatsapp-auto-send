-- ============================================
-- Migration: 002_selectors_tables.sql
-- Description: Dynamic WhatsApp selectors management
-- Feature: Selector Management & Error Tracking
-- Created: 2026-02-16
-- ============================================

-- Selectors Table (Dynamic DOM Selectors)
CREATE TABLE IF NOT EXISTS selectors (
  id TEXT PRIMARY KEY,

  -- Selector Data
  selectors JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,

  -- Performance Tracking
  success_rate DECIMAL(5,2) DEFAULT 100.0,
  total_attempts INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,

  -- Timestamps
  last_tested_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT DEFAULT 'system'
);

-- Error Reports Table (Track Failing Selectors)
CREATE TABLE IF NOT EXISTS error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Error Details
  selector_id TEXT NOT NULL,
  selector_value TEXT NOT NULL,
  error_count INTEGER DEFAULT 1,

  -- Timestamps
  last_error_at TIMESTAMP DEFAULT NOW(),

  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by TEXT,

  -- Composite unique constraint
  UNIQUE(selector_id, selector_value)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_selectors_version
  ON selectors(version DESC);

CREATE INDEX IF NOT EXISTS idx_errors_selector
  ON error_reports(selector_id, resolved);

CREATE INDEX IF NOT EXISTS idx_errors_unresolved
  ON error_reports(resolved, last_error_at DESC)
  WHERE resolved = FALSE;

-- Initial Selectors Data
INSERT INTO selectors (id, selectors, version) VALUES
(
  'send_button',
  '[
    "button[data-testid=\"compose-btn-send\"]",
    "button[aria-label=\"Send\"]",
    "span[data-icon=\"send\"]",
    "button[data-tab=\"11\"]"
  ]'::jsonb,
  1
),
(
  'input_box',
  '[
    "div[contenteditable=\"true\"][data-tab=\"10\"]",
    "div[data-testid=\"conversation-compose-box-input\"]",
    "div[aria-placeholder=\"Type a message\"]",
    "div[contenteditable=\"true\"][role=\"textbox\"]"
  ]'::jsonb,
  1
),
(
  'modal_confirm',
  '[
    "div[data-animate-modal-popup=\"true\"] button:last-child",
    "div[role=\"dialog\"] button[role=\"button\"]",
    "button[data-testid=\"popup-confirm\"]"
  ]'::jsonb,
  1
);

-- Comments
COMMENT ON TABLE selectors IS
  'Dynamic WhatsApp Web DOM selectors - update without publishing extension';

COMMENT ON COLUMN selectors.selectors IS
  'Array of CSS selectors (JSON) - tried in order until one matches';

COMMENT ON COLUMN selectors.success_rate IS
  'Percentage of successful selector matches (calculated from total_successes/total_attempts)';

COMMENT ON TABLE error_reports IS
  'Track failing selectors to detect when WhatsApp UI changes';
