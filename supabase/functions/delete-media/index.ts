import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── RATE LIMITING ─────────────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const key = `delete-media:${userId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

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
        error: 'Rate limit exceeded. Maximum 100 requests per minute',
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

    const { mediaId, permanent = false, reason = 'user_request' } = body;

    // ===== INPUT VALIDATION (CRITICAL) =====
    if (typeof mediaId !== 'string' || !mediaId.match(/^[0-9a-f\-]{36}$/i)) {
      return jsonResponse({
        success: false,
        error: 'Invalid mediaId (must be UUID)',
        code: 'INVALID_INPUT',
      }, 400, cors);
    }

    if (typeof permanent !== 'boolean') {
      return jsonResponse({
        success: false,
        error: 'Invalid permanent flag (must be boolean)',
        code: 'INVALID_INPUT',
      }, 400, cors);
    }

    if (typeof reason !== 'string' || reason.length > 100) {
      return jsonResponse({
        success: false,
        error: 'Invalid reason (max 100 chars)',
        code: 'INVALID_INPUT',
      }, 400, cors);
    }

    const supabase = getServiceClient();

    // Verify media belongs to user
    const { data: media, error: fetchError } = await supabase
      .from('media_uploads')
      .select('*')
      .eq('id', mediaId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !media) {
      return jsonResponse({
        success: false,
        error: 'Media not found or you do not have permission to delete it',
      }, 404, cors);
    }

    if (permanent) {
      // Hard delete - immediately remove from storage and database
      try {
        // Delete from storage
        const { error: storageError } = await supabase
          .storage
          .from('media-files')
          .remove([media.storage_path]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Continue anyway - delete from DB
        }
      } catch (err) {
        console.error('Storage deletion failed:', err);
        // Continue with DB deletion
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('media_uploads')
        .delete()
        .eq('id', mediaId)
        .eq('user_id', userId);

      if (deleteError) {
        return jsonResponse({
          success: false,
          error: 'Failed to delete media permanently',
          details: deleteError.message,
        }, 500, cors);
      }

      // Log deletion
      await supabase
        .from('media_access_logs')
        .insert({
          user_id: userId,
          media_id: mediaId,
          action: 'delete',
          success: true,
          ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
          user_agent: req.headers.get('user-agent') || 'unknown',
        });

      return jsonResponse({
        success: true,
        message: 'Media permanently deleted',
        mediaId,
        deletedAt: new Date().toISOString(),
      }, 200, cors);

    } else {
      // Soft delete - mark as deleted and schedule permanent deletion
      const deletionScheduledDate = new Date();
      deletionScheduledDate.setDate(deletionScheduledDate.getDate() + 30); // 30 days until permanent deletion

      const { error: updateError } = await supabase
        .from('media_uploads')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
          gdpr_deletion_scheduled: deletionScheduledDate.toISOString(),
        })
        .eq('id', mediaId)
        .eq('user_id', userId);

      if (updateError) {
        return jsonResponse({
          success: false,
          error: 'Failed to delete media',
          details: updateError.message,
        }, 500, cors);
      }

      // Log deletion
      await supabase
        .from('media_access_logs')
        .insert({
          user_id: userId,
          media_id: mediaId,
          action: 'delete',
          success: true,
          ip_address: req.headers.get('x-forwarded-for') || '0.0.0.0',
          user_agent: req.headers.get('user-agent') || 'unknown',
        });

      return jsonResponse({
        success: true,
        message: 'Media marked for deletion (will be permanently deleted in 30 days)',
        mediaId,
        deletedAt: new Date().toISOString(),
        permanentDeletionDate: deletionScheduledDate.toISOString(),
      }, 200, cors);
    }

  } catch (err) {
    console.error('delete-media error:', err);
    const cors = getCorsHeaders(req.headers.get('origin'));
    return jsonResponse({
      success: false,
      error: 'Failed to process deletion',
      details: String(err),
    }, 500, cors);
  }
});
