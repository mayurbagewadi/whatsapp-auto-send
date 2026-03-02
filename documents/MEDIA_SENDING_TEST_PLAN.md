# Media Sending Test & Verification Plan

## Test Environment Setup

1. **Open WhatsApp Web**: `https://web.whatsapp.com`
2. **Ensure you're logged in** — See chat list, not QR code
3. **Open Extension DevTools**:
   - Chrome → Extensions → WhatsApp Bulk Sender → Service Worker
   - This shows logs from background.js, content.js, injected.js
4. **Open Page DevTools** (on web.whatsapp.com page itself):
   - Shows logs from page.js and your test code

---

## Test 1: Verify Queue Structure

**Goal:** Confirm media is included in queue items

**Steps:**
1. Open extension popup
2. Enter phone numbers
3. Enter message text
4. **Click media button** → Select image file → Confirm upload completes
5. **Before clicking Start**, open extension DevTools → Console
6. Paste:
   ```javascript
   chrome.runtime.sendMessage(
     { action: 'getQueueData' },
     (response) => console.log('Queue:', response)
   );
   ```

**Expected Output:**
```javascript
{
  queue: [
    {
      number: "+1234567890",
      message: "Hello",
      media: {
        base64: "iVBORw0KGgo...",
        type: "image/jpeg",
        name: "photo.jpg"
      }
    }
  ]
}
```

**If media field is missing:** Queue building issue (popup.js)
**If media field is null:** File upload issue (media-manager.js)
**If media field is present:** ✅ Queue structure is correct

---

## Test 2: Verify WhatsApp Store Ready

**Goal:** Check if injected.js can access WhatsApp internal APIs

**Steps:**
1. On `web.whatsapp.com`, open page DevTools → Console
2. Paste:
   ```javascript
   console.log('Store available:', !!window.WaBulkSenderStore);
   if (window.WaBulkSenderStore) {
     console.log('Store contents:', {
       WidFactory: !!window.WaBulkSenderStore.WidFactory,
       Chat: !!window.WaBulkSenderStore.Chat,
       SendTextMsgToChat: !!window.WaBulkSenderStore.SendTextMsgToChat,
       MediaCollection: !!window.WaBulkSenderStore.MediaCollection,
       Cmd: !!window.WaBulkSenderStore.Cmd
     });
   }
   ```

**Expected Output:**
```javascript
Store available: true
Store contents: {
  WidFactory: true,
  Chat: true,
  SendTextMsgToChat: true,
  MediaCollection: true,
  Cmd: true
}
```

**MediaCollection: false** = ⚠️ **Critical Issue** — API won't work
**MediaCollection: true** = ✅ API should work

---

## Test 3: Verify Content.js Routing

**Goal:** Confirm content.js correctly detects and routes media

**Steps:**
1. On extension DevTools → Console, paste:
   ```javascript
   chrome.tabs.query({url: "*://web.whatsapp.com/*"}, (tabs) => {
     if (tabs[0]) {
       chrome.tabs.sendMessage(tabs[0].id, {
         action: 'debugMedia',
         data: {
           testPhone: "1234567890",
           testMessage: "Test message",
           testMedia: {
             base64: "iVBORw0KGgo...", // Any base64 image
             type: "image/jpeg",
             name: "test.jpg"
           }
         }
       });
     }
   });
   ```

2. Check page DevTools console for logs from content.js:
   ```
   [Content] Starting send to 1234567890 (with media)
   [Content] Step 1: Sending media via WhatsApp internal API...
   ```

**Success indicators:**
- `[Injected] sendMedia →` appears
- No errors about MediaCollection
- Either success or specific error message

---

## Test 4: Single Message Send (Text Only)

**Baseline test — ensure existing functionality works**

**Steps:**
1. Clear any previous selections
2. Enter 1 phone number
3. Enter message (no media)
4. Click Start
5. Watch extension DevTools

**Expected logs:**
```
[Background] Sending message 1/1 to +1234567890
[Content] Starting send to +1234567890
[Content] Step 1: Waiting for send button...
[Content] ✅ Page ready - send button found
[Content] Step 2: Clicking send button...
[Content] ✅ Message sent to +1234567890
```

**If this works:** Text sending is functioning ✅
**If this fails:** Your existing system is broken (unrelated to media)

---

## Test 5: Single Message Send (With Media)

**Target test — does media actually send?**

**Steps:**
1. Open extension popup
2. Enter 1 test phone number
3. Enter message text
4. Click media button → Select test image
5. Confirm upload succeeds
6. Click Start
7. Watch extension DevTools

**Expected logs (if MediaCollection available):**
```
[Background] Sending message 1/1 to +1234567890
[Content] Starting send to +1234567890 (with media)
[Content] Step 1: Sending media via WhatsApp internal API...
[Injected] sendMedia → 1234567890 test.jpg image/jpeg
[Injected] ✅ Media sent to 1234567890
[Content] ✅ Message sent to +1234567890
```

**Expected logs (if MediaCollection NOT available):**
```
[Injected] sendMedia → ...
[Injected] ❌ Error: MediaCollection not available in Store
[Content] ❌ Failed to send to +1234567890: Media send failed...
```

**Outcome:**
- ✅ Media sent: System is working
- ❌ MediaCollection not found: Use Fallback Solution (below)
- ❌ Other error: Check console for specific message

---

## Fallback Solution (If Test 5 Fails)

### Option A: Enable Fallback Without Code Changes

**Test fallback manually:**
1. Page DevTools Console on WhatsApp Web:
   ```javascript
   // Load fallback
   const script = document.createElement('script');
   script.src = chrome.runtime.getURL('media-fallback.js');
   document.head.appendChild(script);

   await new Promise(r => setTimeout(r, 2000));

   // Test sending
   await window.sendMediaViaDOM(
     {
       attachmentBtn: '[aria-label="Attach"]',
       messageInput: '[contenteditable="true"][data-tab="6"]',
       sendBtn: '[data-testid="send"]'
     },
     'iVBORw0KGgo...', // base64
     'image/jpeg',
     'test.jpg',
     'Message with fallback'
   );
   ```

2. Check if fallback succeeds:
   ```
   [MediaFallback] Starting DOM-based media send: test.jpg
   [MediaFallback] ✅ Message confirmed sent
   ```

If fallback works: Can integrate for automatic use

### Option B: Update Module Detection (If Needed)

If MediaCollection is truly not being found:
1. In `injected.js` lines 134-138, update the detection signature:
   ```javascript
   // Current (may be outdated):
   if (!store.MediaCollection &&
       mod.default && typeof mod.default.prototype?.processAttachments === 'function') {
     store.MediaCollection = mod.default;
   }

   // Alternative signatures to try:
   if (!store.MediaCollection && mod.MediaCollection) {
     store.MediaCollection = mod.MediaCollection;
   }

   if (!store.MediaCollection && mod.sendMediaMessage && typeof mod.sendMediaMessage === 'function') {
     store.MediaCollection = mod;
   }
   ```

---

## Results Matrix

| Test | Result | Action |
|------|--------|--------|
| Queue Structure | Media present | ✅ Continue |
| Queue Structure | Media missing | 🔧 Fix popup.js queue building |
| Store Ready | MediaCollection: true | ✅ Continue to Test 5 |
| Store Ready | MediaCollection: false | 🔧 Use Fallback Solution |
| Text Send | Works | ✅ System functioning |
| Text Send | Fails | ⚠️ Fix base system first |
| Media Send | Works | ✅ **Done — Feature complete** |
| Media Send | API fails | 🔧 Enable fallback in content.js |
| Fallback Test | Works | ✅ Use as backup |
| Fallback Test | Fails | 🔧 Update DOM selectors |

---

## Next Steps Based on Results

### ✅ If Tests 1-5 All Pass
- **Status:** Media sending is working
- **Action:** Production ready

### ⚠️ If Test 2 Shows MediaCollection: false
- **Status:** Module detection issue
- **Action:** Use fallback (see Option A above)
- **Or:** Update module signatures (see Option B above)

### ⚠️ If Fallback Works But API Doesn't
- **Status:** Hybrid approach viable
- **Action:** Modify content.js to auto-fallback when API fails

### ❌ If All Tests Fail
- **Status:** Need deeper investigation
- **Action:** Check WhatsApp version, module structures, browser version

