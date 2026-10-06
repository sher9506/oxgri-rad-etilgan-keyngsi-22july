// link-telegram-start v2026-10-06g — faqat token_hash saqlaydi (xom token yo'q)
// Rate limit: soatiga 5/profil. Google ulash uchun state_hash ham yarata oladi.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface LinkStartRequest {
  talaba_id?: string;
  platform?: 'mobile' | 'desktop';
  mode?: 'telegram' | 'google';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body: LinkStartRequest = await req.json();
    const { talaba_id, platform, mode } = body;

    if (!talaba_id) {
      return new Response(JSON.stringify({ error: 'Talaba ID kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const talabaUuid: string = talaba_id;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';

    // Talaba mavjudligi va Telegram holatini tekshirish
    const { data: talaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, telegram_chat_id, google_user_id')
      .eq('id', talabaUuid)
      .maybeSingle();

    if (!talaba) {
      return new Response(JSON.stringify({ error: 'Talaba topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'google') {
      // Google ulash rejimi — state_hash yaratamiz
      if (talaba.google_user_id) {
        return new Response(JSON.stringify({ error: 'Google allaqachon ulangan' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Rate limit
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from('telegram_link_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('talaba_id', talabaUuid)
        .gte('created_at', oneHourAgo);
      if ((count || 0) >= 5) {
        return new Response(JSON.stringify({ error: 'Soatiga 5 martadan ko\'p urinish mumkin emas' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Eski ishlatilmagan tokenlarni tozalash
      await supabaseAdmin
        .from('telegram_link_tokens')
        .delete()
        .eq('talaba_id', talabaUuid)
        .is('used_at', null);

      // State yaratish
      const stateBytes = new Uint8Array(16);
      crypto.getRandomValues(stateBytes);
      const state = 'gl_' + Array.from(stateBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      const stateHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state));
      const stateHash = Array.from(new Uint8Array(stateHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { error: insertError } = await supabaseAdmin
        .from('telegram_link_tokens')
        .insert({
          state_hash: stateHash,
          talaba_id: talabaUuid,
          platform: platform || 'mobile',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          ip_address: ip || null,
        });

      if (insertError) {
        console.error('[link-telegram-start] google state insert xato:', insertError.message);
        return new Response(JSON.stringify({ error: 'State yaratilmadi' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Telegram ulash rejimi (default)
    if (talaba.telegram_chat_id) {
      return new Response(JSON.stringify({ error: 'Telegram allaqachon ulangan' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Bot username
    const { data: botLinkData } = await supabaseAdmin
      .from('settings')
      .select('text_value')
      .eq('key', 'TELEGRAM_LOGIN_BOT_LINK')
      .maybeSingle();
    const botLink = botLinkData?.text_value || '';
    if (!botLink) {
      return new Response(JSON.stringify({ error: 'Telegram bot sozlanmagan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limit: soatiga 5 ta so'rov
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('talaba_id', talabaUuid)
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Soatiga 5 martadan ko\'p urinish mumkin emas' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 16 bayt tasodifiy token = 32 hex + "link_" = jami 37 belgi
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = 'link_' + Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    // sha256 hash — bazada faqat hash saqlaymiz
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Eski ishlatilmagan tokenlarni tozalash
    await supabaseAdmin
      .from('telegram_link_tokens')
      .delete()
      .eq('talaba_id', talabaUuid)
      .is('used_at', null);

    // Yangi token — xom token saqlanmaydi
    const { error: insertError } = await supabaseAdmin
      .from('telegram_link_tokens')
      .insert({
        token_hash: tokenHash,
        talaba_id: talabaUuid,
        platform: platform || 'mobile',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        ip_address: ip || null,
      });

    if (insertError) {
      console.error('[link-telegram-start] token insert xato:', insertError.message);
      return new Response(JSON.stringify({ error: 'Token yaratilmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const botLinkClean = botLink.endsWith('/') ? botLink.slice(0, -1) : botLink;
    const deepLink = `${botLinkClean}?start=${token}`;

    return new Response(JSON.stringify({ deepLink, tokenHash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[link-telegram-start] xato:', err);
    return new Response(JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
