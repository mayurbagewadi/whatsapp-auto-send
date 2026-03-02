import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as crypto from 'https://deno.land/std@0.208.0/crypto/mod.ts';

// ─── RATE LIMITING ─────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const key = `process-upload:${userId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    entry = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  const allowed = entry.count < maxRequests;
  entry.count++;

  return {
    allowed,
    remaining: Math.max(0, maxRequests - entry.count),
  };
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'https://isfaiawbywrtwvinkizb.supabase.co',
  ];

  const origin = (requestOrigin && allowedOrigins.includes(requestOrigin)) ? requestOrigin : 'null';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(data: unknown, status = 200, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Supabase Client ──────────────────────────────────────────────────────────
function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
}

// ─── JWT Verify ───────────────────────────────────────────────────────────────
const encoder = new TextEncoder();

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, b64Sig] = parts;
    const secret = Deno.env.get('JWT_SECRET') ?? '';

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(atob(b64Sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${b64Header}.${b64Payload}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(b64Payload.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
      )
    );

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

// ─── Calculate MD5 Hash ───────────────────────────────────────────────────────
async function calculateMd5(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer '))
      return jsonResponse({ success: false, error: 'No authentication provided' }, 401, cors);

    const userId = await verifyJWT(authHeader.split(' ')[1]);
    if (!userId)
      return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401, cors);

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return jsonResponse({
        success: false,
        error: 'Rate limit exceeded. Maximum 10 requests per minute',
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: rateLimit.remaining,
      }, 429, cors);
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return jsonResponse({ success: false, error: 'Invalid JSON request body' }, 400, cors);
    }

    const {
      storagePath,
      fileName,
      fileSize,
      fileType,
      fileId,
      md5Hash,
      whatsappMessageId,
    } = body;

    // ===== INPUT VALIDATION (CRITICAL) =====
    // Validate required fields exist and are correct type
    if (typeof storagePath !== 'string' || !storagePath)
      return jsonResponse({ success: false, error: 'Invalid: storagePath required' }, 400, cors);

    if (typeof fileName !== 'string' || !fileName || fileName.length > 500)
      return jsonResponse({ success: false, error: 'Invalid: fileName (max 500 chars)' }, 400, cors);

    if (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > 52428800)
      return jsonResponse({ success: false, error: 'Invalid: fileSize must be 1-50MB' }, 400, cors);

    if (typeof fileType !== 'string' || !fileType || fileType.length > 100)
      return jsonResponse({ success: false, error: 'Invalid: fileType' }, 400, cors);

    if (typeof fileId !== 'string' || !fileId.match(/^[0-9a-f\-]{36}$/i))
      return jsonResponse({ success: false, error: 'Invalid: fileId must be UUID' }, 400, cors);

    // Validate file type is allowed
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'application/pdf',
    ];
    if (!allowedTypes.includes(fileType))
      return jsonResponse({ success: false, error: 'Invalid: fileType not allowed' }, 400, cors);

    // Validate UUID format for fileId
    if (!fileId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId))
      return jsonResponse({ success: false, error: 'Invalid: fileId format' }, 400, cors);

    if (!storagePath || !fileName || !fileSize || !fileType || !fileId) {
      return jsonResponse({
        success: false,
        error: 'Missing required fields',
      }, 400, cors);
    }

    const supabase = getServiceClient();

    // Check for duplicate uploads (same file for same user)
    if (md5Hash) {
      const { data: existing } = await supabase
        .from('media_uploads')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('md5_hash', md5Hash)
        .eq('status', 'uploaded')
        .single();

      if (existing) {
        // Create a new record anyway but link to existing file
        console.log(`Duplicate file detected: ${md5Hash}`);
      }
    }

    // Get user's plan for retention settings
    const { data: user } = await supabase
      .from('users')
      .select('plan')
      .eq('id', userId)
      .single();

    const { data: planSettings } = await supabase
      .from('media_plan_settings')
      .select('default_retention_days')
      .eq('plan_id', user?.plan || 'free')
      .single();

    const retentionDays = planSettings?.default_retention_days ?? 90;

    // Generate encryption key and IV (in production, use proper key management)
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const encryptionKeyHex = Array.from(encryptionKey).map(b => b.toString(16).padStart(2, '0')).join('');
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

    // Create media_uploads record
    const { data: mediaRecord, error: insertError } = await supabase
      .from('media_uploads')
      .insert({
        id: fileId,
        user_id: userId,
        filename: fileName,
        original_filename: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
        storage_bucket: 'media-files',
        md5_hash: md5Hash || 'uncomputed',
        encryption_key: encryptionKeyHex, // In production, encrypt this with a master key
        iv: ivHex,
        whatsapp_message_id: whatsappMessageId || null,
        status: 'uploaded',
        retention_days: retentionDays,
        scanned_for_malware: false,
        upload_ip: req.headers.get('x-forwarded-for') || '0.0.0.0',
        user_agent: req.headers.get('user-agent') || 'unknown',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return jsonResponse({
        success: false,
        error: 'Failed to record media upload',
        details: insertError.message,
      }, 500, cors);
    }

    // Update quota
    const today = new Date().toISOString().split('T')[0];
    const { error: quotaError } = await supabase
      .from('media_quotas')
      .upsert(
        {
          user_id: userId,
          plan_id: user?.plan || 'free',
          quota_date: today,
          files_uploaded: 1,
          total_size_bytes: fileSize,
          files_limit: 0, // Will be set by trigger if quota record is new
          size_limit_bytes: 0,
        },
        { onConflict: 'user_id,quota_date' }
      );

    if (quotaError) {
      console.error('Quota update error:', quotaError);
      // Don't fail the entire request if quota update fails
    }

    // Log the upload
    await supabase
      .from('media_access_logs')
      .insert({
        user_id: userId,
        media_id: fileId,
        action: 'upload',
        success: true,
        ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
        user_agent: req.headers.get('user-agent') || 'unknown',
      })
      .select();

    // Update media analytics
    const { data: analytics } = await supabase
      .from('media_analytics')
      .select('*')
      .eq('plan_id', user?.plan || 'free')
      .eq('analytics_date', today)
      .single();

    if (analytics) {
      await supabase
        .from('media_analytics')
        .update({
          total_uploads: (analytics.total_uploads || 0) + 1,
          successful_uploads: (analytics.successful_uploads || 0) + 1,
          total_size_bytes: (analytics.total_size_bytes || 0) + fileSize,
        })
        .eq('id', analytics.id);
    } else {
      await supabase
        .from('media_analytics')
        .insert({
          plan_id: user?.plan || 'free',
          analytics_date: today,
          total_uploads: 1,
          successful_uploads: 1,
          failed_uploads: 0,
          total_size_bytes: fileSize,
          avg_file_size_bytes: fileSize,
          unique_users_uploaded: 1,
        })
        .select();
    }

    return jsonResponse({
      success: true,
      mediaId: fileId,
      message: 'Media upload processed successfully',
      mediaRecord: {
        id: mediaRecord?.id,
        fileName: mediaRecord?.filename,
        fileSize: mediaRecord?.file_size,
        uploadedAt: mediaRecord?.created_at,
        retentionDays: mediaRecord?.retention_days,
      },
    }, 200, cors);

  } catch (err) {
    console.error('process-media-upload error:', err);
    const cors = getCorsHeaders(req.headers.get('origin'));
    return jsonResponse({
      success: false,
      error: 'Failed to process media upload',
      details: String(err),
    }, 500, cors);
  }
});
