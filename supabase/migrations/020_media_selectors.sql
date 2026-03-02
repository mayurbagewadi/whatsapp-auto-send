-- ============================================
-- Migration: 020_media_selectors.sql
-- Description: Add media attachment selectors to wa_selectors
--              so extension can dynamically find WhatsApp's
--              attachment button and menu without hardcoding.
-- ============================================

INSERT INTO wa_selectors (key, value) VALUES
  ('SELECTOR_ATTACHMENT_BUTTON', 'span[data-icon="plus"],span[data-icon="plus-rounded"]'),
  ('SELECTOR_ATTACHMENT_MENU',   '[role="menu"] [role="menuitem"],div[role="application"] li[role="button"]'),
  ('SELECTOR_FILE_INPUT',        'input[type="file"]'),
  ('SELECTOR_CHAT_INPUT',        '[contenteditable="true"]'),
  ('SELECTOR_CAPTION_INPUT',     '[aria-label="Add a caption"]')
ON CONFLICT (key) DO UPDATE SET
  value      = EXCLUDED.value,
  updated_at = NOW();
