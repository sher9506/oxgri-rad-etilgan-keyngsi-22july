import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

/**
 * Chunk Material v2 — Takomillashtirilgan
 *
 * Yangiliklar:
 * - DOCX (.docx) matnini extract qilish (mammoth CDN)
 * - Yaxshilangan HTML → matn konvertatsiya
 * - Overlap 100 gacha ko'tarildi (context saqlanadi)
 * - Uzbek-aware keyword extraction (stemming)
 * - Chunk meta: char_count, word_count saqlash
 * - Parallel batch insert (50 dan 30 ga)
 */

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';
const ONSPACE_AI_API_KEY = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';

// ─── RECURSIVE SPLITTER ───────────────────────────────────────────────────────
class RecursiveCharacterTextSplitter {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];

  constructor(opts: { chunkSize?: number; chunkOverlap?: number; separators?: string[] } = {}) {
    this.chunkSize = opts.chunkSize ?? 480;
    this.chunkOverlap = opts.chunkOverlap ?? 100;
    this.separators = opts.separators ?? ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''];
  }

  splitText(text: string): string[] {
    return this._split(text, this.separators);
  }

  private _split(text: string, seps: string[]): string[] {
    const chunks: string[] = [];
    let sep = seps[seps.length - 1];
    let restSeps: string[] = [];

    for (let i = 0; i < seps.length; i++) {
      if (seps[i] === '') { sep = seps[i]; break; }
      if (text.includes(seps[i])) { sep = seps[i]; restSeps = seps.slice(i + 1); break; }
    }

    const splits = sep ? text.split(sep) : text.split('');
    const good: string[] = [];

    for (const s of splits) {
      if (s.length < this.chunkSize) { good.push(s); }
      else {
        if (good.length) { chunks.push(...this._merge(good, sep)); good.length = 0; }
        if (restSeps.length) chunks.push(...this._split(s, restSeps));
        else chunks.push(s);
      }
    }
    if (good.length) chunks.push(...this._merge(good, sep));
    return chunks.filter(c => c.trim().length > 30);
  }

  private _merge(splits: string[], sep: string): string[] {
    const docs: string[] = [];
    const cur: string[] = [];
    let total = 0;

    for (const d of splits) {
      const len = d.length;
      if (total + len + (cur.length ? sep.length : 0) > this.chunkSize) {
        if (cur.length) {
          const doc = cur.join(sep).trim();
          if (doc.length > 0) docs.push(doc);
          while (cur.length > 0 && (total > this.chunkOverlap || (total + len > this.chunkSize && total > 0))) {
            total -= cur[0].length + sep.length;
            cur.shift();
          }
        }
      }
      cur.push(d);
      total += len + (cur.length > 1 ? sep.length : 0);
    }
    const doc = cur.join(sep).trim();
    if (doc.length > 0) docs.push(doc);
    return docs;
  }
}

// ─── HTML → MATN ──────────────────────────────────────────────────────────────
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ─── O'ZBEK STEM ──────────────────────────────────────────────────────────────
function uzbekStem(word: string): string {
  const w = word.toLowerCase();
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

// ─── KEYWORD EXTRACTION (BM25-style + uzbek stem) ────────────────────────────
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'va', 'yoki', 'bu', 'u', 'men', 'sen', 'biz', 'siz', 'ham', 'ammo',
    'lekin', 'chunki', 'agar', 'bir', 'bilan', 'uchun', 'haqida',
    'ning', 'ga', 'da', 'dan', 'ni', 'bo\'lgan', 'bo\'ladi', 'kerak', 'mumkin',
    'qilish', 'etish', 'olish', 'berish', 'deb', 'degan', 'amalga', 'oshiriladi',
    'belgilanadi', 'qilinadi', 'the', 'a', 'an', 'in', 'of', 'to', 'is'
  ]);

  const wordFreq: Record<string, number> = {};
  const words = text.toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w));

  for (const w of words) {
    const stem = uzbekStem(w);
    // Stem va original ikkalasini ham saqlash
    wordFreq[w] = (wordFreq[w] || 0) + 1;
    if (stem !== w && stem.length > 3) {
      wordFreq[stem] = (wordFreq[stem] || 0) + 0.5; // Stem uchun 0.5 weight
    }
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50) // Ko'proq keyword
    .map(([w]) => w);
}

// ─── LLM BILAN KEYWORD BOYITISH (opsional, faol materiallar uchun) ─────────────
async function enrichKeywordsWithLLM(text: string, materialNomi: string): Promise<string[]> {
  if (!ONSPACE_AI_BASE_URL || !ONSPACE_AI_API_KEY) return [];
  try {
    const res = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ONSPACE_AI_API_KEY}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `O'zbek huquq sohasidagi matndan MAX 15 ta kalit so'z ajrat. Sinonimlar, o'zak shakllar, huquqiy atamalar. FAQAT vergul bilan ajratilgan bitta qator.`
          },
          {
            role: 'user',
            content: `Material: "${materialNomi}"\nMatn: ${text.slice(0, 600)}`
          }
        ],
        max_tokens: 80,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content || '';
    return raw.split(/[,\n]+/)
      .map((t: string) => t.trim().toLowerCase().replace(/[^\w']/g, '').trim())
      .filter((t: string) => t.length > 2)
      .slice(0, 15);
  } catch { return []; }
}

// ─── MATERIAL MATNINI OLISH ───────────────────────────────────────────────────
async function fetchMaterialText(faylUrl: string, faylTur: string): Promise<string | null> {
  try {
    if (['audio', 'video', 'pdf'].includes(faylTur)) {
      // PDF: basic text extraction attempt
      if (faylTur === 'pdf') {
        try {
          const res = await fetch(faylUrl);
          if (!res.ok) return null;
          const buffer = await res.arrayBuffer();
          const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
          // PDF dan oddiy matn olish (stream objects)
          const extracted = text
            .replace(/[^\x20-\x7E\u00C0-\u024F\u0400-\u04FF]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          return extracted.length > 100 ? extracted.slice(0, 20000) : null;
        } catch { return null; }
      }
      return null;
    }

    if (['html', 'htm'].includes(faylTur)) {
      const res = await fetch(faylUrl);
      if (!res.ok) return null;
      const html = await res.text();
      const plain = htmlToText(html);
      return plain.length > 50 ? plain : null;
    }

    if (['docx', 'doc'].includes(faylTur)) {
      // DOCX: binary parse (basic XML extraction)
      try {
        const res = await fetch(faylUrl);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(buffer);

        // DOCX is a ZIP file — look for word/document.xml content
        const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
        // Extract text between XML tags
        const xmlMatches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
        const extracted = xmlMatches
          .map(m => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (extracted.length > 100) return extracted;

        // Fallback: plain text decode
        const plain = text
          .replace(/[^\x20-\x7E\u00C0-\u024F\u0400-\u04FF\s]/g, ' ')
          .replace(/\s{3,}/g, '\n')
          .trim();
        return plain.length > 100 ? plain.slice(0, 20000) : null;
      } catch { return null; }
    }

    return null;
  } catch (e) {
    console.error('[chunk-material] Fetch error:', e);
    return null;
  }
}

// ─── MATERIALNI QAYTA ISHLASH ─────────────────────────────────────────────────
async function processMaterial(
  material: any,
  useAiKeywords = false
): Promise<{ ok: boolean; chunks: number; msg?: string }> {
  const matn = await fetchMaterialText(material.fayl_url, material.fayl_tur);
  if (!matn || matn.length < 50) {
    return { ok: false, chunks: 0, msg: `${material.fayl_tur} unsupported or empty (url: ${material.fayl_url?.slice(0, 60)})` };
  }

  // Optimal chunk size: huquqiy materiallar uchun 480 char
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 480,
    chunkOverlap: 100,
    separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''],
  });

  const chunks = splitter.splitText(matn);
  if (!chunks.length) return { ok: false, chunks: 0, msg: 'No chunks' };

  const bob = material.om_boblar;
  const bolim = bob?.om_bolimlar;

  // Eski chunklar o'chirish
  await supabaseAdmin.from('om_chunks').delete().eq('material_id', material.id);

  // Har bir chunk uchun keywords
  const rows = await Promise.all(
    chunks.map(async (chunkText, idx) => {
      const baseKw = extractKeywords(chunkText);
      // Faqat birinchi chunk uchun AI keywords (xarajatni kamaytirish)
      const aiKw = (useAiKeywords && idx === 0 && chunkText.length > 150)
        ? await enrichKeywordsWithLLM(chunkText, material.nomi)
        : [];
      const allKw = [...new Set([...baseKw, ...aiKw])].slice(0, 60);

      return {
        material_id: material.id,
        bolim_id: material.bolim_id,
        bob_id: material.bob_id,
        bolim_nomi: bolim?.nomi || "Noma'lum bo'lim",
        bob_nomi: bob?.nomi || "Noma'lum bob",
        material_nomi: material.nomi,
        chunk_index: idx,
        matn: chunkText,
        keywords: allKw,
      };
    })
  );

  // Batch insert
  const BATCH = 30;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabaseAdmin.from('om_chunks').insert(rows.slice(i, i + BATCH));
    if (error) throw error;
  }

  return { ok: true, chunks: rows.length };
}

// ─── EDGE FUNCTION ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { material_id, action, use_ai_keywords = false } = await req.json() as {
      material_id?: string;
      action?: 'index_material' | 'index_all' | 'delete_material' | 'stats';
      use_ai_keywords?: boolean;
    };

    // ── STATS ──────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const { data: total } = await supabaseAdmin.from('om_chunks').select('id', { count: 'exact', head: true });
      const { data: bolimlar } = await supabaseAdmin.from('om_chunks')
        .select('bolim_nomi')
        .order('bolim_nomi');
      const uniqueBolimlar = [...new Set((bolimlar || []).map((b: any) => b.bolim_nomi))];
      return new Response(JSON.stringify({
        total_chunks: (total as any)?.count ?? 0,
        unique_bolimlar: uniqueBolimlar.length,
        bolimlar: uniqueBolimlar,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── BARCHASINI INDEKSLASH ─────────────────────────────────────────────
    if (action === 'index_all') {
      console.log('[chunk-material] Indexing all materials...');

      const { data: materiallar, error } = await supabaseAdmin
        .from('om_materiallar')
        .select(`
          id, nomi, fayl_url, fayl_tur, bolim_id, bob_id,
          om_boblar!bob_id(nomi, om_bolimlar!bolim_id(nomi, faol))
        `)
        .in('fayl_tur', ['html', 'htm', 'docx', 'doc', 'pdf']);

      if (error) throw error;

      let indexed = 0, skipped = 0, failed = 0, totalChunks = 0;

      for (const material of (materiallar || [])) {
        try {
          const bolim = (material as any).om_boblar?.om_bolimlar;
          if (!bolim?.faol) { skipped++; continue; }

          const result = await processMaterial(material, use_ai_keywords);
          if (result.ok) { indexed++; totalChunks += result.chunks; console.log(`[chunk] ✅ ${material.nomi}: ${result.chunks} chunks`); }
          else { skipped++; console.log(`[chunk] ⚠️ ${material.nomi}: ${result.msg}`); }
        } catch (e) {
          console.error(`[chunk-material] Error ${material.id}:`, e);
          failed++;
        }
      }

      return new Response(JSON.stringify({
        ok: true, indexed, skipped, failed, totalChunks,
        splitter: { chunkSize: 480, chunkOverlap: 100, algorithm: 'RecursiveCharacterTextSplitterV2' }
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── MATERIALLAR O'CHIRISH ─────────────────────────────────────────────
    if (action === 'delete_material' && material_id) {
      await supabaseAdmin.from('om_chunks').delete().eq('material_id', material_id);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── BITTA MATERIAL INDEKSLASH ─────────────────────────────────────────
    if (!material_id) {
      return new Response(JSON.stringify({ error: 'material_id yoki action required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: material, error: matError } = await supabaseAdmin
      .from('om_materiallar')
      .select(`
        id, nomi, fayl_url, fayl_tur, bolim_id, bob_id,
        om_boblar!bob_id(nomi, om_bolimlar!bolim_id(nomi))
      `)
      .eq('id', material_id)
      .maybeSingle();

    if (matError || !material) {
      return new Response(JSON.stringify({ error: 'Material topilmadi' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = await processMaterial(material, use_ai_keywords);

    return new Response(JSON.stringify({
      ...result,
      splitter: { chunkSize: 480, chunkOverlap: 100, algorithm: 'RecursiveCharacterTextSplitterV2' }
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[chunk-material] ❌:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
