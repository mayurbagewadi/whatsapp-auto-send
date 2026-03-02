-- ============================================
-- Migration: 011_plans_monthly_yearly_price.sql
-- Description: Add monthly/yearly pricing to plans
-- Created: 2026-02-19
-- ============================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS price_monthly DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS price_yearly  DECIMAL(10,2) DEFAULT 0.00;

-- Backfill: existing price becomes monthly price, yearly = ~10 months (2 months free)
UPDATE public.plans
SET
  price_monthly = price,
  price_yearly  = ROUND(price * 10, 2)
WHERE price_monthly = 0.00 OR price_monthly IS NULL;
