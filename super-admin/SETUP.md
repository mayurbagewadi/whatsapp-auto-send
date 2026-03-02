# Super Admin Panel - Quick Setup

## Step 1: Get Service Role Key

1. Go to Supabase: https://supabase.com/dashboard/project/isfaiawbywrtwvinkizb/settings/api
2. Scroll to **Project API keys**
3. Copy `service_role` key (secret key - NOT the anon key)

## Step 2: Update Config

1. Open `super-admin/config/admin-config.js`
2. Replace `YOUR_SERVICE_ROLE_KEY_HERE` with your actual service_role key
3. Save file

## Step 3: Run Migrations in Supabase

Go to Supabase SQL Editor and run these in order:

1. `supabase/migrations/001_auth_tables.sql`
2. `supabase/migrations/002_selectors_tables.sql`
3. `supabase/migrations/003_analytics_tables.sql`
4. `supabase/migrations/004_admin_tables.sql`
5. `supabase/migrations/005_plans_pricing.sql`
6. `supabase/migrations/006_functions.sql`
7. `supabase/migrations/007_rls_policies.sql`

## Step 4: Create Admin User

Run in Supabase SQL Editor:

```sql
-- Create admin user with password "admin123" (CHANGE THIS!)
INSERT INTO admin_users (email, password_hash, role, active) VALUES
(
  'admin@whatsapp.com',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'super_admin',
  true
);
```

## Step 5: Start Admin Panel

**Using Python:**
```bash
cd super-admin
python -m http.server 8080
```

**Using VS Code Live Server:**
- Right-click `super-admin/index.html`
- Select "Open with Live Server"

## Step 6: Login

- Open: http://localhost:8080
- Email: `admin@whatsapp.com`
- Password: `admin123`

⚠️ **CHANGE PASSWORD IMMEDIATELY AFTER LOGIN!**

---

## Features Available:

✅ Dashboard - Stats overview
✅ Analytics - Charts & reports
✅ User Management - CRUD operations
✅ Subscriptions - Manage plans
✅ Usage Tracking - Export data
✅ Audit Logs - Compliance tracking

---

## Security Reminders:

- ❌ NEVER commit service_role key to git
- ❌ NEVER deploy this publicly
- ✅ Run on localhost ONLY
- ✅ Use strong admin password
- ✅ Keep service_role key secret

---

**Project:** WhatsApp Pro Bulk Sender
**Created:** 2026-02-16
