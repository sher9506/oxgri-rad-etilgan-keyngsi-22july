import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Ustoz Bot webhook — verify_jwt = false (Telegram serverlari Authorization header'siz chaqiradi)
// ── Bot konfiguratsiya ──────────────────────────────────────────────────────
interface BotConfig {
  token: string;
  siteUrl: string;
  siteBtnText: string;
}

async function loadConfig(): Promise<BotConfig> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', ['USTOZ_BOT_TOKEN', 'USTOZ_BOT_SITE_URL', 'USTOZ_BOT_SITE_BUTTON_TEXT']);

  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });

  return {
    token: map['USTOZ_BOT_TOKEN'] || '',
    siteUrl: map['USTOZ_BOT_SITE_URL'] || 'https://fanfaster.uz',
    siteBtnText: map['USTOZ_BOT_SITE_BUTTON_TEXT'] || '🌐 Saytga kirish',
  };
}

// ── Xabar yuborish ──────────────────────────────────────────────────────────
async function sendMessage(token: string, chatId: number | string, text: string, options: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...options }),
  });
  const json = await res.json();
  if (!json.ok) console.error('sendMessage error:', json.description);
  return json;
}

// ── Parol hash (ustoz uchun: juris_salt_2024) ──────────────────────────────
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'juris_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Sessiya boshqaruvi (ustoz_bot_sessions kalit bilan) ──────────────────────
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
    .upsert({ chat_id: chatId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'chat_id' });
}

async function deleteSession(chatId: number) {
  await supabaseAdmin.from('bot_sessions').delete().eq('chat_id', chatId);
}

// ── Telegram username olish ──────────────────────────────────────────────────
async function getTelegramUsername(token: string, chatId: number): Promise<string> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId }),
    });
    const data = await res.json();
    if (data.ok && data.result?.username) return '@' + data.result.username;
  } catch {}
  return '';
}

// ── XUSH KELIBSIZ XABARI ────────────────────────────────────────────────────
async function sendWelcome(token: string, chatId: number, siteUrl: string) {
  return sendMessage(token, chatId,
    `👨‍🏫 <b>Ustoz ro'yxatdan o'tish botiga xush kelibsiz!</b>\n\n` +
    `Ushbu bot orqali siz <b>ustoz</b> sifatida ariza topshirishingiz mumkin.\n\n` +
    `📋 <b>Jarayon:</b>\n` +
    `1️⃣ Telefon raqamingizni ulashing\n` +
    `2️⃣ Ism va familiyangizni kiriting\n` +
    `3️⃣ Parol o'rnating\n` +
    `4️⃣ Admin tasdiqlaguncha kuting\n\n` +
    `📱 Iltimos, pastdagi tugmani bosib telefon raqamingizni ulashing:`,
    {
      reply_markup: {
        keyboard: [[{ text: '📱 Telefon raqamni ulashish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    }
  );
}

// ── WEBHOOK HANDLER ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const [cfg, body] = await Promise.all([loadConfig(), req.json()]);

    if (!cfg.token) {
      console.error('Ustoz bot token topilmadi!');
      return new Response('ok', { status: 200 });
    }

    console.log('Ustoz Bot Update:', JSON.stringify(body).slice(0, 300));

    // Callback query
    if (body.callback_query) {
      const callbackQueryId = body.callback_query.id;
      await fetch(`https://api.telegram.org/bot${cfg.token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text: '' }),
      });
      return new Response('ok', { status: 200 });
    }

    const message = body.message || body.edited_message;
    if (!message) return new Response('ok', { status: 200 });

    const chatId: number = message.chat.id;
    const telegramId: number = message.from?.id || chatId;
    const text: string = message.text || '';
    const contact = message.contact;

    // ── /start yoki birinchi murojaat ──────────────────────────────────────
    if (text === '/start' || text.startsWith('/start ')) {
      await deleteSession(chatId);
      await updateSession(chatId, {
        telegram_id: telegramId,
        state: 'ustoz_waiting_phone',
      });
      await sendWelcome(cfg.token, chatId, cfg.siteUrl);
      return new Response('ok', { status: 200 });
    }

    // Session yuklash
    const session = await getSession(chatId);
    const state: string = session?.state || 'ustoz_waiting_phone';

    // ════════════════════════════════════════════════════════════════════════
    // 1-BOSQICH: TELEFON
    // ════════════════════════════════════════════════════════════════════════
    if (state === 'ustoz_waiting_phone') {
      if (contact?.phone_number) {
        const phone = contact.phone_number.startsWith('+') ? contact.phone_number : '+' + contact.phone_number;

        // Allaqachon tasdiqlangan ustoz?
        const { data: mavjudUstoz } = await supabaseAdmin
          .from('ustoz')
          .select('id, full_name, status')
          .eq('phone', phone)
          .maybeSingle();

        if (mavjudUstoz?.status === 'approved') {
          await sendMessage(cfg.token, chatId,
            `⚠️ <b>Bu raqam bilan allaqachon tasdiqlangan ustoz mavjud!</b>\n\n` +
            `👤 F.I.O: <b>${mavjudUstoz.full_name}</b>\n\n` +
            `Saytga kirish uchun telefon raqamingiz va parolingizdan foydalaning.`,
            { reply_markup: { inline_keyboard: [[{ text: cfg.siteBtnText, url: cfg.siteUrl }]], remove_keyboard: true } }
          );
          await deleteSession(chatId);
          return new Response('ok', { status: 200 });
        }

        if (mavjudUstoz?.status === 'pending') {
          await sendMessage(cfg.token, chatId,
            `⏳ <b>Arizangiz allaqachon yuborilgan!</b>\n\n` +
            `👤 F.I.O: <b>${mavjudUstoz.full_name}</b>\n\n` +
            `Admin arizangizni ko'rib chiqmoqda. Natija haqida Telegram orqali xabar olasiz.`,
            { reply_markup: { remove_keyboard: true } }
          );
          await deleteSession(chatId);
          return new Response('ok', { status: 200 });
        }

        // Keyboard'ni olib tashlash
        await sendMessage(cfg.token, chatId, '✅ <b>Telefon raqam qabul qilindi!</b>', {
          reply_markup: { remove_keyboard: true }
        });

        // Telegram username olish
        const telegramUsername = await getTelegramUsername(cfg.token, chatId);

        await updateSession(chatId, {
          phone,
          telegram_id: telegramId,
          state: 'ustoz_waiting_name',
          login_id: telegramUsername, // vaqtincha telegram username saqlash
        });

        await sendMessage(cfg.token, chatId,
          `👤 Endi ism va familiyangizni <b>birgalikda</b> kiriting.\n\n` +
          `📝 <i>Misol: Abdullayev Jasur</i>\n` +
          `(Avval familiya, keyin ism)`
        );
      } else {
        // Telefon tugmasiz xabar kelgan - qayta so'rash
        await sendWelcome(cfg.token, chatId, cfg.siteUrl);
      }
      return new Response('ok', { status: 200 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2-BOSQICH: ISM + FAMILIYA
    // ════════════════════════════════════════════════════════════════════════
    if (state === 'ustoz_waiting_name') {
      if (!text || text.startsWith('/')) {
        await sendMessage(cfg.token, chatId,
          '❌ Iltimos, ism va familiyangizni kiriting.\n\n📝 <i>Misol: Abdullayev Jasur</i>'
        );
        return new Response('ok', { status: 200 });
      }

      const parts = text.trim().split(/\s+/);
      if (parts.length < 2) {
        await sendMessage(cfg.token, chatId,
          '❌ Iltimos, <b>familiya va ismni</b> bo\'sh joy bilan ajrating.\n\n📝 <i>Misol: Abdullayev Jasur</i>'
        );
        return new Response('ok', { status: 200 });
      }

      const familiya = parts[0];
      const ism = parts.slice(1).join(' ');
      const fullName = `${familiya} ${ism}`;
      const curSess = await getSession(chatId);
      const telegramUsername = curSess?.login_id || ''; // telegram username login_id da saqlanadi

      await updateSession(chatId, {
        ism: fullName, // to'liq ism
        familiya: familiya,
        state: 'ustoz_waiting_password',
        login_id: telegramUsername, // telegram username
      });

      await sendMessage(cfg.token, chatId,
        `✅ <b>Ajoyib!</b>\n\n` +
        `👤 F.I.O: <b>${fullName}</b>\n\n` +
        `🔒 Endi sayt uchun <b>parol</b> o'rnating.\n\n` +
        `⚠️ <b>Parol talablari:</b>\n` +
        `• Kamida <b>8 ta</b> belgi\n` +
        `• Kamida <b>1 ta katta harf</b> (A-Z)\n` +
        `• Kamida <b>1 ta raqam</b> (0-9)\n\n` +
        `<i>Masalan: Ustoz2024</i>`
      );
      return new Response('ok', { status: 200 });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3-BOSQICH: PAROL
    // ════════════════════════════════════════════════════════════════════════
    if (state === 'ustoz_waiting_password') {
      if (!text || text.startsWith('/')) {
        await sendMessage(cfg.token, chatId, '❌ Iltimos, parol kiriting:');
        return new Response('ok', { status: 200 });
      }

      const parol = text.trim();

      // Parol validatsiyasi
      if (parol.length < 8) {
        await sendMessage(cfg.token, chatId,
          '❌ Parol kamida <b>8 ta</b> belgidan iborat bo\'lishi kerak.\n\nQayta kiriting:'
        );
        return new Response('ok', { status: 200 });
      }
      if (!/[A-Z]/.test(parol)) {
        await sendMessage(cfg.token, chatId,
          '❌ Parolda kamida <b>1 ta katta harf (A-Z)</b> bo\'lishi kerak.\n\nQayta kiriting:'
        );
        return new Response('ok', { status: 200 });
      }
      if (!/[0-9]/.test(parol)) {
        await sendMessage(cfg.token, chatId,
          '❌ Parolda kamida <b>1 ta raqam (0-9)</b> bo\'lishi kerak.\n\nQayta kiriting:'
        );
        return new Response('ok', { status: 200 });
      }

      const curSession = await getSession(chatId);
      if (!curSession?.ism || !curSession?.phone) {
        await sendMessage(cfg.token, chatId,
          '❌ Sessiya xatosi.\n\n/start buyrug\'ini yuboring va qayta boshlang.'
        );
        return new Response('ok', { status: 200 });
      }

      const parolHash = await hashPassword(parol);
      const phone = curSession.phone;
      const fullName = curSession.ism;
      const telegramUsername = curSession.login_id || '';
      const ustozUsername = phone.replace(/\D/g, '');

      // Ustoz jadvaliga qo'shish yoki yangilash
      const { data: mavjud } = await supabaseAdmin
        .from('ustoz')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (mavjud) {
        await supabaseAdmin.from('ustoz').update({
          full_name: fullName,
          parol_hash: parolHash,
          password_hash: parolHash,
          phone,
          telegram_chat_id: chatId,
          telegram_username: telegramUsername || null,
          status: 'pending',
        }).eq('id', mavjud.id);
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

      // Sessiyani o'chirish va muvaffaqiyat xabari
      await Promise.all([
        deleteSession(chatId),
        sendMessage(cfg.token, chatId,
          `🎉 <b>Ariza muvaffaqiyatli yuborildi!</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `👤 F.I.O: <b>${fullName}</b>\n` +
          `📱 Telefon: <code>${phone}</code>\n` +
          `🔒 Parol: <code>${parol}</code>\n` +
          (telegramUsername ? `✈️ Telegram: <b>${telegramUsername}</b>\n` : '') +
          `━━━━━━━━━━━━━━━━━━━\n\n` +
          `⏳ <b>Admin arizangizni ko'rib chiqadi</b> va tasdiqlash haqida shu botdan xabar olasiz.\n\n` +
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

    // Noma'lum holat
    await sendMessage(cfg.token, chatId,
      '❓ Noma\'lum buyruq.\n\n/start buyrug\'ini yuboring.',
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🚀 Boshlash', callback_data: 'start' }]]
        }
      }
    );
    return new Response('ok', { status: 200 });

  } catch (e: unknown) {
    console.error('Ustoz Bot webhook xatosi:', e);
    return new Response('ok', { status: 200 });
  }
});
