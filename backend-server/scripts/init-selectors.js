// ===== Initialize Default Selectors =====
// Run once to populate whatsapp_selectors table with default values
// Usage: node scripts/init-selectors.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const defaultSelectors = [
  {
    name: 'send_button',
    selectors: [
      '[data-icon="send"]',
      '[data-icon="wds-ic-send-filled"]',
      '[data-icon="send-i"]',
      'button[aria-label="Send"]',
      'button[data-testid="compose-btn-send"]',
      'button[data-tab="11"]'
    ],
    description: 'Send message button in WhatsApp Web (Premium Sender proven selectors)',
    whatsapp_version: 'current',
    is_working: true
  },
  {
    name: 'message_input',
    selectors: [
      '[contenteditable="true"]',
      '[data-tab="6"]',
      'div[role="textbox"]',
      'div[data-testid="textbox"]'
    ],
    description: 'Message input field where text is typed',
    whatsapp_version: 'current',
    is_working: true
  },
  {
    name: 'modal_confirm',
    selectors: [
      'div[data-animate-modal-popup="true"] button:last-child',
      'div[role="dialog"] button[role="button"]',
      'button[data-testid="popup-confirm"]'
    ],
    description: 'Confirmation button in "Continue to chat?" modal',
    whatsapp_version: 'current',
    is_working: true
  },
  {
    name: 'chat_list',
    selectors: [
      '#side',
      '[data-testid="chat-list"]',
      '[aria-label="Chat list"]'
    ],
    description: 'Chat list container (indicates WhatsApp is ready)',
    whatsapp_version: 'current',
    is_working: true
  }
];

async function initSelectors() {
  try {
    console.log('🔄 Initializing default selectors...');

    for (const selector of defaultSelectors) {
      const { data, error } = await supabase
        .from('whatsapp_selectors')
        .upsert([selector], { onConflict: 'name' });

      if (error) {
        console.error(`❌ Error inserting ${selector.name}:`, error.message);
      } else {
        console.log(`✅ ${selector.name} initialized`);
      }
    }

    console.log('\n✅ All default selectors initialized!');
    console.log('\n📊 You can now:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Test selectors: curl http://localhost:3000/api/selectors');
    console.log('   3. Update extension to fetch from backend');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

initSelectors();
