-- ============================================
-- Migration: 009_add_user_password.sql
-- Description: Add password authentication for users
-- Replace license key system with email + phone + password
-- ============================================

-- Add password_hash column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Make email unique (if not already)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Make phone unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- Users can now login with email + password instead of license key
-- License key column kept for backward compatibility

COMMENT ON COLUMN users.password_hash IS 'SHA256 hash of user password for extension login';
COMMENT ON COLUMN users.phone IS 'User phone number for signup/login';
