// find-relevant-articles: modda qidiruv — AI taxmin + SQL tekshiruv (asosiy)
// Fallback: Google File Search yoki pgvector (SEARCH_PROVIDER orqali tanlanadi)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ─── pgvector: embedding olish ───
async function getEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            model: 'models/gemini-embedding-001',
            content: { parts: [{ text: text.slice(0, 8000) }] },
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: 768,
          }),
        }
      );
      if (res.status === 429 || res.status === 503) {
        const wait = Math.min(3000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.error('[find-relevant-articles] embedding xato:', res.status, await res.text());
        return null;
      }
      const data = await res.json();
      const values = data?.embedding?.values;
      if (Array.isArray(values) && values.length > 0) return values;
      return null;
    } catch (e) {
      console.error(`[find-relevant-articles] embedding xato (attempt ${attempt + 1}):`, e);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

// ─── Google File Search: generateContent orqali grounding chunks olish ───
// File Search faqat QAYSI moddalar tegishli ekanini aniqlaydi.
// To'liq modda matni Supabase bazasidan olinadi.
async function fileSearchArticles(
  apiKey: string,
  storeName: string,
  query: string,
  maxResults: number,
): Promise<any[]> {
  const requestBody = {
    contents: [{
      parts: [{
        text: `Quyidagi huquqiy holatga tegishli barcha qonun moddalarini toping va har bir moddaning to'liq matnini ayting: ${query.slice(0, 2000)}`,
      }],
    }],
    tools: [{
      file_search: {
        file_search_store_names: [storeName],
      },
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 4096,
    },
  };

  // gemini-3.1-flash-lite — ishonchli ishlaydi, kam quota cheklovi
  let res: Response;
  try {
    res = await fetch(
      `${GEMINI_BASE}/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify(requestBody),
      }
    );
  } catch (e) {
    throw new Error(`File Search ulanish xatosi: ${String(e).slice(0, 200)}`);
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`File Search xatosi [${res.status}]: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();

  const groundingChunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  console.log(
    `[find-relevant-articles] file_search: ${Array.isArray(groundingChunks) ? groundingChunks.length : 0} grounding chunks`
  );
  if (!Array.isArray(groundingChunks) || groundingChunks.length === 0) {
    return [];
  }

  // 1-qadam: grounding chunks'dan metadata orqali nomzod moddalarni ajratish (deduplikatsiya)
  const candidates: Map<string, {
    kodeks: string; modda: string; bob: string | null; manba: string | null; similarity: number;
  }> = new Map();

  for (let i = 0; i < groundingChunks.length; i++) {
    const ctx = groundingChunks[i]?.retrievedContext;
    if (!ctx) continue;

    let kodeksNomi = '';
    let moddaRaqami = '';
    let bobNomi: string | null = null;
    let manbaHavola: string | null = null;

    if (Array.isArray(ctx.customMetadata)) {
      for (const m of ctx.customMetadata) {
        if (m.key === 'kodeks_nomi') kodeksNomi = (m.stringValue || '').trim();
        else if (m.key === 'modda_raqami') moddaRaqami = (m.stringValue || '').trim();
        else if (m.key === 'bob_nomi') bobNomi = m.stringValue || null;
        else if (m.key === 'manba_havola') manbaHavola = m.stringValue || null;
      }
    }

    // Fallback: title'dan ajratish
    if (!kodeksNomi || !moddaRaqami) {
      const title = ctx.title || '';
      const match = title.match(/^(.+?)\s*-\s*(\d+[A-Za-z]*)-modda/i);
      if (match) {
        if (!kodeksNomi) kodeksNomi = match[1].trim();
        if (!moddaRaqami) moddaRaqami = match[2].trim();
      }
    }

    if (!kodeksNomi || !moddaRaqami) continue;

    const dedupKey = `${kodeksNomi}::${moddaRaqami}`;
    if (!candidates.has(dedupKey)) {
      const similarity = Math.max(0.5, 1.0 - i * 0.05);
      candidates.set(dedupKey, {
        kodeks: kodeksNomi,
        modda: moddaRaqami,
        bob: bobNomi,
        manba: manbaHavola,
        similarity,
      });
    }
  }

  if (candidates.size === 0) return [];

  // 2-qadam: Supabase'dan to'liq modda matnini olish
  // kodeks_nomi bo'sh joy muammosi: bazada ba'zi qatorlarda boshida ortiqcha bo'sh joy bor
  // Shuning uchun ILIKE bilan qidiramiz — aniq .in() emas
  const candidateArray = Array.from(candidates.values());

  const dbMap: Map<string, any> = new Map();

  for (const c of candidateArray) {
    const searchKey = c.kodeks.replace(/[%_\\]/g, '\\$&');
    const { data: rows, error } = await supabaseAdmin
      .from('qonun_moddalari')
      .select('id, kodeks_nomi, modda_raqami, modda_matni, bob_nomi, manba_havola')
      .ilike('kodeks_nomi', `%${searchKey}%`)
      .eq('modda_raqami', c.modda)
      .limit(1);

    if (error) {
      console.error(`[find-relevant-articles] DB xato (${c.kodeks} ${c.modda}):`, error.message);
      continue;
    }

    if (rows && rows.length > 0) {
      const key = `${c.modda}`;
      if (!dbMap.has(key)) dbMap.set(key, rows[0]);
    }
  }

  // 3-qadam: natijani biriktirish — to'liq modda matni bilan
  const articles: any[] = [];
  for (const c of candidateArray) {
    const dbArt = dbMap.get(c.modda);

    const moddaMatni = dbArt?.modda_matni || '';
    const bobNomi = dbArt?.bob_nomi || c.bob || null;
    const manbaHavola = dbArt?.manba_havola || c.manba || null;
    const kodeksNomi = dbArt?.kodeks_nomi?.trim() || c.kodeks;

    articles.push({
      id: dbArt?.id || `fs_${c.modda}`,
      kodeks_nomi: kodeksNomi,
      modda_raqami: c.modda,
      modda_matni: moddaMatni,
      manba_havola: manbaHavola,
      bob_nomi: bobNomi,
      similarity: c.similarity,
      vector_score: c.similarity,
      text_score: c.similarity,
      match_type: 'file_search',
    });
  }

  // similarity bo'yicha kamayish tartibida saralash
  articles.sort((a, b) => b.similarity - a.similarity);

  return articles.slice(0, maxResults);
}

// ─── AI TAXMIN + SQL TEKSHIRUV (asosiy yo'l) ───
// 1-qadam: AI o'z bilimiga tayanib nomzod moddalarni taklif qiladi (arzon so'rov)
// 2-qadam: har bir taklifni bazada aniq tekshirish (SQL, AI kerak emas)
// 3-qadam: natijani "tasdiqlangan" va "umumiy_bilim" ga ajratish

interface AISuggestion {
  kodeks_nomi: string;
  modda_raqami: string;
}

async function aiSuggestArticles(description: string, maxResults: number): Promise<any[]> {
  const SYSTEM_PROMPT = [
    "Sen O'zbekiston qonunchiligi bo'yicha bilimga ega yordamchisan.",
    "Quyidagi huquqiy vaziyatga eng mos keladichi 5 tagacha aniq moddani (kodeks nomi + modda raqami) o'z bilginga tayanib taklif qil.",
    'Faqat JSON formatida qaytar: [{"kodeks_nomi": "...", "modda_raqami": "..."}]',
    'Kodeks nomlari to\'liq bo\'lsin (masalan: "Jinoyat kodeksi", "Fuqarolik kodeksi", "Ma\'muriy javobgarlik kodeksi").',
    'Modda raqamlari oddiy raqam bo\'lsin (masalan: "168", "216-2").',
  ].join('\n');

  let suggestions: AISuggestion[] = [];
  try {
    const { text: raw } = await callAIWithFallback({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: 'user', text: description.slice(0, 2000) }],
      maxTokens: 300,
      temperature: 0.2,
      functionName: 'find-relevant-articles-suggest',
    });

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      suggestions = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[find-relevant-articles] AI suggest xato:', e);
    return [];
  }

  if (!Array.isArray(suggestions) || suggestions.length === 0) return [];
  console.log(`[find-relevant-articles] AI taklif: ${suggestions.length} ta nomzod`);

  const articles: any[] = [];
  const seenKeys = new Set<string>();

  for (const s of suggestions.slice(0, maxResults)) {
    if (!s.kodeks_nomi || !s.modda_raqami) continue;

    const aiKodeks = String(s.kodeks_nomi).trim();
    const aiModda = String(s.modda_raqami).trim();

    const dedupKey = aiKodeks.toLowerCase() + '::' + aiModda;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    // ILIKE uchun maxsus belgilarni escape qilish
    const escapeIlke = (str: string) => str.replace(/[%_]/g, (ch) => '\\' + ch);
    const searchKodeks = escapeIlke(aiKodeks);

    // 1-urinish: aniq modda_raqami = aiModda
    let { data: rows } = await supabaseAdmin
      .from('qonun_moddalari')
      .select('id, kodeks_nomi, modda_raqami, modda_matni, bob_nomi, manba_havola')
      .ilike('kodeks_nomi', '%' + searchKodeks + '%')
      .eq('modda_raqami', aiModda)
      .limit(1);

    // 2-urinish: "216-2" ↔ "2162" konversiyasi
    if (!rows || rows.length === 0) {
      const altModda = aiModda.includes('-') ? aiModda.replace(/-/g, '') : null;

      if (altModda) {
        const r2 = await supabaseAdmin
          .from('qonun_moddalari')
          .select('id, kodeks_nomi, modda_raqami, modda_matni, bob_nomi, manba_havola')
          .ilike('kodeks_nomi', '%' + searchKodeks + '%')
          .eq('modda_raqami', altModda)
          .limit(1);
        if (r2.data && r2.data.length > 0) rows = r2.data;
      }

      // 3-urinish: "2162" → "216-2" (teskari konversiya)
      if ((!rows || rows.length === 0) && !aiModda.includes('-') && aiModda.length > 2) {
        const dashModda = aiModda.slice(0, -1) + '-' + aiModda.slice(-1);
        const r3 = await supabaseAdmin
          .from('qonun_moddalari')
          .select('id, kodeks_nomi, modda_raqami, modda_matni, bob_nomi, manba_havola')
          .ilike('kodeks_nomi', '%' + searchKodeks + '%')
          .eq('modda_raqami', dashModda)
          .limit(1);
        if (r3.data && r3.data.length > 0) rows = r3.data;
      }
    }

    if (rows && rows.length > 0) {
      const db = rows[0];
      articles.push({
        id: db.id,
        kodeks_nomi: (db.kodeks_nomi || '').trim(),
        modda_raqami: db.modda_raqami,
        modda_matni: db.modda_matni || '',
        manba_havola: db.manba_havola || null,
        bob_nomi: db.bob_nomi || null,
        similarity: 1.0,
        match_type: 'tasdiqlangan',
      });
      console.log('[find-relevant-articles] Tasdiqlangan: ' + aiKodeks + ' ' + aiModda + '-modda');
    } else {
      articles.push({
        id: ('ai_' + aiKodeks + '_' + aiModda).replace(/\s+/g, '_').toLowerCase(),
        kodeks_nomi: aiKodeks,
        modda_raqami: aiModda,
        modda_matni: 'Bu modda bazada tasdiqlanmagan. AI umumiy bilimiga tayanib taklif qildi.',
        manba_havola: null,
        bob_nomi: null,
        similarity: 0.5,
        match_type: 'umumiy_bilim',
      });
      console.log('[find-relevant-articles] Umumiy bilim: ' + aiKodeks + ' ' + aiModda + '-modda (bazada yoq)');
    }
  }

  // Tasdiqlangan moddalar avval, keyin umumiy_bilim
  articles.sort((a, b) => {
    if (a.match_type === 'tasdiqlangan' && b.match_type !== 'tasdiqlangan') return -1;
    if (a.match_type !== 'tasdiqlangan' && b.match_type === 'tasdiqlangan') return 1;
    return (b.similarity || 0) - (a.similarity || 0);
  });

  return articles;
}

// ─── ASOSIY HANDLER ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { description, limit } = await req.json() as { description: string; limit?: number };

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Tavsif majburiy (kamida 10 ta belgi)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxResults = Math.min(limit || 10, 20);

    // ─── Sozlamalarni olish ───
    const { data: settingsRows } = await supabaseAdmin
      .from('settings')
      .select('key, text_value')
      .in('key', ['AI_MENTOR_API_KEY', 'SEARCH_PROVIDER', 'FILE_SEARCH_STORE']);

    const settingsMap: Record<string, string> = {};
    for (const row of settingsRows || []) {
      if (row.text_value) settingsMap[row.key] = row.text_value;
    }

    const apiKey = settingsMap['AI_MENTOR_API_KEY'] || null;
    const searchProvider = settingsMap['SEARCH_PROVIDER'] || 'ai_suggest';
    const fileSearchStore = settingsMap['FILE_SEARCH_STORE'] || null;

    console.log(`[find-relevant-articles] provider=${searchProvider}, store=${fileSearchStore || 'yoq'}`);

    // ═══ AI TAXMIN + SQL TEKSHIRUV (asosiy yo'l — har doim birinchi) ═══
    try {
      const articles = await aiSuggestArticles(description, maxResults);
      console.log(`[find-relevant-articles] ai_suggest: ${articles.length} ta natija`);

      if (articles.length > 0) {
        return new Response(
          JSON.stringify({ articles }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[find-relevant-articles] ai_suggest natija yoq, fallback yo\'lga o\'tiladi');
    } catch (e) {
      console.error('[find-relevant-articles] ai_suggest xato, fallback:', e);
    }

    // ═══ GOOGLE FILE SEARCH yo'li (zaxira) ═══
    if (searchProvider === 'google_file_search' && fileSearchStore && apiKey) {
      try {
        const articles = await fileSearchArticles(apiKey, fileSearchStore, description, maxResults);
        console.log(`[find-relevant-articles] file_search: ${articles.length} ta natija`);

        if (articles.length === 0) {
          console.log('[find-relevant-articles] file_search natija yoq, pgvector fallback');
        } else {
          return new Response(
            JSON.stringify({ articles }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        console.error('[find-relevant-articles] file_search xato, pgvector fallback:', e);
      }
    }

    // ═══ PGVECTOR yo'li (standart yoki fallback) ═══
    let queryEmbedding: number[] | null = null;

    if (apiKey) {
      queryEmbedding = await getEmbedding(description, apiKey);
    }

    const embeddingStr = queryEmbedding ? `[${queryEmbedding.join(',')}]` : null;

    let results: any[] = [];

    if (embeddingStr) {
      const { data: hybridResults, error: hybridError } = await supabaseAdmin.rpc(
        'find_hybrid_articles',
        {
          query_embedding: embeddingStr,
          query_text: description,
          match_count: maxResults,
          vector_weight: 0.7,
          text_weight: 0.3,
        }
      );

      if (!hybridError && hybridResults) {
        results = hybridResults;
        console.log(`[find-relevant-articles] hybrid qidiruv: ${results.length} ta natija`);
      } else if (hybridError) {
        console.error('[find-relevant-articles] hybrid RPC xato:', hybridError.message);
      }
    } else if (!apiKey) {
      const { data: textResults, error: textError } = await supabaseAdmin.rpc(
        'find_hybrid_articles',
        {
          query_embedding: '[0,0,0,0,0,0,0,0]',
          query_text: description,
          match_count: maxResults,
          vector_weight: 0,
          text_weight: 1,
        }
      );

      if (!textError && textResults) {
        results = textResults;
        console.log(
          `[find-relevant-articles] faqat matn qidiruv (API kalit yoq): ${results.length} ta natija`
        );
      } else if (textError) {
        console.error('[find-relevant-articles] text RPC xato:', textError.message);
      }
    }

    const articles = results.map((a: any) => ({
      id: a.id,
      kodeks_nomi: a.kodeks_nomi,
      modda_raqami: a.modda_raqami,
      modda_matni: a.modda_matni,
      manba_havola: a.manba_havola,
      bob_nomi: a.bob_nomi,
      similarity: a.final_score ?? 0,
      vector_score: a.vector_score ?? 0,
      text_score: a.text_score ?? 0,
      match_type: a.match_type ?? 'hybrid',
    }));

    console.log(`[find-relevant-articles] yakuniy: ${articles.length} ta natija`);

    return new Response(
      JSON.stringify({ articles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[find-relevant-articles] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 200)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
