import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from('wa_selectors')
      .select('key, value');

    if (error) {
      console.error('get-selectors error:', error);
      return jsonResponse({ success: false, error: 'Failed to fetch selectors' }, 500);
    }

    // Convert rows to flat object: { SELECTOR_SEND_BUTTON: "...", ... }
    const selectors: Record<string, string> = {};
    (data ?? []).forEach(row => { selectors[row.key] = row.value; });

    return jsonResponse({ success: true, selectors, version: Date.now() });

  } catch (err) {
    console.error('get-selectors error:', err);
    return jsonResponse({ success: false, error: 'Internal server error' }, 500);
  }
});
