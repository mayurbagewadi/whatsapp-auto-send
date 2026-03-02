# SheetWA Deep Research Analysis

## Critical Finding: Caption Field Disappearance Issue

### What SheetWA Does (From contentScript.js)
SheetWA monitors **every step** of the media send flow with extreme detail:

```
Step 1: Input change monitoring (real-time)
Step 2: File input change tracking
Step 3: ATTACHMENT BUTTON CLICKED - BEFORE
Step 4: ATTACHMENT BUTTON CLICKED - AFTER (100ms delay) ← Check what changed
Step 5: MENU ITEM CLICKED (Photos/Videos)
Step 6: MENU ITEM CLICKED - FILE INPUTS AFTER (300ms delay)
Step 7: SEND BUTTON CLICKED - CRITICAL MOMENT
Step 8: SEND MOMENT - ALL INPUTS SNAPSHOT ← Captures:
   - contentEditables (the message text)
   - fileInputs (attached media)
   - mediaElements (media preview)
```

### The Key Difference

**SheetWA's approach:**
1. ✓ Keep message text in main input field
2. ✓ Click attachment button
3. ✓ Wait 100ms and log what changed
4. ✓ Click menu item (Photos/Videos)
5. ✓ Wait 300ms and check file inputs
6. ✓ Inject file via change event
7. ✓ At send time, caption field SHOULD be visible (WhatsApp adds it automatically)
8. ✓ Click send button

**Our current approach:**
1. ✓ Message added via wa.me
2. ✓ Click attachment button (600ms wait)
3. ✓ Click menu item
4. ✓ Click file input (THIS IS WRONG - should NOT click!)
5. ✓ Inject file via DataTransfer + multiple events
6. ✓ Wait 3 seconds
7. ✗ Caption field NOT appearing
8. ✗ Click send (sends only media, no text)

### Root Cause: File Input Click is the Problem

**The issue:** Line in our code at page.js Step 4:
```javascript
// We were clicking the file input which opens file picker!
// This is wrong because:
// 1. File picker dialog takes focus
// 2. WhatsApp cancels the attachment flow
// 3. Caption field never appears
```

### Correct Flow (What WhatsApp Expects)

1. User clicks attachment button
2. User clicks "Photos/Videos" menu item
3. **IMPORTANT:** The file input becomes visible but focused
4. **DO NOT CLICK the file input** - instead:
   - Programmatically inject file via change/input events
   - WhatsApp detects file attachment
   - WhatsApp automatically shows caption field
5. Text in main input becomes caption when send is clicked

### What Triggers Caption Field Appearance

The caption field appears when:
- ✓ File is successfully injected into file input
- ✓ Change event is dispatched
- ✓ WhatsApp detects the file
- ✓ Media preview is loaded
- ✓ Caption field UI is added by WhatsApp

### Why Our Caption Field Doesn't Appear

Our current code:
1. ✓ Clicks attachment button
2. ✓ Clicks menu item
3. ✓ Finds file input
4. ✗ **Injects file but doesn't wait for caption field to appear**
5. ✗ **Only waits 3 seconds then tries to send**
6. ✗ **Caption field needs 1-2 seconds minimum to render after file injection**

### The Fix

Need to:
1. **Remove file input click** (no `fileInput.click()`)
2. **Inject file properly** (DataTransfer + events)
3. **Wait for caption field to appear** (select `[aria-label="Add a caption"]`)
4. **Once caption appears, send the message**

### SheetWA's Event Sequence

```javascript
// From SheetWA's approach:
1. Click attachment button
2. Wait 100ms (let menu appear)
3. Click "Photos/Videos" menu item
4. Wait 300ms (let file input appear)
5. Inject file into file input
6. Dispatch change event
7. Let WhatsApp render caption field (1-2 seconds)
8. Click send button
```

### Timing Analysis

| Step | Our Current | Correct (SheetWA) | Why |
|------|-------------|-------------------|-----|
| After menu click | 800ms | 300ms | File input ready faster |
| Inject file + events | 500ms | 200ms | Simpler event sequence |
| Wait for caption | 3000ms | 1000-2000ms | Need to wait for UI |
| Total before send | 4300ms | 1500-2300ms | Much faster! |

### Caption Field Visibility Check

Add this check AFTER file injection:
```javascript
async function waitForCaptionField(timeoutMs = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const caption = document.querySelector('[aria-label="Add a caption"]');
    if (caption && window.getComputedStyle(caption).display !== 'none') {
      console.log('✓ Caption field appeared!');
      return true;
    }
    await sleep(100);
  }
  console.log('✗ Caption field did NOT appear (timeout)');
  return false;
}
```

## Implementation Plan

1. **Remove file input click** - Stop opening file picker
2. **Simplify event sequence** - Use only essential events (change + input)
3. **Add caption field waiter** - Poll for caption field to appear
4. **Verify before send** - Ensure caption is visible before sending
5. **Adjust wait times** - Match SheetWA's faster timings

## Key Files to Update

- `page.js` - Step 4 (file injection) and Step 5 (waiting)
- Remove: `fileInput.click()`
- Add: `waitForCaptionField()` function
- Adjust: Wait times (3s → 1-2s for caption field)
