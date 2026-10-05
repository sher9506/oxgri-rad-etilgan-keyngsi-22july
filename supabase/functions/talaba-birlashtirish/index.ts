// talaba-birlashtirish v2026-10-06b — link_token asosida xavfsiz birlashtirish
// ID juftligini kliyentdan OLMAYDI — token qatoridan server tomonidan o'qiydi.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface MergeRequest {
  link_token?: string;
  sabab?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: MergeRequest = await req.json();
    const { link_token, sabab } = body;

    if (!link_token) {
      return new Response(
        JSON.stringify({ error: 'link_token kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token hash hisoblash
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(link_token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Token qatoridan ID larni o'qish — server tomonidan, kliyent ishonchsiz
    let { data: tokenRow } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('talaba_id, conflict_talaba_id, used_at, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    // Eski tokenlar (raw token ustunida)
    if (!tokenRow) {
      const { data: legacyRow } = await supabaseAdmin
        .from('telegram_link_tokens')
        .select('talaba_id, conflict_talaba_id, used_at, expires_at')
        .eq('token', link_token)
        .maybeSingle();
      tokenRow = legacyRow;
    }

    if (!tokenRow) {
      return new Response(
        JSON.stringify({ error: 'Token topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenRow.conflict_talaba_id) {
      return new Response(
        JSON.stringify({ error: 'Mojaro topilmadi — birlashtirish kerak emas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asosiy_id = tokenRow.talaba_id;
    const birlashgan_id = tokenRow.conflict_talaba_id;

    if (asosiy_id === birlashgan_id) {
      return new Response(
        JSON.stringify({ error: 'Bir xil ID birlashtirib bo\'lmaydi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ikkala talabani tekshirish — kim asosiy (eski) ekanligini aniqlaymiz
    const { data: talabalar } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, created_at, total_xp, merged_into, google_user_id, telegram_chat_id')
      .in('id', [asosiy_id, birlashgan_id]);

    if (!talabalar || talabalar.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Talabalardan biri topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Serverda to'g'rilaymiz: asosiy = eskisi (created_at bo'yicha, teng bo'lsa total_xp ko'prog'i)
    let actualAsosiy = talabalar[0];
    let actualBirlashgan = talabalar[1];

    const t0 = talabalar[0];
    const t1 = talabalar[1];

    if (t0.created_at && t1.created_at) {
      if (new Date(t0.created_at) < new Date(t1.created_at)) {
        actualAsosiy = t0;
        actualBirlashgan = t1;
      } else if (new Date(t1.created_at) < new Date(t0.created_at)) {
        actualAsosiy = t1;
        actualBirlashgan = t0;
      } else {
        if ((t1.total_xp || 0) > (t0.total_xp || 0)) {
          actualAsosiy = t1;
          actualBirlashgan = t0;
        }
      }
    }

    // Allaqachon birlashtirilganmi?
    if (actualBirlashgan.merged_into) {
      return new Response(
        JSON.stringify({ error: 'Bu talaba allaqachon birlashtirilgan' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (actualAsosiy.merged_into) {
      return new Response(
        JSON.stringify({ error: 'Asosiy talaba boshqasiga birlashtirilgan' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Birlashtirish RPC chaqirish
    const { data: resultId, error: mergeErr } = await supabaseAdmin
      .rpc('birlashtirish_talabalari', {
        p_asosiy_id: actualAsosiy.id,
        p_birlashgan_id: actualBirlashgan.id,
        p_sabab: sabab || 'telegram_link',
      });

    if (mergeErr) {
      console.error('[talaba-birlashtirish] RPC xato:', mergeErr.message);
      return new Response(
        JSON.stringify({ error: 'Birlashtirish amalga oshmadi: ' + mergeErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tokenni yopish — birlashtirilgan deb belgilash
    await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('used_at', null);

    // Asosiy qatorning yangilangan holatini qaytarish
    const { data: merged } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, google_user_id, telegram_chat_id, total_xp, bonus_urinish, avatar_url')
      .eq('id', resultId)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        asosiy_id: resultId,
        birlashgan_id: actualBirlashgan.id,
        talaba: merged,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[talaba-birlashtirish] xato:', err);
    return new Response(
      JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
