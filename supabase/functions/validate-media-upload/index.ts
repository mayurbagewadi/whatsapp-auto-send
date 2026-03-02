import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── RATE LIMITING ─────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const key = `validate-upload:${userId}`;
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
    // Add your production domain here
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
      return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401);

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
      return jsonResponse({ success: false, error: 'Invalid JSON request body' }, 400);
    }

    const { fileName, fileSize, fileType } = body;

    // ===== INPUT VALIDATION (CRITICAL) =====
    if (typeof fileName !== 'string' || !fileName || fileName.length > 500) {
      return jsonResponse({
        success: false,
        error: 'Invalid: fileName required (max 500 chars)',
        code: 'INVALID_INPUT',
      }, 400);
    }

    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return jsonResponse({
        success: false,
        error: 'Invalid: fileSize must be positive number',
        code: 'INVALID_INPUT',
      }, 400);
    }

    if (typeof fileType !== 'string' || !fileType || fileType.length > 100) {
      return jsonResponse({
        success: false,
        error: 'Invalid: fileType required',
        code: 'INVALID_INPUT',
      }, 400);
    }

    // Validate file size (max 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileSize > MAX_FILE_SIZE) {
      return jsonResponse({
        success: false,
        error: 'File exceeds maximum size of 50MB',
        code: 'FILE_TOO_LARGE',
      }, 400);
    }

    // Validate file type (whitelist only safe types)
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

    if (!allowedTypes.includes(fileType)) {
      return jsonResponse({
        success: false,
        error: 'File type not allowed. Allowed: JPEG, PNG, GIF, WebP, MP4, MOV, WebM, PDF',
        code: 'INVALID_FILE_TYPE',
      }, 400);
    }

    const supabase = getServiceClient();

    // Get user's subscription plan
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, plan')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return jsonResponse({ success: false, error: 'User not found' }, 404);
    }

    // Get plan settings — fall back to permissive defaults if no row exists yet
    const { data: planSettings } = await supabase
      .from('media_plan_settings')
      .select('*')
      .eq('plan_id', user.plan)
      .single();

    const settings = planSettings ?? {
      media_upload_enabled: true,
      daily_file_limit: 0,         // 0 = unlimited
      monthly_storage_limit_gb: 0, // 0 = unlimited
    };

    // Check if media upload is enabled for this plan
    if (!settings.media_upload_enabled) {
      return jsonResponse({
        success: false,
        error: 'Media upload is not enabled for your subscription plan',
        code: 'FEATURE_NOT_ENABLED',
      }, 403);
    }

    // Check daily file quota
    const today = new Date().toISOString().split('T')[0];
    const { data: quota } = await supabase
      .from('media_quotas')
      .select('files_uploaded, total_size_bytes')
      .eq('user_id', userId)
      .eq('quota_date', today)
      .single();

    const filesUploaded = quota?.files_uploaded ?? 0;
    const totalSize = quota?.total_size_bytes ?? 0;

    // Check file count limit
    if (settings.daily_file_limit > 0 && filesUploaded >= settings.daily_file_limit) {
      return jsonResponse({
        success: false,
        error: `You have reached your daily file limit of ${settings.daily_file_limit} files`,
        code: 'QUOTA_EXCEEDED_FILES',
      }, 429);
    }

    // Check storage limit
    const newTotalSize = totalSize + fileSize;
    const storageLimitBytes = settings.monthly_storage_limit_gb * 1024 * 1024 * 1024;

    if (settings.monthly_storage_limit_gb > 0 && newTotalSize > storageLimitBytes) {
      const remainingMB = Math.floor((storageLimitBytes - totalSize) / (1024 * 1024));
      return jsonResponse({
        success: false,
        error: `Insufficient storage. You have ${remainingMB}MB remaining`,
        code: 'QUOTA_EXCEEDED_STORAGE',
      }, 429);
    }

    // Generate unique storage path
    const timestamp = Date.now();
    const fileId = crypto.randomUUID();
    const extension = fileName.split('.').pop() || '';
    const storageFileName = `${userId}/${timestamp}-${fileId}.${extension}`;

    // Generate signed upload URL (valid for 1 hour)
    const { data: signedUrl, error: urlError } = await supabase
      .storage
      .from('media-files')
      .createSignedUploadUrl(storageFileName, 3600);

    if (urlError || !signedUrl) {
      console.error('Signed URL generation failed:', urlError);
      return jsonResponse({
        success: false,
        error: 'Failed to generate upload URL',
      }, 500);
    }

    // Log the validation attempt
    await supabase
      .from('media_access_logs')
      .insert({
        user_id: userId,
        action: 'upload',
        success: true,
        ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
        user_agent: req.headers.get('user-agent') || 'unknown',
      })
      .select();

    return jsonResponse({
      success: true,
      uploadUrl: signedUrl.signedUrl,
      token: signedUrl.token,
      storagePath: storageFileName,
      fileId,
      quotaStatus: {
        filesUsed: filesUploaded + 1,
        filesLimit: settings.daily_file_limit || 'unlimited',
        storageUsedMB: Math.round(newTotalSize / (1024 * 1024)),
        storageLimitGB: settings.monthly_storage_limit_gb || 'unlimited',
      },
    });

  } catch (err) {
    console.error('validate-media-upload error:', err);
    return jsonResponse({
      success: false,
      error: 'Internal server error',
      details: String(err),
    }, 500);
  }
});
