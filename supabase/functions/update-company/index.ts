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

    const { company_name } = await req.json();

    if (!company_name || typeof company_name !== 'string' || company_name.trim().length === 0)
      return jsonResponse({ success: false, error: 'Company name is required' }, 400);

    if (company_name.trim().length > 255)
      return jsonResponse({ success: false, error: 'Company name must be 255 characters or less' }, 400);

    const supabase = getServiceClient();

    const { error } = await supabase
      .from('users')
      .update({ company_name: company_name.trim() })
      .eq('id', userId);

    if (error) {
      console.error('update-company DB error:', error);
      return jsonResponse({ success: false, error: 'Failed to update company name' }, 500);
    }

    return jsonResponse({ success: true, companyName: company_name.trim() });

  } catch (err) {
    console.error('update-company error:', err);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
