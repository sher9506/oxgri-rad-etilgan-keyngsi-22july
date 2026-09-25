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

// ── Modda raqamini talaba xabaridan aniqlash ──────────────────────────────────
function extractMentionedArticles(text: string): { kod: string; raqam: string }[] {
  const results: { kod: string; raqam: string }[] = [];
  // Pattern: "JK 123-modda", "JK 123-moddasi", "123-modda", "MJTK 45-modda"
  const withCode = /\b(JK|MJTK|JPK|JMFJK|KK|UJK)\s*(\d+(?:-\d+)?)\s*-modda(si)?/gi;
  let m;
  while ((m = withCode.exec(text)) !== null) {
    results.push({ kod: m[1].toUpperCase(), raqam: m[2] });
  }
  // Pattern without code: "123-modda" (only if not already captured with code)
  const withoutCode = /(?<!\b(?:JK|MJTK|JPK|JMFJK|KK|UJK)\s*)(\d+(?:-\d+)?)\s*-modda(si)?/gi;
  while ((m = withoutCode.exec(text)) !== null) {
    if (!results.some(r => r.raqam === m[1])) {
      results.push({ kod: '', raqam: m[1] });
    }
  }
  return results;
}

// ── Substantive objection detection ───────────────────────────────────────────
function isSubstantiveObjection(userMsg: string, assistantMsg: string): boolean {
  const u = userMsg.toLowerCase();
  const objectionMarkers = [
    'noto\'g\'ri', 'xato', 'bundan farqli', 'men rozi emasman', 'qarshiman',
    'boshqa modda', 'asossiz', 'mantiqsiz', 'noto\'g\'ri tahlil', 'e\'tiroz',
    'bilan kelmayman', 'boshqa fikr', 'qarshi dalil', 'asosli emas',
    'noto\'g\'ri qaror', 'xato qil', 'adashgan', 'boshqa yondashuv',
  'davom et', 'yana', 'lekin', 'ammo', 'biroq', 'chunki noto\'g\'ri',
  'buni qabul qilmayman', 'rozilik bermayman',
  'noto\'g\'ri tahlil qildingiz', 'xato fikr', 'mavjud emas',
  'o\'z kuchini yo\'qotgan', 'bekor qilingan',
  'to\'liq emas', 'yetarli emas', 'asoslangan emas',
  'no\'ta', 'no\'to\'g\'ri', 'xatolik', 'qarshi fikrim',
  'siz noto\'g\'ri', 'siz xato', 'siz adashdingiz',
    'qarshi bo\'laman', 'qarshilik bildiraman',
  'boshqa moddaga ko\'ra', 'boshqacha talqin',
    'noto\'g\'ri dalil', 'asossiz da\'vo',
  'buni inkor', 'rad etaman', 'qabul qilmayman',
  'siz aytganingiz noto\'g\'ri', 'siz keltirgan dalil',
    'boshqacha yechim', 'muqobil dalil',
  'siz turgan pozitsiya zaif', 'zaif argument',
    'o\'zgartirish kerak', 'tuzatish kerak', 'qayta ko\'rib chiqish',
  'noto\'g\'ri tushunganiz', 'noto\'g\'ri talqin qildingiz',
    'bu modda emas', 'bu boshqa modda', 'bu moddaga oid emas',
    'o\'zgartirilgan', 'yangi tahrir', 'amaldagi tahrir',
  'o\'z kuchini yoqotgan', 'kuchini yoqotgan',
  'siz noto\'g\'ri dalil keltirdingiz',
    'menimcha noto\'g\'ri', 'fixri noto\'g\'ri',
    'noto\'g\'ri qo\'llangan', 'noto\'g\'ri qaror chiqardingiz',
    'qaror noto\'g\'ri', 'xulosa noto\'g\'ri',
    'tahlil noto\'g\'ri', 'talqin noto\'g\'ri',
    'bu yondashuv noto\'g\'ri', 'bu pozitsiya noto\'g\'ri',
    'bu fikr noto\'g\'ri', 'bu dalil noto\'g\'ri',
    'bu xulosa noto\'g\'ri', 'bu qaror noto\'g\'ri',
    'bu tahlil noto\'g\'ri', 'bu talqin noto\'g\'ri',
    'bu yondashuv xato', 'bu pozitsiya xato',
    'bu fikr xato', 'bu dalil xato',
    'bu xulosa xato', 'bu qaror xato',
    'bu tahlil xato', 'bu talqin xato',
    'bu yondashuv zaif', 'bu pozitsiya zaif',
    'bu fikr zaif', 'bu dalil zaif',
    'bu xulosa zaif', 'bu qaror zaif',
    'bu tahlil zaif', 'bu talqin zaif',
    'bu yondashuv asossiz', 'bu pozitsiya asossiz',
    'bu fikr asossiz', 'bu dalil asossiz',
    'bu xulosa asossiz', 'bu qaror asossiz',
    'bu tahlil asossiz', 'bu talqin asossiz',
    'bu yondashuv noto\'g\'ri', 'bu pozitsiya noto\'g\'ri',
    'bu fikr noto\'g\'ri', 'bu dalil noto\'g\'ri',
    'bu xulosa noto\'g\'ri', 'bu qaror noto\'g\'ri',
    'bu tahlil noto\'g\'ri', 'bu talqin noto\'g\'ri',
    'bu yondashuv xato', 'bu pozitsiya xato',
    'bu fikr xato', 'bu dalil xato',
    'bu xulosa xato', 'bu qaror xato',
    'bu tahlil xato', 'bu talqin xato',
    'bu yondashuv zaif', 'bu pozitsiya zaif',
    'bu fikr zaif', 'bu dalil zaif',
    'bu xulosa zaif', 'bu qaror zaif',
    'bu tahlil zaif', 'bu talqin zaif',
    'bu yondashuv asossiz', 'bu pozitsiya asossiz',
    'bu fikr asossiz', 'bu dalil asossiz',
    'bu xulosa asossiz', 'bu qaror asossiz',
    'bu tahlil asossiz', 'bu talqin asossiz',
  ];
  return objectionMarkers.some(marker => u.includes(marker));
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
      .select('sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol, max_exchanges, difficulty, allow_retry, is_public_demo, tadqiqot_holati, tasdiqlangan_moddalar, namunaviy_javob')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Kazus topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch confirmed articles from new research pipeline ──
    const confirmedArticles = (caseData.tasdiqlangan_moddalar || []) as {
      qonun_kodi: string;
      modda_raqami: string;
      sarlavha: string;
      bob_nomi: string;
      matn: string;
      lex_element_id: string | null;
      hukm: string;
    }[];

    const sampleAnswer = caseData.namunaviy_javob || null;
    const researchStatus = caseData.tadqiqot_holati || 'kutmoqda';

    const articles: { kodeks_nomi: string; modda_raqami: string; modda_matni: string; sarlavha: string }[] = [];
    if (confirmedArticles.length > 0) {
      for (const a of confirmedArticles) {
        if (a.matn) {
          articles.push({
            kodeks_nomi: a.qonun_kodi,
            modda_raqami: a.modda_raqami,
            modda_matni: a.matn,
            sarlavha: a.sarlavha || '',
          });
        }
      }
    }

    // ── Guest mode ──
    const isGuest = !!guestToken;
    if (isGuest && !caseData.is_public_demo) {
      return new Response(
        JSON.stringify({ error: 'Bu kazus mehmon rejimida mavjud emas. Tizimga kiring.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Retry enforcement ──
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
    const rawMaxExchanges = caseData.max_exchanges || 5;
    const maxExchanges = isGuest ? 2 : Math.max(3, Math.min(8, rawMaxExchanges));
    const difficulty = caseData.difficulty || 'orta';

    const userMessageCount = messages.filter(m => m.role === 'user').length;
    const isFinalExchange = !isIntro && userMessageCount >= maxExchanges;

    const tomonlarStr = Array.isArray(caseData.tomonlar) && caseData.tomonlar.length > 0
      ? caseData.tomonlar.join(', ')
      : 'tomon tanlash imkoniyati yo\'q';

    const studentSideStr = studentSide || (Array.isArray(caseData.tomonlar) && caseData.tomonlar.length > 0
      ? caseData.tomonlar[0]
      : '');

    // ── Difficulty-based personality ──
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

    // ── Dynamic article loading: detect mentioned articles in latest student message ──
    let dynamicArticleBlock = '';
    if (!isIntro && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const mentioned = extractMentionedArticles(lastUserMsg.text);
        if (mentioned.length > 0) {
          // Check which are in confirmed articles, which need DB lookup
          const confirmedRaqams = new Set(articles.map(a => a.modda_raqami));
          const needLookup = mentioned.filter(m => !confirmedRaqams.has(m.raqam));

          // Fetch from DB if not in confirmed set
          const extraArticles: { kodeks_nomi: string; modda_raqami: string; modda_matni: string; sarlavha: string }[] = [];
          for (const m of needLookup) {
            const query = supabaseAdmin
              .from('qonun_moddalari_v2')
              .select('qonun_kodi, modda_raqami, sarlavha, matn')
              .eq('modda_raqami', m.raqam);
            if (m.kod) query.eq('qonun_kodi', m.kod);
            const { data: dbArticle } = await query.limit(1).maybeSingle();
            if (dbArticle) {
              extraArticles.push({
                kodeks_nomi: dbArticle.qonun_kodi,
                modda_raqami: dbArticle.modda_raqami,
                modda_matni: dbArticle.matn || '',
                sarlavha: dbArticle.sarlavha || '',
              });
            }
          }

          // Also include full text of confirmed articles that were mentioned
          const mentionedConfirmed = articles.filter(a => mentioned.some(m => m.raqam === a.modda_raqami));

          const allMentioned = [...mentionedConfirmed, ...extraArticles];
          if (allMentioned.length > 0) {
            dynamicArticleBlock = '\n\n## TALABA TILGA OLGAN MODDALARNING TO\'LIQ MATNI:\n';
            for (const a of allMentioned) {
              dynamicArticleBlock += `\n### ${a.kodeks_nomi}, ${a.modda_raqami}-modda:\n${a.modda_matni}\n`;
            }
            dynamicArticleBlock += '\n## QOIDA: Talaba aynan shu moddalarni tilga oldi. Ularning to\'liq matnini o\'qib chiqib, javobingizni shu moddalarga tayanib bering. Namunaviy javobga emas, balki shu moddalarning haqiqiy matniga tayaning.';
          }
        }
      }
    }

    // ── Disagreement detection: count consecutive substantive objections ──
    let consecutiveObjections = 0;
    if (!isIntro && messages.length >= 3) {
      for (let i = messages.length - 1; i >= 1; i -= 2) {
        if (i < 1) break;
        const userMsg = messages[i];
        const assistantMsg = i > 0 ? messages[i - 1] : null;
        if (userMsg.role === 'user' && assistantMsg && assistantMsg.role === 'assistant') {
          if (isSubstantiveObjection(userMsg.text, assistantMsg.text)) {
            consecutiveObjections++;
          } else {
            break;
          }
        }
      }
    }
    const hasDisagreement = consecutiveObjections >= 2;

    // ── Build article text block ──
    let articlesBlock = '';
    if (articles.length > 0 && sampleAnswer) {
      articlesBlock = '\n\n## TASDIQLANGAN QONUN MODDALARI (namunaviy javob asosida):\n';
      articlesBlock += `\n### Namunaviy javob:\n${sampleAnswer}\n`;
      articlesBlock += '\n### Moddalar ro\'yxati (faqat raqam va sarlavha):\n';
      for (const a of articles) {
        articlesBlock += `- ${a.kodeks_nomi} ${a.modda_raqami}-modda: ${a.sarlavha}\n`;
      }
      articlesBlock += '\n## QATIY QOIDA: Yuqoridagi namunaviy javob va moddalar ro\'yxatiga tayaning. To\'liq modda matni talaba tilga olganda alohida beriladi. Hech qachon mavjud bo\'lmagan modda raqamini o\'ylab topma.';
    } else if (articles.length > 0) {
      articlesBlock = '\n\n## TASDIQLANGAN QONUN MODDALARI (faqat shularga tayaning):\n';
      for (const a of articles) {
        articlesBlock += `\n### ${a.kodeks_nomi}, ${a.modda_raqami}-modda:\n${a.modda_matni}\n`;
      }
      articlesBlock += '\n## QATIY QOIDA: Sen faqat yuqorida berilgan qonun moddalariga tayanib javob berishing kerak. Agar javob boshqa modda talab qilsa-yu, u senga berilmagan bo\'lsa, "Bu masala bo\'yicha menga aniq modda berilmagan, umumiy tamoyillar asosida fikr bildiraman" deb ayt — hech qachon mavjud bo\'lmagan modda raqamini o\'ylab topib aytma.';
    } else if (researchStatus === 'qisman' || researchStatus === 'xato') {
      articlesBlock = '\n\n## DIQQAT: Tadqiqot holati: ' + researchStatus + '. Moddalar tasdiqlanmagan. Umumiy huquqiy bilim asosida javob bering, aniq modda raqamlari keltirmang.';
    }

    // Add dynamic article block after articles block
    articlesBlock += dynamicArticleBlock;

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
2. Gapirgangizda aniq modda nomiga tayaning.
3. Agar aniq bilmasangiz, taxmin qilib gapirma — "bu masala bo'yicha aniq ko'rsatma berilmagan" deb ayt.
4. O'zbek tilida, professional huquqiy uslubda yozing.
5. Javoblaringiz qisqa va mazmunli bo'lsin (2-4 paragrafdan oshmasin).
6. Bu o'quv jarayoni — talabani o'rgating, uning argumentlarini qiyoshtiring va baholang.
7. Hech qachon xayoliy faktlar yoki qonun moddalari o'ylab topmang.
8. AGAR talabaning xabari quyidagi belgilarga ega bo'lsa — bu KO'CHIRIB OLIB CHIQILGAN (paste qilingan) matn bo'lishi mumkin:
   - Matnuzunligi keskin farq qiladi (oldingi xabarlardan juda uzun yoki boshqa uslubda)
   - Professional huquqiy til, lekin talabaning o'z uslubiga mos kelmaydi
   - To'g'ridan-to'g'ri qonun matni, darslikdan olingan paragraflar yoki internetdan olingan maqolalar
   - Formatting belgilari (Markdown, HTML, qiyshiq tirnoqlar, gillemotlar «»)
   Bunday holatda, matn oxiriga qisqa izoh qo'shing: "[Diqqat: bu matn ko'chirib olingan bo'lishi mumkin — iltimos, o'z so'zingiz bilan yozing]" deb yozing.
9. SUHBATNI HECH QACHON bir tomonlama "munozara yakunlandi", "munozara tugadi", "suhbat o'z yakuniga yetdi" kabi so'zlar bilan yopmang. Agar kelishmovchilik davom etsa, "Bu masalada turli qarashlar bo'lishi mumkin, buni ustozingiz bilan aniqlashtiring" deb yo'naltiring.
10. Agar talaba sizning xulosangizga qarshi dalil keltirsa va tilga olingan moddaning to'liq matni yuqorida berilgan bo'lsa, namunaviy javobga emas, balki shu moddaning haqiqiy matniga tayanib javob bering.

${difficultyInstructions[difficulty] || difficultyInstructions.orta}`;

    // Final exchange: closing speech but WITHOUT unilateral "yakunlandi"
    if (isFinalExchange) {
      systemPrompt += `

## YAKUNIY NUTQ:
Bu suhbatning oxirgi almashinuvi. Talaba ${maxExchanges} ta argument yubordi. Endi siz YAKUNIY NUTQ so'zingizni ayting:
- O'z pozitsiyangizni yakunlang, barcha asosiy dalillarni qisqacha takrorlang.
- Talabaning argumentlariga umumiy baho bering (qaysi biri kuchli, qaysi biri kuchsiz edi).
- Yangi savol bermang — bu oxirgi javob.
- "Munozara yakunlandi" yoki "munozara tugadi" DEB YOZMANG. "Mening yakuniy pozitsiyam shu" deb yozing.`;
    }

    // For intro: send a synthetic first message
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
    console.log(`[moot-court-chat] provider=${provider} objections=${consecutiveObjections} disagreement=${hasDisagreement}`);

    // ── Save updated messages to session ──
    if (sessionId) {
      const allMessages = isIntro && (!messages || messages.length === 0)
        ? [{ role: 'assistant', text: aiReply, timestamp: Date.now() }]
        : [...messages, { role: 'assistant', text: aiReply, timestamp: Date.now() }];

      const updatePayload: Record<string, any> = {
        messages: allMessages,
        updated_at: new Date().toISOString(),
      };

      if (isFinalExchange) {
        updatePayload.status = 'yakunlangan';
      }

      if (hasDisagreement) {
        updatePayload.kelishmovchilik = true;
      }

      await supabaseAdmin
        .from('moot_court_sessions')
        .update(updatePayload)
        .eq('id', sessionId);
    }

    return new Response(
      JSON.stringify({ reply: aiReply, aiRol, sessionEnded: isFinalExchange, isGuest, hasDisagreement }),
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
