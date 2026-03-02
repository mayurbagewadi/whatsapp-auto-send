# 📱 WhatsApp Bulk Sender

Send messages to multiple WhatsApp numbers without saving contacts.

**100% Private** • **No Server** • **Open Source**

---

## ✨ Features

- ✅ Send messages to unsaved phone numbers
- ✅ Bulk send to multiple numbers (paste from Excel/CSV)
- ✅ Customizable delay between messages (8-120 seconds)
- ✅ Randomize delays to appear more human
- ✅ Live progress tracking with countdown
- ✅ Pause/Resume/Stop controls
- ✅ Auto-save your inputs
- ✅ Connection status indicator
- ✅ **100% local processing** - no data leaves your browser
- ✅ **No external servers** - zero telemetry

---

## 🚀 Installation

### Step 1: Download Extension
Download or clone this repository to your computer.

### Step 2: Create Icons
Before loading the extension, you need to add icon files.

**Quick way:** Download any PNG icon (128x128, 48x48, 16x16) and save them in the `icons/` folder as:
- `icon128.png`
- `icon48.png`
- `icon16.png`

**Or use online tools:**
- Visit: https://favicon.io/favicon-generator/
- Generate a green WhatsApp-style icon
- Download and rename files

### Step 3: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `whatsapp-bulk-sender` folder
5. Extension icon will appear in your toolbar

---

## 📖 How to Use

### Step 1: Open WhatsApp Web
1. Go to https://web.whatsapp.com
2. Scan QR code to log in
3. Wait until chat list loads

### Step 2: Open Extension
1. Click the extension icon in toolbar
2. Wait for green **"WhatsApp Connected"** indicator
3. If not connected, refresh WhatsApp Web tab

### Step 3: Add Phone Numbers
Paste phone numbers in the first text box, **one per line**.

**Format:** Country code + number (no spaces, no +)

Example:
```
919876543210
14155552671
447911123456
```

**Tips:**
- ✅ Use country code (91 for India, 1 for USA, 44 for UK)
- ✅ Remove spaces and + symbol
- ✅ Copy from Excel: select column → Ctrl+C → paste here
- ✅ Extension auto-removes duplicates

### Step 4: Write Your Message
Type your message in the text area.

**Limits:**
- Max 4096 characters (WhatsApp limit)
- Line breaks work fine
- Emojis supported

### Step 5: Set Delay
Default: **10 seconds** between messages

**Safety:**
- Minimum: 8 seconds (enforced)
- Recommended: 10-15 seconds
- Below 10 seconds → ⚠️ ban risk warning shown

**Randomize:** Keep checked for human-like behavior (adds ±2 seconds variance)

### Step 6: Start Sending
1. Click **🚀 Start Sending**
2. Keep WhatsApp Web tab open
3. **Do NOT close the tab** while sending
4. Extension works in background

### Controls During Sending:
- **⏸️ Pause** → Pause after current message completes
- **▶️ Resume** → Continue from where you paused
- **⏹️ Stop** → Abort completely (confirms first)

### Step 7: Monitor Progress
Watch the progress section showing:
- **Sent** count
- **Failed** count
- **Progress bar**
- **Countdown** to next message

---

## 🛡️ Anti-Ban Safety Rules

### Why Delay Matters
WhatsApp detects automated behavior. Too many messages too fast = ban.

### Safe Practices:
| Rule | Recommended |
|---|---|
| **Delay** | 10-15 seconds minimum |
| **Daily limit** | Max 20-30 messages/day for unsaved numbers |
| **Randomize** | Always keep enabled |
| **Content** | Avoid spam words, keep it natural |

### What Triggers Bans:
- ❌ Less than 5 second delay
- ❌ Sending 100+ messages/day to unsaved numbers
- ❌ Identical message to 50+ people
- ❌ Multiple spam reports from recipients

---

## 🔧 Troubleshooting

### ❌ "WhatsApp Web not open"
**Solution:** Open https://web.whatsapp.com in a tab first

### ❌ "Please scan QR code"
**Solution:** You're not logged in. Scan QR code on WhatsApp Web

### ❌ "Extension loading..."
**Solution:** Wait 30 seconds. If still loading, refresh WhatsApp Web tab

### ❌ Send button grayed out
**Solution:** Connection not ready. Check status indicator. Refresh WhatsApp tab.

### ❌ Message sending stops mid-way
**Possible causes:**
1. WhatsApp Web tab was closed → Reopen and resume
2. Internet connection lost → Fix connection, resume
3. Chrome killed service worker → Extension auto-resumes on restart

### ❌ Messages marked as "Failed"
**Common reasons:**
1. Invalid phone number format
2. Number not on WhatsApp
3. Number blocked you
4. Network timeout

**Solution:** Check number format, ensure country code is correct

---

## 🔒 Privacy & Security

### What Data Does This Extension Access?
- ✅ WhatsApp Web page DOM (to send messages)
- ✅ Chrome local storage (to save your inputs)
- ✅ Active tab info (to find WhatsApp Web tab)

### What Data is Sent to External Servers?
- ❌ **NOTHING**

### How is This Different from Other Extensions?
Most bulk sender extensions:
- ❌ Send your messages to their servers
- ❌ Collect phone numbers
- ❌ Track usage analytics
- ❌ Require login/account

**This extension:**
- ✅ 100% local processing
- ✅ No server communication
- ✅ No tracking
- ✅ No login required
- ✅ Open source code (you can audit)

### Permissions Explained:
| Permission | Why Needed |
|---|---|
| `tabs` | Find WhatsApp Web tab |
| `storage` | Save your phone numbers/message locally |
| `scripting` | Inject content.js into WhatsApp Web |
| `activeTab` | Communicate with WhatsApp Web tab |
| `web.whatsapp.com` | Only works on WhatsApp Web |

**No other permissions.** No cookies, no browsing history, no external domains.

---

## 📋 How It Works (Technical)

Based on research from 2 production extensions (WASender, Premium Sender):

### Architecture:
```
popup.js (UI)
    ↓
background.js (Queue manager + chrome.alarms timing)
    ↓
content.js (Runs on web.whatsapp.com)
    ↓
WhatsApp Web DOM (sends messages)
```

### Message Sending Flow:
1. **Navigate:** Opens `web.whatsapp.com/send?phone=NUMBER&text=MSG`
2. **Wait:** Polls for chat to load (checks for input box)
3. **Inject text:** Uses `document.execCommand('insertText')` + React events
4. **Click Send:** Finds Send button with fallback selectors
5. **Confirm:** Waits for Send button to disappear (message sent)
6. **Delay:** Uses `chrome.alarms` to wait configured seconds
7. **Repeat:** Next number in queue

### Why This Approach:
- ✅ Reliable for unsaved numbers (URL method)
- ✅ Doesn't require WhatsApp internal API hooking
- ✅ Simple vanilla JavaScript (no framework bloat)
- ✅ Works with WhatsApp Web updates (multiple selector fallbacks)

---

## ⚠️ Disclaimer

- This extension is for **personal use only**
- Bulk messaging may violate WhatsApp Terms of Service
- Use at your own risk - we're not responsible for account bans
- Only send messages to people who expect to hear from you
- **Do not use for spam**

---

## 📝 License

MIT License - Free to use, modify, and distribute.

---

## 🛠️ Development

### Files:
- `manifest.json` - Extension configuration
- `popup.html` / `popup.css` / `popup.js` - User interface
- `background.js` - Service worker (queue + timing)
- `content.js` - Injected into WhatsApp Web (DOM automation)

### Based on Research:
- WASender v1.0.72 (architecture patterns)
- Premium Sender v1.0.81 (wa.me technique, timing)
- Internet research (selectors, MutationObserver, chrome.alarms)

See `FULL_COMPARISON_REPORT.md` for detailed technical analysis.

---

## 🤝 Contributing

Found a bug? Want to add a feature?

1. Fork this repo
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📞 Support

**Need help?**
- Check Troubleshooting section above
- Read `FULL_COMPARISON_REPORT.md` for technical details
- Open an issue on GitHub

---

**Made with research, not guesswork** 🔬

Built using proven techniques from real production Chrome extensions.
Zero telemetry. Zero servers. 100% yours.
