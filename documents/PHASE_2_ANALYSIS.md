# Phase 2: Integration Points Analysis

## Answer 1: Where does media get selected?

**Status:** ✅ Already implemented

**Files:** `popup.js`

**Flow:**
- Line 61: User clicks `mediaButton` → `handleMediaButtonClick()`
- Line 92: Opens file picker (`mediaInput.click()`)
- Line 100: File selected → `handleMediaFileSelect()` receives file
- Line 107: `mediaManager.uploadMedia(file)` uploads to Supabase Storage
- Line 112-121: Returns mediaId, fileName, fileSize, type
- Line 125: Stores in `attachedMedia` variable (global)
- Line 401-410: Displays in UI

**Current State:** Media file selected, uploaded, stored as `attachedMedia`

---

## Answer 2: How does background.js queue messages?

**Status:** ⚠️ Partially implemented — media not added to queue items

**Files:** `background.js`, `popup.js`

**Problem:**
When user clicks "Start", popup.js sends (line 930):
```javascript
data: {
  queue: [{number, message}, {number, message}, ...],  // No media field per item
  delaySec: 10,
  randomize: true,
  media: attachedMedia  // Single media for ALL items ← WRONG
}
```

**Why it's wrong:**
- Line 363 in background.js: `queue = queueData` — accepts queue as-is
- Line 494: `data: { number: item.number, message: item.message, media: item.media || null }`
- Expects each queue **item** to have `.media`, not queue itself

**Required Fix:**
Queue structure should be:
```javascript
{
  phoneNumber: "+1234567890",
  message: "Hello",
  media: {
    base64: "...",
    type: "image/jpeg",
    name: "photo.jpg"
  }
}
```

Currently: `attachedMedia` applies to ALL numbers (all messages get same media)
Should be: Each number can have its own media OR media shared across all

---

## Answer 3: How does page.js dispatch commands?

**Status:** ⚠️ Partially implemented — using content.js instead

**Files:** `content.js` (main dispatcher)

**Actual Flow:**
NOT in page.js — dispatcher is in `content.js`

**Line 173-252: `orchestrateSendMessage(number, message, media = null)`**

This is the main dispatcher:

1. **Media Path (line 177-194):**
   - Checks `if (media)`
   - Calls `executeInjectCommand('sendMedia', {...})`
   - Uses WhatsApp internal API (via injected.js) — NOT DOM clicking
   - Sends base64, mimeType, fileName, caption in one call
   - **Advanced approach:** No DOM selectors needed

2. **Text Path (line 199-231):**
   - Checks `else` (no media)
   - Calls `openChatViaWaMe(number, message)` — wa.me pre-fill
   - Calls `executeCommand('findSendBtn', {})` — waits for button
   - Calls `executeCommand('clickSendButton', {})` — clicks and polls

3. **Routing Rule (line 265-269):**
   ```javascript
   if (request.action === 'sendMessage') {
     const { number, message, media } = request.data;
     orchestrateSendMessage(number, message, media)
   }
   ```

**Status:** ✅ Routing logic already exists and checks media

---

## Answer 4: Is cmdSendWithMedia() complete?

**Status:** ❌ Not in page.js — logic moved to content.js/injected.js

**What's actually happening:**

The extension uses a **hybrid approach**, not the DOM-clicking SheetWA style:

1. **Text messages:** wa.me + DOM button click (lines 199-231 in content.js)
2. **Media messages:** WhatsApp internal API via injected.js (lines 177-194 in content.js)

The `executeInjectCommand('sendMedia', {...})` call on line 187:
- Converts base64 to binary
- Calls WhatsApp's internal MediaCollection API
- Handles encryption and upload
- Sends media + caption together
- Returns success/error

**This is more advanced than SheetWA** (which uses DOM clicking + attachment button).

---

## Summary: What's Missing?

| Component | Status | Issue |
|-----------|--------|-------|
| Media selection (popup.js) | ✅ Complete | File picker, upload, storage all working |
| Queue structure | ⚠️ 50% | Needs `media` field added to each queue item |
| Media routing (content.js) | ✅ Complete | Already routes based on media presence |
| Media dispatcher (orchestrateSendMessage) | ✅ Complete | Already sends via injected.js API |
| UI for per-item media | ❌ Missing | Currently: one media for all numbers |

---

## Integration Gap Identified

**Problem:** Popup sends single `media: attachedMedia` for entire queue, but background.js expects `item.media` per queue item.

**Solution Options:**

### Option A: Apply media to all numbers (Simple)
- Attach same media file to every number in queue
- Change: Line 930 in popup.js → add media to each queue item before sending

### Option B: Support per-number media selection (Complex)
- UI would need to support selecting different media for different numbers
- Major UI change required
- Not in MEDIA_IMPLEMENTATION_PLAN scope

**Recommendation:** Option A (simple) — attach selected media to all numbers in current batch

---

## Integration Points to Modify

**Only 1 location needs change:**

1. **popup.js, line 924-930 (buildQueue):**
   - Add `media: attachedMedia` to each queue item before sending to background
   - Currently: Single media at queue level
   - Should be: Media copied to each item

**No changes needed elsewhere:**
- background.js — already passes `item.media` correctly
- content.js — already checks and dispatches media correctly
- manifest.json — injection already correct

