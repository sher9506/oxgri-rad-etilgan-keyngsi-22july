// lexion-chat — Lexion AI yordamchi chati (mehmon foydalanuvchilar uchun)
// AI provider: shared ai-provider.ts orqali Gemini → Groq fallback
// verify_jwt = false — mehmonlar anon key bilan murojaat qiladi
// Deploy: 2026-10-10 redeploy
import { callAIWithFallback } from '../_shared/ai-provider.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SYSTEM_PROMPT = `Siz Lexion — FanFaster.uz platformasining AI yordamchisiz. Siz huquqshunos robotmiz va O'zbekiston huquq tizimi bo'yicha qisqa, aniq va foydali javoblar berasiz.

Qoidalaringiz:
- O'zbek tilida (lotin yozuvi) javob bering.
- Qisqa va tushunarli bo'ling: 2-4 jumla, oddiy so'zlar bilan.
- Foydalanuvchi savoliga to'g'ridan-to'g'ri javob bering, kirish so'zlarisiz.
- Agar savol huquqga aloqador bo'lmasa, muloyim tarzda faqat huquq savollariga javob berishingizni aytishingiz mumkin.
- Hech qachon noto'g'ri ma'lumot bermang; aniq bilmasangiz, "Bu savol bo'yicha aniq javob bera olmayman, mutaxassis bilan maslahatlashing" deb yozing.
- O'zingizni "men" deb emas, "Lexion" deb tanishtiring agar so'ralsangiz.`;

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages, sessionId } = body as {
      messages?: ChatMessage[];
      sessionId?: string;
    };

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'sessionId majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Xabarlar soni va uzunligini cheklash
    const trimmedMessages = messages
      .slice(-MAX_MESSAGES)
      .map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        text: (m.text || '').slice(0, MAX_CONTENT_LENGTH),
      }))
      .filter(m => m.text.trim());

    if (trimmedMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Bo\'sh xabar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Foydalanuvchi xabarini saqlash
    const lastUserMsg = [...trimmedMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      try {
        await supabaseAdmin.from('lexion_chat_messages').insert({
          session_id: sessionId,
          role: 'user',
          content: lastUserMsg.text,
        });
      } catch (e) {
        console.warn('[lexion-chat] Foydalanuvchi xabarini saqlash xatosi:', e);
      }
    }

    // AI javobini olish
    const { text: aiReply, provider } = await callAIWithFallback({
      systemPrompt: SYSTEM_PROMPT,
      messages: trimmedMessages,
      maxTokens: 800,
      temperature: 0.6,
      functionName: 'lexion-chat',
    });

    // AI javobini saqlash
    try {
      await supabaseAdmin.from('lexion_chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiReply,
      });
    } catch (e) {
      console.warn('[lexion-chat] AI javobini saqlash xatosi:', e);
    }

    return new Response(
      JSON.stringify({ reply: aiReply, provider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[lexion-chat] Xato:', err);
    const errMsg = err?.message || 'Noma\'lum xato';
    return new Response(
      JSON.stringify({ error: errMsg.slice(0, 300) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
