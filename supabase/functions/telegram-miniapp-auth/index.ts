// telegram-miniapp-auth — Telegram Mini App initData HMAC validation v3
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

async function getChannelIds(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_LOGIN_CHANNEL_IDS')
    .maybeSingle();
  const raw = data?.text_value || '';
  return raw.split(',').map((c: string) => c.trim()).filter(Boolean);
}

// Kanal a'zoligini tekshirish — getChatMember orqali
async function checkChannelMembership(token: string, userId: number, channelId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channelId, user_id: userId }),
    });
    const data = await res.json();
    return data.ok && ['member', 'administrator', 'creator'].includes(data.result?.status);
  } catch {
    return false;
  }
}

// Barcha kanallarga a'zolikni tekshirish — true agar hammasiga a'zo
async function checkAllChannels(token: string, userId: number, channels: string[]): Promise<boolean> {
  if (channels.length === 0) return true;
  const results = await Promise.all(
    channels.map(async (ch) => ({ ch, ok: await checkChannelMembership(token, userId, ch) }))
  );
  return results.every((r) => r.ok);
}

// Constant-time string comparison
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Telegram initData HMAC-SHA256 validation
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

    // Constant-time comparison
    if (!constantTimeEqual(calculatedHash, hash)) {
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

// merged_into zanjirini oxirigacha kuzatish (aylanish himoyasi bilan)
async function resolveMergedChain(talabaId: string, maxDepth = 10): Promise<string | null> {
  let currentId = talabaId;
  const visited = new Set<string>();
  for (let i = 0; i < maxDepth; i++) {
    if (visited.has(currentId)) return null; // aylanish aniqlandi
    visited.add(currentId);
    const { data } = await supabaseAdmin
      .from('talabalar')
      .select('id, merged_into')
      .eq('id', currentId)
      .maybeSingle();
    if (!data) return null;
    if (!data.merged_into) return currentId; // asosiy qator
    currentId = data.merged_into;
  }
  return null; // zanjir juda uzun
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { initData } = await req.json();
    if (!initData) {
      return new Response(
        JSON.stringify({ error: 'E_NO_INITDATA', message: 'initData kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Avval login bot tokeni, keyin asosiy bot tokeni bilan tekshiramiz
    const [loginBotToken, mainBotToken, channels] = await Promise.all([
      getLoginBotToken(), getBotToken(), getChannelIds(),
    ]);

    let result = await validateInitData(initData, loginBotToken);
    let usedToken = loginBotToken;
    if (!result.valid && mainBotToken) {
      result = await validateInitData(initData, mainBotToken);
      usedToken = mainBotToken;
    }

    if (!result.valid) {
      // auth_date tekshirish — muddati o'tganmi yoki hash noto'g'rimi?
      const params = new URLSearchParams(initData);
      const authDate = parseInt(params.get('auth_date') || '0');
      const isExpired = authDate && (Date.now() / 1000) - authDate > 3600;
      const code = isExpired ? 'E_EXPIRED' : 'E_HASH';
      return new Response(
        JSON.stringify({ error: code, message: 'Tekshiruv rad etildi' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const telegramId = result.user?.id;
    if (!telegramId) {
      return new Response(
        JSON.stringify({ error: 'E_HASH', message: 'Foydalanuvchi aniqlanmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // telegram_chat_id (string) bo'yicha faol qatorlarni topish
    const { data: talabalar } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into')
      .eq('telegram_chat_id', String(telegramId))
      .is('merged_into', null);

    if (!talabalar || talabalar.length === 0) {
      // merged_into bo'lgan qatorlarni tekshirish
      const { data: mergedRows } = await supabaseAdmin
        .from('talabalar')
        .select('id, merged_into')
        .eq('telegram_chat_id', String(telegramId))
        .not('merged_into', 'is', null);

      if (mergedRows && mergedRows.length > 0) {
        // Har bir merged qator uchun asosiy qatorni topish
        const asosiyIds = new Set<string>();
        for (const row of mergedRows) {
          const asosiyId = await resolveMergedChain(row.id);
          if (asosiyId) asosiyIds.add(asosiyId);
        }
        if (asosiyIds.size === 1) {
          const asosiyId = asosiyIds.values().next().value;
          const { data: asosiy } = await supabaseAdmin
            .from('talabalar')
            .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
            .eq('id', asosiyId)
            .maybeSingle();
          if (asosiy) {
            // Kanal a'zoligi tekshiruvi
            const isMember = await checkAllChannels(usedToken, telegramId, channels);
            if (!isMember) {
              return new Response(
                JSON.stringify({ error: 'E_NOT_MEMBER', message: 'Kanalga a\'zo bo\'ling' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            return new Response(
              JSON.stringify({
                success: true,
                talaba: {
                  id: asosiy.id,
                  ism: asosiy.ism || 'Foydalanuvchi',
                  familiya: asosiy.familiya || '',
                  guruh: asosiy.guruh || '',
                  kurs: asosiy.kurs || '',
                  login: asosiy.login_id || asosiy.ism,
                  google_linked: !!asosiy.google_user_id,
                  telegram_linked: true,
                  tasdiqlangan: !!(asosiy.google_user_id && asosiy.telegram_chat_id),
                },
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        if (asosiyIds.size > 1) {
          return new Response(
            JSON.stringify({ error: 'E_AMBIGUOUS', message: 'Bir nechta asosiy qator topildi' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'E_NOT_FOUND', message: 'Talaba topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Bir nechta faol qator — noaniqlik
    if (talabalar.length > 1) {
      return new Response(
        JSON.stringify({ error: 'E_AMBIGUOUS', message: 'Bir nechta asosiy qator topildi' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const talaba = talabalar[0];

    // Kanal a'zoligi tekshiruvi
    const isMember = await checkAllChannels(usedToken, telegramId, channels);
    if (!isMember) {
      return new Response(
        JSON.stringify({ error: 'E_NOT_MEMBER', message: 'Kanalga a\'zo bo\'ling' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      JSON.stringify({ error: 'E_NET', message: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
