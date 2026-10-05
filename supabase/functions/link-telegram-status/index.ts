// link-telegram-status v2 — token bo'yicha ulash/birlashtirish holatini qaytaradi
// Sayt polling uchun ishlatadi. verify_jwt = false (anon key bilan chaqiriladi)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token hash hisoblash
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Token qatorini o'qish (service role — RLS bypass)
    let { data: linkRow } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('talaba_id, conflict_talaba_id, used_at, expires_at, start_chat_id')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    // Eski tokenlar (raw token ustunida)
    if (!linkRow) {
      const { data: legacyRow } = await supabaseAdmin
        .from('telegram_link_tokens')
        .select('talaba_id, conflict_talaba_id, used_at, expires_at, start_chat_id')
        .eq('token', token)
        .maybeSingle();
      linkRow = legacyRow;
    }

    if (!linkRow) {
      return new Response(
        JSON.stringify({ status: 'expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Muddati o'tgan
    if (new Date(linkRow.expires_at) < new Date() && !linkRow.used_at) {
      return new Response(
        JSON.stringify({ status: 'expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token ishlatilgan — birlashtirilgan yoki bekor qilingan
    if (linkRow.used_at) {
      if (linkRow.conflict_talaba_id) {
        // Birlashtirish bo'lgan — asosiy talabani topish
        // Asosiy = linkRow.talaba_id (birlashtirishdan keyin telegram_chat_id shunga bog'langan)
        // yoki merged_into ga ko'ra
        const { data: talaba } = await supabaseAdmin
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id, merged_into, tasdiqlangan')
          .eq('id', linkRow.talaba_id)
          .maybeSingle();

        if (talaba?.merged_into) {
          // Asosiy talaba merged_into ko'rsatadi
          const { data: asosiy } = await supabaseAdmin
            .from('talabalar')
            .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id, tasdiqlangan')
            .eq('id', talaba.merged_into)
            .maybeSingle();

          if (asosiy) {
            return new Response(
              JSON.stringify({
                status: 'merged',
                talaba: {
                  id: asosiy.id,
                  ism: asosiy.ism,
                  familiya: asosiy.familiya,
                  guruh: asosiy.guruh,
                  kurs: asosiy.kurs,
                  tasdiqlangan: !!(asosiy.google_user_id && asosiy.telegram_chat_id),
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // talaba_id o'zi asosiy bo'lishi mumkin
        if (talaba) {
          return new Response(
            JSON.stringify({
              status: 'merged',
              talaba: {
                id: talaba.id,
                ism: talaba.ism,
                familiya: talaba.familiya,
                guruh: talaba.guruh,
                kurs: talaba.kurs,
                tasdiqlangan: !!(talaba.google_user_id && talaba.telegram_chat_id),
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // conflict_talaba_id yo'q — oddiy ulash (telegram_chat_id bog'langan)
        const { data: talaba } = await supabaseAdmin
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id')
          .eq('id', linkRow.talaba_id)
          .maybeSingle();

        if (talaba) {
          return new Response(
            JSON.stringify({
              status: 'linked',
              talaba: {
                id: talaba.id,
                ism: talaba.ism,
                familiya: talaba.familiya,
                guruh: talaba.guruh,
                kurs: talaba.kurs,
                tasdiqlangan: !!(talaba.google_user_id && talaba.telegram_chat_id),
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Talaba topilmadi — bekor qilingan deb hisoblaymiz
      return new Response(
        JSON.stringify({ status: 'cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token hali yaroqli — mojaro yoki kutish
    if (linkRow.conflict_talaba_id) {
      return new Response(
        JSON.stringify({ status: 'conflict' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ status: 'waiting' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[link-telegram-status] xato:', err);
    return new Response(
      JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
