import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

async function loadAiConfig(): Promise<{ apiUrl: string; apiKey: string; model: string }> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', ['AI_MENTOR_API_URL', 'AI_MENTOR_API_KEY', 'AI_MENTOR_MODEL']);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });
  return {
    apiUrl: map['AI_MENTOR_API_URL'] || '',
    apiKey: map['AI_MENTOR_API_KEY'] || '',
    model: map['AI_MENTOR_MODEL'] || 'gemini-3-flash-preview',
  };
}

async function callGemini(
  apiUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<string> {
  const modelPath = model.replace(/^google\//, '');
  const url = `${apiUrl}/${modelPath}:generateContent?key=${apiKey}`;

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 1500,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const txt = await res.text();
  if (!res.ok) {
    console.error('[moot-court-chat] Gemini xato:', res.status, txt.slice(0, 300));
    throw new Error(`Gemini API [${res.status}]`);
  }

  const data = JSON.parse(txt);
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Gemini bo\'sh javob qaytardi');
  return reply;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { caseId, sessionId, messages, studentSide, isIntro } = body as {
      caseId: string;
      sessionId?: string;
      messages: ChatMessage[];
      studentSide?: string;
      isIntro?: boolean;
    };

    if (!caseId || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'caseId va messages majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { apiUrl, apiKey, model } = await loadAiConfig();
    if (!apiUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI sozlanmagan. Admin bilan bog\'laning.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: caseData, error: caseErr } = await supabaseAdmin
      .from('moot_court_cases')
      .select('sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol, max_exchanges')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Kazus topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiRol = caseData.ai_rol || 'qarshi_tomon';
    const isSudya = aiRol === 'sudya';
    const maxExchanges = caseData.max_exchanges || 5;

    // Count user exchanges (talaba yuborgan xabarlar soni)
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const isFinalExchange = !isIntro && userMessageCount >= maxExchanges;

    const tomonlarStr = Array.isArray(caseData.tomonlar) && caseData.tomonlar.length > 0
      ? caseData.tomonlar.join(', ')
      : 'tomon tanlash imkoniyati yo\'q';

    const studentSideStr = studentSide || (Array.isArray(caseData.tomonlar) && caseData.tomonlar.length > 0
      ? caseData.tomonlar[0]
      : '');

    let roleInstruction: string;
    if (isSudya) {
      roleInstruction = `Siz sudya rolini o'ynayapsiz. Siz mustaqil, xolis va adolatli sudya sifatida harakat qiling.
Siz savollar bering, dalillarni baholang, qonun normalarini talqin qiling va oxirida qaror chiqaring.
O'zingizning fikrlaringizni aniq, tushunarli va professional tarzda ifoda eting.`;
    } else {
      const oppositeSide = studentSideStr
        ? (caseData.tomonlar && caseData.tomonlar.length > 1
            ? caseData.tomonlar.find((t: string) => t !== studentSideStr) || caseData.tomonlar[1] || 'qarshi tomon'
            : 'qarshi tomon')
        : 'qarshi tomon';
      roleInstruction = `Siz ${oppositeSide} tomonini himoya qiluvchi advokat/vakil rolini o'ynayapsiz.
Talaba ${studentSideStr || 'bir tomon'}ni himoya qilmoqda. Siz o'z tomoningizning pozitsiyasini himoya qiling,
qarshi dalillarni keltiring, talabaning argumentlariga e'tiroz bildiring. Professional va mantiqiy gapiring.`;
    }

    let systemPrompt = `Siz FanFaster platformasining Moot Court (sud jarayoni simulyatsiyasi) funksiyasidagi AI yordamchisiz.

## Vaziyat (Kazus):
${caseData.tavsif}

## Tegishli qonun/moddalar:
${caseData.qonun_moddalar || 'Aniq ko\'rsatilmagan'}

## Mavjud tomonlar:
${tomonlarStr}

## Talabaning tanlagan tomoni:
${studentSideStr || 'Tanlanmagan'}

## Sizning rolgingiz:
${roleInstruction}

## Qoidalar:
1. Faqat berilgan vaziyat va qonun kontekstida javob bering.
2. Gapirganingizda aniq modda nomiga tayaning.
3. Agar aniq bilmasangiz, taxmin qilib gapirma — "bu masala bo'yicha aniq ko'rsatma berilmagan" deb ayt.
4. O'zbek tilida, professional huquqiy uslubda yozing.
5. Javoblaringiz qisqa va mazmunli bo'lsin (2-4 paragrafdan oshmasin).
6. Bu o'quv jarayoni — talabani o'rgating, uning argumentlarini qiyoshtiring va baholang.
7. Hech qachon xayoliy faktlar yoki qonun moddalari o'ylab topmang.`;

    // If this is the final exchange, modify the prompt to ask for a closing speech
    if (isFinalExchange) {
      systemPrompt += `

## MUHIM — YAKUNIY NUTQ:
Bu suhbatning oxirgi almashinuvi. Talaba ${maxExchanges} ta argument yubordi. Endi siz YAKUNIY NUTQ so'zingizni ayting:
- O'z pozitsiyangizni yakunlang, barcha asosiy dalillarni qisqacha takrorlang.
- Talabaning argumentlariga umumiy baho bering (qaysi biri kuchli, qaysi biri kuchsiz edi).
- "Munozara yakunlandi" deb aniq yozing.
- Yangi savol bermang — bu oxirgi javob.`;
    }

    // For intro: send a synthetic first message asking AI to introduce itself
    const messagesForAI: ChatMessage[] = isIntro && (!messages || messages.length === 0)
      ? [{ role: 'user', text: `Iltimos, o'zingizni tanishtiring va sud jarayonini boshlang. Birinchi savolni yoki ochish nutqini bering.` }]
      : messages;

    const aiReply = await callGemini(apiUrl, apiKey, model, systemPrompt, messagesForAI);

    // Save updated messages to session
    if (sessionId) {
      const allMessages = isIntro && (!messages || messages.length === 0)
        ? [{ role: 'assistant', text: aiReply, timestamp: Date.now() }]
        : [...messages, { role: 'assistant', text: aiReply, timestamp: Date.now() }];

      const updatePayload: Record<string, any> = {
        messages: allMessages,
        updated_at: new Date().toISOString(),
      };

      // Auto-end session if final exchange
      if (isFinalExchange) {
        updatePayload.status = 'yakunlangan';
      }

      await supabaseAdmin
        .from('moot_court_sessions')
        .update(updatePayload)
        .eq('id', sessionId);
    }

    return new Response(
      JSON.stringify({ reply: aiReply, aiRol, sessionEnded: isFinalExchange }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[moot-court-chat] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 150)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
