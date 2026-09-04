/**
 * Bot Notification Utility
 * Telegram bot orqali o'quv materiali, test va kazus haqida chiroyli xabar yuborish
 */

import { supabase } from './supabase';

interface BotConfig {
  token: string;
  siteUrl: string;
  siteBtnText: string;
}

async function getBotConfigs(): Promise<{ student: BotConfig; teacher: BotConfig }> {
  const { data } = await supabase
    .from('settings')
    .select('key, text_value')
    .in('key', [
      'TELEGRAM_TOKEN', 'BOT_SITE_URL', 'BOT_SITE_BUTTON_TEXT',
      'USTOZ_BOT_TOKEN', 'USTOZ_BOT_SITE_URL', 'USTOZ_BOT_SITE_BUTTON_TEXT',
    ]);

  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });

  return {
    student: {
      token: map['TELEGRAM_TOKEN'] || '',
      siteUrl: map['BOT_SITE_URL'] || 'https://fanfaster.uz',
      siteBtnText: map['BOT_SITE_BUTTON_TEXT'] || '🌐 FanFaster.uz',
    },
    teacher: {
      token: map['USTOZ_BOT_TOKEN'] || '',
      siteUrl: map['USTOZ_BOT_SITE_URL'] || 'https://fanfaster.uz',
      siteBtnText: map['USTOZ_BOT_SITE_BUTTON_TEXT'] || '🌐 Saytga kirish',
    },
  };
}

async function sendTelegramBroadcast(token: string, chatIds: number[], text: string, siteUrl: string, btnText: string): Promise<void> {
  if (!token || chatIds.length === 0) return;

  const keyboard = {
    inline_keyboard: [[{ text: btnText, url: siteUrl }]],
  };

  // Batch: parallel yuborish (max 5 ta bir vaqtda)
  const batchSize = 5;
  for (let i = 0; i < chatIds.length; i += batchSize) {
    const batch = chatIds.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((chatId) =>
        supabase.functions.invoke('telegram-api', {
          body: {
            token,
            method: 'sendMessage',
            body: {
              chat_id: chatId,
              text,
              parse_mode: 'HTML',
              reply_markup: keyboard,
            },
          },
        }).catch(() => null)
      )
    );
    // Rate limiting
    if (i + batchSize < chatIds.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

function hajmFormat(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function faylTurEmoji(tur: string): string {
  if (tur === 'audio') return '🎵';
  if (tur === 'video') return '🎬';
  if (tur === 'pdf') return '📕';
  if (tur === 'docx') return '📝';
  return '📄';
}

// ─────────────────────────────────────────────────────────────────────────────
// O'QUV MATERIALI YUKLANGANDA BOT XABARI
// ─────────────────────────────────────────────────────────────────────────────
export async function sendMaterialBotXabar(params: {
  bolimNomi: string;
  bobNomi: string;
  materialNomi: string;
  faylTur: string;
  faylHajm?: number;
  ustozIsmi: string;
  tavsif?: string;
}): Promise<void> {
  const { bolimNomi, bobNomi, materialNomi, faylTur, faylHajm, ustozIsmi, tavsif } = params;

  const emoji = faylTurEmoji(faylTur);
  const hajm = faylHajm ? ` · ${hajmFormat(faylHajm)}` : '';
  const faylTurMatn = faylTur === 'audio' ? 'Audio fayl' : faylTur === 'video' ? 'Video dars' : faylTur === 'pdf' ? 'PDF fayl' : faylTur === 'docx' ? 'Word hujjat' : 'HTML sahifa';

  const text =
    `📚 <b>YANGI O'QUV MATERIALI!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `${emoji} <b>${materialNomi}</b>${hajm}\n\n` +
    `📂 <b>Bo'lim:</b> ${bolimNomi}\n` +
    `📁 <b>Bob:</b> ${bobNomi}\n` +
    `📎 <b>Format:</b> ${faylTurMatn}\n` +
    `👨‍🏫 <b>Ustoz:</b> ${ustozIsmi}\n` +
    (tavsif ? `\n💡 <i>${tavsif}</i>\n` : '') +
    `\n━━━━━━━━━━━━━━━━━━━\n` +
    `<b>📖 Qanday kiriladi?</b>\n` +
    `1️⃣ Saytga kiring\n` +
    `2️⃣ <b>"O'quv Materiallari"</b> bo'limiga o'ting\n` +
    `3️⃣ <b>"${bolimNomi}"</b> bo'limini oching\n` +
    `4️⃣ <b>"${bobNomi}"</b> bobidan materialni toping\n\n` +
    `👇 Pastdagi tugmani bosib kirish mumkin!`;

  const configs = await getBotConfigs();

  // O'quvchi chat_id lari
  const { data: talabalar } = await supabase
    .from('talabalar')
    .select('telegram_chat_id')
    .not('telegram_chat_id', 'is', null);

  const studentIds = (talabalar || [])
    .map((t: any) => t.telegram_chat_id)
    .filter(Boolean) as number[];

  // Ustoz chat_id lari
  const { data: ustozlar } = await supabase
    .from('ustoz')
    .select('telegram_chat_id')
    .eq('status', 'approved')
    .not('telegram_chat_id', 'is', null);

  const teacherIds = (ustozlar || [])
    .map((u: any) => u.telegram_chat_id)
    .filter(Boolean) as number[];

  // Parallel yuborish: o'quvchi boti + ustoz boti
  await Promise.allSettled([
    configs.student.token
      ? sendTelegramBroadcast(configs.student.token, studentIds, text, configs.student.siteUrl, configs.student.siteBtnText)
      : Promise.resolve(),
    configs.teacher.token
      ? sendTelegramBroadcast(configs.teacher.token, teacherIds, text, configs.teacher.siteUrl, configs.teacher.siteBtnText)
      : Promise.resolve(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST OMMAVIY QILINGANDA BOT XABARI
// ─────────────────────────────────────────────────────────────────────────────
export async function sendTestOmmaviyBotXabar(params: {
  testNomi: string;
  testKod: string;
  savollarSoni: number;
  vaqtDaqiqa: number;
  ustozIsmi: string;
  narx?: number;
}): Promise<void> {
  const { testNomi, testKod, savollarSoni, vaqtDaqiqa, ustozIsmi, narx } = params;

  const text =
    `🏆 <b>FANFASTER'DA YANGILIK!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `📚 Yangi <b>"${testNomi}"</b> testi joylashdi!\n\n` +
    `📊 <b>Test ma'lumotlari:</b>\n` +
    `   📝 Savollar: <b>${savollarSoni} ta</b>\n` +
    `   ⏱ Vaqt: <b>${vaqtDaqiqa} daqiqa</b>\n` +
    `   👨‍🏫 Tuzuvchi: <b>${ustozIsmi}</b>\n` +
    (narx && narx > 0 ? `   💰 Narx: <b>${narx.toLocaleString()} so'm</b>\n` : `   🆓 Bepul\n`) +
    `\n━━━━━━━━━━━━━━━━━━━\n` +
    `<b>📖 Qanday kirish mumkin?</b>\n` +
    `1️⃣ Saytga kiring\n` +
    `2️⃣ <b>"Mavjud Testlar"</b> bo'limiga o'ting\n` +
    `3️⃣ Ro'yxatdan <b>"${testNomi}"</b> testini toping\n` +
    `4️⃣ Test boshlangandan keyin yechishingiz mumkin!\n\n` +
    `🔑 Yoki ustoz sizga test kodini beradi va\n` +
    `   <b>"Sinovni Boshlash"</b> sahifasida kirita olasiz\n\n` +
    `👇 Hoziroq saytga kiring!`;

  const configs = await getBotConfigs();

  const [talabalarRes, ustozlarRes] = await Promise.all([
    supabase.from('talabalar').select('telegram_chat_id').not('telegram_chat_id', 'is', null),
    supabase.from('ustoz').select('telegram_chat_id').eq('status', 'approved').not('telegram_chat_id', 'is', null),
  ]);

  const studentIds = ((talabalarRes.data || []) as any[])
    .map((t) => t.telegram_chat_id)
    .filter(Boolean) as number[];

  const teacherIds = ((ustozlarRes.data || []) as any[])
    .map((u) => u.telegram_chat_id)
    .filter(Boolean) as number[];

  await Promise.allSettled([
    configs.student.token
      ? sendTelegramBroadcast(configs.student.token, studentIds, text, configs.student.siteUrl, configs.student.siteBtnText)
      : Promise.resolve(),
    configs.teacher.token
      ? sendTelegramBroadcast(configs.teacher.token, teacherIds, text, configs.teacher.siteUrl, configs.teacher.siteBtnText)
      : Promise.resolve(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// KAZUS (TOPLAM) OMMAVIY QILINGANDA BOT XABARI
// ─────────────────────────────────────────────────────────────────────────────
export async function sendKazusOmmaviyBotXabar(params: {
  mavzu: string;
  kod: string;
  kazuslarSoni: number;
  vaqtDaqiqa: number;
  ustozIsmi: string;
  narx?: number;
}): Promise<void> {
  const { mavzu, kod, kazuslarSoni, vaqtDaqiqa, ustozIsmi, narx } = params;

  const text =
    `⚖️ <b>FANFASTER'DA YANGILIK!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━\n\n` +
    `📋 Yangi <b>"${mavzu}"</b> huquqiy kazus to'plami joylashdi!\n\n` +
    `📊 <b>Kazus ma'lumotlari:</b>\n` +
    `   📄 Kazuslar: <b>${kazuslarSoni} ta</b>\n` +
    `   ⏱ Vaqt: <b>${vaqtDaqiqa} daqiqa</b>\n` +
    `   👨‍🏫 Tuzuvchi: <b>${ustozIsmi}</b>\n` +
    (narx && narx > 0 ? `   💰 Narx: <b>${narx.toLocaleString()} so'm</b>\n` : `   🆓 Bepul\n`) +
    `\n━━━━━━━━━━━━━━━━━━━\n` +
    `<b>📖 Qanday kirish mumkin?</b>\n` +
    `1️⃣ Saytga kiring\n` +
    `2️⃣ <b>"Mavjud Kazuslar"</b> bo'limiga o'ting\n` +
    `3️⃣ Ro'yxatdan <b>"${mavzu}"</b> toplamini toping\n` +
    `4️⃣ Ustoz START bergandan keyin yechishingiz mumkin!\n\n` +
    `🤖 <b>AI baholash tizimi</b> javoblaringizni avtomatik\n` +
    `   huquqiy me'yorlar asosida baholaydi\n\n` +
    `👇 Hoziroq saytga kiring!`;

  const configs = await getBotConfigs();

  const [talabalarRes, ustozlarRes] = await Promise.all([
    supabase.from('talabalar').select('telegram_chat_id').not('telegram_chat_id', 'is', null),
    supabase.from('ustoz').select('telegram_chat_id').eq('status', 'approved').not('telegram_chat_id', 'is', null),
  ]);

  const studentIds = ((talabalarRes.data || []) as any[])
    .map((t) => t.telegram_chat_id)
    .filter(Boolean) as number[];

  const teacherIds = ((ustozlarRes.data || []) as any[])
    .map((u) => u.telegram_chat_id)
    .filter(Boolean) as number[];

  await Promise.allSettled([
    configs.student.token
      ? sendTelegramBroadcast(configs.student.token, studentIds, text, configs.student.siteUrl, configs.student.siteBtnText)
      : Promise.resolve(),
    configs.teacher.token
      ? sendTelegramBroadcast(configs.teacher.token, teacherIds, text, configs.teacher.siteUrl, configs.teacher.siteBtnText)
      : Promise.resolve(),
  ]);
}
