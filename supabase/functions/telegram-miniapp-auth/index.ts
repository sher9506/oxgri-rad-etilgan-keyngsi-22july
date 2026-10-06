// telegram-miniapp-auth — Telegram Mini App initData HMAC validation
// verify_jwt = false (config.toml'da aniq yozilgan)
// Frontend Telegram.WebApp.initData ni yuboradi, server bot tokeni bilan
// HMAC orqali tekshiradi va talaba ma'lumotlarini qaytaradi.
// Qidiruv tartibi: telegram_id → telegram_chat_id → miniapp_contacts phone → need_phone
// a) telegram_id (bigint) bo'yicha talabalar jadvalidan
// b) topilmasa — miniapp_contacts dan telefon olib, talabalar.phone bo'yicha qidir
// c) telefon ham yo'q bo'lsa — {status:"need_phone"}
// d) telefon bor, profil yo'q — yangi talaba yaratish
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// 60s xotira keshi — har bir so'rovda settings dan o'qishni oldini oladi
let tokenCache: { token: string; ts: number } | null = null;
const CACHE_TTL = 60_000;

async function getMiniAppBotToken(): Promise<string> {
  if (tokenCache && Date.now() - tokenCache.ts < CACHE_TTL) {
    return tokenCache.token;
  }
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'MINIAPP_BOT_TOKEN')
    .maybeSingle();
  const token = (data?.text_value || '').trim();
  tokenCache = { token, ts: Date.now() };
  return token;
}

// Eski login bot tokeni bilan ham tekshiramiz (mavjud foydalanuvchilar uchun)
async function getLoginBotToken(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_LOGIN_BOT_TOKEN')
    .maybeSingle();
  return (data?.text_value || '').trim();
}

async function validateInitData(initData: string, botToken: string): Promise<{ valid: boolean; user?: any; errorCode?: string }> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false, errorCode: 'no_hash' };

    const authDate = parseInt(params.get('auth_date') || '0');
    const nowSec = Math.floor(Date.now() / 1000);
    const diffSec = nowSec - authDate;
    if (!authDate || diffSec > 3600) {
      return { valid: false, errorCode: 'expired' };
    }

    // FAQAT hash ni chiqaramiz, signature ni qoldiramiz
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

    const encoder = new TextEncoder();

    // secret_key = HMAC_SHA256(key="WebAppData", message=botToken)
    // MUHIM: kalit="WebAppData", xabar=botToken (eski kodda teskari edi)
    const secretKeyBuf = await crypto.subtle.importKey(
      'raw', encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const secretKey = await crypto.subtle.sign('HMAC', secretKeyBuf, encoder.encode(botToken));

    // hash = HMAC_SHA256(key=secret_key, message=data_check_string)
    const hmacKey = await crypto.subtle.importKey(
      'raw', secretKey,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const calculatedHashBuf = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
    const calculatedHash = Array.from(new Uint8Array(calculatedHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (calculatedHash !== hash) {
      return { valid: false, errorCode: 'hash_mismatch' };
    }

    const userJson = params.get('user');
    const user = userJson ? JSON.parse(userJson) : undefined;
    return { valid: true, user };
  } catch (e) {
    console.error('[miniapp-auth] validateInitData exception:', e);
    return { valid: false, errorCode: 'exception' };
  }
}

function normalizePhone(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (!d.startsWith('998')) {
    if (d.startsWith('0')) d = '998' + d.slice(1);
    else if (d.length <= 9) d = '998' + d;
  }
  return d;
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

    // Avval Mini App bot tokeni, keyin login bot tokeni bilan tekshiramiz
    const [miniappToken, loginBotToken] = await Promise.all([getMiniAppBotToken(), getLoginBotToken()]);

    let result = { valid: false, user: undefined as any, errorCode: undefined as string | undefined };
    if (miniappToken) {
      result = await validateInitData(initData, miniappToken);
    }
    if (!result.valid && loginBotToken) {
      result = await validateInitData(initData, loginBotToken);
    }

    if (!result.valid) {
      const code = result.errorCode || 'unknown';
      let msg = 'initData noto\'g\'ri yoki muddati o\'tgan';
      if (code === 'no_token') msg = 'Mini App bot tokeni sozlanmagan';
      else if (code === 'no_hash') msg = 'initData da hash topilmadi';
      else if (code === 'expired') msg = 'initData muddati o\'tgan (1 soatdan eski)';
      else if (code === 'hash_mismatch') msg = 'Telegram imzo noto\'g\'ri (hash mos emas)';
      return new Response(
        JSON.stringify({ error: msg, error_code: code }),
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

    const firstName = result.user?.first_name || '';
    const lastName = result.user?.last_name || '';
    const username = result.user?.username ? '@' + result.user.username : '';

    // (a) telegram_id (bigint) bo'yicha qidirish
    const { data: byTgId } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into, telegram_id')
      .eq('telegram_id', telegramId)
      .is('merged_into', null)
      .maybeSingle();

    if (byTgId) {
      const tasdiqlangan = !!(byTgId.google_user_id && byTgId.telegram_chat_id);
      return new Response(
        JSON.stringify({
          success: true,
          talaba: {
            id: byTgId.id,
            ism: byTgId.ism || 'Foydalanuvchi',
            familiya: byTgId.familiya || '',
            guruh: byTgId.guruh || '',
            kurs: byTgId.kurs || '',
            login: byTgId.login_id || byTgId.ism,
            google_linked: !!byTgId.google_user_id,
            telegram_linked: !!byTgId.telegram_chat_id,
            tasdiqlangan,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (b) telegram_chat_id (string) bo'yicha eski qatorlarni ham tekshiramiz
    const { data: byChatId } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into, telegram_id')
      .eq('telegram_chat_id', String(telegramId))
      .is('merged_into', null)
      .maybeSingle();

    if (byChatId) {
      // telegram_id ni yangilab qo'yamiz (eski qatorni yangilash)
      if (!byChatId.telegram_id) {
        await supabaseAdmin
          .from('talabalar')
          .update({ telegram_id: telegramId })
          .eq('id', byChatId.id);
      }
      const tasdiqlangan = !!(byChatId.google_user_id && byChatId.telegram_chat_id);
      return new Response(
        JSON.stringify({
          success: true,
          talaba: {
            id: byChatId.id,
            ism: byChatId.ism || 'Foydalanuvchi',
            familiya: byChatId.familiya || '',
            guruh: byChatId.guruh || '',
            kurs: byChatId.kurs || '',
            login: byChatId.login_id || byChatId.ism,
            google_linked: !!byChatId.google_user_id,
            telegram_linked: true,
            tasdiqlangan,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (b2) miniapp_contacts dan telefon olib, talabalar.phone bo'yicha qidirish
    const { data: contactRow } = await supabaseAdmin
      .from('miniapp_contacts')
      .select('phone')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (contactRow?.phone) {
      const normalizedPhone = normalizePhone(contactRow.phone);
      const phoneVariants = [normalizedPhone, '+' + normalizedPhone];

      const { data: byPhone } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into')
        .in('phone', phoneVariants)
        .is('merged_into', null)
        .maybeSingle();

      if (byPhone) {
        // telegram_id va telegram_ism ni yangilash
        await supabaseAdmin
          .from('talabalar')
          .update({
            telegram_id: telegramId,
            telegram_username: username || null,
            telegram_ism: firstName || null,
          })
          .eq('id', byPhone.id);

        const tasdiqlangan = !!(byPhone.google_user_id && byPhone.telegram_chat_id);
        return new Response(
          JSON.stringify({
            success: true,
            talaba: {
              id: byPhone.id,
              ism: byPhone.ism || firstName || 'Foydalanuvchi',
              familiya: byPhone.familiya || lastName || '',
              guruh: byPhone.guruh || '',
              kurs: byPhone.kurs || '',
              login: byPhone.login_id || byPhone.ism,
              google_linked: !!byPhone.google_user_id,
              telegram_linked: !!byPhone.telegram_chat_id,
              tasdiqlangan,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (d) Telefon bor, profil yo'q — yangi talaba yaratish
      const { data: newTalaba, error: createErr } = await supabaseAdmin
        .from('talabalar')
        .insert({
          ism: firstName || 'Foydalanuvchi',
          familiya: lastName || '',
          guruh: '',
          kurs: '',
          login_id: normalizedPhone,
          phone: normalizedPhone,
          telegram_id: telegramId,
          telegram_chat_id: String(telegramId),
          telegram_username: username || null,
          telegram_ism: firstName || null,
        })
        .select('id, ism, familiya, guruh, kurs, login_id')
        .single();

      if (createErr) {
        console.error('[telegram-miniapp-auth] talaba yaratish xatosi:', createErr.message);
        return new Response(
          JSON.stringify({ error: 'Talaba yaratishda xatolik' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          talaba: {
            id: newTalaba.id,
            ism: newTalaba.ism,
            familiya: newTalaba.familiya,
            guruh: newTalaba.guruh || '',
            kurs: newTalaba.kurs || '',
            login: newTalaba.login_id || newTalaba.ism,
            google_linked: false,
            telegram_linked: true,
            tasdiqlangan: false,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // (c) Telefon yo'q — requestContact so'raymiz
    return new Response(
      JSON.stringify({
        status: 'need_phone',
        message: 'Davom etish uchun telefon raqamingizni ulashing.',
        telegram_id: telegramId,
        user_name: firstName,
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
