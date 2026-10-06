// miniapp-bot — Telegram Mini App bot webhook
// verify_jwt = false (config.toml'da aniq yozilgan)
// X-Telegram-Bot-Api-Secret-Token tekshiriladi — v2 conflict check
// link_ token'lar bilan birlashtirish so'rovlarini qabul qiladi
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface MiniAppConfig {
  token: string;
  welcomeText: string;
  buttonText: string;
  miniAppUrl: string;
  webhookSecret: string;
}

async function loadConfig(): Promise<MiniAppConfig> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', [
      'MINIAPP_BOT_TOKEN',
      'MINIAPP_WELCOME_TEXT',
      'MINIAPP_BUTTON_TEXT',
      'MINIAPP_URL',
      'MINIAPP_WEBHOOK_SECRET',
    ]);

  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });

  return {
    token: map['MINIAPP_BOT_TOKEN'] || '',
    welcomeText: map['MINIAPP_WELCOME_TEXT'] ||
      "FanFaster botiga xush kelibsiz!\n\nPastdagi «Kirish» tugmasini bosing — kabinetingiz shu yerning o'zida, Telegram ichida ochiladi.",
    buttonText: map['MINIAPP_BUTTON_TEXT'] || 'Kirish',
    miniAppUrl: map['MINIAPP_URL'] || 'https://fanfaster.uz',
    webhookSecret: map['MINIAPP_WEBHOOK_SECRET'] || '',
  };
}

async function sendMessage(token: string, chatId: number | string, text: string, options: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...options }),
  });
  const json = await res.json();
  if (!json.ok) console.error('[miniapp-bot] sendMessage xato:', json.description);
  return json;
}

async function getChatInfo(token: string, chatId: number) {
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

async function handleLinkToken(
  chatId: number,
  telegramId: number,
  linkToken: string,
  cfg: MiniAppConfig
): Promise<void> {
  const payloadLen = linkToken.length;
  const tokenPrefix = linkToken.slice(0, Math.min(6, linkToken.length));
  console.log(`[miniapp-bot][link-token] /start link_ keldi: payload_uzunlik=${payloadLen}, prefix=${tokenPrefix}…`);

  // Token hash hisoblash
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(linkToken));
  const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Avval hash bo'yicha qidiramiz (yangi tokenlar)
  let { data: linkRow } = await supabaseAdmin
    .from('telegram_link_tokens')
    .select('talaba_id, platform, expires_at, used_at, start_chat_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  // Eski tokenlar (token ustunida saqlangan) — backward compat
  if (!linkRow) {
    const { data: legacyRow } = await supabaseAdmin
      .from('telegram_link_tokens')
      .select('talaba_id, platform, expires_at, used_at, start_chat_id')
      .eq('token', linkToken)
      .maybeSingle();
    linkRow = legacyRow;
  }

  if (!linkRow) {
    console.log(`[miniapp-bot][link-token] token topilmadi: prefix=${tokenPrefix}…`);
    await sendMessage(cfg.token, chatId,
      "❌ <b>Havola noto'g'ri.</b>\n\nSaytdan yangi havola oling."
    );
    return;
  }

  if (linkRow.used_at) {
    console.log(`[miniapp-bot][link-token] token allaqachon ishlatilgan: prefix=${tokenPrefix}…`);
    await sendMessage(cfg.token, chatId,
      "⚠️ <b>Bu havola allaqachon ishlatilgan.</b>\n\nSaytdan yangi havola oling."
    );
    return;
  }

  if (new Date(linkRow.expires_at) < new Date()) {
    console.log(`[miniapp-bot][link-token] token muddati o'tgan: prefix=${tokenPrefix}…`);
    await sendMessage(cfg.token, chatId,
      "⏰ <b>Havola eskirgan.</b>\n\nSaytdan yangi havola oling (15 daqiqa amal qiladi)."
    );
    return;
  }

  // START chat_id ni token qatoriga yozish
  await supabaseAdmin
    .from('telegram_link_tokens')
    .update({ start_chat_id: chatId })
    .eq('token_hash', tokenHash)
    .is('start_chat_id', null);

  console.log(`[miniapp-bot][link-token] token topildi, talaba_id=${linkRow.talaba_id}`);

  // Telegram chat_id boshqa talabaga bog'langanmi?
  const { data: existingTalaba } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, google_user_id, created_at, merged_into')
    .eq('telegram_chat_id', String(chatId))
    .neq('id', linkRow.talaba_id)
    .is('merged_into', null)
    .maybeSingle();

  if (existingTalaba) {
    console.log(`[miniapp-bot][link-token] mojaro: telegram chat_id=${chatId} boshqa talabaga bog'langan. Joriy=${linkRow.talaba_id}, mavjud=${existingTalaba.id}`);

    // ── QAT'IY BIR-BIR TEKSHIRUVI ──
    // Mavjud talaba boshqa Google bilan ulanganmi?
    if (existingTalaba.google_user_id) {
      // Joriy talaba ham Google bilan ulanganmi va boshqa Google'mi?
      const { data: joriyTalaba } = await supabaseAdmin
        .from('talabalar')
        .select('id, google_user_id, google_email_masked')
        .eq('id', linkRow.talaba_id)
        .maybeSingle();

      if (joriyTalaba?.google_user_id && joriyTalaba.google_user_id !== existingTalaba.google_user_id) {
        // Ikkala profil ham o'z Google'lariga ulangan — RAD ETISH
        await supabaseAdmin
          .from('telegram_link_tokens')
          .update({ used_at: new Date().toISOString(), status: 'rejected', conflict_talaba_id: existingTalaba.id })
          .eq('token_hash', tokenHash);

        await sendMessage(cfg.token, chatId,
          '❌ <b>Bu Telegram boshqa Google akkauntga ulangan.</b>\n\n' +
          'Bitta Telegram faqat bitta akkauntga ulanadi.\n\n' +
          'Saytdan yangi havola oling.'
        );
        return;
      }
    }

    // Mojaro ma'lumotini token qatoriga yozish
    await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ conflict_talaba_id: existingTalaba.id })
      .eq('token_hash', tokenHash);

    // Mini App orqali tasdiqlash — web_app tugma yuboramiz
    const confirmUrl = `${cfg.miniAppUrl}/link-confirm?token=${tokenHash}`;

    await sendMessage(cfg.token, chatId,
      "⚠️ <b>Bu Telegram akkaunt boshqa akkauntga bog'langan.</b>\n\n" +
      'Tasdiqlash uchun quyidagi tugmani bosing:',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔓 Tasdiqlash uchun ochish', web_app: { url: confirmUrl } },
          ]],
        },
      }
    );

    return;
  }

  // Telegram username va ism olish
  let telegramUsername = '';
  let tgFirstName: string | null = null;
  try {
    const userInfo = await getChatInfo(cfg.token, chatId);
    if (userInfo?.username) telegramUsername = '@' + userInfo.username;
    if (userInfo?.first_name) tgFirstName = userInfo.first_name;
  } catch {}

  // Talabani topish
  const { data: talaba } = await supabaseAdmin
    .from('talabalar')
    .select('id, ism, familiya, google_user_id, telegram_chat_id, birlashtirish_bonus_berildi')
    .eq('id', linkRow.talaba_id)
    .maybeSingle();

  if (!talaba) {
    await sendMessage(cfg.token, chatId,
      "❌ <b>Talaba topilmadi.</b>\n\nSaytda qaytadan urinib ko'ring."
    );
    return;
  }

  // ── QAT'IY BIR-BIR: joriy talabada allaqachon boshqa Telegram bormi? ──
  if (talaba.telegram_chat_id && String(talaba.telegram_chat_id) !== String(chatId)) {
    await supabaseAdmin
      .from('telegram_link_tokens')
      .update({ used_at: new Date().toISOString(), status: 'rejected' })
      .eq('token_hash', tokenHash);

    await sendMessage(cfg.token, chatId,
      '❌ <b>Bu akkauntda boshqa Telegram allaqachon ulangan.</b>\n\n' +
      'Bitta akkaunt faqat bitta Telegram\'ga ulanadi.'
    );
    return;
  }

  // Telegramni bog'lash
  const { error: updateErr } = await supabaseAdmin
    .from('talabalar')
    .update({
      telegram_chat_id: String(chatId),
      telegram_id: telegramId,
      telegram_username: telegramUsername || null,
      telegram_ism: tgFirstName || null,
    })
    .eq('id', talaba.id);

  if (updateErr) {
    console.error('[miniapp-bot][link-token] talaba update xato:', updateErr);
    await sendMessage(cfg.token, chatId,
      "❌ <b>Bog'lashda xatolik.</b>\n\nQaytadan urinib ko'ring."
    );
    return;
  }

  // Tokenni yopish
  await supabaseAdmin
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString(), status: 'confirmed' })
    .eq('token_hash', tokenHash);

  // Bonus berish
  const birlashtirilgan = talaba.google_user_id !== null;
  let bonusBerildi = false;
  if (birlashtirilgan && !talaba.birlashtirish_bonus_berildi) {
    const { data: bonusResult } = await supabaseAdmin
      .rpc('berilish_birlashtirish_bonusi', { p_talaba_id: talaba.id });
    bonusBerildi = !!bonusResult;
  }

  // Audit log
  await supabaseAdmin
    .from('akkaunt_birlashtirish_log')
    .insert({ asosiy_id: talaba.id, sabab: 'telegram_link_miniapp_bot' })
    .then(() => {}, () => {});

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

    const callbackUrl = `${cfg.miniAppUrl}/telegram-callback?token=${loginToken}`;
    msg += `\nQuyidagi tugma bilan profilga qaytishingiz mumkin:`;
    replyMarkup.reply_markup = {
      inline_keyboard: [[{ text: '🌐 Profilga qaytish', url: callbackUrl }]],
    };
  } else {
    msg += `\nBrauzerga qaytib, profil sahifasini yangilang.`;
  }

  await sendMessage(cfg.token, chatId, msg, replyMarkup);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const cfg = await loadConfig();

    if (!cfg.token) {
      console.error('[miniapp-bot] MINIAPP_BOT_TOKEN topilmadi');
      return new Response('ok', { status: 200 });
    }

    // Webhook secret tekshirish
    if (cfg.webhookSecret) {
      const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secretHeader !== cfg.webhookSecret) {
        console.error('[miniapp-bot] webhook secret mos emas');
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const body = await req.json();
    console.log('[miniapp-bot] Update:', JSON.stringify(body).slice(0, 300));

    // Contact qabul qilish (requestContact dan kelgan)
    if (body.message?.contact) {
      const contact = body.message.contact;
      const fromId = body.message.from?.id;

      // Faqat o'z kontaktini yuborgan bo'lsa saqlaymiz
      if (contact.user_id && fromId && contact.user_id === fromId) {
        const phone = contact.phone_number.replace(/\D/g, '');
        if (phone) {
          await supabaseAdmin
            .from('miniapp_contacts')
            .upsert(
              { telegram_id: contact.user_id, phone },
              { onConflict: 'telegram_id' }
            );
          console.log(`[miniapp-bot] contact saqlandi: tg_id=${contact.user_id}, phone=${phone}`);
        }
      } else {
        console.log('[miniapp-bot] contact rad etildi: user_id mos emas');
      }

      return new Response('ok', { status: 200 });
    }

    const message = body.message;
    if (!message) return new Response('ok', { status: 200 });

    const chatId: number = message.chat.id;
    const telegramId: number = message.from?.id || chatId;
    const text: string = message.text || '';

    // ── /start link_ token: birlashtirish so'rovi ──
    if (text.startsWith('/start')) {
      const parts = text.trim().split(' ');
      const payload = parts[1] || '';

      if (payload.startsWith('link_')) {
        await handleLinkToken(chatId, telegramId, payload, cfg);
        return new Response('ok', { status: 200 });
      }
    }

    // ── /start yoki istalgan xabar — salomlashuv + web_app tugma ──
    await sendMessage(cfg.token, chatId, cfg.welcomeText, {
      reply_markup: {
        inline_keyboard: [[
          { text: cfg.buttonText, web_app: { url: cfg.miniAppUrl } },
        ]],
      },
    });

    return new Response('ok', { status: 200 });
  } catch (e: unknown) {
    console.error('[miniapp-bot] webhook xatosi:', e);
    return new Response('ok', { status: 200 });
  }
});
