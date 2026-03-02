import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200): Response {
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

// ─── JWT Verify (checks signature + expiry) ───────────────────────────────────
const encoder = new TextEncoder();

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [b64Header, b64Payload, b64Sig] = parts;
    const secret = Deno.env.get('JWT_SECRET') ?? '';

    // Verify HMAC-SHA256 signature
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(b64Sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${b64Header}.${b64Payload}`));
    if (!valid) return null;

    // Verify expiry
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64Payload.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload.userId ?? null;
  } catch {
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer '))
      return jsonResponse({ success: false, error: 'No authentication provided' }, 401);

    const userId = await verifyJWT(authHeader.split(' ')[1]);
    if (!userId)
      return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401);

    const { eventType } = await req.json();
    if (!eventType)
      return jsonResponse({ success: false, error: 'eventType is required' }, 400);

    const supabase = getServiceClient();

    const { data: user } = await supabase
      .from('users')
      .select('id, messages_sent_today, messages_sent_total, messages_limit, status')
      .eq('id', userId)
      .single();

    if (!user || user.status !== 'active')
      return jsonResponse({ success: false, error: 'User not active' }, 403);

    if (eventType === 'message_sent') {
      await supabase
        .from('users')
        .update({
          messages_sent_today: user.messages_sent_today + 1,
          messages_sent_total: (user.messages_sent_total ?? 0) + 1,
          last_active_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    // Analytics insert is non-critical — do after counter update
    try {
      await supabase.from('analytics').insert({ user_id: user.id, event_type: eventType });
    } catch (analyticsErr) {
      console.warn('analytics insert failed (non-fatal):', analyticsErr);
    }

    return jsonResponse({
      success: true,
      remaining: user.messages_limit - user.messages_sent_today - 1,
    });

  } catch (err) {
    console.error('track-event error:', err);
    return jsonResponse({ success: false, error: 'Failed to track event' }, 500);
  }
});
