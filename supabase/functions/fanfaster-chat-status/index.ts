// FanFaster AI Chat — job holatini polling qilish
// case-answer-status'ning alohida nusxasi. Moot Court bilan hech qanday umumiy kod/jadval yo'q.

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

const INSTRUCTION =
  "Siz professional O'zbekiston huquqshunosisiz. Quyida berilgan manbalar (qonun hujjatlari) asosida savolni huquqiy nuqtai nazardan tahlil qilib javob bering. Javob oxirida hech qanday savol bermang va taklif qilmang, faqat tahlilni yozing.";

function sanitizeAnswer(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bNotebookLM\b/gi, "manba")
    .replace(/\bGemini Notebook\b/gi, "manba")
    .replace(/\bNotebook\b/gi, "manba")
    .replace(/\s*\[\d+(?:\s*[-,]\s*\d+)*\]\s*/g, " ")
    .replace(/  +/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
}

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

function parseLexionUrls(answer: string): string[] {
  let urls: string[] = [];

  try {
    const parsed = JSON.parse(answer);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') urls.push(item);
      }
    }
  } catch { /* JSON emas */ }

  if (urls.length === 0) {
    const regex = /https?:\/\/(?:www\.)?lex\.uz\/docs\/-?\d+/g;
    const matches = answer.match(regex);
    if (matches) urls = matches;
  }

  const filtered = urls.filter(u => /^https?:\/\/(?:www\.)?lex\.uz\/docs\/-?\d+$/.test(u));

  const unique: string[] = [];
  for (const u of filtered) {
    if (!unique.includes(u)) unique.push(u);
    if (unique.length >= 15) break;
  }

  return unique;
}

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
    console.error("[chat-status] Tarmoq xatosi (backend " + backend + "):", fetchErr);
    return { serviceJobId: null, errorStatus: 0, errorMsg: "Tarmoq xatosi" };
  }
}

async function pickBackendSimple(cfg: BackendConfig): Promise<number> {
  if (!cfg.url2) return 1;
  return Math.random() < 0.5 ? 1 : 2;
}

// ── Fallback: Lexion ishlamasa, oddiy Render'ga yuborish ──
async function startFallbackGeneral(
  jobId: string,
  job: { savol: string; rejim: string | null; lexion_phase: string | null },
  _user_login: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getAnswerServiceConfig();
  if (!cfg.url || !cfg.key) {
    return { ok: false, error: "Javob tayyorlash xizmati hozir mavjud emas" };
  }

  const serviceBody: Record<string, unknown> = {
    title: "Savol",
    kazus_text: job.savol,
    external_id: `${jobId}-ans`,
    instruction: INSTRUCTION,
    sources: [],
  };

  const backend = await pickBackendSimple(cfg);
  const result = await sendToBackend(backend, cfg, serviceBody);

  if (result.serviceJobId) {
    await supabaseAdmin
      .from("fanfaster_chat_jobs")
      .update({
        render_id: backend,
        service_job_id: result.serviceJobId,
        status: "queued",
        lexion_fallback: true,
        lexion_phase: "answering",
        rejim: 'lexion',
      })
      .eq("id", jobId);
    return { ok: true };
  }

  return { ok: false, error: "Javob tayyorlanmadi. Qayta urinib ko'ring." };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { id, user_login } = body;

    if (!id || !user_login) {
      return new Response(
        JSON.stringify({ error: "Majburiy maydonlar yetishmayapti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("fanfaster_chat_jobs")
      .select("id, user_login, service_job_id, status, javob, error, render_id, rejim, lexion_job_id, lexion_urls, lexion_fallback, lexion_phase, savol, session_id")
      .eq("id", id)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job topilmadi" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.user_login !== user_login) {
      return new Response(
        JSON.stringify({ error: "Bu amal uchun ruxsat yo'q" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already done or error — return cached state
    if (job.status === "done") {
      return new Response(
        JSON.stringify({
          status: "done",
          answer: sanitizeAnswer(job.javob || ""),
          error: null,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status === "error" || job.status === "timeout") {
      return new Response(
        JSON.stringify({
          status: job.status,
          answer: null,
          error: job.error || "Xatolik yuz berdi",
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════
    // LEXION 1-BOSQICH: lexion_searching — Lexion xizmatidan URL'larni kutish
    // ════════════════════════════════════════════════════════════════
    if (job.rejim === 'lexion' && job.lexion_phase === 'lexion_searching' && job.lexion_job_id) {
      const lexionCfg = await getLexionConfig();

      if (!lexionCfg.url || !lexionCfg.key) {
        const errMsg = "Lexion rejimi hozir mavjud emas.";
        await supabaseAdmin
          .from("fanfaster_chat_jobs")
          .update({ status: "error", error: errMsg, lexion_phase: "error" })
          .eq("id", id);
        return new Response(
          JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const lexionRes = await fetch(
          `${lexionCfg.url}/api/jobs/${job.lexion_job_id}`,
          {
            method: "GET",
            headers: {
              "X-API-Key": lexionCfg.key,
              "Content-Type": "application/json",
            },
          }
        );

        if (!lexionRes.ok) {
          if (lexionRes.status === 404) {
            console.log(`[chat-status] Lexion job 404, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, user_login);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            await supabaseAdmin
              .from("fanfaster_chat_jobs")
              .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: "lexion_searching" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const lexionData = await lexionRes.json();
        const lexionStatus: string = (lexionData.status || "").toLowerCase();

        if (lexionStatus === "done" || lexionStatus === "completed" || lexionStatus === "success") {
          const lexionAnswer = typeof lexionData.answer === "string" ? lexionData.answer : "";
          const urls = parseLexionUrls(lexionAnswer);

          if (urls.length === 0) {
            console.log(`[chat-status] Lexion URL ro'yxati bo'sh, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, user_login);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            await supabaseAdmin
              .from("fanfaster_chat_jobs")
              .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          await supabaseAdmin
            .from("fanfaster_chat_jobs")
            .update({
              lexion_urls: JSON.stringify(urls),
              lexion_phase: "answering",
            })
            .eq("id", id);

          console.log(`[chat-status] Lexion 1-bosqich done: ${urls.length} ta URL, 2-bosqich: job=${id}`);

          const cfg = await getAnswerServiceConfig();
          if (!cfg.url || !cfg.key) {
            const errMsg = "Javob tayyorlash xizmati hozir mavjud emas";
            await supabaseAdmin
              .from("fanfaster_chat_jobs")
              .update({ status: "error", error: errMsg, lexion_phase: "error" })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const serviceSources = urls.map(u => ({ title: "Lex.uz hujjati", url: u }));

          const serviceBody: Record<string, unknown> = {
            title: "Savol",
            kazus_text: job.savol,
            external_id: `${id}-ans`,
            instruction: INSTRUCTION,
            sources: serviceSources,
          };

          const backend = await pickBackendSimple(cfg);
          const result = await sendToBackend(backend, cfg, serviceBody);

          if (result.serviceJobId) {
            await supabaseAdmin
              .from("fanfaster_chat_jobs")
              .update({
                render_id: backend,
                service_job_id: result.serviceJobId,
                status: "queued",
              })
              .eq("id", id);

            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          console.log(`[chat-status] Lexion 2-bosqich yuborilmadi, fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, user_login);
          if (fallbackResult.ok) {
            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          await supabaseAdmin
            .from("fanfaster_chat_jobs")
            .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (lexionStatus === "error" || lexionStatus === "failed") {
          console.log(`[chat-status] Lexion 1-bosqich xatosi, fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, user_login);
          if (fallbackResult.ok) {
            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          await supabaseAdmin
            .from("fanfaster_chat_jobs")
            .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: "lexion_searching" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchErr) {
        console.error("[chat-status] Lexion tarmoq xatosi:", fetchErr);
        return new Response(
          JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: "lexion_searching" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 2-BOSQICH (answering) yoki MANBA REJIMI — Render'ni polling qilish
    // ════════════════════════════════════════════════════════════════

    if (!job.service_job_id) {
      return new Response(
        JSON.stringify({
          status: job.status,
          answer: null,
          error: null,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = await getAnswerServiceConfig();
    const jobRender: number = job.render_id ?? 1;
    const backendUrl = getBackendUrl(cfg, jobRender);

    if (!backendUrl || !cfg.key) {
      return new Response(
        JSON.stringify({ status: "error", answer: null, error: "Javob tayyorlash xizmati hozir mavjud emas", lexion_phase: job.lexion_phase || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const serviceRes = await fetch(
        `${backendUrl}/api/jobs/${job.service_job_id}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": cfg.key,
            "Content-Type": "application/json",
          },
        }
      );

      if (!serviceRes.ok) {
        if (serviceRes.status === 404) {
          if (job.rejim === 'lexion' && job.lexion_phase === 'answering' && !job.lexion_fallback) {
            console.log(`[chat-status] Lexion 2-bosqich 404, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, user_login);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          const errMsg = "Javob tayyorlanmadi (xizmat qayta ishga tushgan). Qayta urinib ko'ring.";
          await supabaseAdmin
            .from("fanfaster_chat_jobs")
            .update({ status: "error", error: errMsg, lexion_phase: job.lexion_phase === 'answering' ? 'error' : null })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: job.lexion_phase || null }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: job.lexion_phase || null, lexion_fallback: job.lexion_fallback || false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serviceData = await serviceRes.json();
      const remoteStatus: string = (serviceData.status || "").toLowerCase();

      let newStatus = job.status;
      let answer: string | null = null;
      let errorMsg: string | null = null;

      if (remoteStatus === "done" || remoteStatus === "completed" || remoteStatus === "success") {
        newStatus = "done";
        answer = typeof serviceData.answer === "string" ? serviceData.answer : (typeof serviceData.result === "string" ? serviceData.result : null);
        if (!answer) {
          newStatus = "error";
          errorMsg = "Javob matni topilmadi";
        }
      } else if (remoteStatus === "error" || remoteStatus === "failed") {
        newStatus = "error";
        errorMsg = "Javob tayyorlanmadi. Qayta urinib ko'ring.";

        if (job.rejim === 'lexion' && job.lexion_phase === 'answering' && !job.lexion_fallback) {
          console.log(`[chat-status] Lexion 2-bosqich xatosi, fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, user_login);
          if (fallbackResult.ok) {
            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } else if (remoteStatus === "running" || remoteStatus === "processing") {
        newStatus = "running";
      } else if (remoteStatus === "queued" || remoteStatus === "pending") {
        newStatus = "queued";
      }

      // Persist updated state
      const updatePayload: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
      if (answer !== null) updatePayload.javob = answer;
      if (errorMsg !== null) updatePayload.error = errorMsg;
      if (newStatus === "done" || newStatus === "error") {
        updatePayload.finished_at = new Date().toISOString();
        if (job.lexion_phase) {
          updatePayload.lexion_phase = newStatus === "done" ? "done" : "error";
        }
      }

      await supabaseAdmin
        .from("fanfaster_chat_jobs")
        .update(updatePayload)
        .eq("id", id);

      return new Response(
        JSON.stringify({
          status: newStatus,
          answer: answer !== null ? sanitizeAnswer(answer) : null,
          error: errorMsg,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      console.error("[chat-status] Tarmoq xatosi:", fetchErr);
      return new Response(
        JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: job.lexion_phase || null, lexion_fallback: job.lexion_fallback || false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("[chat-status] Kutilmagan xato:", err);
    return new Response(
      JSON.stringify({ error: "Holatni aniqlab bo'lmadi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
