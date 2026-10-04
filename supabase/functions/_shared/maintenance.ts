import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Moot Court maintenance tekshiruvi.
 * Agi bayroq 'true' bo'lsa 503 + {maintenance:true} qaytaradi.
 * Xato bo'lsa xavfsiz tomonga o'tadi (maintenance deb hisoblaydi).
 */
export async function assertNotMaintenance(): Promise<Response | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('feature_flags')
      .select('value')
      .eq('key', 'MOOT_COURT_MAINTENANCE')
      .maybeSingle();

    if (error || !data) {
      return new Response(
        JSON.stringify({ maintenance: true }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.value === 'true') {
      return new Response(
        JSON.stringify({ maintenance: true }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return null;
  } catch {
    return new Response(
      JSON.stringify({ maintenance: true }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
