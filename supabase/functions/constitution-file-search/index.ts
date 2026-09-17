// constitution-file-search: Konstitutsiya Q&A + barcha kodekslar uchun File Search setup
// GOOGLE_FILE_SEARCH provider orqali ishlashi uchun store yaratish va moddalarni yuklash
// Har bir modda alohida fayl sifatida yuklanadi (bitta katta fayl emas)
// MAVJUD tizimga (pgvector, vectorize-articles, import-legal-code) ta'sir qilmaydi

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = 'models/gemini-embedding-001';
const CHAT_MODEL = 'gemini-3.6-flash';

interface LegalArticle {
  id: string;
  kodeks_nomi: string;
  modda_raqami: string;
  modda_matni: string;
  bob_nomi?: string | null;
  manba_havola?: string | null;
}

// ─── Yordamchi: API kalitni olish ───
async function getApiKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'AI_MENTOR_API_KEY')
    .maybeSingle();
  return data?.text_value || null;
}

// ─── Yordamchi: File Search store yaratish ───
async function createStore(apiKey: string, displayName: string): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/fileSearchStores?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName,
      embeddingModel: EMBEDDING_MODEL,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Store yaratish xatosi [${res.status}]: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.name;
}

// ─── Yordamchi: Store ro'yxatini olish ───
async function listStores(apiKey: string): Promise<any[]> {
  const res = await fetch(`${GEMINI_BASE}/fileSearchStores?key=${apiKey}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.fileSearchStores || [];
}

// ─── Yordamchi: Store o'chirish ───
async function deleteStore(apiKey: string, storeName: string): Promise<void> {
  await fetch(`${GEMINI_BASE}/${storeName}?key=${apiKey}&force=true`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Yordamchi: Fayl yuklash (resumable upload) metadata bilan ───
async function uploadFile(
  apiKey: string,
  storeName: string,
  content: string,
  displayName: string,
  customMetadata?: Array<{ key: string; stringValue: string }>,
  chunkingConfig?: { whiteSpaceConfig: { maxTokensPerChunk: number; maxOverlapTokens: number } },
): Promise<any> {
  const numBytes = new TextEncoder().encode(content).length;

  const startBody: Record<string, unknown> = { displayName };
  if (customMetadata) startBody.customMetadata = customMetadata;
  if (chunkingConfig) startBody.chunkingConfig = chunkingConfig;

  // 1. Start resumable upload
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
    throw new Error(`Upload start xatosi [${startRes.status}]: ${txt.slice(0, 300)}`);
  }

  const uploadUrl = startRes.headers.get('x-goog-upload-url') || '';
  if (!uploadUrl) {
    throw new Error('Upload URL topilmadi');
  }

  // 2. Upload the actual content
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
    throw new Error(`Upload xatosi [${uploadRes.status}]: ${txt.slice(0, 300)}`);
  }

  const uploadData = await uploadRes.json();
  return uploadData;
}

// ─── Yordamchi: Operation holatini tekshirish ───
async function checkOperation(apiKey: string, operationName: string): Promise<boolean> {
  const res = await fetch(`${GEMINI_BASE}/${operationName}?key=${apiKey}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.done === true;
}

// ─── Yordamchi: Operation kutish ───
async function waitForOperation(apiKey: string, operationName: string, maxWaitMs = 120000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const done = await checkOperation(apiKey, operationName);
    if (done) return true;
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

// ─── SETUP: Konstitutsiya moddalarini alohida fayllar sifatida yuklash ───
async function setupConstitution(apiKey: string): Promise<any> {
  const { data: articles, error } = await supabaseAdmin
    .from('qonun_moddalari')
    .select('id, kodeks_nomi, modda_raqami, modda_matni, bob_nomi, manba_havola')
    .ilike('kodeks_nomi', '%konstitutsiya%')
    .order('modda_raqami', { ascending: true });

  if (error) throw new Error(`Baza xatosi: ${error.message}`);
  if (!articles || articles.length === 0) throw new Error('Konstitutsiya moddalari topilmadi');

  // Eski store'larni o'chirish
  const stores = await listStores(apiKey);
  for (const s of stores) {
    if (s.displayName?.includes('Konstitutsiya')) {
      console.log(`[constitution-file-search] Eski store o'chirilmoqda: ${s.name}`);
      await deleteStore(apiKey, s.name);
    }
  }

  const storeName = await createStore(apiKey, 'Konstitutsiya File Search (sinov)');
  console.log(`[constitution-file-search] Yangi store: ${storeName}`);

  // Har bir moddani alohida fayl sifatida yuklash
  let uploaded = 0;
  let errors = 0;
  for (const article of articles as LegalArticle[]) {
    try {
      const displayName = `Konstitutsiya - ${article.modda_raqami}-modda`;
      const metadata = [
        { key: 'kodeks_nomi', stringValue: article.kodeks_nomi },
        { key: 'modda_raqami', stringValue: article.modda_raqami },
      ];
      if (article.bob_nomi) metadata.push({ key: 'bob_nomi', stringValue: article.bob_nomi });
      if (article.manba_havola) metadata.push({ key: 'manba_havola', stringValue: article.manba_havola });

      await uploadFile(apiKey, storeName, article.modda_matni, displayName, metadata);
      uploaded++;
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`[constitution-file-search] upload xato (${article.modda_raqami}-modda):`, e)
      errors++;
    }
  }

  await supabaseAdmin
    .from('settings')
    .upsert({ key: 'CONSTITUTION_FILE_SEARCH_STORE', text_value: storeName }, { onConflict: 'key' });

  return {
    store_name: storeName,
    articles_count: articles.length,
    uploaded,
    errors,
  };
}

// ─── SETUP_ALL: Barcha 3 kodeksni alohida fayllar sifatida yuklash (batch) ───
async function setupAllKodeks(apiKey: string, offset: number, batchSize: number): Promise<any> {
  // Store ni olish yoki yaratish
  let storeName: string;
  const { data: existingStore } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'FILE_SEARCH_STORE')
    .maybeSingle();

  if (existingStore?.text_value) {
    storeName = existingStore.text_value;
    const stores = await listStores(apiKey);
    if (!stores.some((s: any) => s.name === storeName)) {
      storeName = await createStore(apiKey, 'Qonunlar bazasi File Search');
    }
  } else {
    if (offset === 0) {
      const stores = await listStores(apiKey);
      for (const s of stores) {
        if (s.displayName?.includes('Qonunlar bazasi')) {
          console.log(`[constitution-file-search] Eski store o'chirilmoqda: ${s.name}`);
          await deleteStore(apiKey, s.name);
        }
      }
    }
    storeName = await createStore(apiKey, 'Qonunlar bazasi File Search');
  }

  // Barcha moddalarni olish
  const { data: articles, error } = await supabaseAdmin
    .from('qonun_moddalari')
    .select('id, kodeks_nomi, modda_raqami, modda_matni, bob_nomi, manba_havola')
    .order('kodeks_nomi', { ascending: true })
    .order('modda_raqami', { ascending: true });

  if (error) throw new Error(`Baza xatosi: ${error.message}`);
  if (!articles) throw new Error('Moddalar topilmadi');

  const total = articles.length;
  const batch = (articles as LegalArticle[]).slice(offset, offset + batchSize);
  let uploaded = 0;
  let errors = 0;

  for (const article of batch) {
    try {
      const displayName = `${article.kodeks_nomi} - ${article.modda_raqami}-modda`;
      const metadata = [
        { key: 'kodeks_nomi', stringValue: article.kodeks_nomi },
        { key: 'modda_raqami', stringValue: article.modda_raqami },
      ];
      if (article.bob_nomi) metadata.push({ key: 'bob_nomi', stringValue: article.bob_nomi });
      if (article.manba_havola) metadata.push({ key: 'manba_havola', stringValue: article.manba_havola });

      await uploadFile(apiKey, storeName, article.modda_matni, displayName, metadata);
      uploaded++;
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`[constitution-file-search] upload xato (${article.kodeks_nomi} ${article.modda_raqami}):`, e)
      errors++;
    }
  }

  await supabaseAdmin
    .from('settings')
    .upsert({ key: 'FILE_SEARCH_STORE', text_value: storeName }, { onConflict: 'key' });

  const newOffset = offset + batchSize;
  const remaining = Math.max(0, total - newOffset);

  return {
    store_name: storeName,
    total,
    uploaded_in_batch: uploaded,
    errors_in_batch: errors,
    offset: newOffset,
    remaining,
    done: remaining === 0,
  };
}

// ─── SEARCH: File Search store orqali qidirish (Konstitutsiya Q&A) ───
async function searchConstitution(apiKey: string, query: string, storeName: string): Promise<any> {
  const res = await fetch(`${GEMINI_BASE}/interactions`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      input: query,
      tools: [{
        type: 'file_search',
        file_search_store_names: [storeName],
      }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Qidiruv xatosi [${res.status}]: ${txt.slice(0, 300)}`);
  }

  const data = await res.json();

  let answer = '';
  const steps = data?.steps;
  if (Array.isArray(steps) && steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    const contentArr = lastStep?.content;
    if (Array.isArray(contentArr)) {
      for (const part of contentArr) {
        if (part?.text) answer += part.text;
      }
    }
  }
  if (!answer) {
    answer = data?.output || data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  const sources: string[] = [];
  const grounding = data?.candidates?.[0]?.groundingMetadata;
  if (grounding?.groundingChunks) {
    for (const chunk of grounding.groundingChunks) {
      if (chunk.retrievedContext?.title) sources.push(chunk.retrievedContext.title);
      else if (chunk.retrievedContext?.text) sources.push(chunk.retrievedContext.text.slice(0, 100));
    }
  }

  return { answer, sources };
}

// ─── STATUS: Store holatini tekshirish ───
async function getStatus(apiKey: string): Promise<any> {
  const { data: setting } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'CONSTITUTION_FILE_SEARCH_STORE')
    .maybeSingle();

  const storeName = setting?.text_value || null;

  const { count } = await supabaseAdmin
    .from('qonun_moddalari')
    .select('*', { count: 'exact', head: true })
    .ilike('kodeks_nomi', '%konstitutsiya%');

  const { data: flagSetting } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'USE_GOOGLE_FILE_SEARCH_FOR_CONSTITUTION')
    .maybeSingle();

  const enabled = flagSetting?.text_value === 'true';

  let storeExists = false;
  if (storeName && apiKey) {
    const stores = await listStores(apiKey);
    storeExists = stores.some((s: any) => s.name === storeName);
  }

  // File Search Store (barcha kodekslar) holati
  const { data: allStoreSetting } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'FILE_SEARCH_STORE')
    .maybeSingle();

  let allStoreExists = false;
  if (allStoreSetting?.text_value && apiKey) {
    const stores = await listStores(apiKey);
    allStoreExists = stores.some((s: any) => s.name === allStoreSetting.text_value);
  }

  const { data: providerSetting } = await supabaseAdmin
    .from('settings')
    .select('text_value')
    .eq('key', 'SEARCH_PROVIDER')
    .maybeSingle();

  return {
    enabled,
    store_name: storeName,
    store_exists: storeExists,
    articles_count: count || 0,
    all_store_name: allStoreSetting?.text_value || null,
    all_store_exists: allStoreExists,
    search_provider: providerSetting?.text_value || 'pgvector',
  };
}

// ─── ASOSIY HANDLER ───
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      action: 'setup' | 'setup_all' | 'search' | 'status' | 'toggle' | 'cleanup';
      query?: string;
      enabled?: boolean;
      offset?: number;
      batch_size?: number;
    };

    const apiKey = await getApiKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API kalit sozlanmagan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SETUP: Konstitutsiyani yuklash (Q&A moduli uchun) ───
    if (body.action === 'setup') {
      console.log('[constitution-file-search] SETUP boshlandi');
      const result = await setupConstitution(apiKey);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SETUP_ALL: Barcha kodekslarni yuklash (find-relevant-articles uchun) ───
    if (body.action === 'setup_all') {
      const offset = body.offset || 0;
      const batchSize = Math.min(body.batch_size || 30, 50);
      console.log(`[constitution-file-search] SETUP_ALL boshlandi: offset=${offset}, batch=${batchSize}`);
      const result = await setupAllKodeks(apiKey, offset, batchSize);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SEARCH: Qidirish (Konstitutsiya Q&A) ───
    if (body.action === 'search') {
      if (!body.query || body.query.trim().length < 5) {
        return new Response(
          JSON.stringify({ error: 'So\'rov kamida 5 ta belgidan iborat bo\'lishi kerak' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: setting } = await supabaseAdmin
        .from('settings')
        .select('text_value')
        .eq('key', 'CONSTITUTION_FILE_SEARCH_STORE')
        .maybeSingle();

      const storeName = setting?.text_value;
      if (!storeName) {
        return new Response(
          JSON.stringify({ error: 'File Search store hali yaratilmagan. Avval setup qiling.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await searchConstitution(apiKey, body.query, storeName);
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── STATUS: Holatni tekshirish ───
    if (body.action === 'status') {
      const status = await getStatus(apiKey);
      return new Response(
        JSON.stringify(status),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── TOGGLE: Faollashtirish/o'chirish ───
    if (body.action === 'toggle') {
      const newValue = body.enabled ? 'true' : 'false';
      await supabaseAdmin
        .from('settings')
        .upsert({ key: 'USE_GOOGLE_FILE_SEARCH_FOR_CONSTITUTION', text_value: newValue }, { onConflict: 'key' });

      return new Response(
        JSON.stringify({ success: true, enabled: body.enabled }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── CLEANUP: Store'ni o'chirish ───
    if (body.action === 'cleanup') {
      const { data: setting } = await supabaseAdmin
        .from('settings')
        .select('text_value')
        .eq('key', 'CONSTITUTION_FILE_SEARCH_STORE')
        .maybeSingle();

      const storeName = setting?.text_value;
      if (storeName) {
        await deleteStore(apiKey, storeName);
        await supabaseAdmin.from('settings').delete().eq('key', 'CONSTITUTION_FILE_SEARCH_STORE');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Store o\'chirildi' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Noma\'lum action. Mavjud: setup, setup_all, search, status, toggle, cleanup' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[constitution-file-search] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: msg.slice(0, 500) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
