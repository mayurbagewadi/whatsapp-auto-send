# Media Sending Debugging Guide

## Current Architecture

Your extension has **2 layers** for media sending:

1. **Primary:** `injected.js` + WhatsApp Internal API (MediaCollection)
2. **Fallback:** `media-fallback.js` (DOM-based, SheetWA style) — created as backup

---

## Why Media Might Not Be Working

### Issue 1: MediaCollection Module Not Found

**Symptom:** Console shows `"MediaCollection not available in Store"`

**Cause:** injected.js line 135-137 looks for `mod.default.prototype?.processAttachments`
- WhatsApp changes module structure every 2-4 weeks
- Module signature may have changed

**Test:**
1. Open `https://web.whatsapp.com`
2. Open DevTools → Console
3. Run:
   ```javascript
   window.WaBulkSenderStore
   ```
4. Look for `MediaCollection` in output:
   - If present: ✅ Module found, issue is elsewhere
   - If `null`: ❌ Module not found, module detection needs update

**Fix:**
- Update module detection signatures in `injected.js` lines 134-138
- OR use fallback approach (see below)

### Issue 2: processAttachments() API Changed

**Symptom:** `MediaCollection found but send fails silently`

**Cause:** WhatsApp's internal API methods changed

**Test:**
1. In DevTools Console:
   ```javascript
   const mc = window.WaBulkSenderStore.MediaCollection
   console.log(Object.getOwnPropertyNames(mc.prototype))
   ```
2. Look for `processAttachments` method
3. Check if signature matches line 206:
   ```javascript
   await mc.processAttachments([{ file }, 1], 1, chat);
   ```

---

## Using the Fallback Approach

Created: `media-fallback.js` — DOM-based media sending (SheetWA style)

### Integration Option A: Modify Content.js (Recommended)

**File:** `content.js`
**Location:** In `orchestrateSendMessage()` function, wrap media send in try-catch

```javascript
// Around line 177-194, replace with:
if (media) {
  try {
    // Try primary approach (injected.js API)
    const sendResult = await executeInjectCommand('sendMedia', {
      phone:    number,
      base64:   media.base64,
      mimeType: media.type,
      fileName: media.name,
      caption:  message
    }, 60000);

    if (!sendResult.success) {
      throw new Error('API send failed: ' + sendResult.error);
    }
  } catch (apiError) {
    console.warn('[Content] Primary API failed, trying DOM fallback...', apiError.message);

    // Fall back to DOM approach
    try {
      const fallbackResult = await executeCommand('sendMediaDOM', {
        base64: media.base64,
        mimeType: media.type,
        fileName: media.name,
        caption: message
      }, 60000);

      if (!fallbackResult.success) {
        throw new Error('Fallback send failed: ' + fallbackResult.error);
      }
    } catch (fallbackError) {
      throw new Error('Both API and DOM approaches failed: ' + fallbackError.message);
    }
  }
}
```

### Integration Option B: Use Without Code Changes

**If you don't want to modify content.js:**

1. **Test the fallback separately:**
   ```javascript
   // In DevTools Console on WhatsApp Web:

   // Load fallback
   const script = document.createElement('script');
   script.src = chrome.runtime.getURL('media-fallback.js');
   document.head.appendChild(script);

   // Wait for load
   await new Promise(r => setTimeout(r, 2000));

   // Test media send
   const base64 = '...'; // Your base64 file
   await window.sendMediaViaDOM(
     {
       attachmentBtn: '[aria-label="Attach"]',
       messageInput: '[contenteditable="true"][data-tab="6"]',
       sendBtn: '[data-testid="send"]'
     },
     base64,
     'image/jpeg',
     'test.jpg',
     'Hello with media'
   );
   ```

---

## Debugging Checklist

- [ ] **Verify file upload works** - Check mediaManager.uploadMedia() succeeds
- [ ] **Verify media stored in popup** - Click media button, select file, see preview
- [ ] **Verify queue structure** - Open DevTools on popup, run: `console.log(window.attachedMedia)`
- [ ] **Verify WhatsApp ready** - Check DevTools: `console.log(window.WaBulkSenderStore)`
- [ ] **Verify MediaCollection available** - Run: `window.WaBulkSenderStore.MediaCollection`
- [ ] **Test DOM selectors** - Verify attachment button/input/send button exist:
  ```javascript
  document.querySelector('[aria-label="Attach"]')
  document.querySelector('[contenteditable="true"][data-tab="6"]')
  document.querySelector('[data-testid="send"]')
  ```

---

## Quick Fix: Enable Fallback in Content.js

**One-line fix** (if MediaCollection is the issue):

In `content.js` line 189, change:
```javascript
if (!injectReady) {
```

To:
```javascript
if (!injectReady || !window.WaBulkSenderStore?.MediaCollection) {
```

This will skip to DOM fallback if MediaCollection not available.

Then add fallback handler to page.js before page.js ends:

```javascript
// Add at end of page.js
async function sendMediaViaDOM(data) {
  // Dynamically load and use media-fallback.js
  return await window.sendMediaViaDOM(
    selectors, // Your current selectors
    data.base64,
    data.mimeType,
    data.fileName,
    data.caption
  );
}
```

---

## Testing Sequence

1. **Test Text Only:** Send message without media → should work as before
2. **Test Media Upload:** Click media button, select file → should upload and show preview
3. **Test Media Send:** After upload, click Start → should send media
4. **Check Logs:** Open extension DevTools → Console tab → look for:
   - `[Injected] sendMedia →` = API approach tried
   - `[MediaFallback]` = Fallback approach tried
   - `✅` = Success

---

## Files Modified

- **Created:** `media-fallback.js` — New SheetWA-style fallback
- **To Modify (if needed):** `content.js` — Add try-catch for fallback
- **To Modify (if needed):** `manifest.json` — Add media-fallback.js if using Option A

---

## Key Insight

Your injected.js approach is **more advanced** than SheetWA (using WhatsApp's internal API instead of DOM clicking). If it's not working, it's likely a module detection issue, not an architecture problem.

The fallback exists as a safety net, not a replacement.

