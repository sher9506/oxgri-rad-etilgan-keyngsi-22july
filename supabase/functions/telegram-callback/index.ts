import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Callback query handler (kanal a'zoligini tekshirish tugmasi uchun)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function getBotToken(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_TOKEN')
    .maybeSingle();
  return data?.text_value || '';
}

async function getChannelId(): Promise<string> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'TELEGRAM_CHANNEL_ID')
    .maybeSingle();
  return data?.text_value || '';
}

async function sendMessage(token: string, chatId: number | string, text: string, options: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...options }),
  });
  return res.json();
}

async function answerCallback(token: string, callbackQueryId: string, text = '') {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
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
    const status = data.result?.status;
    return ['member', 'administrator', 'creator'].includes(status);
  } catch {
    return false;
  }
}

function createLoginId(ism: string, familiya: string): string {
  return `${ism.trim().toLowerCase()}_${familiya.trim().toLowerCase()}`
    .replace(/[^a-z0-9_]/g, '')
    .replace(/__+/g, '_')
    .slice(0, 30);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = await getBotToken();
    if (!token) return new Response('ok', { status: 200 });

    const body = await req.json();
    const callbackQuery = body.callback_query;
    if (!callbackQuery) return new Response('ok', { status: 200 });

    const chatId: number = callbackQuery.message?.chat?.id || callbackQuery.from?.id;
    const telegramId: number = callbackQuery.from?.id;
    const data: string = callbackQuery.data || '';
    const callbackQueryId: string = callbackQuery.id;

    if (data === 'check_membership') {
      const channelId = await getChannelId();
      const isMember = await checkChannelMembership(token, telegramId, channelId);

      if (isMember) {
        await answerCallback(token, callbackQueryId, '✅ Tasdiqlandi!');
        // Sessiyani yangilash
        const { data: session } = await supabaseAdmin
          .from('bot_sessions')
          .select('*')
          .eq('chat_id', chatId)
          .maybeSingle();

        if (session) {
          const autoLogin = createLoginId(session.ism || '', session.familiya || '');
          await supabaseAdmin
            .from('bot_sessions')
            .update({ state: 'waiting_login', updated_at: new Date().toISOString() })
            .eq('chat_id', chatId);

          await sendMessage(token, chatId,
            `✅ Kanal a'zoligingiz tasdiqlandi!\n\n` +
            `🔑 Endi sayt uchun <b>login</b> kiriting.\n` +
            `Tavsiya: <code>${autoLogin}</code>`
          );
        }
      } else {
        await answerCallback(token, callbackQueryId, "❌ Hali a'zo bo'lmagansiz!");
        const channelId2 = await getChannelId();
        await sendMessage(token, chatId,
          `❌ Siz hali kanalga a'zo bo'lmagansiz.\n\n` +
          `👉 Avval kanalga a'zo bo'ling: ${channelId2}\n\n` +
          `Keyin "✅ A'zolikni tekshirish" tugmasini bosing.`,
          {
            reply_markup: {
              inline_keyboard: [[{ text: "✅ A'zolikni tekshirish", callback_data: 'check_membership' }]]
            }
          }
        );
      }
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('Callback handler xatosi:', e);
    return new Response('ok', { status: 200 });
  }
});
