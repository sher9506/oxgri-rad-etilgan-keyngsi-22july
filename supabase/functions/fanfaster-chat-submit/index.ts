// FanFaster AI Chat — savol yuborish (Render xizmatiga)
// case-answer-submit'ning alohida nusxasi. Moot Court bilan hech qanday umumiy kod/jadval yo'q.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const MAX_SAVOL_LENGTH = 12000;
const MAX_SOURCES = 18;
const MAX_SOURCE_TEXT_LENGTH = 100000;
const MAX_SOURCE_TITLE_LENGTH = 120;
const STATS_TIMEOUT_MS = 4000;

const INSTRUCTION =
  "Siz professional O'zbekiston huquqshunosisiz. Quyidagi savolni huquqiy nuqtai nazardan tahlil qilib javob bering. Javob oxirida hech qanday savol bermang va taklif qilmang, faqat tahlilni yozing.";

interface SourceInput {
  type: 'text' | 'url' | 'file';
  title?: string;
  content?: string;
  url?: string;
}

const MIN_SOURCE_TEXT_LENGTH = 20;

function validateSources(sources: unknown): SourceInput[] {
  if (!Array.isArray(sources)) return [];
  const result: SourceInput[] = [];
  for (let i = 0; i < sources.length && result.length < MAX_SOURCES; i++) {
    const s = sources[i] as Record<string, unknown>;
    if (!s || typeof s !== 'object') continue;
    const type = s.type;
    if (type !== 'text' && type !== 'url' && type !== 'file') continue;
    let title = typeof s.title === 'string' ? s.title.trim().slice(0, MAX_SOURCE_TITLE_LENGTH) : '';
    if (!title) title = `Manba ${i + 1}`;

    if (type === 'text') {
      const content = typeof s.content === 'string' ? s.content : '';
      if (!content.trim()) continue;
      if (content.length > MAX_SOURCE_TEXT_LENGTH) continue;
      if (content.trim().length < MIN_SOURCE_TEXT_LENGTH) continue;
      result.push({ type: 'text', title, content });
    } else if (type === 'url') {
      const url = typeof s.url === 'string' ? s.url.trim() : '';
      if (!url.match(/^https?:\/\/.+/i)) continue;
      result.push({ type: 'url', title, url });
    } else if (type === 'file') {
      const content = typeof s.content === 'string' ? s.content : '';
      const url = typeof s.url === 'string' ? s.url.trim() : '';
      if (url) {
        result.push({ type: 'file', title, url });
      } else if (content.trim() && content.length >= MIN_SOURCE_TEXT_LENGTH) {
        result.push({ type: 'file', title, content });
      }
    }
  }
  return result;
}

// ── Settings'dan Render konfiguratsiyasi (faqat O'QISH) ──
interface BackendConfig {
  url: string;
  key: string;
  url2: string;
}

async function getAnswerServiceConfig(): Promise<BackendConfig> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, text_value")
    .in("key", ["ANSWER_SERVICE_URL", "ANSWER_SERVICE_KEY", "ANSWER_SERVICE_URL_2"]);
  if (error || !data) return { url: "", key: "", url2: "" };
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.text_value) map[row.key] = row.text_value;
  }
  return {
    url: map["ANSWER_SERVICE_URL"] || "",
    key: map["ANSWER_SERVICE_KEY"] || "",
    url2: (map["ANSWER_SERVICE_URL_2"] || "").trim(),
  };
}

function getBackendUrl(cfg: BackendConfig, backend: number): string {
  if (backend === 2 && cfg.url2) return cfg.url2;
  return cfg.url;
}

async function getLexionConfig(): Promise<{ url: string; key: string }> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, text_value")
    .in("key", ["LEXION_RENDER_URL", "LEXION_RENDER_API_KEY"]);
  if (error || !data) return { url: "", key: "" };
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.text_value) map[row.key] = row.text_value;
  }
  return {
    url: (map["LEXION_RENDER_URL"] || "").trim(),
    key: (map["LEXION_RENDER_API_KEY"] || "").trim(),
  };
}

// ── Render /api/stats orqali backend tanlash ──
interface RenderStats {
  queue_size: number;
  active: number;
}

async function fetchRenderStats(baseUrl: string, key: string): Promise<RenderStats | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
    const res = await fetch(`${baseUrl}/api/stats`, {
      method: "GET",
      headers: { "X-API-Key": key },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const queueSize = typeof data.queue_size === 'number' ? data.queue_size : 0;
    const accounts = data.accounts || {};
    let active = 0;
    for (const _profile of Object.keys(accounts)) {
      active += 2;
    }
    return { queue_size: queueSize, active };
  } catch {
    return null;
  }
}

async function pickBackendByStats(cfg: BackendConfig): Promise<number> {
  if (!cfg.url2) return 1;

  const [stats1, stats2] = await Promise.all([
    fetchRenderStats(cfg.url, cfg.key),
    fetchRenderStats(cfg.url2, cfg.key),
  ]);

  if (stats1 && !stats2) return 1;
  if (stats2 && !stats1) return 2;
  if (!stats1 && !stats2) return 1;

  const load1 = (stats1!.queue_size + stats1!.active);
  const load2 = (stats2!.queue_size + stats2!.active);

  if (load1 < load2) return 1;
  if (load2 < load1) return 2;
  return Math.random() < 0.5 ? 1 : 2;
}

// ── Render'ga so'rov yuborish ──
interface ServiceResult {
  serviceJobId: string | null;
  errorStatus?: number;
  errorMsg?: string;
}

async function sendToBackend(
  backend: number,
  cfg: BackendConfig,
  serviceBody: Record<string, unknown>
): Promise<ServiceResult> {
  const baseUrl = getBackendUrl(cfg, backend);
  try {
    const serviceRes = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "X-API-Key": cfg.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serviceBody),
    });

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "");
      let errMsg = "Xizmat javob bermadi";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error) errMsg = String(errJson.error).slice(0, 300);
        else if (errJson?.detail) errMsg = String(errJson.detail).slice(0, 300);
      } catch { if (errText) errMsg = errText.slice(0, 300); }
      return { serviceJobId: null, errorStatus: serviceRes.status, errorMsg: errMsg };
    }

    const serviceData = await serviceRes.json();
    return { serviceJobId: serviceData.job_id ?? null };
  } catch (fetchErr) {
    console.error("[chat-submit] Tarmoq xatosi (backend " + backend + "):", fetchErr);
    return { serviceJobId: null, errorStatus: 0, errorMsg: "Tarmoq xatosi" };
  }
}

async function sendToLexion(
  lexionCfg: { url: string; key: string },
  serviceBody: Record<string, unknown>
): Promise<ServiceResult> {
  try {
    const serviceRes = await fetch(`${lexionCfg.url}/api/jobs`, {
      method: "POST",
      headers: {
        "X-API-Key": lexionCfg.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serviceBody),
    });

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "");
      let errMsg = "Xizmat javob bermadi";
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error) errMsg = String(errJson.error).slice(0, 300);
        else if (errJson?.detail) errMsg = String(errJson.detail).slice(0, 300);
      } catch { if (errText) errMsg = errText.slice(0, 300); }
      return { serviceJobId: null, errorStatus: serviceRes.status, errorMsg: errMsg };
    }

    const serviceData = await serviceRes.json();
    return { serviceJobId: serviceData.job_id ?? null };
  } catch (fetchErr) {
    console.error("[chat-submit] Lexion tarmoq xatosi:", fetchErr);
    return { serviceJobId: null, errorStatus: 0, errorMsg: "Tarmoq xatosi" };
  }
}

function isServerError(status: number): boolean {
  return status === 0 || (status >= 500);
}

// ── Admin rol tekshiruvi ──
async function isAdmin(userLogin: string): Promise<boolean> {
  if (!userLogin) return false;
  try {
    const { data } = await supabaseAdmin
      .from('talabalar')
      .select('rol')
      .eq('login', userLogin)
      .maybeSingle();
    return data?.rol === 'admin';
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { savol, user_login, session_id, rejim, sources } = body;
    const chatRejim: string = rejim || 'lexion';

    if (!savol || !user_login) {
      return new Response(
        JSON.stringify({ error: "Majburiy maydonlar yetishmayapti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (savol.length > MAX_SAVOL_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Savol matni 12000 belgidan oshmasligi kerak" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // LEXION REJIMI — 1-bosqich: lex.uz qonun hujjatlarini topish
    // ════════════════════════════════════════════════════════════════
    if (chatRejim === 'lexion') {
      const lexionCfg = await getLexionConfig();
      if (!lexionCfg.url || !lexionCfg.key) {
        return new Response(
          JSON.stringify({ error: "Lexion rejimi hozir mavjud emas. Boshqa rejim tanlang." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: jobRow, error: jobError } = await supabaseAdmin
        .from("fanfaster_chat_jobs")
        .insert({
          user_login,
          session_id: session_id || null,
          rejim: 'lexion',
          savol,
          status: "queued",
          sources: JSON.stringify([]),
          lexion_phase: 'lexion_searching',
        })
        .select("id")
        .single();

      if (jobError || !jobRow) {
        console.error("[chat-submit] Job yaratilmadi:", jobError?.message);
        return new Response(
          JSON.stringify({ error: "Job yaratilmadi" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const jobId = jobRow.id;
      const lexionBody: Record<string, unknown> = {
        title: "Lexion",
        kazus_text: savol,
        external_id: `${jobId}-lex`,
      };

      console.log(`[chat-submit] Lexion 1-bosqich: external_id=${jobId}-lex`);
      const lexionResult = await sendToLexion(lexionCfg, lexionBody);

      if (lexionResult.serviceJobId) {
        await supabaseAdmin
          .from("fanfaster_chat_jobs")
          .update({
            lexion_job_id: lexionResult.serviceJobId,
            status: "queued",
          })
          .eq("id", jobId);

        return new Response(
          JSON.stringify({ id: jobId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Lexion 1-bosqich xato — Umumiy rejimga fallback
      console.log(`[chat-submit] Lexion 1-bosqich xatosi, fallback: external_id=${jobId}`);

      const cfg = await getAnswerServiceConfig();
      if (!cfg.url || !cfg.key) {
        await supabaseAdmin
          .from("fanfaster_chat_jobs")
          .update({ status: "error", error: "Javob tayyorlash xizmati hozir mavjud emas", lexion_phase: "error" })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ error: "Javob tayyorlash xizmati hozir mavjud emas" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const fallbackBody: Record<string, unknown> = {
        title: "Savol",
        kazus_text: savol,
        external_id: `${jobId}-ans`,
        instruction: INSTRUCTION,
        sources: [],
      };

      const backend = await pickBackendByStats(cfg);
      const fallbackResult = await sendToBackend(backend, cfg, fallbackBody);

      if (fallbackResult.serviceJobId) {
        await supabaseAdmin
          .from("fanfaster_chat_jobs")
          .update({
            render_id: backend,
            service_job_id: fallbackResult.serviceJobId,
            status: "queued",
            lexion_fallback: true,
            lexion_phase: "answering",
            rejim: 'lexion',
          })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ id: jobId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userMsg = "Javob tayyorlanmadi. Qayta urinib ko'ring.";
      await supabaseAdmin
        .from("fanfaster_chat_jobs")
        .update({ status: "error", error: userMsg, lexion_phase: "error" })
        .eq("id", jobId);
      return new Response(
        JSON.stringify({ error: userMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // MANBA REJIMI — foydalanuvchi manbalari bilan
    // ════════════════════════════════════════════════════════════════
    const validSources = validateSources(sources);
    if (Array.isArray(sources) && sources.length > MAX_SOURCES) {
      return new Response(
        JSON.stringify({ error: "Ko'pi bilan 18 ta manba qo'shish mumkin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (Array.isArray(sources) && sources.length > 0 && validSources.length === 0) {
      return new Response(
        JSON.stringify({ error: "Yuklangan manbalardan matn topilmadi." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = await getAnswerServiceConfig();
    if (!cfg.url || !cfg.key) {
      return new Response(
        JSON.stringify({ error: "Javob tayyorlash xizmati hozir mavjud emas" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceSources: { title: string; content?: string; url?: string }[] = [];
    for (const s of validSources) {
      if (s.type === 'url') {
        serviceSources.push({ title: s.title, url: s.url });
      } else if (s.type === 'file' && s.url) {
        serviceSources.push({ title: s.title, url: s.url });
      } else {
        serviceSources.push({ title: s.title, content: s.content });
      }
    }

    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("fanfaster_chat_jobs")
      .insert({
        user_login,
        session_id: session_id || null,
        rejim: 'manba',
        savol,
        status: "queued",
        sources: JSON.stringify(validSources),
      })
      .select("id")
      .single();

    if (jobError || !jobRow) {
      console.error("[chat-submit] Job yaratilmadi:", jobError?.message);
      return new Response(
        JSON.stringify({ error: "Job yaratilmadi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobId = jobRow.id;

    console.log(`[chat-submit] manba rejimi: external_id=${jobId} | ${validSources.length} ta manba`);

    const backend = await pickBackendByStats(cfg);
    console.log(`[chat-submit] backend=${backend} tanlandi, external_id=${jobId}`);

    const serviceBody: Record<string, unknown> = {
      title: "Savol",
      kazus_text: savol,
      external_id: jobId,
      instruction: INSTRUCTION,
      sources: serviceSources,
    };

    // ── Birinchi urinish ──
    let result = await sendToBackend(backend, cfg, serviceBody);

    // ── Failover: faqat 5xx / tarmoq xatosi bo'lsa, ikkinchi backend'ga ──
    if (!result.serviceJobId && isServerError(result.errorStatus ?? 0) && cfg.url2) {
      const fallbackBackend = backend === 1 ? 2 : 1;
      console.log(`[chat-submit] backend=${backend} yiqildi, failover -> backend=${fallbackBackend}, external_id=${jobId}`);
      result = await sendToBackend(fallbackBackend, cfg, serviceBody);
      if (result.serviceJobId) {
        await supabaseAdmin
          .from("fanfaster_chat_jobs")
          .update({ render_id: fallbackBackend, service_job_id: result.serviceJobId, status: "queued" })
          .eq("id", jobId);
      }
    } else if (result.serviceJobId) {
      await supabaseAdmin
        .from("fanfaster_chat_jobs")
        .update({ render_id: backend, service_job_id: result.serviceJobId, status: "queued" })
        .eq("id", jobId);
    }

    if (!result.serviceJobId) {
      const userMsg = "Javob tayyorlanmadi. Qayta urinib ko'ring.";
      await supabaseAdmin
        .from("fanfaster_chat_jobs")
        .update({ status: "error", error: userMsg })
        .eq("id", jobId);
      return new Response(
        JSON.stringify({ error: userMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ id: jobId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[chat-submit] Kutilmagan xato:", err);
    return new Response(
      JSON.stringify({ error: "Javob tayyorlanmadi. Qayta urinib ko'ring." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
