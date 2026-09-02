import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;
const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';
const ONSPACE_AI_API_KEY = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Message { role: 'user' | 'model'; parts: { text: string }[]; }

interface StudentContext {
  ism?: string; familiya?: string; kurs?: string; guruh?: string; loginId?: string;
  totalXp?: number; currentLevel?: number; badges?: string[]; reytingOrni?: number;
  testNatijalari?: any[];
  kazusNatijalari?: any[];
  korilganMateriallar?: any[];
  zaifFanlar?: string[]; kuchliFantlar?: string[]; joriySahifa?: string;
  mavjudTestlar?: any[];
  mavjudKazuslar?: any[];
  mavjudMateriallar?: any[];
  savol_javob_bolimlar?: any[];
  rolUstoz?: boolean; ustozId?: string; ustozIsmi?: string;
}

interface CitationChunk {
  ref: number; id: string; material_id: string; bolim_id: string; bob_id: string;
  bolim_nomi: string; bob_nomi: string; material_nomi: string; chunk_index: number; matn: string;
}
interface CitationMeta {
  ref: number; material_id: string; bolim_id: string; bob_id: string;
  bolim_nomi: string; bob_nomi: string; material_nomi: string;
}

// ─── INTENT CLASSIFIER ────────────────────────────────────────────────────────
type Intent =
  | 'BILIM' | 'ANALITIKA' | 'ANALITIKA_AUTO'
  | 'YARATISH_TEST' | 'YARATISH_KAZUS' | 'YARATISH_MATERIAL'
  | 'STUDENT_PROFILE' | 'SHAXSIY' | 'UMUMIY' | 'QIDIRUV';

function detectIntent(text: string, isUstoz: boolean, prevMessages: Message[]): Intent {
  if (isUstoz) {
    if (/test\s*(yaratmoqchi|yarataman|yasayman|qo[''']shmoqchi)|word.*test|yangi\s*test|test\s*yaratish|test.*tuzmoqchi|test.*qo[''']shmoqchi/i.test(text)) return 'YARATISH_TEST';
    if (/kazus\s*(yaratmoqchi|yarataman|qo[''']shing|joylashtir|qo[''']shmoqchi|tuzmoqchi)|yangi\s*kazus|kazusni?\s*saytga|saytga.*kazus/i.test(text)) return 'YARATISH_KAZUS';
    if (/o[''']quv\s*material|material\s*(yukla|qo[''']sh|joyla)|dars\s*mater|ma[''']ruza.*yukla|konspekt.*yukla/i.test(text)) return 'YARATISH_MATERIAL';
  }

  if (isUstoz && /\b(ning|ning\s*natija|natijasi|holati|o['']quvchi|talaba|student)\b/i.test(text)
    && /\b(qanday|ko['']rsat|ayt|tahlil|qandoq|nima|natija|foiz|ball)\b/i.test(text)) {
    return 'STUDENT_PROFILE';
  }

  if (isUstoz && (
    /analiz|analitika|tahlil|statistika|stat/i.test(text) ||
    /ko['']p\s*xato|past\s*natija|yaxshi\s*natija|o['']rtacha\s*ball|o['']rtacha\s*foiz/i.test(text) ||
    /qaysi\s*(test|kazus|savol|material)|necha\s*(kishi|talaba|o['']quvchi)/i.test(text) ||
    /ishtirokchilar|ko['']rilgan|ommabop|mashhur|zaif|qiyin\s*savol/i.test(text) ||
    /material.*necha|necha.*ko['']r|ko['']rilish|o['']quvchim|testlarim|kazuslarim|materialarim/i.test(text) ||
    /rivojlan|yaxshilan|nimaga|nega\s*past|foiz\s*past|past\s*foiz|natija\s*past/i.test(text) ||
    /kimlar.*past|past.*kimlar|kuchsiz.*o['']quvchi|o['']quvchi.*kuchsiz|faol\s*o['']quvchi/i.test(text) ||
    /menga\s*(tahlil|hisobot|natija|statistika)|kurs.*holat|holat.*kurs|darslarim|o['']quvchilarim/i.test(text) ||
    /eng\s*(yaxshi|past|zo['']r|kuchli|yuqori|alochi|past|zaif)/i.test(text) ||
    /kim\s*(o['']tdi|yiqildi|a['']lo|besh|uch|ikki|bir|yaxshi|yomon)/i.test(text) ||
    /reyting|top\s*\d|eng\s*ko['']p|hammadan/i.test(text)
  )) {
    return 'ANALITIKA';
  }

  if (isUstoz && /\b(top|topi?|ko[''']rsat|olib\s*kel|qayerda|qanday|ochib\s*ber|ko[''']rmoqchi|izlayap|izlayotir|bor[''']mu|bormi|qidiraq|qidiray)\b/i.test(text)) {
    return 'QIDIRUV';
  }

  if (/mening\s+(natija|xato|ball|foiz|test|kazus|roi?m|profil|hisobim)|natijalarim|testlarim|kazuslarim|baholarim|darajam|reyting(imda)?/i.test(text)) return 'SHAXSIY';

  if (/kodeks|qonun|modda|jinoyat|javobgarlik|huquq|sud|prokuratura|tergov|shartnoma|nizom|dekret|farmon|tartib|jarayon|protsess/i.test(text)) return 'BILIM';

  if (prevMessages.length >= 2 && text.trim().length < 80) {
    const lastModel = [...prevMessages].reverse().find(m => m.role === 'model');
    if (lastModel?.parts[0]?.text?.match(/\[1\]|\[2\]|\[3\]/)) return 'BILIM';
  }

  return 'UMUMIY';
}

// ─── XAVFSIZLIK FILTRLARI ─────────────────────────────────────────────────────
function isHaramSavol(text: string): boolean {
  return /\b(din|islom|xristian|yahudiy|budda|namoz|ro['']za|haj|qur['']on|injil|tavrot|siyosat|prezident|partiya|saylov|terrorchi|bomb[aа]|qurol|g['']ayriqonuniy|narkotik|giyohvand|pora\s*berish\s*usul|jinoyat\s*qilish\s*usul)\b/i.test(text);
}
function isShaxsiyMalumotSorovi(text: string): boolean {
  return /\b(telefon|tel|raqam|phone|parol|password|login.*parol|access.*token|api.*key|secret|shaxsiy.*ma.lumot|passport|id.*raqam|pinfl|inn\b)\b/i.test(text)
    && /\b(ber|ko.rsat|ayt|top|bil|yoz|nima|qanday|qancha)\b/i.test(text);
}
function hasUstozLeak(text: string, isUstoz: boolean): boolean {
  if (isUstoz) return false;
  return /\b(ustoz.*telefon|ustoz.*raqam|ustoz.*parol|o.qituvchi.*raqam|teacher.*phone|ustoz.*manzil|ustoz.*email|ustoz.*login)\b/i.test(text);
}

// ─── ONSPACE AI ───────────────────────────────────────────────────────────────
// Custom error class to carry HTTP status code
class AiHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function callOnSpaceAI(model: string, systemPrompt: string, messages: Message[], maxTokens = 2000): Promise<string> {
  if (!ONSPACE_AI_BASE_URL || !ONSPACE_AI_API_KEY) throw new AiHttpError('OnSpace AI sozlanmagan.', 503);
  const formatted = messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts.map(p => p.text).join('\n') }));
  const res = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ONSPACE_AI_API_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...formatted], max_tokens: maxTokens, temperature: 0.4, stream: false }),
  });
  const txt = await res.text();
  if (!res.ok) {
    if (res.status === 402) {
      throw new AiHttpError('AI Mentor vaqtincha ishlamayapti. Iltimos, keyinroq urinib ko\'ring.', 402);
    }
    throw new AiHttpError(`OnSpace AI [${res.status}]: ${txt.slice(0, 200)}`, res.status);
  }
  const data = JSON.parse(txt);
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new AiHttpError("OnSpace AI bo'sh javob qaytardi", 502);
  return reply;
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
async function loadConfig() {
  const { data } = await supabaseAdmin.from('settings').select('key,text_value,value')
    .in('key', ['AI_MENTOR_MODEL', 'AI_MENTOR_FAOL', 'AI_MENTOR_SYSTEM_INSTRUCTION']);
  const map: Record<string, any> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.key === 'AI_MENTOR_FAOL' ? (r.value ?? true) : (r.text_value || ''); });
  return {
    model: map['AI_MENTOR_MODEL'] || 'google/gemini-3-flash-preview',
    faol: map['AI_MENTOR_FAOL'] ?? true,
    customInstruction: map['AI_MENTOR_SYSTEM_INSTRUCTION'] || '',
  };
}

// ─── KESH ─────────────────────────────────────────────────────────────────────
async function hashText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.trim().toLowerCase().slice(0, 200)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
async function keshOlish(hash: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.from('ai_cache').select('javob_matn,updated_at').eq('savol_hash', hash).maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.updated_at).getTime() > CACHE_TTL_MS) return null;
    return data.javob_matn;
  } catch { return null; }
}
async function keshSaqlash(hash: string, savol: string, javob: string, model: string) {
  try {
    await supabaseAdmin.from('ai_cache').upsert(
      { savol_hash: hash, savol_matn: savol.slice(0, 500), javob_matn: javob, model, ishlatilgan: 1, updated_at: new Date().toISOString() },
      { onConflict: 'savol_hash' }
    );
  } catch {}
}

// ─── KASUAL SAVOL TEKSHIRUVI (RAG ishlatmaslik uchun) ────────────────────────
function isKasualSavol(text: string): boolean {
  const t = text.trim().toLowerCase();
  // Salomlashish, kirishma suhbat, o'zi haqida savol
  if (/^(salom|assalom|assalomu|aloha|hi\b|hello|privet|xayr|ko['']rishamiz|yaxshi(mi|siz|misan)?|qandaysan|qanday yashay|o['']zing haqingda|sen kim|siz kim|nimalarni bilasan|nima qila olasan|nima deysan|nima gap|rahmat|tashakkur|\bmayli\b|tushunarli|ajoyib|zo['']r\b|barakalla|mashallah|kim yaratdi|kim siz|kim bo['']l)/i.test(t)) return true;
  // Juda qisqa savol va huquqiy so'z yo'q bo'lsa
  const huquqiySozlar = /qonun|modda|kodeks|huquq|jinoyat|shartnoma|prokuratura|tergov|advokat|sud|jarayon|tartib|nizom|tomonlar|majburiyat|mas['']uliyat|javobgarlik|fuqaro|davlat|organ|idora|talqin|norma|qoida/i;
  if (t.split(/\s+/).length <= 3 && !huquqiySozlar.test(t)) return true;
  return false;
}

// ─── QUERY EXPANSION (LLM orqali kalit so'zlar va sinonimlar) ───────────────────
async function expandQuery(savol: string, model: string): Promise<string[]> {
  const EXPAND_SYSTEM = `Siz o'zbek tilida huquq sohasidagi kalit so'z ajratuvchisiz.
Foydalanuvchi savolidan MAKSIMUM 8 ta eng muhim kalit so'z/iborani ajrat.
Ularga ularning o'zak shakllari, sinonimlar va kelishiksiz variantlarini qo'sh.
FAQAT kalit so'zlar ro'yxatini qaytarning — vergul bilan ajratilgan bitta qatorda.
Misol kirish: "Advokatlar qayerda ishlaydi?"
Misol chiqish: advokat,advokatlik,himoyachi,yurish,faoliyat,ish,joyi,firma`;
  try {
    const res = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ONSPACE_AI_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: EXPAND_SYSTEM },
          { role: 'user', content: savol.slice(0, 300) },
        ],
        max_tokens: 120,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content || '';
    const terms = raw
      .split(/[,\n]+/)
      .map((t: string) => t.trim().toLowerCase().replace(/[^\w'\s]/g, '').trim())
      .filter((t: string) => t.length > 1)
      .slice(0, 10);
    console.log(`[expandQuery] input="${savol.slice(0,50)}" → terms=[${terms.join(', ')}]`);
    return terms;
  } catch (e) {
    console.warn('[expandQuery] xato:', e);
    return [];
  }
}

// ─── O'ZBEK SO'Z O'ZAKLARINI AJRATISH (Suffix Stripping) ───────────────────
function uzbekStem(word: string): string {
  const w = word.toLowerCase();
  // Uzunroqdan qisqaga tartibda qo'shimchalarni kesish
  const suffixes = [
    'larning','laridan','lariga','larini','lardan','larga','larni',
    'ining','idan','idan','idagi','imiz','ingiz','ining','ingni',
    'larni','lardan','larga','lar',
    'ning','ndan','ndan','dagi','dagi','imda','inda',
    'dan','dan','dagi','lik','chi','cha','gina','dir',
    'ga','ni','da','gi','si','mi','di','sa','lar'
  ];
  for (const suf of suffixes) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      return w.slice(0, w.length - suf.length);
    }
  }
  return w;
}

// ─── CITATION SEARCH (Fuzzy ILIKE + O'zak kesish + Fallback FTS) ─────────────
async function citationSearch(savol: string, maxChunks = 7, model?: string): Promise<CitationChunk[]> {
  const stop = new Set(['va','yoki','bu','u','men','sen','biz','siz','nima','qanday','qaysi','kim','haqida','uchun','bilan','ning','ga','da','dan','ni','ham','ammo','lekin','chunki','agar','bir','ham','edi','bor','yo','yo\'q','kerak']);

  // 1. Tokenizatsiya + o'zak kesish
  const rawWords = savol.toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w));

  const stemmedWords = rawWords.map(uzbekStem).filter(s => s.length >= 3);
  const baseKeywords = [...new Set([...rawWords, ...stemmedWords])].slice(0, 10);

  // 2. LLM orqali kengaytirish
  let expandedTerms: string[] = [];
  if (model && baseKeywords.length > 0) {
    expandedTerms = await expandQuery(savol, model);
    // Expanded terminlarni ham stem qilib qo'shish
    const stemmedExpanded = expandedTerms.map(uzbekStem).filter(s => s.length >= 3);
    expandedTerms = [...new Set([...expandedTerms, ...stemmedExpanded])];
  }

  const finalTerms = [...new Set([...baseKeywords, ...expandedTerms])].slice(0, 16);
  if (!finalTerms.length) return [];

  console.log(`[citationSearch] top_k=${maxChunks} FINAL terms=[${finalTerms.join(', ')}]`);

  // 3. ASOSIY: YUMSHOQ ILIKE OR qidiruvi (har bir so'z uchun alohida OR)
  // Supabase `.or()` metodi vergul bilan ajratilgan shartlarni qabul qiladi
  const ilikeConditions = finalTerms.slice(0, 12).map(t => `matn.ilike.%${t}%`).join(',');

  const { data: ilikeData, error: ilikeErr } = await supabaseAdmin
    .from('om_chunks')
    .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn')
    .or(ilikeConditions)
    .limit(maxChunks + 6);

  if (!ilikeErr && ilikeData?.length) {
    console.log(`[citationSearch] ✅ ILIKE topdi: ${ilikeData.length} ta chunk`);
    // Relevantlik bo'yicha saralash: ko'p kalit so'z mos kelganini yuqoriga chiqarish
    const scored = (ilikeData as any[]).map(c => {
      const matn = (c.matn || '').toLowerCase();
      const score = finalTerms.reduce((s, t) => s + (matn.includes(t) ? 1 : 0), 0);
      return { ...c, _score: score };
    }).sort((a, b) => b._score - a._score);
    return scored.slice(0, maxChunks).map((c: any, i: number) => {
      const { _score, ...rest } = c;
      return { ref: i + 1, ...rest } as CitationChunk;
    });
  }

  console.log(`[citationSearch] ⚠️ ILIKE noaniq, FTS urinish...`);

  // 4. FALLBACK: PostgreSQL FTS (simple config, OR)
  const tsQuery = finalTerms.slice(0, 8).join(' | ');
  const { data: ftsData, error: ftsErr } = await supabaseAdmin
    .from('om_chunks')
    .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn')
    .textSearch('matn', tsQuery, { config: 'simple', type: 'plain' })
    .limit(maxChunks + 4);

  if (!ftsErr && ftsData?.length) {
    console.log(`[citationSearch] ✅ FTS topdi: ${ftsData.length} ta chunk`);
    return ftsData.slice(0, maxChunks).map((c: any, i: number) => ({ ref: i + 1, ...c })) as CitationChunk[];
  }

  // 5. OXIRGI FALLBACK: Eng qisqa o'zak so'zlar bilan kengroq qidiruv
  const shortTerms = finalTerms.filter(t => t.length >= 4).slice(0, 5);
  if (shortTerms.length) {
    const shortCond = shortTerms.map(t => `matn.ilike.%${t}%`).join(',');
    const { data: shortData } = await supabaseAdmin
      .from('om_chunks')
      .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn')
      .or(shortCond)
      .limit(maxChunks);
    if (shortData?.length) {
      console.log(`[citationSearch] ✅ Qisqa o'zak qidiruv: ${shortData.length} ta chunk`);
      return shortData.map((c: any, i: number) => ({ ref: i + 1, ...c })) as CitationChunk[];
    }
  }

  console.log(`[citationSearch] ❌ Hech narsa topilmadi. savol="${savol.slice(0, 60)}"`);
  return [];
}
function buildCitationBlok(chunks: CitationChunk[]): string {
  if (!chunks.length) return '';
  let b = '\n## 📖 DARSLIK MAZMUNI\nQOIDA: Har bir gap oxiriga [N] qo\'y. Matnni QAYTA YOZMA — qisqa xulosa+[N].\n\n';
  chunks.forEach(c => {
    b += `### [${c.ref}] ${c.bolim_nomi} › ${c.bob_nomi} › ${c.material_nomi}\n`;
    b += c.matn.slice(0, 350) + (c.matn.length > 350 ? '…' : '') + '\n\n';
  });
  return b;
}

// ─── KENG ANALITIKA: BARCHA MA'LUMOTLAR (USTOZ UCHUN) ─────────────────────────
async function fetchFullUstozData(ustozId: string): Promise<any> {
  try {
    // 1. Barcha testlar — bu ustozga tegishli
    const { data: testlar } = await supabaseAdmin.from('testlar')
      .select('id,kod,test_nomi,savollar,vaqt_daqiqa,is_active,ommaviy,narx,timer_turi,show_correct_answers,allow_retake,created_at')
      .eq('ustoz_id', ustozId).order('created_at', { ascending: false }).limit(50);

    // 2. Barcha toplamlar (kazuslar)
    const { data: toplamlar } = await supabaseAdmin.from('toplamlar')
      .select('id,kod,mavzu,kazuslar,vaqt_daqiqa,is_active,ommaviy,narx,copy_paste_ruxsat,allow_retake,model_tur,created_at')
      .eq('ustoz_id', ustozId).order('created_at', { ascending: false }).limit(50);

    // 3. Barcha o'quv materiallar bo'limlari
    const { data: bolimlar } = await supabaseAdmin.from('om_bolimlar')
      .select('id,nomi,faol,tavsif,tartib,admin_bloklangan,created_at')
      .eq('ustoz_id', ustozId).order('tartib', { ascending: true }).limit(30);

    const bolimIds = (bolimlar || []).map((b: any) => b.id);
    const testKodlar = (testlar || []).map((t: any) => t.kod);
    const toplamKodlar = (toplamlar || []).map((t: any) => t.kod);

    // 4. Test javoblari — batafsil
    const { data: testJavoblar } = testKodlar.length
      ? await supabaseAdmin.from('test_javoblar')
        .select('id,test_kod,oquvchi_ismi,foiz,togri_soni,xato_soni,javob_berilmagan,javoblar,sarflangan_vaqt,created_at')
        .in('test_kod', testKodlar).order('created_at', { ascending: false }).limit(500)
      : { data: [] };

    // 5. Kazus javoblari — batafsil
    const { data: kazusJavoblar } = toplamKodlar.length
      ? await supabaseAdmin.from('javoblar')
        .select('id,toplam_kod,oquvchi_ismi,javoblar,baho,created_at')
        .in('toplam_kod', toplamKodlar).order('created_at', { ascending: false }).limit(500)
      : { data: [] };

    // 6. Material korishlar
    const { data: materialKorishlar } = bolimIds.length
      ? await supabaseAdmin.from('om_korishlar')
        .select('bolim_id,oquvchi_ismi,created_at')
        .in('bolim_id', bolimIds).order('created_at', { ascending: false }).limit(1000)
      : { data: [] };

    // 7. Boblar va materiallar soni
    const { data: boblar } = bolimIds.length
      ? await supabaseAdmin.from('om_boblar').select('id,bolim_id,nomi,tartib').in('bolim_id', bolimIds)
      : { data: [] };
    const { data: matlar } = bolimIds.length
      ? await supabaseAdmin.from('om_materiallar').select('id,bob_id,bolim_id,nomi,fayl_tur,fayl_hajm,created_at').in('bolim_id', bolimIds).limit(200)
      : { data: [] };

    // 8. Online o'quvchilar (joriy)
    const beshDaqiqa = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: onlineOquvchilar } = await supabaseAdmin.from('online_presence')
      .select('oquvchi_ism,oquvchi_familiya,kurs,guruh,last_seen').gte('last_seen', beshDaqiqa).limit(50);

    // 9. Bildirishnomalar (oxirgi 20 ta)
    const { data: bildirishnomalar } = await supabaseAdmin.from('bildirishnomalar')
      .select('sarlavha,matn,tur,oqildi,created_at')
      .order('created_at', { ascending: false }).limit(20);

    // ─── TESTLAR TAHLILI ───────────────────────────────────────────────────
    const tj = testJavoblar || [];
    const testJavMap: Record<string, any[]> = {};
    tj.forEach((j: any) => {
      if (!testJavMap[j.test_kod]) testJavMap[j.test_kod] = [];
      testJavMap[j.test_kod].push(j);
    });

    const testlarTahlil = (testlar || []).map((test: any) => {
      const javoblar = testJavMap[test.kod] || [];
      if (!javoblar.length) return { ...test, javoblar_soni: 0, ortacha_foiz: 0, xato_savollar: [], past_oquvchilar: [], alochi_oquvchilar: [] };

      const foizlar = javoblar.map((j: any) => j.foiz || 0);
      const ortachaFoiz = Math.round(foizlar.reduce((a: number, b: number) => a + b, 0) / foizlar.length);
      const savollar = test.savollar || [];
      const xatoMap: Record<number, { soni: number; oquvchilar: string[] }> = {};

      for (const j of javoblar) {
        if (!Array.isArray(j.javoblar)) continue;
        for (const jav of j.javoblar as any[]) {
          const idx = jav.savol_index !== undefined ? jav.savol_index : jav.index;
          if (idx === undefined) continue;
          const sv = savollar[idx]; if (!sv) continue;
          const togri = sv.togriJavob !== undefined ? sv.togriJavob : sv.correctAnswer;
          const berilgan = jav.javob !== undefined ? jav.javob : jav.answer;
          if (berilgan === undefined || berilgan === -1 || berilgan !== togri) {
            if (!xatoMap[idx]) xatoMap[idx] = { soni: 0, oquvchilar: [] };
            xatoMap[idx].soni++;
            if (j.oquvchi_ismi && xatoMap[idx].oquvchilar.length < 8) xatoMap[idx].oquvchilar.push(j.oquvchi_ismi);
          }
        }
      }

      const xato_savollar = Object.entries(xatoMap).map(([idx, { soni, oquvchilar }]) => ({
        savol: savollar[Number(idx)]?.savol?.slice(0, 100) || `Savol ${Number(idx) + 1}`,
        savol_index: Number(idx) + 1,
        xata_soni: soni,
        foiz: Math.round((soni / javoblar.length) * 100),
        oquvchilar,
      })).sort((a, b) => b.xata_soni - a.xata_soni).slice(0, 8);

      const past_oquvchilar = javoblar.filter((j: any) => j.foiz < 50)
        .sort((a: any, b: any) => a.foiz - b.foiz)
        .map((j: any) => ({ ism: j.oquvchi_ismi, foiz: j.foiz })).slice(0, 10);

      const alochi_oquvchilar = javoblar.filter((j: any) => j.foiz >= 85)
        .sort((a: any, b: any) => b.foiz - a.foiz)
        .map((j: any) => ({ ism: j.oquvchi_ismi, foiz: j.foiz })).slice(0, 10);

      // Har bir o'quvchi natijalari ro'yxati
      const barcha_oquvchilar = javoblar
        .sort((a: any, b: any) => b.foiz - a.foiz)
        .map((j: any) => ({ ism: j.oquvchi_ismi, foiz: j.foiz || 0, togri: j.togri_soni || 0, xato: j.xato_soni || 0 }));

      return {
        test_nomi: test.test_nomi, test_kod: test.kod,
        savol_soni: savollar.length, javoblar_soni: javoblar.length,
        ortacha_foiz: ortachaFoiz, xato_savollar,
        past_oquvchilar, alochi_oquvchilar, barcha_oquvchilar,
        is_active: test.is_active, ommaviy: test.ommaviy, narx: test.narx,
        created_at: test.created_at,
      };
    });

    // ─── KAZUSLAR TAHLILI ───────────────────────────────────────────────────
    const kj = kazusJavoblar || [];
    const kazusJavMap: Record<string, any[]> = {};
    kj.forEach((j: any) => {
      if (!kazusJavMap[j.toplam_kod]) kazusJavMap[j.toplam_kod] = [];
      kazusJavMap[j.toplam_kod].push(j);
    });

    const toplamlarTahlil = (toplamlar || []).map((toplam: any) => {
      const javoblar = kazusJavMap[toplam.kod] || [];
      if (!javoblar.length) return { ...toplam, javoblar_soni: 0, ortacha_foiz: 0, kazuslar_tahlil: [] };

      let ub = 0, um = 0;
      const kazusBallMap: Record<number, { sum: number; count: number; yetishmayotganlar: string[]; past_oquvchilar: { ism: string; ball: number }[] }> = {};

      for (const j of javoblar) {
        const baho = Array.isArray(j.baho) ? j.baho : [];
        ub += baho.reduce((s: number, b: any) => s + (b.ball || 0), 0);
        um += baho.length * 30;
        for (const b of baho) {
          const idx = b.kazus_index ?? 0;
          if (!kazusBallMap[idx]) kazusBallMap[idx] = { sum: 0, count: 0, yetishmayotganlar: [], past_oquvchilar: [] };
          kazusBallMap[idx].sum += (b.ball || 0);
          kazusBallMap[idx].count++;
          if ((b.ball || 0) < 15 && j.oquvchi_ismi && kazusBallMap[idx].past_oquvchilar.length < 8) {
            kazusBallMap[idx].past_oquvchilar.push({ ism: j.oquvchi_ismi, ball: b.ball || 0 });
          }
          const yet = b.batafsil_tahlil?.yetishmayotganlar || [];
          yet.forEach((el: string) => {
            const k = el.replace(/"/g, '').trim().slice(0, 60);
            if (k && kazusBallMap[idx].yetishmayotganlar.length < 10 && !kazusBallMap[idx].yetishmayotganlar.includes(k)) {
              kazusBallMap[idx].yetishmayotganlar.push(k);
            }
          });
        }
      }

      const kazuslar_tahlil = Object.entries(kazusBallMap).map(([idx, { sum, count, yetishmayotganlar, past_oquvchilar }]) => ({
        kazus_index: Number(idx) + 1,
        ortacha_ball: Math.round(sum / count),
        ortacha_foiz: Math.round((sum / count / 30) * 100),
        ishtirokchi: count, yetishmayotganlar, past_oquvchilar,
      })).sort((a, b) => a.ortacha_foiz - b.ortacha_foiz);

      // Barcha o'quvchilar natijalari
      const barcha_oquvchilar = javoblar.map((j: any) => {
        const baho = Array.isArray(j.baho) ? j.baho : [];
        const jami = baho.reduce((s: number, b: any) => s + (b.ball || 0), 0);
        const maks = baho.length * 30;
        return { ism: j.oquvchi_ismi, ball: jami, maksimal: maks, foiz: maks > 0 ? Math.round((jami / maks) * 100) : 0 };
      }).sort((a: any, b: any) => b.foiz - a.foiz);

      const past_oquvchilar_umumiy = barcha_oquvchilar.filter((o: any) => o.foiz < 50).slice(0, 10);
      const alochi_oquvchilar = barcha_oquvchilar.filter((o: any) => o.foiz >= 85).slice(0, 10);

      return {
        mavzu: toplam.mavzu || toplam.kod, toplam_kod: toplam.kod,
        kazus_soni: (toplam.kazuslar || []).length,
        javoblar_soni: javoblar.length,
        ortacha_foiz: um > 0 ? Math.round((ub / um) * 100) : 0,
        kazuslar_tahlil, past_oquvchilar: past_oquvchilar_umumiy,
        alochi_oquvchilar, barcha_oquvchilar,
        is_active: toplam.is_active, ommaviy: toplam.ommaviy, narx: toplam.narx,
        created_at: toplam.created_at,
      };
    });

    // ─── MATERIALLAR TAHLILI ───────────────────────────────────────────────
    const korishMap: Record<string, { soni: number; oquvchilar: string[] }> = {};
    (materialKorishlar || []).forEach((k: any) => {
      if (!korishMap[k.bolim_id]) korishMap[k.bolim_id] = { soni: 0, oquvchilar: [] };
      korishMap[k.bolim_id].soni++;
      if (k.oquvchi_ismi && korishMap[k.bolim_id].oquvchilar.length < 20) {
        if (!korishMap[k.bolim_id].oquvchilar.includes(k.oquvchi_ismi)) {
          korishMap[k.bolim_id].oquvchilar.push(k.oquvchi_ismi);
        }
      }
    });

    const bobMap: Record<string, number> = {};
    (boblar || []).forEach((b: any) => { bobMap[b.bolim_id] = (bobMap[b.bolim_id] || 0) + 1; });

    const matCountMap: Record<string, number> = {};
    (matlar || []).forEach((m: any) => { matCountMap[m.bolim_id] = (matCountMap[m.bolim_id] || 0) + 1; });

    const materiallarTahlil = (bolimlar || []).map((b: any) => ({
      bolim_id: b.id, bolim_nomi: b.nomi, faol: b.faol,
      bob_soni: bobMap[b.id] || 0, material_soni: matCountMap[b.id] || 0,
      korish_soni: korishMap[b.id]?.soni || 0,
      korilgan_oquvchilar: korishMap[b.id]?.oquvchilar || [],
    })).sort((a: any, b: any) => b.korish_soni - a.korish_soni);

    // ─── UMUMIY SUMMARY ────────────────────────────────────────────────────
    const jami_test_javoblar = tj.length;
    const jami_kazus_javoblar = kj.length;
    const jami_korishlar = (materialKorishlar || []).length;

    const test_ortacha = testlarTahlil.filter(t => t.javoblar_soni > 0);
    const test_umumiy_ortacha = test_ortacha.length > 0
      ? Math.round(test_ortacha.reduce((s, t) => s + t.ortacha_foiz, 0) / test_ortacha.length)
      : 0;

    const kazus_ortacha = toplamlarTahlil.filter((t: any) => t.javoblar_soni > 0);
    const kazus_umumiy_ortacha = kazus_ortacha.length > 0
      ? Math.round(kazus_ortacha.reduce((s: number, t: any) => s + t.ortacha_foiz, 0) / kazus_ortacha.length)
      : 0;

    // Barcha o'quvchilar ro'yxati (test natijalaridan)
    const barcha_oquvchilar_set: Record<string, { testSoni: number; foizlar: number[]; kazusSoni: number; materialSoni: number }> = {};
    tj.forEach((j: any) => {
      if (!j.oquvchi_ismi) return;
      if (!barcha_oquvchilar_set[j.oquvchi_ismi]) barcha_oquvchilar_set[j.oquvchi_ismi] = { testSoni: 0, foizlar: [], kazusSoni: 0, materialSoni: 0 };
      barcha_oquvchilar_set[j.oquvchi_ismi].testSoni++;
      barcha_oquvchilar_set[j.oquvchi_ismi].foizlar.push(j.foiz || 0);
    });
    kj.forEach((j: any) => {
      if (!j.oquvchi_ismi) return;
      if (!barcha_oquvchilar_set[j.oquvchi_ismi]) barcha_oquvchilar_set[j.oquvchi_ismi] = { testSoni: 0, foizlar: [], kazusSoni: 0, materialSoni: 0 };
      barcha_oquvchilar_set[j.oquvchi_ismi].kazusSoni++;
    });
    (materialKorishlar || []).forEach((k: any) => {
      if (!k.oquvchi_ismi) return;
      if (!barcha_oquvchilar_set[k.oquvchi_ismi]) barcha_oquvchilar_set[k.oquvchi_ismi] = { testSoni: 0, foizlar: [], kazusSoni: 0, materialSoni: 0 };
      barcha_oquvchilar_set[k.oquvchi_ismi].materialSoni++;
    });

    const barcha_oquvchilar = Object.entries(barcha_oquvchilar_set).map(([ism, d]) => ({
      ism,
      testSoni: d.testSoni,
      kazusSoni: d.kazusSoni,
      materialSoni: d.materialSoni,
      avgFoiz: d.foizlar.length > 0 ? Math.round(d.foizlar.reduce((a, b) => a + b, 0) / d.foizlar.length) : 0,
    })).sort((a, b) => b.avgFoiz - a.avgFoiz);

    return {
      // Asosiy ma'lumotlar
      testlar: testlarTahlil,
      toplamlar: toplamlarTahlil,
      materiallar: materiallarTahlil,

      // O'quvchilar
      barcha_oquvchilar,
      online_oquvchilar: onlineOquvchilar || [],

      // Summary
      summary: {
        jami_test: testlarTahlil.length,
        jami_toplam: toplamlarTahlil.length,
        jami_bolim: materiallarTahlil.length,
        faol_bolim: materiallarTahlil.filter((m: any) => m.faol).length,
        jami_test_javoblar,
        jami_kazus_javoblar,
        jami_korishlar,
        test_umumiy_ortacha,
        kazus_umumiy_ortacha,
        jami_oquvchilar: barcha_oquvchilar.length,
        eng_yaxshi_test: testlarTahlil.sort((a, b) => b.ortacha_foiz - a.ortacha_foiz)[0]?.test_nomi || '—',
        eng_qiyin_test: testlarTahlil.filter(t => t.javoblar_soni > 0).sort((a, b) => a.ortacha_foiz - b.ortacha_foiz)[0]?.test_nomi || '—',
        eng_ommabop_material: materiallarTahlil[0]?.bolim_nomi || '—',
        online_soni: (onlineOquvchilar || []).length,
      },
    };
  } catch (e) {
    console.error('[fetchFullUstozData]', e);
    return { testlar: [], toplamlar: [], materiallar: [], barcha_oquvchilar: [], online_oquvchilar: [], summary: null };
  }
}

// ─── MATERIAL ANALYTICS (UI uchun) ────────────────────────────────────────────
async function fetchMaterialAnalytics(ustozId: string | undefined, allowAll = false): Promise<any> {
  try {
    let bquery: any = supabaseAdmin.from('om_bolimlar').select('id,nomi,faol,tartib,created_at').order('tartib', { ascending: true });
    if (!allowAll && ustozId) bquery = bquery.eq('ustoz_id', ustozId);
    const { data: bolimlar } = await bquery;
    if (!bolimlar?.length) return { materiallar: [], summary: null };
    const bolimIds = bolimlar.map((b: any) => b.id);

    const [korishRes, bobRes, matRes] = await Promise.all([
      supabaseAdmin.from('om_korishlar').select('bolim_id, oquvchi_ismi, created_at').in('bolim_id', bolimIds),
      supabaseAdmin.from('om_boblar').select('bolim_id').in('bolim_id', bolimIds),
      supabaseAdmin.from('om_materiallar').select('bolim_id, nomi, fayl_tur').in('bolim_id', bolimIds),
    ]);

    const korishAll = korishRes.data || [];
    const korishMap: Record<string, { soni: number; oquvchilar: string[] }> = {};
    korishAll.forEach((k: any) => {
      if (!korishMap[k.bolim_id]) korishMap[k.bolim_id] = { soni: 0, oquvchilar: [] };
      korishMap[k.bolim_id].soni++;
      if (k.oquvchi_ismi && !korishMap[k.bolim_id].oquvchilar.includes(k.oquvchi_ismi)) {
        korishMap[k.bolim_id].oquvchilar.push(k.oquvchi_ismi);
      }
    });

    const bobMap: Record<string, number> = {};
    (bobRes.data || []).forEach((b: any) => { bobMap[b.bolim_id] = (bobMap[b.bolim_id] || 0) + 1; });

    const matCountMap: Record<string, number> = {};
    (matRes.data || []).forEach((m: any) => { matCountMap[m.bolim_id] = (matCountMap[m.bolim_id] || 0) + 1; });

    const trendMap: Record<string, number> = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      trendMap[d.toISOString().split('T')[0]] = 0;
    }
    korishAll.forEach((k: any) => {
      const day = k.created_at?.split('T')[0];
      if (day && trendMap[day] !== undefined) trendMap[day]++;
    });
    const trendData = Object.entries(trendMap).map(([sana, soni]) => ({ sana: sana.slice(5), soni }));

    const result = bolimlar.map((b: any) => ({
      bolim_nomi: b.nomi, bolim_id: b.id, faol: b.faol,
      bob_soni: bobMap[b.id] || 0,
      material_soni: matCountMap[b.id] || 0,
      korish_soni: korishMap[b.id]?.soni || 0,
      korilgan_oquvchilar: korishMap[b.id]?.oquvchilar || [],
    })).sort((a: any, b: any) => b.korish_soni - a.korish_soni);

    const jami_korishlar = result.reduce((s: number, m: any) => s + m.korish_soni, 0);
    const eng_ommabop = result[0];

    const summary = {
      jami_bolim: result.length,
      faol_bolim: result.filter((m: any) => m.faol).length,
      nofaol_bolim: result.filter((m: any) => !m.faol).length,
      jami_korishlar,
      ortacha_korish: result.length > 0 ? Math.round(jami_korishlar / result.length) : 0,
      eng_ommabop: eng_ommabop?.bolim_nomi || '—',
      eng_ommabop_soni: eng_ommabop?.korish_soni || 0,
      trendData,
    };
    return { materiallar: result, summary };
  } catch (e) { console.error('[fetchMaterialAnalytics]', e); return { materiallar: [], summary: null }; }
}

async function fetchAnalyticsData(ustozId: string | undefined, analyticsType: 'testlar' | 'kazuslar' | 'materiallar', allowAll = false): Promise<any> {
  if (analyticsType === 'materiallar') return await fetchMaterialAnalytics(ustozId, allowAll);

  try {
    if (analyticsType === 'testlar') {
      let query: any = supabaseAdmin.from('testlar').select('id,kod,test_nomi,savollar').order('created_at', { ascending: false }).limit(20);
      if (!allowAll && ustozId) query = query.eq('ustoz_id', ustozId);
      const { data: testlar } = await query;
      if (!testlar?.length) return { testlar: [], summary: null };
      const testKodlar = testlar.map((t: any) => t.kod);
      const { data: javoblar } = await supabaseAdmin.from('test_javoblar').select('test_kod,foiz,togri_soni,xato_soni,oquvchi_ismi,javoblar').in('test_kod', testKodlar);
      const result = testlar.map((test: any) => {
        const tj = (javoblar || []).filter((j: any) => j.test_kod === test.kod);
        if (!tj.length) return null;
        const ortachaFoiz = Math.round(tj.reduce((s: number, j: any) => s + (j.foiz || 0), 0) / tj.length);
        const savollar: any[] = test.savollar || [];
        const xatoMap: Record<number, { soni: number; oquvchilar: string[] }> = {};
        for (const j of tj) {
          if (!Array.isArray(j.javoblar)) continue;
          for (const jav of j.javoblar as any[]) {
            const idx = jav.savol_index !== undefined ? jav.savol_index : jav.index;
            if (idx === undefined) continue;
            const sv = savollar[idx]; if (!sv) continue;
            const togri = sv.togriJavob !== undefined ? sv.togriJavob : sv.correctAnswer;
            const berilgan = jav.javob !== undefined ? jav.javob : jav.answer;
            if (berilgan === undefined || berilgan === -1 || berilgan !== togri) {
              if (!xatoMap[idx]) xatoMap[idx] = { soni: 0, oquvchilar: [] };
              xatoMap[idx].soni++;
              if (j.oquvchi_ismi && xatoMap[idx].oquvchilar.length < 5) xatoMap[idx].oquvchilar.push(j.oquvchi_ismi);
            }
          }
        }
        const xato_savollar = Object.entries(xatoMap).map(([idx, { soni, oquvchilar }]) => ({
          savol: savollar[Number(idx)]?.savol?.slice(0, 90) || `Savol ${Number(idx) + 1}`,
          savol_index: Number(idx) + 1, xata_soni: soni,
          foiz: Math.round((soni / tj.length) * 100), oquvchilar,
        })).sort((a, b) => b.xata_soni - a.xata_soni).slice(0, 5);
        const past_oquvchilar = tj.filter((j: any) => j.foiz < 50).map((j: any) => j.oquvchi_ismi).filter(Boolean).slice(0, 8);
        return {
          test_nomi: test.test_nomi, test_kod: test.kod,
          savol_soni: savollar.length, javoblar_soni: tj.length,
          ortacha_foiz: ortachaFoiz, xato_savollar, past_oquvchilar,
        };
      }).filter(Boolean);
      const summary = result.length ? {
        jami_test: result.length,
        jami_ishtirokchi: result.reduce((s: number, t: any) => s + t.javoblar_soni, 0),
        umumiy_ortacha: Math.round(result.reduce((s: number, t: any) => s + t.ortacha_foiz, 0) / result.length),
      } : null;
      return { testlar: result, summary };
    }

    if (analyticsType === 'kazuslar') {
      let kquery: any = supabaseAdmin.from('toplamlar').select('id,kod,mavzu,kazuslar').order('created_at', { ascending: false }).limit(20);
      if (!allowAll && ustozId) kquery = kquery.eq('ustoz_id', ustozId);
      const { data: toplamlar } = await kquery;
      if (!toplamlar?.length) return { toplamlar: [], summary: null };
      const toplamKodlar = toplamlar.map((t: any) => t.kod);
      const { data: javoblar } = await supabaseAdmin.from('javoblar').select('toplam_kod,baho,oquvchi_ismi').in('toplam_kod', toplamKodlar);
      const result = toplamlar.map((toplam: any) => {
        const tj = (javoblar || []).filter((j: any) => j.toplam_kod === toplam.kod);
        if (!tj.length) return null;
        let ub = 0, um = 0;
        const kazusBallMap: Record<number, { sum: number; count: number; yetishmayotganlar: string[]; past_oquvchilar: string[] }> = {};
        for (const j of tj) {
          const baho = Array.isArray(j.baho) ? j.baho : [];
          ub += baho.reduce((s: number, b: any) => s + (b.ball || 0), 0);
          um += baho.length * 30;
          for (const b of baho) {
            const idx = b.kazus_index ?? 0;
            if (!kazusBallMap[idx]) kazusBallMap[idx] = { sum: 0, count: 0, yetishmayotganlar: [], past_oquvchilar: [] };
            kazusBallMap[idx].sum += (b.ball || 0); kazusBallMap[idx].count++;
            if ((b.ball || 0) < 15 && j.oquvchi_ismi && kazusBallMap[idx].past_oquvchilar.length < 5) {
              kazusBallMap[idx].past_oquvchilar.push(j.oquvchi_ismi);
            }
            const yet = b.batafsil_tahlil?.yetishmayotganlar || [];
            yet.forEach((el: string) => {
              const k = el.replace(/"/g, '').trim().slice(0, 50);
              if (k && kazusBallMap[idx].yetishmayotganlar.length < 10 && !kazusBallMap[idx].yetishmayotganlar.includes(k)) {
                kazusBallMap[idx].yetishmayotganlar.push(k);
              }
            });
          }
        }
        const kazuslar_tahlil = Object.entries(kazusBallMap).map(([idx, { sum, count, yetishmayotganlar, past_oquvchilar }]) => ({
          kazus_index: Number(idx) + 1, ortacha_ball: Math.round(sum / count),
          ortacha_foiz: Math.round((sum / count / 30) * 100), ishtirokchi: count,
          yetishmayotganlar, past_oquvchilar,
        })).sort((a, b) => a.ortacha_foiz - b.ortacha_foiz);
        return {
          mavzu: toplam.mavzu || toplam.kod, toplam_kod: toplam.kod,
          kazus_soni: (toplam.kazuslar || []).length, javoblar_soni: tj.length,
          ortacha_foiz: um > 0 ? Math.round((ub / um) * 100) : 0, kazuslar_tahlil,
        };
      }).filter(Boolean);
      const summary = result.length ? {
        jami_toplam: result.length,
        jami_ishtirokchi: result.reduce((s: number, t: any) => s + t.javoblar_soni, 0),
        umumiy_ortacha: Math.round(result.reduce((s: number, t: any) => s + t.ortacha_foiz, 0) / result.length),
      } : null;
      return { toplamlar: result, summary };
    }
  } catch (e) { console.error('[analytics]', e); }
  return {};
}

// ─── O'ZBEK KELISHIK QO'SHIMCHALARINI TOZALASH ───────────────────────────────
function tozalaKelshik(so_z: string): string {
  return so_z
    .replace(/ning\b/gi, '').replace(/larning\b/gi, '').replace(/larni\b/gi, '')
    .replace(/lardan\b/gi, '').replace(/larga\b/gi, '').replace(/lar\b/gi, '')
    .replace(/ndan\b/gi, '').replace(/\bni\b/gi, '').replace(/\bga\b/gi, '')
    .replace(/\bda\b/gi, '').replace(/\bdan\b/gi, '').trim();
}

function ajratIsm(matn: string): string[] {
  const stopSozlar = new Set([
    'ning', 'natijasi', 'natijalarini', 'holati', 'holatini', 'qanday', 'ko\'rsat', 'ayt', 'tahlil',
    'qandoq', 'nima', 'natija', 'foiz', 'ball', 'o\'quvchi', 'talaba', 'student', 'haqida', 'uchun',
    'bilan', 'menga', 'ber', 'ko\'r', 'qil', 'bu', 'shu', 'u', 'va', 'yoki', 'ham',
  ]);
  const tozaMatn = matn.replace(/[?!.,]/g, ' ').toLowerCase();
  const so_zlar = tozaMatn.split(/\s+/).filter(w => w.length > 2);
  const ismKandidatlar: string[] = [];
  for (const so_z of so_zlar) {
    const toza = tozalaKelshik(so_z);
    if (toza.length > 2 && !stopSozlar.has(so_z) && !stopSozlar.has(toza)) {
      ismKandidatlar.push(toza);
    }
  }
  return ismKandidatlar.slice(0, 3);
}

// ─── STUDENT PROFILE FETCH ────────────────────────────────────────────────────
async function fetchStudentProfile(oquvchiIsmi: string, ustozId: string): Promise<any> {
  try {
    const [tjRes, kjRes, krRes] = await Promise.all([
      supabaseAdmin.from('test_javoblar').select('test_kod,foiz,togri_soni,xato_soni,javoblar,created_at').eq('oquvchi_ismi', oquvchiIsmi).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('javoblar').select('toplam_kod,baho,created_at').eq('oquvchi_ismi', oquvchiIsmi).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('om_korishlar').select('bolim_id,created_at').eq('oquvchi_ismi', oquvchiIsmi).order('created_at', { ascending: false }).limit(15),
    ]);

    const testJavoblar = tjRes.data || [];
    const kazusJavoblar = kjRes.data || [];
    const korishlar = krRes.data || [];

    const testKodlar = [...new Set(testJavoblar.map((j: any) => j.test_kod))] as string[];
    const { data: testlar } = testKodlar.length
      ? await supabaseAdmin.from('testlar').select('kod,test_nomi,savollar').in('kod', testKodlar)
      : { data: [] };
    const testMap: Record<string, any> = {};
    (testlar || []).forEach((t: any) => { testMap[t.kod] = t; });

    const toplamKodlar = [...new Set(kazusJavoblar.map((j: any) => j.toplam_kod))] as string[];
    const { data: toplamlar } = toplamKodlar.length
      ? await supabaseAdmin.from('toplamlar').select('kod,mavzu').in('kod', toplamKodlar)
      : { data: [] };
    const toplamMap: Record<string, any> = {};
    (toplamlar || []).forEach((t: any) => { toplamMap[t.kod] = t; });

    const bolimIds = korishlar.map((k: any) => k.bolim_id);
    const { data: bolimlar } = bolimIds.length
      ? await supabaseAdmin.from('om_bolimlar').select('id,nomi').in('id', bolimIds)
      : { data: [] };
    const bolimMap: Record<string, string> = {};
    (bolimlar || []).forEach((b: any) => { bolimMap[b.id] = b.nomi; });

    const testXulosa = testJavoblar.map((j: any) => {
      const test = testMap[j.test_kod];
      const savollar = test?.savollar || [];
      const xatoSavollar: string[] = [];
      if (Array.isArray(j.javoblar) && savollar.length) {
        (j.javoblar as any[]).forEach((jav: any) => {
          const idx = jav.savol_index !== undefined ? jav.savol_index : jav.index;
          if (idx === undefined) return;
          const sv = savollar[idx]; if (!sv) return;
          const togri = sv.togriJavob !== undefined ? sv.togriJavob : sv.correctAnswer;
          const berilgan = jav.javob !== undefined ? jav.javob : jav.answer;
          if (berilgan === undefined || berilgan === -1 || berilgan !== togri) {
            if (sv.savol) xatoSavollar.push(sv.savol.slice(0, 60));
          }
        });
      }
      return {
        testNomi: test?.test_nomi || j.test_kod, foiz: j.foiz || 0,
        togriSoni: j.togri_soni || 0, xatoSoni: j.xato_soni || 0,
        xatoSavollar: xatoSavollar.slice(0, 4),
        sana: j.created_at ? new Date(j.created_at).toLocaleDateString('uz-UZ') : '',
      };
    });

    const kazusXulosa = kazusJavoblar.map((j: any) => {
      const baho = Array.isArray(j.baho) ? j.baho : [];
      const jami = baho.reduce((s: number, b: any) => s + (b.ball || 0), 0);
      const maks = baho.length * 30;
      const yet: string[] = [];
      baho.forEach((b: any) => {
        (b.batafsil_tahlil?.yetishmayotganlar || []).forEach((el: string) => {
          const k = el.replace(/"/g, '').trim().slice(0, 50);
          if (k && !yet.includes(k)) yet.push(k);
        });
      });
      return {
        mavzu: toplamMap[j.toplam_kod]?.mavzu || j.toplam_kod,
        ball: jami, maksimalBall: maks,
        foiz: maks > 0 ? Math.round((jami / maks) * 100) : 0,
        yetishmayotganlar: yet.slice(0, 5),
        sana: j.created_at ? new Date(j.created_at).toLocaleDateString('uz-UZ') : '',
      };
    });

    const materialTarixi = korishlar.map((k: any) => ({
      bolimNomi: bolimMap[k.bolim_id] || "Noma'lum",
      sana: k.created_at ? new Date(k.created_at).toLocaleDateString('uz-UZ') : '',
    }));

    const avgFoiz = testJavoblar.length > 0
      ? Math.round(testJavoblar.reduce((s: number, j: any) => s + (j.foiz || 0), 0) / testJavoblar.length)
      : 0;

    return {
      ism: oquvchiIsmi, avgFoiz,
      testSoni: testJavoblar.length, kazusSoni: kazusJavoblar.length, materialSoni: korishlar.length,
      testXulosa, kazusXulosa, materialTarixi,
    };
  } catch (e) { console.error('[fetchStudentProfile]', e); return null; }
}

// ─── GLOBAL QIDIRUV ───────────────────────────────────────────────────────────
async function globalSearch(query: string) {
  const stop = new Set(['va','yoki','bu','u','men','sen','biz','siz','nima','qanday','qaysi','kim','uchun','bilan','ning','ga','da','dan','ni']);
  const kw = query.toLowerCase().replace(/[^\w\s']/g,' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w)).slice(0, 5);
  if (!kw.length) return { testlar: [], kazuslar: [], materiallar: [], topildi: false };
  try {
    const [tRes, kRes, mRes] = await Promise.all([
      supabaseAdmin.from('testlar').select('kod,test_nomi,is_active').or(kw.map(k => `test_nomi.ilike.%${k}%`).join(',')).limit(4),
      supabaseAdmin.from('toplamlar').select('kod,mavzu,is_active').or(kw.map(k => `mavzu.ilike.%${k}%`).join(',')).limit(4),
      supabaseAdmin.from('om_materiallar').select('id,nomi,bolim_id').or(kw.map(k => `nomi.ilike.%${k}%`).join(',')).limit(5),
    ]);
    const bolimIds = [...new Set((mRes.data || []).map((m: any) => m.bolim_id))];
    let bMap: Record<string, string> = {};
    if (bolimIds.length) {
      const { data: bols } = await supabaseAdmin.from('om_bolimlar').select('id,nomi').in('id', bolimIds);
      (bols || []).forEach((b: any) => { bMap[b.id] = b.nomi; });
    }
    return {
      testlar: (tRes.data || []).map((t: any) => ({ kod: t.kod, nomi: t.test_nomi, faol: t.is_active })),
      kazuslar: (kRes.data || []).map((k: any) => ({ kod: k.kod, mavzu: k.mavzu || k.kod, faol: k.is_active })),
      materiallar: (mRes.data || []).map((m: any) => ({ id: m.id, nomi: m.nomi, bolim_nomi: bMap[m.bolim_id] || '' })),
      topildi: !!(tRes.data?.length || kRes.data?.length || mRes.data?.length),
    };
  } catch { return { testlar: [], kazuslar: [], materiallar: [], topildi: false }; }
}

// ─── NAV SYNTAX ───────────────────────────────────────────────────────────────
const NAV_SYNTAX = `
## NAVIGATSIYA SINTAKSIS (faqat shu formatlar)
[[NAV:tab|matn]] | [[TEST:kod|nom]] | [[KAZUS:kod|nom]] | [[MATERIAL:uuid|nom]]
Tablar: mavjud_testlar | mavjud_kazuslar | sinov | oqmatlar | savol_javob | natijalar | profil | yordam`;

const NO_NAV_RULE = `
## QAT'IY QOIDA
- HECH QACHON "bu sahifaga o'ting", "kabinetga kiring" dema
- Faqat ustoz ANIQ bir elementni izlasa — [[TEST/KAZUS/MATERIAL]] tugma ko'rsat
- Barcha ma'lumotlarni chat ichida ko'rsat`;

const SAYT_FUNKSIYALARI = `
## SAYT FUNKSIYALARI
- Testlar kabineti (tab:testlar) — test YARATISH va boshqarish
- Ustoz kabineti (tab:ustoz) — KAZUS yaratish va umumiy boshqaruv
- O'quv materiallari (tab:oqmatlar) — material yuklash/boshqarish
- Analitika — test/kazus/material statistikasi`;

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────

// ASOSIY USTOZ TIZIM KO'RSATMASI (kuchaytirilgan)
const USTOZ_ASOSIY_SYSTEM = `Siz FanFaster huquq ta'lim platformasidagi "AI Mentor" — Pedagogik Analitika Ekspertisiz. Foydalanuvchingiz faqat USTOZLARDIR.

## ASOSIY QOIDALAR
- MANTIQIY ANALITIKA: Berilgan to'liq JSON bazasi asosida ustozning har qanday murakkab savoliga (masalan: "har bir testdan 1 ta eng alochisini top", "kutilmagan reytinglar", "eng faol talabalar") ma'lumotlarni filtrlab, aniq hisoblab javob ber.
- VIZUALIZATSIYA: Quruq matn yozma. Markdown jadvallari, foizli indikatorlar va holat emojilari bilan ko'rsat.
- XAVFSIZLIK: O'quvchilarning ism-familiyalarini ustozdan aslo yashirma, to'liq ko'rsat. Faqat TELEFON RAQAMLARI va PAROLLARINI ko'rsatish taqiqlanadi — o'rniga [YASHIRILGAN] deb yoz.
- Ma'lumot chala bo'lsa xato berma, borini tahlil qilib, kerakli tugmalarni pastda ko'rsat.

## JAVOB FORMATI (3-BLOK TIZIMI)
📈 **1-BLOK: UMUMIY HOLAT**
Jadval yoki ro'yxat ko'rinishida kim necha foiz oldi, qaysi testlar topshirildi.

🎯 **2-BLOK: BILIMDAGI BO'SHLIQLAR**
Talabalar aynan qaysi mavzuda eng ko'p xato qilganini tahlil qiling.

💡 **3-BLOK: PEDAGOGIK TAVSIYA**
1-2 ta konkret tavsiya. Masalan: "Keyingi darsning dastlabki 15 daqiqasini ushbu mavzuga bag'ishlang."

## FOIZ INDIKATORLARI
85%+ → 🟢 A'lo | 70-84% → 🔵 Yaxshi | 50-69% → ⚠️ O'rtacha | 50% dan past → 🔴 Past

## JADVAL FORMATLASH
Ma'lumotlarni guruhlashda va solishtirishda DOIMO standart Markdown jadvallaridan foydalaning:
| Ustun 1 | Ustun 2 | Ustun 3 |
|---------|---------|----------|
| Ma'lumot | Ma'lumot | Ma'lumot |
Jadvallar TOZA va TUSHUNARLI bo'lsin — har bir satr ajratilgan, ustunlar hizalangan.

## NAVIGATSIYA TUGMALARI
Faqat ustoz yangi narsa yaratmoqchi bo'lganda:
[[NAV:mavjud_testlar|Yangi Test Yaratish]] yoki [[NAV:oqmatlar|Yangi Material Yuklash]]
BOSHQA HOLATLARDA TUGMA QO'YMA!`;

function bilimSystemPrompt(customInst: string, citBlok: string, srBlok: string): string {
  return `${customInst || "Siz FanFaster huquq ta'lim platformasining AI Mentori."}
## BILIM REJIMI
1. FAQAT berilgan darslik mazmunidan javob ber
2. Har bir gap oxiriga [N] qo'y
3. Materialda javob yo'q bo'lsa: "Bu ma'lumot darsliklarimizda topilmadi [0]."
4. MAX 5 gap
## TAQIQLAR
- Din, siyosat, shaxsiy ma'lumot berma
${NO_NAV_RULE}${NAV_SYNTAX}
${citBlok}${srBlok}`;
}

function umumiySystemPrompt(customInst: string, studentBlok: string, kontentBlok: string, srBlok: string): string {
  return `${customInst || "Siz FanFaster huquq ta'lim platformasining AI Mentori."}
## JAVOB USLUBI
- O'zbek tili, "Siz" murojaat, qisqa (3-5 gap)
- Topilgan elementni tugma sifatida ko'rsat, yo'naltirma
## TAQIQLAR
- Telefon, parol, shaxsiy ma'lumot, sayt kodi berma
${NO_NAV_RULE}${NAV_SYNTAX}
${SAYT_FUNKSIYALARI}
${studentBlok}${kontentBlok}${srBlok}`;
}

function qidiruvSystemPrompt(customInst: string, qBlok: string): string {
  return `${customInst || "Siz FanFaster huquq ta'lim platformasining AI Mentori."}
## QIDIRUV REJIMI
- Topilgan natijalarni TUGMA sifatida ko'rsat
- "[Nom] topildi:" so'ng tugma
- Topilmasa: "[Nom] bo'yicha hech narsa topilmadi."
${NO_NAV_RULE}${NAV_SYNTAX}
${qBlok}`;
}

// KUCHAYTIRILGAN PEDAGOGIK ANALITIKA EKSPERT PROMPT
function analitikDuolingoPrompt(customInst: string, dataBlok: string): string {
  return `${customInst || USTOZ_ASOSIY_SYSTEM}

## MA'LUMOTLAR BAZASI
${dataBlok}

## INSTRUKSIYA
Ustozning savoliga BEVOSITA 3-blokli formatda javob ber:

📈 **1-BLOK: UMUMIY HOLAT (STATUS)**
MAJBURIY Markdown jadval formatidan foydalaning:
| O'quvchi | Test foizi | Kazus ball | Ko'rgan material |
|----------|-----------|------------|------------------|
| ... | ... | ... | ... |

🎯 **2-BLOK: BILIMDAGI BO'SHLIQLAR (SKILL GAPS)**
Talabalar aynan qaysi savol/mavzuda xato qilmoqda — ANIQ, ismli ro'yxat.

💡 **3-BLOK: PEDAGOGIK INTERVENTION**
Keyingi darsda nima qilish kerak — 1-2 KONKRET tavsiya.

## QAT'IY QOIDALAR
- FAQAT haqiqiy ma'lumotlar — o'zingizdan raqam to'qima
- Agar ma'lumot yo'q: "Hali [tur] bo'yicha ma'lumot yo'q." de
- Muhim raqamlar va ismlar **qalin** yozilsin
- Foiz indikatorlari: 🟢 85%+ | 🔵 70-84% | ⚠️ 50-69% | 🔴 50%-

## NAVIGATSIYA (faqat yaratishda)
[[NAV:mavjud_testlar|Yangi Test Yaratish]] | [[NAV:oqmatlar|Yangi Material Yuklash]]
${NAV_SYNTAX}`;
}

function studentProfilePrompt(customInst: string, profileBlok: string): string {
  return `${customInst || USTOZ_ASOSIY_SYSTEM}

## O'QUVCHI PROFIL TAHLILI

${profileBlok}

## FORMAT
Ushbu o'quvchi uchun 3-blokli tahlil yoz:

📊 **1-BLOK: NATIJALAR JADVALI**
| Test/Kazus | Natija | Holat |
format bilan.

🎯 **2-BLOK: ZAIF TOMONLAR**
Qaysi mavzuda, qaysi savolda xato ko'p.

💡 **3-BLOK: METODIK TAKLIF**
Bu o'quvchi uchun keyingi darsda nima qilish kerak.

## QOIDALAR
- FAQAT haqiqiy ma'lumotlar | Muhim narsalar **qalin**
- HECH QACHON telefon, parol ko'rsatma ([YASHIRILGAN] yoz)
- Agar bazada topilmasa: "Ma'lumotlar bazasida bunday o'quvchi topilmadi."
${NO_NAV_RULE}${NAV_SYNTAX}`;
}

// ─── DATA → MATN BLOKLARI ─────────────────────────────────────────────────────
function buildFullUstozDataBlok(data: any, ustozIsmi: string): string {
  let b = `\n## 📊 TO'LIQ USTOZ MA'LUMOTLAR BAZASI — ${ustozIsmi || 'Ustoz'}\n\n`;

  const s = data.summary;
  if (s) {
    b += `### UMUMIY XULOSA\n`;
    b += `- Testlar: **${s.jami_test}** ta | Javoblar: **${s.jami_test_javoblar}** | O'rtacha: **${s.test_umumiy_ortacha}%**\n`;
    b += `- Kazuslar: **${s.jami_toplam}** ta | Javoblar: **${s.jami_kazus_javoblar}** | O'rtacha: **${s.kazus_umumiy_ortacha}%**\n`;
    b += `- Materiallar: **${s.jami_bolim}** bo'lim (${s.faol_bolim} faol) | Ko'rishlar: **${s.jami_korishlar}**\n`;
    b += `- Jami o'quvchilar: **${s.jami_oquvchilar}** ta\n`;
    if (s.online_soni > 0) b += `- Hozir online: **${s.online_soni}** ta o'quvchi 🟢\n`;
    b += '\n';
  }

  // Testlar
  const testlar = data.testlar || [];
  if (testlar.length) {
    b += `### 📝 TESTLAR (${testlar.length} ta)\n`;
    testlar.forEach((t: any) => {
      if (!t.javoblar_soni) return;
      const signal = t.ortacha_foiz >= 85 ? '🟢' : t.ortacha_foiz >= 70 ? '🔵' : t.ortacha_foiz >= 50 ? '⚠️' : '🔴';
      b += `\n**${t.test_nomi}** (kod: ${t.test_kod}) ${signal} ${t.ortacha_foiz}% | ${t.javoblar_soni} ishtirokchi\n`;

      if (t.alochi_oquvchilar?.length) {
        b += `  🏆 A'lochi (1-chi): **${t.alochi_oquvchilar[0].ism}** — ${t.alochi_oquvchilar[0].foiz}%\n`;
        if (t.alochi_oquvchilar.length > 1) b += `  Top-3: ${t.alochi_oquvchilar.slice(0,3).map((o: any) => `${o.ism} (${o.foiz}%)`).join(', ')}\n`;
      }
      if (t.past_oquvchilar?.length) {
        b += `  ⚠️ 50%dan past (${t.past_oquvchilar.length}ta): ${t.past_oquvchilar.slice(0,5).map((o: any) => `${o.ism} (${o.foiz}%)`).join(', ')}\n`;
      }
      if (t.xato_savollar?.length) {
        t.xato_savollar.slice(0,3).forEach((x: any) => {
          const oq = x.oquvchilar?.length ? ` (${x.oquvchilar.slice(0,3).join(', ')})` : '';
          b += `  ❌ Savol ${x.savol_index}: "${x.savol.slice(0,80)}" — **${x.foiz}%** xato${oq}\n`;
        });
      }
      // Barcha o'quvchilar (top 5)
      if (t.barcha_oquvchilar?.length) {
        b += `  Barcha o'quvchilar natijasi: ${t.barcha_oquvchilar.slice(0,8).map((o: any) => `${o.ism}:${o.foiz}%`).join(', ')}\n`;
      }
    });
    b += '\n';
  }

  // Kazuslar
  const toplamlar = data.toplamlar || [];
  if (toplamlar.length) {
    b += `### 📋 KAZUSLAR (${toplamlar.length} ta)\n`;
    toplamlar.forEach((t: any) => {
      if (!t.javoblar_soni) return;
      const signal = t.ortacha_foiz >= 85 ? '🟢' : t.ortacha_foiz >= 70 ? '🔵' : t.ortacha_foiz >= 50 ? '⚠️' : '🔴';
      b += `\n**${t.mavzu}** (kod: ${t.toplam_kod}) ${signal} ${t.ortacha_foiz}% | ${t.javoblar_soni} javob\n`;

      if (t.alochi_oquvchilar?.length) {
        b += `  🏆 Eng yaxshi: **${t.alochi_oquvchilar[0].ism}** — ${t.alochi_oquvchilar[0].foiz}% (${t.alochi_oquvchilar[0].ball}/${t.alochi_oquvchilar[0].maksimal})\n`;
      }
      if (t.past_oquvchilar?.length) {
        b += `  ⚠️ Past natijali: ${t.past_oquvchilar.slice(0,5).map((o: any) => `${o.ism} (${o.foiz}%)`).join(', ')}\n`;
      }
      if (t.kazuslar_tahlil?.length) {
        t.kazuslar_tahlil.slice(0,3).forEach((k: any) => {
          b += `  📋 Kazus ${k.kazus_index}: **${k.ortacha_foiz}%** avg\n`;
          if (k.yetishmayotganlar?.length) b += `     ❗ E'tiborsiz: ${k.yetishmayotganlar.slice(0,3).join(', ')}\n`;
          if (k.past_oquvchilar?.length) b += `     👤 Past: ${k.past_oquvchilar.slice(0,3).map((o: any) => `${o.ism} (${o.ball}ball)`).join(', ')}\n`;
        });
      }
      if (t.barcha_oquvchilar?.length) {
        b += `  Barcha: ${t.barcha_oquvchilar.slice(0,8).map((o: any) => `${o.ism}:${o.foiz}%`).join(', ')}\n`;
      }
    });
    b += '\n';
  }

  // Materiallar
  const materiallar = data.materiallar || [];
  if (materiallar.length) {
    b += `### 📚 MATERIALLAR (${materiallar.length} ta)\n`;
    materiallar.forEach((m: any) => {
      const signal = m.korish_soni >= 10 ? '🔥' : m.korish_soni >= 5 ? '🟢' : m.korish_soni > 0 ? '⚠️' : '⚪';
      b += `**${m.bolim_nomi}** ${signal} ${m.korish_soni} ko'rish ${m.faol ? '(faol)' : '(yashirin)'}\n`;
      if (m.korilgan_oquvchilar?.length) {
        b += `  👥 Ko'rganlar: ${m.korilgan_oquvchilar.slice(0,6).join(', ')}\n`;
      }
    });
    b += '\n';
  }

  // Online o'quvchilar
  const onlinelar = data.online_oquvchilar || [];
  if (onlinelar.length) {
    b += `### 🟢 HOZIR ONLINE (${onlinelar.length} ta)\n`;
    onlinelar.slice(0, 10).forEach((o: any) => {
      b += `• ${o.oquvchi_ism} ${o.oquvchi_familiya} — ${o.guruh || ''}\n`;
    });
    b += '\n';
  }

  return b;
}

function buildAnalitikDataBlok(type: string, data: any, ustozIsmi: string): string {
  let b = `\n## 📊 ${type.toUpperCase()} ANALITIKA — ${ustozIsmi || 'Ustoz'}\n\n`;

  if (type === 'testlar') {
    const testlar = data?.testlar || [];
    if (!testlar.length) return b + '📭 Hali test javoblari yo\'q.\n';
    const s = data.summary;
    if (s) b += `**Xulosa:** ${s.jami_test} ta test | Jami ${s.jami_ishtirokchi} ishtirokchi | O'rtacha ${s.umumiy_ortacha}%\n\n`;
    testlar.slice(0, 12).forEach((t: any) => {
      b += `**${t.test_nomi}** — ${t.javoblar_soni} ishtirokchi, o'rtacha **${t.ortacha_foiz}%**\n`;
      if (t.xato_savollar?.length) {
        t.xato_savollar.slice(0, 3).forEach((x: any) => {
          const oq = x.oquvchilar?.length ? ` (${x.oquvchilar.slice(0, 3).join(', ')})` : '';
          b += `  ❌ Savol ${x.savol_index}: "${x.savol}" — **${x.foiz}%** xato${oq}\n`;
        });
      }
      if (t.past_oquvchilar?.length) {
        b += `  ⚠️ 50% dan past (${t.past_oquvchilar.length} ta): ${t.past_oquvchilar.slice(0, 4).join(', ')}\n`;
      }
    });
    const past = testlar.filter((t: any) => t.ortacha_foiz < 50);
    const yaxshi = testlar.filter((t: any) => t.ortacha_foiz >= 80);
    if (past.length) b += `\n🔴 **Past natijali**: ${past.map((t: any) => t.test_nomi).join(', ')}\n`;
    if (yaxshi.length) b += `✅ **A'lo natijali**: ${yaxshi.map((t: any) => t.test_nomi).join(', ')}\n`;
  }

  if (type === 'kazuslar') {
    const toplamlar = data?.toplamlar || [];
    if (!toplamlar.length) return b + '📭 Hali kazus javoblari yo\'q.\n';
    const s = data.summary;
    if (s) b += `**Xulosa:** ${s.jami_toplam} ta kazus | Jami ${s.jami_ishtirokchi} ishtirokchi | O'rtacha ${s.umumiy_ortacha}%\n\n`;
    toplamlar.slice(0, 10).forEach((t: any) => {
      b += `**${t.mavzu}** — ${t.javoblar_soni} javob, o'rtacha **${t.ortacha_foiz}%**\n`;
      if (t.kazuslar_tahlil?.length) {
        t.kazuslar_tahlil.slice(0, 3).forEach((k: any) => {
          b += `  📋 Kazus ${k.kazus_index}: **${k.ortacha_foiz}%** (${k.ishtirokchi} kishi)\n`;
          if (k.yetishmayotganlar?.length) b += `     ❗ E'tiborsiz qolgan: ${k.yetishmayotganlar.slice(0, 3).join(', ')}\n`;
          if (k.past_oquvchilar?.length) b += `     👤 Past natijali: ${k.past_oquvchilar.slice(0, 3).join(', ')}\n`;
        });
      }
    });
    const past = toplamlar.filter((t: any) => t.ortacha_foiz < 50);
    if (past.length) b += `\n🔴 **Qiyin kazuslar**: ${past.map((t: any) => t.mavzu).join(', ')}\n`;
  }

  if (type === 'materiallar') {
    const materiallar = data?.materiallar || [];
    if (!materiallar.length) return b + '📭 O\'quv materiallar yo\'q.\n';
    const s = data.summary;
    if (s) {
      b += `**Xulosa:** ${s.jami_bolim} bo'lim | Faol: ${s.faol_bolim} | Jami ko'rishlar: **${s.jami_korishlar}**\n`;
      b += `📌 Eng ommabop: **${s.eng_ommabop}** (${s.eng_ommabop_soni} marta)\n\n`;
    }
    materiallar.slice(0, 12).forEach((m: any) => {
      const signal = m.korish_soni === 0 ? '🚫' : m.korish_soni < 3 ? '⚠️ Kam' : m.korish_soni >= 10 ? '🔥 Ommabop' : '';
      b += `**${m.bolim_nomi}** — **${m.korish_soni}** ko'rish ${m.faol ? '🟢' : '⚪'} ${signal}\n`;
      if (m.korilgan_oquvchilar?.length) b += `  Ko'rganlar: ${m.korilgan_oquvchilar.slice(0,5).join(', ')}\n`;
    });
  }
  return b;
}

function buildStudentProfileBlok(profile: any): string {
  if (!profile) return '';
  let b = `\n## 👤 O'QUVCHI: ${profile.ism}\n`;
  b += `${profile.testSoni} test | ${profile.kazusSoni} kazus | ${profile.materialSoni} material | O'rtacha: **${profile.avgFoiz}%**\n\n`;
  if (profile.testXulosa?.length) {
    b += `### Testlar:\n`;
    profile.testXulosa.forEach((t: any) => {
      b += `• **${t.testNomi}** — ${t.foiz}% (✓${t.togriSoni} ✗${t.xatoSoni})\n`;
      if (t.xatoSavollar?.length) b += `  Xato savollar: ${t.xatoSavollar.map((s: string) => `"${s}"`).join('; ')}\n`;
    });
  }
  if (profile.kazusXulosa?.length) {
    b += `\n### Kazuslar:\n`;
    profile.kazusXulosa.forEach((k: any) => {
      b += `• **${k.mavzu}** — ${k.ball}/${k.maksimalBall} ball (${k.foiz}%)\n`;
      if (k.yetishmayotganlar?.length) b += `  E'tiborsiz: ${k.yetishmayotganlar.join(', ')}\n`;
    });
  }
  if (profile.materialTarixi?.length) {
    b += `\n### O'qigan materiallar:\n`;
    profile.materialTarixi.slice(0, 8).forEach((m: any) => { b += `• ${m.bolimNomi} (${m.sana})\n`; });
  }
  return b;
}

function buildStudentBlok(ctx: StudentContext): string {
  if (!ctx.ism) return '';
  let b = `\n## 👤 FOYDALANUVCHI: ${ctx.ism} ${ctx.familiya || ''}`;
  if (ctx.kurs) b += ` | ${ctx.kurs}`;
  if (ctx.guruh) b += ` | ${ctx.guruh}`;
  if (ctx.totalXp !== undefined) b += ` | XP: ${ctx.totalXp} | Daraja: ${ctx.currentLevel || 1}`;
  if (ctx.reytingOrni) b += ` | Reyting: #${ctx.reytingOrni}`;
  if (ctx.testNatijalari?.length) {
    b += '\n### Test natijalari:\n';
    ctx.testNatijalari.forEach((t, i) => { b += `${i+1}. ${t.testNomi} — ${t.foiz}% (${t.togriSoni}✓ ${t.xatoSoni}✗)\n`; });
    if (ctx.zaifFanlar?.length) b += `Zaif: ${ctx.zaifFanlar.join(', ')}\n`;
  }
  if (ctx.kazusNatijalari?.length) {
    b += '### Kazus natijalari:\n';
    ctx.kazusNatijalari.forEach((k, i) => { const f = k.foiz ?? (k.maksimalBall > 0 ? Math.round((k.ball/k.maksimalBall)*100) : 0); b += `${i+1}. ${k.mavzu} — ${k.ball}/${k.maksimalBall} (${f}%)\n`; });
  }
  if (ctx.joriySahifa) b += `\nJoriy sahifa: ${ctx.joriySahifa}\n`;
  return b;
}

function buildKontentBlok(ctx: StudentContext): string {
  let b = ''; let has = false;
  if (ctx.mavjudTestlar?.length) {
    b += `\n**Testlar (${ctx.mavjudTestlar.length}ta):**\n`;
    ctx.mavjudTestlar.slice(0, 8).forEach(t => { b += `- [[TEST:${t.kod}|${t.nomi}]] ${t.faol ? '🟢' : '⚪'}\n`; }); has = true;
  }
  if (ctx.mavjudKazuslar?.length) {
    b += `\n**Kazuslar (${ctx.mavjudKazuslar.length}ta):**\n`;
    ctx.mavjudKazuslar.slice(0, 8).forEach(k => { b += `- [[KAZUS:${k.kod}|${k.mavzu}]] ${k.faol ? '🟢' : '⚪'}\n`; }); has = true;
  }
  if (ctx.mavjudMateriallar?.length) {
    b += `\n**O'quv materiallar (${ctx.mavjudMateriallar.length}ta):**\n`;
    ctx.mavjudMateriallar.slice(0, 20).forEach(m => { b += `- [[MATERIAL:${m.id}|${m.nomi}]]\n`; }); has = true;
  }
  if (ctx.savol_javob_bolimlar?.length) { b += `\n**Savol-Javob:** [[NAV:savol_javob|O'tish]]\n`; has = true; }
  return has ? `\n## 📚 PLATFORM KONTENTI\n${b}` : '';
}

function buildSearchBlok(sr: { testlar: any[]; kazuslar: any[]; materiallar: any[]; topildi: boolean }, query: string): string {
  if (!sr.topildi) return '';
  let b = `\n## 🔍 QIDIRUV (${query.slice(0, 30)})\n`;
  sr.testlar.forEach(t => { b += `[[TEST:${t.kod}|${t.nomi}]] ${t.faol ? '🟢' : ''}\n`; });
  sr.kazuslar.forEach(k => { b += `[[KAZUS:${k.kod}|${k.mavzu}]] ${k.faol ? '🟢' : ''}\n`; });
  sr.materiallar.forEach(m => { b += `[[MATERIAL:${m.id}|${m.bolim_nomi ? m.bolim_nomi + ' — ' + m.nomi : m.nomi}]]\n`; });
  return b;
}

// ─── SPECIAL MODES ────────────────────────────────────────────────────────────
const KAZUS_TAHLIL_SYSTEM = `Siz kazus tahlilchisiz. FAQAT JSON formatda javob bering:
{"aniq":true/false,"savol":"kazus matni","javob":"model javob","model_tur":"oddiy","mavzu":"qisqa mavzu","izoh":"nima so'rash kerak (agar aniq=false)"}`;

const MATERIAL_TAHLIL_SYSTEM = `Siz o'quv materiali klassifikatorisiz. FAQAT JSON:
{"bolim_nomi":"3-8 so'z","bob_nomi":"4-10 so'z","material_nomi":"nom","tavsif":"max 25 so'z","mavzu":"1-5 so'z","ishonch":85}`;

// ─── EDGE FUNCTION ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages, studentContext, requestorLoginId, mode, ustozId, ustozIsmi, serviceKey } = body as {
      messages: Message[]; studentContext?: StudentContext; requestorLoginId?: string;
      mode?: string; ustozId?: string; ustozIsmi?: string; serviceKey?: string;
    };

    const headerKey = req.headers.get('x-ai-mentor-key') || '';
    const providedKey = (serviceKey || headerKey || '').toString();
    const allowAll = !!(providedKey && Deno.env.get('AI_MENTOR_SERVICE_KEY') && providedKey === Deno.env.get('AI_MENTOR_SERVICE_KEY'));

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "messages bo'sh" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cfg = await loadConfig();
    if (!cfg.faol) {
      return new Response(JSON.stringify({ error: "AI Mentor o'chirilgan." }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ANALYTICS FETCH (UI direct call) ──────────────────────────────────
    if (mode === 'analytics_fetch' && (ustozId || allowAll)) {
      const aType = (body.analyticsType as 'testlar' | 'kazuslar' | 'materiallar') || 'testlar';
      const data = await fetchAnalyticsData(ustozId, aType, allowAll);
      return new Response(JSON.stringify({ data, mode: 'analytics_fetch', analyticsType: aType }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MATERIAL TAHLIL ────────────────────────────────────────────────────
    if (mode === 'material_tahlil') {
      const { materialMatn, faylNom, faylTur } = body as any;
      const ctx = materialMatn ? `Fayl: ${faylNom || 'Noma\'lum'} (${faylTur || ''})\n\n${materialMatn.slice(0, 3000)}` : `Fayl: ${faylNom} (${faylTur || ''})`;
      try {
        const raw = await callOnSpaceAI(cfg.model, MATERIAL_TAHLIL_SYSTEM, [{ role: 'user', parts: [{ text: ctx }] }], 600);
        let parsed = null;
        try { parsed = JSON.parse(raw.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'')); } catch {}
        return new Response(JSON.stringify({ reply: raw, mode: 'material_tahlil', parsed }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── KAZUS TAHLIL ───────────────────────────────────────────────────────
    if (mode === 'kazus_tahlil') {
      try {
        const raw = await callOnSpaceAI(cfg.model, KAZUS_TAHLIL_SYSTEM, messages, 1200);
        let parsed = null;
        try { parsed = JSON.parse(raw.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/\s*```$/i,'')); } catch {}
        return new Response(JSON.stringify({ reply: raw, mode: 'kazus_tahlil', parsed }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── CHAT MODE ──────────────────────────────────────────────────────────
    let safeCtx: StudentContext = {};
    if (studentContext) {
      if (requestorLoginId && studentContext.loginId) {
        if (requestorLoginId === studentContext.loginId) safeCtx = studentContext;
      } else { safeCtx = studentContext; }
    }
    if (ustozId && ustozIsmi) { safeCtx.rolUstoz = true; safeCtx.ustozId = ustozId; safeCtx.ustozIsmi = ustozIsmi; }

    const lastText = messages.filter(m => m.role === 'user').at(-1)?.parts[0]?.text || '';
    const isUstoz = !!safeCtx.rolUstoz;

    // ── XAVFSIZLIK FILTRI ──────────────────────────────────────────────────
    if (isHaramSavol(lastText) || isShaxsiyMalumotSorovi(lastText) || hasUstozLeak(lastText, isUstoz)) {
      const xavfsizJavob = isShaxsiyMalumotSorovi(lastText) || hasUstozLeak(lastText, isUstoz)
        ? 'Shaxsiy ma\u2019lumotlar (telefon, parol, login va h.k.) xavfsizlik sababli berilmaydi.'
        : 'Uzr, bu mavzu bo\u2019yicha yordam bera olmayman.';
      return new Response(JSON.stringify({ reply: xavfsizJavob, model: cfg.model, intent: 'REJECTED' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const intent = detectIntent(lastText, isUstoz, messages);
    console.log(`[mentor-chat] intent=${intent} ustoz=${isUstoz} ustozId=${ustozId?.slice(0,8)} q="${lastText.slice(0, 60)}"`);

    // ── YARATISH REJIMI ────────────────────────────────────────────────────
    if (intent === 'YARATISH_TEST') return new Response(JSON.stringify({ reply: '📝 Word fayl yuklang — testni o\'zim ajratib, platformaga joylashtirib beraman.', intent: 'YARATISH_TEST', model: cfg.model }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (intent === 'YARATISH_KAZUS') return new Response(JSON.stringify({ reply: '📋 Kazus matnini va model javobini kiriting:', intent: 'YARATISH_KAZUS', model: cfg.model }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (intent === 'YARATISH_MATERIAL') return new Response(JSON.stringify({ reply: "📚 Fayl yuklang — AI bo'lim, bob va material nomini avtomatik aniqlab, platformaga joylashtirib beraman:", intent: 'YARATISH_MATERIAL', model: cfg.model }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ── DEBUG MODE ─────────────────────────────────────────────────────────
    if (lastText.includes('[DEBUG: BAZANI KO\'RSAT]') && isUstoz && ustozId) {
      const fullData = await fetchFullUstozData(ustozId);
      const debugText = `## [DEBUG] TO'LIQ USTOZ MA'LUMOTLARI\n\n### SUMMARY:\n\`\`\`json\n${JSON.stringify(fullData.summary, null, 2)}\n\`\`\`\n\n### TESTLAR (${fullData.testlar?.length}):\n\`\`\`json\n${JSON.stringify(fullData.testlar?.slice(0,2), null, 2).slice(0, 2000)}\n\`\`\``;
      return new Response(JSON.stringify({ reply: debugText, intent: 'DEBUG', model: cfg.model }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── STUDENT PROFILE ────────────────────────────────────────────────────
    if (intent === 'STUDENT_PROFILE' && isUstoz && ustozId) {
      const ismKandidatlar = ajratIsm(lastText);
      if (ismKandidatlar.length > 0) {
        let profile = null;
        let qidiruvIsmi = '';
        if (ismKandidatlar.length >= 2) {
          const kombinatsiyalar = [
            ismKandidatlar.slice(0, 2).join(' '),
            ismKandidatlar[0],
            ismKandidatlar[1],
          ];
          for (const kombinatsiya of kombinatsiyalar) {
            const p = await fetchStudentProfile(kombinatsiya, ustozId);
            if (p && (p.testSoni > 0 || p.kazusSoni > 0 || p.materialSoni > 0)) {
              profile = p; qidiruvIsmi = kombinatsiya; break;
            }
          }
        } else {
          const p = await fetchStudentProfile(ismKandidatlar[0], ustozId);
          if (p && (p.testSoni > 0 || p.kazusSoni > 0 || p.materialSoni > 0)) {
            profile = p; qidiruvIsmi = ismKandidatlar[0];
          }
        }

        if (profile) {
          const profileBlok = buildStudentProfileBlok(profile);
          const systemP = studentProfilePrompt(cfg.customInstruction, profileBlok);
          const reply = await callOnSpaceAI(cfg.model, systemP, messages.slice(-3), 1600);
          return new Response(JSON.stringify({ reply, intent: 'STUDENT_PROFILE', model: cfg.model }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          const tozaIsm = ismKandidatlar.join(' ');
          return new Response(JSON.stringify({ reply: `Ustoz, ma'lumotlar bazasida **${tozaIsm}** nomli o'quvchi topilmadi yoki hali hech qanday faoliyati yo'q.`, intent: 'STUDENT_PROFILE', model: cfg.model }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // ── ANALITIKA REJIMI (TO'LIQ MA'LUMOTLAR BILAN) ────────────────────────
    if ((intent === 'ANALITIKA' || intent === 'ANALITIKA_AUTO') && isUstoz && ustozId) {
      const hasTest = /test/i.test(lastText);
      const hasKazus = /kazus|toplam/i.test(lastText);
      const hasMaterial = /material|dars|o['']quv|ko['']r|ommabop|mashhur|yuklangan/i.test(lastText);
      const aniqTur = hasTest && !hasKazus && !hasMaterial ? 'testlar'
        : hasKazus && !hasTest && !hasMaterial ? 'kazuslar'
        : hasMaterial && !hasTest && !hasKazus ? 'materiallar'
        : null;

      try {
        // BARCHA ma'lumotlarni parallel yukla — har qanday savolga yetarli bo'lsin
        const fullData = await fetchFullUstozData(ustozId);
        const fullBlok = buildFullUstozDataBlok(fullData, ustozIsmi || '');
        const vazifaBlok = `\n## USTOZ SAVOLI\n"${lastText}"\n\nYuqoridagi TO'LIQ ma'lumotlar bazasi asosida savolga BEVOSITA 3-blokli formatda javob ber.\nFAQAT haqiqiy raqamlar va ismlar ishlatilsin. To'qima yozma.`;
        const systemP = analitikDuolingoPrompt(cfg.customInstruction, fullBlok + vazifaBlok);
        const reply = await callOnSpaceAI(cfg.model, systemP, messages.slice(-4), 2000);

        // UI analytics cache uchun ham qisman data yuborish
        let analyticsData = null;
        let analyticsType = aniqTur;
        if (aniqTur) {
          analyticsData = aniqTur === 'testlar' ? { testlar: fullData.testlar, summary: fullData.summary }
            : aniqTur === 'kazuslar' ? { toplamlar: fullData.toplamlar, summary: fullData.summary }
            : { materiallar: fullData.materiallar, summary: fullData.summary };
        }

        return new Response(JSON.stringify({
          reply, intent: 'ANALITIKA',
          analyticsData, analyticsType,
          analyticsAll: {
            testlar: { testlar: fullData.testlar?.filter((t: any) => t.javoblar_soni > 0), summary: fullData.summary },
            kazuslar: { toplamlar: fullData.toplamlar?.filter((t: any) => t.javoblar_soni > 0), summary: fullData.summary },
            materiallar: { materiallar: fullData.materiallar, summary: fullData.summary },
          },
          model: cfg.model,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        console.error('[analitika fetch xato]', e);
        return new Response(JSON.stringify({ error: 'Analytics fetch xatolik: ' + e?.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── BILIM REJIMI ───────────────────────────────────────────────────────
    if (intent === 'BILIM') {
      // Kasual savol bo'lsa — RAG ishlatmasdan to'g'ridan-to'g'ri javob ber
      if (isKasualSavol(lastText)) {
        console.log(`[mentor-chat] Kasual savol aniqlandi, RAG o'tkazib yuborildi: "${lastText.slice(0, 60)}"`);
        const kasualSystem = `${cfg.customInstruction || "Siz FanFaster huquq ta'lim platformasining AI Mentori."}
Siz do'stona, qisqa va xushmuomala javob bering. Hech qanday bazadan qidiruv kerak emas.
${NO_NAV_RULE}${NAV_SYNTAX}`;
        const reply = await callOnSpaceAI(cfg.model, kasualSystem, messages.slice(-6), 600);
        return new Response(JSON.stringify({ reply, intent: 'UMUMIY', citationMeta: null, model: cfg.model, cached: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const cacheHash = await hashText(lastText);
      const cached = await keshOlish(cacheHash);
      if (cached) return new Response(JSON.stringify({ reply: cached, intent: 'BILIM', model: cfg.model, cached: true, citationMeta: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Fuzzy ILIKE + Query expansion qidiruvi — top_k=7
      console.log(`[mentor-chat] RAG qidiruv boshlanmoqda: "${lastText.slice(0, 80)}"`);
      const [chunks, sr] = await Promise.all([
        citationSearch(lastText, 7, cfg.model),
        globalSearch(lastText),
      ]);
      console.log(`[mentor-chat] RAG natija: ${chunks.length} ta chunk topildi`);

      // Chunk topilmasa ham modelga yuboramiz — balki ichki bilimidan javob beradi
      const citBlok = chunks.length > 0
        ? buildCitationBlok(chunks)
        : '\n## 📖 DARSLIK MAZMUNI\nHozircha bu mavzu bo\'yicha darslik matni topilmadi. Umumiy huquqiy bilimlaringizdan qisqacha yordamlashib ko\'ring, lekin [0] ni qo\'ying.\n\n';

      const systemP = bilimSystemPrompt(cfg.customInstruction, citBlok, buildSearchBlok(sr, lastText));
      const reply = await callOnSpaceAI(cfg.model, systemP, messages.slice(-6), 1600);
      if (chunks.length > 0) keshSaqlash(cacheHash, lastText, reply, cfg.model).catch(() => {});
      const citMeta: CitationMeta[] = chunks.map(c => ({ ref: c.ref, material_id: c.material_id, bolim_id: c.bolim_id, bob_id: c.bob_id, bolim_nomi: c.bolim_nomi, bob_nomi: c.bob_nomi, material_nomi: c.material_nomi }));
      return new Response(JSON.stringify({ reply, intent: 'BILIM', citationMeta: citMeta.length ? citMeta : null, model: cfg.model, cached: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── QIDIRUV REJIMI ─────────────────────────────────────────────────────
    if (intent === 'QIDIRUV' && isUstoz) {
      const sr = await globalSearch(lastText);
      if (sr.topildi) {
        let qBlok = `\n## 🔍 QIDIRUV — "${lastText.slice(0, 40)}"\n`;
        sr.testlar.forEach(t => { qBlok += `[[TEST:${t.kod}|📝 ${t.nomi} (${t.kod})]] ${t.faol ? '🟢' : '⚪'}\n`; });
        sr.kazuslar.forEach(k => { qBlok += `[[KAZUS:${k.kod}|📋 ${k.mavzu} (${k.kod})]] ${k.faol ? '🟢' : '⚪'}\n`; });
        sr.materiallar.forEach(m => { qBlok += `[[MATERIAL:${m.id}|📚 ${m.bolim_nomi ? m.bolim_nomi + ' — ' : ''}${m.nomi}]]\n`; });
        const systemP = qidiruvSystemPrompt(cfg.customInstruction, qBlok);
        const reply = await callOnSpaceAI(cfg.model, systemP, messages.slice(-4), 800);
        return new Response(JSON.stringify({ reply, intent: 'QIDIRUV', searchResults: sr, model: cfg.model, citationMeta: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ── SHAXSIY / UMUMIY ───────────────────────────────────────────────────
    const hasKw = lastText.length > 5 && !isKasualSavol(lastText) && !/^(salom|assalomu|hi|hola|ok|ha|yo'q|rahmat|xayr)$/i.test(lastText.trim());
    const sr2 = hasKw ? await globalSearch(lastText) : { testlar: [], kazuslar: [], materiallar: [], topildi: false };
    const systemP = umumiySystemPrompt(cfg.customInstruction, buildStudentBlok(safeCtx), buildKontentBlok(safeCtx), buildSearchBlok(sr2, lastText));
    const reply = await callOnSpaceAI(cfg.model, systemP, messages.slice(-10), 1400);
    return new Response(JSON.stringify({ reply, intent, model: cfg.model, citationMeta: null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = (e instanceof AiHttpError) ? e.status : 500;
    console.error(`[mentor-chat] ❌ ${msg.slice(0, 300)}`);
    // 402 → user-facing friendly message, not a hard error
    if (statusCode === 402) {
      return new Response(JSON.stringify({ reply: '⚠️ AI Mentor vaqtincha ishlamayapti. Iltimos, keyinroq urinib ko\'ring.', intent: 'UNAVAILABLE', model: '' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: `Xatolik: ${msg.slice(0, 200)}` }), { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
