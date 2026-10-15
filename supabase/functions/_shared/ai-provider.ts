/**
 * Shared AI provider helper with retry, backoff, and Gemini <-> Groq fallback.
 *
 * Flow:
 * 1. Try Gemini. On 429/503, wait Retry-After (or exponential backoff), retry up to MAX_RETRIES_PER_PROVIDER.
 * 2. If Gemini still fails after retries, fall back to Groq with the same retry strategy.
 * 3. If Groq also fails after retries, try Gemini one final time.
 * 4. If all attempts fail, throw with a clear diagnostic.
 *
 * Concurrency is limited by MAX_CONCURRENT_AI_CALLS to avoid overwhelming rate limits.
 *
 * Logging: every AI call (success or failure) is logged to `ai_usage_log` with
 * full details: HTTP status, response time, token counts, rate-limit headers,
 * error body, and Retry-After value.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const GEMINI_DAILY_QUOTA = 1000;
const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';

// Retry config
const MAX_RETRIES_PER_PROVIDER = 3;
const BASE_BACKOFF_MS = 2000; // 2s base, doubles each retry
const MAX_BACKOFF_MS = 60000; // cap at 60s
const MAX_TOTAL_ATTEMPTS = 5; // across all providers

// Concurrency limiter
const MAX_CONCURRENT_AI_CALLS = 3;
let activeCallCount = 0;
const callQueue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (activeCallCount < MAX_CONCURRENT_AI_CALLS) {
    activeCallCount++;
    return;
  }
  await new Promise<void>(resolve => callQueue.push(resolve));
  activeCallCount++;
}

function releaseSlot(): void {
  activeCallCount--;
  const next = callQueue.shift();
  if (next) next();
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

// ─── DETAILED LOGGING ──────────────────────────────────────────────────────

interface CallLogDetail {
  provider: string;
  functionName: string;
  model: string;
  success: boolean;
  httpStatus?: number;
  responseMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  retryAfterSec?: number;
  rateLimitHeaders?: Record<string, string>;
  errorBody?: string;
  isTest?: boolean;
  attempt?: number;
}

async function logCallDetail(d: CallLogDetail) {
  try {
    await supabaseAdmin.from('ai_usage_log').insert({
      provider: d.provider,
      function_name: d.functionName,
      model: d.model,
      success: d.success,
      error_status: d.httpStatus && d.httpStatus >= 400 ? d.httpStatus : null,
      model_name: d.model,
      http_status: d.httpStatus ?? null,
      response_ms: d.responseMs ?? null,
      input_tokens: d.inputTokens ?? null,
      output_tokens: d.outputTokens ?? null,
      thinking_tokens: d.thinkingTokens ?? null,
      retry_after_sec: d.retryAfterSec ?? null,
      rate_limit_headers: d.rateLimitHeaders ?? null,
      error_body: d.errorBody ? d.errorBody.slice(0, 2000) : null,
      is_test: d.isTest ?? false,
    });
  } catch (e) {
    console.warn(`[ai-provider] logCallDetail xato:`, e);
  }
}

function extractRateLimitHeaders(headers: Headers): Record<string, string> {
  const rl: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk.startsWith('x-ratelimit') || lk === 'retry-after') {
      rl[lk] = value;
    }
  });
  return rl;
}

function parseRetryAfter(retryAfterRaw: string | null, errorBody: string): number | undefined {
  if (retryAfterRaw) {
    const parsed = parseFloat(retryAfterRaw);
    if (!isNaN(parsed)) return Math.min(Math.max(parsed, 1), 60);
  }
  // Gemini doesn't send Retry-After header, but puts "Please retry in Xs" in the body
  const bodyMatch = errorBody.match(/retry in ([\d.]+)s/i);
  if (bodyMatch) {
    const parsed = parseFloat(bodyMatch[1]);
    if (!isNaN(parsed)) return Math.min(Math.max(parsed, 1), 60);
  }
  return undefined;
}

function computeBackoff(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, MAX_BACKOFF_MS);
  }
  const exponential = BASE_BACKOFF_MS * Math.pow(2, attempt);
  return Math.min(exponential, MAX_BACKOFF_MS);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── CONFIG LOADERS ────────────────────────────────────────────────────────

export async function loadGeminiConfig(): Promise<AIConfig> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', ['AI_MENTOR_API_URL', 'AI_MENTOR_API_KEY', 'AI_MENTOR_MODEL']);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });
  return {
    apiUrl: map['AI_MENTOR_API_URL'] || '',
    apiKey: map['AI_MENTOR_API_KEY'] || '',
    model: map['AI_MENTOR_MODEL'] || 'gemini-3-flash-preview',
  };
}

export async function loadGroqConfig(): Promise<AIConfig | null> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', ['GROQ_API_KEY', 'GROQ_API_URL', 'GROQ_MODEL']);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });
  if (!map['GROQ_API_KEY']) return null;
  return {
    apiUrl: map['GROQ_API_URL'] || 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: map['GROQ_API_KEY'],
    model: map['GROQ_MODEL'] || GROQ_MODEL_DEFAULT,
  };
}

// ─── USAGE HELPERS ─────────────────────────────────────────────────────────

export async function getTodayUsage(): Promise<{ geminiCount: number; groqCount: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: geminiData } = await supabaseAdmin
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'gemini')
    .gte('created_at', `${today}T00:00:00Z`);
  const { data: groqData } = await supabaseAdmin
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'groq')
    .gte('created_at', `${today}T00:00:00Z`);
  return {
    geminiCount: (geminiData as any)?.length ?? 0,
    groqCount: (groqData as any)?.length ?? 0,
  };
}

// ─── GEMINI CALL ───────────────────────────────────────────────────────────

interface GeminiCallResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
}

async function callGemini(
  config: AIConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
  jsonMode: boolean,
): Promise<GeminiCallResult> {
  const modelPath = config.model.replace(/^google\//, '');
  const url = `${config.apiUrl}/${modelPath}:generateContent?key=${config.apiKey}`;
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));
  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
  if (jsonMode) body.generationConfig.responseMimeType = 'application/json';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    const err = new Error(`Gemini API [${res.status}]`);
    (err as any).status = res.status;
    (err as any).body = txt;
    (err as any).rateLimitHeaders = extractRateLimitHeaders(res.headers);
    (err as any).retryAfter = res.headers.get('retry-after');
    throw err;
  }
  const data = JSON.parse(txt);
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Gemini bo\'sh javob qaytardi');

  const usage = data?.usageMetadata || {};
  return {
    text: reply,
    inputTokens: usage.promptTokenCount ?? undefined,
    outputTokens: usage.candidatesTokenCount ?? undefined,
    thinkingTokens: usage.thoughtsTokenCount ?? undefined,
  };
}

// ─── GROQ CALL ─────────────────────────────────────────────────────────────

interface GroqCallResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

async function callGroq(
  config: AIConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
  jsonMode: boolean,
): Promise<GroqCallResult> {
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.text })),
  ];
  const body: any = {
    model: config.model,
    messages: formattedMessages,
    max_tokens: maxTokens,
    temperature,
  };
  const res = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    const err = new Error(`Groq API [${res.status}]`);
    (err as any).status = res.status;
    (err as any).body = txt;
    (err as any).rateLimitHeaders = extractRateLimitHeaders(res.headers);
    (err as any).retryAfter = res.headers.get('retry-after');
    throw err;
  }
  const data = JSON.parse(txt);
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Groq bo\'sh javob qaytardi');

  const usage = data?.usage || {};
  return {
    text: reply,
    inputTokens: usage.prompt_tokens ?? undefined,
    outputTokens: usage.completion_tokens ?? undefined,
  };
}

// ─── SINGLE PROVIDER CALL WITH RETRY ───────────────────────────────────────

interface ProviderCallParams {
  provider: 'gemini' | 'groq';
  config: AIConfig;
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
  functionName: string;
  isTest: boolean;
}

interface ProviderCallOutcome {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  retriesUsed: number;
  lastError?: any;
}

async function callProviderWithRetry(p: ProviderCallParams): Promise<ProviderCallOutcome> {
  let lastErr: any;
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
    const t0 = Date.now();
    try {
      let result: GeminiCallResult | GroqCallResult;
      if (p.provider === 'gemini') {
        result = await callGemini(p.config, p.systemPrompt, p.messages, p.maxTokens, p.temperature, p.jsonMode);
      } else {
        result = await callGroq(p.config, p.systemPrompt, p.messages, p.maxTokens, p.temperature, p.jsonMode);
      }
      const elapsed = Date.now() - t0;
      console.log(`[ai-provider] ${p.provider} OK in ${elapsed}ms (attempt ${attempt + 1}) | in=${result.inputTokens} out=${result.outputTokens}`);
      await logCallDetail({
        provider: p.provider,
        functionName: p.functionName,
        model: p.config.model,
        success: true,
        httpStatus: 200,
        responseMs: elapsed,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        thinkingTokens: (result as GeminiCallResult).thinkingTokens,
        isTest: p.isTest,
        attempt: attempt + 1,
      });
      return {
        text: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        thinkingTokens: (result as GeminiCallResult).thinkingTokens,
        retriesUsed: attempt,
      };
    } catch (err: any) {
      const elapsed = Date.now() - t0;
      const status = err.status || 0;
      const rlHeaders = err.rateLimitHeaders || {};
      const errBody = (err.body || err.message || '').slice(0, 2000);
      const retryAfterSec = parseRetryAfter(err.retryAfter ?? null, errBody);

      console.warn(`[ai-provider] ${p.provider} FAIL [${status}] attempt ${attempt + 1}/${MAX_RETRIES_PER_PROVIDER + 1} in ${elapsed}ms | retry-after=${retryAfterSec}s | body=${errBody.slice(0, 200)}`);

      await logCallDetail({
        provider: p.provider,
        functionName: p.functionName,
        model: p.config.model,
        success: false,
        httpStatus: status,
        responseMs: elapsed,
        retryAfterSec,
        rateLimitHeaders: rlHeaders,
        errorBody: errBody,
        isTest: p.isTest,
        attempt: attempt + 1,
      });

      lastErr = err;

      // Non-retryable errors (400, 401, 403) — don't retry
      if (status >= 400 && status < 500 && status !== 429) {
        break;
      }

      // If this was the last attempt, don't sleep
      if (attempt >= MAX_RETRIES_PER_PROVIDER) {
        break;
      }

      // Sleep before retry
      const backoff = computeBackoff(attempt, retryAfterSec);
      console.log(`[ai-provider] ${p.provider} retrying in ${backoff}ms (attempt ${attempt + 2})`);
      await sleep(backoff);
    }
  }

  // All retries exhausted
  const failErr = new Error(`${p.provider} failed after ${MAX_RETRIES_PER_PROVIDER + 1} attempts`);
  (failErr as any).lastError = lastErr;
  (failErr as any).provider = p.provider;
  throw failErr;
}

// ─── MAIN ENTRY POINT ──────────────────────────────────────────────────────

interface CallAIParams {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  functionName: string;
  /** If true, skip Gemini entirely and go straight to Groq */
  forceGroq?: boolean;
  /** If true, mark the log entry as a load-test call (is_test=true) */
  isTest?: boolean;
}

export async function callAIWithFallback(params: CallAIParams): Promise<{ text: string; provider: string }> {
  const {
    systemPrompt, messages, maxTokens = 1500, temperature = 0.6,
    jsonMode = false, functionName, forceGroq = false, isTest = false,
  } = params;

  const geminiConfig = await loadGeminiConfig();
  const groqConfig = await loadGroqConfig();

  // Check if Gemini quota is >= 90% — auto-route to Groq
  let shouldSkipGemini = forceGroq;
  if (!shouldSkipGemini && geminiConfig.apiUrl) {
    const { geminiCount } = await getTodayUsage();
    if (geminiCount >= GEMINI_DAILY_QUOTA * 0.9) {
      console.log(`[ai-provider] Gemini quota at ${geminiCount}/${GEMINI_DAILY_QUOTA} (>=90%), routing to Groq`);
      shouldSkipGemini = true;
    }
  }

  // Provider order: Gemini first (unless skipped), then Groq, then Gemini final
  const providers: { name: 'gemini' | 'groq'; config: AIConfig | null }[] = [];
  if (!shouldSkipGemini && geminiConfig.apiUrl && geminiConfig.apiKey) {
    providers.push({ name: 'gemini', config: geminiConfig });
  }
  if (groqConfig && groqConfig.apiKey) {
    providers.push({ name: 'groq', config: groqConfig });
  }
  // Final Gemini attempt (if it was the first and failed)
  if (!shouldSkipGemini && geminiConfig.apiUrl && geminiConfig.apiKey && providers.length > 1) {
    providers.push({ name: 'gemini', config: geminiConfig });
  }

  if (providers.length === 0) {
    throw new Error('AI sozlanmagan. Admin bilan bog\'laning.');
  }

  let lastError: any;
  let totalAttempts = 0;

  for (const p of providers) {
    if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
      console.warn(`[ai-provider] Max total attempts (${MAX_TOTAL_ATTEMPTS}) reached, stopping`);
      break;
    }

    await acquireSlot();
    try {
      console.log(`[ai-provider] Trying ${p.name} (total attempt ${totalAttempts + 1})`);
      const outcome = await callProviderWithRetry({
        provider: p.name,
        config: p.config!,
        systemPrompt,
        messages,
        maxTokens,
        temperature,
        jsonMode,
        functionName,
        isTest,
      });
      return { text: outcome.text, provider: p.name };
    } catch (err: any) {
      lastError = err;
      totalAttempts++;
      console.warn(`[ai-provider] ${p.name} exhausted, moving to next provider`);
    } finally {
      releaseSlot();
    }
  }

  // All providers failed
  const lastStatus = lastError?.lastError?.status || 0;
  const lastBody = (lastError?.lastError?.body || lastError?.message || '').slice(0, 300);
  throw new Error(`AI baholash amalga oshmadi (barcha provayderlar urinib bo'lingan). Oxirgi xato [${lastStatus}]: ${lastBody}`);
}
