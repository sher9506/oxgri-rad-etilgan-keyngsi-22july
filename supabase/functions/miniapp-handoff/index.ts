// miniapp-handoff — Mini App ichidan saytga bir martalik kirish tokeni v2
// verify_jwt = false (config.toml'da aniq)
// initData HMAC bilan tekshiriladi, talaba shundan aniqlanadi
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function getMiniAppBotToken(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'MINIAPP_BOT_TOKEN')
    .maybeSingle();
  return (data?.text_value || '').trim();
}

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
    if (!authDate || nowSec - authDate > 600) return { valid: false, errorCode: 'expired' };

    const keys: string[] = [];
    const values: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      if (key !== 'hash') { keys.push(key); values[key] = value; }
    }
    keys.sort();
    const dataCheckString = keys.map(k => `${k}=${values[k]}`).join('\n');

    const encoder = new TextEncoder();
    const secretKeyBuf = await crypto.subtle.importKey(
      'raw', encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const secretKey = await crypto.subtle.sign('HMAC', secretKeyBuf, encoder.encode(botToken));
    const hmacKey = await crypto.subtle.importKey(
      'raw', secretKey,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const calculatedHashBuf = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(dataCheckString));
    const calculatedHash = Array.from(new Uint8Array(calculatedHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (calculatedHash !== hash) return { valid: false, errorCode: 'hash_mismatch' };

    const userJson = params.get('user');
    const user = userJson ? JSON.parse(userJson) : undefined;
    return { valid: true, user };
  } catch (e) {
    console.error('[miniapp-handoff] validateInitData exception:', e);
    return { valid: false, errorCode: 'exception' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { initData } = await req.json();
    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [miniappToken, loginBotToken] = await Promise.all([getMiniAppBotToken(), getLoginBotToken()]);
    let result = { valid: false, user: undefined as any, errorCode: undefined as string | undefined };
    if (miniappToken) result = await validateInitData(initData, miniappToken);
    if (!result.valid && loginBotToken) result = await validateInitData(initData, loginBotToken);

    if (!result.valid) {
      return new Response(JSON.stringify({ error: 'initData noto\'g\'ri', error_code: result.errorCode }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const telegramId = result.user?.id;
    if (!telegramId) {
      return new Response(JSON.stringify({ error: 'Telegram ID aniqlanmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Talabani topish (telegram_id yoki telegram_chat_id)
    let { data: talaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into, telegram_id')
      .eq('telegram_id', telegramId)
      .is('merged_into', null)
      .maybeSingle();

    if (!talaba) {
      const { data: byChat } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into, telegram_id')
        .eq('telegram_chat_id', String(telegramId))
        .is('merged_into', null)
        .maybeSingle();
      talaba = byChat;
    }

    if (!talaba) {
      return new Response(JSON.stringify({ error: 'Talaba topilmadi. Avval Mini App\'da kirishingiz kerak.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limit: soatiga 10 token
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('telegram_login_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('talaba_id', talaba.id)
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 10) {
      return new Response(JSON.stringify({ error: 'Soatiga 10 martadan ko\'p urinish mumkin emas' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Avvalgi ishlatilmagan tokenlarni bekor qilish
    await supabaseAdmin
      .from('telegram_login_sessions')
      .delete()
      .eq('talaba_id', talaba.id)
      .is('used_at', null);

    // Yangi token: 32 bayt kriptografik tasodifiy
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const handoffToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(handoffToken));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('telegram_login_sessions')
      .insert({
        session_token: tokenHash,
        status: 'confirmed',
        talaba_id: talaba.id,
        ism: talaba.ism,
        familiya: talaba.familiya,
        guruh: talaba.guruh || '',
        kurs: talaba.kurs || '',
        login_id: talaba.login_id || talaba.ism,
        telegram_id: telegramId,
        telegram_ism: talaba.ism,
        telegram_familiya: talaba.familiya,
        expires_at: expiresAt,
      });

    // Sayt URL — url.origin'dan, hardcode emas
    const siteUrl = Deno.env.get('SITE_URL') || 'https://fanfaster.uz';
    const handoffUrl = `${siteUrl}/auth/handoff#t=${handoffToken}`;

    return new Response(JSON.stringify({ handoffUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[miniapp-handoff] xato:', err);
    return new Response(JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
