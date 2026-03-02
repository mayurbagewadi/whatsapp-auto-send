# Enterprise Media Architecture - Visual Guide

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     CHROME EXTENSION (Client)                      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ popup.html / popup.js                                    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Message Compose Area                           │    │    │
│  │  │  ├─ Text input                                  │    │    │
│  │  │  ├─ 📎 Media Button                             │    │    │
│  │  │  ├─ 😀 Emoji Picker                             │    │    │
│  │  │  ├─ Bold Formatter                              │    │    │
│  │  │  └─ Send Button                                 │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Media Display                                  │    │    │
│  │  │  ├─ File icon 📷 📄 🎥                          │    │    │
│  │  │  ├─ Filename                                    │    │    │
│  │  │  ├─ File size                                   │    │    │
│  │  │  └─ ✕ Remove button                             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Upload Progress                               │    │    │
│  │  │  ├─ Progress bar: ━━━━━━━░░░░░  45%           │    │    │
│  │  │  └─ Status: Uploading...                       │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Quota Display                                  │    │    │
│  │  │  ├─ Files Today: 3/10                           │    │    │
│  │  │  │  ━━━━━━━━━░░░░░░░  30%                      │    │    │
│  │  │  └─ Storage: 125MB / 10GB                       │    │    │
│  │  │     ━━━☒░░░░░░░░░░░░░░░░░  1.2%               │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ background.js (Service Worker)                          │    │
│  │                                                           │    │
│  │  ├─ Token Storage                                        │    │
│  │  ├─ Message Router                                       │    │
│  │  │  ├─→ checkMediaFeature                               │    │
│  │  │  ├─→ getMediaQuota                                   │    │
│  │  │  ├─→ deleteMedia                                     │    │
│  │  │  └─→ Message Sending                                 │    │
│  │  │                                                       │    │
│  │  └─ Local Storage Management                             │    │
│  │     ├─ userToken                                         │    │
│  │     ├─ userData                                          │    │
│  │     └─ subscriptionPlans                                 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ media-manager.js (Client Library)                       │    │
│  │                                                           │    │
│  │  ├─ validateFile()          ← File validation          │    │
│  │  ├─ getQuota()              ← Quota fetch              │    │
│  │  ├─ validateUpload()        ← Pre-upload validation    │    │
│  │  ├─ uploadToStorage()       ← Direct browser upload    │    │
│  │  ├─ uploadChunked()         ← Large file chunking      │    │
│  │  ├─ calculateHash()         ← File hash calc           │    │
│  │  ├─ processUpload()         ← Post-process            │    │
│  │  ├─ uploadMedia()           ← Full orchestration       │    │
│  │  ├─ deleteMedia()           ← Delete handler           │    │
│  │  ├─ canUpload()             ← Permission check         │    │
│  │  └─ Utilities                                            │    │
│  │     ├─ formatBytes()                                     │    │
│  │     ├─ getFileTypeLabel()                                │    │
│  │     └─ isImage/isVideo/isDocument()                      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                ↓↓↓ HTTPS/TLS
                           JWT in Headers
┌────────────────────────────────────────────────────────────────────┐
│          SUPABASE EDGE FUNCTIONS (Serverless API Layer)            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ validate-media-upload                                    │    │
│  │                                                           │    │
│  │  Request: {fileName, fileSize, fileType}                │    │
│  │     ↓                                                     │    │
│  │  1. Verify JWT token                                    │    │
│  │  2. Get user's plan                                     │    │
│  │  3. Check media feature enabled                         │    │
│  │  4. Validate daily file quota                           │    │
│  │  5. Validate monthly storage quota                      │    │
│  │  6. Generate encryption key + IV                        │    │
│  │  7. Create signed upload URL (1 hr expiry)             │    │
│  │  8. Log validation attempt                              │    │
│  │     ↓                                                     │    │
│  │  Response: {uploadUrl, storagePath, fileId, quotaStatus}│    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ get-media-quota                                          │    │
│  │                                                           │    │
│  │  Request: JWT only                                       │    │
│  │     ↓                                                     │    │
│  │  1. Verify JWT token                                    │    │
│  │  2. Get user's subscription plan                        │    │
│  │  3. Load plan settings (daily/monthly limits)           │    │
│  │  4. Query today's quota record                          │    │
│  │  5. Calculate remaining quota                           │    │
│  │  6. Count all-time uploads                              │    │
│  │     ↓                                                     │    │
│  │  Response: {quotaStatus with all metrics}               │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ process-media-upload                                    │    │
│  │                                                           │    │
│  │  Request: {storagePath, fileName, fileSize, fileId}     │    │
│  │     ↓                                                     │    │
│  │  1. Verify JWT token                                    │    │
│  │  2. Check for duplicates (MD5)                          │    │
│  │  3. Get user's plan for retention                       │    │
│  │  4. Generate AES-256 encryption keys                    │    │
│  │  5. Insert media_uploads record                         │    │
│  │  6. Upsert media_quotas (trigger updates)               │    │
│  │  7. Upsert media_analytics                              │    │
│  │  8. Insert access log                                   │    │
│  │     ↓                                                     │    │
│  │  Response: {mediaId, mediaRecord, success}              │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ delete-media                                             │    │
│  │                                                           │    │
│  │  Request: {mediaId, permanent?, reason?}                │    │
│  │     ↓                                                     │    │
│  │  Soft Delete Path:                                      │    │
│  │  1. Verify JWT + ownership                              │    │
│  │  2. Mark status = 'deleted'                             │    │
│  │  3. Set deleted_at timestamp                            │    │
│  │  4. Schedule permanent deletion (30 days)               │    │
│  │  5. Log deletion event                                  │    │
│  │                                                           │    │
│  │  Permanent Delete Path:                                 │    │
│  │  1. Verify JWT + ownership                              │    │
│  │  2. Delete from storage bucket                          │    │
│  │  3. Delete from database                                │    │
│  │  4. Log permanent deletion                              │    │
│  │     ↓                                                     │    │
│  │  Response: {success, message, deletedAt}                │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                ↓↓↓
                        TCP Connection to
                        PostgreSQL Database
┌────────────────────────────────────────────────────────────────────┐
│       SUPABASE DATABASE & STORAGE (Data Persistence Layer)         │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ PostgreSQL Database Tables                              │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ media_uploads (1M+ records)                     │    │    │
│  │  │ ├─ id: UUID                                     │    │    │
│  │  │ ├─ user_id: UUID (FK)                           │    │    │
│  │  │ ├─ filename, file_type, file_size               │    │    │
│  │  │ ├─ storage_path, storage_bucket                 │    │    │
│  │  │ ├─ md5_hash, encryption_key, iv                 │    │    │
│  │  │ ├─ status: uploaded|sent|failed|deleted         │    │    │
│  │  │ ├─ retention_days, gdpr_deletion_scheduled       │    │    │
│  │  │ ├─ scanned_for_malware, malware_scan_result      │    │    │
│  │  │ ├─ upload_ip, user_agent                         │    │    │
│  │  │ ├─ created_at, updated_at, deleted_at            │    │    │
│  │  │ └─ Indexes: user_id, created_at, status, md5_hash│    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ media_quotas (grows daily)                      │    │    │
│  │  │ ├─ id, user_id (FK), plan_id                    │    │    │
│  │  │ ├─ quota_date (today's date)                    │    │    │
│  │  │ ├─ files_uploaded, total_size_bytes             │    │    │
│  │  │ ├─ quota_exceeded (boolean flag)                │    │    │
│  │  │ ├─ files_limit, size_limit_bytes                │    │    │
│  │  │ └─ Index: (user_id, quota_date)                 │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ media_access_logs (audit trail)                 │    │    │
│  │  │ ├─ id, user_id, media_id (FK)                   │    │    │
│  │  │ ├─ action: upload|send|delete|download|access  │    │    │
│  │  │ ├─ success, error_message                       │    │    │
│  │  │ ├─ ip_address, user_agent, timestamp            │    │    │
│  │  │ └─ Index: (user_id, timestamp DESC)             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ media_analytics (reporting)                     │    │    │
│  │  │ ├─ id, plan_id, analytics_date                  │    │    │
│  │  │ ├─ total_uploads, successful_uploads            │    │    │
│  │  │ ├─ failed_uploads, total_size_bytes             │    │    │
│  │  │ ├─ unique_users_uploaded                        │    │    │
│  │  │ ├─ quota_exceeded_incidents, total_deleted      │    │    │
│  │  │ └─ Index: (plan_id, analytics_date)             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ media_plan_settings (configuration)             │    │    │
│  │  │ ├─ id, plan_id (UNIQUE)                         │    │    │
│  │  │ ├─ media_upload_enabled (boolean)               │    │    │
│  │  │ ├─ daily_file_limit, monthly_file_limit         │    │    │
│  │  │ ├─ max_file_size_bytes (50MB)                   │    │    │
│  │  │ ├─ monthly_storage_limit_gb                     │    │    │
│  │  │ ├─ default_retention_days                       │    │    │
│  │  │ ├─ allow_permanent_storage                      │    │    │
│  │  │ └─ compression_enabled, encryption_enabled      │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Triggers (Automatic)                            │    │    │
│  │  │ ├─ update_media_uploads_timestamp               │    │    │
│  │  │ ├─ update_quota_on_media_upload                 │    │    │
│  │  │ └─ log_media_access                             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Functions (SQL)                                 │    │    │
│  │  │ └─ check_media_quota()                          │    │    │
│  │  │    Returns: allowed, reason, files_remaining,   │    │    │
│  │  │    storage_remaining                             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Row-Level Security (RLS)                        │    │    │
│  │  │ ├─ media_uploads: users access own only         │    │    │
│  │  │ ├─ media_quotas: users see own quotas           │    │    │
│  │  │ ├─ media_access_logs: users see own logs        │    │    │
│  │  │ ├─ media_analytics: public read-only            │    │    │
│  │  │ └─ media_plan_settings: public read-only        │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Supabase Storage Bucket: media-files                    │    │
│  │                                                           │    │
│  │  File Structure:                                         │    │
│  │  media-files/                                            │    │
│  │  └── {user_id}/                                          │    │
│  │      ├── 1708689600000-a1b2c3d4-e5f6-4g7h-8i9j-...jpg  │    │
│  │      ├── 1708689612000-f0e1d2c3-b4a5-6h7g-8f9e-...mp4  │    │
│  │      └── 1708689625000-z9y8x7w6-v5u4-3t2s-1r0q-...pdf  │    │
│  │                                                           │    │
│  │  File Security:                                          │    │
│  │  ├─ Signed URLs (1 hour expiry)                         │    │
│  │  ├─ Private visibility                                   │    │
│  │  ├─ Encryption at rest (AES-256)                        │    │
│  │  ├─ HTTPS/TLS for all transfers                         │    │
│  │  └─ Lifecycle policies (auto-deletion)                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                ↓↓↓
┌────────────────────────────────────────────────────────────────────┐
│           SUPER-ADMIN PANEL (Management Interface)                 │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Subscription Plans Page                                  │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Plan Card (Pro Plan)                            │    │    │
│  │  │ ├─ Plan Name: Pro                               │    │    │
│  │  │ ├─ Price: $29/month, $290/year (save 17%)      │    │    │
│  │  │ ├─ Features:                                    │    │    │
│  │  │ │  ├─ 💬 10,000 Messages/Day                    │    │    │
│  │  │ │  ├─ 📎 Media Upload (Images, Videos, PDF)   │    │    │
│  │  │ │  └─ ✓ Advanced Analytics                      │    │    │
│  │  │ ├─ [Edit Button]  [Delete Button]              │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Edit Plan Modal                                 │    │    │
│  │  │ ├─ Plan Name: [Pro________________]             │    │    │
│  │  │ ├─ Price Monthly: [$29____________]             │    │    │
│  │  │ ├─ Price Yearly: [$290____________]             │    │    │
│  │  │ ├─ Messages Per Day: [10000________]            │    │    │
│  │  │ ├─ ☑ Unlimited Messages                         │    │    │
│  │  │ ├─ ☑ Allow Media Upload (Images, Videos, PDF)  │    │    │
│  │  │ ├─ ☑ Active                                      │    │    │
│  │  │ └─ [Save]  [Cancel]                             │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Active Subscriptions Table                       │    │    │
│  │  │ ┌────────┬────┬─────┬────────┬────────┬────────┐│    │    │
│  │  │ │ Email  │Plan│ $amt│ Status │Created │ Action││    │    │
│  │  │ ├────────┼────┼─────┼────────┼────────┼────────┤│    │    │
│  │  │ │user@...|Pro │ $29 │ Active │ Jan 23 │Details││    │    │
│  │  │ │user@...|Ent │ $99 │ Active │ Jan 20 │ Cancel││    │    │
│  │  │ └────────┴────┴─────┴────────┴────────┴────────┘│    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  │                                                           │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │ Media Usage Analytics                           │    │    │
│  │  │ ├─ Total Uploads: 1,250                         │    │    │
│  │  │ ├─ Storage Used: 125 GB                         │    │    │
│  │  │ ├─ Quota Exceeded Incidents: 12                 │    │    │
│  │  │ ├─ Active Uploaders: 185 users                  │    │    │
│  │  │ └─ Average File Size: 102 MB                    │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### Upload Flow

```
User selects file
        ↓
[popup.js] validateFile() (client validation)
        ↓ (if valid)
[media-manager.js] validateUpload()
        ↓ (HTTP POST)
[Edge Function] validate-media-upload
        ├─ Verify JWT
        ├─ Check plan settings
        ├─ Check quotas
        └─ Generate signed URL
        ↓ (return uploadUrl + fileId)
[Browser] uploadToStorage()
        ├─ Direct POST to signed URL
        ├─ Track progress
        └─ No server-side re-upload
        ↓ (file now in storage)
[media-manager.js] processUpload()
        ↓ (HTTP POST)
[Edge Function] process-media-upload
        ├─ Verify JWT
        ├─ Generate encryption keys
        ├─ Create media_uploads record
        ├─ Update media_quotas (trigger fires)
        ├─ Update media_analytics (upsert)
        └─ Log access event
        ↓ (return mediaId)
[popup.js] displayMediaFile()
        ├─ Show file preview
        ├─ Update quota display
        └─ Success notification
```

### Quota Check Flow

```
[popup.js] handleMediaButtonClick()
        ↓
[media-manager.js] canUpload()
        ↓ (HTTP GET)
[Edge Function] get-media-quota
        ├─ Verify JWT
        ├─ Get plan settings
        ├─ Query today's quota
        └─ Calculate remaining
        ↓ (return quotaStatus)
[popup.js] Check quotaStatus
        ├─ IF mediaUploadEnabled && filesRemaining > 0 && storageRemaining > 0
        │   └─→ Show file picker ✅
        └─ ELSE
            └─→ Show subscription block message ❌
```

### Delete Flow

```
[popup.js] removeMedia(mediaId)
        ↓
[media-manager.js] deleteMedia(mediaId, permanent=false)
        ↓ (HTTP POST)
[Edge Function] delete-media
        ├─ Verify JWT + ownership
        ├─ IF soft delete:
        │   ├─ Mark status = 'deleted'
        │   ├─ Set gdpr_deletion_scheduled (30 days)
        │   └─ Log deletion
        └─ ELSE (permanent):
            ├─ Delete from storage
            ├─ Delete from database
            └─ Log permanent deletion
        ↓
[popup.js] removeMediaFromUI()
        └─ Hide media display
```

---

## Security Layers

```
Layer 1: Transport Layer
├─ HTTPS/TLS 1.3
├─ All traffic encrypted
└─ Certificate pinning (optional)

Layer 2: Authentication Layer
├─ JWT token verification
├─ Expiry validation
├─ HMAC-SHA256 signature check
└─ Token in Authorization header

Layer 3: Authorization Layer
├─ Row-Level Security (RLS)
├─ Users access own data only
├─ Service role for backend ops
└─ Admin role for super-admin

Layer 4: Data Layer
├─ AES-256 encryption keys
├─ Initialization vectors (random)
├─ Encrypted storage at rest
└─ File hash for duplicates

Layer 5: Application Layer
├─ Input validation (client + server)
├─ File type whitelist
├─ File size limits
├─ Quota enforcement
└─ Rate limiting
```

---

## Deployment Architecture

```
Developer Machine
    ↓
supabase db push
    ↓
Supabase Cloud
├─ PostgreSQL Database
├─ Storage Bucket
├─ Edge Functions
├─ Authentication
└─ Row-Level Security

    ↓
Chrome Web Store / Enterprise Distribution
    ↓
User's Chrome Browser
├─ Extension installed
├─ popup.js loaded
├─ background.js running
└─ media-manager.js available

    ↓
Super-Admin Dashboard
├─ Admin panel
├─ Plan configuration
└─ Analytics viewing
```

---

## Component Interactions

```
┌─────────────────────────────────────────────────────────────┐
│ Component Relationship Diagram                              │
│                                                             │
│  popup.js                                                  │
│      ↑   ↓                                                  │
│  background.js ←→ Chrome Storage (local)                   │
│      ↑   ↓                                                  │
│  media-manager.js                                          │
│      ↓                                                      │
│  Supabase Edge Functions                                   │
│      ↓                                                      │
│  PostgreSQL Database                                       │
│      ↓                                                      │
│  Supabase Storage Bucket                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Scalability Considerations

```
Single User → Multiple Users → Enterprise Scale

Small Scale (< 100 users):
├─ Single edge function instance
├─ Direct database queries
├─ No caching needed
└─ Monthly: ~100 MB storage

Medium Scale (100-10K users):
├─ Function auto-scaling
├─ Connection pooling
├─ Redis caching (plan settings)
└─ Monthly: ~100 GB storage

Enterprise Scale (10K+ users):
├─ Multi-region functions
├─ Database read replicas
├─ Bucket replication
├─ CDN for signed URLs
├─ Scheduled cleanup jobs
└─ Monthly: ~1+ TB storage
```

---

**This architecture is designed to be:**
- ✅ Scalable (from 1 to 1M users)
- ✅ Secure (encryption at every layer)
- ✅ Compliant (GDPR-ready)
- ✅ Observable (comprehensive logging)
- ✅ Maintainable (well-documented)
- ✅ Cost-effective (serverless, pay-per-use)

