// ===== WA Bulk Sender — Injected Script (MAIN world) =====
// Runs in the same JS context as WhatsApp Web.
// Uses WhatsApp's internal webpack modules to send messages and media
// without touching the DOM or clicking any buttons.

(function () {
  'use strict';

  console.log('[Injected] WA Bulk Sender — MAIN world loaded');

  let Store       = null;
  let storeReady  = false;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── Step 1: Try to reuse window.Store already built by another extension ───
  // WASender's fl.js or other injected scripts often build window.Store first.
  // If it's available and has the required modules, use it directly — no parasite needed.

  function tryUseExistingStore() {
    const s = window.Store;
    if (s && typeof s.WidFactory?.createWid === 'function' &&
        typeof s.Chat?.find === 'function' &&
        typeof s.SendTextMsgToChat === 'function') {

      Store = {
        WidFactory:          s.WidFactory,
        Chat:                s.Chat,
        SendTextMsgToChat:   s.SendTextMsgToChat,
        Cmd:                 s.Cmd || window.wa?.Cmd || null,
        MediaCollection:     s.MediaCollection || null,
        FindChat:            s.FindChat || null,
      };
      storeReady = true;
      window.WaBulkSenderStore = Store;
      console.log('[Injected] Reusing window.Store — modules:', Object.keys(Store).filter(k => Store[k]).join(', '));
      return true;
    }
    return false;
  }

  // ─── Step 2: Poll for window.Store OR webpack chunk (whichever comes first) ─

  function waitForWebpack(callback, attempt = 0) {
    if (attempt > 60) {
      console.error('[Injected] Store not available after 60s — giving up');
      return;
    }

    // Option A: window.Store already built by another extension (WASender etc.)
    if (tryUseExistingStore()) {
      callback();
      return;
    }

    // Option B: webpack chunk array is available — run our own parasite
    if (window.webpackChunkwhatsapp_web_client) {
      injectParasite(callback);
      return;
    }

    // Neither available yet — keep polling
    setTimeout(() => waitForWebpack(callback, attempt + 1), 1000);
  }

  // ─── Step 2: Push a fake chunk to capture internal require ─────────────────
  // WhatsApp uses webpack. Pushing a "parasite" chunk gives us the internal
  // require() function which lets us access all loaded modules.

  function injectParasite(callback) {
    try {
      window.webpackChunkwhatsapp_web_client.push([
        ['wa-bulk-sender-parasite'],
        {},
        function (o, e, req) {
          // Force-load every module so they're all in the registry
          Object.keys(o.m || {}).forEach(id => {
            try { o(id); } catch (_) {}
          });

          const built = buildStore(o);
          if (built) {
            Store      = built;
            storeReady = true;
            window.WaBulkSenderStore = Store;
            console.log('[Injected] Store ready:', Object.keys(Store).join(', '));
            callback();
          } else {
            console.error('[Injected] Store build failed — required modules not found');
          }
        }
      ]);
    } catch (e) {
      console.error('[Injected] Parasite injection failed:', e.message);
    }
  }

  // ─── Step 3: Fingerprint modules to build our Store ─────────────────────────
  // Each module is identified by unique method signatures — not by name
  // (names change on every WhatsApp deploy, signatures rarely change).

  function buildStore(req) {
    const store = {};

    Object.keys(req.m || {}).forEach(id => {
      let mod;
      try { mod = req(id); } catch (_) { return; }
      if (!mod || typeof mod !== 'object') return;

      // WidFactory — createWid(phone+"@c.us") creates a WhatsApp JID
      if (!store.WidFactory && typeof mod.createWid === 'function') {
        store.WidFactory = mod;
      }

      // Chat collection — find/get chat by JID
      if (!store.Chat && mod.Chat && typeof mod.Chat.find === 'function') {
        store.Chat = mod.Chat;
      }

      // SendTextMsgToChat — direct text send without any DOM
      if (!store.SendTextMsgToChat && typeof mod.sendTextMsgToChat === 'function') {
        store.SendTextMsgToChat = mod.sendTextMsgToChat;
      }

      // Cmd — openChatBottom navigates WhatsApp's React router (no page reload)
      if (!store.Cmd && mod.Cmd && typeof mod.Cmd.openChatBottom === 'function') {
        store.Cmd = mod.Cmd;
      }

      // MediaCollection — processAttachments + sendToChat for media sending
      if (!store.MediaCollection &&
          mod.default && typeof mod.default.prototype?.processAttachments === 'function') {
        store.MediaCollection = mod.default;
      }

      // findOrCreateLatestChat — alternative chat opener
      if (!store.FindChat && typeof mod.findOrCreateLatestChat === 'function') {
        store.FindChat = mod;
      }
    });

    // WidFactory + Chat + SendTextMsgToChat are the minimum required
    if (!store.WidFactory || !store.Chat || !store.SendTextMsgToChat) {
      return null;
    }
    return store;
  }

  // ─── Open Chat ───────────────────────────────────────────────────────────────

  async function openChat(phone) {
    const clean = phone.replace(/\D/g, '');
    const wid   = Store.WidFactory.createWid(clean + '@c.us');

    let chat = Store.Chat.get ? Store.Chat.get(wid) : null;
    if (!chat) chat = await Store.Chat.find(wid);
    if (!chat) throw new Error('Chat not found for number: ' + phone);

    // Navigate WhatsApp's internal React router — zero page reload
    if (Store.Cmd) {
      await Store.Cmd.openChatBottom(chat);
    } else if (Store.FindChat) {
      await Store.FindChat.findOrCreateLatestChat(wid);
    }

    await sleep(1500);
    return chat;
  }

  // ─── Send Text ───────────────────────────────────────────────────────────────

  async function sendText(phone, text) {
    console.log('[Injected] sendText →', phone);
    const chat = await openChat(phone);
    await Store.SendTextMsgToChat(chat, text, {});
    console.log('[Injected] ✅ Text sent to', phone);
    return { success: true };
  }

  // ─── Send Media (DEPRECATED - using DOM approach instead) ────────────────────────────────
  // Previous internal API approach (MediaCollection) is no longer used
  // Replaced with DOM-based attachment clicking (page.js:cmdSendWithMedia)
  // This is more reliable as it survives WhatsApp updates

  async function sendMedia(phone, base64, mimeType, fileName, caption) {
    throw new Error('[Injected] sendMedia() is deprecated. Use DOM-based attachment method instead (page.js:cmdSendWithMedia)');
  }

  // ─── Command Bridge (CustomEvent ↔ content.js) ──────────────────────────────

  window.addEventListener('wa-bulk-sender:inject-cmd', async (event) => {
    const { id, cmd, data } = event.detail;
    let result;

    try {
      if (!storeReady) throw new Error('WhatsApp Store not ready yet');

      switch (cmd) {
        case 'ping':
          result = { success: true, storeKeys: Object.keys(Store) };
          break;
        case 'sendText':
          result = await sendText(data.phone, data.text);
          break;
        case 'sendMedia':
          result = await sendMedia(
            data.phone, data.base64, data.mimeType, data.fileName, data.caption
          );
          break;
        default:
          throw new Error('Unknown command: ' + cmd);
      }
    } catch (e) {
      console.error('[Injected] Command error:', e.message);
      result = { success: false, error: e.message };
    }

    window.dispatchEvent(new CustomEvent('wa-bulk-sender:inject-result', {
      detail: { id, result }
    }));
  });

  // ─── Initialize ─────────────────────────────────────────────────────────────

  waitForWebpack(() => {
    window.dispatchEvent(new CustomEvent('wa-bulk-sender:inject-ready', {
      detail: { storeKeys: Object.keys(Store) }
    }));
    console.log('[Injected] Ready and listening for commands');
  });

})();
