import { supabase } from './supabase';

export interface Ustoz {
  id: string;
  username: string;
  full_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  phone?: string;
  telegram_username?: string;
  // face_descriptor va face_image saqlanib qoladi DB da, lekin login uchun ishlatilmaydi
}

// Password hashing (simple implementation)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── OTP YUBORISH (bot orqali) ─────────────────────────────────────────────
// Telefon raqam orqali botga OTP yuboradi
export async function sendUstozOtp(phone: string): Promise<{ success: boolean; message: string }> {
  // Telefon raqamni normallashtirish
  const cleanPhone = phone.replace(/\s/g, '').replace(/[^+\d]/g, '');

  // Telefon raqam band emasligini tekshirish (allaqachon tasdiqlangan ustoz)
  const { data: existing } = await supabase
    .from('ustoz')
    .select('id, status, full_name')
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (existing?.status === 'approved') {
    throw new Error('Bu telefon raqam bilan ustoz allaqachon ro\'yxatdan o\'tgan va tasdiqlangan');
  }

  // 6 raqamli OTP yaratish
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 daqiqa

  // OTP ni DB ga saqlash (telefon bo'yicha pending ustoz bo'lsa yangilash, bo'lmasa yangi yozuv)
  if (existing) {
    await supabase
      .from('ustoz')
      .update({ otp_kod: otp, otp_expires: expires })
      .eq('phone', cleanPhone);
  } else {
    // Vaqtinchalik yozuv — to'liq ma'lumot keyinchalik to'ldiriladi
    const { error } = await supabase
      .from('ustoz')
      .insert({
        username: `temp_${cleanPhone.replace(/[^0-9]/g, '')}`,
        password_hash: '',
        full_name: '',
        status: 'pending',
        phone: cleanPhone,
        otp_kod: otp,
        otp_expires: expires,
      });
    if (error && !error.message.includes('duplicate')) throw error;

    // Agar duplicate bo'lsa, yangilash
    if (error?.message.includes('duplicate')) {
      await supabase
        .from('ustoz')
        .update({ otp_kod: otp, otp_expires: expires })
        .eq('username', `temp_${cleanPhone.replace(/[^0-9]/g, '')}`);
    }
  }

  // Bot orqali OTP yuborish
  const { data: tokenData } = await supabase
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_TOKEN')
    .maybeSingle();

  const botToken = tokenData?.text_value;
  if (!botToken) {
    // Bot ulangan bo'lmasa, test rejimi (konsolga chiqarish)
    console.log(`[TEST MODE] OTP: ${otp} → ${cleanPhone}`);
    return { success: true, message: 'OTP yuborildi (test rejimi)' };
  }

  // Telegram chat_id ni topish (bot_sessions jadvalidan telefon raqam bo'yicha)
  const { data: botSession } = await supabase
    .from('bot_sessions')
    .select('chat_id')
    .eq('phone', cleanPhone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!botSession?.chat_id) {
    throw new Error(
      'Bot orqali telefon raqam topilmadi. Avval Telegram botga /start yuboring va telefon raqamingizni ulashing.'
    );
  }

  // Bot orqali OTP yuborish
  const { data: msgResult, error: msgErr } = await supabase.functions.invoke('telegram-api', {
    body: {
      token: botToken,
      method: 'sendMessage',
      body: {
        chat_id: botSession.chat_id,
        parse_mode: 'HTML',
        text:
          `🔐 <b>Ustoz ro'yxatdan o'tish kodi</b>\n\n` +
          `Sizning bir martalik kodni:\n\n` +
          `<code>${otp}</code>\n\n` +
          `⏱ Kod 10 daqiqa amal qiladi.\n` +
          `❗️ Kodni hech kimga bermang!`,
      },
    },
  });
  if (msgErr || !msgResult?.ok) {
    throw new Error('Bot xabari yuborishda xatolik. Botga /start yuborgan bo\'lishingiz kerak.');
  }

  return { success: true, message: 'OTP Telegram botga yuborildi' };
}

// ── OTP TEKSHIRISH + RO'YXATDAN O'TISH ────────────────────────────────────
export async function registerUstozWithOtp(params: {
  phone: string;
  otp: string;
  fullName: string;
  password: string;
}): Promise<void> {
  const cleanPhone = params.phone.replace(/\s/g, '').replace(/[^+\d]/g, '');

  // OTP ni tekshirish
  const { data: ustoz } = await supabase
    .from('ustoz')
    .select('id, otp_kod, otp_expires')
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (!ustoz) {
    throw new Error('Telefon raqam topilmadi. OTP yuborish bosqichini qayta bajaring.');
  }

  if (ustoz.otp_kod !== params.otp) {
    throw new Error('Kod noto\'g\'ri. Qayta tekshiring.');
  }

  if (new Date(ustoz.otp_expires) < new Date()) {
    throw new Error('Kod muddati tugagan. Yangi kod so\'rang.');
  }

  if (params.password.length < 6) {
    throw new Error('Parol kamida 6 belgidan iborat bo\'lishi kerak.');
  }

  // Full name parse
  const nameParts = params.fullName.trim().split(/\s+/);
  if (nameParts.length < 2) {
    throw new Error('Ism va familiyani to\'liq kiriting (masalan: Abdullayev Jasur)');
  }

  // Username = telefon raqam (unikal)
  const username = cleanPhone.replace(/[^0-9]/g, '');

  // Telegram username ni bot_sessions dan olish
  let telegramUsername = '';
  const { data: botSession } = await supabase
    .from('bot_sessions')
    .select('chat_id')
    .eq('phone', cleanPhone)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (botSession?.chat_id) {
    // Bot API orqali username olish
    const { data: tokenData } = await supabase
      .from('settings')
      .select('text_value')
      .eq('key', 'TELEGRAM_TOKEN')
      .maybeSingle();

    const botToken = tokenData?.text_value;
    if (botToken) {
      const { data: chatData, error: chatErr } = await supabase.functions.invoke('telegram-api', {
        body: {
          token: botToken,
          method: 'getChat',
          body: { chat_id: botSession.chat_id },
        },
      });
      if (!chatErr && chatData?.ok && chatData.result?.username) {
        telegramUsername = '@' + chatData.result.username;
      }
    }
  }

  const passwordHash = await hashPassword(params.password);

  // Ustozni yangilash
  const { error } = await supabase
    .from('ustoz')
    .update({
      username,
      password_hash: passwordHash,
      full_name: params.fullName.trim(),
      status: 'pending',
      phone: cleanPhone,
      telegram_username: telegramUsername || null,
      otp_kod: null,
      otp_expires: null,
    })
    .eq('id', ustoz.id);

  if (error) throw error;
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
export async function loginUstoz(phone: string, password: string): Promise<Ustoz> {
  const cleanPhone = phone.replace(/\s/g, '').replace(/[^+\d]/g, '');
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('ustoz')
    .select('*')
    .eq('phone', cleanPhone)
    .eq('password_hash', passwordHash)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Telefon raqam yoki parol noto\'g\'ri');
  }

  const ustoz = data as Ustoz;

  if (ustoz.status === 'pending') {
    throw new Error('Hisobingiz hali tasdiqlanmagan. Admin tasdiqlashini kuting.');
  }

  if (ustoz.status === 'rejected') {
    throw new Error('Hisobingiz rad etilgan. Admin bilan bog\'laning.');
  }

  return ustoz;
}

// ── ADMIN FUNKSIYALAR ──────────────────────────────────────────────────────
export async function approveUstoz(ustoz_id: string, status: 'approved' | 'rejected') {
  const { error } = await supabase
    .from('ustoz')
    .update({ status })
    .eq('id', ustoz_id);

  if (error) throw error;
}

export async function deleteUstoz(ustoz_id: string) {
  const { error } = await supabase
    .from('ustoz')
    .delete()
    .eq('id', ustoz_id);

  if (error) throw error;
}

// ── ESKI FUNKSIYALAR (backward compatibility) ─────────────────────────────
// Bu funksiya eski kodlarda ishlatilishi mumkin — saqlangan
export async function registerUstoz(username: string, password: string, fullName: string) {
  const { data: existing } = await supabase
    .from('ustoz')
    .select('id')
    .eq('username', username)
    .single();

  if (existing) {
    throw new Error('Bu username band');
  }

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('ustoz')
    .insert({
      username,
      password_hash: passwordHash,
      full_name: fullName,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data as Ustoz;
}
