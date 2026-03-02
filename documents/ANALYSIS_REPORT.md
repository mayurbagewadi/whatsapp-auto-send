# WhatsApp Bulk Sender — Full Investigation & Analysis Report
**Date:** 2026-02-16
**Analyzed Extension:** WASender FREE Bulk Messaging Plugin
**Extension ID:** heogilejknffekkbjdjmoamaehdblmnc
**Version:** 1.0.72

---

## 1. EXTENSION OVERVIEW

| Property | Value |
|---|---|
| Name | WASender FREE Bulk Messaging Plugin |
| Version | 1.0.72 |
| Manifest Version | 3 (MV3) |
| Framework | Angular 16+ (compiled) |
| Parent Brand | Telecrm (leaked in `<title>`) |
| Backend | Firebase (GCP) + AWS Lambda (ap-south-1) |
| License Server | `us-central1-waplugin-34798.cloudfunctions.net` |

---

## 2. FILE STRUCTURE

```
1.0.72_1/
├── manifest.json          ← Extension config
├── index.html             ← Angular popup shell
├── main.js    (1MB)       ← Angular main bundle
├── content.js (447KB)     ← Content script (injected into WhatsApp Web)
├── fl.js      (75KB)      ← Injected into WA page context (CORE automation)
├── service-worker.js (75KB) ← Background queue manager
├── common.js  (12KB)      ← Shared Angular UI components
├── 732.js     (62KB)      ← Bulk Message Compose page
├── 638.js     (22KB)      ← Reports page (live progress)
├── 572.js     (13KB)      ← Contact Downloader page
├── 969.js     (9.7KB)     ← User Registration page
├── 607.js     (155KB)     ← Shared services chunk
├── 195.js     (2KB)       ← AI Chatbot promo page
├── polyfills.js / runtime.js
├── styles.css             ← Global styles + custom icon font
└── assets/                ← Bootstrap, icons, images
```

---

## 3. HOW THE AUTOMATION WORKS (ARCHITECTURE)

### Method: WhatsApp Webpack API Hooking (NOT DOM scraping)

This is far more advanced than the basic DOM approach. It does NOT type into input boxes.

```
┌─────────────┐     chrome.tabs.sendMessage     ┌──────────────┐
│ service-    │ ──────────────────────────────► │  content.js  │
│ worker.js   │                                  │  (isolated)  │
│ (queue mgr) │ ◄────────────────────────────── │              │
└─────────────┘     chrome.runtime.sendMessage  └──────┬───────┘
                                                        │
                                        DOM bridge via hidden <input> elements
                                        (#wa_contentToLibHook)
                                        (#wa_libHookToContent)
                                                        │
                                                 ┌──────▼───────┐
                                                 │    fl.js     │
                                                 │ (page context│
                                                 │ - WhatsApp's │
                                                 │ own JS scope)│
                                                 └──────┬───────┘
                                                        │
                                           window.wa.SendMessage
                                           .addAndSendMsgToChat()
                                                        │
                                                 ┌──────▼───────┐
                                                 │  WhatsApp    │
                                                 │  Web Servers │
                                                 └──────────────┘
```

### Step-by-Step Automation Flow

1. User pastes numbers + message in popup → clicks "Start"
2. `popup.js` sends `MSG_SETUP_BATCH` to `service-worker.js`
3. Service worker initializes the queue (`Q.init()`)
4. For each number: service worker sends `MSG_SEND_MESSAGE` to `content.js` in the WhatsApp Web tab
5. `content.js` receives it → passes to `fl.js` via hidden DOM `<input>` bridge
6. `fl.js` calls `b.sendMessageToContact(number)`:
   - Opens chat: `window.wa.Cmd.openChatBottom(chat)` → waits 2000ms
   - Sends message: `window.WWebJS.sendMessage(chat, body, options)`
   - This calls WhatsApp's internal `addAndSendMsgToChat()` directly
7. Result returned back through the DOM bridge → content.js → service-worker.js
8. Status updated (SENT / FAILED), progress reported to popup
9. Wait `messageGap` seconds → next number

---

## 4. KEY TECHNICAL COMPONENTS

### A. Webpack Module Hooking (fl.js)

fl.js hooks into WhatsApp's webpack bundle to extract internal modules:

```js
window[webpack_bundle].push([["parasite"], {}, function(module, exports, require) {
  // Iterate ALL webpack exports, fingerprint each one
  for (key in modules) {
    identifyModule(modules[key]);
  }
}])
```

Modules it extracts (40+):
- `Store` (Chat, Msg, Contact collections)
- `SendTextMsgToChat`, `addAndSendMsgToChat`
- `WidFactory` (WhatsApp ID creator)
- `QueryExist` (number validation)
- `MediaCollection`, `MediaPrep`, `MediaUpload`
- `Cmd` (UI commands like openChat)
- `MsgKey`, `OpaqueData`, `Wap`

### B. DOM Bridge (content.js ↔ fl.js)

Two hidden containers in `document.body`:
```
<div id="wa_contentToLibHook">  ← content.js → fl.js
<div id="wa_libHookToContent">  ← fl.js → content.js
```

To send: create `<input id=msgId value=JSON>` and append to div
To receive: `MutationObserver` watches div, reads new child `.value`, processes, removes element

### C. Message Sending (fl.js)

```js
// Direct internal API — no UI interaction
window.wa.SendMessage.addAndSendMsgToChat(chatObject, {
  id: MsgKey,
  body: "Hello world",
  type: "chat",
  from: myWid,
  to: chatId,
  t: Math.floor(Date.now() / 1000),
  isNewMsg: true,
  local: true,
  ...
})
```

### D. Queue Manager (service-worker.js)

State machine with:
- `numbers[]` — full phone list
- `messages[]` — per-number messages
- `status[]` — PENDING / SENT / FAILED / SKIPPED per number
- Batch support: slice numbers into groups, wait between batches
- Pause / Resume / Stop / Cancel operations
- Live countdown timer (updates every 1 second)

---

## 5. FEATURES INVENTORY

| Feature | Free | PRO |
|---|---|---|
| Send to unsaved numbers | ✅ | ✅ |
| Manual number entry | ✅ | ✅ |
| Excel/CSV upload | ✅ (limited) | ✅ Full |
| Row range selection in Excel | ❌ | ✅ |
| Message delay (time gap) | ❌ | ✅ |
| Random delay | ❌ | ✅ |
| Batch splitting | ❌ | ✅ |
| Text messages | ✅ | ✅ |
| Image/file attachments | ✅ (3 max) | ✅ Unlimited |
| Personalized messages | ❌ | ✅ |
| Number validation (filter) | ❌ | ✅ |
| Contact downloader | ❌ | ✅ |
| Report download (CSV) | ❌ | ✅ |
| Live progress screen | ✅ | ✅ |
| Group messaging | ❌ | ✅ |
| Label-based messaging | ❌ | ✅ |
| AI Chatbot | ❌ | ✅ |
| Messages cap | 10 (unverified) | Unlimited |

---

## 6. PROBLEMS & GAPS FOUND

### Critical Issues
| # | Issue | Impact |
|---|---|---|
| 1 | `libs/xlsx/xlsx.full.min.js` is missing | Excel upload may silently fail |
| 2 | Free users get ZERO delay between messages | Highest risk of WhatsApp ban |
| 3 | No retry logic for failed messages | Lost messages with no recovery |

### Code Quality Issues
| # | Issue |
|---|---|
| 4 | `localhost:3000` hardcoded in service-worker (dev artifact left in prod) |
| 5 | Telecrm brand leaked in `<title>` of index.html |
| 6 | No message scheduling (no send at specific time feature) |
| 7 | WhatsApp version update can break webpack module fingerprinting |

---

## 7. PRIVACY & SECURITY CONCERNS

### HIGH SEVERITY
1. **All messages logged to Firebase** — Every message sent (content + recipient number) is POSTed to Firebase Cloud Functions
2. **Full WhatsApp message access** — fl.js hooks into `Msg.on("add")` — reads ALL incoming messages, not just outgoing
3. **Contact data uploaded** — When using contact downloader, all contact data is sent to Firebase
4. **Cookies permission** — Extension has access to WhatsApp Web session cookies

### MEDIUM SEVERITY
5. **Report upload to AWS S3** — Full bulk send reports stored on their servers
6. **Uninstall tracking** — Pings `wasender.com/uninstall.html?phonenumber=xxx` on uninstall
7. **Pro click tracking** — `stats/isproclicked` fires on every upgrade button click
8. **Visit tracking** — `logRevists` sends user ID + version on every visit

### LOW SEVERITY
9. **Support phone number hardcoded** in bundle (exposed)
10. **No data encryption** in chrome.storage.local (plain JSON)

---

## 8. COMPARISON: WASender vs What We Want to Build

| Aspect | WASender (existing) | Our Build (planned) |
|---|---|---|
| Architecture | Angular + webpack hooking | Vanilla JS + DOM automation |
| Automation method | WhatsApp internal APIs | `web.whatsapp.com/send?phone=` URL + DOM |
| Reliability | Very high (internal API) | Medium (selector fragility) |
| Complexity | Very high (Angular, 447KB content.js) | Low-medium |
| Privacy | Sends data to external servers | 100% local, no server |
| External dependency | Firebase + AWS + wasender.com | None |
| Free limits | 10 messages cap, no delays | No limits (personal use) |
| Personalization | PRO only | Not needed now |
| Delays/batching | PRO only | We build it in |
| Excel upload | Partial | We build it in |
| Code size | ~1.5MB compiled | Small, readable |
| Build tool | Angular CLI + Webpack | None (vanilla JS) |
| Maintenance | Telecrm team | You |

---

## 9. WHAT WE SHOULD COPY FROM WASENDER

1. **Service worker + chrome.alarms** for reliable background queue (not setTimeout)
2. **chrome.storage.local** for persisting queue state across service worker restarts
3. **Pause / Resume / Stop** controls
4. **Live progress screen** with per-number status table
5. **Countdown timer** showing "Next message in X sec"
6. **Excel upload** using SheetJS
7. **Batch splitting** concept
8. **Random delay** option

---

## 10. WHAT WE SHOULD DO DIFFERENTLY (BETTER)

1. **No external server** — Zero data leaves the browser, full privacy
2. **No free tier restrictions** — Personal use, no limits
3. **Simpler architecture** — Vanilla JS, no Angular, no webpack
4. **Built-in anti-ban delays** — Always enforce minimum delay (not PRO-gated)
5. **Simpler DOM automation** — Use `web.whatsapp.com/send?phone=` URL directly
6. **No telemetry/tracking** — No Firebase, no AWS, no analytics
7. **Transparent codebase** — Readable source, not minified/obfuscated

---

## 11. RECOMMENDED ARCHITECTURE FOR OUR BUILD

```
whatsapp-bulk-sender/
├── manifest.json          ← MV3, minimal permissions (no cookies, no host_permissions)
├── popup.html             ← Clean UI (number input, message, delay settings)
├── popup.js               ← Sends job to background, polls for status
├── background.js          ← Service worker queue using chrome.alarms + chrome.storage
├── content.js             ← DOM automation on web.whatsapp.com
└── icons/
```

**Automation flow:**
```
background.js
  └── opens web.whatsapp.com/send?phone=NUMBER&text=MSG
        └── content.js (MutationObserver)
              └── waits for contenteditable input box
                    └── document.execCommand('insertText', false, msg)
                          └── clicks button[data-testid="compose-btn-send"]
                                └── reports back to background.js
                                      └── waits delay → next number
```

---

## 12. RECOMMENDED SELECTORS (2026, verified)

```js
// Message input box (try in order)
'div[contenteditable="true"][data-tab="10"]'
'div[data-testid="conversation-compose-box-input"]'
'div[aria-placeholder="Type a message"]'

// Send button (try in order)
'button[data-testid="compose-btn-send"]'
'button[aria-label="Send"]'
'span[data-icon="send"]'
```

---

## 13. RECOMMENDED DELAY SETTINGS

| Setting | Value | Reason |
|---|---|---|
| Minimum delay | 8 seconds | Below this = high ban risk |
| Default delay | 12 seconds | Safe for daily use |
| After opening chat | 2000ms | Let WhatsApp Web load chat |
| After text injection | 800ms | Let React process input |
| After clicking Send | 1000ms | Confirm message delivered |
| Max safe per day | ~30 messages | WhatsApp soft limit |

---

## 14. SUMMARY

WASender is a **professional, feature-rich** product built by the Telecrm team. Its core strength is the **webpack API hooking approach** which bypasses all DOM scraping and talks directly to WhatsApp's internal JavaScript. However, it comes with serious **privacy concerns** (all data sent to external servers), heavy **free tier restrictions**, and significant **code complexity** (Angular + 1MB+ bundle).

For **personal use** with full privacy and no restrictions, building our own lightweight vanilla JS extension is the right choice. We borrow the best architectural ideas from WASender (service worker queue, chrome.alarms, progress UI) while keeping the implementation simple, transparent, and completely local.

---

*Report generated: 2026-02-16*
*Source: Direct code analysis of extension ID heogilejknffekkbjdjmoamaehdblmnc v1.0.72*
