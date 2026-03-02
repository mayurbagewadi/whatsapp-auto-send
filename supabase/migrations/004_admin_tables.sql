-- ============================================
-- Migration: 004_admin_tables.sql
-- Description: Super admin authentication and roles
-- Feature: Super Admin Management
-- Created: 2026-02-16
-- ============================================

-- Admin Users Table (Super Admin Accounts)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Authentication
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,

  -- Role & Permissions
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('super_admin', 'admin', 'support')),

  -- Status
  active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,

  -- Session Management
  session_token TEXT,
  session_expires_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_email
  ON admin_users(email);

CREATE INDEX IF NOT EXISTS idx_admin_role
  ON admin_users(role)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_admin_session
  ON admin_users(session_token)
  WHERE session_token IS NOT NULL
    AND session_expires_at > NOW();

-- Admin Activity Log (Audit Trail)
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Admin Reference
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,

  -- Action Details
  action_type TEXT NOT NULL
    CHECK (action_type IN (
      'login',
      'logout',
      'create_user',
      'update_user',
      'delete_user',
      'update_selector',
      'update_plan',
      'view_analytics'
    )),

  -- Target Details
  target_type TEXT,  -- 'user', 'selector', 'plan', etc.
  target_id TEXT,

  -- Change Details
  old_value JSONB,
  new_value JSONB,

  -- Request Info
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_admin_log_admin
  ON admin_activity_log(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_log_action
  ON admin_activity_log(action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_log_target
  ON admin_activity_log(target_type, target_id);

-- Comments
COMMENT ON TABLE admin_users IS
  'Super admin accounts for managing the platform';

COMMENT ON COLUMN admin_users.role IS
  'super_admin: full access | admin: limited | support: view-only';

COMMENT ON TABLE admin_activity_log IS
  'Audit trail of all admin actions for security and compliance';

-- Insert default super admin
-- NOTE: Change password hash after first login!
-- Default password: "ChangeMe123!" (CHANGE THIS!)
INSERT INTO admin_users (email, password_hash, role) VALUES
(
  'admin@yourdomain.com',
  '$2a$10$EXAMPLE_HASH_CHANGE_THIS',  -- Use bcrypt to generate real hash
  'super_admin'
);

-- View: Recent Admin Activity
CREATE OR REPLACE VIEW recent_admin_activity AS
SELECT
  al.created_at,
  au.email as admin_email,
  au.role,
  al.action_type,
  al.target_type,
  al.target_id
FROM admin_activity_log al
LEFT JOIN admin_users au ON al.admin_id = au.id
ORDER BY al.created_at DESC
LIMIT 100;

COMMENT ON VIEW recent_admin_activity IS
  'Last 100 admin actions - use for dashboard monitoring';
