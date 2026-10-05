import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface LinkStartRequest {
  talaba_id?: string;
  talaba_ism?: string;
  talaba_familiya?: string;
  platform?: 'mobile' | 'desktop';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: LinkStartRequest = await req.json();
    const { talaba_id, talaba_ism, talaba_familiya, platform } = body;

    if (!talaba_id && (!talaba_ism || !talaba_familiya)) {
      return new Response(
        JSON.stringify({ error: 'Talaba aniqlanmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let talabaUuid: string | null = talaba_id || null;

    if (!talabaUuid && talaba_ism && talaba_familiya) {
      const { data: talaba } = await supabaseAdmin
        .from('talabalar')
        .select('id, google_user_id, telegram_chat_id')
        .eq('ism', talaba_ism)
        .eq('familiya', talaba_familiya)
        .maybeSingle();

      if (!talaba) {
        return new Response(
          JSON.stringify({ error: 'Talaba topilmadi' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      talabaUuid = talaba.id;
    }

    if (!talabaUuid) {
      return new Response(
        JSON.stringify({ error: 'Talaba ID aniqlanmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bot username ni settings'dan olish
    const { data: botLinkData } = await supabaseAdmin
      .from('settings')
      .select('text_value')
      .eq('key', 'TELEGRAM_LOGIN_BOT_LINK')
      .maybeSingle();

    const botLink = botLinkData?.text_value || '';
    if (!botLink) {
      return new Response(
        JSON.stringify({ error: 'Telegram bot sozlanmagan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 16 bayt tasodifiy token = 32 hex belgi + "link_" = jami 37 belgi
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

    // Yangi token yaratish — hash saqlaymiz, 15 daqiqa muddat
    const { error: insertError } = await supabaseAdmin
      .from('telegram_link_tokens')
      .insert({
        token_hash: tokenHash,
        talaba_id: talabaUuid,
        platform: platform || 'mobile',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });

    if (insertError) {
      console.error('[link-telegram-start] token insert xato:', insertError);
      return new Response(
        JSON.stringify({ error: 'Token yaratilmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deep link: https://t.me/<bot>?start=link_<token>
    const botLinkClean = botLink.endsWith('/') ? botLink.slice(0, -1) : botLink;
    const deepLink = `${botLinkClean}?start=${token}`;

    console.log(`[link-telegram-start] havola yaratildi: uzunlik=${token.length} (start parametri=${deepLink.length - deepLink.indexOf('?start=') - 7})`);

    return new Response(
      JSON.stringify({ deepLink, token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[link-telegram-start] xato:', err);
    return new Response(
      JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
