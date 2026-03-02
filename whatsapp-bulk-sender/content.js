// ===== WhatsApp Bulk Sender - Content Script (IPC Orchestrator) =====
// Role: Bridge between background.js and page.js with command coordination


// ===== Inject page.js into MAIN world =====
(function injectPageScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('page.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();

// ===== Pending Command Promises (page.js bridge) =====
const pendingCommands = new Map();
let commandCounter = 0;

// ===== Injected.js Bridge (MAIN world direct API) =====
const pendingInjectCommands = new Map();
let injectCommandCounter = 0;
let injectReady = false;

window.addEventListener('wa-bulk-sender:inject-ready', (event) => {
  injectReady = true;
});

window.addEventListener('wa-bulk-sender:inject-result', (event) => {
  const { id, result } = event.detail;
  const resolve = pendingInjectCommands.get(id);
  if (resolve) {
    pendingInjectCommands.delete(id);
    resolve(result);
  }
});

function executeInjectCommand(cmd, data, timeout = 30000) {
  const id = ++injectCommandCounter;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingInjectCommands.delete(id);
      reject(new Error(`Inject command timeout (${timeout}ms): ${cmd}`));
    }, timeout);

    pendingInjectCommands.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    window.dispatchEvent(new CustomEvent('wa-bulk-sender:inject-cmd', {
      detail: { id, cmd, data }
    }));
  });
}

// ===== Command Execution Engine =====
async function executeCommand(cmd, args, timeout = 10000) {
  const id = ++commandCounter;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command timeout (${timeout}ms): ${cmd}`));
    }, timeout);

    pendingCommands.set(id, (result) => {
      clearTimeout(timer);
      pendingCommands.delete(id);
      if (result.success) {
        resolve(result);
      } else {
        reject(new Error(result.error || `Command failed: ${cmd}`));
      }
    });

    // Send command to page.js
    window.dispatchEvent(new CustomEvent('wa-bulk-sender:cmd', {
      detail: { id, cmd, args }
    }));
  });
}

// ===== Listen for Command Results from page.js =====
window.addEventListener('wa-bulk-sender:cmd-result', (event) => {
  const { id, result } = event.detail;
  const callback = pendingCommands.get(id);
  if (callback) {
    callback(result);
  }
});

// ===== WhatsApp Status Check =====
function checkWhatsAppStatus() {
  const qrSelectors = ['canvas[aria-label="Scan me!"]', '[data-testid="qrcode"]'];
  if (qrSelectors.some(sel => document.querySelector(sel))) {
    return { status: 'not_logged_in', message: 'Please scan QR code' };
  }

  const readySelectors = ['#side', '[data-testid="chat-list"]', '[aria-label="Chat list"]'];
  if (readySelectors.some(sel => document.querySelector(sel))) {
    return { status: 'ready', message: 'WhatsApp ready' };
  }

  return { status: 'loading', message: 'WhatsApp loading' };
}

// ===== Open Chat via wa.me Anchor (no page reload) =====
// Reference: backup/content.js — clicks wa.me link from inside the page so
// WhatsApp's own click handler intercepts it and navigates internally.
async function openChatViaWaMe(number, message) {

  const cleanNumber = number.replace(/\D/g, '');
  const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

  // Reuse or create a persistent hidden container
  let container = document.querySelector('#wa-bulk-sender-link-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'wa-bulk-sender-link-container';
    container.style.display = 'none';
    document.body.appendChild(container);
  }

  container.innerHTML = `<a href="${url}" id="wa-bulk-sender-link" target="_self">open</a>`;
  await new Promise(r => setTimeout(r, 200));

  const link = document.getElementById('wa-bulk-sender-link');
  if (!link) throw new Error('Failed to create wa.me anchor element');

  // Full mouse event chain — WhatsApp's internal handler intercepts the wa.me link
  link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 100));
  link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 100));
  link.focus();
  link.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  link.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 100));
  link.click();


  // Wait for WhatsApp's internal navigation to complete
  await new Promise(r => setTimeout(r, 1500));

  // Handle "Continue to WhatsApp?" / "Open in app?" modal if it appears
  const modal = document.querySelector('div[data-animate-modal-popup="true"]')
             || document.querySelector('div[role="dialog"]');

  if (modal) {
    const modalText = modal.innerText.toLowerCase();
    if (modalText.includes('invalid') || modalText.includes('not exist')) {
      throw new Error(`Invalid phone number: ${number}`);
    }
    const confirmBtn = modal.querySelector('button');
    if (confirmBtn) {
      confirmBtn.click();
      await new Promise(r => setTimeout(r, 800));
    }
  }

  // Allow chat UI to fully settle before send button check
  await new Promise(r => setTimeout(r, 1500));
}

// ===== Orchestrated Send Message Flow =====
async function orchestrateSendMessage(number, message, media = null) {
  try {

    if (media) {
      // ── Media send: use DOM approach (SheetWA method) ──────────────────
      // Step 1: Open chat and pre-fill text via wa.me (same as text-only)
      await openChatViaWaMe(number, message);

      // Step 2: Wait for chat to be ready
      let chatReady = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const findResult = await executeCommand('findChatInput', {}, 3000);
          if (findResult.found) {
            chatReady = true;
            break;
          }
        } catch (e) {
          // Timeout expected while waiting
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!chatReady) {
        throw new Error('Chat page did not load - input not found');
      }

      // Step 3: Send media (text already in input from wa.me)
      const sendResult = await executeCommand('sendWithMedia', {
        base64:   media.base64,
        type:     media.type,
        name:     media.name,
        caption:  message  // Still send message in case it's needed
      }, 60000);

      if (!sendResult.success) {
        throw new Error('Media send failed: ' + sendResult.error);
      }
    } else {
      // ── Text send: existing wa.me + button click approach (works reliably) ──
      await openChatViaWaMe(number, message);

      let pageReady = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const findResult = await executeCommand('findSendBtn', {}, 3000);
          if (findResult.found) {
            pageReady = true;
            break;
          }
        } catch (e) {
          // Timeout expected while waiting
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!pageReady) {
        throw new Error('Chat page did not load - send button not found');
      }

      const sendResult = await executeCommand('clickSendButton', {}, 35000);

      if (!sendResult.success) {
        throw new Error('Send button click failed: ' + sendResult.error);
      }

    }


    chrome.runtime.sendMessage({
      action: 'messageSent',
      data: { number, message }
    }).catch(() => {});

    return { success: true };

  } catch (error) {

    chrome.runtime.sendMessage({
      action: 'messageFailed',
      data: { number, error: error.message }
    }).catch(() => {});

    throw error;
  }
}

// ===== Message Listener from Background =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === 'checkStatus') {
    const status = checkWhatsAppStatus();
    sendResponse(status);
    return true;
  }

  if (request.action === 'sendMessage') {
    const { number, message, media } = request.data;

    // Execute async without blocking
    orchestrateSendMessage(number, message, media)
      .catch(err => console.error('[Content] Send error:', err));

    // Acknowledge immediately
    sendResponse({ success: true, queued: true });
    return true;
  }
});

// ===== Load Selectors =====
async function loadSelectors() {
  return new Promise(resolve => {
    chrome.storage.local.get(['selectors'], (data) => {
      if (data.selectors) {
        window.dispatchEvent(new CustomEvent('wa-bulk-sender:update-selectors', {
          detail: { selectors: data.selectors }
        }));
      }
      resolve();
    });
  });
}

// ===== Listen for Selector Updates =====
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.selectors) {
    window.dispatchEvent(new CustomEvent('wa-bulk-sender:update-selectors', {
      detail: { selectors: changes.selectors.newValue }
    }));
  }
});

// ===== Initialize =====
(async () => {
  // Wait for WhatsApp
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (checkWhatsAppStatus().status !== 'loading') {
      ready = true;
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  if (ready) {
    chrome.runtime.sendMessage({ action: 'whatsappReady' }).catch(() => {});

    // Load selectors
    await loadSelectors();
  }
})();

