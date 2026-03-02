import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );
}

const encoder = new TextEncoder();

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [b64Header, b64Payload, b64Sig] = parts;
    const secret = Deno.env.get('JWT_SECRET') ?? '';
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(b64Sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${b64Header}.${b64Payload}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64Payload.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.userId ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer '))
      return jsonResponse({ success: false, error: 'No authentication provided' }, 401);

    const userId = await verifyJWT(authHeader.split(' ')[1]);
    if (!userId)
      return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401);

    const { recipient_phone, message, status, error, batch_id } = await req.json();

    if (!recipient_phone || !status)
      return jsonResponse({ success: false, error: 'recipient_phone and status are required' }, 400);

    if (!['sent', 'failed'].includes(status))
      return jsonResponse({ success: false, error: 'status must be sent or failed' }, 400);

    const supabase = getServiceClient();

    const { error: dbError } = await supabase
      .from('message_logs')
      .insert({
        user_id: userId,
        recipient_phone,
        message: message || null,
        status,
        error: error || null,
        batch_id: batch_id || null,
        sent_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('log-message DB error:', dbError);
      return jsonResponse({ success: false, error: 'Failed to log message' }, 500);
    }

    return jsonResponse({ success: true });

  } catch (err) {
    console.error('log-message error:', err);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
