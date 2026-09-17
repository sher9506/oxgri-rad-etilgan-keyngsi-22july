// import-legal-code: lex.uz'dan kodeks import qilish
// 1) Sahifani yuklab oladi 2) Moddalarni ajratadi 3) Supabase bazasiga yozadi (TRIM bilan)
// 4) Google File Search Store'ga har bir moddani alohida yuklaydi
// 5) AI usage log'ga yozadi (kvota monitoringi uchun)
// Batch rejimida ishlaydi — necha marta bosib davom ettirish mumkin

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ─── Yordamchi: API kalitni olish ───
async function getApiKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'AI_MENTOR_API_KEY')
    .maybeSingle();
  return data?.text_value || null;
}

// ─── HTML yuklab olish ───
async function fetchPageHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FanFasterBot/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'uz,en;q=0.9',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Sahifa yuklab olinmadi (HTTP ${res.status})`);
  return await res.text();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»');
}

function extractKodeksName(html: string): string {
  const match = html.match(/<title[^>]*>\s*([\s\S]*?)\s*<\/title>/i);
  if (match) {
    const title = decodeEntities(match[1].replace(/<[^>]+>/g, '').trim());
    const kodeksMatch = title.match(
      /((?:O['']?zbekiston\s+)?(?:Fuqarolik|Jinoyat|Ma'muriy|Mehnat|Oilaviy|Soliq|Bank|Sug['']?urta|Eksport|Investitsiya|Davlat\s+xizmati|Advokatlik|Notariat|Prokuratura|Sud|Huquqbuzarliklar)\s+(?:kodeksi|qonuni))/i
    );
    if (kodeksMatch) return kodeksMatch[1].trim();
    const generalMatch = title.match(/(.+?)\s+kodeksi/i);
    if (generalMatch) return generalMatch[1].trim().slice(-60);
    return title.slice(0, 100);
  }
  return '';
}

interface ContentDiv {
  id: string;
  text: string;
}

function extractContentDivs(html: string): ContentDiv[] {
  const divs: ContentDiv[] = [];
  const pattern = /<div\s+name="(-?\d+)"\s+id="\1">([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const rawContent = match[2];
    const withSup = rawContent.replace(/<sup[^>]*>([^<]*)<\/sup>/gi, '-$1');
    const clean = decodeEntities(
      withSup.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
    );
    if (clean.length > 0) {
      divs.push({ id: match[1], text: clean });
    }
  }
  return divs;
}

const MODDA_PATTERN = /^(\d{1,4})(-\d{1,2})?\s*[-–—.]?\s*modda\s*[\.\s:]/i;
const BOB_PATTERN = /^(I{1,3}|IV|V|VI{0,3}|IX|X{0,3}|XI{0,3}|XII{0,3}|XIII|XIV|XV|XVI{0,3}|XVII{0,3}|XVIII|XIX|XX)\s*bob\b/i;
const BOLIM_PATTERN = /\bBO.{0,3}LIM\b/i;

function splitArticles(divs: ContentDiv[]): { modda_raqami: string; modda_matni: string; bob_nomi: string | null }[] {
  const articles: { modda_raqami: string; modda_matni: string; bob_nomi: string | null }[] = [];
  let currentNum: string | null = null;
  let currentParts: string[] = [];
  let currentBob: string | null = null;

  const flushCurrent = () => {
    if (currentNum !== null) {
      const fullText = currentParts.join('\n').trim();
      if (fullText.length > 0) {
        articles.push({ modda_raqami: currentNum, modda_matni: fullText, bob_nomi: currentBob });
      }
    }
    currentNum = null;
    currentParts = [];
  };

  for (const div of divs) {
    const text = div.text;

    if (BOB_PATTERN.test(text) && text.length < 200) {
      currentBob = text.split('\n')[0].trim().slice(0, 200);
      flushCurrent();
      continue;
    }

    if (BOLIM_PATTERN.test(text) && text.length < 100) {
      flushCurrent();
      continue;
    }

    const moddaMatch = text.match(MODDA_PATTERN);
    if (moddaMatch) {
      flushCurrent();
      currentNum = moddaMatch[2] ? moddaMatch[1] + moddaMatch[2] : moddaMatch[1];
      currentParts = [text];
      continue;
    }

    if (currentNum !== null) {
      currentParts.push(text);
    }
  }
  flushCurrent();

  return articles;
}

// ─── File Search Store: yordamchi funksiyalar ───

async function listStores(apiKey: string): Promise<any[]> {
  const res = await fetch(`${GEMINI_BASE}/fileSearchStores?key=${apiKey}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.fileSearchStores || [];
}

async function createStore(apiKey: string, displayName: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/fileSearchStores?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName,
      embeddingModel: 'models/gemini-embedding-001',
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Store yaratish xatosi [${res.status}]: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.name;
}

async function deleteStore(apiKey: string, storeName: string): Promise<void> {
  await fetch(`${GEMINI_BASE}/${storeName}?key=${apiKey}&force=true`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function uploadFileToStore(
  apiKey: string,
  storeName: string,
  content: string,
  displayName: string,
  customMetadata: Array<{ key: string; stringValue: string }>,
): Promise<boolean> {
  const numBytes = new TextEncoder().encode(content).length;

  const startBody: Record<string, unknown> = { displayName, customMetadata };

  const startRes = await fetch(
    `${GEMINI_BASE.replace('v1beta', 'upload/v1beta')}/${storeName}:uploadToFileSearchStore?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(numBytes),
        'X-Goog-Upload-Header-Content-Type': 'text/plain',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(startBody),
    }
  );

  if (!startRes.ok) {
    const txt = await startRes.text();
    throw new Error(`Upload start [${startRes.status}]: ${txt.slice(0, 200)}`);
  }

  const uploadUrl = startRes.headers.get('x-goog-upload-url') || '';
  if (!uploadUrl) throw new Error('Upload URL topilmadi');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(numBytes),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: content,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text();
    throw new Error(`Upload [${uploadRes.status}]: ${txt.slice(0, 200)}`);
  }

  return true;
}

async function getOrCreateStore(apiKey: string, recreate: boolean): Promise<string> {
  const { data: existingStore } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'FILE_SEARCH_STORE')
    .maybeSingle();

  if (existingStore?.text_value && !recreate) {
    const stores = await listStores(apiKey);
    if (stores.some((s: any) => s.name === existingStore.text_value)) {
      return existingStore.text_value;
    }
  }

  if (recreate) {
    const stores = await listStores(apiKey);
    for (const s of stores) {
      if (s.displayName?.includes('Qonunlar bazasi')) {
        console.log(`[import-legal-code] Eski store o'chirilmoqda: ${s.name}`);
        await deleteStore(apiKey, s.name);
      }
    }
  }

  const storeName = await createStore(apiKey, 'Qonunlar bazasi File Search');
  await supabaseAdmin
    .from('settings')
    .upsert({ key: 'FILE_SEARCH_STORE', text_value: storeName }, { onConflict: 'key' });

  console.log(`[import-legal-code] Yangi File Search store: ${storeName}`);
  return storeName;
}

// ─── ASOSIY HANDLER ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      url: string;
      forceReimport?: boolean;
      resume?: boolean;
      offset?: number;
      batchSize?: number;
    };

    if (!body.url || typeof body.url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'URL majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Noto\'g\'ri URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const offset = Math.max(0, body.offset || 0);
    const batchSize = Math.min(body.batchSize || 10, 10);
    const resume = body.resume || false;
    const forceReimport = resume ? false : (body.forceReimport || false);
    const isFirstBatch = offset === 0;

    console.log(`[import-legal-code] boshlandi: url=${parsedUrl.href}, offset=${offset}, batch=${batchSize}, force=${forceReimport}, resume=${resume}`);

    // ─── 1-QADAM: Sahifani yuklab olish va moddalarni ajratish ───
    const html = await fetchPageHtml(parsedUrl.href);
    const kodeksNomi = extractKodeksName(html).trim();
    if (!kodeksNomi) {
      return new Response(
        JSON.stringify({ error: 'Kodeks nomi topilmadi (sahifa tuzilishi noto\'g\'ri)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const divs = extractContentDivs(html);
    const allArticles = splitArticles(divs);

    if (allArticles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Moddalar topilmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-legal-code] ${kodeksNomi}: ${allArticles.length} ta modda topildi`);

    const batch = allArticles.slice(offset, offset + batchSize);

    // API kalitni olish
    const apiKey = await getApiKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI_MENTOR_API_KEY sozlamada topilmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── 2-QADAM: Supabase bazasiga yozish (batch rejimda) ───
    // Resume rejimida ham, forceReimport=false bo'lgani uchun o'chirish amalga oshmaydi
    if (isFirstBatch && forceReimport && !resume) {
      const { error: delError } = await supabaseAdmin
        .from('qonun_moddalari')
        .delete()
        .ilike('kodeks_nomi', `%${kodeksNomi.replace(/[%_]/g, '\\$&')}%`);
      if (delError) {
        console.error(`[import-legal-code] o'chirish xatosi:`, delError.message);
      }
    }

    let dbWritten = 0;
    let dbSkipped = 0;
    const dbErrors: string[] = [];
    const skippedRaqamlar = new Set<string>();

    // Barcha modda raqamlarini bir so'rovda tekshirish
    const moddaRaqamlari = batch.map(a => a.modda_raqami);
    const { data: existingRows } = await supabaseAdmin
      .from('qonun_moddalari')
      .select('id, modda_raqami')
      .ilike('kodeks_nomi', `%${kodeksNomi.replace(/[%_]/g, '\\$&')}%`)
      .in('modda_raqami', moddaRaqamlari);

    const existingMap = new Map<string, string>();
    for (const row of existingRows || []) {
      existingMap.set(row.modda_raqami, row.id);
    }

    const toInsert: Array<Record<string, unknown>> = [];
    const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

    for (const article of batch) {
      const existingId = existingMap.get(article.modda_raqami);

      if (existingId && !forceReimport) {
        dbSkipped++;
        skippedRaqamlar.add(article.modda_raqami);
        continue;
      }

      if (existingId && forceReimport) {
        toUpdate.push({
          id: existingId,
          data: {
            modda_matni: article.modda_matni,
            bob_nomi: article.bob_nomi,
            manba_havola: body.url,
          },
        });
        continue;
      }

      toInsert.push({
        kodeks_nomi: kodeksNomi,
        modda_raqami: article.modda_raqami,
        modda_matni: article.modda_matni,
        bob_nomi: article.bob_nomi,
        manba_havola: body.url,
        embedding: null,
      });
    }

    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('qonun_moddalari')
        .insert(toInsert);

      if (insertError) {
        dbErrors.push(`Batch insert xatosi: ${insertError.message}`);
      } else {
        dbWritten += toInsert.length;
      }
    }

    for (const upd of toUpdate) {
      const { error: updateError } = await supabaseAdmin
        .from('qonun_moddalari')
        .update(upd.data)
        .eq('id', upd.id);

      if (updateError) {
        dbErrors.push(`Update xatosi: ${updateError.message}`);
      } else {
        dbWritten++;
      }
    }

    // ─── 3-QADAM: File Search Store'ga yuklash ───
    // Resume rejimida allaqachon yozilgan moddalar File Search'ga qayta yuklanmaydi
    let fsUploaded = 0;
    let fsErrors = 0;
    let fsSkipped = 0;
    const fsErrorDetails: string[] = [];

    try {
      const storeName = await getOrCreateStore(apiKey, forceReimport && isFirstBatch);

      for (const article of batch) {
        if (skippedRaqamlar.has(article.modda_raqami)) {
          fsSkipped++;
          continue;
        }
        try {
          const displayName = `${kodeksNomi} - ${article.modda_raqami}-modda`;
          const metadata = [
            { key: 'kodeks_nomi', stringValue: kodeksNomi },
            { key: 'modda_raqami', stringValue: article.modda_raqami },
          ];
          if (article.bob_nomi) {
            metadata.push({ key: 'bob_nomi', stringValue: article.bob_nomi });
          }
          metadata.push({ key: 'manba_havola', stringValue: body.url });

          await uploadFileToStore(apiKey, storeName, article.modda_matni, displayName, metadata);
          fsUploaded++;
        } catch (e) {
          fsErrors++;
          const errMsg = e instanceof Error ? e.message : String(e);
          fsErrorDetails.push(`${article.modda_raqami}-modda: ${errMsg.slice(0, 150)}`);
          console.error(`[import-legal-code] FS upload xato (${article.modda_raqami}):`, errMsg.slice(0, 200));
        }
      }

      if (isFirstBatch) {
        const { data: providerSetting } = await supabaseAdmin
          .from('settings')
          .select('text_value')
          .eq('key', 'SEARCH_PROVIDER')
          .maybeSingle();

        if (!providerSetting?.text_value) {
          await supabaseAdmin
            .from('settings')
            .upsert({ key: 'SEARCH_PROVIDER', text_value: 'google_file_search' }, { onConflict: 'key' });
          console.log('[import-legal-code] SEARCH_PROVIDER = google_file_search ga o\'rnatildi');
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      fsErrorDetails.push(`Store xatosi: ${errMsg.slice(0, 200)}`);
      console.error('[import-legal-code] File Search store xatosi:', errMsg.slice(0, 300));
    }

    // ─── 3.5-QADAM: AI usage log yozish ───
    try {
      await supabaseAdmin.from('ai_usage_log').insert({
        provider: 'gemini',
        function_name: 'import-legal-code',
        model: 'gemini-embedding-001',
        success: fsErrors === 0,
      });
    } catch (logErr) {
      console.error('[import-legal-code] usage log xatosi:', logErr);
    }

    // ─── 4-QADAM: Hisobot ───
    const newOffset = offset + batchSize;
    const remaining = Math.max(0, allArticles.length - newOffset);
    const allErrors = [...dbErrors, ...fsErrorDetails];

    const report = {
      kodeks_nomi: kodeksNomi,
      total_found: allArticles.length,
      batch_start: offset + 1,
      batch_end: Math.min(offset + batchSize, allArticles.length),
      batch_size: batch.length,
      db_written: dbWritten,
      db_skipped: dbSkipped,
      file_search_uploaded: fsUploaded,
      file_search_errors: fsErrors,
      file_search_skipped: fsSkipped,
      errors: allErrors,
      offset: newOffset,
      remaining: remaining,
      done: remaining === 0,
      manba_havola: body.url,
    };

    console.log(
      `[import-legal-code] batch yakun: DB=${dbWritten}, FS=${fsUploaded}, qoldi=${remaining}`
    );

    return new Response(
      JSON.stringify(report),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[import-legal-code] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 200)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
