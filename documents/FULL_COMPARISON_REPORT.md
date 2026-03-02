# WhatsApp Bulk Sender — Full Comparison Report
**Date:** 2026-02-16
**Sources Compared:**
1. Internet Research (what tutorials/blogs say)
2. WASender Extension — `heogilejknffekkbjdjmoamaehdblmnc` v1.0.72
3. Premium Sender Extension — `pggchepbleikpkhffahfabfeodghbafd` v1.0.81

---

## PART 1 — EXTENSION OVERVIEW COMPARISON

| Property | WASender | Premium Sender |
|---|---|---|
| Extension ID | `heogilejknffekkbjdjmoamaehdblmnc` | `pggchepbleikpkhffahfabfeodghbafd` |
| Version | 1.0.72 | 1.0.81 |
| UI Framework | Angular 16 | React + Vite |
| Bundle Size | ~1.5 MB | ~6.5 MB |
| Backend | Firebase (GCP) + AWS Lambda | premiumsender.app server |
| Manifest Version | 3 (MV3) | 3 (MV3) |
| Encryption | None | AES-256-CBC for all API traffic |
| Parent Brand | Telecrm | Premium Sender |

---

## PART 2 — HOW EACH ACTUALLY SENDS MESSAGES

### Internet Research Said:
```
1. Open web.whatsapp.com/send?phone=NUMBER&text=MSG
2. Wait for contenteditable input box (MutationObserver)
3. document.execCommand('insertText', false, message)
4. Click button[data-testid="compose-btn-send"]
```

### WASender Actually Does:
```
1. Injects fl.js into WhatsApp page context
2. Hooks WhatsApp's webpack bundle (40+ internal modules)
3. Calls window.wa.SendMessage.addAndSendMsgToChat() directly
4. BYPASSES the UI completely — no input box, no button clicks
```

### Premium Sender Actually Does:
```
1. Injects lib.min.js into WhatsApp MAIN world
2. Creates a hidden <a href="wa.me/NUMBER?text=MSG"> in WhatsApp DOM
3. Clicks that link programmatically to open the chat
4. Fires MouseEvent + KeyboardEvent + InputEvent on message input box
5. Uses DataTransfer/ClipboardEvent to inject file attachments
6. Clicks Send button via DOM events
```

---

## PART 3 — ARCHITECTURE COMPARISON

### Internet Research Architecture:
```
popup.html + popup.js
    └── background.js (service worker + chrome.alarms)
            └── content.js (MutationObserver + DOM manipulation)
```

### WASender Architecture:
```
popup → background (service-worker.js)
    └── content.js (ISOLATED world, Angular)
            └── DOM bridge (hidden <input> elements)
                    └── fl.js (PAGE world, webpack hooker)
                            └── window.wa.SendMessage.addAndSendMsgToChat()
```

### Premium Sender Architecture:
```
popup (React) → background.min.js (service worker)
    └── content.min.js (ISOLATED world, event bridge)
            └── page.min.js (MAIN world, WAWeb module hooker)
                    └── lib.min.js (MAIN world, DOM event simulator)
                            └── wa.me anchor inject → DOM events → Send
```

---

## PART 4 — FEATURE COMPARISON TABLE

| Feature | Internet Research | WASender | Premium Sender |
|---|---|---|---|
| Send to unsaved numbers | URL trick | Yes | Yes (wa.me inject) |
| Manual number entry | Yes | Yes | Yes (max 200 free) |
| Excel/CSV upload | Mentioned | Yes (SheetJS) | Yes (full) |
| Row range in Excel | Not mentioned | PRO | PRO |
| Message delay | Manual code | PRO only | Free (2s default) |
| Random delay | Yes | PRO | PRO |
| Batch splitting | Not mentioned | PRO | PRO |
| Text messages | Yes | Free | Free |
| Attachments | Not mentioned | Free (3 max) | PRO |
| Personalization | Not mentioned | PRO | PRO (`{{prna}}`) |
| Number validation/filter | Not mentioned | PRO | PRO |
| Contact export | Not mentioned | PRO | PRO |
| Templates | Not mentioned | No | PRO |
| AI text rewriter | Not mentioned | No | PRO |
| Live progress screen | Not mentioned | Yes | Yes |
| Countdown timer | Not mentioned | Yes | Yes |
| Pause/Resume/Stop | Not mentioned | Yes | Yes |
| Multi-language UI | Not mentioned | No | Yes |
| Dynamic selectors | Not mentioned | No | Yes (server-fetched) |
| Anti-ban warning | Mentioned | No UI warning | Yes (warns below 10s) |

---

## PART 5 — SELECTOR STRATEGY COMPARISON

### Internet Research:
```js
// Hardcoded selectors
'div[contenteditable="true"][data-tab="10"]'
'button[data-testid="compose-btn-send"]'
```

### WASender:
- Does NOT use CSS selectors for sending
- Uses WhatsApp's internal webpack module `addAndSendMsgToChat()`
- Selectors only used for detecting WA shell loaded

### Premium Sender:
```js
// Selectors fetched DYNAMICALLY from server at runtime
const selectors = await fetch('https://premiumsender.app/mv3/dom-selectors.php')
// Decrypted with AES-256-CBC, applied to DOM at send time
```
**This is the most resilient approach** — when WhatsApp updates its UI, server pushes new selectors instantly without any Chrome store update.

---

## PART 6 — PRIVACY & SECURITY COMPARISON

### WASender — HIGH RISK
| Concern | Detail |
|---|---|
| All messages logged | Message content + recipient sent to Firebase |
| Reads ALL incoming messages | fl.js hooks `Msg.on("add")` |
| Contact data uploaded | Goes to Firebase on export |
| Report data stored on AWS S3 | Your bulk send history in their cloud |
| Uninstall tracking | Pings server with your phone number |
| Cookie access | Has `cookies` permission |

### Premium Sender — MEDIUM RISK
| Concern | Detail |
|---|---|
| License API calls | Device code + mobile number sent to server |
| AI requests | Message text sent to `/getresponse.php` |
| Template sync | Templates uploaded to their server |
| IP detection | Calls `ip-api.com` to detect country |
| Uninstall tracking | Calls `/uninstall.php` on remove |
| Hardcoded AES keys | Encryption keys visible in source code |
| Dynamic selector injection | Server can push arbitrary selector code |

### Our Build — ZERO RISK
```
No external server calls
No telemetry
No message logging
No contact uploads
100% local processing
```

---

## PART 7 — TIMING AND DELAY COMPARISON

| Setting | WASender | Premium Sender | Our Build (plan) |
|---|---|---|---|
| Default delay | 0 sec (free) | 2 seconds | 8 seconds |
| Anti-ban warning | None | Warns below 10s | Enforced minimum |
| Randomize | PRO | PRO | Built-in |
| Batch splitting | PRO | PRO | Built-in |
| After opening chat | 2000ms | 500ms | 2000ms |
| After text inject | Built-in | Via event timing | 800ms |

---

## PART 8 — WHAT INTERNET RESEARCH GOT RIGHT vs WRONG

### Got RIGHT:
- URL trick: `web.whatsapp.com/send?phone=NUMBER&text=MSG` ✅
- MutationObserver approach ✅
- chrome.alarms for service worker ✅
- Random delays concept ✅
- Selectors like `data-testid="compose-btn-send"` ✅ (used by Premium Sender)

### Got WRONG / INCOMPLETE:
- `document.execCommand('insertText')` — real extensions use DOM event simulation (MouseEvent + KeyboardEvent + InputEvent)
- Basic DOM approach works but is fragile — real products use server-fetched selectors or internal API hooking
- Free tier limitations were not mentioned
- External data collection not mentioned
- Attachment injection via DataTransfer/ClipboardEvent not mentioned

---

## PART 9 — WHAT TO BUILD FOR OUR PLATFORM

### Goal:
Personal use, bulk send to unsaved numbers, no limits, no external data leakage.

### Chosen Approach: DOM Simulation (like Premium Sender, simplified)
Use `web.whatsapp.com/send?phone=NUMBER&text=MSG` URL + DOM event simulation.

Reason: Simpler than webpack hooking, no need for Angular or React.

### File Structure:
```
whatsapp-bulk-sender/
├── manifest.json          ← MV3, minimal permissions
├── popup.html             ← Simple clean UI
├── popup.js               ← Sends queue to background, polls status
├── background.js          ← Service worker: chrome.alarms + chrome.storage
├── content.js             ← Injected into WhatsApp Web, does DOM automation
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Manifest Permissions (minimal):
```json
{
  "permissions": ["tabs", "storage", "scripting", "activeTab"],
  "host_permissions": ["https://web.whatsapp.com/*"]
}
```
**No cookies, no external host permissions** — only WhatsApp Web.

### Sending Flow (from Premium Sender, simplified):
```
1. background.js opens:
   https://web.whatsapp.com/send?phone=NUMBER&text=MSG

2. content.js waits for WhatsApp to load (#side appears)

3. content.js finds message input box:
   Selectors (in priority order):
   - div[contenteditable="true"][data-tab="10"]
   - div[data-testid="conversation-compose-box-input"]
   - div[aria-placeholder="Type a message"]

4. content.js fires events on input box:
   - focus event
   - document.execCommand('insertText', false, message)
   - input event (bubbles: true) — makes React see the change

5. content.js finds and clicks Send button:
   - button[data-testid="compose-btn-send"]
   - button[aria-label="Send"]
   - span[data-icon="send"]

6. content.js confirms sent, reports back to background.js

7. background.js waits delay (random within range), opens next number
```

### Queue Manager (from WASender/Premium Sender pattern):
```js
// chrome.storage.local state:
{
  queue: [],           // [{number, message}]
  running: false,
  delaySec: 10,        // configurable
  randomize: true,
  sentCount: 0,
  totalCount: 0,
  failedCount: 0
}

// chrome.alarms for timing (not setTimeout — service workers die)
chrome.alarms.create('sendNext', { delayInMinutes: delaySec / 60 })
```

### UI Features (Phase 1 — personal use):
```
- Textarea for phone numbers (one per line, with country code)
- Message textarea
- Delay setting (seconds) — default 10s, warns below 8s
- Randomize delay toggle
- Start / Pause / Stop buttons
- Live progress: sent X of Y (Z failed)
- Countdown timer: next message in X sec
- Status per number: pending / sending / sent / failed
```

### UI Features (Phase 2 — future):
```
- Excel/CSV file upload
- Message personalization: {{name}} variable
- Batch splitting
- Message templates
```

---

## PART 10 — KEY LESSONS FROM BOTH EXTENSIONS

### From WASender:
1. Use `chrome.alarms` NOT `setTimeout` — service workers die after 30 sec
2. Persist ALL state in `chrome.storage.local`
3. Support Pause / Resume / Stop in the queue
4. Show live countdown timer per message
5. Keep per-number sent/failed status

### From Premium Sender:
1. Always warn user if delay is below 10 seconds
2. Use `#side` as the WhatsApp Web "ready" signal (not MutationObserver alone)
3. Fire proper MouseEvent + InputEvent chain — not just execCommand
4. `wa.me` anchor inject is more reliable than direct URL for opening unsaved chats
5. Randomize delay to appear more human
6. Default delay should be at least 2s (we'll use 10s to be safe)

### From Internet Research:
1. URL: `https://web.whatsapp.com/send?phone=NUMBER&text=MSG` is the foundation
2. MutationObserver for detecting DOM changes
3. Multiple selector fallbacks in case WhatsApp updates its DOM

---

## PART 11 — ANTI-BAN STRATEGY (what both extensions taught us)

| Rule | Source | Our Implementation |
|---|---|---|
| Minimum 8 seconds delay | Premium Sender warns below 10s | Enforce 8s minimum, warn below 10s |
| Randomize delays | Both extensions offer this | Built-in, always enabled |
| Max ~30 messages/day | Industry knowledge | Show daily counter, soft warn at 25 |
| Batch with breaks | Both support it | Optional: X msgs then Y min break |
| Only text first | Common advice | Default: text only, attachments later |

---

## SUMMARY TABLE

| Topic | Internet Says | WASender Does | Premium Sender Does | We Will Build |
|---|---|---|---|---|
| Chat open method | URL trick | URL + webpack API | wa.me anchor inject | URL trick |
| Text injection | execCommand | Internal API | DOM events | execCommand + InputEvent |
| Send button | Click selector | Internal API | Click DOM | Click selector |
| Queue | chrome.alarms | ✅ chrome.alarms | ✅ chrome.alarms | ✅ chrome.alarms |
| Delay | Random code | PRO only (0s free) | 2s default (warns) | 10s default (enforced) |
| Privacy | Not discussed | Sends data externally | Some data to server | 100% local |
| Personalization | Not discussed | PRO | PRO | Phase 2 |
| Excel upload | Not discussed | Yes | Yes | Phase 2 |
| External server | Not mentioned | Firebase + AWS | premiumsender.app | NONE |
| Complexity | Low | Very High (Angular) | High (React) | Low (Vanilla JS) |

---

---

## PART 12 — PREMIUM SENDER DEEP DIVE (Additional Findings)

### Exact wa.me Injection Technique (most important finding)
```javascript
// 1. Build the wa.me URL
const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

// 2. Inject hidden <a> tag into WhatsApp's sidebar DOM
document.querySelector(SELECTOR_APP_WA_ME_LINK).innerHTML =
  `<a href="${url}" id="pws-wa-me-link"></a>`

// 3. Simulate full click chain (NOT just .click())
mouseover → mousedown → focus → mouseup → click  (500ms gap between each)

// 4. WhatsApp opens "Continue to chat?" modal → auto-click confirm
while (modal visible) {
  if (modal has h1 or svg) → invalid number → throw error
  click modal confirm button
  wait 500ms
}
// Chat is now open
```

### Event Chain for Clicking (critical — .click() alone fails)
```javascript
// Must fire ALL 5 events with delays — WhatsApp React ignores partial chains
SendMouseEvent("mouseover", element)
SendMouseEvent("mousedown", element)
element.focus()
SendFocusEvent(element)
await Sleep(500)
SendMouseEvent("mouseup", element)
SendMouseEvent("click", element)
await Sleep(500)
```

### File Attachment Injection
```javascript
// Creates a DataTransfer to bypass browser file picker security
const dt = new ClipboardEvent("").clipboardData || new DataTransfer()
const file = DataUrlToFile(base64Data, filename)  // atob + Uint8Array → File
dt.items.add(file)
fileInput.files = dt.files  // Override input.files directly
SendInputEvent(fileInput)   // Triggers React state update
SendChangeEvent(fileInput)
await Sleep(3000)           // 3 seconds for file to process
```

### WhatsApp Ready Signal
```javascript
// Polls every 1 second until WhatsApp is fully loaded
const interval = setInterval(() => {
  if (document.querySelector("#side")) {
    clearInterval(interval)
    // WhatsApp is ready — inject meta tags and start
  }
}, 1000)
```

### Selector Communication (MAIN world ↔ page.min.js)
```javascript
// page.min.js defines the selectors object 'n'
// and passes it to lib.min.js at startup:
window.psLib.updateDS(n)  // n = all CSS selectors

// lib.min.js stores them and uses throughout:
n.SELECTOR_SEND_BUTTON
n.SELECTOR_ADD_ATTACHMENT_BUTTON
n.SELECTOR_APP_WA_ME_LINK
n.SELECTOR_APP_WA_ME_MODAL
```

### Send Timing Per Message (total ~7-12 seconds per number)
| Step | Time |
|---|---|
| Click wa.me link (full event chain) | ~1 second |
| Wait for modal | 500ms-2 seconds |
| Click modal confirm | 500ms |
| Chat opens | 500ms |
| Text injection + send click | ~1 second |
| Wait for send button to disappear | 500ms-2 seconds |
| For attachments extra | +3 seconds |
| **User-configured batch delay** | **+8-15 seconds** |

---

## PART 13 — FINAL ARCHITECTURE FOR OUR BUILD

Based on all 3 research sources, this is the proven approach:

### Technique: Premium Sender method (simplified)
Most reliable for personal use. Does not require webpack hooking.

```
STEP 1: background.js
  ├── Reads queue from chrome.storage.local
  ├── Opens web.whatsapp.com/send?phone=NUMBER&text=MSG
  └── Sets chrome.alarms for delay

STEP 2: content.js (on web.whatsapp.com)
  ├── Polls for #side (WhatsApp ready signal)
  ├── Gets message from chrome.storage.local
  ├── Injects hidden <a href="wa.me/NUMBER?text=MSG"> into DOM
  ├── Fires full event chain: mouseover→mousedown→focus→mouseup→click
  ├── Waits for "Continue" modal → clicks confirm
  ├── Fires events on message input box
  ├── Clicks Send button
  └── Reports result back to background.js

STEP 3: background.js
  ├── Updates status (sent/failed)
  ├── Waits delay (random 8-15 sec via chrome.alarms)
  └── Repeats for next number
```

### Selectors to Use (proven from both extensions):
```javascript
// WhatsApp ready check
"#side"

// Message input (try in order)
'div[contenteditable="true"][data-tab="10"]'
'div[data-testid="conversation-compose-box-input"]'
'div[aria-placeholder="Type a message"]'

// Send button (try in order)
'button[data-testid="compose-btn-send"]'
'button[aria-label="Send"]'
'span[data-icon="send"]'

// wa.me modal confirm
'div[data-animate-modal-body] button:last-child'
'button[role=button]:last-child'
```

---

*Report generated: 2026-02-16*
*Based on deep code analysis of both Chrome extensions + internet research*
*Extension 1: WASender v1.0.72 (heogilejknffekkbjdjmoamaehdblmnc)*
*Extension 2: Premium Sender v1.0.81 (pggchepbleikpkhffahfabfeodghbafd)*
