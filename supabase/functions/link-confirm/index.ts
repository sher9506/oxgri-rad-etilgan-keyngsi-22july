// link-confirm — Mini App ichida tasdiqlash (initData + kanal + atomik merge)
// verify_jwt = false (config.toml'da aniq) — force redeploy v2
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

let tokenCache: { token: string; ts: number } | null = null;
const CACHE_TTL = 60_000;

async function getMiniAppBotToken(): Promise<string> {
  if (tokenCache && Date.now() - tokenCache.ts < CACHE_TTL) return tokenCache.token;
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'MINIAPP_BOT_TOKEN')
    .maybeSingle();
  const token = (data?.text_value || '').trim();
  tokenCache = { token, ts: Date.now() };
  return token;
}

async function getLoginBotToken(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_LOGIN_BOT_TOKEN')
    .maybeSingle();
  return (data?.text_value || '').trim();
}

async function getLinkChannel(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'MINIAPP_LINK_CHANNEL')
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
    console.error('[link-confirm] validateInitData exception:', e);
    return { valid: false, errorCode: 'exception' };
  }
}

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

interface ConfirmRequest {
  initData?: string;
  tokenHash?: string;
  action?: 'confirm' | 'reject';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body: ConfirmRequest = await req.json();
    const { initData, tokenHash, action } = body;

    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!tokenHash) {
      return new Response(JSON.stringify({ error: 'tokenHash kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. initData tekshirish (10 daqiqa)
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

    const tgUsername = result.user?.username ? '@' + result.user.username : '';
    const tgFirstName = result.user?.first_name || '';

    // 2. Token qatorini topish (hash bo'yicha)
    const { data: linkRow } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('id, talaba_id, conflict_talaba_id, used_at, expires_at, start_chat_id, status, google_sub, telegram_id, platform')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!linkRow) {
      return new Response(JSON.stringify({ error: 'Token topilmadi', status: 'not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Muddati o'tgan
    if (new Date(linkRow.expires_at) < new Date() && !linkRow.used_at) {
      return new Response(JSON.stringify({ error: 'Muddati o\'tgan', status: 'expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Ishlatilgan
    if (linkRow.used_at) {
      return new Response(JSON.stringify({ error: 'Allaqachon ishlatilgan', status: 'used' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. start_chat_id mosligi (agar bor)
    if (linkRow.start_chat_id && String(linkRow.start_chat_id) !== String(telegramId)) {
      // Bot orqali boshqa foydalanuvchi ochgan bo'lishi mumkin — lekin initData shu foydalanuvchi
      // initData isboti yetarli, start_chat_id ni yangilaymiz
    }

    // 4. Rad etish
    if (action === 'reject') {
      const { error: rejectErr } = await supabaseAdmin
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString(), status: 'rejected' })
        .eq('token_hash', tokenHash)
        .is('used_at', null);
      if (rejectErr) console.error('[link-confirm] reject error:', rejectErr.message);
      return new Response(JSON.stringify({ status: 'rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Kanal a'zoligi tekshiruvi
    const linkChannel = await getLinkChannel();
    if (linkChannel) {
      const checkToken = miniappToken || loginBotToken;
      if (checkToken) {
        const isMember = await checkChannelMembership(checkToken, telegramId, linkChannel);
        if (!isMember) {
          return new Response(JSON.stringify({
            status: 'need_channel',
            channel: linkChannel,
          }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 6. Telegram isbotini qatorga yozish
    await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ telegram_id: telegramId, status: 'telegram_proven' })
      .eq('token_hash', tokenHash)
      .is('used_at', null);

    // 7. Stsenariyni aniqlash
    // Talabani topish (linkRow.talaba_id bo'yicha)
    const { data: talaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, google_user_id, google_email_masked, telegram_chat_id, telegram_username, telegram_ism, created_at, merged_into')
      .eq('id', linkRow.talaba_id)
      .maybeSingle();

    if (!talaba) {
      return new Response(JSON.stringify({ error: 'Talaba topilmadi', status: 'not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Telegram chat_id boshqa talabaga bog'langanmi?
    const { data: existingTalaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, google_user_id, google_email_masked, telegram_chat_id, created_at')
      .eq('telegram_chat_id', String(telegramId))
      .neq('id', linkRow.talaba_id)
      .is('merged_into', null)
      .maybeSingle();

    // (1) Telegram bo'sh — oddiy ulash
    if (!existingTalaba) {
      // Atomik sarflash
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from('telegram_link_tokens')
        .update({ used_at: new Date().toISOString(), status: 'confirmed' })
        .eq('token_hash', tokenHash)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .select('talaba_id, platform')
        .maybeSingle();

      if (claimErr || !claimed) {
        return new Response(JSON.stringify({ error: 'Allaqachon ishlatilgan yoki muddati o\'tgan', status: 'used' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Talabani yangilash
      await supabaseAdmin
        .from('talabalar')
        .update({
          telegram_chat_id: String(telegramId),
          telegram_id: telegramId,
          telegram_username: tgUsername || null,
          telegram_ism: tgFirstName || null,
        })
        .eq('id', claimed.talaba_id);

      // Bonus
      const { data: updatedTalaba } = await supabaseAdmin
        .from('talabalar')
        .select('google_user_id, telegram_chat_id, birlashtirish_bonus_berildi')
        .eq('id', claimed.talaba_id)
        .maybeSingle();

      let bonusBerildi = false;
      if (updatedTalaba?.google_user_id && updatedTalaba?.telegram_chat_id && !updatedTalaba?.birlashtirish_bonus_berildi) {
        const { data: bonusResult } = await supabaseAdmin
          .rpc('berilish_birlashtirish_bonusi', { p_talaba_id: claimed.talaba_id });
        bonusBerildi = !!bonusResult;
      }

      // Audit log
      await supabaseAdmin
        .from('akkaunt_birlashtirish_log')
        .insert({ asosiy_id: claimed.talaba_id, sabab: 'telegram_link_simple' })
        .then(() => {}, () => {});

      return new Response(JSON.stringify({
        status: 'linked',
        talaba: {
          id: claimed.talaba_id,
          ism: talaba.ism,
          familiya: talaba.familiya,
          guruh: talaba.guruh,
          kurs: talaba.kurs,
          tasdiqlangan: !!(updatedTalaba?.google_user_id && updatedTalaba?.telegram_chat_id),
        },
        bonus: bonusBerildi,
      }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (2) Ikkala tomon bir profil — allaqachon ulangan
    if (existingTalaba.id === linkRow.talaba_id) {
      return new Response(JSON.stringify({
        status: 'already_linked',
        talaba: {
          id: talaba.id,
          ism: talaba.ism,
          familiya: talaba.familiya,
          guruh: talaba.guruh,
          kurs: talaba.kurs,
          tasdiqlangan: !!(talaba.google_user_id && talaba.telegram_chat_id),
        },
      }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // (3) Konflikt — birlashtirish kerak
    // Eskisini asosiy qilamiz (created_at bo'yicha)
    let asosiyId = linkRow.talaba_id;
    let birlashganId = existingTalaba.id;
    if (new Date(existingTalaba.created_at) < new Date(talaba.created_at)) {
      asosiyId = existingTalaba.id;
      birlashganId = linkRow.talaba_id;
    }

    // Rate limit: soatiga 5
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from('merge_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('talaba_id', asosiyId)
      .gte('created_at', oneHourAgo);
    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: 'Soatiga 5 martadan ko\'p urinish mumkin emas', status: 'rate_limited' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // action confirm bo'lishi shart (action yo'q = preview rejimi)
    if (action !== 'confirm') {
      // Preview — ma'lumot ko'rsatish
      const { data: asosiyTalaba } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, google_user_id, google_email_masked, telegram_chat_id, telegram_username, telegram_ism, created_at')
        .eq('id', asosiyId)
        .maybeSingle();
      const { data: birlashganTalaba } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, google_user_id, google_email_masked, telegram_chat_id, telegram_username, telegram_ism, created_at')
        .eq('id', birlashganId)
        .maybeSingle();

      return new Response(JSON.stringify({
        status: 'conflict',
        asosiy: asosiyTalaba ? {
          id: asosiyTalaba.id,
          ism: asosiyTalaba.ism,
          familiya: asosiyTalaba.familiya,
          google_email_masked: asosiyTalaba.google_email_masked || '',
          telegram_username: asosiyTalaba.telegram_username || '',
          telegram_ism: asosiyTalaba.telegram_ism || '',
          created_at: asosiyTalaba.created_at,
        } : null,
        birlashgan: birlashganTalaba ? {
          id: birlashganTalaba.id,
          ism: birlashganTalaba.ism,
          familiya: birlashganTalaba.familiya,
          google_email_masked: birlashganTalaba.google_email_masked || '',
          telegram_username: birlashganTalaba.telegram_username || '',
          telegram_ism: birlashganTalaba.telegram_ism || '',
          created_at: birlashganTalaba.created_at,
        } : null,
      }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Atomik sarflash
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ used_at: new Date().toISOString(), status: 'confirmed' })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('talaba_id, platform')
      .maybeSingle();

    if (claimErr || !claimed) {
      return new Response(JSON.stringify({ error: 'Allaqachon ishlatilgan', status: 'used' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Rate limit log
    await supabaseAdmin
      .from('merge_attempts')
      .insert({ talaba_id: asosiyId })
      .then(() => {}, () => {});

    // RPC
    const { data: resultId, error: mergeErr } = await supabaseAdmin
      .rpc('birlashtirish_talabalari', {
        p_asosiy_id: asosiyId,
        p_birlashgan_id: birlashganId,
        p_sabab: 'telegram_link_miniapp',
      });

    if (mergeErr) {
      console.error('[link-confirm] RPC xato:', mergeErr.message);
      return new Response(JSON.stringify({ error: 'Birlashtirish xatosi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Audit log
    await supabaseAdmin
      .from('akkaunt_birlashtirish_log')
      .insert({ asosiy_id: asosiyId, birlashgan_id: birlashganId, sabab: 'telegram_link_miniapp' })
      .then(() => {}, () => {});

    // Asosiy talaba ma'lumoti
    const { data: asosiy } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, google_user_id, telegram_chat_id')
      .eq('id', resultId || asosiyId)
      .maybeSingle();

    // Bot xabari
    const msgToken = miniappToken || loginBotToken;
    if (msgToken) {
      try {
        await fetch(`https://api.telegram.org/bot${msgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramId,
            text: `✅ <b>Akkaunt ulandi!</b>\n\n👤 ${asosiy?.ism || ''} ${asosiy?.familiya || ''}\n\nIkkala akkaunt bitta akkauntga birlashtirildi.`,
            parse_mode: 'HTML',
          }),
        });
      } catch {}
    }

    return new Response(JSON.stringify({
      status: 'merged',
      talaba: {
        id: asosiy?.id || resultId || asosiyId,
        ism: asosiy?.ism || '',
        familiya: asosiy?.familiya || '',
        guruh: asosiy?.guruh || '',
        kurs: asosiy?.kurs || '',
        tasdiqlangan: !!(asosiy?.google_user_id && asosiy?.telegram_chat_id),
      },
    }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[link-confirm] xato:', err);
    return new Response(JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
