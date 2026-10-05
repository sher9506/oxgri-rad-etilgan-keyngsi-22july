// Telegram Login Bot webhook v2026-10-06 — hash tokens + inline URL + used_at
// verify_jwt = false (Telegram serverlari Authorization header'siz chaqiradi)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ── Konfiguratsiya yuklash ──────────────────────────────────────────────────
interface BotConfig {
  token: string;
  channels: string[];
  siteUrl: string;
}

async function loadConfig(): Promise<BotConfig> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', [
      'TELEGRAM_LOGIN_BOT_TOKEN',
      'TELEGRAM_LOGIN_CHANNEL_IDS',
      'TELEGRAM_LOGIN_SITE_URL',
    ]);

  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });

  const channelsRaw = map['TELEGRAM_LOGIN_CHANNEL_IDS'] || '';
  const channels = channelsRaw.split(',').map((c: string) => c.trim()).filter(Boolean);

  return {
    token: map['TELEGRAM_LOGIN_BOT_TOKEN'] || '',
    channels,
    siteUrl: map['TELEGRAM_LOGIN_SITE_URL'] || 'https://fanfaster.uz',
  };
}

// ── Xabar yuborish ──────────────────────────────────────────────────────────
async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  options: Record<string, unknown> = {}
) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  });
  const json = await res.json();
  if (!json.ok) console.error('sendMessage xato:', json.description);
  return json;
}

// ── Kanal a'zoligini tekshirish ─────────────────────────────────────────────
async function checkChannel(token: string, userId: number, channelId: string): Promise<boolean> {
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

async function checkAllChannels(token: string, userId: number, channels: string[]): Promise<string[]> {
  if (channels.length === 0) return [];
  const results = await Promise.all(
    channels.map(async (ch) => ({ ch, ok: await checkChannel(token, userId, ch) }))
  );
  return results.filter((r) => !r.ok).map((r) => r.ch);
}

function channelToLink(ch: string): string | null {
  if (ch.startsWith('@')) return `https://t.me/${ch.slice(1)}`;
  return null;
}

function buildChannelButtons(notMember: string[]) {
  const buttons = notMember.map((ch) => {
    const link = channelToLink(ch);
    if (link) return [{ text: `📢 ${ch} — A'zo bo'lish`, url: link }];
    return [{ text: `📢 ${ch}`, callback_data: 'noop' }];
  });
  buttons.push([{ text: "✅ A'zolikni tekshirish", callback_data: 'check_channel' }]);
  return buttons;
}

// ── Foydalanuvchi ma'lumotlarini olish ─────────────────────────────────────
async function getTelegramUserInfo(token: string, chatId: number) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const data = await res.json();
    if (data.ok) return data.result;
  } catch {}
  return null;
}

// ── Bot session (bot_sessions dan foydalanadi) ──────────────────────────────
async function getSession(chatId: number) {
  const { data } = await supabaseAdmin
    .from('bot_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();
  return data;
}

async function updateSession(chatId: number, updates: Record<string, unknown>) {
  await supabaseAdmin
    .from('bot_sessions')
    .upsert(
      { chat_id: chatId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'chat_id' }
    );
}

async function deleteSession(chatId: number) {
  await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
}

// ── Talabani topish yoki yaratish ───────────────────────────────────────────
async function findOrCreateTalaba(
  telegramId: number,
  phone: string,
  ism: string,
  familiya: string,
  chatId: number
): Promise<{ id: string; ism: string; familiya: string; guruh: string; kurs: string; login_id: string } | null> {
  // 1. Telegram ID bo'yicha topish
  const { data: byTg } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, guruh, kurs, login_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();
  if (byTg) return byTg;

  // 2. Telefon raqami bo'yicha topish
  const phoneVariants = [phone, '+' + phone];
  const { data: byPhone } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, guruh, kurs, login_id')
    .in('login_id', phoneVariants)
    .maybeSingle();
  if (byPhone) {
    // telegram_chat_id ni yangilash
    await supabaseAdmin
      .from('talabalar')
      .update({ telegram_chat_id: chatId })
      .eq('id', byPhone.id);
    return byPhone;
  }

  // 3. Ism + familiya bo'yicha topish (login_id yo'q bo'lsa)
  const { data: byName } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, guruh, kurs, login_id')
    .eq('ism', ism)
    .eq('familiya', familiya)
    .is('login_id', null)
    .maybeSingle();
  if (byName) {
    await supabaseAdmin
      .from('talabalar')
      .update({ login_id: phone, phone, telegram_chat_id: chatId })
      .eq('id', byName.id);
    return { ...byName, login_id: phone };
  }

  // 4. Yangi talaba yaratish
  const { data: newTalaba, error } = await supabaseAdmin
    .from('talabalar')
    .insert({
      ism,
      familiya,
      guruh: '',
      kurs: '',
      login_id: phone,
      phone,
      telegram_chat_id: chatId,
    })
    .select('id, ism, familiya, guruh, kurs, login_id')
    .single();

  if (error) {
    console.error('Talaba yaratish xatosi:', error);
    return null;
  }
  return newTalaba;
}

// ── Sessiyani tasdiqlash ────────────────────────────────────────────────────
async function confirmLoginSession(
  sessionToken: string,
  talaba: { id: string; ism: string; familiya: string; guruh: string; kurs: string; login_id: string },
  telegramId: number,
  telegramUsername: string
): Promise<boolean> {
  // Hash token for lookup
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionToken));
  const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { error } = await supabaseAdmin
    .from('telegram_login_sessions')
    .update({
      status: 'confirmed',
      telegram_id: telegramId,
      telegram_ism: talaba.ism,
      telegram_familiya: talaba.familiya,
      telegram_username: telegramUsername,
      talaba_id: talaba.id,
      login_id: talaba.login_id,
      ism: talaba.ism,
      familiya: talaba.familiya,
      guruh: talaba.guruh || '',
      kurs: talaba.kurs || '',
    })
    .eq('session_token', tokenHash)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .is('used_at', null);

  return !error;
}

// ── Callback query ──────────────────────────────────────────────────────────
async function handleCallback(callbackQuery: any, cfg: BotConfig): Promise<void> {
  const chatId: number = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
  const telegramId: number = callbackQuery.from?.id;
  const data: string = callbackQuery.data || '';
  const cbId: string = callbackQuery.id;

  const answerCb = (text = '') =>
    fetch(`https://api.telegram.org/bot${cfg.token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbId, text }),
    });

  if (data === 'noop') { await answerCb(''); return; }

  if (data === 'check_channel') {
    const [notMember, session] = await Promise.all([
      checkAllChannels(cfg.token, telegramId, cfg.channels),
      getSession(chatId),
    ]);

    if (notMember.length === 0) {
      await answerCb('✅ Tasdiqlandi!');
      if (session?.state === 'login_waiting_channel' && session?.login_id) {
        await supabaseAdmin
          .from('bot_sessions')
          .update({ state: 'login_confirmed_channel', updated_at: new Date().toISOString() })
          .eq('chat_id', chatId);
        await continueLogin(chatId, telegramId, session, cfg);
      }
    } else {
      await answerCb("❌ Hali a'zo bo'lmagansiz!");
      await sendMessage(cfg.token, chatId,
        `⛔ Quyidagi kanallarga hali a'zo bo'lmagansiz:\n${notMember.map(c => `👉 <b>${c}</b>`).join('\n')}\n\nA'zo bo'ling va <b>✅ A'zolikni tekshirish</b> tugmasini bosing.`,
        { reply_markup: { inline_keyboard: buildChannelButtons(notMember) } }
      );
    }
  }
}

// ── Telegramni bog'lash (link_ token) ──────────────────────────────────────
async function handleLinkToken(
  chatId: number,
  telegramId: number,
  linkToken: string,
  cfg: BotConfig
): Promise<void> {
  // Tokenni tekshirish — payload uzunligini log qilamiz
  const payloadLen = linkToken.length;
  const tokenPrefix = linkToken.slice(0, Math.min(6, linkToken.length));
  console.log(`[link-token] /start link_ keldi: payload_uzunlik=${payloadLen}, prefix=${tokenPrefix}…`);

  // Token hash hisoblash
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(linkToken));
  const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Avval hash bo'yicha qidiramiz (yangi tokenlar)
  let { data: linkRow } = await supabaseAdmin
    .from('telegram_link_tokens')
    .select('talaba_id, platform, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  // Eski tokenlar (token ustunida saqlangan) — muddati bilan tugaguncha tanish
  if (!linkRow) {
    const { data: legacyRow } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('talaba_id, platform, expires_at, used_at')
      .eq('token', linkToken)
      .maybeSingle();
    linkRow = legacyRow;
  }

  if (!linkRow) {
    console.log(`[link-token] token topilmadi: prefix=${tokenPrefix}…, uzunlik=${payloadLen}`);
    await sendMessage(cfg.token, chatId,
      '❌ <b>Havola noto\'g\'ri.</b>\n\nSaytdan yangi havola oling.'
    );
    return;
  }

  if (linkRow.used_at) {
    console.log(`[link-token] token allaqachon ishlatilgan: prefix=${tokenPrefix}…`);
    await sendMessage(cfg.token, chatId,
      '⚠️ <b>Bu havola allaqachon ishlatilgan.</b>\n\nSaytdan yangi havola oling.'
    );
    return;
  }

  if (new Date(linkRow.expires_at) < new Date()) {
    console.log(`[link-token] token muddati o'tgan: prefix=${tokenPrefix}…`);
    await sendMessage(cfg.token, chatId,
      '⏰ <b>Havola eskirgan.</b>\n\nSaytdan yangi havola oling (10 daqiqa amal qiladi).'
    );
    return;
  }

  console.log(`[link-token] token topildi, talaba_id=${linkRow.talaba_id}`);

  // Telegram chat_id boshqa talabaga bog'langanmi?
  const { data: existingTalaba } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, created_at, merged_into')
    .eq('telegram_chat_id', String(chatId))
    .neq('id', linkRow.talaba_id)
    .is('merged_into', null)
    .maybeSingle();

  if (existingTalaba) {
    console.log(`[link-token] mojaro: telegram chat_id=${chatId} boshqa talabaga bog'langan. Joriy=${linkRow.talaba_id}, mavjud=${existingTalaba.id}`);

    // Mojaro ma'lumotini token qatoriga yozish
    await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ conflict_talaba_id: existingTalaba.id })
      .eq('token_hash', tokenHash);

    await sendMessage(cfg.token, chatId,
      'ℹ️ <b>Bu Telegram akkaunt boshqa akkauntga bog\'langan.</b>\n\n' +
      'Saytda birlashtirish taklifini qabul qiling yoki bekor qiling.'
    );

    return;
  }

  // Telegram username olish
  let telegramUsername = '';
  try {
    const userInfo = await getTelegramUserInfo(cfg.token, chatId);
    if (userInfo?.username) telegramUsername = '@' + userInfo.username;
  } catch {}

  // Talabani topish
  const { data: talaba } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, google_user_id, telegram_chat_id, birlashtirish_bonus_berildi')
    .eq('id', linkRow.talaba_id)
    .maybeSingle();

  if (!talaba) {
    await sendMessage(cfg.token, chatId,
      '❌ <b>Talaba topilmadi.</b>\n\nSaytda qaytadan urinib ko\'ring.'
    );
    return;
  }

  // Telegramni bog'lash
  const { error: updateErr } = await supabaseAdmin
    .from('talabalar')
    .update({
      telegram_chat_id: String(chatId),
      phone: talaba.phone || String(telegramId),
    })
    .eq('id', talaba.id);

  if (updateErr) {
    console.error('[link-token] talaba update xato:', updateErr);
    await sendMessage(cfg.token, chatId,
      '❌ <b>Bog\'lashda xatolik.</b>\n\nQaytadan urinib ko\'ring.'
    );
    return;
  }

  // Tokenni yopish
  await supabaseAdmin
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  // Bonus berish (agar ikkalasi ulangan va hali berilmagan bo'lsa)
  const birlashtirilgan = talaba.google_user_id !== null;
  let bonusBerildi = false;
  if (birlashtirilgan && !talaba.birlashtirish_bonus_berildi) {
    const { data: bonusResult } = await supabaseAdmin
      .rpc('berilish_birlashtirish_bonusi', { p_talaba_id: talaba.id });
    bonusBerildi = !!bonusResult;
  }

  // Tasdiq xabari
  let msg = `✅ <b>Telegram ulandi!</b>\n\n👤 ${talaba.ism} ${talaba.familiya}\n`;
  if (bonusBerildi) {
    const { data: bonusCountData } = await supabaseAdmin
      .from('settings')
      .select('text_value')
      .eq('key', 'LINK_BONUS_ATTEMPTS')
      .maybeSingle();
    const bonusCount = bonusCountData?.text_value || '3';
    msg += `\n🎁 <b>Bonus:</b> +${bonusCount} qo'shimcha Moot Court urinishi!\n`;
  }

  const replyMarkup: any = {};

  // Desktop: "Profilga qaytish" tugmasi (bir martalik kirish havolasi)
  if (linkRow.platform === 'desktop') {
    // Bir martalik kirish sessiyasi — 32 hex token, hash saqlaymiz
    const tokenArray = new Uint8Array(16);
    crypto.getRandomValues(tokenArray);
    const loginToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const loginHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(loginToken));
    const loginTokenHash = Array.from(new Uint8Array(loginHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    await supabaseAdmin
      .from('telegram_login_sessions')
      .insert({
        session_token: loginTokenHash,
        status: 'confirmed',
        talaba_id: talaba.id,
        ism: talaba.ism,
        familiya: talaba.familiya,
        guruh: '',
        kurs: '',
        login_id: talaba.ism + '_' + talaba.familiya,
        telegram_id: telegramId,
        telegram_ism: talaba.ism,
        telegram_familiya: talaba.familiya,
        telegram_username: telegramUsername,
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });

    const callbackUrl = `${cfg.siteUrl}/telegram-callback?token=${loginToken}`;
    msg += `\nQuyidagi tugma bilan profilga qaytishingiz mumkin:`;
    replyMarkup.reply_markup = {
      inline_keyboard: [[{ text: '🌐 Profilga qaytish', url: callbackUrl }]],
    };
  } else {
    // Mobile: saytga havola yubormaydi
    msg += `\nBrauzerga qaytib, profil sahifasini yangilang.`;
  }

  await sendMessage(cfg.token, chatId, msg, replyMarkup);
}

// ── Login ni yakunlash ──────────────────────────────────────────────────────
async function continueLogin(
  chatId: number,
  telegramId: number,
  session: any,
  cfg: BotConfig
): Promise<void> {
  const sessionToken = session?.login_id;
  if (!sessionToken) return;

  // Foydalanuvchi ma'lumotlarini olish
  const userInfo = await getTelegramUserInfo(cfg.token, chatId);
  const telegramUsername = userInfo?.username ? '@' + userInfo.username : '';
  const tgFirstName = userInfo?.first_name || session?.ism || 'Foydalanuvchi';
  const tgLastName = userInfo?.last_name || session?.familiya || '';

  // Phone number
  const phone = session?.phone || telegramId.toString();

  // Talabani topish yoki yaratish
  const talaba = await findOrCreateTalaba(
    telegramId,
    phone,
    tgFirstName,
    tgLastName,
    chatId
  );

  if (!talaba) {
    await sendMessage(cfg.token, chatId,
      '❌ Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.'
    );
    await deleteSession(chatId);
    return;
  }

  // Session token bilan login sessionini tasdiqlash
  const ok = await confirmLoginSession(sessionToken, talaba, telegramId, telegramUsername);

  if (ok) {
    await deleteSession(chatId);
    // Token bilan qaytish linki — inline URL tugma sifatida
    const callbackUrl = `${cfg.siteUrl}/telegram-callback?token=${sessionToken}`;
    await sendMessage(cfg.token, chatId,
      `✅ <b>Muvaffaqiyatli tasdiqlandi!</b>\n\n` +
      `👤 ${talaba.ism} ${talaba.familiya}\n\n` +
      `Quyidagi tugmani bosib saytga kirish uchun oching:`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🌐 Saytga kirish', url: callbackUrl },
          ]],
        },
      }
    );
  } else {
    await deleteSession(chatId);
    await sendMessage(cfg.token, chatId,
      '⏰ <b>Kirish muddati tugagan yoki allaqachon ishlatilgan.</b>\n\n' +
      'Iltimos saytda qaytadan <b>Telegram orqali kirish</b> tugmasini bosing.'
    );
  }
}

// ── Asosiy webhook handler ──────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const [cfg, body] = await Promise.all([loadConfig(), req.json()]);

    if (!cfg.token) {
      console.error('Login bot token topilmadi!');
      return new Response('ok', { status: 200 });
    }

    console.log('Login Bot Update:', JSON.stringify(body).slice(0, 300));

    // Callback query
    if (body.callback_query) {
      await handleCallback(body.callback_query, cfg);
      return new Response('ok', { status: 200 });
    }

    const message = body.message;
    if (!message) return new Response('ok', { status: 200 });

    const chatId: number = message.chat.id;
    const telegramId: number = message.from?.id || chatId;
    const text: string = message.text || '';
    const contact = message.contact;

    // ── /start SESSION_TOKEN ───────────────────────────────────────────────
    if (text.startsWith('/start')) {
      const parts = text.trim().split(' ');
      const sessionToken = parts[1] || '';

      if (!sessionToken) {
        await sendMessage(cfg.token, chatId,
          '👋 <b>FanFaster Kirish Boti</b>\n\n' +
          'Bu bot faqat sayt orqali ishlatiladi.\n' +
          'Kirish uchun saytda <b>Telegram orqali kirish</b> tugmasini bosing.'
        );
        return new Response('ok', { status: 200 });
      }

      // ── link_ token: Telegramni bog'lash (login emas) ──
      if (sessionToken.startsWith('link_')) {
        await handleLinkToken(chatId, telegramId, sessionToken, cfg);
        return new Response('ok', { status: 200 });
      }

      // Session tokenni DB da tekshirish (hash bo'yicha)
      const loginHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionToken));
      const loginTokenHash = Array.from(new Uint8Array(loginHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: loginSession } = await supabaseAdmin
        .from('telegram_login_sessions')
        .select('*')
        .eq('session_token', loginTokenHash)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString())
        .is('used_at', null)
        .maybeSingle();

      if (!loginSession) {
        await sendMessage(cfg.token, chatId,
          '⏰ <b>Kirish muddati tugagan yoki allaqachon ishlatilgan.</b>\n\n' +
          'Iltimos saytda qaytadan <b>Telegram orqali kirish</b> tugmasini bosing.'
        );
        return new Response('ok', { status: 200 });
      }

      // Eski sessionni o'chirib, yangi yaratish
      await deleteSession(chatId);

      // Bot sessionga session_token ni login_id sifatida saqlaymiz
      await updateSession(chatId, {
        telegram_id: telegramId,
        state: 'login_waiting_phone',
        login_id: sessionToken, // session token ni saqlaymiz
      });

      await sendMessage(cfg.token, chatId,
        `🔐 <b>FanFaster — Kirish</b>\n\n` +
        `Saytga kirish uchun telefon raqamingizni yuboring.\n\n` +
        `📱 Pastdagi tugmani bosing:`,
        {
          reply_markup: {
            keyboard: [[{ text: '📱 Telefon raqamni ulashish', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return new Response('ok', { status: 200 });
    }

    // Session yuklash
    const session = await getSession(chatId);
    const state: string = session?.state || '';

    // ── TELEFON QABUL QILISH ───────────────────────────────────────────────
    if (state === 'login_waiting_phone' && contact?.phone_number) {
      const phone = contact.phone_number.startsWith('+')
        ? contact.phone_number.replace(/\D/g, '')
        : contact.phone_number.replace(/\D/g, '');

      // Keyboard ni olib tashlash
      await sendMessage(cfg.token, chatId, '✅ <b>Telefon qabul qilindi...</b>', {
        reply_markup: { remove_keyboard: true },
      });

      // Session ga phone ni saqlash
      await supabaseAdmin
        .from('bot_sessions')
        .update({ phone: contact.phone_number, updated_at: new Date().toISOString() })
        .eq('chat_id', chatId);

      // Kanal tekshirish
      if (cfg.channels.length > 0) {
        const notMember = await checkAllChannels(cfg.token, telegramId, cfg.channels);
        if (notMember.length > 0) {
          await supabaseAdmin
            .from('bot_sessions')
            .update({
              state: 'login_waiting_channel',
              phone: contact.phone_number,
              updated_at: new Date().toISOString(),
            })
            .eq('chat_id', chatId);

          await sendMessage(cfg.token, chatId,
            `⛔ <b>Kirish uchun quyidagi kanallarga a'zo bo'ling:</b>\n\n` +
            notMember.map((c) => `👉 <b>${c}</b>`).join('\n') +
            `\n\nA'zo bo'lgach, <b>✅ A'zolikni tekshirish</b> tugmasini bosing.`,
            { reply_markup: { inline_keyboard: buildChannelButtons(notMember) } }
          );
          return new Response('ok', { status: 200 });
        }
      }

      // Kanallar yo'q yoki barchaga a'zo — to'g'ridan-to'g'ri login
      const updatedSession = { ...session, phone: contact.phone_number };
      await continueLogin(chatId, telegramId, updatedSession, cfg);
      return new Response('ok', { status: 200 });
    }

    // Telefon kutilmoqda, boshqa narsa yuborilgan
    if (state === 'login_waiting_phone') {
      await sendMessage(cfg.token, chatId,
        '📱 Iltimos, pastdagi tugmani bosib telefon raqamingizni yuboring.',
        {
          reply_markup: {
            keyboard: [[{ text: '📱 Telefon raqamni ulashish', request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return new Response('ok', { status: 200 });
    }

    // Kanal kutilmoqda, boshqa narsa yuborilgan
    if (state === 'login_waiting_channel') {
      const updatedSess = await getSession(chatId);
      const notMember = await checkAllChannels(cfg.token, telegramId, cfg.channels);
      if (notMember.length === 0) {
        await continueLogin(chatId, telegramId, updatedSess, cfg);
      } else {
        await sendMessage(cfg.token, chatId,
          '⏳ Iltimos, kanallarga a\'zo bo\'ling va <b>✅ A\'zolikni tekshirish</b> tugmasini bosing.',
          { reply_markup: { inline_keyboard: buildChannelButtons(notMember) } }
        );
      }
      return new Response('ok', { status: 200 });
    }

    // Noma'lum holat
    await sendMessage(cfg.token, chatId,
      '❓ Kirish uchun saytda <b>Telegram orqali kirish</b> tugmasini bosing.'
    );
    return new Response('ok', { status: 200 });

  } catch (e: unknown) {
    console.error('Login bot webhook xatosi:', e);
    return new Response('ok', { status: 200 });
  }
});
