import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ── Barcha sozlamalarni bir martada yuklash ──
interface BotConfig {
  token: string;
  channels: string[];
  siteUrl: string;
  siteBtnText: string;
  msgs: Record<string, string>;
}

async function loadConfig(): Promise<BotConfig> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', [
      'TELEGRAM_TOKEN', 'TELEGRAM_CHANNEL_IDS',
      'BOT_SITE_URL', 'BOT_SITE_BUTTON_TEXT',
      'BOT_MSG_WELCOME', 'BOT_MSG_PHONE_NO_CHANNEL',
      'BOT_MSG_PHONE_WITH_CHANNEL', 'BOT_MSG_CHANNEL_REQUIRED',
      'BOT_MSG_CHANNEL_WAIT', 'BOT_MSG_NAME_PROMPT',
      'BOT_MSG_LOGIN_PROMPT', 'BOT_MSG_LOGIN_TAKEN',
      'BOT_MSG_PASSWORD_PROMPT', 'BOT_MSG_SUCCESS',
    ]);

  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });

  const channelsRaw = map['TELEGRAM_CHANNEL_IDS'] || '';
  const channels = channelsRaw.split(',').map((c: string) => c.trim()).filter(Boolean);

  return {
    token: map['TELEGRAM_TOKEN'] || '',
    channels,
    siteUrl: map['BOT_SITE_URL'] || 'https://fanfaster.uz',
    siteBtnText: map['BOT_SITE_BUTTON_TEXT'] || '🌐 Saytga kirish',
    msgs: {
      welcome: map['BOT_MSG_WELCOME'] || '',
      phoneNoChannel: map['BOT_MSG_PHONE_NO_CHANNEL'] || '',
      phoneWithChannel: map['BOT_MSG_PHONE_WITH_CHANNEL'] || '',
      channelRequired: map['BOT_MSG_CHANNEL_REQUIRED'] || '',
      channelWait: map['BOT_MSG_CHANNEL_WAIT'] || '',
      namePrompt: map['BOT_MSG_NAME_PROMPT'] || '',
      loginPrompt: map['BOT_MSG_LOGIN_PROMPT'] || '',
      loginTaken: map['BOT_MSG_LOGIN_TAKEN'] || '',
      passwordPrompt: map['BOT_MSG_PASSWORD_PROMPT'] || '',
      success: map['BOT_MSG_SUCCESS'] || '',
    },
  };
}

function tpl(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replaceAll(`{${k}}`, v);
  }
  return result;
}

async function sendMessage(token: string, chatId: number | string, text: string, options: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...options }),
  });
  return res.json();
}

async function checkChannelMembership(token: string, userId: number, channelId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: channelId, user_id: userId }),
    });
    const data = await res.json();
    if (!data.ok) return false;
    return ['member', 'administrator', 'creator'].includes(data.result?.status);
  } catch {
    return false;
  }
}

async function checkAllChannels(token: string, userId: number, channels: string[]): Promise<string[]> {
  if (channels.length === 0) return [];
  const results = await Promise.all(
    channels.map(async (ch) => ({ ch, ok: await checkChannelMembership(token, userId, ch) }))
  );
  return results.filter(r => !r.ok).map(r => r.ch);
}

// O'quvchi parol hashi (juris_salt_2024 bilan)
async function hashPasswordOquvchi(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'juris_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function updateSession(chatId: number, updates: Record<string, unknown>) {
  await supabaseAdmin
    .from('bot_sessions')
    .upsert({ chat_id: chatId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' });
}

async function getSession(chatId: number) {
  const { data } = await supabaseAdmin
    .from('bot_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();
  return data;
}

function channelToLink(ch: string): string | null {
  if (ch.startsWith('@')) return `https://t.me/${ch.slice(1)}`;
  return null;
}

function buildChannelButtons(channels: string[]) {
  const buttons = channels.map(ch => {
    const link = channelToLink(ch);
    if (link) return [{ text: `📢 ${ch} kanaliga o'tish`, url: link }];
    return [{ text: `📢 ${ch}`, callback_data: 'noop' }];
  });
  buttons.push([{ text: '✅ Tekshirish', callback_data: 'check_membership' }]);
  return buttons;
}

function formatChannelList(channels: string[]): string {
  if (channels.length === 0) return '   • (kanal sozlanmagan)';
  return channels.map(c => `   • <b>${c}</b>`).join('\n');
}

// ── USTOZ BOT SESSIYASI ──────────────────────────────────────────────────────
// Ustoz uchun alohida sessiya boshqaruvi (bot_sessions da tur: 'ustoz' bilan)
async function getUstozSession(chatId: number) {
  const { data } = await supabaseAdmin
    .from('bot_sessions')
    .select('*')
    .eq('chat_id', chatId)
    .maybeSingle();
  return data;
}

async function sendUstozWelcome(token: string, chatId: number | string, siteUrl: string) {
  return sendMessage(token, chatId,
    `👨‍🏫 <b>Ustoz sifatida ro'yxatdan o'tish</b>\n\n` +
    `Ushbu bot orqali siz <b>ustoz</b> sifatida ariza topshirishingiz mumkin.\n\n` +
    `Admin arizangizni ko'rib chiqqach, tasdiqlash yoki rad etish haqida Telegram orqali xabar olasiz.\n\n` +
    `📱 Iltimos, telefon raqamingizni yuboring:`,
    {
      reply_markup: {
        keyboard: [[{ text: '📱 Telefon raqamni ulashish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    }
  );
}

// ── CALLBACK QUERY ──────────────────────────────────────────────────────────
async function handleCallbackQuery(callbackQuery: any, cfg: BotConfig): Promise<void> {
  const chatId: number = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
  const telegramId: number = callbackQuery.from?.id;
  const data: string = callbackQuery.data || '';
  const callbackQueryId: string = callbackQuery.id;

  const answerCb = (text = '') =>
    fetch(`https://api.telegram.org/bot${cfg.token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });

  if (data === 'noop') { await answerCb(''); return; }

  if (data === 'restart') {
    await answerCb('🔄 Qayta boshlash...');
    await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
    await updateSession(chatId, { telegram_id: telegramId, state: 'waiting_phone' });
    await sendWelcome(chatId, cfg);
    return;
  }

  if (data === 'check_membership') {
    const [notMember, session] = await Promise.all([
      checkAllChannels(cfg.token, telegramId, cfg.channels),
      getSession(chatId),
    ]);

    if (notMember.length === 0) {
      await answerCb('✅ Tasdiqlandi!');
      if (session?.phone) {
        await supabaseAdmin
          .from('bot_sessions')
          .update({ state: 'waiting_name_surname', updated_at: new Date().toISOString() })
          .eq('chat_id', chatId);
        await sendMessage(cfg.token, chatId, cfg.msgs.namePrompt);
      } else {
        await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
        await updateSession(chatId, { telegram_id: telegramId, state: 'waiting_phone' });
        await sendWelcome(chatId, cfg);
      }
    } else {
      await answerCb("❌ Hali a'zo bo'lmagansiz!");
      await sendChannelCheck(chatId, notMember, cfg);
    }
  }
}

async function sendWelcome(chatId: number | string, cfg: BotConfig) {
  const channelList = formatChannelList(cfg.channels);
  const text = tpl(cfg.msgs.welcome, { KANALLAR: channelList });
  return sendMessage(cfg.token, chatId, text, {
    reply_markup: {
      keyboard: [[{ text: '📱 Telefon raqamni ulashish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    }
  });
}

async function sendChannelCheck(chatId: number | string, notMember: string[], cfg: BotConfig) {
  const channelLines = notMember.map(c => `👉 <b>${c}</b>`).join('\n');
  const text = tpl(cfg.msgs.channelRequired, { KANALLAR: channelLines });
  return sendMessage(cfg.token, chatId, text, {
    reply_markup: { inline_keyboard: buildChannelButtons(notMember) }
  });
}

// ── WEBHOOK HANDLER — verify_jwt = false (Telegram serverlari Authorization header'siz chaqiradi)
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const [cfg, body] = await Promise.all([
      loadConfig(),
      req.json(),
    ]);

    if (!cfg.token) { console.error('Bot token topilmadi!'); return new Response('ok', { status: 200 }); }

    console.log('Update:', JSON.stringify(body).slice(0, 300));

    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query, cfg);
      return new Response('ok', { status: 200 });
    }

    const message = body.message || body.edited_message;
    if (!message) return new Response('ok', { status: 200 });

    const chatId: number = message.chat.id;
    const telegramId: number = message.from?.id || chatId;
    const text: string = message.text || '';
    const contact = message.contact;

    // ── /start buyrug'i ──────────────────────────────────────────────────────
    if (text === '/start' || text.startsWith('/start ')) {
      const startParam = text.split(' ')[1] || '';

      // /start ustoz — ustoz ro'yxatdan o'tish
      if (startParam === 'ustoz') {
        await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
        await updateSession(chatId, {
          telegram_id: telegramId,
          state: 'ustoz_waiting_phone',
        });
        await sendUstozWelcome(cfg.token, chatId, cfg.siteUrl);
        return new Response('ok', { status: 200 });
      }

      // Oddiy /start — o'quvchi ro'yxatdan o'tish
      await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
      await updateSession(chatId, { telegram_id: telegramId, state: 'waiting_phone' });
      await sendWelcome(chatId, cfg);
      return new Response('ok', { status: 200 });
    }

    // Session yuklash
    const session = await getSession(chatId);
    const state: string = session?.state || 'waiting_phone';

    // ════════════════════════════════════════════════════════════════════════
    // USTOZ RO'YXATDAN O'TISH BOSQICHLARI
    // ════════════════════════════════════════════════════════════════════════

    // USTOZ — TELEFON
    if (state === 'ustoz_waiting_phone') {
      if (contact?.phone_number) {
        const phone = contact.phone_number.startsWith('+') ? contact.phone_number : '+' + contact.phone_number;
        const phoneDigits = phone.replace(/\D/g, '');

        // Allaqachon ustoz sifatida ro'yxatdan o'tganmi?
        const { data: mavjudUstoz } = await supabaseAdmin
          .from('ustoz')
          .select('id, full_name, status')
          .or(`phone.eq.${phone},phone.eq.${phoneDigits}`)
          .maybeSingle();

        if (mavjudUstoz?.status === 'approved') {
          await sendMessage(cfg.token, chatId,
            `⚠️ <b>Siz allaqachon ustoz sifatida ro'yxatdan o'tgansiz va tasdiqlangansiz!</b>\n\n` +
            `👤 Ism: <b>${mavjudUstoz.full_name}</b>\n\n` +
            `Saytga kirish uchun telefon raqamingiz va parolingizdan foydalaning.`,
            { reply_markup: { inline_keyboard: [[{ text: cfg.siteBtnText, url: cfg.siteUrl }]], remove_keyboard: true } }
          );
          await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
          return new Response('ok', { status: 200 });
        }

        if (mavjudUstoz?.status === 'pending') {
          await sendMessage(cfg.token, chatId,
            `⏳ <b>Arizangiz allaqachon yuborilgan va admin ko'rib chiqmoqda.</b>\n\n` +
            `👤 Ism: <b>${mavjudUstoz.full_name}</b>\n\n` +
            `Admin tasdiqlashi haqida Telegram orqali xabar olasiz.`,
            { reply_markup: { remove_keyboard: true } }
          );
          await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
          return new Response('ok', { status: 200 });
        }

        // Keyboard'ni olib tashlash
        await sendMessage(cfg.token, chatId, '✅ <b>Telefon raqam qabul qilindi!</b>', {
          reply_markup: { remove_keyboard: true }
        });

        // Telegram username olish
        let telegramUsername = '';
        try {
          const chatRes = await fetch(`https://api.telegram.org/bot${cfg.token}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId }),
          });
          const chatData = await chatRes.json();
          if (chatData.ok && chatData.result?.username) {
            telegramUsername = '@' + chatData.result.username;
          }
        } catch {}

        await updateSession(chatId, {
          phone,
          telegram_id: telegramId,
          state: 'ustoz_waiting_name',
          login_id: phone,
          ism: telegramUsername, // vaqtincha telegram username saqlash
        });

        await sendMessage(cfg.token, chatId,
          `👤 Endi ism va familiyangizni <b>birgalikda</b> kiriting.\n\n📝 <i>Misol: Abdullayev Jasur</i>\n(Avval familiya, keyin ism)`
        );
      } else {
        await sendUstozWelcome(cfg.token, chatId, cfg.siteUrl);
      }
      return new Response('ok', { status: 200 });
    }

    // USTOZ — ISM + FAMILIYA
    if (state === 'ustoz_waiting_name') {
      if (!text || text.startsWith('/')) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, ism va familiyangizni kiriting.\n\n📝 <i>Misol: Abdullayev Jasur</i>');
        return new Response('ok', { status: 200 });
      }
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, <b>familiya va ismni</b> bo\'sh joy bilan ajrating.\n\n📝 <i>Misol: Abdullayev Jasur</i>');
        return new Response('ok', { status: 200 });
      }
      const familiya = parts[0];
      const ism = parts.slice(1).join(' ');
      const fullName = `${familiya} ${ism}`;
      const curSess = await getSession(chatId);
      const telegramUsername = curSess?.ism || ''; // avval saqlangan telegram username

      await updateSession(chatId, {
        ism: fullName, // fullName saqlanadi
        familiya: familiya,
        state: 'ustoz_waiting_password',
        login_id: telegramUsername, // telegram username login_id da saqlanadi
      });

      await sendMessage(cfg.token, chatId,
        `✅ <b>Ajoyib!</b>\n\n` +
        `👤 F.I.O: <b>${fullName}</b>\n\n` +
        `🔒 Endi <b>parol</b> o'rnating.\n\n` +
        `⚠️ <b>Parol talablari:</b>\n` +
        `• Kamida <b>8 ta</b> belgi\n` +
        `• Kamida <b>1 ta katta harf</b> (A-Z)\n` +
        `• Kamida <b>1 ta raqam</b> (0-9)\n\n` +
        `<i>Masalan: Ustoz2024</i>`
      );
      return new Response('ok', { status: 200 });
    }

    // USTOZ — PAROL
    if (state === 'ustoz_waiting_password') {
      if (!text || text.startsWith('/')) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, parol kiriting:');
        return new Response('ok', { status: 200 });
      }
      const parol = text.trim();
      if (parol.length < 8) {
        await sendMessage(cfg.token, chatId, '❌ Parol kamida <b>8 ta</b> belgidan iborat bo\'lishi kerak.\n\nQayta kiriting:');
        return new Response('ok', { status: 200 });
      }
      if (!/[A-Z]/.test(parol)) {
        await sendMessage(cfg.token, chatId, '❌ Parolda kamida <b>1 ta katta harf (A-Z)</b> bo\'lishi kerak.\n\nQayta kiriting:');
        return new Response('ok', { status: 200 });
      }
      if (!/[0-9]/.test(parol)) {
        await sendMessage(cfg.token, chatId, '❌ Parolda kamida <b>1 ta raqam (0-9)</b> bo\'lishi kerak.\n\nQayta kiriting:');
        return new Response('ok', { status: 200 });
      }

      const curSession = await getSession(chatId);
      if (!curSession?.ism || !curSession?.phone) {
        await sendMessage(cfg.token, chatId, '❌ Sessiya xatosi.\n\n/start ustoz buyrug\'ini bosing va qayta boshlang.');
        return new Response('ok', { status: 200 });
      }

      const parolHash = await hashPasswordOquvchi(parol);
      const phone = curSession.phone;
      const fullName = curSession.ism; // fullName
      const telegramUsername = curSession.login_id || ''; // telegram @username

      // Ustoz jadvaliga qo'shish yoki yangilash
      const { data: mavjudUstoz } = await supabaseAdmin
        .from('ustoz')
        .select('id')
        .or(`phone.eq.${phone},username.eq.${phone.replace(/\D/g, '')}`)
        .maybeSingle();

      const ustozUsername = phone.replace(/\D/g, '');

      if (mavjudUstoz) {
        await supabaseAdmin.from('ustoz').update({
          full_name: fullName,
          parol_hash: parolHash,
          phone,
          telegram_chat_id: chatId,
          telegram_username: telegramUsername || null,
          status: 'pending',
        }).eq('id', mavjudUstoz.id);
      } else {
        await supabaseAdmin.from('ustoz').insert({
          username: ustozUsername,
          password_hash: parolHash,
          parol_hash: parolHash,
          full_name: fullName,
          phone,
          telegram_chat_id: chatId,
          telegram_username: telegramUsername || null,
          status: 'pending',
        });
      }

      // Session o'chirish va tabrik xabari
      await Promise.all([
        supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId),
        sendMessage(cfg.token, chatId,
          `🎉 <b>Ariza muvaffaqiyatli yuborildi!</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `👤 F.I.O: <b>${fullName}</b>\n` +
          `📱 Telefon: <code>${phone}</code>\n` +
          `🔒 Parol: <code>${parol}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `⏳ Admin arizangizni ko'rib chiqadi va tasdiqlash haqida Telegram orqali xabar yuboriladi.\n\n` +
          `⚠️ <i>Parolingizni eslab qoling!</i>`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: cfg.siteBtnText, url: cfg.siteUrl }]]
            }
          }
        ),
      ]);

      return new Response('ok', { status: 200 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // O'QUVCHI RO'YXATDAN O'TISH BOSQICHLARI (mavjud)
    // ════════════════════════════════════════════════════════════════════════

    // TELEFON
    if (state === 'waiting_phone') {
      if (contact?.phone_number) {
        const phone = contact.phone_number;

        const { data: mavjudTalaba } = await supabaseAdmin
          .from('talabalar').select('id, ism, familiya').eq('phone', phone).maybeSingle();
        if (mavjudTalaba) {
          await sendMessage(cfg.token, chatId,
            `⚠️ <b>Siz allaqachon ro'yxatdan o'tgansiz!</b>\n\n👤 Ism: <b>${mavjudTalaba.ism} ${mavjudTalaba.familiya}</b>\n\n🔑 Saytga kirish uchun telefon raqamingiz va parolingizdan foydalaning.`,
            { reply_markup: { inline_keyboard: [[{ text: cfg.siteBtnText, url: cfg.siteUrl }]] } }
          );
          return new Response('ok', { status: 200 });
        }

        const { data: loginBand } = await supabaseAdmin
          .from('talabalar').select('id').eq('login_id', phone).maybeSingle();
        if (loginBand) {
          await sendMessage(cfg.token, chatId,
            `⚠️ <b>Bu raqam bilan foydalanuvchi allaqachon mavjud!</b>\n\nIltimos, admin bilan bog'laning.`,
            { reply_markup: { inline_keyboard: [[{ text: cfg.siteBtnText, url: cfg.siteUrl }]] } }
          );
          return new Response('ok', { status: 200 });
        }

        await sendMessage(cfg.token, chatId, '✅ <b>Telefon raqam qabul qilindi!</b>', {
          reply_markup: { remove_keyboard: true }
        });

        if (cfg.channels.length === 0) {
          await updateSession(chatId, { phone, state: 'waiting_name_surname' });
          await sendMessage(cfg.token, chatId, cfg.msgs.phoneNoChannel);
        } else {
          const notMember = await checkAllChannels(cfg.token, telegramId, cfg.channels);
          if (notMember.length === 0) {
            await updateSession(chatId, { phone, state: 'waiting_name_surname' });
            await sendMessage(cfg.token, chatId, cfg.msgs.phoneWithChannel);
          } else {
            await updateSession(chatId, { phone, telegram_id: telegramId, state: 'waiting_channel' });
            await sendChannelCheck(chatId, notMember, cfg);
          }
        }
      } else {
        await sendWelcome(chatId, cfg);
      }
      return new Response('ok', { status: 200 });
    }

    // KANAL KUTISH
    if (state === 'waiting_channel') {
      await sendMessage(cfg.token, chatId, cfg.msgs.channelWait);
      return new Response('ok', { status: 200 });
    }

    // ISM + FAMILIYA
    if (state === 'waiting_name_surname') {
      if (!text || text.startsWith('/')) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, ism va familiyangizni kiriting.\n\n📝 <i>Misol: Abdullayev Jasur</i>');
        return new Response('ok', { status: 200 });
      }
      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, <b>familiya va ismni</b> bo\'sh joy bilan ajrating.\n\n📝 <i>Misol: Abdullayev Jasur</i>');
        return new Response('ok', { status: 200 });
      }
      const familiya = parts[0];
      const ism = parts.slice(1).join(' ');
      const curSess = await getSession(chatId);
      const phoneLogin = curSess?.phone || '';
      await updateSession(chatId, { ism, familiya, login_id: phoneLogin, state: 'waiting_password' });
      const msg = tpl(cfg.msgs.passwordPrompt, { LOGIN: phoneLogin });
      await sendMessage(cfg.token, chatId, msg);
      return new Response('ok', { status: 200 });
    }

    // WAITING_LOGIN (eski sessiyalar uchun)
    if (state === 'waiting_login') {
      const curS = await getSession(chatId);
      if (curS?.phone) {
        await updateSession(chatId, { login_id: curS.phone, state: 'waiting_password' });
        const msg = tpl(cfg.msgs.passwordPrompt, { LOGIN: curS.phone });
        await sendMessage(cfg.token, chatId, msg);
      } else {
        await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
        await updateSession(chatId, { telegram_id: telegramId, state: 'waiting_phone' });
        await sendWelcome(chatId, cfg);
      }
      return new Response('ok', { status: 200 });
    }

    // PAROL
    if (state === 'waiting_password') {
      if (!text || text.startsWith('/')) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, parol kiriting:');
        return new Response('ok', { status: 200 });
      }
      const parol = text.trim();
      if (parol.length < 8) {
        await sendMessage(cfg.token, chatId, '❌ Parol kamida <b>8 ta</b> belgidan iborat bo\'lishi kerak.\n\nQayta kiriting:');
        return new Response('ok', { status: 200 });
      }
      if (!/[A-Z]/.test(parol)) {
        await sendMessage(cfg.token, chatId, '❌ Parolda kamida <b>1 ta katta harf (A-Z)</b> bo\'lishi kerak.\n\nQayta kiriting:');
        return new Response('ok', { status: 200 });
      }
      if (!/[0-9]/.test(parol)) {
        await sendMessage(cfg.token, chatId, '❌ Parolda kamida <b>1 ta raqam (0-9)</b> bo\'lishi kerak.\n\nQayta kiriting:');
        return new Response('ok', { status: 200 });
      }

      const curSession = await getSession(chatId);
      if (!curSession?.ism || !curSession?.familiya || !curSession?.login_id) {
        await sendMessage(cfg.token, chatId, '❌ Sessiya xatosi.\n\n/start buyrug\'ini bosing va qayta boshlang.');
        return new Response('ok', { status: 200 });
      }

      const [parolHash, mavjudRes] = await Promise.all([
        hashPasswordOquvchi(parol),
        supabaseAdmin.from('talabalar').select('id')
          .eq('ism', curSession.ism).eq('familiya', curSession.familiya)
          .is('login_id', null).maybeSingle(),
      ]);

      if (mavjudRes.data) {
        await supabaseAdmin.from('talabalar').update({
          login_id: curSession.login_id,
          parol_hash: parolHash,
          phone: curSession.phone,
          telegram_chat_id: chatId,
        }).eq('id', mavjudRes.data.id);
      } else {
        await supabaseAdmin.from('talabalar').insert({
          ism: curSession.ism,
          familiya: curSession.familiya,
          guruh: '',
          kurs: '',
          login_id: curSession.login_id,
          parol_hash: parolHash,
          phone: curSession.phone,
          telegram_chat_id: chatId,
        });
      }

      const successMsg = tpl(cfg.msgs.success, {
        ISM: curSession.ism,
        FAMILIYA: curSession.familiya,
        LOGIN: curSession.login_id,
        PAROL: parol,
      });

      await Promise.all([
        supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId),
        sendMessage(cfg.token, chatId, successMsg, {
          reply_markup: { inline_keyboard: [[{ text: cfg.siteBtnText, url: cfg.siteUrl }]] }
        }),
      ]);

      return new Response('ok', { status: 200 });
    }

    // Noma'lum holat
    await sendMessage(cfg.token, chatId, '❓ Noma\'lum buyruq.\n\n/start buyrug\'ini bosing va qayta boshlang.', {
      reply_markup: { inline_keyboard: [[{ text: '🚀 Boshlash', callback_data: 'restart' }]] }
    });
    return new Response('ok', { status: 200 });

  } catch (e: unknown) {
    console.error('Bot webhook xatosi:', e);
    return new Response('ok', { status: 200 });
  }
});
