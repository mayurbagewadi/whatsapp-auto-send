# WhatsApp Bulk Sender - Admin Panel

**Enterprise-grade local admin dashboard for managing users, subscriptions, and usage in the WhatsApp Bulk Sender service.**

🔒 **Local-only application** | 🔐 **Supabase service role auth** | 📊 **Real-time analytics**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Features](#features)
- [User Guide](#user-guide)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [API Reference](#api-reference)
- [Contributing](#contributing)

---

## Overview

The Admin Panel is a standalone web application that provides complete management capabilities for the WhatsApp Bulk Sender service:

- **User Management:** Create, edit, suspend, and delete user accounts
- **Subscription Management:** Manage pricing tiers, track active subscriptions, handle upgrades/downgrades
- **Usage Tracking:** Monitor daily/monthly user activity, export reports
- **Dashboard Analytics:** View key metrics, recent activity, revenue tracking
- **Audit Logging:** Track all admin actions for compliance

### Architecture

```
Admin Panel (localhost:8080)
    ↓ (service_role key - FULL database access)
Supabase Database
    ↑ (anon key - restricted access)
Chrome Extension (end users)
```

**Key Points:**
- Runs **locally only** - never deploy publicly
- Uses **service_role key** for unrestricted database access
- **8-hour session expiry** with automatic logout
- **Enterprise-grade security** - SSL/TLS ready, RLS policies enforced
- **Dark mode support** with responsive design

---

## Quick Start

### 1. Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js or Python (for local HTTP server)
- Access to Supabase project

### 2. Setup Admin User (One-time)

Run this in **Supabase SQL Editor**:

```sql
-- Create default admin user
INSERT INTO admin_users (email, full_name, password_hash, role, is_active)
VALUES ('admin@whatsapp-sender.local', 'System Admin', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'admin', true)
ON CONFLICT (email) DO NOTHING;
```

**Default Credentials:**
- Email: `admin@whatsapp-sender.local`
- Password: `test`

### 3. Start Admin Panel

**Option A: Python (Easiest)**
```bash
cd C:\Users\Administrator\Desktop\whatsApp\admin
python -m http.server 8080
```

**Option B: VS Code Live Server**
- Right-click `admin/index.html`
- Select "Open with Live Server"
- Automatically opens at `http://127.0.0.1:5500/admin/`

### 4. Login
- Visit `http://localhost:8080`
- Email: `admin@whatsapp-sender.local`
- Password: `test`

---

## Installation

### Clone the Repository
```bash
git clone <repository-url>
cd whatsApp
```

### Install Dependencies (Optional)
```bash
npm install  # Only needed for future enhancements
```

### Configure Admin Access

1. Open `admin/config/admin-config.js`
2. Verify Supabase credentials:
   - `supabaseProjectUrl`
   - `supabaseServiceRoleKey` ⚠️ Keep this secret!

### Create Initial Admin User

```sql
-- Set your own password hash:
-- 1. Go to https://www.sha256.org/
-- 2. Enter your desired password
-- 3. Copy the SHA256 hash
-- 4. Replace 'YOUR_HASH_HERE' below

UPDATE admin_users
SET password_hash = 'YOUR_HASH_HERE'
WHERE email = 'admin@whatsapp-sender.local';
```

---

## Running Locally

### Start the Server

**Using Python:**
```bash
cd admin
python -m http.server 8080
# Access: http://localhost:8080
```

**Using Node.js:**
```bash
cd admin
npx http-server -p 8080
# Access: http://localhost:8080
```

**Using VS Code:**
1. Install Live Server extension
2. Right-click `admin/index.html`
3. Select "Open with Live Server"

### Access the Panel
- Navigate to `http://localhost:8080`
- Login with your admin credentials
- Session expires after 8 hours of inactivity

### Stop the Server
- Press `Ctrl+C` in the terminal

---

## Features

### 🏠 Dashboard
**Overview of key metrics and recent activity**

- **Statistics Cards:** Total users, active users, suspended users, revenue, messages sent
- **Recent Activity:** Last 10 admin actions with timestamps
- **Quick Actions:** Direct links to create users, manage plans, view usage
- **Session Info:** Remaining session time displayed in header

**Access:** Click "Dashboard" tab after login

---

### 👥 User Management
**Complete user account management**

#### View Users
- Sortable table with email, name, plan, status, creation date
- Search by email or name
- Filter by status (active, suspended, inactive)
- Pagination (20 users per page)

#### Create User
1. Click "➕ Create User" button
2. Enter email address (required)
3. Enter full name (optional)
4. Select subscription plan
5. Click "Save User"

#### Edit User
1. Click "Edit" button on user row
2. Modify details
3. Update subscription plan
4. Save changes

#### Suspend User
1. Click "Suspend" button on user row
2. User cannot login until unsuspended
3. Data remains intact

#### Unsuspend User
1. Click "Unsuspend" button on suspended user row
2. User can login again immediately

#### Delete User
1. Click "Delete" button
2. Confirm deletion
3. User marked as inactive (soft delete)

**Search & Filter:**
- Real-time search by email/name
- Status filter (Active, Suspended, Inactive)
- Pagination controls

**Access:** Click "Users" tab after login

---

### 💳 Subscriptions
**Manage pricing tiers and user subscriptions**

#### Subscription Plans
View 3 default plans with details:

| Plan | Price | Contacts | Messages/Day | Campaigns |
|------|-------|----------|--------------|-----------|
| Free | $0 | 100 | 50 | 1 |
| Pro | $29.99/mo | 5,000 | 5,000 | 50 |
| Enterprise | $99.99/mo | 100,000 | 50,000 | 500 |

#### Plan Actions
- **Edit:** Modify plan details (future enhancement)
- **View Users:** See how many users on this plan

#### Active Subscriptions
- View all user subscriptions in detail
- Billing cycle (monthly/yearly)
- Amount charged
- Subscription period
- Auto-renewal status

#### Manage Subscriptions
1. Search by user email
2. Filter by plan type
3. View subscription details (click "Details")
4. Cancel subscription (click "Cancel")

**Access:** Click "Subscriptions" tab after login

---

### 📈 Usage Tracking
**Monitor user activity and enforce limits**

#### Usage Logs
Real-time tracking of:
- 💬 Messages sent
- 🚀 Campaigns created
- 📇 Contacts imported
- 📝 Templates created

#### Filter Usage
- **By Date:** Select date from calendar
- **By User:** Search user ID
- **Export:** Download logs as CSV or JSON

#### User Usage Details
Click "View" on any log entry to see:
- Total messages sent by user
- Campaign count
- Contact imports
- Template creates
- Daily average activity
- Activity summary

#### Export Usage Data

**CSV Export:**
```csv
User ID, Log Type, Count, Date, Timestamp
```

**JSON Export:**
```json
{
  "exportDate": "2025-02-02T10:30:00Z",
  "totalRecords": 150,
  "logs": [
    {
      "userId": "uuid-123",
      "logType": "message_sent",
      "count": 100,
      "date": "2025-02-02",
      "timestamp": "2025-02-02T10:30:00Z"
    }
  ]
}
```

**Access:** Click "Usage" tab after login

---

### 📋 Audit Logs
**Compliance and security tracking**

All admin actions are logged with:
- Timestamp
- Admin user
- Action type
- Target user affected
- Old/new values
- IP address
- User agent

**View Audit Logs:**
- Search by action or user
- Filter by action type
- Sort by date (newest first)

**Logged Actions:**
- User creation/modification
- Subscription changes
- Admin login/logout
- User suspension/deletion
- Plan modifications

**Access:** Click "Audit Logs" tab after login

---

## User Guide

### Logging In

1. **Open Admin Panel:** `http://localhost:8080`
2. **Enter Credentials:**
   - Email: `admin@whatsapp-sender.local`
   - Password: Your admin password
3. **Click "Sign In"**
4. **Dashboard loads** - You're now authenticated

### Session Management

- **Session Duration:** 8 hours from last activity
- **Session Timer:** Displayed in top-right corner
- **Auto-Logout:** Automatic logout when session expires
- **Re-login Required:** Must login again after expiry

### Dark Mode

- Click 🌙 icon in header to toggle dark mode
- Preference saved in browser
- Respects system dark mode preference

### Creating Your First User

1. Click **"Users"** tab
2. Click **"➕ Create User"** button
3. Fill in form:
   - **Email:** user@example.com
   - **Name:** John Doe
   - **Plan:** Pro ($29.99/month)
   - **Active:** Checked
4. Click **"Save User"**
5. User appears in table immediately

### Assigning Subscriptions

1. Go to **"Subscriptions"** tab
2. View active subscriptions table
3. To change user's plan:
   - Use **Users** tab → Edit user → Change plan
4. New subscription details appear in Subscriptions table

### Exporting Usage Data

1. Go to **"Usage"** tab
2. (Optional) Filter by date or user
3. Click **"📥 Export CSV"** or **"📥 Export JSON"**
4. File downloads to your computer
5. Open with Excel (CSV) or text editor (JSON)

---

## Troubleshooting

### Login Issues

#### "Invalid email or password"
- **Check credentials:** Verify email and password are correct
- **Verify admin user exists:**
  ```sql
  SELECT email, is_active FROM admin_users;
  ```
- **Reset password:**
  ```sql
  UPDATE admin_users
  SET password_hash = 'YOUR_NEW_HASH'
  WHERE email = 'admin@whatsapp-sender.local';
  ```

#### "Too many login attempts"
- Wait 15 minutes or clear localStorage:
  ```javascript
  localStorage.clear(); // In browser console
  ```

#### 404 Error on page load
- **Check file paths:** Ensure all files are in `admin/` directory
- **Check server:** Verify Python/Node server is running
- **Hard refresh:** Press `Ctrl+Shift+R`

### Database Connection Issues

#### "Cannot read property of undefined"
- Check Supabase credentials in `admin/config/admin-config.js`
- Verify service_role key is correct
- Check internet connection

#### Tables don't exist
- Run `DATABASE_SCHEMA.sql` in Supabase SQL Editor
- Verify all 7 new tables were created

#### Permission denied errors
- Check RLS policies in Supabase
- Verify service_role key has access
- Check `admin_users` table exists

### Performance Issues

#### Slow page loads
- Check network tab in DevTools (F12)
- Verify Supabase is responding
- Clear browser cache: `Ctrl+Shift+Delete`

#### Search/filter is slow
- Large datasets (1000+ records) may be slow
- Use date filters to narrow results
- Export data and filter locally

### Dark Mode Not Working
- Clear browser cache
- Check if system dark mode is forcing theme
- Try `localStorage.setItem('admin-theme', 'light')`

### Export Not Working
- Browser may be blocking downloads
- Check browser's download settings
- Try different browser (Chrome/Firefox)

---

## Security

### 🔒 Critical Security Rules

1. **NEVER expose service_role key**
   - Keep `admin/config/admin-config.js` local only
   - Don't commit to public repositories
   - Don't share via email/chat

2. **NEVER deploy publicly**
   - Run on localhost only
   - Use VPN/SSH tunnel if remote access needed
   - Block external access via firewall

3. **Use strong admin passwords**
   - Minimum 16 characters
   - Mix uppercase, lowercase, numbers, symbols
   - Unique (don't reuse passwords)

4. **Rotate credentials regularly**
   - Change admin password every 90 days
   - Rotate Supabase keys quarterly
   - Review audit logs for suspicious activity

5. **Enable HTTPS in production**
   - Use SSL/TLS certificates
   - Self-signed certs for local testing
   - Never send passwords over HTTP

### Session Security

- **8-hour expiry** - automatic logout
- **Session tokens** stored in localStorage
- **No sensitive data** stored in browser
- **Logout clears** all session data

### Row Level Security (RLS)

All database tables have RLS enabled:
- `users` - Service role bypasses (admin access)
- `admin_users` - Service role only
- `admin_audit_logs` - Service role only
- All policies enforce data isolation

### Password Hashing

- **Algorithm:** SHA256 (upgrade to bcrypt recommended)
- **Storage:** One-way hash only (never plaintext)
- **Comparison:** Constant-time to prevent timing attacks
- **No salt:** Consider upgrading to bcrypt with salt

---

## API Reference

### Admin API Class

Located in `admin/assets/js/admin-api.js`

#### User Methods

```javascript
// Get all users
await adminAPI.getAllUsers(limit, offset);

// Get single user
await adminAPI.getUser(userId);

// Get user by email
await adminAPI.getUserByEmail(email);

// Create user
await adminAPI.createUser({
  email: 'user@example.com',
  full_name: 'John Doe',
  subscription_plan_id: 'plan-id'
});

// Update user
await adminAPI.updateUser(userId, {
  full_name: 'Jane Doe',
  is_active: true
});

// Suspend user
await adminAPI.suspendUser(userId, 'Violating ToS');

// Unsuspend user
await adminAPI.unsuspendUser(userId);

// Delete user
await adminAPI.deleteUser(userId);
```

#### Subscription Methods

```javascript
// Get all subscription plans
await adminAPI.getSubscriptionPlans();

// Get subscription plan by ID
await adminAPI.getSubscriptionPlan(planId);

// Create subscription plan
await adminAPI.createSubscriptionPlan({
  name: 'Plus',
  price_monthly: 49.99,
  max_contacts: 10000,
  max_messages_per_day: 10000
});

// Get user subscription
await adminAPI.getUserSubscription(userId);

// Assign plan to user
await adminAPI.assignPlanToUser(userId, planId, 'monthly');

// Cancel subscription
await adminAPI.cancelSubscription(subscriptionId);

// Get payment history
await adminAPI.getUserPayments(userId);
```

#### Usage Methods

```javascript
// Get user usage logs
await adminAPI.getUserUsageLogs(userId, logType);

// Get daily usage
await adminAPI.getDailyUsage(userId, date);

// Get monthly usage summary
await adminAPI.getMonthlyUsageSummary(userId, year, month);

// Check usage limits
await adminAPI.checkUsageLimits(userId);

// Record usage event
await adminAPI.recordUsage(userId, logType, count);
```

#### Dashboard Methods

```javascript
// Get dashboard statistics
await adminAPI.getDashboardStats();
// Returns: total_users, active_users, monthly_revenue, etc.

// Get users count
await adminAPI.getUsersCount(isActive);

// Get revenue by date range
await adminAPI.getRevenueByDateRange(startDate, endDate);
```

#### Audit Methods

```javascript
// Log admin action
await adminAPI.logAuditAction(
  adminUserId,
  'action_name',
  targetUserId,
  oldValues,
  newValues
);

// Get audit logs
await adminAPI.getAuditLogs(limit);

// Get audit logs for user
await adminAPI.getAuditLogsForUser(targetUserId);
```

---

## Contributing

### Code Standards

Follow enterprise standards from `claude.md`:

- **Security First:** Validate all inputs, sanitize outputs
- **Error Handling:** Provide helpful error messages
- **Performance:** Optimize queries and minimize API calls
- **Testing:** Manually test all features
- **Documentation:** Comment complex logic

### Making Changes

1. **Create feature branch:** `git checkout -b feat/my-feature`
2. **Make changes** following code standards
3. **Test thoroughly** - all CRUD operations
4. **Write clear commit message**
5. **Push and create PR** for review

### Reporting Issues

Include:
- Browser and version
- Exact error message
- Steps to reproduce
- Expected behavior
- Actual behavior

---

## Database Schema Reference

### admin_users Table
```sql
id UUID PRIMARY KEY
email VARCHAR(255) UNIQUE
full_name VARCHAR(255)
password_hash VARCHAR(255)
role VARCHAR(50) -- 'admin', 'super_admin'
is_active BOOLEAN
last_login_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

### users Table
```sql
id UUID PRIMARY KEY (from auth.users)
email VARCHAR(255) UNIQUE
full_name VARCHAR(255)
subscription_plan_id UUID FK → subscription_plans
subscription_status VARCHAR(50) -- 'active', 'paused', 'cancelled'
is_active BOOLEAN
is_suspended BOOLEAN
created_at TIMESTAMP
updated_at TIMESTAMP
```

### subscription_plans Table
```sql
id UUID PRIMARY KEY
name VARCHAR(100) -- 'Free', 'Pro', 'Enterprise'
description TEXT
price_monthly NUMERIC
price_yearly NUMERIC
max_contacts INT
max_messages_per_day INT
max_campaigns INT
features JSONB
is_active BOOLEAN
created_at TIMESTAMP
```

### usage_logs Table
```sql
id UUID PRIMARY KEY
user_id UUID FK → users
log_type VARCHAR(50) -- 'message_sent', 'campaign_created', etc.
count INT
log_date DATE
created_at TIMESTAMP
```

### admin_audit_logs Table
```sql
id UUID PRIMARY KEY
admin_user_id UUID FK → admin_users
action VARCHAR(100)
target_user_id UUID FK → users
old_values JSONB
new_values JSONB
ip_address VARCHAR(45)
user_agent TEXT
created_at TIMESTAMP
```

---

## FAQ

### Q: Can I change the admin password?
**A:** Yes. Generate a new SHA256 hash and update the database:
```sql
UPDATE admin_users SET password_hash = 'NEW_HASH' WHERE email = 'admin@whatsapp-sender.local';
```

### Q: Can I add more admin users?
**A:** Yes, but requires SQL:
```sql
INSERT INTO admin_users (email, full_name, password_hash, role, is_active)
VALUES ('admin2@example.com', 'Admin Two', 'HASH_HERE', 'admin', true);
```

### Q: What happens after 8 hours?
**A:** Session expires and you're logged out. You must login again to continue.

### Q: Can I deploy this publicly?
**A:** ⚠️ **NO!** This exposes the service_role key. Keep it local only.

### Q: How do I backup data?
**A:** Supabase handles backups. Export data using the Usage tab (CSV/JSON).

### Q: Is the data encrypted?
**A:** Supabase encrypts at rest and in transit. Passwords use SHA256 hashing.

---

## Support

For issues or questions:

1. **Check Troubleshooting** section above
2. **Review Claude.md** for development standards
3. **Check browser console** (F12) for error messages
4. **Review audit logs** for suspicious activity
5. **Contact development team** for urgent issues

---

## License

This project is proprietary software. All rights reserved.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | Feb 2, 2025 | Enterprise Admin Panel with full CRUD, subscriptions, usage tracking |
| 1.0.0 | Jan 15, 2025 | Initial Chrome Extension foundation |

---

**Last Updated:** February 2, 2025
**Maintained By:** Development Team
**Status:** Production Ready ✅
