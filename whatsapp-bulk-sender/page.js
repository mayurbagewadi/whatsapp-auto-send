// ===== WhatsApp Bulk Sender - Page Script (Premium Sender Strategy) =====
// Uses wa.me:// protocol for reliable chat opening + send button polling
// Uses dynamic selectors fetched from Supabase (auto-updates when WhatsApp changes)

console.log('[Page] Loaded (wa.me + Premium Sender approach)');

// ===== Dynamic Selectors from Supabase =====
// All selectors fetched from Supabase wa_selectors table.
// Update via super-admin → Selectors page. No code change needed.
let SEND_BUTTON_SELECTOR       = '[data-icon="send"],[data-icon="wds-ic-send-filled"]';
let ATTACHMENT_BUTTON_SELECTOR = 'span[data-icon="plus"],span[data-icon="plus-rounded"]';
let ATTACHMENT_MENU_SELECTOR   = '[role="menu"] [role="menuitem"],div[role="application"] li[role="button"]';
let FILE_INPUT_SELECTOR        = 'input[type="file"][accept*="video"],input[type="file"][accept*="image"],input[type="file"]';
let CHAT_INPUT_SELECTOR        = '[contenteditable="true"]';
let CAPTION_INPUT_SELECTOR     = '[aria-label="Add a caption"]';

// Listen for selector updates from content.js (populated from Supabase on load)
window.addEventListener('wa-bulk-sender:update-selectors', (event) => {
  const { selectors } = event.detail;
  if (!selectors) return;
  if (selectors.SELECTOR_SEND_BUTTON)       SEND_BUTTON_SELECTOR       = selectors.SELECTOR_SEND_BUTTON;
  if (selectors.SELECTOR_ATTACHMENT_BUTTON) ATTACHMENT_BUTTON_SELECTOR = selectors.SELECTOR_ATTACHMENT_BUTTON;
  if (selectors.SELECTOR_ATTACHMENT_MENU)   ATTACHMENT_MENU_SELECTOR   = selectors.SELECTOR_ATTACHMENT_MENU;
  if (selectors.SELECTOR_FILE_INPUT)        FILE_INPUT_SELECTOR        = selectors.SELECTOR_FILE_INPUT;
  if (selectors.SELECTOR_CHAT_INPUT)        CHAT_INPUT_SELECTOR        = selectors.SELECTOR_CHAT_INPUT;
  if (selectors.SELECTOR_CAPTION_INPUT)     CAPTION_INPUT_SELECTOR     = selectors.SELECTOR_CAPTION_INPUT;
  console.log('[Page] Selectors updated from Supabase:', { SEND_BUTTON_SELECTOR, ATTACHMENT_BUTTON_SELECTOR, ATTACHMENT_MENU_SELECTOR, FILE_INPUT_SELECTOR, CHAT_INPUT_SELECTOR, CAPTION_INPUT_SELECTOR });
});

// ===== Helper: Sleep =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Command: Find Chat Input (confirms chat is open, used for media sends) =====
async function cmdFindChatInput() {
  const input = document.querySelector(CHAT_INPUT_SELECTOR);
  if (input) {
    console.log('[Page] ✅ Chat input found — chat is ready');
    return { success: true, found: true };
  }
  return { success: false, found: false, error: `Chat input not found (selector: ${CHAT_INPUT_SELECTOR})` };
}

// ===== Command: Find Send Button (uses dynamic selector from Supabase) =====
async function cmdFindSendButton() {
  try {
    console.log('[Page] Finding send button using selector:', SEND_BUTTON_SELECTOR);

    const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);

    if (!sendButton) {
      return { success: false, found: false, error: 'Send button not found' };
    }

    console.log('[Page] ✅ Found send button:', sendButton.getAttribute('data-icon'));
    return { success: true, found: true };

  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===== Command: Click Send Button (with polling confirmation) =====
async function cmdClickSendButton() {
  try {
    console.log('[Page] Phase 1: Finding and clicking send button...');

    const sendButton = document.querySelector(SEND_BUTTON_SELECTOR);

    if (!sendButton) {
      return { success: false, error: 'Send button not found' };
    }

    console.log('[Page] Found send button, clicking with full event sequence...');

    // Click with full event chain (mimic real user click)
    sendButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(100);

    sendButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    await sleep(50);
    sendButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    await sleep(50);
    sendButton.focus();
    await sleep(50);
    sendButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    await sleep(50);
    sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(100);

    console.log('[Page] Button clicked, starting polling confirmation...');

    // Phase 2: Poll for input field to clear (message was sent)
    console.log('[Page] Phase 2: Polling for confirmation (30 seconds)...');
    const pollStartTime = Date.now();
    const pollTimeout = 30000;
    const pollInterval = 500;
    let pollCount = 0;

    while (Date.now() - pollStartTime < pollTimeout) {
      pollCount++;

      try {
        // Check if message input field is empty or gone
        const inputFields = document.querySelectorAll('[contenteditable="true"]');

        // If no input field exists, message was sent
        if (inputFields.length === 0) {
          console.log(`[Page] ✅ Input field disappeared - message sent! (${pollCount} polls)`);
          return { success: true, method: 'input-disappeared' };
        }

        // Check if input is empty
        let hasText = false;
        for (const input of inputFields) {
          const text = input.textContent || input.innerText || '';
          if (text.trim().length > 0) {
            hasText = true;
            break;
          }
        }

        if (!hasText) {
          console.log(`[Page] ✅ Input cleared - message sent! (${pollCount} polls)`);
          return { success: true, method: 'input-cleared' };
        }

        // Wait before next poll
        await sleep(pollInterval);

      } catch (e) {
        console.log(`[Page] Polling error: ${e.message}, retrying...`);
        await sleep(pollInterval);
      }
    }

    // Polling timeout - assume failure
    console.log(`[Page] ⚠️ Polling timeout after ${pollCount} attempts (30 seconds)`);
    return { success: false, error: 'Message confirmation timeout - input still has text' };

  } catch (error) {
    console.error(`[Page] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ===== Command: Send With Media (SheetWA-matched approach) =====
async function cmdSendWithMedia(args) {
  const { base64, type, name, caption } = args;
  const messageText = caption;

  try {
    console.log('[Page] cmdSendWithMedia STARTED');
    console.log('[Page] Args:', { name, type, messageLength: messageText?.length });

    // Step 1: Convert base64 to File object
    console.log('[Page] Step 1: Converting media to File...');
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const file = new File([new Uint8Array(ab)], name, { type });
    console.log('[Page] File created:', { name, size: file.size, type: file.type });

    // Step 2: Verify chat is open (text pre-filled via wa.me)
    console.log('[Page] Step 2: Verifying chat input...');
    const mainInput = document.querySelector(CHAT_INPUT_SELECTOR);
    if (!mainInput) {
      return { success: false, error: 'Chat input not found' };
    }
    console.log('[Page] Chat input found, text:', (mainInput.textContent || '').substring(0, 50));

    // Step 3a: Click attachment button (full event chain like SheetWA)
    console.log('[Page] Step 3a: Clicking attachment button...');
    const attachBtn = document.querySelector(ATTACHMENT_BUTTON_SELECTOR);
    if (!attachBtn) {
      return { success: false, error: 'Attachment button not found' };
    }
    attachBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    attachBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    attachBtn.focus();
    attachBtn.dispatchEvent(new FocusEvent('focus', { bubbles: false, cancelable: false }));
    await sleep(100);
    attachBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    attachBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await sleep(500);

    // Step 3b: Find and click "Photos & videos" menu item
    console.log('[Page] Step 3b: Clicking Photos & videos menu...');
    const menuItems = Array.from(document.querySelectorAll(ATTACHMENT_MENU_SELECTOR));
    console.log('[Page] Menu items found:', menuItems.length);

    let photoVideoItem = null;
    for (const item of menuItems) {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes('photo') || text.includes('video') || text.includes('gallery') || text.includes('image')) {
        photoVideoItem = item;
        break;
      }
    }
    // SheetWA uses index 1 for "Photos & videos" as fallback
    if (!photoVideoItem && menuItems.length > 1) {
      photoVideoItem = menuItems[1];
    } else if (!photoVideoItem && menuItems.length > 0) {
      photoVideoItem = menuItems[0];
    }
    if (!photoVideoItem) {
      return { success: false, error: 'No attachment menu items found' };
    }

    console.log('[Page] Clicking menu item:', photoVideoItem.textContent?.substring(0, 30));
    photoVideoItem.click();
    await sleep(500);

    // Step 4: Find file input (SheetWA method: body > input[type='file'], hidden, LAST one)
    console.log('[Page] Step 4: Finding file input (SheetWA method)...');
    let fileInput = null;

    // SheetWA exact selector: body > input[type='file'] with display:none and accept includes image
    const allFileInputs = Array.from(document.querySelectorAll("body > input[type='file']"))
      .filter(el => {
        const style = el.style.display || window.getComputedStyle(el).display;
        const accept = el.getAttribute('accept') || '';
        return style === 'none' && (accept === '*' || accept.includes('image') || accept.includes('video'));
      });

    if (allFileInputs.length > 0) {
      fileInput = allFileInputs[allFileInputs.length - 1]; // LAST one (SheetWA uses .at(-1))
      console.log('[Page] Found file input (SheetWA method):', {
        accept: fileInput.getAttribute('accept'),
        index: allFileInputs.length - 1,
        total: allFileInputs.length
      });
    }

    // Fallback: try other selectors if SheetWA method didn't find it
    if (!fileInput) {
      console.log('[Page] SheetWA selector found nothing, trying fallbacks...');
      fileInput = document.querySelector(FILE_INPUT_SELECTOR)
        || document.querySelector('input[type="file"][accept*="image"]')
        || document.querySelector('input[type="file"][accept*="video"]')
        || document.querySelector('input[type="file"]');
    }

    if (!fileInput) {
      return { success: false, error: 'File input not found after menu click' };
    }

    console.log('[Page] File input ready:', {
      accept: fileInput.getAttribute('accept'),
      parentTag: fileInput.parentElement?.tagName
    });

    // Step 5: Inject file using DataTransfer (SheetWA exact method)
    console.log('[Page] Step 5: Injecting file (SheetWA method)...');
    try {
      // SheetWA: new ClipboardEvent("").clipboardData || new DataTransfer()
      let dt;
      try {
        dt = new ClipboardEvent("").clipboardData || new DataTransfer();
      } catch (e) {
        dt = new DataTransfer();
      }
      dt.items.add(file);
      fileInput.files = dt.files;
      console.log('[Page] Files assigned:', fileInput.files.length);

      // SheetWA exact event order: input FIRST, change SECOND, both cancelable:false
      fileInput.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
      fileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
      console.log('[Page] Events dispatched (input then change, cancelable:false)');
    } catch (e) {
      return { success: false, error: 'File injection failed: ' + e.message };
    }

    // Step 6: Wait for WhatsApp to process (SheetWA waits 3000ms + 1000ms = 4 seconds)
    console.log('[Page] Step 6: Waiting 3s for WhatsApp to process media...');
    await sleep(3000);
    console.log('[Page] Waiting 1s more...');
    await sleep(1000);

    // Step 7: Poll for send button and click (SheetWA polls every 500ms)
    console.log('[Page] Step 7: Polling for send button...');
    const sendTimeout = 30000;
    const sendStartTime = Date.now();

    while (Date.now() - sendStartTime < sendTimeout) {
      const sendBtn = document.querySelector(SEND_BUTTON_SELECTOR);
      if (sendBtn) {
        console.log('[Page] Send button found, waiting 500ms before click...');
        await sleep(500);

        // Click send
        sendBtn.click();
        console.log('[Page] Send button clicked!');

        // Poll until send button disappears (confirms message was sent)
        console.log('[Page] Polling for send confirmation...');
        const confirmStart = Date.now();
        while (Date.now() - confirmStart < sendTimeout) {
          if (!document.querySelector(SEND_BUTTON_SELECTOR)) {
            console.log('[Page] ✅ Send button disappeared — message sent!');
            return { success: true, method: 'sheetwa-approach' };
          }
          await sleep(500);
        }

        // Button still there after timeout
        console.log('[Page] ⚠️ Send button still present after timeout');
        return { success: false, error: 'Send button did not disappear after click' };
      }
      await sleep(500);
    }

    return { success: false, error: 'Send button not found (timeout)' };

  } catch (e) {
    console.error('[Page] Media send error:', e.message);
    return { success: false, error: e.message };
  }
}

// ===== Message Handler from content.js =====
window.addEventListener('wa-bulk-sender:cmd', async (event) => {
  const { id, cmd, args } = event.detail;
  let result = { success: false, error: 'Unknown command' };

  try {
    console.log(`[Page] Received command: ${cmd}`);

    switch (cmd) {
      case 'findSendBtn':
        result = await cmdFindSendButton();
        break;
      case 'findChatInput':
        result = await cmdFindChatInput();
        break;
      case 'clickSendButton':
        result = await cmdClickSendButton();
        break;
      case 'sendWithMedia':
        result = await cmdSendWithMedia(args);
        break;
      default:
        result = { success: false, error: `Unknown command: ${cmd}` };
    }
  } catch (e) {
    result = { success: false, error: e.message };
  }

  // Send result back to content.js
  window.dispatchEvent(new CustomEvent('wa-bulk-sender:cmd-result', {
    detail: { id, result }
  }));
});

console.log('[Page] Ready (Button clicking approach)');
