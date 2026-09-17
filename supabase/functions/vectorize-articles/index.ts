// vectorize-articles: batch vectorization using Gemini batchEmbedContents
// Optimized: single API call per batch, parallel fallback, bulk DB update, awaited self-call
// 429 quota errors leave articles pending (not marked as error) so they retry next batch
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BATCH_SIZE = 25;
const GEMINI_EMBED_MODEL = 'models/gemini-embedding-001';
const EMBED_DIMS = 768;
const MAX_TEXT_LEN = 8000;

interface BatchResult {
  values: number[] | null;
  error: string | null;
  isQuota: boolean;
}

async function batchEmbedAll(
  texts: string[],
  apiKey: string,
  maxRetries: number
): Promise<BatchResult[]> {
  const requests = texts.map((text) => ({
    model: GEMINI_EMBED_MODEL,
    content: { parts: [{ text: text.slice(0, MAX_TEXT_LEN) }] },
    taskType: 'RETRIEVAL_DOCUMENT',
    outputDimensionality: EMBED_DIMS,
  }));

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBED_MODEL}:batchEmbedContents?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify({ requests }),
        }
      );

      if (res.status === 429 || res.status === 503) {
        const errBody = await res.text().catch(() => '');
        const isQuota = res.status === 429 && errBody.includes('quota');
        const retryAfter = res.headers.get('Retry-After');
        let wait: number;
        if (retryAfter) {
          wait = Math.min(parseInt(retryAfter, 10) * 1000, 60000);
        } else {
          wait = isQuota
            ? Math.min(15000 * Math.pow(2, attempt), 60000)
            : Math.min(3000 * Math.pow(2, attempt), 10000);
        }
        console.log(`[vectorize-articles] 429/503 — kutish ${wait}ms (attempt ${attempt + 1}/${maxRetries})${isQuota ? ' [QUOTA]' : ''}`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`[vectorize-articles] HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        return texts.map(() => ({ values: null, error: `HTTP ${res.status}: ${errBody.slice(0, 150)}`, isQuota: false }));
      }

      const data = await res.json();
      const embeddings = data?.embeddings;
      if (Array.isArray(embeddings) && embeddings.length === texts.length) {
        return embeddings.map((e: any) => {
          const vals = e?.values;
          if (Array.isArray(vals) && vals.length > 0) return { values: vals, error: null, isQuota: false };
          return { values: null, error: "Bo'sh embedding", isQuota: false };
        });
      }

      return texts.map(() => ({ values: null, error: "Javob formati noto'g'ri", isQuota: false }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[vectorize-articles] xato:', msg);
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      } else {
        return texts.map(() => ({ values: null, error: msg.slice(0, 200), isQuota: false }));
      }
    }
  }
  // Barcha urinishlar tugadi — quota xatomi yoki oddiy xatomi?
  return texts.map(() => ({ values: null, error: 'Maksimal urinishlar tugadi', isQuota: true }));
}

async function singleEmbed(text: string, apiKey: string): Promise<BatchResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          model: GEMINI_EMBED_MODEL,
          content: { parts: [{ text: text.slice(0, MAX_TEXT_LEN) }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: EMBED_DIMS,
        }),
      }
    );
    if (!res.ok) {
      const errBody = await res.text();
      const isQuota = res.status === 429 && errBody.includes('quota');
      return { values: null, error: `HTTP ${res.status}: ${errBody.slice(0, 150)}`, isQuota };
    }
    const data = await res.json();
    const vals = data?.embedding?.values;
    if (Array.isArray(vals) && vals.length > 0) return { values: vals, error: null, isQuota: false };
    return { values: null, error: "Bo'sh javob", isQuota: false };
  } catch (e) {
    return { values: null, error: (e instanceof Error ? e.message : String(e)).slice(0, 200), isQuota: false };
  }
}

async function selfCallContinue(payload: Record<string, unknown>, delayMs?: number): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (delayMs && delayMs > 0) {
    console.log(`[vectorize-articles] self-call ${delayMs}ms dan keyin davom etadi...`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  try {
    await fetch(`${supabaseUrl}/functions/v1/vectorize-articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('[vectorize-articles] self-call xato:', e instanceof Error ? e.message : String(e));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json() as {
      kodeks_nomi?: string;
      retry_errors?: boolean;
      batch_size?: number;
      _chain?: boolean;
      _status_check?: boolean;
    };

    // Status-only mode for frontend polling
    if (body._status_check) {
      const kodeksNomi = body.kodeks_nomi;
      let q = supabaseAdmin
        .from('qonun_moddalari')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null)
        .is('embedding_error', null);
      if (kodeksNomi) q = q.eq('kodeks_nomi', kodeksNomi);
      const { count: remaining } = await q;

      const { data: statusRows } = await supabaseAdmin.rpc('get_vectorize_status');
      const status: Record<string, { total: number; vectorized: number; errors: number; pending: number }> = {};
      for (const row of statusRows || []) {
        status[row.kodeks_nomi] = {
          total: row.total,
          vectorized: row.vectorized,
          errors: row.errors,
          pending: row.pending,
        };
      }

      return new Response(
        JSON.stringify({
          done: (remaining ?? 0) === 0,
          processed: 0,
          errors: 0,
          remaining: remaining ?? 0,
          status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const kodeksNomi = body.kodeks_nomi;
    const retryErrors = body.retry_errors ?? false;
    const batchSize = Math.min(body.batch_size ?? BATCH_SIZE, 50);

    const { data: settingsData } = await supabaseAdmin
      .from('settings')
      .select('text_value')
      .eq('key', 'AI_MENTOR_API_KEY')
      .maybeSingle();

    const apiKey = settingsData?.text_value;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI API kaliti sozlanmagan (AI_MENTOR_API_KEY)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let query = supabaseAdmin
      .from('qonun_moddalari')
      .select('id, kodeks_nomi, modda_raqami, modda_matni')
      .is('embedding', null);

    if (kodeksNomi) {
      query = query.eq('kodeks_nomi', kodeksNomi);
    }

    if (retryErrors) {
      query = query.not('embedding_error', 'is', null);
    } else {
      query = query.is('embedding_error', null);
    }

    const { data: pending, error: fetchError } = await query
      .order('kodeks_nomi')
      .order('modda_raqami')
      .limit(batchSize);

    if (fetchError) {
      throw new Error(`So'rov xatosi: ${fetchError.message}`);
    }

    if (!pending || pending.length === 0) {
      let errQuery = supabaseAdmin
        .from('qonun_moddalari')
        .select('id', { count: 'exact', head: true })
        .is('embedding', null)
        .not('embedding_error', 'is', null);
      if (kodeksNomi) errQuery = errQuery.eq('kodeks_nomi', kodeksNomi);
      const { count: errorCount } = await errQuery;

      const { data: statusRows } = await supabaseAdmin.rpc('get_vectorize_status');
      const status: Record<string, { total: number; vectorized: number; errors: number; pending: number }> = {};
      for (const row of statusRows || []) {
        status[row.kodeks_nomi] = {
          total: row.total,
          vectorized: row.vectorized,
          errors: row.errors,
          pending: row.pending,
        };
      }

      return new Response(
        JSON.stringify({
          done: true,
          processed: 0,
          errors: 0,
          error_count: errorCount ?? 0,
          status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[vectorize-articles] ${pending.length} ta modda vektorlanmoqda (kodeks: ${kodeksNomi || 'barchasi'}, retry: ${retryErrors})`
    );

    const texts = pending.map(
      (a: any) => `${a.modda_raqami}-modda. ${a.modda_matni}`
    );

    // ─── 1-urinish: batchEmbedContents (bitta katta so'rov) ───
    let results: BatchResult[] = await batchEmbedAll(texts, apiKey, 3);

    // ─── 2-urinish: muvaffaqiyatsiz moddalar uchun parallel single fallback ───
    const failedIndices: number[] = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i].error && !results[i].values && !results[i].isQuota) failedIndices.push(i);
    }

    if (failedIndices.length > 0) {
      console.log(`[vectorize-articles] ${failedIndices.length} ta modda uchun parallel single fallback`);
      const fallbackResults = await Promise.all(
        failedIndices.map((i) => singleEmbed(texts[i], apiKey))
      );
      for (let j = 0; j < failedIndices.length; j++) {
        results[failedIndices[j]] = fallbackResults[j];
      }
    }

    // ─── Bulk DB yangilash ───
    const records: Array<{ id: string; embedding: string | null; error: string | null }> = [];
    let processed = 0;
    let errors = 0;
    let quotaHits = 0;
    const errorDetails: { modda_raqami: string; error: string }[] = [];

    for (let i = 0; i < pending.length; i++) {
      const article = pending[i];
      const result = results[i];
      if (result.values && result.values.length > 0) {
        records.push({
          id: article.id,
          embedding: `[${result.values.join(',')}]`,
          error: null,
        });
        processed++;
      } else if (result.isQuota) {
        // 429 quota — xato belgilamaymiz, pending qoldiramiz
        quotaHits++;
      } else if (result.error) {
        records.push({
          id: article.id,
          embedding: null,
          error: result.error.slice(0, 300),
        });
        errors++;
        errorDetails.push({ modda_raqami: article.modda_raqami, error: result.error });
      }
    }

    // Bulk update orqali bitta so'rovda hammasini yangilash
    if (records.length > 0) {
      const { error: bulkError } = await supabaseAdmin.rpc('bulk_update_embeddings', {
        p_records: JSON.stringify(records),
      });
      if (bulkError) {
        console.error('[vectorize-articles] bulk update xato:', bulkError.message);
        await Promise.all(records.map((rec) => {
          if (rec.embedding) {
            return supabaseAdmin
              .from('qonun_moddalari')
              .update({ embedding: rec.embedding, embedding_error: null, embedding_attempted_at: new Date().toISOString() })
              .eq('id', rec.id);
          } else {
            return supabaseAdmin
              .from('qonun_moddalari')
              .update({ embedding_error: rec.error, embedding_attempted_at: new Date().toISOString() })
              .eq('id', rec.id);
          }
        }));
      }
    }

    // ─── Qolgan moddalar soni (head count — tez) ───
    let moreQuery = supabaseAdmin
      .from('qonun_moddalari')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null)
      .is('embedding_error', null);
    if (kodeksNomi) moreQuery = moreQuery.eq('kodeks_nomi', kodeksNomi);
    const { count: remaining } = await moreQuery;

    const hasMore = (remaining ?? 0) > 0;

    // ─── Holat (RPC orqali tez) ───
    const { data: statusRows2 } = await supabaseAdmin.rpc('get_vectorize_status');
    const status: Record<string, { total: number; vectorized: number; errors: number; pending: number }> = {};
    for (const row of statusRows2 || []) {
      status[row.kodeks_nomi] = {
        total: row.total,
        vectorized: row.vectorized,
        errors: row.errors,
        pending: row.pending,
      };
    }

    console.log(
      `[vectorize-articles] batch yakun: processed=${processed}, errors=${errors}, quotaHits=${quotaHits}, qoldi=${remaining}`
    );

    if (hasMore) {
      // 429 bo'lsa, keyingi batch'ni 30s dan keyin boshlaymiz (kvota tiklanishi uchun)
      const delay = quotaHits > 0 ? 30000 : 0;
      console.log(`[vectorize-articles] ${remaining} ta qolgan — self-call${delay > 0 ? ` ${delay}ms dan keyin` : ''}...`);
      selfCallContinue({ kodeks_nomi: kodeksNomi, retry_errors: false, _chain: true, batch_size: batchSize }, delay);
    }

    return new Response(
      JSON.stringify({
        done: !hasMore,
        processed,
        errors,
        quota_hits: quotaHits,
        error_details: errorDetails,
        remaining: remaining ?? 0,
        status,
        batch_mode: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[vectorize-articles] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 200)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
