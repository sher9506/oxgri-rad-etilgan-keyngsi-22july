/**
 * Shared AI provider helper with Gemini → Groq fallback.
 * 
 * Usage:
 *   const { text, provider } = await callAIWithFallback({
 *     systemPrompt, messages, maxTokens, temperature, functionName,
 *   });
 * 
 * Groq is used as fallback when Gemini returns 429 (quota exhausted).
 * If GROQ_API_KEY is not configured, falls through to Gemini error.
 * Also auto-routes to Groq if today's Gemini usage is >= 90% of daily quota.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const GEMINI_DAILY_QUOTA = 1000; // estimated free-tier daily limit
const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-120b';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

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

async function logUsage(provider: string, functionName: string, model: string, success: boolean, errorStatus?: number) {
  try {
    await supabaseAdmin.from('ai_usage_log').insert({
      provider,
      function_name: functionName,
      model,
      success,
      error_status: errorStatus || null,
    });
  } catch (e) {
    console.warn(`[ai-provider] logUsage xato:`, e);
  }
}

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

async function callGemini(config: AIConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number, temperature: number, jsonMode: boolean): Promise<string> {
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
    throw err;
  }
  const data = JSON.parse(txt);
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Gemini bo\'sh javob qaytardi');
  return reply;
}

async function callGroq(config: AIConfig, systemPrompt: string, messages: ChatMessage[], maxTokens: number, temperature: number, jsonMode: boolean): Promise<string> {
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
  if (jsonMode) body.response_format = { type: 'json_object' };
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
    throw err;
  }
  const data = JSON.parse(txt);
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Groq bo\'sh javob qaytardi');
  return reply;
}

interface CallAIParams {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  functionName: string;
  /** If true, skip Gemini entirely and go straight to Groq (for quota preservation) */
  forceGroq?: boolean;
}

export async function callAIWithFallback(params: CallAIParams): Promise<{ text: string; provider: string }> {
  const { systemPrompt, messages, maxTokens = 1500, temperature = 0.6, jsonMode = false, functionName, forceGroq = false } = params;

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

  // Try Gemini first (unless skipped)
  if (!shouldSkipGemini && geminiConfig.apiUrl && geminiConfig.apiKey) {
    try {
      const text = await callGemini(geminiConfig, systemPrompt, messages, maxTokens, temperature, jsonMode);
      await logUsage('gemini', functionName, geminiConfig.model, true);
      return { text, provider: 'gemini' };
    } catch (err: any) {
      const status = err.status || 0;
      await logUsage('gemini', functionName, geminiConfig.model, false, status);
      if (status === 429) {
        console.log(`[ai-provider] Gemini 429, falling back to Groq`);
      } else {
        // Non-rate-limit error — still try Groq as fallback if available
        console.warn(`[ai-provider] Gemini error [${status}], trying Groq fallback`);
      }
    }
  }

  // Fallback to Groq
  if (groqConfig && groqConfig.apiKey) {
    try {
      const text = await callGroq(groqConfig, systemPrompt, messages, maxTokens, temperature, jsonMode);
      await logUsage('groq', functionName, groqConfig.model, true);
      return { text, provider: 'groq' };
    } catch (err: any) {
      const status = err.status || 0;
      await logUsage('groq', functionName, groqConfig.model, false, status);
      throw new Error(`Groq API xatosi [${status}]: ${(err.body || err.message || '').slice(0, 200)}`);
    }
  }

  // No providers available
  if (shouldSkipGemini) {
    throw new Error('AI provayderlar mavjud emas. GROQ_API_KEY sozlanmagan.');
  }
  throw new Error('AI sozlanmagan. Admin bilan bog\'laning.');
}
