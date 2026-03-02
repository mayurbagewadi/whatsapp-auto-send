# Media Sending Implementation Plan
## Production-Level Action Items

---

## PHASE 1: UNDERSTAND CURRENT FLOW (Read Only)

### Files to Read (in order)
1. **popup.js** - How messages get queued
   - Where user clicks "Send"
   - How queue is built
   - Where media picker should attach

2. **content.js** - How messages reach page.js
   - IPC mechanism
   - Message structure
   - Event passing

3. **manifest.json** - Content script injection points
   - What runs where

---

## PHASE 2: IDENTIFY INTEGRATION POINTS (Analysis Only)

### Question 1: Where does media get selected?
- Is there already a file input in popup.js?
- Where should mediaAttachment field be added?
- Current structure: `{phoneNumber, message, delay}`

### Question 2: How does background.js queue messages?
- Find the function that builds queue items
- Find where queue is processed
- Add media check point here

### Question 3: How does page.js dispatch commands?
- Find the dispatcher function
- Add media conditional here
- Call cmdSendWithMedia() if media exists

### Question 4: cmdSendWithMedia() completion
- Read from line 200 onwards
- What's the incomplete part?
- What needs to be added?

---

## PHASE 3: DEFINE ADDITIONS (No Code Yet)

### New Code Locations (Don't Touch Existing)

**popup.js - ADD NEW**
```
Location: Somewhere in popup.js
Purpose: Handle file selection + add to queue
What to add: mediaAttachment field when file selected
Don't touch: Current message input/send logic
```

**background.js - ADD NEW CONDITION**
```
Location: Message queuing function
Purpose: Check if message has media, route accordingly
What to add: IF mediaAttachment THEN {...} ELSE {...}
Don't touch: Current queue structure or storage
```

**page.js - ADD NEW ROUTER**
```
Location: Message sending dispatcher
Purpose: Route to correct send function
What to add: IF media THEN cmdSendWithMedia() ELSE cmdClickSendButton()
Don't touch: Current cmdClickSendButton() implementation
```

**page.js - COMPLETE FUNCTION**
```
Location: cmdSendWithMedia() after line 200
Purpose: Finish the media send sequence
What to add:
  - Wait for preview UI
  - Click send button
  - Return result
Don't touch: Steps 1-4 (already working)
```

---

## PHASE 4: DATA FLOW DEFINITION

### Queue Item Structure
**Current:**
```json
{
  "phoneNumber": "+1234567890",
  "message": "Hello",
  "delay": 10
}
```

**New (ADD OPTIONAL FIELD):**
```json
{
  "phoneNumber": "+1234567890",
  "message": "Hello",
  "delay": 10,
  "mediaAttachment": {
    "base64": "...",
    "type": "image/jpeg",
    "name": "photo.jpg"
  }
}
```

### Conditional Routing
**In page.js:**
```
IF message.mediaAttachment EXISTS:
  - Call cmdSendWithMedia(message.mediaAttachment)
  - Return result

ELSE:
  - Call cmdClickSendButton() (existing code)
  - Return result
```

---

## PHASE 5: SPECIFIC CODE ADDITIONS

### Addition 1: popup.js - Media Selection Handler
```
When: User selects file
Where: File input change event
Action: Set mediaAttachment on message object
Scope: Only popup.js, isolated
```

### Addition 2: background.js - Media Check
```
When: Message is queued
Where: Queue building function
Action: Check message.mediaAttachment
  - If exists: Keep in queue
  - If not: Send normal
Scope: One conditional check
```

### Addition 3: page.js - Media Router
```
When: Message received from background
Where: Main dispatcher function
Action:
  - If mediaAttachment: cmdSendWithMedia()
  - Else: cmdClickSendButton()
Scope: One conditional routing
```

### Addition 4: page.js - Complete cmdSendWithMedia()
```
Current ends: Line ~200 (after file injection)
Add:
  1. Wait for preview (poll for upload UI)
  2. Click send button (existing function)
  3. Return {success: true/false}
Scope: Complete the function
```

---

## CRITICAL CONSTRAINTS

✅ Don't modify:
- Current cmdClickSendButton()
- Current queue storage
- Current auth system
- Current selector fetching
- Current message structure

✅ Only add:
- New conditions
- New fields (optional)
- New function completion
- New file handlers

---

## SUCCESS CRITERIA

- [ ] Text-only messages still work (100%)
- [ ] File selection works
- [ ] Media + text sent together
- [ ] Failure falls back to text-only
- [ ] No errors in console
- [ ] No broken existing features

---

## TIMELINE

- Phase 1 (Read): 30 min
- Phase 2 (Analyze): 30 min
- Phase 3-5 (Plan): 30 min
- Total planning: 1.5 hours
- Then: Write code (separate phase)

