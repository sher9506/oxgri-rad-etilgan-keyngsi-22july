// force redeploy
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
    const { caseId, sessionId, messages, studentSide, isIntro, guestToken, studentName } = body as {
      caseId: string;
      sessionId?: string;
      messages: ChatMessage[];
      studentSide?: string;
      isIntro?: boolean;
      guestToken?: string;
      studentName?: string;
    };

    if (!caseId || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'caseId va messages majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: caseData, error: caseErr } = await supabaseAdmin
      .from('moot_court_cases')
      .select('sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol, max_exchanges, difficulty, allow_retry, is_public_demo')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Kazus topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch linked legal articles from qonun_moddalari (if any) ──
    const { data: linkedArticles } = await supabaseAdmin
      .from('moot_court_case_articles')
      .select('modda_id, qonun_moddalari(id, kodeks_nomi, modda_raqami, modda_matni)')
      .eq('case_id', caseId);

    const articles: { kodeks_nomi: string; modda_raqami: string; modda_matni: string }[] = [];
    if (linkedArticles) {
      for (const la of linkedArticles) {
        const m = la.qonun_moddalari as any;
        if (m && m.modda_matni) {
          articles.push({ kodeks_nomi: m.kodeks_nomi, modda_raqami: m.modda_raqami, modda_matni: m.modda_matni });
        }
      }
    }

    // ── Guest mode: enforce 2-exchange limit and public demo check ──
    const isGuest = !!guestToken;
    if (isGuest) {
      if (!caseData.is_public_demo) {
        return new Response(
          JSON.stringify({ error: 'Bu kazus mehmon rejimida mavjud emas. Tizimga kiring.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Retry enforcement (non-guest, non-intro) ──
    // If allow_retry is false and student already has a completed session for this case, block
    if (!isGuest && !isIntro && caseData.allow_retry === false && studentName) {
      const { data: existingSessions } = await supabaseAdmin
        .from('moot_court_sessions')
        .select('id, status')
        .eq('case_id', caseId)
        .eq('oquvchi_ismi', studentName)
        .eq('status', 'yakunlangan')
        .limit(1);

      if (existingSessions && existingSessions.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Siz bu kazusni allaqachon yechgansiz. Qayta yechish ruxsat berilmagan.', alreadyCompleted: true }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const aiRol = caseData.ai_rol || 'qarshi_tomon';
    const isSudya = aiRol === 'sudya';
    // ── Enforce max_exchanges 3-8 limit (server-side) ──
    const rawMaxExchanges = caseData.max_exchanges || 5;
    const maxExchanges = isGuest ? 2 : Math.max(3, Math.min(8, rawMaxExchanges));
    const difficulty = caseData.difficulty || 'orta';

    // Count user exchanges (talaba yuborgan xabarlar soni)
    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const isFinalExchange = !isIntro && userMessageCount >= maxExchanges;

    const tomonlarStr = Array.isArray(caseData.tomonlar) && caseData.tomonlar.length > 0
      ? caseData.tomonlar.join(', ')
      : 'tomon tanlash imkoniyati yo\'q';

    const studentSideStr = studentSide || (Array.isArray(caseData.tomonlar) && caseData.tomonlar.length > 0
      ? caseData.tomonlar[0]
      : '');

    // Difficulty-based personality instructions
    const difficultyInstructions: Record<string, string> = {
      yengil: `## Qiyinlik darajasi: YENGIL
Sen mehribon, sabrli sudya/advokatsan. Talabaga yordam beruvchi, yo'naltiruvchi savollar ber. Agar talaba adashsa, uni to'g'ri yo'nalishga muloyimlik bilan burib qo'y. Murakkab yoki qiynovchi savollardan saqlan. Talaba argument keltira olmasa, unga muloyim tarzda ip uchini bering — qaysi moddaga tayanishi kerakligini ishora qiling.`,
      orta: `## Qiyinlik darajasi: O'RTA
Sen professional, adolatli sudya/advokatsan. Standart, asosli savollar va e'tirozlar bildir, lekin haddan tashqari qattiqqo'l bo'lma. Talabaning argumentlarini mantiqiy bahola va asosli e'tirozlarni ilgari sur.`,
      qattiq: `## Qiyinlik darajasi: QATTIQ
Sen juda tajribali, qattiqqo'l va talabchan sudya/advokatsan. Talabaning har bir zaif argumentini aniqlab, qattiq e'tiroz bildir, qarama-qarshi dalillarni keskin ilgari sur, talabani chuqur o'ylashga majbur qil. Lekin hech qachon haqoratli yoki mensimaydigan bo'lma — faqat professional jihatdan talabchan bo'l.`,
    };

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

    // ── Build article text block for system prompt ──
    let articlesBlock = '';
    if (articles.length > 0) {
      articlesBlock = '\n\n## TASDIQLANGAN QONUN MODDALARI (faqat shularga tayaning):\n';
      for (const a of articles) {
        articlesBlock += `\n### ${a.kodeks_nomi}, ${a.modda_raqami}-modda:\n${a.modda_matni}\n`;
      }
      articlesBlock += '\n## QATIY QOIDA: Sen faqat yuqorida berilgan qonun moddalariga tayanib javob berishing kerak. Agar javob boshqa modda talab qilsa-yu, u senga berilmagan bo\'lsa, "Bu masala bo\'yicha menga aniq modda berilmagan, umumiy tamoyillar asosida fikr bildiraman" deb ayt — hech qachon mavjud bo\'lmagan modda raqamini o\'ylab topib aytma.';
    }

    let systemPrompt = `Siz FanFaster platformasining Moot Court (sud jarayoni simulyatsiyasi) funksiyasidagi AI yordamchisiz.

## Vaziyat (Kazus):
${caseData.tavsif}

## Tegishli qonun/moddalar:
${caseData.qonun_moddalar || 'Aniq ko\'rsatilmagan'}${articlesBlock}

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
7. Hech qachon xayoliy faktlar yoki qonun moddalari o'ylab topmang.

${difficultyInstructions[difficulty] || difficultyInstructions.orta}`;

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

    const { text: aiReply, provider } = await callAIWithFallback({
      systemPrompt,
      messages: messagesForAI,
      maxTokens: 1500,
      temperature: 0.6,
      functionName: 'moot-court-chat',
    });
    console.log(`[moot-court-chat] provider=${provider}`);

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
      JSON.stringify({ reply: aiReply, aiRol, sessionEnded: isFinalExchange, isGuest }),
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
// deploy trigger 1788610507
