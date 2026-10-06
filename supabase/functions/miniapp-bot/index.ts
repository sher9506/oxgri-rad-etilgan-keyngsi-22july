// miniapp-bot — Telegram Mini App bot webhook
// verify_jwt = false (config.toml'da aniq yozilgan)
// X-Telegram-Bot-Api-Secret-Token tekshiriladi
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

    // /start yoki istalgan xabar — salomlashuv + web_app tugma
    const message = body.message;
    if (message) {
      const chatId: number = message.chat.id;
      await sendMessage(cfg.token, chatId, cfg.welcomeText, {
        reply_markup: {
          inline_keyboard: [[
            { text: cfg.buttonText, web_app: { url: cfg.miniAppUrl } },
          ]],
        },
      });
    }

    return new Response('ok', { status: 200 });
  } catch (e: unknown) {
    console.error('[miniapp-bot] webhook xatosi:', e);
    return new Response('ok', { status: 200 });
  }
});
