-- ============================================
-- Migration: 018_wa_selectors.sql
-- Description: Simple key-value selectors table
--              for dynamic WhatsApp DOM selectors
-- ============================================

CREATE TABLE IF NOT EXISTS wa_selectors (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Allow public read (extension uses anon key, no login needed)
ALTER TABLE wa_selectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read wa_selectors"
  ON wa_selectors FOR SELECT USING (true);

-- Default selectors (confirmed working as of 2026-02-24)
INSERT INTO wa_selectors (key, value) VALUES
  ('SELECTOR_SEND_BUTTON',           '[data-icon="send"],[data-icon="wds-ic-send-filled"]'),
  ('SELECTOR_ADD_ATTACHMENT_BUTTON', 'span[data-icon="plus"],span[data-icon="plus-rounded"]'),
  ('SELECTOR_ADD_ATTACHMENT_INPUT',  'input[type="file"]'),
  ('SELECTOR_APP_WA_ME_LINK',        '#app .app-wrapper-web span'),
  ('SELECTOR_APP_WA_ME_LINK_ID',     'blkwhattsapplink'),
  ('SELECTOR_APP_WA_ME_MODAL',       '[data-animate-modal-backdrop=true]'),
  ('SELECTOR_APP_WA_ME_MODAL_ROLE',  '[role=status]'),
  ('SELECTOR_ATTACHMENT_MENUBUTTONS','[role="menu"] [role="menuitem"],div[role="application"] li[role="button"]')
ON CONFLICT (key) DO NOTHING;
