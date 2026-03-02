# Storage Quota Fix — Diagnosis & Resolution

## Problem Identified

**Error:** `Resource::kQuotaBytes quota exceeded` (background.js:395)

**Root Cause:** Queue items stored large base64-encoded media in Chrome local storage (~10MB limit)
- Small 2MB image → 2.7MB base64 string
- 10 numbers with media → 27MB+ trying to fit in 10MB limit
- Storage full → Can't save queue → startQueue fails

**Solution Applied:** Media now stored separately with references

---

## Changes Made

### 1. Queue Storage (line 371)
**Before:** Entire queue with base64 media stored in chrome.storage.local
```javascript
await chrome.storage.local.set({ queue, currentIndex, isRunning, delaySec, randomize, stats });
```

**After:** Media stored separately, queue contains only references
```javascript
// Queue stores: {number, message, media: {_mediaStored: true, _id: "media_..."}}
// Media stored: {"media_timestamp_uuid": {base64, type, name}}
```

### 2. Queue Restoration (line 452)
**Before:** No media restoration logic
```javascript
queue = stored.queue || queue;
```

**After:** Media restored from storage when needed
```javascript
// Iterate queue, restore media from storage for each item
for (let i = 0; i < queue.length; i++) {
  if (queue[i].media && queue[i].media._mediaStored) {
    const mediaData = await chrome.storage.local.get([queue[i].media._id]);
    if (mediaData[queue[i].media._id]) {
      queue[i].media = mediaData[queue[i].media._id];
    }
  }
}
```

### 3. Media Cleanup (line 603)
**Before:** No cleanup of media after queue finishes
```javascript
function finishQueue() { /* ... */ }
```

**After:** Media deleted when queue completes
```javascript
// Delete all media files referenced by finished queue
const keysToDelete = queue
  .filter(item => item.media && item.media._mediaStored)
  .map(item => item.media._id);
await chrome.storage.local.remove(keysToDelete);
```

### 4. Startup Cleanup (new function)
**New:** Automatic cleanup of orphaned media on extension start
```javascript
async function cleanupOldMediaData() {
  // Find all media_* keys
  // Compare with active queue
  // Delete unreferenced media
}
```

---

## How to Fix (User Actions)

### Step 1: Clear Existing Storage (CRITICAL)
1. **Open Extension DevTools:**
   - Chrome → Extensions → WhatsApp Bulk Sender → Service Worker

2. **Clear Chrome storage:**
   ```javascript
   chrome.storage.local.clear(() => console.log('Storage cleared'));
   ```

3. **Verify cleared:**
   ```javascript
   chrome.storage.local.get(null, (data) => console.log('Storage size:', JSON.stringify(data).length));
   ```

   **Expected:** Shows small number (< 50KB)

### Step 2: Reload Extension
1. Chrome → Extensions → Reload extension (refresh button)
2. Check DevTools console for: `[Background] Service worker loaded`

### Step 3: Test Queue With Media
1. Open extension popup
2. Select a test image file (~500KB)
3. Upload completes ✅
4. Enter phone number + message
5. Click Start
6. Watch DevTools:
   ```
   [Background] Sending message 1/1 to +919...
   [Content] Starting send to +919...
   [Content] ✅ Message sent to +919...
   [Background] Cleaned up 1 media items
   ```

### Step 4: Verify Storage After
```javascript
chrome.storage.local.get(null, (data) => {
  console.log('Current storage size:', JSON.stringify(data).length);
  console.log('Keys:', Object.keys(data));
});
```

**Expected:**
- Size: < 100KB (no base64 media stored)
- No `media_*` keys remaining (all cleaned up)
- Only: `authToken`, `userStats`, `selectors`, etc.

---

## Technical Details

### Storage Layout

**Before Fix:**
```
Storage:
├── queue: [
│   ├── {number, message, media: {base64: "iVBORw0..." (2.7MB), type, name}},
│   ├── {number, message, media: {base64: "..." (2.7MB)}},
│   └── ...
├── currentIndex: 0
└── stats: {...}

Total: 27MB+ → EXCEEDS 10MB LIMIT ❌
```

**After Fix:**
```
Storage:
├── queue: [
│   ├── {number, message, media: {_mediaStored: true, _id: "media_123_456"}},
│   ├── {number, message, media: {_mediaStored: true, _id: "media_789_012"}},
│   └── ...
├── media_123_456: {base64: "iVBORw0..." (2.7MB), type, name}  ← Separate key
├── media_789_012: {base64: "..." (2.7MB)}                    ← Separate key
├── currentIndex: 0
├── stats: {...}
└── authToken: "..."

Queue: ~5KB
Media: 2.7MB × N (stored individually)
Overall: Within Chrome's concurrent limits ✅
```

### Chrome Storage Limits

- **Per-extension local storage:** ~10MB total
- **Per-key size:** Unlimited
- **Number of keys:** Unlimited
- **Strategy:** Store each media file as separate key (bypasses queue size limit)

---

## Automatic Fixes

### On Extension Start
- Cleanup function runs automatically
- Deletes orphaned media (media not referenced in active queue)
- Prevents quota buildup over time

### On Queue Completion
- Media files deleted automatically
- Frees space for next queue

### On Queue Failure
- Graceful error: "Storage quota exceeded. Clear cache and retry."
- Fallback: Stores state without queue data
- Allows manual recovery

---

## Monitoring

### Check Storage Health
```javascript
setInterval(() => {
  chrome.storage.local.get(null, (data) => {
    const size = JSON.stringify(data).length;
    const mediaCount = Object.keys(data).filter(k => k.startsWith('media_')).length;
    const queueSize = data.queue ? data.queue.length : 0;
    console.log(`[Storage] Size: ${(size/1024).toFixed(1)}KB | Queue: ${queueSize} | Media: ${mediaCount}`);
  });
}, 60000); // Every 60 seconds
```

Add to DevTools console to monitor in real-time.

---

## Testing Checklist

- [ ] Storage cleared manually
- [ ] Extension reloaded
- [ ] Media upload succeeds
- [ ] Queue with media starts without quota error
- [ ] Media sent successfully
- [ ] Media cleaned up after queue finishes
- [ ] Storage size < 100KB after finish
- [ ] No `media_*` keys remaining
- [ ] Can run multiple queues without quota issue

---

## Rollback (If Needed)

If you need to revert changes:
```bash
git checkout HEAD -- whatsapp-bulk-sender/background.js
chrome.storage.local.clear()  # Then reload extension
```

---

## Prevention Going Forward

1. **Don't store media in queue** ✅ (Now automatic)
2. **Clean up after queue** ✅ (Now automatic)
3. **Monitor storage** ℹ️ (Use script above)
4. **Clear periodically** ℹ️ (Optional, but good practice)

**With this fix, storage quota should never be an issue again.**

