// telegram-miniapp-auth — Telegram Mini App initData HMAC validation
// Frontend Telegram.WebApp.initData ni yuboradi, server bot tokeni bilan
// HMAC orqali tekshiradi va talaba ma'lumotlarini qaytaradi.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function getBotToken(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_TOKEN')
    .maybeSingle();
  return data?.text_value || '';
}

async function getLoginBotToken(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_LOGIN_BOT_TOKEN')
    .maybeSingle();
  return data?.text_value || '';
}

// Telegram initData HMAC-SHA256 validation
// initData = "query_id=...&user=...&auth_date=...&hash=..."
// Validate: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function validateInitData(initData: string, botToken: string): Promise<{ valid: boolean; user?: any }> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    // auth_date 1 soatdan eski bo'lsa rad etish
    const authDate = parseInt(params.get('auth_date') || '0');
    if (!authDate || (Date.now() / 1000) - authDate > 3600) {
      return { valid: false };
    }

    // data-check-string = sorted key=value pairs joined by \n (hash excluded)
    const keys: string[] = [];
    const values: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      if (key !== 'hash') {
        keys.push(key);
        values[key] = value;
      }
    }
    keys.sort();
    const dataCheckString = keys.map(k => `${k}=${values[k]}`).join('\n');

    // secret_key = HMAC_SHA256(bot_token, "WebAppData")
    const encoder = new TextEncoder();
    const secretKeyBuf = await crypto.subtle.importKey(
      'raw',
      encoder.encode(botToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const secretKey = await crypto.subtle.sign('HMAC', secretKeyBuf, encoder.encode('WebAppData'));

    // calculated_hash = HMAC_SHA256(secret_key, data_check_string)
    const hmacKey = await crypto.subtle.importKey(
      'raw',
      secretKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const calculatedHashBuf = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
    const calculatedHash = Array.from(new Uint8Array(calculatedHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    // user JSON parse
    const userJson = params.get('user');
    const user = userJson ? JSON.parse(userJson) : undefined;

    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { initData } = await req.json();
    if (!initData) {
      return new Response(
        JSON.stringify({ error: 'initData kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Avval login bot tokeni, keyil asosiy bot tokeni bilan tekshiramiz
    const [loginBotToken, mainBotToken] = await Promise.all([getLoginBotToken(), getBotToken()]);

    let result = await validateInitData(initData, loginBotToken);
    if (!result.valid && mainBotToken) {
      result = await validateInitData(initData, mainBotToken);
    }

    if (!result.valid) {
      return new Response(
        JSON.stringify({ error: 'initData noto\'g\'ri yoki muddati o\'tgan' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const telegramId = result.user?.id;
    if (!telegramId) {
      return new Response(
        JSON.stringify({ error: 'Telegram foydalanuvchi aniqlanmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // telegram_id bo'yicha talabani qidirish (telegram_chat_id string sifatida saqlangan)
    const { data: talaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into')
      .eq('telegram_chat_id', String(telegramId))
      .is('merged_into', null)
      .maybeSingle();

    if (!talaba) {
      // Talaba topilmadi — avtomatik yangi qator ochmaymiz
      // Mavjud ro'yxatdan o'tish/ulash oqimiga yuboramiz
      return new Response(
        JSON.stringify({
          status: 'not_found',
          message: 'Talaba topilmadi. Iltimos, saytda ro\'yxatdan o\'ting yoki Telegramni ulang.',
          telegram_id: telegramId,
          user_name: result.user?.first_name || '',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // merged_into bo'lsa asosiyga o'tkaz
    if (talaba.merged_into) {
      const { data: asosiy } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, guruh, kurs, login_id')
        .eq('id', talaba.merged_into)
        .maybeSingle();

      if (asosiy) {
        return new Response(
          JSON.stringify({
            success: true,
            talaba: {
              id: asosiy.id,
              ism: asosiy.ism,
              familiya: asosiy.familiya,
              guruh: asosiy.guruh || '',
              kurs: asosiy.kurs || '',
              login: asosiy.login_id || asosiy.ism,
              google_linked: !!asosiy.google_user_id,
              telegram_linked: true,
              tasdiqlangan: !!asosiy.google_user_id,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const tasdiqlangan = !!(talaba.google_user_id && talaba.telegram_chat_id);
    return new Response(
      JSON.stringify({
        success: true,
        talaba: {
          id: talaba.id,
          ism: talaba.ism || 'Foydalanuvchi',
          familiya: talaba.familiya || '',
          guruh: talaba.guruh || '',
          kurs: talaba.kurs || '',
          login: talaba.login_id || talaba.ism,
          google_linked: !!talaba.google_user_id,
          telegram_linked: true,
          tasdiqlangan,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[telegram-miniapp-auth] xato:', err);
    return new Response(
      JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
