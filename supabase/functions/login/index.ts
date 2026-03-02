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

// ─── JWT ──────────────────────────────────────────────────────────────────────
const encoder = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function createJWT(userId: string, email: string): Promise<string> {
  const secret = Deno.env.get('JWT_SECRET') ?? '';
  const header = b64url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(encoder.encode(JSON.stringify({
    userId, email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  })));
  const message = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return `${message}.${b64url(sig)}`;
}

// ─── Password Verify (PBKDF2 + legacy SHA-256) ────────────────────────────────
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    const [, saltHex, hashHex] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
    const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computed === hashHex;
  }
  // Legacy SHA-256 (backward compatible)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  const legacy = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return legacy === stored;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password } = await req.json();

    if (!email || !password)
      return jsonResponse({ success: false, error: 'Email and password are required' }, 400);

    const supabase = getServiceClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, phone, password_hash, plan, status, messages_limit, messages_sent_today, messages_sent_total, expires_at')
      .eq('email', email)
      .single();

    if (error || !user)
      return jsonResponse({ success: false, error: 'Invalid email or password' }, 401);

    if (user.status !== 'active')
      return jsonResponse({ success: false, error: `Account is ${user.status}` }, 403);

    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch)
      return jsonResponse({ success: false, error: 'Invalid email or password' }, 401);

    if (user.expires_at && new Date(user.expires_at) < new Date()) {
      await supabase.from('users').update({ status: 'expired' }).eq('id', user.id);
      return jsonResponse({ success: false, error: 'Account has expired' }, 403);
    }

    await supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', user.id);

    const token = await createJWT(user.id, user.email);

    return jsonResponse({
      success: true, token,
      user: { id: user.id, email: user.email, phone: user.phone, plan: user.plan, messagesLimit: user.messages_limit, messagesSent: user.messages_sent_today, messagesTotal: user.messages_sent_total, expiresAt: user.expires_at },
    });

  } catch (err) {
    console.error('login error:', err);
    return jsonResponse({ success: false, error: 'Login failed' }, 500);
  }
});
