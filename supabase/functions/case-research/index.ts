// Pipeline v3.0 — improved recall: ILIKE fallback, full-text verification, wider candidate net
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ─── KIRILL → LOTIN TRANSKRIPSIYASI ────────────────────────────────────────────
function cyrillicToLatin(text: string): string {
  const map: Record<string, string> = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts','ч':'ch','ш':'sh','щ':'sh',
    'ъ':"'",'ы':'i','ь':'','э':'e','ю':'yu','я':'ya',
    'ў':"o'",'қ':'q','ғ':"g'",'ҳ':'h',
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'J','З':'Z',
    'И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R',
    'С':'S','Т':'T','У':'U','Ф':'F','Х':'X','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Sh',
    'Ъ':"'",'Ы':'I','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
    'Ў':"O'",'Қ':'Q','Ғ':"G'",'Ҳ':'H',
  };
  let result = '';
  for (const ch of text) {
    result += map[ch] ?? ch;
  }
  return result;
}

// ─── NORMALIZATSIYA ───────────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return cyrillicToLatin(text)
    .toLowerCase()
    .replace(/[ʻʼ'’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModdaRaqam(raqam: string): string {
  return raqam
    .replace(/\s+/g, '')
    .replace(/[ʻʼ'’‘`]/g, "'")
    .replace(/[²³]/g, (m) => m === '²' ? '2' : '3')
    .replace(/-modda$/i, '')
    .replace(/^modda\s*/i, '')
    .toLowerCase();
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface AINomzod {
  qonun_kodi: string;
  modda_raqami: string;
  kalit_sozlar: string[];
  tushuncha: string;
  bolim_bob: string;
  nega_kerak: string;
}

interface ModdaDB {
  id: string;
  modda_raqami: string;
  sarlavha: string;
  bob_nomi: string;
  matn: string;
  lex_element_id: string | null;
}

interface BirlashtirilganNomzod {
  modda: ModdaDB;
  qonun_kodi: string;
  manba: 'fts' | 'ai_sarlavha' | 'ai_raqam';
  kalit_sozlar: string[];
  tushuncha: string;
  bolim_bob: string;
  nega_kerak: string;
}

interface TasdiqlanganModda {
  modda: ModdaDB;
  qonun_kodi: string;
  ball: number;
  asoslash: string;
  manba: 'fts' | 'ai_sarlavha' | 'ai_raqam';
  kalit_sozlar: string[];
  nega_kerak: string;
}

function extractJsonFromAI(text: string): any | null {
  // 1-usul: to'g'ridan-to'g'ri JSON.parse
  try {
    const parsed = JSON.parse(text);
    return parsed;
  } catch {}
  // 2-usul: ```json blokini ajratib olish
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }
  // 3-usul: { ... } blokini topish
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const cleaned = jsonMatch[0].replace(/```json\s*/g, '').replace(/```\s*/g, '');
    return JSON.parse(cleaned);
  } catch {}
  // 4-usul: trivial trailing comma cleanup
  if (jsonMatch) {
    try {
      const cleaned = jsonMatch[0]
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"');
      return JSON.parse(cleaned);
    } catch {}
  }
  return null;
}

// ─── STAGE 0: QONUNLARNI ANIQLASH ─────────────────────────────────────────────
async function stage0_QonunAniqlash(
  kazusMatn: string,
  qonunlar: { kod: string; nom: string }[]
): Promise<{ qonunlar: string[]; model: string; tokens: any }> {
  const qonunlarStr = qonunlar.map(q => `- ${q.kod}: ${q.nom}`).join('\n');

  const systemPrompt = `Siz huquq ekspertisiz. Vazifangiz — berilgan kazus matnini o'qib,
quyidagi ro'yxatdagi qaysi qonun kodekslari unga tegishli ekanligini aniqlash.

Mavjud qonunlar ro'yxati (kod: to'liq nomi):
${qonunlarStr}

QOIDALAR:
1. Har bir qonunning NOMIGA (masalan "Fuqarolik kodeksi", "Mehnat kodeksi",
   "Soliq kodeksi" va h.k.) qarab, kazus matnidagi huquqiy munosabat turi bilan
   solishtiring — kod nomi sizga qaysi soha ekanini ko'rsatadi.
2. Kazus bir nechta huquq sohasiga tegishli bo'lishi mumkin (masalan, jinoiy ish
   davomida fuqarolik da'vosi ham ko'tarilgan bo'lishi mumkin) — shunday holatda
   bir nechta kodni tanlang.
3. 1 dan 3 gacha eng tegishli qonun kodini tanlang. RO'YXATDA HALI KO'RMAGAN yoki
   unda yo'q nomni HECH QACHON o'ylab topmang — faqat yuqoridagi ro'yxatdan tanlang.
4. Agar kazus matni hech qanday berilgan qonunga aniq mos kelmasa, bo'sh ro'yxat
   qaytaring — taxmin qilib tanlashdan ko'ra aniq aytmaslik afzalroq.
5. Javob QAT'IY JSON formatida bo'lsin.

JSON format:
{
  "qonunlar": ["<ro'yxatdagi kod 1>", "<ro'yxatdagi kod 2>"]
}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
    maxTokens: 300,
    temperature: 0.2,
    jsonMode: true,
    functionName: 'case-research-stage0',
  });

  const parsed = extractJsonFromAI(text);
  const kodlar = parsed?.qonunlar && Array.isArray(parsed.qonunlar)
    ? parsed.qonunlar.filter((k: string) => qonunlar.some(q => q.kod.toUpperCase() === k.toUpperCase())).map((k: string) => k.toUpperCase())
    : [];

  return {
    qonunlar: kodlar,
    model: provider,
    tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
  };
}

// ─── STAGE 0.5: AI LEGAL CONCEPT EXTRACTION ────────────────────────────────────
async function stage0_5_LegalConcepts(
  kazusMatn: string,
  qonunlar: string[]
): Promise<{ kalitSozlar: string[]; huquqiyMasalalar: string[]; model: string; tokens: any }> {
  const qonunlarStr = qonunlar.join(', ');
  const systemPrompt = `Siz huquq ekspertisiz. Kazus matnini o'qib, quyidagi UNIVERSAL
(har qanday huquq sohasiga tegishli bo'lishi mumkin bo'lgan) toifalardan QAYSILARI
unga tegishli ekanligini aniqlang.

Toifalar ro'yxati:
- tomonlar orasidagi huquqiy munosabat turi (shartnoma, mulkiy, mehnat, oilaviy,
  ma'muriy, jinoiy, soliq va h.k. — kazusda aniq ko'ringan turini yozing)
- huquqbuzarlik/zarar/javobgarlik asosi (kim, kimga nisbatan qanday huquqbuzarlik
  yoki zarar keltirgan)
- bir nechta shaxs/tomonning ishtiroki va ularning huquqiy maqomi (masalan
  hamkorlikdagi javobgarlik, vakolat, ishtirokchilik)
- muddatlar, protsessual tartib yoki shakliy talablar
- oldingi shunga o'xshash holatlar, takroriylik yoki og'irlashtiruvchi/
  yengillashtiruvchi holatlar
- yashirish, xabar bermaslik yoki dalillarni yo'q qilish kabi qo'shimcha harakatlar
- javobgarlikdan ozod qilish yoki mustasno holatlar

QOIDALAR:
1. Faqat kazus faktlariga asoslanib, tegishli toifalarni tanlang (bir nechtasi
   bo'lishi mumkin, hech qaysi bo'lmasligi ham mumkin).
2. Har tanlangan toifa uchun 3-5 ta professional huquqiy kalit so'z bering —
   kazus faktlari emas, qonun matnida uchraydigan terminlarni ishlating.
3. O'ylab topmang — faqat kazusda aniq ko'rsatilgan holatlarga tayaning.
4. Javob QAT'IY JSON formatida bo'lsin.

JSON format (bu FAQAT struktura namunasi, mazmuni haqiqiy emas):
{
  "huquqiy_masalalar": ["<toifa 1 nomi>", "<toifa 2 nomi>"],
  "kalit_sozlar": ["<termin 1>", "<termin 2>", "<termin 3>"]
}

Tegishli qonunlar: ${qonunlarStr}`;

  try {
    const { text, provider } = await callAIWithFallback({
      systemPrompt,
      messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
      maxTokens: 800,
      temperature: 0.2,
      jsonMode: true,
      functionName: 'case-research-stage0-5',
    });

    const parsed = extractJsonFromAI(text);
    const aiKalitSozlar: string[] = (parsed?.kalit_sozlar && Array.isArray(parsed.kalit_sozlar))
      ? parsed.kalit_sozlar.filter((w: any) => typeof w === 'string' && w.length >= 3).slice(0, 20)
      : [];
    const huquqiyMasalalar: string[] = (parsed?.huquqiy_masalalar && Array.isArray(parsed.huquqiy_masalalar))
      ? parsed.huquqiy_masalalar.filter((w: any) => typeof w === 'string').slice(0, 10)
      : [];

    return {
      kalitSozlar: aiKalitSozlar,
      huquqiyMasalalar,
      model: provider,
      tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
    };
  } catch (e) {
    console.warn(`[case-research] Stage0.5 xato:`, e);
    return { kalitSozlar: [], huquqiyMasalalar: [], model: '', tokens: { input: 0, output: 0 } };
  }
}

// ─── STAGE 1A: DATABASE FULL-TEXT SEARCH ──────────────────────────────────────
async function stage1a_FTSQidiruv(
  qonunKodi: string,
  kazusMatn: string,
  aiKalitSozlar: string[]
): Promise<{ moddalar: ModdaDB[]; kalitSozlar: string[] }> {
  const ftsKalitSozlar = extractKeywords(kazusMatn);
  // AI kalit so'zlarni ham qo'shamiz — huquqiy terminlar bilan qidirish
  const allKeywords = [...new Set([...ftsKalitSozlar, ...aiKalitSozlar])].slice(0, 30);

  // 1-usul: FTS (tez, lekin kalit so'zlar mos kelmasa bo'sh qaytaradi)
  const { data: ftsData, error: ftsErr } = await supabaseAdmin
    .rpc('search_moddalar_v2_fts', {
      p_qonun_kodi: qonunKodi,
      p_keywords: allKeywords,
      p_limit_count: 25,
    });

  let moddalar: ModdaDB[] = [];

  if (!ftsErr && ftsData) {
    moddalar = (ftsData as any[]).map((m) => ({
      id: m.id,
      modda_raqami: m.modda_raqami,
      sarlavha: m.sarlavha || '',
      bob_nomi: m.bob_nomi || '',
      matn: m.matn || '',
      lex_element_id: m.lex_element_id || null,
    }));
  }

  // 2-usul: ILIKE fallback — FTS kam yoki hech narsa topmasa
  if (moddalar.length < 10) {
    const topWords = allKeywords.filter(w => w.length >= 4).slice(0, 8);
    if (topWords.length > 0) {
      const ilikeConds = topWords.map(w => `matn.ilike.%${w}%`).join(',');
      const { data: ilikeData } = await supabaseAdmin
        .from('qonun_moddalari_v2')
        .select('id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id')
        .eq('qonun_kodi', qonunKodi)
        .or(ilikeConds)
        .limit(30);

      if (ilikeData) {
        const existingIds = new Set(moddalar.map(m => m.id));
        for (const m of ilikeData) {
          if (!existingIds.has(m.id)) {
            moddalar.push({
              id: m.id,
              modda_raqami: m.modda_raqami,
              sarlavha: m.sarlavha || '',
              bob_nomi: m.bob_nomi || '',
              matn: m.matn || '',
              lex_element_id: m.lex_element_id || null,
            });
          }
        }
      }
    }
  }

  // 3-usul: sarlavha bo'yicha ILIKE — kalit so'zlar sarlavhada bo'lishi mumkin
  if (moddalar.length < 8) {
    const topWords = allKeywords.filter(w => w.length >= 4).slice(0, 6);
    if (topWords.length > 0) {
      const ilikeConds = topWords.map(w => `sarlavha.ilike.%${w}%`).join(',');
      const { data: sarlavhaData } = await supabaseAdmin
        .from('qonun_moddalari_v2')
        .select('id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id')
        .eq('qonun_kodi', qonunKodi)
        .or(ilikeConds)
        .limit(20);

      if (sarlavhaData) {
        const existingIds = new Set(moddalar.map(m => m.id));
        for (const m of sarlavhaData) {
          if (!existingIds.has(m.id)) {
            moddalar.push({
              id: m.id,
              modda_raqami: m.modda_raqami,
              sarlavha: m.sarlavha || '',
              bob_nomi: m.bob_nomi || '',
              matn: m.matn || '',
              lex_element_id: m.lex_element_id || null,
            });
          }
        }
      }
    }
  }

  console.log(`[case-research] Stage1a ${qonunKodi}: FTS=${ftsData?.length || 0}, jami=${moddalar.length}, kalitSozlar=${allKeywords.slice(0, 8).join(',')}`);
  return { moddalar: moddalar.slice(0, 40), kalitSozlar: allKeywords };
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'va', 'ham', 'bilan', 'uchun', 'bor', 'har', 'bu', 'shu', 'u', 'ular',
    'bir', 'emas', 'edi', 'bo\'lib', 'bo\'lgan', 'qilingan', 'etilgan',
    'kerak', 'lozim', 'the', 'and', 'for', 'is', 'are', 'was', 'were',
    'qanday', 'nima', 'qiladi', 'qilgan', 'sud', 'sudga', 'sudda',
    'shaxs', 'shaxsning', 'shuning', 'yoki', 'lekin', 'ammo', 'chunki',
    'faqat', 'keyin', 'olding', 'so\'ng', 'hamda', 'yana', 'ko\'ra',
    'kishi', 'kishining', 'narsa', 'holat', 'holatda', 'qaror', 'qarori',
    'soat', 'kuni', 'yil', 'may', 'kun', 'ibb', 'hozir', 'berib', 'qilib',
    'qarab', 'tomonidan', 'orqali', 'bundan', 'buni', 'uni', 'men', 'sen',
    'biz', 'siz', 'ularning', 'uning', 'manning', 'sening', 'bizning',
    'shu', 'bu', 'o\'sha', 'mana', 'ana', 'endi', 'yana', 'faqat', 'gina',
  ]);

  // So'z ildizlariga qisqartirish — FTS stemmer ishlatmaydi
  function stem(word: string): string {
    // O'zbekcha suffikslarni olib tashlash
    return word
      .replace(/(larini|lardan|larga|larda|lardir|lar)$/i, '')
      .replace(/(ningdan|ningga|ningni|ningda|ning)$/i, '')
      .replace(/(ini|idan|iga|ida|ini|ini|idan|iga|ida|iga)$/i, '')
      .replace(/(dan|ga|da|ni|ka|ki|qa|qa)$/i, '')
      .replace(/(lar|lar|lar)$/i, '')
      .replace(/(sh|sh|sh)$/i, '');
  }

  return normalizeText(text)
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .map(w => stem(w))
    .filter(w => w.length >= 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 25);
}

// ─── STAGE 1B: AI WITH REAL ARTICLE TITLES ────────────────────────────────────
async function stage1b_AISarlavha(
  kazusMatn: string,
  ftsModdalar: { qonun_kodi: string; moddalar: ModdaDB[] }[],
  huquqiyMasalalar: string[]
): Promise<{ nomzodlar: AINomzod[]; model: string; tokens: any }> {
  const moddalarStr = ftsModdalar.flatMap(fm =>
    fm.moddalar.slice(0, 20).map(m => `- ${fm.qonun_kodi} ${m.modda_raqami}-modda: ${m.sarlavha}`)
  ).join('\n');

  if (!moddalarStr) return { nomzodlar: [], model: '', tokens: { input: 0, output: 0 } };

  const masalalarStr = huquqiyMasalalar.length > 0
    ? `\nKazusning huquqiy masalalari: ${huquqiyMasalalar.join(', ')}\n`
    : '';

  const systemPrompt = `Siz huquq ekspertisiz. Quyida kazus matni va shu kazusga oid
bo'lishi mumkin bo'lgan qonun moddalari ro'yxati (sarlavhalari bilan) berilgan.
Kazus istalgan huquq sohasidan bo'lishi mumkin — jinoiy, fuqarolik, ma'muriy,
mehnat, soliq va h.k. Siz faqat quyidagi ro'yxatdagi moddalar bilan cheklanasiz.
${masalalarStr}

Vazifangiz — ro'yxatdan kazusga ENG TEGISHLI 15 ta moddani tanlash.

QOIDALAR:
1. Faqat ro'yxatdagi moddalardan tanlang. Ro'yxatda yo'q moddani o'ylab topmang.
2. Har modda uchun nega kazusga tegishli ekanligini 1 gapda yozing.
3. Modda raqamini ro'yxatdagidek aniq yozing.
4. KENG RO'YXAT TANLANG — kazus bilan biroz bog'liq bo'lgan moddalar ham kirsin.
   Moddiy huquq normalari, protsessual/tartib normalari, tomonlarning huquq va
   majburiyatlari, javobgarlik shakllari, muddatlar va boshqa jihatlarning
   barchasini qamrab oling — bitta toifaga yoki bitta huquq sohasiga cheklanib
   qolmang.
5. Huquqiy masalalar ro'yxatiga e'tibor bering — shu masalalarga tegishli
   moddalarni ustun ko'ring.
6. Javob QAT'IY JSON formatida bo'lsin.

JSON format (DIQQAT: bu FAQAT struktura namunasi — undagi qiymatlar hech qanday
haqiqiy qonunga tegishli emas, faqat maydonlar qanday to'ldirilishini ko'rsatadi;
haqiqiy javobda FAQAT pastdagi "Moddalar ro'yxati"dan foydalaning):
{
  "nomzodlar": [
    {
      "qonun_kodi": "<ro'yxatdagi kod>",
      "modda_raqami": "<ro'yxatdagi aniq raqam>",
      "kalit_sozlar": ["<termin 1>", "<termin 2>", "<termin 3>"],
      "tushuncha": "<moddaning ro'yxatdagi sarlavhasiga asoslangan qisqa mazmuni>",
      "bolim_bob": "<ro'yxatdagi bob/bo'lim nomi, agar bilinsa>",
      "nega_kerak": "<kazusning aynan qaysi faktiga bu modda tegishli — 1 gap>"
    }
  ]
}

Moddalar ro'yxati:
${moddalarStr}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
    maxTokens: 2000,
    temperature: 0.3,
    jsonMode: true,
    functionName: 'case-research-stage1b',
  });

  const parsed = extractJsonFromAI(text);
  const nomzodlar = parsed?.nomzodlar && Array.isArray(parsed.nomzodlar) ? parsed.nomzodlar.slice(0, 15) : [];

  if (nomzodlar.length === 0) {
    console.warn(`[case-research] Stage1b AI javob parse qilinmadi yoki bo'sh. text(500)=${text.slice(0, 500)}`);
  }

  return {
    nomzodlar,
    model: provider,
    tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
    _debugText: nomzodlar.length === 0 ? text.slice(0, 300) : '',
  };
}

// ─── STAGE 1C: AI FREE RECALL (safety net) ────────────────────────────────────
async function stage1c_AIRaqam(
  kazusMatn: string,
  qonunlar: { kod: string; nom: string }[],
  huquqiyMasalalar: string[]
): Promise<{ nomzodlar: AINomzod[]; model: string; tokens: any }> {
  const qonunlarStr = qonunlar.map(q => `- ${q.kod}: ${q.nom}`).join('\n');
  const masalalarStr = huquqiyMasalalar.length > 0
    ? `\nKazusning huquqiy masalalari: ${huquqiyMasalalar.join(', ')}\n`
    : '';

  const systemPrompt = `Siz huquq ekspertisiz. Vazifangiz — berilgan kazus matni uchun
tegishli qonun moddalarini nomzod qilib ko'rsatish. Kazus istalgan huquq sohasidan
(jinoiy, fuqarolik, ma'muriy, mehnat, soliq va h.k.) bo'lishi mumkin — quyidagi
ro'yxatdagi qonun nomlariga qarab, kazusga qaysi biri mos kelishini o'zingiz aniqlang.
${masalalarStr}

QOIDALAR:
1. Faqat pastdagi ro'yxatdagi qonun kodlaridan tanlang.
2. 12 ta nomzod bering — KENGROQ ro'yxat tuzing.
3. Kazusning barcha huquqiy jihatlarini qamrab oling: moddiy huquq normalari,
   protsessual/tartib normalari, tomonlarning huquq va majburiyatlari, javobgarlik
   shakllari, muddatlar, ishtirokchilik/vakolat masalalari — faqat bitta huquq
   sohasiga yoki bitta toifaga cheklanib qolmang.
4. Huquqiy masalalar ro'yxatiga e'tibor bering — shu masalalarga tegishli
   moddalarni ustun ko'ring.
5. Har nomzod uchun:
   - qonun_kodi: ro'yxatdagi kod
   - modda_raqami: taxminiy modda raqami (string)
   - kalit_sozlar: 3-5 ta kalit so'z
   - tushuncha: 1 gaplik modda mazmuni
   - bolim_bob: taxminiy bob/bo'lim nomi
   - nega_kerak: 1 gap — bu modda kazusga nega tegishli
6. Javob QAT'IY JSON formatida bo'lsin.

JSON format (DIQQAT: bu FAQAT struktura namunasi, qiymatlar haqiqiy emas):
{
  "nomzodlar": [
    {
      "qonun_kodi": "<ro'yxatdagi kod>",
      "modda_raqami": "<taxminiy raqam>",
      "kalit_sozlar": ["<termin 1>", "<termin 2>"],
      "tushuncha": "<qisqa mazmun>",
      "bolim_bob": "<taxminiy bob nomi>",
      "nega_kerak": "<sabab, 1 gap>"
    }
  ]
}

Mavjud qonunlar ro'yxati:
${qonunlarStr}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
    maxTokens: 1500,
    temperature: 0.3,
    jsonMode: true,
    functionName: 'case-research-stage1c',
  });

  const parsed = extractJsonFromAI(text);
  const nomzodlar = parsed?.nomzodlar && Array.isArray(parsed.nomzodlar) ? parsed.nomzodlar.slice(0, 12) : [];

  if (nomzodlar.length === 0) {
    console.warn(`[case-research] Stage1c AI javob parse qilinmadi yoki bo'sh. text(500)=${text.slice(0, 500)}`);
  }

  return {
    nomzodlar,
    model: provider,
    tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
    _debugText: nomzodlar.length === 0 ? text.slice(0, 300) : '',
  };
}

// ─── FETCH MODDA FROM DB ──────────────────────────────────────────────────────
async function fetchModdaFromDB(qonunKod: string, moddaRaqam: string): Promise<ModdaDB | null> {
  // AI ba'zan "11-modda" formatida qaytaradi — raqam qismini ajratib olish
  const raqam = moddaRaqam.replace(/^-?modda\.?\s*/i, '').replace(/-modda$/i, '').trim();

  // Avval aniq moslikka urinish (eng tez)
  const { data: exact } = await supabaseAdmin
    .from('qonun_moddalari_v2')
    .select('id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id')
    .eq('qonun_kodi', qonunKod)
    .eq('modda_raqami', raqam)
    .limit(1);

  if (exact && exact.length > 0) {
    const m = exact[0];
    return { id: m.id, modda_raqami: m.modda_raqami, sarlavha: m.sarlavha || '', bob_nomi: m.bob_nomi || '', matn: m.matn || '', lex_element_id: m.lex_element_id || null };
  }

  // Agar aniq moslik bo'lmasa, prefiks bilan qidirish
  const { data } = await supabaseAdmin
    .from('qonun_moddalari_v2')
    .select('id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id')
    .eq('qonun_kodi', qonunKod)
    .ilike('modda_raqami', `${raqam}%`)
    .order('modda_raqami', { ascending: true })
    .limit(1);

  if (!data || data.length === 0) return null;
  const m = data[0];
  return {
    id: m.id,
    modda_raqami: m.modda_raqami,
    sarlavha: m.sarlavha || '',
    bob_nomi: m.bob_nomi || '',
    matn: m.matn || '',
    lex_element_id: m.lex_element_id || null,
  };
}

// ─── STAGE 1: UCHALASINI BIRLASHTIRISH ────────────────────────────────────────
async function stage1_NomzodBirlashtirish(
  kazusMatn: string,
  barchaQonunlar: { kod: string; nom: string }[]
): Promise<{
  birlashtirilgan: BirlashtirilganNomzod[];
  step0: { qonunlar: string[]; model: string; tokens: any };
  step1a: { moddalar: ModdaDB[]; kalitSozlar: string[] };
  step1b: { nomzodlar: AINomzod[]; model: string; tokens: any };
  step1c: { nomzodlar: AINomzod[]; model: string; tokens: any };
}> {
  const step0Result = await stage0_QonunAniqlash(kazusMatn, barchaQonunlar);
  const activeQonunlar = step0Result.qonunlar.length > 0
    ? step0Result.qonunlar
    : barchaQonunlar.map(q => q.kod.toUpperCase());

  if (activeQonunlar.length === 0) {
    return {
      birlashtirilgan: [],
      step0: step0Result,
      step1a: { moddalar: [], kalitSozlar: [] },
      step1b: { nomzodlar: [], model: '', tokens: { input: 0, output: 0 } },
      step1c: { nomzodlar: [], model: '', tokens: { input: 0, output: 0 } },
    };
  }

  // Stage 0.5: AI legal concept extraction — huquqiy terminlarni aniqlash
  console.log(`[case-research] Stage 0.5: Huquqiy terminlarni aniqlash...`);
  const step0_5 = await stage0_5_LegalConcepts(kazusMatn, activeQonunlar);
  console.log(`[case-research] Stage 0.5 done: ${step0_5.kalitSozlar.length} ta kalit so'z, masalalar: ${step0_5.huquqiyMasalalar.join(', ')}`);

  // Path A: FTS for each law (parallel) — AI kalit so'zlar bilan
  const ftsResults = await Promise.all(
    activeQonunlar.map(async (kod) => {
      const { moddalar, kalitSozlar } = await stage1a_FTSQidiruv(kod, kazusMatn, step0_5.kalitSozlar);
      return { qonun_kodi: kod, moddalar, kalitSozlar };
    })
  );

  // Path A2: Huquqiy masalalar bo'yicha qo'shimcha qidiruv
  if (step0_5.huquqiyMasalalar.length > 0) {
    const masalaKalitSozlar = step0_5.huquqiyMasalalar.flatMap(m =>
      normalizeText(m).replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
    ).filter((w, i, arr) => arr.indexOf(w) === i).slice(0, 15);

    const extraFtsResults = await Promise.all(
      activeQonunlar.map(async (kod) => {
        const { moddalar, kalitSozlar } = await stage1a_FTSQidiruv(kod, kazusMatn, masalaKalitSozlar);
        return { qonun_kodi: kod, moddalar, kalitSozlar };
      })
    );

    // Merge extra FTS into main results
    for (const extra of extraFtsResults) {
      const main = ftsResults.find(r => r.qonun_kodi === extra.qonun_kodi);
      if (main) {
        const existingIds = new Set(main.moddalar.map(m => m.id));
        for (const m of extra.moddalar) {
          if (!existingIds.has(m.id)) {
            main.moddalar.push(m);
          }
        }
      }
    }
  }

  // Path B: AI with real article titles + huquqiy masalalar context
  const step1bInput = ftsResults.map(r => ({ qonun_kodi: r.qonun_kodi, moddalar: r.moddalar }));
  const step1bResult = await stage1b_AISarlavha(kazusMatn, step1bInput, step0_5.huquqiyMasalalar);

  // Path C: AI free recall + huquqiy masalalar context
  const activeQonunlarList = activeQonunlar
    .map(k => barchaQonunlar.find(q => q.kod.toUpperCase() === k))
    .filter(Boolean) as { kod: string; nom: string }[];
  const step1cResult = await stage1c_AIRaqam(kazusMatn, activeQonunlarList, step0_5.huquqiyMasalalar);

  // Merge
  const merged: Map<string, BirlashtirilganNomzod> = new Map();

  // Path A → FTS
  for (const fts of ftsResults) {
    for (const m of fts.moddalar) {
      const key = `${fts.qonun_kodi}::${normalizeModdaRaqam(m.modda_raqami)}`;
      if (!merged.has(key)) {
        merged.set(key, {
          modda: m,
          qonun_kodi: fts.qonun_kodi,
          manba: 'fts',
          kalit_sozlar: [],
          tushuncha: '',
          bolim_bob: '',
          nega_kerak: '',
        });
      }
    }
  }

  // Path B → AI with titles (match by raqam)
  for (const nomzod of step1bResult.nomzodlar) {
    const qonunKod = nomzod.qonun_kodi?.toUpperCase() || '';
    const raqamKey = normalizeModdaRaqam(nomzod.modda_raqami || '');
    if (!qonunKod || !raqamKey) continue;
    const key = `${qonunKod}::${raqamKey}`;
    const existing = merged.get(key);
    if (existing) {
      existing.kalit_sozlar = nomzod.kalit_sozlar || [];
      existing.tushuncha = nomzod.tushuncha || '';
      existing.bolim_bob = nomzod.bolim_bob || '';
      existing.nega_kerak = nomzod.nega_kerak || '';
    } else {
      const dbModda = await fetchModdaFromDB(qonunKod, nomzod.modda_raqami);
      if (dbModda) {
        merged.set(key, {
          modda: dbModda,
          qonun_kodi: qonunKod,
          manba: 'ai_sarlavha',
          kalit_sozlar: nomzod.kalit_sozlar || [],
          tushuncha: nomzod.tushuncha || '',
          bolim_bob: nomzod.bolim_bob || '',
          nega_kerak: nomzod.nega_kerak || '',
        });
      }
    }
  }

  // Path C → AI free recall (fetch from DB by raqam)
  for (const nomzod of step1cResult.nomzodlar) {
    const qonunKod = nomzod.qonun_kodi?.toUpperCase() || '';
    const raqamKey = normalizeModdaRaqam(nomzod.modda_raqami || '');
    if (!qonunKod || !raqamKey) continue;
    const key = `${qonunKod}::${raqamKey}`;
    if (!merged.has(key)) {
      const dbModda = await fetchModdaFromDB(qonunKod, nomzod.modda_raqami);
      if (dbModda) {
        merged.set(key, {
          modda: dbModda,
          qonun_kodi: qonunKod,
          manba: 'ai_raqam',
          kalit_sozlar: nomzod.kalit_sozlar || [],
          tushuncha: nomzod.tushuncha || '',
          bolim_bob: nomzod.bolim_bob || '',
          nega_kerak: nomzod.nega_kerak || '',
        });
      }
    }
  }

  const birlashtirilgan = Array.from(merged.values());

  return {
    birlashtirilgan,
    step0: step0Result,
    step1a: { moddalar: ftsResults.flatMap(r => r.moddalar), kalitSozlar: ftsResults[0]?.kalitSozlar || [] },
    step1b: step1bResult,
    step1c: step1cResult,
  };
}

// ─── STAGE 2: DEEP AI VERIFICATION ────────────────────────────────────────────
async function stage2_Tasdiqlash(
  kazusMatn: string,
  nomzodlar: BirlashtirilganNomzod[]
): Promise<{ tasdiqlanganlar: TasdiqlanganModda[]; model: string; tokens: any }> {
  if (nomzodlar.length === 0) {
    return { tasdiqlanganlar: [], model: '', tokens: { input: 0, output: 0 } };
  }

  const limitedNomzodlar = nomzodlar
    .sort((a, b) => {
      const manbaRank: Record<string, number> = { fts: 3, ai_sarlavha: 2, ai_raqam: 1 };
      return (manbaRank[b.manba] || 0) - (manbaRank[a.manba] || 0);
    })
    .slice(0, 30);

  const moddalarStr = limitedNomzodlar.map((n, i) => {
    const matnTolik = n.modda.matn.length > 600 ? n.modda.matn.slice(0, 600) + '...' : n.modda.matn;
    return `### Modda ${i + 1}: ${n.qonun_kodi} ${n.modda.modda_raqami}-modda
Sarlavha: ${n.modda.sarlavha}
Bob: ${n.modda.bob_nomi}
Matn: ${matnTolik}`;
  }).join('\n\n');

  const systemPrompt = `Siz huquq ekspertisiz. Quyida kazus matni va unga oid bo'lishi
mumkin bo'lgan qonun moddalari (to'liq matni bilan) berilgan. Kazus istalgan huquq
sohasidan bo'lishi mumkin.

Vazifangiz — har bir modda uchun kazusga RELEVANTLIK DARAJASINI 0 dan 10 gacha
ball bilan baholash.

QOIDALAR:
1. Har modda uchun:
   - indeks: modda tartib raqami (yuqoridagi "### Modda N" dan N)
   - ball: 0-10 (10 = kazusga to'liq mos, 0 = umuman tegishli emas)
   - asoslash: 1 gap — bu ball nega berilgani
2. Ball 6-10 = kuchli aloqador (bu moddalar tasdiqlanadi).
3. Ball 3-5 = qo'shimcha yoki qisman bog'liq bo'lishi mumkin, lekin asosiy emas
   (bu moddalar tasdiqlanmaydi).
4. Ball 0-2 = umuman aloqasi yo'q.
5. Modda matnini e'tiborli o'qing. Modda sarlavhasi emas, MATNI bo'yicha baholang.
6. Kazusda bir nechta huquqiy masala bo'lishi mumkin (masalan, asosiy javobgarlik
   normasi + protsessual norma + ishtirokchilik/muddat normasi) — har bir masalaga
   tegishli moddani alohida-alohida yuqori baholang, faqat bittasiga cheklanmang.
7. Javob QAT'IY JSON formatida bo'lsin.
8. DIQQAT: "indeks" maydoni — bu moddaning yuqoridagi ro'yxatdagi tartib raqami
   (1 dan boshlab). Modda raqamini yoki qonun kodini yozmang — faqat indeks.

JSON format:
{
  "baholar": [
    {
      "indeks": 1,
      "ball": 9,
      "asoslash": "<1 gap>"
    }
  ]
}

Kazus matni:
${kazusMatn}

Moddalar:
${moddalarStr}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: 'Baholashni boshlang. Har bir modda uchun ball bering. Faqat JSON qaytaring.' }],
    maxTokens: 5000,
    temperature: 0.2,
    jsonMode: true,
    functionName: 'case-research-stage2',
  });

  const parsed = extractJsonFromAI(text);
  const baholar: any[] = parsed?.baholar && Array.isArray(parsed.baholar) ? parsed.baholar : [];

  if (baholar.length === 0) {
    console.warn(`[case-research] Stage2 AI javob parse qilinmadi yoki bo'sh. text(500)=${text.slice(0, 500)}`);
  }

  // Indeks bo'yicha moslashtirish — modda raqami/kodi format farqlari muammosini chetlab o'tadi
  const bahoMap = new Map<number, { ball: number; asoslash: string }>();
  for (const b of baholar) {
    const idx = Number(b.indeks) || Number(b.index) || 0;
    if (idx >= 1 && idx <= limitedNomzodlar.length) {
      bahoMap.set(idx, { ball: Number(b.ball) || 0, asoslash: b.asoslash || '' });
    }
  }

  console.log(`[case-research] Stage2: ${baholar.length} ta baho, ${bahoMap.size} ta mos, ${limitedNomzodlar.length} ta nomzod`);

  const tasdiqlanganlar: TasdiqlanganModda[] = [];
  for (let i = 0; i < limitedNomzodlar.length; i++) {
    const baho = bahoMap.get(i + 1);
    const ball = baho?.ball ?? 0;
    if (ball >= 6) {
      const n = limitedNomzodlar[i];
      tasdiqlanganlar.push({
        modda: n.modda,
        qonun_kodi: n.qonun_kodi,
        ball,
        asoslash: baho?.asoslash || '',
        manba: n.manba,
        kalit_sozlar: n.kalit_sozlar,
        nega_kerak: n.nega_kerak,
      });
    }
  }

  tasdiqlanganlar.sort((a, b) => b.ball - a.ball);

  return {
    tasdiqlanganlar: tasdiqlanganlar.slice(0, 10),
    model: provider,
    tokens: { input: systemPrompt.length, output: text.length },
  };
}

// ─── STAGE 3: NAMUNAVIY JAVOB ─────────────────────────────────────────────────
async function stage3_NamunaviyJavob(
  kazusMatn: string,
  tasdiqlanganlar: TasdiqlanganModda[]
): Promise<{ javob: string; model: string; tokens: any }> {
  if (tasdiqlanganlar.length === 0) {
    const systemPrompt = `Siz huquq ekspertisiz. Berilgan kazus uchun umumiy huquqiy bilim asosida namunaviy javob bering. Hech qachon aniq modda raqamini keltirmang — "umumiy huquqiy bilim asosida" deb yozing. Javob 3-5 paragrafdan oshmasin. O'zbek tilida, professional huquqiy uslubda yozing.`;

    const { text, provider } = await callAIWithFallback({
      systemPrompt,
      messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
      maxTokens: 1500,
      temperature: 0.4,
      functionName: 'case-research-stage3-no-articles',
    });

    return { javob: text, model: provider, tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length } };
  }

  const moddalarStr = tasdiqlanganlar.map((t, i) => {
    const m = t.modda;
    return `### Modda ${i + 1}: ${t.qonun_kodi} ${m.modda_raqami}-modda (ball: ${t.ball}/10)
Sarlavha: ${m.sarlavha}
Bob: ${m.bob_nomi}
Matn: ${m.matn}
Asoslash: ${t.asoslash}`;
  }).join('\n\n');

  const systemPrompt = `Siz huquq ekspertisiz. Berilgan kazus uchun namunaviy javob shakllantiring.

QOIDALAR:
1. Faqat berilgan moddalarga tayaning. Boshqa modda raqamini o'ylab topmang.
2. Javobda qaysi moddalar qo'llanilganini, nega va xulosani yozing.
3. Har modda uchun uning kazusga qanday bog'liqligini aniq yozing.
4. Agar berilgan moddalar yetarli bo'lmasa, "bu masala bo'yicha aniq modda tasdiqlanmadi" deb ochiq ayting.
5. Javob 3-5 paragrafdan oshmasin.
6. O'zbek tilida, professional huquqiy uslubda yozing.

Tasdiqlangan moddalar (AI tomonidan baholangan):
${moddalarStr}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
    maxTokens: 1500,
    temperature: 0.4,
    functionName: 'case-research-stage3',
  });

  return { javob: text, model: provider, tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length } };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { caseId, action } = await req.json() as { caseId: string; action?: 'run' | 'status' };

    if (!caseId) {
      return new Response(JSON.stringify({ error: 'caseId majburiy' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: caseData, error: caseErr } = await supabaseAdmin
      .from('moot_court_cases')
      .select('id, sarlavha, tavsif, tadqiqot_holati, tasdiqlangan_moddalar, namunaviy_javob')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseData) {
      return new Response(JSON.stringify({ error: 'Kazus topilmadi' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      return new Response(JSON.stringify({
        holat: caseData.tadqiqot_holati || 'kutmoqda',
        tasdiqlangan_moddalar: caseData.tasdiqlangan_moddalar || [],
        namunaviy_javob: caseData.namunaviy_javob || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[case-research] Boshlandi: caseId=${caseId} sarlavha=${caseData.sarlavha}`);

    await supabaseAdmin
      .from('moot_court_cases')
      .update({ tadqiqot_holati: 'jarayonda', updated_at: new Date().toISOString() })
      .eq('id', caseId);

    const { data: jurnalRow } = await supabaseAdmin
      .from('qidiruv_jurnali')
      .insert({ case_id: caseId, case_sarlavha: caseData.sarlavha, holat: 'jarayonda' })
      .select().single();
    const jurnalId = jurnalRow?.id;

    try {
      const { data: qonunlarData } = await supabaseAdmin
        .from('qonunlar')
        .select('kod, nom')
        .order('kod');
      const barchaQonunlar = (qonunlarData || []).map((q: any) => ({ kod: q.kod, nom: q.nom }));

      if (barchaQonunlar.length === 0) {
        throw new Error('Bazada qonun yo\'q. Avval Lex.uz qidiruvchisidan qonun qo\'shing.');
      }

      // ── STAGE 1: Nomzodlarni birlashtirish (uch yo'l) ──
      console.log(`[case-research] Stage 1: Nomzod birlashtirish...`);
      const stage1 = await stage1_NomzodBirlashtirish(
        caseData.tavsif || '',
        barchaQonunlar
      );
      console.log(`[case-research] Stage 1 done: ${stage1.birlashtirilgan.length} ta nomzod (stage0 qonunlar: ${stage1.step0.qonunlar.join(', ')})`);

      if (stage1.birlashtirilgan.length === 0) {
        await supabaseAdmin.from('moot_court_cases')
          .update({ tadqiqot_holati: 'qisman', tasdiqlangan_moddalar: [], namunaviy_javob: null, updated_at: new Date().toISOString() })
          .eq('id', caseId);

        if (jurnalId) {
          await supabaseAdmin.from('qidiruv_jurnali')
            .update({ holat: 'qisman', step0_qonunlar: stage1.step0.qonunlar, step0_model: stage1.step0.model, step0_tokens: stage1.step0.tokens, updated_at: new Date().toISOString() })
            .eq('id', jurnalId);
        }

        return new Response(JSON.stringify({
          success: true, holat: 'qisman',
          message: 'AI hech qanday qonun nomzad bermadi.',
          stage0: { qonunlar: stage1.step0.qonunlar, model: stage1.step0.model },
          stage1: { birlashtirilgan: [], step1b: stage1.step1b, step1c: stage1.step1c },
          stage2: { tasdiqlanganlar: [] },
          stage3: { javob: null, model: null },
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── STAGE 2: Deep AI verification ──
      console.log(`[case-research] Stage 2: AI verification...`);
      const stage2 = await stage2_Tasdiqlash(caseData.tavsif || '', stage1.birlashtirilgan);
      console.log(`[case-research] Stage 2 done: ${stage2.tasdiqlanganlar.length} ta tasdiqlangan`);

      // ── STAGE 3: Namunaviy javob ──
      console.log(`[case-research] Stage 3: Namunaviy javob...`);
      const stage3 = await stage3_NamunaviyJavob(caseData.tavsif || '', stage2.tasdiqlanganlar);
      console.log(`[case-research] Stage 3 done: model=${stage3.model}`);

      // ── SAQLASH ──
      const tasdiqlanganJson = stage2.tasdiqlanganlar.map(t => ({
        qonun_kodi: t.qonun_kodi,
        modda_raqami: t.modda.modda_raqami,
        sarlavha: t.modda.sarlavha,
        bob_nomi: t.modda.bob_nomi,
        matn: t.modda.matn,
        lex_element_id: t.modda.lex_element_id,
        ball: t.ball,
        asoslash: t.asoslash,
        manba: t.manba,
        kalit_sozlar: t.kalit_sozlar,
        nega_kerak: t.nega_kerak,
      }));

      const holat = tasdiqlanganJson.length > 0 ? 'tayyor' : 'qisman';

      await supabaseAdmin.from('moot_court_cases')
        .update({
          tadqiqot_holati: holat,
          tasdiqlangan_moddalar: JSON.parse(JSON.stringify(tasdiqlanganJson)),
          namunaviy_javob: stage3.javob,
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseId);

      const manbaTarqatish: Record<string, number> = {};
      for (const t of stage2.tasdiqlanganlar) {
        manbaTarqatish[t.manba] = (manbaTarqatish[t.manba] || 0) + 1;
      }

      const jamiToken =
        (stage1.step0.tokens.input + stage1.step0.tokens.output) +
        (stage1.step1b.tokens.input + stage1.step1b.tokens.output) +
        (stage1.step1c.tokens.input + stage1.step1c.tokens.output) +
        (stage2.tokens.input + stage2.tokens.output) +
        (stage3.tokens.input + stage3.tokens.output);

      if (jurnalId) {
        await supabaseAdmin.from('qidiruv_jurnali')
          .update({
            holat,
            nomzodlar: JSON.parse(JSON.stringify(stage1.birlashtirilgan.map(n => ({
              qonun_kodi: n.qonun_kodi,
              modda_raqami: n.modda.modda_raqami,
              kalit_sozlar: n.kalit_sozlar,
              tushuncha: n.tushuncha,
              bolim_bob: n.bolim_bob,
              nega_kerak: n.nega_kerak,
              manba: n.manba,
            })))),
            tasdiqlangan_moddalar: JSON.parse(JSON.stringify(tasdiqlanganJson)),
            namunaviy_javob: stage3.javob,
            step0_qonunlar: stage1.step0.qonunlar,
            step0_model: stage1.step0.model,
            step0_tokens: stage1.step0.tokens,
            ai1_model: stage1.step1b.model,
            ai1_tokens: stage1.step1b.tokens,
            step2_model: stage2.model,
            step2_tokens: stage2.tokens,
            ai2_model: stage3.model,
            ai2_tokens: stage3.tokens,
            hukm_tarqatish: JSON.parse(JSON.stringify(manbaTarqatish)),
            jami_token: jamiToken,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jurnalId);
      }

      console.log(`[case-research] Tugadi: holat=${holat}, tasdiqlangan=${tasdiqlanganJson.length}`);

      return new Response(JSON.stringify({
        success: true, holat,
        stage0: { qonunlar: stage1.step0.qonunlar, model: stage1.step0.model },
        stage1: {
          birlashtirilgan_soni: stage1.birlashtirilgan.length,
          step1a: { moddalar_soni: stage1.step1a.moddalar.length, kalit_sozlar: stage1.step1a.kalitSozlar },
          step1b: { nomzodlar: stage1.step1b.nomzodlar, model: stage1.step1b.model },
          step1c: { nomzodlar: stage1.step1c.nomzodlar, model: stage1.step1c.model },
        },
        stage2: { tasdiqlanganlar: tasdiqlanganJson, model: stage2.model },
        stage3: { javob: stage3.javob, model: stage3.model },
        manba_tarqatish: manbaTarqatish,
        jami_token: jamiToken,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (innerErr) {
      console.error('[case-research] pipeline xato:', innerErr);
      const errMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);

      await supabaseAdmin.from('moot_court_cases')
        .update({ tadqiqot_holati: 'xato', updated_at: new Date().toISOString() })
        .eq('id', caseId);

      if (jurnalId) {
        await supabaseAdmin.from('qidiruv_jurnali')
          .update({ holat: 'xato', updated_at: new Date().toISOString() })
          .eq('id', jurnalId);
      }

      return new Response(JSON.stringify({ success: false, holat: 'xato', error: errMsg.slice(0, 300) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    console.error('[case-research] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg.slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
