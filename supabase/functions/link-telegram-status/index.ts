// link-telegram-status v2026-10-06g — tokenHash bo'yicha holat (xom token yo'q)
// rejected status qo'shildi. verify_jwt = false
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const tokenHash = body.tokenHash || body.token_hash;
    const rawToken = body.token;

    if (!tokenHash && !rawToken) {
      return new Response(JSON.stringify({ error: 'tokenHash kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let hash = tokenHash;
    if (!hash && rawToken) {
      const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
      hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    let { data: linkRow } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('talaba_id, conflict_talaba_id, used_at, expires_at, start_chat_id, status')
      .eq('token_hash', hash)
      .maybeSingle();

    // Eski tokenlar (raw token ustunida) — backward compat
    if (!linkRow && rawToken) {
      const { data: legacyRow } = await supabaseAdmin
        .from('telegram_link_tokens')
        .select('talaba_id, conflict_talaba_id, used_at, expires_at, start_chat_id, status')
        .eq('token', rawToken)
        .maybeSingle();
      linkRow = legacyRow;
    }

    if (!linkRow) {
      return new Response(JSON.stringify({ status: 'expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Muddati o'tgan
    if (new Date(linkRow.expires_at) < new Date() && !linkRow.used_at) {
      return new Response(JSON.stringify({ status: 'expired' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rad etilgan
    if (linkRow.status === 'rejected' && linkRow.used_at) {
      const reason = linkRow.conflict_talaba_id ? 'conflict_other_account' : 'user_rejected';
      const message = linkRow.conflict_talaba_id
        ? "Bu Telegram boshqa Google akkauntga ulangan. Bitta Telegram faqat bitta akkauntga ulanadi."
        : "Birlashtirish rad etildi.";
      return new Response(JSON.stringify({ status: 'rejected', reason, message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Token ishlatilgan — birlashtirilgan yoki ulangan
    if (linkRow.used_at) {
      if (linkRow.conflict_talaba_id || linkRow.status === 'confirmed') {
        const { data: talaba } = await supabaseAdmin
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id, merged_into, tasdiqlangan')
          .eq('id', linkRow.talaba_id)
          .maybeSingle();

        if (talaba?.merged_into) {
          const { data: asosiy } = await supabaseAdmin
            .from('talabalar')
            .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id, tasdiqlangan')
            .eq('id', talaba.merged_into)
            .maybeSingle();
          if (asosiy) {
            return new Response(JSON.stringify({
              status: 'merged',
              talaba: { id: asosiy.id, ism: asosiy.ism, familiya: asosiy.familiya, guruh: asosiy.guruh, kurs: asosiy.kurs, tasdiqlangan: !!(asosiy.google_user_id && asosiy.telegram_chat_id) },
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        }

        if (talaba) {
          return new Response(JSON.stringify({
            status: 'merged',
            talaba: { id: talaba.id, ism: talaba.ism, familiya: talaba.familiya, guruh: talaba.guruh, kurs: talaba.kurs, tasdiqlangan: !!(talaba.google_user_id && talaba.telegram_chat_id) },
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        const { data: talaba } = await supabaseAdmin
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id')
          .eq('id', linkRow.talaba_id)
          .maybeSingle();
        if (talaba) {
          return new Response(JSON.stringify({
            status: 'linked',
            talaba: { id: talaba.id, ism: talaba.ism, familiya: talaba.familiya, guruh: talaba.guruh, kurs: talaba.kurs, tasdiqlangan: !!(talaba.google_user_id && talaba.telegram_chat_id) },
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({ status: 'cancelled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (linkRow.conflict_talaba_id) {
      return new Response(JSON.stringify({ status: 'conflict' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ status: 'waiting' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[link-telegram-status] xato:', err);
    return new Response(JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
