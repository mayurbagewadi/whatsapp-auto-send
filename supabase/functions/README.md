# Supabase Edge Functions

Edge Functions are **serverless alternatives** to the Node.js backend. Deploy them to Supabase for a fully managed, auto-scaling solution.

## Edge Functions vs Node.js Backend

| Feature | Edge Functions | Node.js Backend |
|---------|---------------|-----------------|
| **Hosting** | Supabase (managed) | Self-hosted (VPS, cloud) |
| **Scaling** | Auto-scales | Manual scaling |
| **Cold start** | ~100-300ms | None (always warm) |
| **Cost** | Free tier available | Server cost |
| **Deployment** | `supabase functions deploy` | `pm2` / docker |
| **Best for** | Production (serverless) | Development / Full control |

---

## Prerequisites

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

---

## Available Functions

| Function | Endpoint | Description |
|----------|----------|-------------|
| `signup` | `/signup` | User registration (email + phone + password) |
| `login` | `/login` | User login (returns JWT token) |
| `get-selectors` | `/get-selectors` | Fetch WhatsApp selectors |
| `track-event` | `/track-event` | Track message sent/failed |
| `get-stats` | `/get-stats` | Get user stats (plan, limits) |

---

## Deployment

### Deploy All Functions

```bash
cd supabase/functions
supabase functions deploy signup
supabase functions deploy login
supabase functions deploy get-selectors
supabase functions deploy track-event
supabase functions deploy get-stats
```

### Deploy Single Function

```bash
supabase functions deploy signup
```

### Set Environment Variables

Edge functions need these secrets:

```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set JWT_SECRET=your-jwt-secret-min-32-chars
```

---

## Update Extension to Use Edge Functions

**Option 1: Use Edge Functions (Supabase hosted)**

Update `background.js`:

```javascript
// Change this:
const API_URL = 'http://localhost:3000/api';

// To this (your Supabase project):
const API_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1';
```

Update endpoint paths:
- `/auth/extension/signup` → `/signup`
- `/auth/extension/login` → `/login`
- `/extension/selectors` → `/get-selectors`
- `/extension/track` → `/track-event`
- `/extension/stats` → `/get-stats`

**Option 2: Use Node.js Backend (Self-hosted)**

Keep current setup:
```javascript
const API_URL = 'http://localhost:3000/api';  // or your deployed backend URL
```

---

## Testing Edge Functions

### Test Signup

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phone":"1234567890","password":"test123"}'
```

### Test Login

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Test Get Stats (with JWT)

```bash
curl https://YOUR_PROJECT.supabase.co/functions/v1/get-stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Logs & Debugging

View function logs:

```bash
supabase functions logs signup
supabase functions logs login --follow
```

---

## Cost Estimation

**Supabase Free Tier**:
- 500,000 function invocations/month
- 2GB bandwidth/month

**Typical Usage**:
- 100 users × 10 messages/day × 2 API calls = 2,000 invocations/day
- **60,000 invocations/month** (well within free tier)

**Paid Tier** ($25/month):
- 2 million invocations/month
- 100GB bandwidth

---

## Migration from Node.js Backend to Edge Functions

1. **Deploy all edge functions** (see above)
2. **Set secrets** in Supabase
3. **Run migration** `009_add_user_password.sql` in Supabase SQL Editor
4. **Update extension**:
   - `manifest.json`: Change host_permissions to `https://YOUR_PROJECT.supabase.co/*`
   - `background.js`: Update `API_URL` to edge functions URL
   - Update endpoint paths (remove `/api/auth/extension` prefix, use root function names)
5. **Test signup/login** in extension
6. **Shutdown Node.js backend** (optional, keep as backup)

---

## Troubleshooting

**CORS errors**:
- Edge functions have CORS enabled (`Access-Control-Allow-Origin: *`)
- Check browser console for specific error

**401 Unauthorized**:
- Verify JWT token is being sent in `Authorization: Bearer TOKEN` header
- Check token hasn't expired (30 days from issue)

**500 Server Error**:
- Check function logs: `supabase functions logs FUNCTION_NAME`
- Verify secrets are set: `supabase secrets list`

**Selectors not loading**:
- Run migration `002_selectors_tables.sql` if not already run
- Check `selectors` table has data

---

## Production Checklist

- [ ] All 5 edge functions deployed
- [ ] Secrets configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET)
- [ ] Database migrations run (001-009)
- [ ] Extension updated with production URLs
- [ ] Test signup → login → send message flow
- [ ] Monitor function logs for errors
- [ ] Set up alerts for function failures (Supabase dashboard)

---

## Hybrid Approach (Recommended)

Use **both** for maximum flexibility:

- **Development**: Node.js backend (`npm run dev`)
- **Production**: Edge functions (auto-scaling, managed)

Keep both codebases in sync. Switch by changing `API_URL` in extension.

---

**Created**: February 2026
**Version**: 1.0.0
**Status**: Production Ready
