# Media + Text Not Sending Together - Analysis

## Problem

When sending media with text:
- **Only media sent** ❌
- **Text appears in message box** but NOT in WhatsApp message
- **File picker opens** (shouldn't happen)
- **SheetWA/WaSender don't have this problem** ✅

---

## Root Cause

**Current (Broken) Approach:**

```
Step 1: Click attachment button (NO TEXT YET)
Step 2: Select media type (Photos/Documents)
Step 3: Inject file
Step 4: Wait for preview (3.5 seconds)
Step 5: Try to type caption using document.execCommand()  ← PROBLEM HERE
Step 6: Click send
Result: Text not sent with media ❌
```

**Why It Fails:**

1. **Wrong input field** - Code tries to type in "caption input" (separate field that appears after media selection)
2. **Wrong timing** - Text is added AFTER media, not BEFORE
3. **Deprecated method** - `document.execCommand('insertText')` is unreliable
4. **Wrong flow** - Caption is optional/separate in WhatsApp, not same as main message text
5. **File picker issue** - No text pre-fill, so wa.me isn't used

---

## How SheetWA Does It (CORRECT)

```
Step 1: Use wa.me to open chat with TEXT PRE-FILLED in main input
        https://wa.me/919527773102?text=Hello%20World

Step 2: Chat opens → main input field already has "Hello World"

Step 3: Click attachment button (text STILL in main input)

Step 4: Select media type (Photos/Documents)

Step 5: Inject file into file input

Step 6: Wait for preview

Step 7: Click send button
        ↓
        WhatsApp sends BOTH text + media together
        ↓
Result: Text AND media sent ✅
```

**Key insight:** Text must be in MAIN INPUT FIELD BEFORE attachment is added.

---

## Technical Comparison

### Current Code (Broken)

**content.js:**
```javascript
if (media) {
  // Sends media
  await executeCommand('sendWithMedia', {
    base64: media.base64,
    type: media.type,
    name: media.name,
    caption: message  // ← Text passed as "caption"
  });
}
```

**page.js:**
```javascript
// Step 6: Type caption
const captionInput = document.querySelector(CAPTION_INPUT_SELECTOR)
  || document.querySelector('[contenteditable="true"]');

if (captionInput) {
  captionInput.focus();
  document.execCommand('insertText', false, caption);  // ← DEPRECATED & WRONG
}
```

**Problem:** Typing in caption field ≠ typing in main message field

---

### SheetWA's Code (Correct)

```javascript
// Step 1: Open chat with text PRE-FILLED
const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
link.click();

// Chat opens → text already in input field ✓

// Step 2: Click attachment
// Step 3: Inject file
// Step 4: Send
```

**Result:** Main input has message, file attached, both sent together

---

## Why File Picker Opens

Current code at **page.js line 174**:
```javascript
const menuItems = Array.from(document.querySelectorAll(ATTACHMENT_MENU_SELECTOR));
const targetItem = isMedia
  ? menuItems.find(i => /photo|video|image|media/i.test(i.textContent))
  : menuItems.find(i => /doc|file|pdf/i.test(i.textContent));

const menuItem = targetItem || menuItems[0];
```

**This fails because:**
- Menu items text doesn't match regex
- Falls back to `menuItems[0]`
- First menu item might be "Select from device" or file browser
- **Opens file picker instead of photos** ❌

---

## Selectors Issue

From Supabase:
```
SELECTOR_CAPTION_INPUT: "[aria-label=\"Add a caption\"]"
SELECTOR_CHAT_INPUT: "[contenteditable=\"true\"]"
```

**Current code tries these in order:**
1. Caption input (only appears AFTER media selected)
2. Tab=10, Tab=6 inputs (fallbacks, unreliable)
3. Chat input (main message field)

**Problem:** Caption input is the WRONG field to type in!

**What should happen:**
- For text-only: use CHAT_INPUT_SELECTOR
- For media: Pre-fill CHAT_INPUT_SELECTOR BEFORE attaching media
- Never use caption input (that's optional metadata)

---

## Flow Comparison

### ❌ Current (Broken)

```
NO TEXT PRE-FILL
     ↓
Click attachment → File picker (wrong menu item)
     ↓
Select file
     ↓
Try to type caption (wrong field, deprecated method)
     ↓
Send
     ↓
Result: Only media, text lost
```

### ✅ SheetWA (Correct)

```
wa.me PRE-FILLS text in main input
     ↓
Click attachment → Correct menu (Photos/Documents)
     ↓
Select file
     ↓
Text already in main input (no caption field needed)
     ↓
Send
     ↓
Result: Media + text sent together
```

---

## Why SheetWA/WaSender Don't Have This Problem

**Both use same wa.me pre-fill approach:**

1. **Text is in MAIN input before media is added**
2. **Media selection/injection doesn't disturb main input**
3. **Send button sends everything together**
4. **No caption field manipulation needed**

**It's simpler and more reliable.**

---

## Solution Required

**Change flow from:**
```
Click attachment → Inject file → Type caption → Send
```

**To:**
```
wa.me pre-fills text → Click attachment → Inject file → Send
```

This requires:
1. ✅ Text pre-filled via wa.me (already done in text-only flow)
2. ✅ But media flow opens attachment WITHOUT pre-filling text
3. ❌ Then tries to add text via caption (unreliable)

**Fix:** Make media flow use same wa.me pre-fill + attachment as text flow.

---

## Evidence from Console

User reported:
- "txt past in message box but not sending" = text visible but not sent
- "in my personal folder is getting open" = wrong menu item clicked
- "sheet dont do like this" = SheetWA pre-fills text correctly

**This confirms:** Issue is caption not being sent, and wrong file picker menu item.

