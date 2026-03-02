# CLAUDE.md — WhatsApp Bulk Sender Project Guide

> **READ THIS BEFORE WRITING ANY CODE**
> This file describes the full architecture, structure, and rules of this project.
> Never modify working code without reading this file first.

---

## Project Overview

Enterprise WhatsApp Bulk Message Sender — a full-stack system combining:
- **Chrome Extension** (sends WhatsApp messages via wa.me protocol)
- **Node.js Backend** (selector management + message logging)
- **Supabase** (PostgreSQL database + serverless Edge Functions)
- **Super Admin Dashboard** (local-only management panel)

**Core mechanic:** Opens `https://web.whatsapp.com/send/?phone=<number>&text=<message>`, waits for page load, finds the send button via CSS selectors, clicks it, then polls until the button disappears (confirms send). Does NOT rely on timing — uses button disappearance as confirmation.

---

## Directory Structure

```
new whatsApp/
├── whatsapp-bulk-sender/     <- MAIN Chrome Extension (source code)
├── backend-server/           <- Node.js Express API
├── supabase/                 <- DB migrations + Edge Functions
│   ├── migrations/           <- 18 SQL migration files
│   └── functions/            <- 11 serverless Edge Functions
├── super-admin/              <- Local-only admin dashboard (HTML/JS)
├── CLAUDE.md                 <- THIS FILE
├── ARCHITECTURE.md           <- Visual system design
├── *.md                      <- Various setup guides
│
├── pggchepbleikpkhffahfabfeodghbafd/  <- DO NOT TOUCH (competitor extension, reference only)
└── heogilejknffekkbjdjmoamaehdblmnc/ <- DO NOT TOUCH (competitor extension, reference only)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension UI | Plain HTML/CSS/JS, Chrome Extension Manifest v3 |
| Extension Auth | Supabase JS SDK + Chrome Storage |
| Backend | Node.js + Express.js (port 3000) |
| Database | PostgreSQL via Supabase (managed) |
| Serverless | Supabase Edge Functions (TypeScript/Deno) |
| Admin Panel | Static HTML/CSS/JS (local Python HTTP server) |
| Storage | Supabase Storage (media files) |

---

## Chrome Extension — `whatsapp-bulk-sender/`

| File | Role |
|------|------|
| `manifest.json` | Extension config, permissions, content scripts |
| `popup.html` + `popup.js` | UI: login, message compose, media upload, progress |
| `background.js` | Service worker: queue management, tab control, API calls |
| `content.js` | IPC bridge: relays commands from background → page.js |
| `page.js` | DOM executor: finds send button, clicks, polls for confirm |
| `media-manager.js` | File validation, upload, quota checks |
| `config.js` | Supabase URL + anon key — **NEVER COMMIT** |
| `icons/` | Extension icon assets |

**Message sending flow:**
1. `background.js` queues messages, opens tab to wa.me URL
2. `content.js` waits for WhatsApp UI to load
3. `page.js` finds send button via selector list, falls back to position-based
4. `page.js` clicks button with synthetic mouse events
5. Polls every 500ms (30s max) for button disappearance = success
6. Logs result to backend

---

## Backend Server — `backend-server/`

| File | Role |
|------|------|
| `server.js` | Express app — all API endpoints |
| `.env` | Supabase credentials — **NEVER COMMIT** |
| `scripts/init-selectors.js` | Seeds default selectors into DB |
| `package.json` | Dependencies (express, @supabase/supabase-js, cors, dotenv) |

**API Endpoints:**
```
GET  /api/health            → {success: true}
GET  /api/selectors         → {success, selectors, count, lastUpdated}
POST /api/log-message       → {success, logId, message}
GET  /api/stats             → {success, stats{total, success, failed, rate}}
POST /api/update-selector   → {success, message}
```

---

## Supabase Edge Functions — `supabase/functions/`

| Function | Method | Purpose |
|----------|--------|---------|
| `signup/` | POST | Create user + issue JWT |
| `login/` | POST | Verify password + issue JWT |
| `get-selectors/` | GET | Return dynamic CSS selectors |
| `get-stats/` | GET | Usage stats (plan, limit, sent) |
| `validate-media-upload/` | POST | Check quota, return signed upload URL |
| `process-media-upload/` | POST | Create DB record after upload |
| `get-media-quota/` | GET | Check remaining storage quota |
| `delete-media/` | POST | Soft/permanent delete media |
| `track-event/` | POST | Log analytics event |

---

## Database Schema (18 migrations)

**Key tables:**
- `auth.users` — User accounts with license keys
- `subscription_plans` — Free / Pro / Enterprise tiers
- `media_uploads` — Uploaded file metadata
- `media_quotas` — Daily usage tracking per user
- `message_logs` — Sent message history
- `whatsapp_selectors` / `wa_selectors` — Dynamic CSS selectors
- `analytics_logs` — Usage events
- `admin_users` — Super admin accounts

**Conventions:**
- All tables: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()`
- All tables: `created_at TIMESTAMP DEFAULT NOW()`, `updated_at TIMESTAMP DEFAULT NOW()`
- All `user_id` references: `auth.users(id) ON DELETE CASCADE`
- RLS enabled on all tables (users see only their own data)
- Naming: `snake_case` for tables and columns

---

## Super Admin — `super-admin/`

- Local-only (never deploy publicly)
- Start with: `python -m http.server 8080` → access at `http://localhost:8080`
- Uses Supabase **service role key** (bypasses RLS) — stored in `config/admin-config.js`
- Session expiry: 8 hours
- Provides: user CRUD, subscription management, usage reports

---

## Environment Variables

**`backend-server/.env`** (never commit):
```
SUPABASE_URL=https://isfaiawbywrtwvinkizb.supabase.co
SUPABASE_ANON_KEY=<anon key>
PORT=3000
NODE_ENV=development
```

**`whatsapp-bulk-sender/config.js`** (never commit):
```javascript
const SUPABASE_CONFIG = {
  URL: 'https://isfaiawbywrtwvinkizb.supabase.co',
  ANON_KEY: '<anon key>'
};
```

**`super-admin/config/admin-config.js`** (never commit):
```javascript
const adminConfig = {
  supabaseProjectUrl: '...',
  supabaseServiceRoleKey: '...' // service role — keep secret
};
```

---

## JWT Authentication

- Issued by `signup` and `login` Edge Functions
- Valid for 30 days
- Payload: `{userId, email, iat, exp}`
- Signed with `JWT_SECRET` environment variable
- Stored in: `chrome.storage.local` (extension), `sessionStorage` (admin panel)

---

## Quota / Plan System

| Plan | Messages/Day | Media Retention |
|------|-------------|-----------------|
| Free | 10 | 30 days |
| Pro | 5,000 | 90 days |
| Enterprise | 50,000 | 365 days |

Tracked in `media_quotas` table, resets daily at midnight UTC.

---

## Media Upload System

- Max size: 50MB
- Allowed types: JPEG, PNG, GIF, WebP, MP4, MOV, WebM, PDF
- Encrypted with AES-256 before storage
- Stored in Supabase Storage bucket
- Soft delete first (30-day grace), then permanent delete

---

## Dynamic Selector System

WhatsApp CSS selectors are stored in the DB (`whatsapp_selectors` / `wa_selectors`).
When WhatsApp changes its UI, update selectors in DB — all extensions pick them up automatically. No redeployment needed.

Current selector priority order (in `page.js`):
1. DB-fetched selectors list
2. Position-based fallback (rightmost button in footer)

---

## RULES — CRITICAL

1. **DO NOT touch** `pggchepbleikpkhffahfabfeodghbafd/` or `heogilejknffekkbjdjmoamaehdblmnc/` — competitor reference files only
2. **DO NOT commit** any `.env`, `config.js`, or `admin-config.js` files (contain secrets)
3. **Read the relevant file completely** before making any change
4. **Make only minimal changes** — do not refactor working code
5. **Never add unrequested features** — only implement what is explicitly asked
6. **Test that nothing else breaks** after any change
7. **The admin panel must never be deployed publicly** (exposes service role key)

---

## Development Quick Reference

| Task | Command |
|------|---------|
| Start backend | `cd backend-server && node server.js` |
| Start admin panel | `cd super-admin && python -m http.server 8080` |
| Seed DB selectors | `cd backend-server && node scripts/init-selectors.js` |
| Deploy Edge Functions | `supabase functions deploy <function-name>` |
| Apply DB migrations | `supabase db push` |
| Load extension | Chrome → Extensions → Load Unpacked → `whatsapp-bulk-sender/` |
