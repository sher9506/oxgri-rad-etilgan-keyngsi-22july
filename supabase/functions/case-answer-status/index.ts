// Lexion phase polling support (parser fix: whitespace + New conversation handling)

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
  "Siz professional O'zbekiston huquqshunosisiz. Quyida berilgan manbalar (qonun hujjatlari) asosida kazusni IRAC (Issue, Rule, Application, Conclusion) usulida tahlil qilib yeching. Javob oxirida hech qanday savol bermang va taklif qilmang, faqat tahlilni yozing.";

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

// ── Lexion URL parser — answer maydonidan lex.uz/docs/<id> havolalarini ajratib oladi ──
export function parseLexionUrls(answer: string): string[] {
  let urls: string[] = [];
  const normalizedAnswer = answer.replace(/\s+/g, "");

  // 1. JSON.parse urinishi
  try {
    const parsed = JSON.parse(normalizedAnswer);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === 'string') urls.push(item);
      }
    }
  } catch {
    // JSON emas — regex'ga o'tamiz
  }

  // 2. Regex fallback
  if (urls.length === 0) {
    const regex = /https?:\/\/lex\.uz\/docs\/-?\d+/g;
    const matches = normalizedAnswer.match(regex);
    if (matches) urls = matches;
  }

  // 3. Faqat lex.uz/docs/<raqam> yoki docs/-<raqam> ko'rinishini qoldir
  const filtered = urls.filter(u => /^https?:\/\/lex\.uz\/docs\/-?\d+$/.test(u));

  // 4. Dublikatlarni olib tashla, tartibni saqla, ko'pi bilan 15 ta
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
      let errMsg = "Tashqi xizmat javob bermadi";
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
    console.error("[case-answer-status] Tarmoq xatosi (backend " + backend + "):", fetchErr);
    return { serviceJobId: null, errorStatus: 0, errorMsg: "Tarmoq xatosi" };
  }
}

function isServerError(status: number): boolean {
  return status === 0 || (status >= 500);
}

const ACTIVE_STATUSES = ["queued", "running"];
const STALE_MS = 10 * 60 * 1000;

async function pickBackend(cfg: BackendConfig): Promise<number> {
  if (!cfg.url2) return 1;

  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from("case_answer_jobs")
    .select("backend, created_at")
    .in("status", ACTIVE_STATUSES)
    .gte("created_at", cutoff);

  if (error || !data) return 1;

  let count1 = 0;
  let count2 = 0;
  let lastBackend = 1;

  for (const row of data) {
    const b = row.backend ?? 1;
    if (b === 2) count2++;
    else count1++;
    lastBackend = b;
  }

  if (count1 < count2) return 1;
  if (count2 < count1) return 2;
  return lastBackend === 1 ? 2 : 1;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { id, ustoz_id } = body;

    if (!id || !ustoz_id) {
      return new Response(
        JSON.stringify({ error: "Majburiy maydonlar yetishmayapti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the job and verify ownership — lexion maydonlarini ham olamiz
    const { data: job, error: jobError } = await supabaseAdmin
      .from("case_answer_jobs")
      .select("id, case_id, teacher_id, service_job_id, status, answer, error, library_id, is_library_reuse, backend, answer_mode, lexion_job_id, lexion_urls, lexion_fallback, lexion_phase")
      .eq("id", id)
      .maybeSingle();

    if (jobError || !job) {
      console.error("[case-answer-status] Job topilmadi:", id);
      return new Response(
        JSON.stringify({ error: "Job topilmadi" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.teacher_id !== ustoz_id) {
      console.error("[case-answer-status] Ruxsat yo'q:", ustoz_id, "!= job owner", job.teacher_id);
      return new Response(
        JSON.stringify({ error: "Bu amal uchun ruxsat yo'q" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If already done or error, return cached state
    if (job.status === "done") {
      return new Response(
        JSON.stringify({
          status: "done",
          answer: sanitizeAnswer(job.answer || ""),
          error: null,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status === "error") {
      return new Response(
        JSON.stringify({
          status: "error",
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
    if (job.answer_mode === 'lexion' && job.lexion_phase === 'lexion_searching' && job.lexion_job_id) {
      const lexionCfg = await getLexionConfig();

      if (!lexionCfg.url || !lexionCfg.key) {
        const errMsg = "Lexion model hozir mavjud emas.";
        await supabaseAdmin
          .from("case_answer_jobs")
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
            // Lexion job yo'qolgan — fallback
            console.log(`[case-answer-status] Lexion job 404, Umumiy rejimga fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // Boshqa xato — davom ettiramiz
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

          // URL ro'yxati bo'sh — fallback
          if (urls.length === 0) {
            console.log(`[case-answer-status] Lexion URL ro'yxati bo'sh, Umumiy rejimga fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // URL'larni saqlash va 2-bosqichni boshlash
          await supabaseAdmin
            .from("case_answer_jobs")
            .update({
              lexion_urls: JSON.stringify(urls),
              lexion_phase: "answering",
            })
            .eq("id", id);

          console.log(`[case-answer-status] Lexion 1-bosqich done: ${urls.length} ta URL topildi, 2-bosqich boshlanmoqda: job=${id}`);

          // 2-bosqich: topilgan URL'larni manba sifatida oddiy Render'ga yuborish
          const cfg = await getAnswerServiceConfig();
          if (!cfg.url || !cfg.key) {
            const errMsg = "Javob tayyorlash xizmati hozir mavjud emas";
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({ status: "error", error: errMsg, lexion_phase: "error" })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const serviceSources = urls.map(u => ({ title: "Lex.uz hujjati", url: u }));

          // Kazus matnini olish
          const { data: caseRow } = await supabaseAdmin
            .from("moot_court_cases")
            .select("sarlavha, tavsif")
            .eq("id", job.case_id)
            .maybeSingle();

          const title = caseRow?.sarlavha || "Kazus";
          const kazusText = caseRow?.tavsif || "";

          const serviceBody: Record<string, unknown> = {
            title,
            kazus_text: kazusText,
            external_id: `${id}-ans`,
            instruction: INSTRUCTION,
            sources: serviceSources,
          };

          const backend = await pickBackend(cfg);
          const result = await sendToBackend(backend, cfg, serviceBody);

          if (result.serviceJobId) {
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({
                backend,
                service_job_id: result.serviceJobId,
                status: "queued",
              })
              .eq("id", id);

            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // 2-bosqich yuborilmadi — fallback
          console.log(`[case-answer-status] Lexion 2-bosqich yuborilmadi, Umumiy rejimga fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, ustoz_id);
          if (fallbackResult.ok) {
            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          await supabaseAdmin
            .from("case_answer_jobs")
            .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (lexionStatus === "error" || lexionStatus === "failed") {
          console.log(`[case-answer-status] Lexion 1-bosqich xatosi, Umumiy rejimga fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, ustoz_id);
          if (fallbackResult.ok) {
            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          await supabaseAdmin
            .from("case_answer_jobs")
            .update({ status: "error", error: fallbackResult.error, lexion_phase: "error" })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: fallbackResult.error, lexion_phase: "error" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // queued / running — davom ettiramiz
        return new Response(
          JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: "lexion_searching" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (fetchErr) {
        console.error("[case-answer-status] Lexion tarmoq xatosi:", fetchErr);
        return new Response(
          JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: "lexion_searching" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ════════════════════════════════════════════════════════════════
    // 2-BOSQICH (answering) yoki ODDIY REJIMLAR — oddiy Render'ni polling qilish
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
    const jobBackend: number = job.backend ?? 1;
    const backendUrl = getBackendUrl(cfg, jobBackend);

    if (!backendUrl || !cfg.key) {
      console.error("[case-answer-status] Tashqi xizmat sozlanmagan (backend=" + jobBackend + ")");
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
        const errText = await serviceRes.text().catch(() => "");
        console.error("[case-answer-status] Tashqi xizmat xatosi:", serviceRes.status);
        if (serviceRes.status === 404) {
          // Lexion 2-bosqichda 404 — bir marta fallback
          if (job.answer_mode === 'lexion' && job.lexion_phase === 'answering' && !job.lexion_fallback) {
            console.log(`[case-answer-status] Lexion 2-bosqich 404, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          const errMsg = "Javob tayyorlanmadi (xizmat qayta ishga tushgan). Qayta urinib ko'ring.";
          await supabaseAdmin
            .from("case_answer_jobs")
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
        const rawErr = typeof serviceData.error === "string" ? serviceData.error : "Tashqi xizmat xatosi";
        const errorCode = typeof serviceData.error_code === "string" ? serviceData.error_code : "";

        if (errorCode === "library_missing") {
          errorMsg = "Saqlangan manbalar topilmadi. Manbalarni qayta qo'shing.";
          if (job.library_id) {
            try {
              await supabaseAdmin
                .from("answer_source_libraries")
                .delete()
                .eq("id", job.library_id);
            } catch { /* ignore */ }
          }
        } else {
          const { data: jobFiles } = await supabaseAdmin
            .from("case_answer_jobs")
            .select("source_file_paths")
            .eq("id", id)
            .maybeSingle();
          const hasFilePaths = Array.isArray(jobFiles?.source_file_paths)
            ? jobFiles.source_file_paths.length > 0
            : (typeof jobFiles?.source_file_paths === 'string' && JSON.parse(jobFiles.source_file_paths).length > 0);

          // Lexion 2-bosqichda xato — bir marta fallback
          if (job.answer_mode === 'lexion' && job.lexion_phase === 'answering' && !job.lexion_fallback) {
            console.log(`[case-answer-status] Lexion 2-bosqich xatosi, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id);
            if (fallbackResult.ok) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_fallback: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }

          if (hasFilePaths && /manba|havola|url|source|open|read|fetch/i.test(rawErr)) {
            errorMsg = "Faylni o'qib bo'lmadi. Boshqa fayl yuklab ko'ring yoki matnini \u00ab+ Matn\u00bb orqali qo'shing.";
          } else {
            errorMsg = "AI javob tayyorlanmadi. Keyinroq urinib ko'ring.";
          }
        }
      } else if (remoteStatus === "running" || remoteStatus === "processing") {
        newStatus = "running";
      } else if (remoteStatus === "queued" || remoteStatus === "pending") {
        newStatus = "queued";
      }

      // ── Saqlangan to'plamni yangilash (save_library) ──
      if (newStatus === "done" && job.library_id && !job.is_library_reuse) {
        const keptNotebookId = typeof serviceData.notebook_id === "string" ? serviceData.notebook_id : "";
        const keptProfile = typeof serviceData.profile === "string" ? serviceData.profile : "";
        if (keptNotebookId && keptProfile) {
          try {
            await supabaseAdmin
              .from("answer_source_libraries")
              .update({
                status: "ready",
                notebook_id: keptNotebookId,
                profile: keptProfile,
                last_used_at: new Date().toISOString(),
              })
              .eq("id", job.library_id);
          } catch (libErr) {
            console.error("[case-answer-status] Library yangilash xatosi:", libErr);
          }
        } else {
          try {
            await supabaseAdmin
              .from("answer_source_libraries")
              .delete()
              .eq("id", job.library_id)
              .eq("status", "creating");
          } catch { /* ignore */ }
        }
      }

      // ── Reuse holatida last_used_at yangilash ──
      if (newStatus === "done" && job.library_id && job.is_library_reuse) {
        try {
          await supabaseAdmin
            .from("answer_source_libraries")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", job.library_id);
        } catch { /* ignore */ }
      }

      // Persist the updated state
      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (answer !== null) updatePayload.answer = answer;
      if (errorMsg !== null) updatePayload.error = errorMsg;
      if (newStatus === "done" || newStatus === "error") {
        updatePayload.finished_at = new Date().toISOString();
        if (job.lexion_phase) {
          updatePayload.lexion_phase = newStatus === "done" ? "done" : "error";
        }

        try {
          const { data: jobFiles } = await supabaseAdmin
            .from("case_answer_jobs")
            .select("source_file_paths")
            .eq("id", id)
            .maybeSingle();
          const paths = Array.isArray(jobFiles?.source_file_paths) ? jobFiles.source_file_paths : [];
          if (jobFiles?.source_file_paths && typeof jobFiles.source_file_paths === 'string') {
            try { const parsed = JSON.parse(jobFiles.source_file_paths); if (Array.isArray(parsed)) { for (const p of parsed) { paths.push(String(p)); } } } catch { /* ignore */ }
          }
          if (paths.length > 0) {
            const { error: delErr } = await supabaseAdmin.storage.from("case-sources").remove(paths);
            if (delErr) console.error("[case-answer-status] Storage tozalash xatosi:", delErr.message);
            else console.log(`[case-answer-status] ${paths.length} ta fayl Storage'dan o'chirildi`);
            updatePayload.source_file_paths = '[]';
          }
        } catch (cleanupErr) {
          console.error("[case-answer-status] Tozalash xatosi:", cleanupErr);
        }
      }

      await supabaseAdmin
        .from("case_answer_jobs")
        .update(updatePayload)
        .eq("id", id);

      return new Response(
        JSON.stringify({
          status: newStatus,
          answer: answer !== null ? sanitizeAnswer(answer) : null,
          error: errorMsg,
          applied: job.applied ?? false,
          library_id: job.library_id || null,
          is_library_reuse: job.is_library_reuse || false,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      console.error("[case-answer-status] Tarmoq xatosi:", fetchErr);
      return new Response(
        JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: job.lexion_phase || null, lexion_fallback: job.lexion_fallback || false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("[case-answer-status] Kutilmagan xato:", err);
    return new Response(
      JSON.stringify({ error: "Holatni aniqlab bo'lmadi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Fallback: Lexion ishlamasa, "Umumiy" rejim bilan yuborish ──
async function startFallbackGeneral(
  jobId: string,
  job: { case_id: string | null; answer_mode: string | null; lexion_phase: string | null },
  _ustoz_id: string
): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getAnswerServiceConfig();
  if (!cfg.url || !cfg.key) {
    return { ok: false, error: "Javob tayyorlash xizmati hozir mavjud emas" };
  }

  const { data: caseRow } = await supabaseAdmin
    .from("moot_court_cases")
    .select("sarlavha, tavsif")
    .eq("id", job.case_id)
    .maybeSingle();

  const title = caseRow?.sarlavha || "Kazus";
  const kazusText = caseRow?.tavsif || "";

  const serviceBody: Record<string, unknown> = {
    title,
    kazus_text: kazusText,
    external_id: `${jobId}-ans`,
    instruction: INSTRUCTION,
    sources: [],
  };

  const backend = await pickBackend(cfg);
  const result = await sendToBackend(backend, cfg, serviceBody);

  if (result.serviceJobId) {
    await supabaseAdmin
      .from("case_answer_jobs")
      .update({
        backend,
        service_job_id: result.serviceJobId,
        status: "queued",
        lexion_fallback: true,
        lexion_phase: "answering",
        answer_mode: "general",
      })
      .eq("id", jobId);
    return { ok: true };
  }

  return { ok: false, error: "Javob tayyorlanmadi. Qayta urinib ko'ring." };
}
