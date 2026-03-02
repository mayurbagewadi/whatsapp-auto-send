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

// ─── Password Hashing (PBKDF2 + salt) ────────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, phone, password, company_name } = await req.json();

    if (!email || !phone || !password || !company_name)
      return jsonResponse({ success: false, error: 'Email, phone, password, and company name are required' }, 400);

    if (company_name.trim().length === 0 || company_name.trim().length > 255)
      return jsonResponse({ success: false, error: 'Company name must be between 1 and 255 characters' }, 400);

    if (password.length < 6)
      return jsonResponse({ success: false, error: 'Password must be at least 6 characters' }, 400);

    const supabase = getServiceClient();

    const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existingEmail) return jsonResponse({ success: false, error: 'Email already registered' }, 409);

    const { data: existingPhone } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existingPhone) return jsonResponse({ success: false, error: 'Phone number already registered' }, 409);

    const passwordHash = await hashPassword(password);

    const randomBytes = crypto.getRandomValues(new Uint8Array(12));
    const licenseKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,4}/g)?.join('-') ?? '';

    const { data: user, error } = await supabase
      .from('users')
      .insert({ email, phone, password_hash: passwordHash, license_key: licenseKey, plan: 'free', status: 'active', messages_limit: 10, company_name: company_name.trim() })
      .select('id, email, phone, plan, messages_limit, messages_sent_today, company_name')
      .single();

    if (error) {
      console.error('Signup DB error:', error);
      return jsonResponse({ success: false, error: 'Signup failed. Please try again.' }, 500);
    }

    const token = await createJWT(user.id, user.email);

    return jsonResponse({
      success: true, token,
      user: { id: user.id, email: user.email, phone: user.phone, plan: user.plan, messagesLimit: user.messages_limit, messagesSent: user.messages_sent_today, companyName: user.company_name },
    }, 201);

  } catch (err) {
    console.error('signup error:', err);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
