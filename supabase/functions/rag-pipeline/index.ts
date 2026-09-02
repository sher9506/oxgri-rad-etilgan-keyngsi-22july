import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * RAG Pipeline v2 — Takomillashtirilgan
 *
 * Yangi arxitektura:
 * Query → O'zbek Stemming + LLM Expansion → Multi-Strategy Retrieval (top_k=7)
 * → TF-IDF Re-ranking → Context Assembly → LLM Generation → Citations
 *
 * Retrieval strategiyalari (parallel):
 * 1. ILIKE OR (stemmed + expanded terminlar) — asosiy
 * 2. PostgreSQL FTS simple (OR operatori) — backup
 * 3. Keyword Array GIN overlap — qo'shimcha
 * 4. Phrase match (aniq jumlalar uchun) — new
 * 5. Short stem fallback — yangi, keng qidiruv
 *
 * Re-ranking: TF-IDF + BM25 yaqinlashuvi, multi-source boost
 */

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';
const ONSPACE_AI_API_KEY = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 soat

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Document {
  id: string;
  material_id: string;
  bolim_id: string;
  bob_id: string;
  bolim_nomi: string;
  bob_nomi: string;
  material_nomi: string;
  chunk_index: number;
  matn: string;
  keywords?: string[];
  score?: number;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RAGResult {
  answer: string;
  documents: Document[];
  citations: CitationMeta[];
  query: string;
  model: string;
  cached: boolean;
  retrieval_stats: RetrievalStats;
}

interface CitationMeta {
  ref: number;
  bolim_nomi: string;
  bob_nomi: string;
  material_nomi: string;
  material_id: string;
  bob_id: string;
  bolim_id: string;
}

interface RetrievalStats {
  ilike_hits: number;
  fts_hits: number;
  keyword_hits: number;
  phrase_hits: number;
  final_docs: number;
  strategy: string;
  expanded_terms: string[];
}

// ─── O'ZBEK SO'Z O'ZAKLARINI AJRATISH ────────────────────────────────────────
function uzbekStem(word: string): string {
  const w = word.toLowerCase().replace(/[^\w']/g, '');
  const suffixes = [
    'larning', 'laridan', 'lariga', 'larini', 'lardan', 'larga', 'larni',
    'ining', 'idan', 'idagi', 'imiz', 'ingiz',
    'larni', 'lardan', 'larga', 'lar',
    'ning', 'ndan', 'dagi', 'imda', 'inda',
    'dan', 'lik', 'chi', 'cha', 'gina', 'dir',
    'ga', 'ni', 'da', 'gi', 'si', 'mi', 'di', 'sa'
  ];
  for (const suf of suffixes) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      return w.slice(0, w.length - suf.length);
    }
  }
  return w;
}

// ─── TOKENIZATSIYA + STEM ─────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  const stop = new Set([
    'va', 'yoki', 'bu', 'u', 'men', 'sen', 'biz', 'siz', 'nima', 'qanday',
    'qaysi', 'kim', 'haqida', 'uchun', 'bilan', 'ning', 'ga', 'da', 'dan',
    'ni', 'ham', 'ammo', 'lekin', 'chunki', 'bir', 'edi', 'bor', 'yo', 'kerak',
    'mumkin', 'qilish', 'etish', 'olish', 'deb', 'degan', 'bo\'lgan', 'bo\'ladi'
  ]);
  return text.toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w));
}

// ─── LLM QUERY EXPANSION ─────────────────────────────────────────────────────
async function expandQueryWithLLM(savol: string, model: string): Promise<string[]> {
  if (!ONSPACE_AI_BASE_URL || !ONSPACE_AI_API_KEY) return [];
  const SYSTEM = `O'zbek huquq sohasida kalit so'z ajratuvchisi. Berilgan savoldan MAX 10 ta kalit so'z/ibora ajrat: o'zak shakl, sinonimlar, qo'shimchasiz variantlar. FAQAT vergul bilan ajratilgan bitta qator qaytargin.
Misol: "Advokatlar qanday faoliyat yuritadi?" → advokat,advokatlik,himoyachi,faoliyat,yuritish,kasbiy`;
  try {
    const res = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ONSPACE_AI_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: savol.slice(0, 250) }],
        max_tokens: 100,
        temperature: 0.15,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content || '';
    const terms = raw.split(/[,\n]+/)
      .map((t: string) => t.trim().toLowerCase().replace(/[^\w']/g, '').trim())
      .filter((t: string) => t.length > 2)
      .slice(0, 10);
    console.log(`[expand] "${savol.slice(0, 40)}" → [${terms.join(', ')}]`);
    return terms;
  } catch {
    return [];
  }
}

// ─── TF-IDF RELEVANCE SCORER ──────────────────────────────────────────────────
function scoreTfIdf(matn: string, terms: string[]): number {
  if (!terms.length) return 0;
  const lower = matn.toLowerCase();
  let score = 0;
  for (const term of terms) {
    // Term frequency
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = lower.match(regex);
    if (matches) {
      const tf = matches.length / (matn.split(/\s+/).length || 1);
      // IDF proxy: shorter terms less specific
      const idf = Math.log(1 + 10 / Math.max(1, term.length - 2));
      score += tf * idf;
    }
  }
  return score;
}

// ─── MULTI-STRATEGY RETRIEVER ─────────────────────────────────────────────────
async function retrieve(
  query: string,
  bolimId?: string,
  topK = 7,
  model = 'google/gemini-3-flash-preview'
): Promise<{ docs: Document[]; stats: RetrievalStats }> {
  // 1. Tokenizatsiya + stem
  const rawTokens = tokenize(query);
  const stemmed = rawTokens.map(uzbekStem).filter(s => s.length >= 3);
  const baseTerms = [...new Set([...rawTokens, ...stemmed])].slice(0, 10);

  // 2. LLM expansion (parallel bilan retrieve boshlanadi)
  const [expandedTerms] = await Promise.all([
    expandQueryWithLLM(query, model),
  ]);
  const expandedStemmed = expandedTerms.map(uzbekStem).filter(s => s.length >= 3);
  const allTerms = [...new Set([...baseTerms, ...expandedTerms, ...expandedStemmed])].slice(0, 18);

  console.log(`[rag] allTerms (${allTerms.length}): [${allTerms.slice(0, 8).join(', ')}...]`);

  const scoreMap = new Map<string, { doc: Document; score: number; sources: Set<string>; termHits: number }>();

  const addDoc = (doc: Document, score: number, source: string, hitTerms?: string[]) => {
    const existing = scoreMap.get(doc.id);
    const termHits = hitTerms?.length ?? 0;
    if (existing) {
      existing.score = Math.max(existing.score, score);
      existing.sources.add(source);
      existing.termHits = Math.max(existing.termHits, termHits);
    } else {
      scoreMap.set(doc.id, { doc, score, sources: new Set([source]), termHits });
    }
  };

  let ilikeHits = 0, ftsHits = 0, kwHits = 0, phraseHits = 0;

  // ── Strategy 1: Kengaytirilgan ILIKE OR (asosiy) ─────────────────────
  const ilikeTerms = allTerms.slice(0, 14);
  if (ilikeTerms.length > 0) {
    try {
      const ilikeOr = ilikeTerms.map(t => `matn.ilike.%${t}%`).join(',');
      let q = supabaseAdmin.from('om_chunks')
        .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn,keywords')
        .or(ilikeOr)
        .limit(topK + 10);
      if (bolimId) q = q.eq('bolim_id', bolimId);
      const { data, error } = await q;
      if (!error && data?.length) {
        ilikeHits = data.length;
        data.forEach((d: any) => {
          const hitTerms = ilikeTerms.filter(t => d.matn.toLowerCase().includes(t));
          const tfScore = scoreTfIdf(d.matn, ilikeTerms);
          addDoc(d as Document, 0.95 + tfScore * 0.1, 'ilike', hitTerms);
        });
      }
    } catch (e) { console.error('[rag] ILIKE error:', e); }
  }

  // ── Strategy 2: FTS OR (backup) ───────────────────────────────────────
  const ftsQuery = allTerms.slice(0, 8).join(' | ');
  if (ftsQuery) {
    try {
      let q = supabaseAdmin.from('om_chunks')
        .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn,keywords')
        .textSearch('matn', ftsQuery, { config: 'simple', type: 'plain' })
        .limit(topK + 6);
      if (bolimId) q = q.eq('bolim_id', bolimId);
      const { data, error } = await q;
      if (!error && data?.length) {
        ftsHits = data.length;
        data.forEach((d: any, i: number) => {
          const tfScore = scoreTfIdf(d.matn, allTerms.slice(0, 6));
          addDoc(d as Document, 0.80 - (i * 0.02) + tfScore * 0.05, 'fts');
        });
      }
    } catch (e) { console.error('[rag] FTS error:', e); }
  }

  // ── Strategy 3: Keyword GIN overlap ─────────────────────────────────
  if (allTerms.length >= 2) {
    try {
      let q = supabaseAdmin.from('om_chunks')
        .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn,keywords')
        .overlaps('keywords', allTerms.slice(0, 12))
        .limit(topK + 4);
      if (bolimId) q = q.eq('bolim_id', bolimId);
      const { data, error } = await q;
      if (!error && data?.length) {
        kwHits = data.length;
        data.forEach((d: any, i: number) => {
          const kws: string[] = d.keywords || [];
          const overlap = allTerms.filter(t => kws.includes(t) || kws.some(k => k.includes(t) || t.includes(k)));
          const kwScore = overlap.length / Math.max(1, allTerms.length);
          addDoc(d as Document, 0.70 + kwScore * 0.2, 'keyword');
        });
      }
    } catch (e) { console.error('[rag] Keyword error:', e); }
  }

  // ── Strategy 4: Aniq iborali qidiruv (phrase match) ─────────────────
  // Multi-word phrases (2-3 so'z birga bo'lganini qidirish)
  const phrases: string[] = [];
  for (let i = 0; i < rawTokens.length - 1 && phrases.length < 3; i++) {
    const phrase = rawTokens.slice(i, i + 2).join(' ');
    if (phrase.length >= 6) phrases.push(phrase);
  }
  if (phrases.length > 0) {
    try {
      const phraseCond = phrases.map(p => `matn.ilike.%${p}%`).join(',');
      let q = supabaseAdmin.from('om_chunks')
        .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn,keywords')
        .or(phraseCond)
        .limit(topK);
      if (bolimId) q = q.eq('bolim_id', bolimId);
      const { data, error } = await q;
      if (!error && data?.length) {
        phraseHits = data.length;
        // Phrase match eng yuqori relevantlik
        data.forEach((d: any) => {
          addDoc(d as Document, 1.15, 'phrase');
        });
      }
    } catch (e) { console.error('[rag] Phrase error:', e); }
  }

  // ── Strategy 5: Qisqa o'zak fallback (hech narsa topilmasa) ─────────
  if (scoreMap.size < 2) {
    const shortTerms = allTerms.filter(t => t.length >= 4).slice(0, 5);
    if (shortTerms.length > 0) {
      try {
        const shortCond = shortTerms.map(t => `matn.ilike.%${t}%`).join(',');
        let q = supabaseAdmin.from('om_chunks')
          .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn,keywords')
          .or(shortCond)
          .limit(topK);
        if (bolimId) q = q.eq('bolim_id', bolimId);
        const { data, error } = await q;
        if (!error && data?.length) {
          data.forEach((d: any) => {
            addDoc(d as Document, 0.5, 'short_fallback');
          });
        }
      } catch {}
    }
  }

  // ── Re-ranking: TF-IDF + multi-source boost ───────────────────────────
  const ranked = Array.from(scoreMap.values())
    .map(item => {
      // Multi-source boost: bir nechta strategiya topsa bonus
      const multiBoost = item.sources.size >= 3 ? 0.3
        : item.sources.size === 2 ? 0.15
        : 0;
      // Term hit density bonus
      const termBoost = Math.min(0.2, item.termHits * 0.03);
      // Re-score with TF-IDF on full terms set
      const tfIdfBoost = scoreTfIdf(item.doc.matn, allTerms.slice(0, 10)) * 0.1;
      const finalScore = item.score + multiBoost + termBoost + tfIdfBoost;
      return { ...item, finalScore };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);

  const stratUsed = [
    ilikeHits > 0 && 'ilike',
    ftsHits > 0 && 'fts',
    kwHits > 0 && 'keyword',
    phraseHits > 0 && 'phrase',
  ].filter(Boolean).join('+') || 'none';

  console.log(`[rag] Final: ${ranked.length} docs | strategy=${stratUsed} | ilike=${ilikeHits} fts=${ftsHits} kw=${kwHits} phrase=${phraseHits}`);

  return {
    docs: ranked.map(r => ({ ...r.doc, score: r.finalScore })),
    stats: {
      ilike_hits: ilikeHits,
      fts_hits: ftsHits,
      keyword_hits: kwHits,
      phrase_hits: phraseHits,
      final_docs: ranked.length,
      strategy: stratUsed,
      expanded_terms: allTerms.slice(0, 10),
    },
  };
}

// ─── CONTEXT ASSEMBLY ─────────────────────────────────────────────────────────
function assembleContext(docs: Document[]): { contextBlock: string; citations: CitationMeta[] } {
  if (!docs.length) return { contextBlock: '', citations: [] };

  const citations: CitationMeta[] = docs.map((doc, i) => ({
    ref: i + 1,
    bolim_nomi: doc.bolim_nomi,
    bob_nomi: doc.bob_nomi,
    material_nomi: doc.material_nomi,
    material_id: doc.material_id,
    bob_id: doc.bob_id,
    bolim_id: doc.bolim_id,
  }));

  let block = `## DARSLIK MAZMUNI (top ${docs.length} ta eng mos bo'lim)\n`;
  block += `QOIDA: Har bir gap oxiriga [N] qo'y. Matnni qayta yozma — qisqa xulosa + [N].\nAgar manba yetarli bo'lmasa, umumiy bilimdan to'ldirish mumkin.\n\n`;

  docs.forEach((doc, i) => {
    block += `### [${i + 1}] ${doc.bolim_nomi} › ${doc.bob_nomi} › ${doc.material_nomi}\n`;
    // Score ko'rsatamiz (debug uchun)
    block += `relevance: ${(doc.score ?? 0).toFixed(2)}\n`;
    block += doc.matn.slice(0, 520);
    if (doc.matn.length > 420) block += '…';
    block += '\n\n';
  });

  return { contextBlock: block, citations };
}

// ─── KESH ─────────────────────────────────────────────────────────────────────
async function hashQuery(text: string, bolimId?: string): Promise<string> {
  const key = `rag2:${text.trim().toLowerCase().slice(0, 200)}:${bolimId || ''}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

async function cacheGet(hash: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin.from('ai_cache')
      .select('javob_matn,updated_at').eq('savol_hash', hash).maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.updated_at).getTime() > CACHE_TTL_MS) return null;
    return data.javob_matn;
  } catch { return null; }
}

async function cacheSet(hash: string, query: string, answer: string, model: string) {
  try {
    await supabaseAdmin.from('ai_cache').upsert(
      { savol_hash: hash, savol_matn: query.slice(0, 500), javob_matn: answer, model, updated_at: new Date().toISOString() },
      { onConflict: 'savol_hash' }
    );
  } catch {}
}

// ─── LLM ─────────────────────────────────────────────────────────────────────
async function callLLM(model: string, systemPrompt: string, messages: Message[], maxTokens = 1800): Promise<string> {
  if (!ONSPACE_AI_BASE_URL || !ONSPACE_AI_API_KEY) throw new Error('OnSpace AI sozlanmagan');
  const res = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ONSPACE_AI_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: maxTokens,
      temperature: 0.3,
      stream: false,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LLM [${res.status}]: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('LLM bo\'sh javob qaytardi');
  return reply;
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
function buildSystemPrompt(contextBlock: string, customInstruction: string): string {
  return `${customInstruction || "Siz FanFaster huquq ta'lim platformasining AI Mentori."}

## RAG QOIDALARI
1. FAQAT quyidagi darslik mazmunidan javob ber
2. Har bir gap / fikr oxiriga [N] manba belgisini qo'y (N = hujjat raqami)
3. Hujjatlarda javob topilmasa: "Bu ma'lumot darsliklarimizda topilmadi."
4. MAX 6 gap — aniq, tushunarli, O'zbek tilida, "Siz" murojaat
5. Huquqiy atamalarni izohla

## TAQIQLAR
- O'zingizdan bilim qo'shma (hallucination taqiqlangan)
- Din, siyosat, shaxsiy ma'lumotlar
- Parol, telefon raqam, API kalitlar

${contextBlock}`;
}

// ─── EDGE FUNCTION ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      query,
      messages = [],
      bolim_id,
      top_k = 7,
      model = 'google/gemini-3-flash-preview',
      use_cache = true,
      custom_instruction = '',
    } = body as {
      query: string;
      messages?: Message[];
      bolim_id?: string;
      top_k?: number;
      model?: string;
      use_cache?: boolean;
      custom_instruction?: string;
    };

    if (!query?.trim()) {
      return new Response(JSON.stringify({ error: 'query required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── Cache ──────────────────────────────────────────────────────────────
    const cacheHash = await hashQuery(query, bolim_id);
    if (use_cache) {
      const cached = await cacheGet(cacheHash);
      if (cached) {
        return new Response(JSON.stringify({
          answer: cached,
          documents: [],
          citations: [],
          query, model,
          cached: true,
          retrieval_stats: { ilike_hits: 0, fts_hits: 0, keyword_hits: 0, phrase_hits: 0, final_docs: 0, strategy: 'cache', expanded_terms: [] },
        } as RAGResult), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ── Retrieval ──────────────────────────────────────────────────────────
    const effectiveTopK = Math.min(Math.max(top_k, 8), 12);
    const { docs, stats } = await retrieve(query, bolim_id, effectiveTopK, model);

    console.log(`[rag-pipeline] "${query.slice(0, 50)}" → ${docs.length} docs | ${stats.strategy}`);

    // ── Context assembly ───────────────────────────────────────────────────
    const { contextBlock, citations } = assembleContext(docs);

    // ── Generation ────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(contextBlock, custom_instruction);

    const chatMessages: Message[] = [
      ...messages.slice(-6).map((m: any) => ({
        role: (m.role === 'user' || m.role === 'assistant' || m.role === 'system') ? m.role : 'user',
        content: typeof m.content === 'string' ? m.content : m.parts?.[0]?.text || '',
      })),
      { role: 'user', content: query },
    ];

    let answer: string;
    if (!docs.length) {
      // O'quv materialda topilmasa umumiy bilimdan javobla
      const generalSystemPrompt = `${custom_instruction || "Siz FanFaster huquq ta'lim platformasining AI Mentori."}

MUHIM: O'quv materiallarimizda ushbu savol bo'yicha ma'lumot topilmadi. Shuning uchun umumiy bilimlaringizdan foydalanib javob bering.
- Javob boshida: "📚 O'quv materialda topilmadi — umumiy bilimdan javob:" deb yozing
- Aniq, ishonchli ma'lumot bering
- Huquqiy atamalarni izohlab keting
- O'zbek tilida, "Siz" murojaat
- MAX 8 gap`;
      answer = await callLLM(model, generalSystemPrompt, chatMessages, 1800);
    } else {
      answer = await callLLM(model, systemPrompt, chatMessages, 1800);
    }

    // ── Cache store ────────────────────────────────────────────────────────
    if (use_cache && docs.length > 0) {
      cacheSet(cacheHash, query, answer, model).catch(() => {});
    }

    return new Response(JSON.stringify({
      answer,
      documents: docs,
      citations,
      query, model,
      cached: false,
      retrieval_stats: stats,
    } as RAGResult), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[rag-pipeline] ❌:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
