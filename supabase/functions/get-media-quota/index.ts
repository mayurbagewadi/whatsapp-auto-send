import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── RATE LIMITING ─────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const key = `quota-check:${userId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 60;

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
        error: 'Rate limit exceeded. Maximum 60 requests per minute',
        code: 'RATE_LIMIT_EXCEEDED',
        remaining: rateLimit.remaining,
      }, 429, cors);
    }

    const supabase = getServiceClient();

    // Get user's subscription plan
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, plan')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return jsonResponse({ success: false, error: 'User not found' }, 404, cors);
    }

    // Get plan settings
    const { data: planSettings, error: settingsError } = await supabase
      .from('media_plan_settings')
      .select('*')
      .eq('plan_id', user.plan)
      .single();

    // Fall back to permissive defaults if no plan settings row exists yet
    const settings = planSettings ?? {
      media_upload_enabled: true,
      daily_file_limit: 0,
      monthly_storage_limit_gb: 0,
    };

    if (!settings.media_upload_enabled) {
      return jsonResponse({
        success: true,
        quotaStatus: {
          mediaUploadEnabled: false,
          filesUsed: 0,
          filesLimit: settings.daily_file_limit || 0,
          storageUsedMB: 0,
          storageLimitGB: settings.monthly_storage_limit_gb || 0,
          message: 'Media upload is disabled for your plan',
        },
      }, 200, cors);
    }

    // Get today's quota
    const today = new Date().toISOString().split('T')[0];
    const { data: quota } = await supabase
      .from('media_quotas')
      .select('files_uploaded, total_size_bytes')
      .eq('user_id', userId)
      .eq('quota_date', today)
      .single();

    const filesUsed = quota?.files_uploaded ?? 0;
    const storageUsedBytes = quota?.total_size_bytes ?? 0;
    const storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024));

    // Calculate remaining
    const filesRemaining = settings.daily_file_limit > 0
      ? Math.max(0, settings.daily_file_limit - filesUsed)
      : -1; // -1 means unlimited

    const storageRemainingMB = settings.monthly_storage_limit_gb > 0
      ? Math.max(0, settings.monthly_storage_limit_gb * 1024 - storageUsedMB)
      : -1; // -1 means unlimited

    // Get user's uploaded media count (all time)
    const { count: totalUploads } = await supabase
      .from('media_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'uploaded');

    return jsonResponse({
      success: true,
      quotaStatus: {
        mediaUploadEnabled: settings.media_upload_enabled,
        plan: user.plan,

        // Daily limits
        filesUsed,
        filesLimit: settings.daily_file_limit,
        filesRemaining,

        // Storage limits
        storageUsedMB,
        storageLimitGB: settings.monthly_storage_limit_gb,
        storageRemainingMB,

        // Overall stats
        totalUploadsAllTime: totalUploads || 0,

        // User-friendly messages
        message: filesRemaining === 0
          ? 'Daily file limit reached'
          : storageRemainingMB === 0
          ? 'Storage limit reached'
          : 'Quota available',
      },
    }, 200, cors);

  } catch (err) {
    console.error('get-media-quota error:', err);
    const cors = getCorsHeaders(req.headers.get('origin'));
    return jsonResponse({
      success: false,
      error: 'Failed to fetch quota',
      details: String(err),
    }, 500, cors);
  }
});
