import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ExtractResult {
  kodeks_nomi: string;
  modda_raqami: string;
  modda_matni: string;
  manba_havola: string;
}

/**
 * lex.uz sahifasidan HTML matnini oddiy HTTP so'rov orqali yuklab oladi.
 * Token sarflamaydi — bu oddiy web-fetch.
 */
async function fetchPageHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FanFasterBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'uz,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Sahifa yuklab olinmadi (HTTP ${res.status})`);
  }
  const html = await res.text();
  return html;
}

/**
 * HTML dan teglarni olib tashlab, toza matn olish.
 */
function stripHtml(html: string): string {
  // Script va style bloklarini olib tashlash
  let clean = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // <br> va </p> ni yangi qatorga almashtirish
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  clean = clean.replace(/<\/p>/gi, '\n');
  clean = clean.replace(/<\/div>/gi, '\n');
  // HTML teglarini olib tashlash
  clean = clean.replace(/<[^>]+>/g, ' ');
  // HTML entity larni decode qilish
  clean = clean.replace(/&nbsp;/g, ' ');
  clean = clean.replace(/&amp;/g, '&');
  clean = clean.replace(/&lt;/g, '<');
  clean = clean.replace(/&gt;/g, '>');
  clean = clean.replace(/&quot;/g, '"');
  clean = clean.replace(/&#39;/g, "'");
  clean = clean.replace(/&laquo;/g, '«');
  clean = clean.replace(/&raquo;/g, '»');
  // Ortiqcha bo'shliqlarni tozalash
  clean = clean.replace(/[ \t]+/g, ' ');
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

/**
 * Toza matndan kodeks nomini topish.
 * lex.uz sahifalarida odatda <title> yoki sarlavhada kodeks nomi bo'ladi.
 */
function extractKodeksName(text: string): string {
  // "X kodeksi" patternini qidirish
  const kodeksMatch = text.match(/((?:O['']?zbekiston\s+)?(?:Fuqarolik|Jinoyat|Ma'muriy|Mehnat|Oilaviy|Soliq|Bank|Sug['']?urta|Eksport|Investitsiya|Davlat\s+xizmati|Advokatlik|Notariat|Prokuratura|Sud|Huquqbuzarliklar)\s+(?:kodeksi|qonuni))/i);
  if (kodeksMatch) return kodeksMatch[1].trim();

  // Title teg ichidan qidirish (ilk 2000 belgi)
  const titleMatch = text.slice(0, 2000).match(/(.+?)\s*[-–—]\s*lex\.uz/i);
  if (titleMatch) return titleMatch[1].trim();

  // Umumiy qidiruv
  const generalMatch = text.slice(0, 3000).match(/(.+?)\s+kodeksi/i);
  if (generalMatch) return generalMatch[1].trim().slice(-60);

  return '';
}

/**
 * Toza matndan modda raqami va uning matnini ajratib olish.
 * Agar URL da #fragment bo'lsa, shu modda raqamini qidiradi.
 */
function extractArticle(text: string, articleHint?: string): { modda_raqami: string; modda_matni: string } | null {
  // Agar hint berilgan bo'lsa (URL fragment dan), shu moddani qidirish
  const targetNumber = articleHint?.replace(/^#/, '').trim();

  if (targetNumber) {
    // "333-modda" yoki "modda 333" patterni
    const patterns = [
      new RegExp(`(?:^|\\n)\\s*${targetNumber}\\s*[-–—.]\\s*modda[\\s\\S]*?(?=\\n\\s*\\d+\\s*[-–—.]\\s*modda|$)`, 'i'),
      new RegExp(`(?:^|\\n)\\s*modda\\s+${targetNumber}[\\s\\S]*?(?=\\n\\s*modda\\s+\\d+|$)`, 'i'),
      new RegExp(`(?:^|\\n)\\s*${targetNumber}\\s*[-–—.]\\s*(?:modda|statya|article)[\\s\\S]*?(?=\\n\\s*\\d+\\s*[-–—.]|\\n\\s*modda|$)`, 'i'),
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const block = m[0].trim();
        return {
          modda_raqami: targetNumber,
          modda_matni: block,
        };
      }
    }
  }

  // Hint yo'q yoki topilmasa — birinchi moddani olish
  const firstArticle = text.match(/(?:^|\n)\s*(\d+)\s*[-–—.]\s*modda\s*[\s\S]*?(?=\n\s*\d+\s*[-–—.]\s*modda|$)/i);
  if (firstArticle) {
    const numMatch = firstArticle[0].match(/^\s*(\d+)/);
    return {
      modda_raqami: numMatch ? numMatch[1] : '',
      modda_matni: firstArticle[0].trim(),
    };
  }

  return null;
}

/**
 * URL dan modda raqami hintini olish (lex.uz/docs/XXXXX#YYYYY formati).
 */
function getArticleHintFromUrl(url: string): string | undefined {
  const hashMatch = url.match(/#(\S+)/);
  if (hashMatch) return hashMatch[1];

  // Ba'zan lex.uz URL lari /docs/XXXXX-YYYY formatida bo'ladi
  const dashMatch = url.match(/\/docs\/\d+-(\d+)/);
  if (dashMatch) return dashMatch[1];

  return undefined;
}

/**
 * URL butun kodeksga ishora qilayotganini tekshirish.
 * Agar URL da #fragment yo'q va sahifada juda ko'p moddalar bo'lsa — butun kodeks.
 */
function isWholeCodeUrl(url: string, text: string): boolean {
  const hasFragment = url.includes('#');
  if (hasFragment) return false;

  // Sahifada nechta "N-modda" borligini sanash
  const articleCount = (text.match(/\d+\s*[-–—.]\s*modda/gi) || []).length;
  return articleCount > 5;
}

/**
 * AI fallback: agar regex muvaffaqiyatsiz bo'lsa, AI ga faqat bitta sahifa matni yuboriladi.
 * Bu kichik, arzon so'rov — butun kodeks emas.
 */
async function aiExtractArticle(
  pageText: string,
  targetArticle: string | undefined,
  supabase: any
): Promise<{ kodeks_nomi: string; modda_raqami: string; modda_matni: string } | null> {
  // AI sozlamalarini olish
  const { data: settings } = await supabase
    .from('settings')
    .select('key, text_value')
    .in('key', ['AI_MENTOR_API_KEY', 'AI_MENTOR_API_URL', 'AI_MENTOR_MODEL']);

  if (!settings) return null;

  const settingsMap: Record<string, string> = {};
  settings.forEach((s: any) => {
    if (s.text_value) settingsMap[s.key] = s.text_value;
  });

  const apiKey = settingsMap['AI_MENTOR_API_KEY'];
  const apiUrl = settingsMap['AI_MENTOR_API_URL'];
  const model = settingsMap['AI_MENTOR_MODEL'] || 'gemini-1.5-flash';

  if (!apiKey || !apiUrl) return null;

  // Sahifa matnini qisqartirish — faqat birinchi 8000 belgi (token tejash)
  const truncatedText = pageText.slice(0, 8000);

  const prompt = targetArticle
    ? `Quyida lex.uz sahifasidan olingan matn bor. Shu matndan FAQAT ${targetArticle}-modda qismini so'zma-so'z ajratib ber. Boshqa hech narsa qo'shma. Javob formati:

KODEKS: [kodeks nomi]
MODDA: ${targetArticle}
MATN: [moddaning to'liq matni]

---SAHIFA MATNI---
${truncatedText}`
    : `Quyida lex.uz sahifasidan olingan matn bor. Shu matndan birinchi moddani so'zma-so'z ajratib ber. Boshqa hech narsa qo'shma. Javob formati:

KODEKS: [kodeks nomi]
MODDA: [modda raqami]
MATN: [moddaning to'liq matni]

---SAHIFA MATNI---
${truncatedText}`;

  try {
    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
    };

    const res = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error('[fetch-legal-article] AI fallback xato:', res.status);
      return null;
    }

    const data = await res.json();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) return null;

    // AI javobini parse qilish
    const kodeksMatch = aiText.match(/KODEKS:\s*(.+)/i);
    const moddaMatch = aiText.match(/MODDA:\s*(.+)/i);
    const matnMatch = aiText.match(/MATN:\s*([\s\S]+?)(?:$|---)/i);

    if (moddaMatch && matnMatch) {
      return {
        kodeks_nomi: kodeksMatch ? kodeksMatch[1].trim() : '',
        modda_raqami: moddaMatch[1].trim(),
        modda_matni: matnMatch[1].trim(),
      };
    }
    return null;
  } catch (e) {
    console.error('[fetch-legal-article] AI fallback xato:', e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json() as { url: string };

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // URL validatsiya — faqat lex.uz ruxsat etiladi
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Noto\'g\'ri URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsedUrl.hostname.includes('lex.uz')) {
      return new Response(
        JSON.stringify({ error: 'Faqat lex.uz havolalari qabul qilinadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-legal-article] URL yuklanmoqda: ${url}`);

    // 1. Sahifani yuklab olish (oddiy HTTP — token sarflamaydi)
    const html = await fetchPageHtml(url);
    const text = stripHtml(html);

    // 2. Butun kodeksga ishora qilayotganini tekshirish
    const articleHint = getArticleHintFromUrl(url);
    if (isWholeCodeUrl(url, text) && !articleHint) {
      return new Response(
        JSON.stringify({ error: 'Iltimos, aniq bitta moddaning havolasini kiriting, butun kodeks emas. lex.uz havolasida #modda_raqami bo\'lishi kerak.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Regex orqali moddani ajratib olishga urinish (token sarflamaydi)
    let kodeksNomi = extractKodeksName(text);
    let extracted = extractArticle(text, articleHint);

    // 4. Agar regex muvaffaqiyatsiz bo'lsa — AI fallback (kichik so'rov)
    let usedAi = false;
    if (!extracted) {
      console.log('[fetch-legal-article] regex muvaffaqiyatsiz, AI fallback ishlatiladi');
      const aiResult = await aiExtractArticle(text, articleHint, supabaseAdmin);
      if (aiResult) {
        extracted = { modda_raqami: aiResult.modda_raqami, modda_matni: aiResult.modda_matni };
        if (!kodeksNomi) kodeksNomi = aiResult.kodeks_nomi;
        usedAi = true;
      }
    }

    if (!extracted || !extracted.modda_matni) {
      return new Response(
        JSON.stringify({ error: 'Modda matnini ajratib olish mumkin emas. Iltimos, havola to\'g\'ri ekanligini tekshiring yoki moddani qo\'lda yozing.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Modda matnini qisqartirish (juda uzun bo'lsa)
    if (extracted.modda_matni.length > 10000) {
      extracted.modda_matni = extracted.modda_matni.slice(0, 10000) + '...';
    }

    const result: ExtractResult = {
      kodeks_nomi: kodeksNomi || 'Noma\'lum kodeks',
      modda_raqami: extracted.modda_raqami,
      modda_matni: extracted.modda_matni,
      manba_havola: url,
    };

    console.log(`[fetch-legal-article] muvaffaqiyatli: ${result.kodeks_nomi} ${result.modda_raqami}-modda (AI: ${usedAi})`);

    return new Response(
      JSON.stringify({ ...result, usedAi }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[fetch-legal-article] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 200)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
