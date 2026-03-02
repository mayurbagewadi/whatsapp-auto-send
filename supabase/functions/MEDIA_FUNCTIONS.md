# Media Management Edge Functions

Enterprise-grade Supabase Edge Functions for production media handling with quota management, encryption, and GDPR compliance.

## Overview

These four serverless functions provide the complete API layer for the media upload system:

1. **validate-media-upload** - Pre-upload validation and signed URL generation
2. **get-media-quota** - Real-time quota status and limits
3. **process-media-upload** - Post-upload processing and encryption
4. **delete-media** - Soft deletion with GDPR compliance scheduling

## Architecture

```
Chrome Extension (popup.js)
    ↓
    ├─→ validate-media-upload → Quota check → Signed URL
    ├─→ Direct Storage Upload
    ├─→ process-media-upload → Encryption + Analytics
    ├─→ get-media-quota → Current limits
    └─→ delete-media → Soft/Hard delete
```

## Function Details

### 1. validate-media-upload

**Purpose**: Pre-upload validation and signed URL generation

**Endpoint**: `POST /functions/v1/validate-media-upload`

**Request**:
```typescript
{
  fileName: string;           // Original filename
  fileSize: number;           // File size in bytes (max 50MB)
  fileType: string;           // MIME type (image/*, video/*, application/pdf)
}
```

**Response (Success)**:
```typescript
{
  success: true;
  uploadUrl: string;          // Signed URL for direct upload
  token: string;              // Upload token
  storagePath: string;        // Storage path in bucket
  fileId: string;             // UUID for media tracking
  quotaStatus: {
    filesUsed: number;        // Files uploaded today
    filesLimit: number | "unlimited";
    storageUsedMB: number;
    storageLimitGB: number | "unlimited";
  };
}
```

**Error Responses**:
- `400`: Missing fields, file too large, invalid file type
- `403`: Feature not enabled for plan
- `429`: Daily quota exceeded
- `401`: Unauthorized
- `404`: User not found
- `500`: Server error

**Validation Rules**:
- Max file size: 50MB
- Allowed types: JPEG, PNG, GIF, WebP, MP4, MOV, WebM, PDF
- Daily file limit: Per plan (0 = unlimited)
- Monthly storage limit: Per plan (0 = unlimited)

**Code Flow**:
```
1. Verify JWT token
2. Get user's subscription plan
3. Load plan media settings
4. Check if media upload enabled
5. Query today's quota
6. Validate file count limit
7. Validate storage limit
8. Generate unique storage path
9. Create signed upload URL (1 hour expiry)
10. Log validation attempt
11. Return signed URL + quota status
```

### 2. get-media-quota

**Purpose**: Retrieve current media quota and usage

**Endpoint**: `GET /functions/v1/get-media-quota`

**Request**:
```
Authorization: Bearer {JWT_TOKEN}
```

**Response**:
```typescript
{
  success: true;
  quotaStatus: {
    mediaUploadEnabled: boolean;
    plan: string;

    // Daily file limits
    filesUsed: number;
    filesLimit: number;
    filesRemaining: number;      // -1 = unlimited

    // Monthly storage limits
    storageUsedMB: number;
    storageLimitGB: number;
    storageRemainingMB: number;  // -1 = unlimited

    // Overall stats
    totalUploadsAllTime: number;

    // User-friendly message
    message: string;
  };
}
```

**Use Cases**:
- Show quota progress in extension UI
- Warn user when approaching limits
- Disable media button when quota exceeded
- Display plan limits and current usage

**Example Integration** (popup.js):
```javascript
async function updateQuotaDisplay() {
  const response = await chrome.runtime.sendMessage({
    action: 'getMediaQuota',
    token: userToken
  });

  if (response.quotaStatus.filesRemaining === 0) {
    disableMediaUpload('Daily file limit reached');
  } else {
    showQuotaProgress(response.quotaStatus);
  }
}
```

### 3. process-media-upload

**Purpose**: Post-upload processing, encryption, and analytics

**Endpoint**: `POST /functions/v1/process-media-upload`

**Request**:
```typescript
{
  storagePath: string;        // From validate-media-upload response
  fileName: string;
  fileSize: number;
  fileType: string;
  fileId: string;             // UUID from validate response
  md5Hash?: string;           // File hash for duplicate detection
  whatsappMessageId?: string; // Link to WhatsApp message
}
```

**Response**:
```typescript
{
  success: true;
  mediaId: string;
  message: string;
  mediaRecord: {
    id: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    retentionDays: number;
  };
}
```

**Processing Steps**:
1. Verify JWT token
2. Check for duplicate files (same MD5 for same user)
3. Generate encryption key and IV (AES-256)
4. Create media_uploads record with:
   - Encryption metadata
   - Status = 'uploaded'
   - Retention days (from plan settings)
   - IP address and user agent
5. Update media_quotas table
6. Update media_analytics table
7. Log access event
8. Return media ID and metadata

**Encryption**:
- Algorithm: AES-256
- IV: 128-bit random
- Key: 256-bit random
- Storage: Encrypted in database (production should use key management service)

**Retention Policy**:
- Free plan: 30 days
- Pro plan: 90 days
- Enterprise: 365 days
- Automatic deletion scheduler (separate process)

### 4. delete-media

**Purpose**: Soft or permanent deletion of media files

**Endpoint**: `POST /functions/v1/delete-media`

**Request**:
```typescript
{
  mediaId: string;
  permanent?: boolean;        // true = immediate hard delete, false = soft delete (default)
  reason?: string;            // user_request, gdpr_compliance, retention_expired
}
```

**Response (Soft Delete)**:
```typescript
{
  success: true;
  message: "Media marked for deletion (will be permanently deleted in 30 days)";
  mediaId: string;
  deletedAt: string;
  permanentDeletionDate: string;
}
```

**Response (Permanent Delete)**:
```typescript
{
  success: true;
  message: "Media permanently deleted";
  mediaId: string;
  deletedAt: string;
}
```

**Soft Delete Flow** (GDPR Compliant):
1. Mark status = 'deleted'
2. Set deleted_at timestamp
3. Schedule permanent deletion in 30 days (GDPR_deletion_scheduled)
4. File remains accessible if user restores within 30 days
5. Storage not freed immediately

**Hard Delete Flow**:
1. Delete from Supabase Storage bucket
2. Remove from media_uploads table
3. Free storage quota immediately
4. Log permanent deletion event

**Permissions**:
- Users can only delete their own media
- Admin can delete any user's media (via separate admin function)

## Integration with Chrome Extension

### popup.js Integration

```javascript
// 1. Before upload - validate and get signed URL
async function uploadMedia(file) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/validate-media-upload`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    showError(data.error);
    return;
  }

  // 2. Upload directly to Storage using signed URL
  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'POST',
    body: file,
  });

  // 3. Process upload metadata
  const processResponse = await fetch(
    `${SUPABASE_URL}/functions/v1/process-media-upload`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        storagePath: data.storagePath,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileId: data.fileId,
      }),
    }
  );

  const processed = await processResponse.json();
  displayUploadedMedia(processed.mediaRecord);
}

// 2. Get current quota
async function checkQuota() {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/get-media-quota`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    }
  );

  const data = await response.json();
  updateQuotaUI(data.quotaStatus);
}

// 3. Delete media
async function deleteMedia(mediaId) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/delete-media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        mediaId,
        permanent: false, // Soft delete
      }),
    }
  );

  const data = await response.json();
  removeMediaFromUI(mediaId);
}
```

## Deployment

### Prerequisites
1. Supabase project with media schema migrated (014_media_infrastructure.sql)
2. Media storage bucket created: `media-files`
3. RLS policies configured on media tables
4. JWT_SECRET environment variable set

### Deploy Functions

```bash
# Deploy all media functions to Supabase
supabase functions deploy validate-media-upload
supabase functions deploy get-media-quota
supabase functions deploy process-media-upload
supabase functions deploy delete-media

# Check deployment status
supabase functions list

# View logs
supabase functions logs validate-media-upload
```

### Environment Variables (set in Supabase dashboard)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
JWT_SECRET=your-jwt-secret
```

## Security Considerations

### Authentication
- All functions verify JWT token
- Token must be valid and not expired
- Validates user ownership of media records

### Authorization
- Users can only access their own media
- RLS policies enforce row-level security
- Service role used for trusted operations only

### Storage Security
- Signed URLs expire after 1 hour
- Direct uploads to Storage (no server-side re-upload)
- Files encrypted at rest (AES-256)
- HTTPS/TLS for all transfers

### Quota Enforcement
- Checked before upload (validate function)
- Checked again on processing (prevent race conditions)
- Database-level constraints prevent quota overflow

### GDPR Compliance
- Soft delete with 30-day recovery window
- Permanent deletion scheduling
- Audit logs for all access
- IP and user agent tracking
- IP geolocation optional for GDPR zones

## Performance Optimization

### Caching
- Plan settings cached in extension (refreshed hourly)
- Quota data cached client-side (refresh on upload)
- Use CloudFront for signed URL distribution

### Indexes
- `idx_user_id` on media_uploads
- `idx_user_date` on media_quotas
- `idx_user_timestamp` on media_access_logs
- `idx_md5_user` for duplicate detection

### Batching
- Process multiple deletions in single batch
- Update analytics once per day
- Aggregate logs hourly

## Error Handling

### Client-Side (popup.js)
```javascript
async function handleUploadError(error) {
  if (error.code === 'QUOTA_EXCEEDED_FILES') {
    showError('Daily file limit reached');
  } else if (error.code === 'QUOTA_EXCEEDED_STORAGE') {
    showError('Storage limit exceeded');
  } else if (error.code === 'FILE_TOO_LARGE') {
    showError('File exceeds 50MB limit');
  } else if (error.code === 'INVALID_FILE_TYPE') {
    showError('File type not supported');
  } else if (error.code === 'FEATURE_NOT_ENABLED') {
    showSubscriptionModal('Media upload');
  }
}
```

### Server-Side
- All errors logged to Deno console
- Error codes returned for client handling
- Detailed messages for debugging
- Production: Use Sentry for error tracking

## Monitoring & Analytics

### Metrics Tracked
- Total uploads per plan
- Successful vs failed uploads
- Storage usage by plan
- Quota exceeded incidents
- Unique users uploading
- Average file size
- Popular file types

### Database Views
```sql
-- Monthly usage by plan
SELECT
  plan_id,
  DATE_TRUNC('month', analytics_date) AS month,
  SUM(total_uploads) as uploads,
  SUM(total_size_bytes) / (1024*1024*1024) as storage_gb
FROM media_analytics
GROUP BY plan_id, DATE_TRUNC('month', analytics_date);

-- User activity
SELECT
  user_id,
  COUNT(*) as upload_count,
  SUM(file_size) / (1024*1024) as total_mb
FROM media_uploads
WHERE status = 'uploaded'
GROUP BY user_id
ORDER BY upload_count DESC;
```

## Roadmap

- [ ] Malware scanning integration (ClamAV)
- [ ] Image optimization and compression
- [ ] Video thumbnail generation
- [ ] OCR text extraction
- [ ] Backup and disaster recovery
- [ ] Bucket replication across regions
- [ ] Advanced analytics dashboard
- [ ] Webhooks for upload events

## Support & Troubleshooting

**Signed URL generation failing?**
- Check service role key is correct
- Verify bucket exists and RLS allows service role
- Check function logs: `supabase functions logs validate-media-upload`

**Quota updates not working?**
- Verify media_quotas table has RLS enabled
- Check triggers are firing: `SELECT last_trigger_result FROM pg_stat_user_tables WHERE relname = 'media_quotas'`
- Confirm plan settings exist in media_plan_settings

**Storage files not being deleted?**
- Check bucket permissions
- Verify file path is correct
- Check storage logs in Supabase dashboard

**Performance issues?**
- Monitor function execution time in logs
- Check for N+1 queries (use single vs lookup)
- Enable query caching for plan settings
- Use database indexes for user_id queries
