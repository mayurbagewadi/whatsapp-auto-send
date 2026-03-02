-- Add company_name to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) NOT NULL DEFAULT '';
