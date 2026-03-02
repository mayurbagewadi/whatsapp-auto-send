# Phase 3-5: Implementation Plan

## Key Discovery

Your codebase is **75% complete** for media sending. The architecture uses WhatsApp's internal API (via injected.js), not DOM clicking like SheetWA.

Most pieces already work:
- ✅ Media selection (popup.js)
- ✅ Media upload (media-manager.js)
- ✅ Media dispatcher (content.js orchestrateSendMessage)
- ✅ Media routing check (content.js line 177)

**Only 1 location needs modification.**

---

## Phase 3: Code Location

### Single Change Required

**File:** `popup.js`
**Lines:** 920-935 (buildQueue function)
**Current:** Queue built WITHOUT media field in items
**Fix:** Add media to each item before sending

---

## Phase 4: Data Flow

### Current Flow (Broken)
```
popup.js sends:
{
  queue: [
    {number: "+1...", message: "Hello"},   // No media
    {number: "+2...", message: "Hi"}       // No media
  ],
  media: {...}  // Single media for queue (never gets to items)
}

background.js receives → sets queue as-is
content.js gets item.media = undefined → sends text only
```

### Fixed Flow
```
popup.js sends:
{
  queue: [
    {number: "+1...", message: "Hello", media: {...}},  // Has media
    {number: "+2...", message: "Hi", media: {...}}      // Has media
  ]
}

background.js receives → passes queue as-is
content.js gets item.media = {...} → sends via injected.js API
```

---

## Phase 5: Specific Code Change

### What to Change

**File:** `popup.js`
**Function:** `startQueue()` (around line 920)

**Current code (lines 920-930):**
```javascript
const queue = [];
for (const number of numbers) {
  queue.push({
    phoneNumber: number,
    message: messageEl.value
  });
}

chrome.runtime.sendMessage({
  action: 'startQueue',
  data: { queue, delaySec, randomize, media: attachedMedia }  // ← media at wrong level
});
```

**Required change:**
```javascript
const queue = [];
for (const number of numbers) {
  queue.push({
    phoneNumber: number,
    message: messageEl.value,
    media: attachedMedia || null  // ← ADD THIS LINE: media at item level
  });
}

chrome.runtime.sendMessage({
  action: 'startQueue',
  data: { queue, delaySec, randomize }  // ← REMOVE media from here
});
```

---

## Why This Works

1. **background.js (line 494):** Already expects `item.media`
   ```javascript
   data: { number: item.number, message: item.message, media: item.media || null }
   ```

2. **content.js (line 173):** Already accepts media param
   ```javascript
   async function orchestrateSendMessage(number, message, media = null) {
     if (media) {
       // Send via injected.js WhatsApp API
       executeInjectCommand('sendMedia', {...})
     } else {
       // Send text only via wa.me + button click
     }
   }
   ```

3. **injected.js:** Handles media encryption and upload to WhatsApp servers

---

## Testing After Change

1. **Text-only:** Send without selecting file → works as before ✅
2. **Media+Text:** Select image/video + enter message → sends both together ✅
3. **Multiple numbers with media:** Queue 5 numbers, attach 1 file → all 5 get media ✅
4. **Console:** No errors in extension console ✅

---

## Result

- No changes to background.js
- No changes to content.js
- No changes to injected.js
- No changes to manifest.json
- No changes to media-manager.js

**Single, minimal change** to popup.js queue building logic.

