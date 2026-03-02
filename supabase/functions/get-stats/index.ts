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

    const supabase = getServiceClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('plan, messages_limit, messages_sent_today, expires_at, company_name')
      .eq('id', userId)
      .single();

    if (error || !user)
      return jsonResponse({ success: false, error: 'User not found' }, 404);

    const { data: planData } = await supabase
      .from('plans')
      .select('features')
      .eq('id', user.plan)
      .single();

    const mediaUploadEnabled = planData?.features?.media_upload === true;

    return jsonResponse({
      success: true,
      stats: {
        plan: user.plan,
        messagesLimit: user.messages_limit,
        messagesSentToday: user.messages_sent_today,
        messagesRemaining: user.messages_limit - user.messages_sent_today,
        expiresAt: user.expires_at,
        mediaUploadEnabled,
        companyName: user.company_name || '',
      },
    });

  } catch (err) {
    console.error('get-stats error:', err);
    return jsonResponse({ success: false, error: 'Failed to fetch statistics' }, 500);
  }
});
