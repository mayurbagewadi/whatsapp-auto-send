# Supabase Project Structure

## Organization

This folder contains all Supabase-related code organized by feature:

```
supabase/
  ├── migrations/              SQL migrations (chronological order)
  │   ├── 001_auth_tables.sql         (Users, licenses, auth)
  │   ├── 002_selectors_tables.sql    (Dynamic selectors management)
  │   ├── 003_analytics_tables.sql    (Usage tracking, monitoring)
  │   ├── 004_admin_tables.sql        (Super admin users, roles)
  │   ├── 005_plans_pricing.sql       (Subscription plans)
  │   ├── 006_functions.sql           (Database functions)
  │   └── 007_rls_policies.sql        (Row Level Security)
  │
  ├── functions/               Edge Functions (serverless)
  │   ├── validate-license/    (License validation API)
  │   ├── get-selectors/       (Fetch selectors API)
  │   ├── track-analytics/     (Track usage events)
  │   ├── admin-auth/          (Admin authentication)
  │   └── webhook-stripe/      (Stripe payment webhooks)
  │
  ├── seeds/                   Test/demo data
  │   ├── dev_users.sql        (Test users for development)
  │   └── demo_data.sql        (Demo licenses, analytics)
  │
  └── config.toml              Supabase project config

```

## Features Map

### 1. Authentication & Licensing
- **Tables:** users, admin_users
- **Functions:** validate-license, admin-auth
- **Edge Functions:** validate-license/

### 2. Dynamic Selectors
- **Tables:** selectors, error_reports
- **Functions:** track_selector_usage, increment_error_report
- **Edge Functions:** get-selectors/

### 3. Analytics & Monitoring
- **Tables:** analytics
- **Functions:** (none - direct inserts)
- **Edge Functions:** track-analytics/

### 4. Plans & Pricing
- **Tables:** plans
- **Functions:** reset_daily_limits
- **Edge Functions:** webhook-stripe/

### 5. Admin Management
- **Tables:** admin_users
- **Functions:** (admin queries via RLS)
- **Edge Functions:** admin-auth/

## How to Use

### Apply Migrations (in order):
```bash
# Run each migration in Supabase SQL Editor
# Or use Supabase CLI:
supabase db push
```

### Deploy Edge Functions:
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy validate-license
```

### Load Test Data:
```bash
# Run seed files in SQL Editor for development
```

## Migration Naming Convention

Format: `XXX_feature_description.sql`
- XXX = Sequential number (001, 002, etc.)
- feature = auth, selectors, analytics, admin, etc.
- description = what it does

## Edge Function Naming

Format: `kebab-case/` folder
- validate-license/ (not validateLicense/)
- get-selectors/ (not getSelectors/)

## Notes

- **Never modify existing migrations** - create new ones for changes
- **Edge functions are TypeScript** - auto-transpiled by Supabase
- **Service role key** - Only use in edge functions (server-side)
- **Anon key** - Use in Chrome extension (client-side)
