import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// telegram-api — Telegram API proxy (verify_jwt = false)
// Ikki rejim:
//  - { token, method, body } — chaqiruvchi tokenni o'zi biladi (admin panel: getMe, setWebhook...).
//  - { bot, method, body } — token serverda settings'dan olinadi, brauzer uni ko'rmaydi;
//    bu rejimda faqat xabar yuborish/o'qish metodlari (webhook'ni o'zgartirib bo'lmaydi).

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BOT_KEYS = ['TELEGRAM_TOKEN', 'USTOZ_BOT_TOKEN'];
const BOT_METHODS = ['sendMessage', 'sendPhoto', 'getChat', 'getChatMember'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { token: rawToken, bot, method, body } = await req.json();

    let token = rawToken;
    if (!token && bot) {
      if (!BOT_KEYS.includes(bot) || !BOT_METHODS.includes(method)) {
        return new Response(
          JSON.stringify({ ok: false, description: 'Bu bot yoki metod ruxsat etilmagan' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data } = await supabaseAdmin.from('settings').select('text_value').eq('key', bot).maybeSingle();
      token = data?.text_value?.trim();
      if (!token) {
        return new Response(
          JSON.stringify({ ok: false, description: 'Bot ulanmagan' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!token || !method) {
      return new Response(
        JSON.stringify({ ok: false, description: 'token va method majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowed = ['getMe', 'setWebhook', 'getWebhookInfo', 'deleteWebhook', 'sendMessage', 'sendPhoto', 'answerCallbackQuery', 'getChat', 'getChatMember', 'setChatMenuButton'];
    if (!allowed.includes(method)) {
      return new Response(
        JSON.stringify({ ok: false, description: `Method '${method}' ruxsat etilmagan` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://api.telegram.org/bot${token}/${method}`;
    const fetchOpts: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    if (body) fetchOpts.body = JSON.stringify(body);

    const res = await fetch(url, fetchOpts);
    const data = await res.json();

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, description: e.message || 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
