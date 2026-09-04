// Telegram Login Bot webhook — verify_jwt = false (Telegram serverlari Authorization header'siz chaqiradi)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
    .eq('session_token', sessionToken)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString());

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
    // Token bilan qaytish linki — qaysi brauzerda ochilmasin ishlaydi
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

      // Session tokenni DB da tekshirish
      const { data: loginSession } = await supabaseAdmin
        .from('telegram_login_sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .eq('status', 'pending')
        .gte('expires_at', new Date().toISOString())
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
