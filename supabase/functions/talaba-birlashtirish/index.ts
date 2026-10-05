// talaba-birlashtirish v2.2 — akkaunt birlashtirish edge function
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface MergeRequest {
  asosiy_id?: string;
  birlashgan_id?: string;
  sabab?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: MergeRequest = await req.json();
    const { asosiy_id, birlashgan_id, sabab } = body;

    if (!asosiy_id || !birlashgan_id) {
      return new Response(
        JSON.stringify({ error: 'Ikkala talaba ID kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (asosiy_id === birlashgan_id) {
      return new Response(
        JSON.stringify({ error: 'Bir xil ID birlashtirib boilmaydi' }),
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

    // Agar frontend noto'g'ri tartibda yuborsa, serverda to'g'rilaymiz:
    // asosiy = eskisi (created_at bo'yicha, teng bo'lsa total_xp ko'prog'i)
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
        // Teng — total_xp ko'prog'i asosiy
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
        p_sabab: sabab || 'manual',
      });

    if (mergeErr) {
      console.error('[talaba-birlashtirish] RPC xato:', mergeErr.message);
      return new Response(
        JSON.stringify({ error: 'Birlashtirish amalga oshmadi: ' + mergeErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
