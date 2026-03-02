# WhatsApp Extension Backend Server

Backend server for WhatsApp bulk sender extension. Serves dynamic CSS selectors and logs message sends.

## Features

✅ **Dynamic Selectors** - Fetch CSS selectors from database
✅ **Message Logging** - Track all messages sent (success/failure)
✅ **Statistics** - View send success rate
✅ **Auto-Update** - Update selectors when WhatsApp changes UI
✅ **Supabase Integration** - Uses your existing Supabase database

## Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
cd "C:\Users\Administrator\Desktop\new whatsApp\backend-server"
npm install
```

### 2. Setup Environment

File `.env` is already created with your Supabase credentials.

Verify it contains:
```env
SUPABASE_URL=https://isfaiawbywrtwvinkizb.supabase.co
SUPABASE_ANON_KEY=<your-key-here>
PORT=3000
NODE_ENV=development
```

### 3. Initialize Selectors

```bash
npm run init-selectors
```

This populates the `whatsapp_selectors` table with default values.

### 4. Test Locally

```bash
npm run dev
```

Visit: http://localhost:3000/api/health

You should see:
```json
{
  "success": true,
  "message": "Server is running ✅"
}
```

## API Endpoints

### Get All Selectors
```
GET /api/selectors
```

Returns all working selectors in format extension expects.

**Example Response:**
```json
{
  "success": true,
  "selectors": {
    "send_button": ["button[data-testid='compose-btn-send']", "..."],
    "message_input": ["div[data-testid='textbox']", "..."],
    "modal_confirm": ["div[data-animate-modal-popup='true'] button:last-child", "..."]
  }
}
```

### Log Message
```
POST /api/log-message
Body:
{
  "extensionId": "abc123",
  "phoneNumber": "+919527773102",
  "message": "Hello!",
  "status": "sent",
  "error": null
}
```

### Get Statistics
```
GET /api/stats
```

Returns send statistics.

### Update Selector (Admin)
```
POST /api/update-selector
Body:
{
  "name": "send_button",
  "selectors": ["button[new-selector]"],
  "whatsappVersion": "2.2412.50",
  "isWorking": true
}
```

### Health Check
```
GET /api/health
```

## Deploy to Railway.app

### 1. Create Railway Account

Go to: https://railway.app
Sign up with GitHub

### 2. Connect Project

1. Click "New Project"
2. Select "Deploy from GitHub"
3. Connect your repository
4. Select the `backend-server` directory

### 3. Add Environment Variables

In Railway dashboard:
1. Go to "Variables" tab
2. Add:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key
   - `NODE_ENV`: `production`

### 4. Deploy

Click "Deploy" button. Wait 2-3 minutes.

Railway will give you a URL like: `https://your-app.railway.app`

### 5. Test Production

```bash
curl https://your-app.railway.app/api/health
curl https://your-app.railway.app/api/selectors
```

## Update Extension

Update `popup.js` to fetch selectors from your backend:

```javascript
const BACKEND_URL = 'https://your-app.railway.app';

async function loadSelectorsFromBackend() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/selectors`);
    const data = await response.json();

    if (data.success) {
      chrome.storage.local.set({ selectors: data.selectors });
      console.log('✅ Selectors loaded from backend');
    }
  } catch (error) {
    console.error('Failed to load selectors:', error);
  }
}

// Call on extension load
chrome.runtime.onInstalled.addListener(() => {
  loadSelectorsFromBackend();
});

// Refresh every hour
setInterval(loadSelectorsFromBackend, 60 * 60 * 1000);
```

Update `content.js` to use backend selectors:

```javascript
function getSendButtonSelectors() {
  // First try dynamic selectors from backend
  const stored = chrome.storage.local.get('selectors');
  if (stored?.selectors?.send_button) {
    return stored.selectors.send_button;
  }
  // Fallback to hardcoded
  return [
    'button[data-testid="compose-btn-send"]',
    'button[aria-label="Send"]'
  ];
}
```

## Troubleshooting

### Error: Cannot connect to Supabase

**Check:**
1. SUPABASE_URL is correct
2. SUPABASE_ANON_KEY is correct
3. Your Supabase project is active
4. Migration 017 has been run

### Error: Table not found

**Fix:**
1. Go to Supabase SQL editor
2. Run migration 017: `supabase db push`
3. Or manually run SQL from `../supabase/migrations/017_whatsapp_extension_tables.sql`

### Server won't start

**Check:**
1. Port 3000 is available
2. Node.js is installed: `node --version`
3. Dependencies installed: `npm install`
4. .env file exists with correct values

## File Structure

```
backend-server/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── .env                   # Environment variables (NEVER commit)
├── .env.example           # Template for .env
├── .gitignore            # Git ignore rules
├── scripts/
│   └── init-selectors.js # Initialize default selectors
└── README.md             # This file
```

## Next Steps

1. ✅ Install and test locally: `npm run dev`
2. ✅ Deploy to Railway.app
3. ✅ Update extension code to use backend URL
4. ✅ Reload extension in Chrome
5. ✅ Test sending messages
6. ✅ Check `/api/stats` to see logged messages

## Support

If something breaks:
1. Check server logs: `npm run dev`
2. Check Supabase logs
3. Verify environment variables
4. Test endpoints with curl/Postman

---

**You're all set! 🚀**

Your extension can now fetch selectors from the backend instead of hardcoding them!
