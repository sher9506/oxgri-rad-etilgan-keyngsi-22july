// deploy 2026-10-19 b
// Lexion phase polling support — backend 3 failover qo'shilgan

import { createClient } from "npm:@supabase/supabase-js@2";
import { getLexionConfig, parseLexionJobId, tagLexionJobId } from "../_shared/lexion-target.ts";
import { KAZUS_INSTRUCTION as INSTRUCTION, CHAT_INSTRUCTION } from "../_shared/nasher-prompts.ts";
import { canKeepOn, expireChatNotebook, getChatNotebook, getKeepCfg, lexDocId, registerKeptNotebook } from "../_shared/nexus-notebooks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);


function sanitizeAnswer(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b(?:NotebookLM|Gemini Notebook|Notebook)\b/gi, "qonunchilik bazasi")
    .replace(/\s*\[\d+(?:\s*[-,]\s*\d+)*\]\s*/g, " ")
    .replace(/  +/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
}

interface BackendConfig {
  url: string;
  key: string;
  url2: string;
  url3: string;
}

async function getAnswerServiceConfig(): Promise<BackendConfig> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, text_value")
    .in("key", ["ANSWER_SERVICE_URL", "ANSWER_SERVICE_KEY", "ANSWER_SERVICE_URL_2", "ANSWER_SERVICE_URL_3"]);
  if (error || !data) return { url: "", key: "", url2: "", url3: "" };
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.text_value) map[row.key] = row.text_value;
  }
  return {
    url: map["ANSWER_SERVICE_URL"] || "",
    key: map["ANSWER_SERVICE_KEY"] || "",
    url2: (map["ANSWER_SERVICE_URL_2"] || "").trim(),
    url3: (map["ANSWER_SERVICE_URL_3"] || "").trim(),
  };
}

function getBackendUrl(cfg: BackendConfig, backend: number): string {
  if (backend === 2) return cfg.url2;
  if (backend === 3) return cfg.url3;
  return cfg.url;
}

function getAvailableBackends(cfg: BackendConfig): number[] {
  return [cfg.url, cfg.url2, cfg.url3].reduce<number[]>((result, url, index) => {
    if (url) result.push(index + 1);
    return result;
  }, []);
}


// ── Lexion URL parser — answer maydonidan lex.uz/docs/<id> havolalarini ajratib oladi ──
export function parseLexionUrls(answer: string): string[] {
  // JSON massiv ham, oddiy matn ham bo'lishi mumkin: hamma joydan docs ID'sini olamiz.
  // https/www/til prefiksi (uz, ru) va #anchor yoki ?ONDATE= bo'lsa ham bitta ko'rinishga keltiriladi.
  const ids: string[] = [];
  for (const m of answer.matchAll(/lex\.uz\/(?:[a-z]{2}\/)?docs\/(-?\d+)/g)) {
    if (!ids.includes(m[1])) ids.push(m[1]);
    if (ids.length >= 15) break;
  }
  return ids.map(id => `https://lex.uz/docs/${id}`);
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
      signal: AbortSignal.timeout(70_000),   // sovuq Render ~50 s uyg'onadi; undan uzoq osilsa uziladi
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

function isQuotaError(status: number, errorMsg?: string): boolean {
  if (status === 429) return true;
  if (errorMsg && /quota|rate.?limit|resource.?exhausted|too.?many.?requests/i.test(errorMsg)) return true;
  return false;
}

function isRetryableSendError(status: number, errorMsg?: string): boolean {
  return isServerError(status) || isQuotaError(status, errorMsg);
}

const ACTIVE_STATUSES = ["queued", "running"];
const STALE_MS = 10 * 60 * 1000;

async function getBackendLoads(cfg: BackendConfig): Promise<{ available: number[]; counts: Map<number, number>; lastBackend: number }> {
  const available = getAvailableBackends(cfg);
  const counts = new Map(available.map((backend) => [backend, 0]));
  let lastBackend = 1;
  if (available.length <= 1) return { available, counts, lastBackend };

  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("case_answer_jobs")
    .select("backend, created_at")
    .in("status", ACTIVE_STATUSES)
    .gte("created_at", cutoff);

  if (!error && data) {
    for (const row of data) {
      const backend = row.backend ?? 1;
      if (counts.has(backend)) counts.set(backend, (counts.get(backend) ?? 0) + 1);
      else counts.set(1, (counts.get(1) ?? 0) + 1);
      lastBackend = backend;
    }
  }

  return { available, counts, lastBackend };
}

function nextBackendInSet(backends: number[], lastBackend: number, candidates: Set<number>): number {
  const lastIndex = backends.indexOf(lastBackend);
  const start = lastIndex >= 0 ? lastIndex : 0;
  for (let offset = 1; offset <= backends.length; offset++) {
    const backend = backends[(start + offset) % backends.length];
    if (candidates.has(backend)) return backend;
  }
  return backends[0];
}

async function pickBackend(cfg: BackendConfig): Promise<number> {
  const { available, counts, lastBackend } = await getBackendLoads(cfg);
  if (available.length === 0) return 1;
  const minimum = Math.min(...available.map((backend) => counts.get(backend) ?? 0));
  const candidates = new Set(available.filter((backend) => (counts.get(backend) ?? 0) === minimum));
  return nextBackendInSet(available, lastBackend, candidates);
}

async function getFailoverBackends(cfg: BackendConfig, selected: number): Promise<number[]> {
  const { available, counts } = await getBackendLoads(cfg);
  const remaining = available.filter((backend) => backend !== selected);
  const selectedIndex = available.indexOf(selected);
  return remaining.sort((a, b) => {
    const loadDifference = (counts.get(a) ?? 0) - (counts.get(b) ?? 0);
    if (loadDifference !== 0) return loadDifference;
    const distance = (backend: number) => (available.indexOf(backend) - selectedIndex + available.length) % available.length;
    return distance(a) - distance(b);
  });
}

async function sendWithFailover(
  backend: number,
  cfg: BackendConfig,
  serviceBody: Record<string, unknown>
): Promise<{ result: ServiceResult; backend: number }> {
  let result = await sendToBackend(backend, cfg, serviceBody);
  let resultBackend = backend;
  if (!result.serviceJobId && isRetryableSendError(result.errorStatus ?? 0, result.errorMsg)) {
    for (const fallbackBackend of await getFailoverBackends(cfg, backend)) {
      console.log(`[case-answer-status] backend=${resultBackend} yiqildi (${result.errorStatus}), failover -> backend=${fallbackBackend}`);
      result = await sendToBackend(fallbackBackend, cfg, serviceBody);
      resultBackend = fallbackBackend;
      if (result.serviceJobId || !isRetryableSendError(result.errorStatus ?? 0, result.errorMsg)) break;
    }
  }
  return { result, backend: resultBackend };
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
      .select("id, case_id, teacher_id, service_job_id, status, answer, error, library_id, is_library_reuse, backend, answer_mode, lexion_job_id, lexion_urls, lexion_fallback, lexion_phase, lexion_fallback_reason, fallback_count, created_at, finished_at, updated_at, chat_kazus_text, chat_title, chat_id, chat_followup, chat_keep_requested, chat_keep_registered")
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

    // Parse lexion_urls once for all polling responses
    const parsedLexionUrls: string[] = job.lexion_urls ? parseLexionUrls(job.lexion_urls) : [];
    const serverNowIso = new Date().toISOString();

    // ── Stale job auto-cleanup: 30 daqiqadan eski queued/running ishlarni timeout qil ──
    if (job.status === "queued" || job.status === "running") {
      const jobAgeMs = Date.now() - new Date(job.created_at).getTime();
      const STALE_JOB_MS = 30 * 60 * 1000;
      if (jobAgeMs > STALE_JOB_MS) {
        const errMsg = "Javob tayyorlanmadi (vaqt tugadi). Qayta urinib ko'ring.";
        await supabaseAdmin
          .from("case_answer_jobs")
          .update({ status: "error", error: errMsg, finished_at: new Date().toISOString(), lexion_phase: job.lexion_phase ? "error" : null })
          .eq("id", id);
        console.log(`[case-answer-status] Stale job ${id} (${Math.round(jobAgeMs / 60000)}m) -> timeout`);
        return new Response(
          JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: job.lexion_phase || null, lexion_fallback: job.lexion_fallback || false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // If already done or error, return cached state
    if (job.status === "done") {
      const isChatJob = !job.case_id;
      const lexionUrls = isChatJob && job.lexion_urls ? parseLexionUrls(job.lexion_urls) : [];
      return new Response(
        JSON.stringify({
          status: "done",
          answer: sanitizeAnswer(job.answer || ""),
          error: null,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
          lexion_urls: lexionUrls.length > 0 ? lexionUrls : undefined,
          created_at: job.created_at,
          server_now: job.finished_at || undefined,
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
      const lexionJob = parseLexionJobId(job.lexion_job_id);
      const lexionCfg = await getLexionConfig(supabaseAdmin, lexionJob.preview);

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
          `${lexionCfg.url}/api/jobs/${lexionJob.id}`,
          {
            method: "GET",
            signal: AbortSignal.timeout(20_000),
            headers: {
              "X-API-Key": lexionCfg.key,
              "Content-Type": "application/json",
            },
          }
        );

        if (!lexionRes.ok) {
          if (lexionRes.status === 404) {
            const isChat = !job.case_id;
            if (isChat) {
              console.log(`[case-answer-status] Qidiruv 404, qayta urinish: job=${id}`);
              const retry = await retryLexionSearch(id, job);
              if (retry.retrySent) {
                return new Response(
                  JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "lexion_searching" }),
                  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              const errMsg = "Bu savol bo'yicha mos qonunchilik manbasi topilmadi. Savolni aniqroq yozib ko'ring.";
              await supabaseAdmin
                .from("case_answer_jobs")
                .update({ status: "error", error: errMsg, lexion_phase: "error", lexion_fallback_reason: "lexion_job_404", finished_at: new Date().toISOString() })
                .eq("id", id);
              return new Response(
                JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            console.log(`[case-answer-status] Lexion job 404, Umumiy rejimga fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id, "lexion_job_404");
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

          // URL ro'yxati bo'sh
          if (urls.length === 0) {
            const isChat = !job.case_id;
            if (isChat) {
              console.log(`[case-answer-status] URL topilmadi, qayta urinish: job=${id}`);
              const retry = await retryLexionSearch(id, job);
              if (retry.retrySent) {
                return new Response(
                  JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "lexion_searching" }),
                  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              const errMsg = "Bu savol bo'yicha mos qonunchilik manbasi topilmadi. Savolni aniqroq yozib ko'ring.";
              await supabaseAdmin
                .from("case_answer_jobs")
                .update({ status: "error", error: errMsg, lexion_phase: "error", lexion_fallback_reason: "lexion_url_topilmadi", finished_at: new Date().toISOString() })
                .eq("id", id);
              return new Response(
                JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            console.log(`[case-answer-status] Lexion URL ro'yxati bo'sh, Umumiy rejimga fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id, "lexion_url_topilmadi");
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
          const { data: claimed } = await supabaseAdmin
            .from("case_answer_jobs")
            .update({
              lexion_urls: JSON.stringify(urls),
              lexion_phase: "answering",
            })
            .eq("id", id)
            .eq("lexion_phase", "lexion_searching")
            .select("id");
          if (!claimed || claimed.length === 0) {
            // boshqa poll allaqachon 2-bosqichni boshlagan
            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_urls: urls, created_at: job.created_at, server_now: serverNowIso }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

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

          // Kazus matnini olish (standalone chat uchun chat_kazus_text)
          let title: string = "Kazus";
          let kazusText: string = "";
          if (job.case_id) {
            const { data: caseRow } = await supabaseAdmin
              .from("moot_court_cases")
              .select("sarlavha, tavsif")
              .eq("id", job.case_id)
              .maybeSingle();
            title = caseRow?.sarlavha || "Kazus";
            kazusText = caseRow?.tavsif || "";
          } else {
            title = job.chat_title || "Lexion";
            kazusText = job.chat_kazus_text || "";
          }

          const isChat = !job.case_id;
          const serviceBody: Record<string, unknown> = {
            title,
            kazus_text: kazusText,
            external_id: `${id}-ans`,
            instruction: isChat ? CHAT_INSTRUCTION : INSTRUCTION,
            sources: serviceSources,
          };

          const keepCfg = await getKeepCfg();
          const useKeep = isChat && keepCfg.on && !!job.chat_id;
          let dispatched: { result: ServiceResult; backend: number } | null = null;
          let followup = false;

          if (useKeep) {
            const nb = await getChatNotebook(job.chat_id as string, job.teacher_id);
            if (nb) {
              const seen = new Set<string>(nb.lex_urls ?? []);
              const newSources = urls
                .filter((u) => { const d = lexDocId(u); return !d || !seen.has(d); })
                .map((u) => ({ title: "Lex.uz hujjati", url: u }));
              const r = await sendToBackend(nb.backend, cfg, {
                ...serviceBody,
                sources: newSources,
                notebook_id: nb.notebook_id,
                profile: nb.profile,
                conversation_id: nb.conversation_id,
                prior_turns: nb.turns,
              });
              if (r.serviceJobId) {
                dispatched = { backend: nb.backend, result: r };
                followup = true;
              } else {
                console.log(`[case-answer-status] chat daftariga yuborib bo'lmadi, yangi daftar ochiladi: job=${id}`);
                await expireChatNotebook(nb.id);
              }
            }
          }

          if (!dispatched) {
            const backend = await pickBackend(cfg);
            if (useKeep && (await canKeepOn(backend, keepCfg))) serviceBody.keep_notebook = true;
            dispatched = await sendWithFailover(backend, cfg, serviceBody);
          }
          const result = dispatched!.result;

          if (result.serviceJobId) {
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({
                backend: dispatched!.backend,
                service_job_id: result.serviceJobId,
                status: "queued",
                chat_followup: followup,
                chat_keep_requested: followup || serviceBody.keep_notebook === true,
              })
              .eq("id", id);

            return new Response(
              JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_urls: urls, created_at: job.created_at, server_now: serverNowIso }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // 2-bosqich yuborilmadi
          const isChatSend = !job.case_id;
          if (isChatSend) {
            const errMsg = "Xizmat vaqtincha band, birozdan keyin qayta urinib ko'ring.";
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({ status: "error", error: errMsg, lexion_phase: "error", lexion_fallback_reason: "lexion_2_yuborilmadi", last_render_error: (dispatched.result.errorMsg || "").slice(0, 300), finished_at: new Date().toISOString() })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.log(`[case-answer-status] Lexion 2-bosqich yuborilmadi, Umumiy rejimga fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, ustoz_id, "lexion_2_yuborilmadi");
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
          const isChatErr = !job.case_id;
          if (isChatErr) {
            console.log(`[case-answer-status] Qidiruv xatosi, qayta urinish: job=${id}`);
            const retry = await retryLexionSearch(id, job);
            if (retry.retrySent) {
              return new Response(
                JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "lexion_searching" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            const errMsg = "Bu savol bo'yicha mos qonunchilik manbasi topilmadi. Savolni aniqroq yozib ko'ring.";
            await supabaseAdmin
              .from("case_answer_jobs")
              .update({ status: "error", error: errMsg, lexion_phase: "error", lexion_fallback_reason: "lexion_1_xato", finished_at: new Date().toISOString() })
              .eq("id", id);
            return new Response(
              JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.log(`[case-answer-status] Lexion 1-bosqich xatosi, Umumiy rejimga fallback: job=${id}`);
          const fallbackResult = await startFallbackGeneral(id, job, ustoz_id, "lexion_1_xato");
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
      // Lexion URL topgan, lekin 2-bosqich yuborilmay qolgan (edge funksiya yuborish paytida uzilgan):
      // 90 s dan keyin fazani qaytaramiz — keyingi poll Lexion natijasini qayta o'qib, 2-bosqichni yana boshlaydi.
      if (job.answer_mode === 'lexion' && job.lexion_phase === 'answering' && job.lexion_job_id && job.updated_at &&
          Date.now() - new Date(job.updated_at).getTime() > 90_000) {
        const { data: reset } = await supabaseAdmin
          .from("case_answer_jobs")
          .update({ lexion_phase: "lexion_searching" })
          .eq("id", id)
          .eq("updated_at", job.updated_at)
          .is("service_job_id", null)
          .select("id");
        if (reset && reset.length > 0) {
          console.log(`[case-answer-status] 2-bosqich yuborilmay qolgan, qayta urinish: job=${id}`);
        }
      }
      // service_job_id yo'q va leksion bosqichida ham emas — qotib qolgan job
      if (job.status === 'queued' || job.status === 'running') {
        const jobAgeMs = Date.now() - new Date(job.created_at).getTime();
        if (jobAgeMs > 20 * 60 * 1000) {
          const errMsg = "Server qayta ishga tushdi, savolni qayta yuboring.";
          await supabaseAdmin
            .from("case_answer_jobs")
            .update({ status: "error", error: errMsg, lexion_phase: "error", finished_at: new Date().toISOString() })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      return new Response(
        JSON.stringify({
          status: job.status,
          answer: null,
          error: null,
          lexion_phase: job.lexion_phase || null,
          lexion_fallback: job.lexion_fallback || false,
          lexion_urls: parsedLexionUrls.length > 0 ? parsedLexionUrls : undefined,
          created_at: job.created_at,
          server_now: serverNowIso,
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
          signal: AbortSignal.timeout(20_000),
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
          // 2-bosqich 404
          if (job.answer_mode === 'lexion' && job.lexion_phase === 'answering' && !job.lexion_fallback) {
            const isChat404 = !job.case_id;
            if (isChat404) {
              console.log(`[case-answer-status] 2-bosqich 404, boshqa Render'ga qayta yuborish: job=${id}`);
              const redispatch = await redispatchChatWithSources(id, job);
              if (redispatch.ok) {
                return new Response(
                  JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_urls: parsedLexionUrls.length > 0 ? parsedLexionUrls : undefined, created_at: job.created_at, server_now: serverNowIso }),
                  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              const errMsg = "Xizmat vaqtincha band, birozdan keyin qayta urinib ko'ring.";
              await supabaseAdmin
                .from("case_answer_jobs")
                .update({ status: "error", error: errMsg, lexion_phase: "error", lexion_fallback_reason: "lexion_2_404", last_render_error: (errText || "404").slice(0, 300), finished_at: new Date().toISOString() })
                .eq("id", id);
              return new Response(
                JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            console.log(`[case-answer-status] Lexion 2-bosqich 404, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id, "lexion_2_404");
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
          JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: job.lexion_phase || null, lexion_fallback: job.lexion_fallback || false, lexion_urls: parsedLexionUrls.length > 0 ? parsedLexionUrls : undefined, created_at: job.created_at, server_now: serverNowIso }),
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

          // 2-bosqich xato
          if (job.answer_mode === 'lexion' && job.lexion_phase === 'answering' && !job.lexion_fallback) {
            const isChatErr2 = !job.case_id;
            if (isChatErr2) {
              console.log(`[case-answer-status] 2-bosqich xato, boshqa Render'ga qayta yuborish: job=${id}`);
              const redispatch = await redispatchChatWithSources(id, job);
              if (redispatch.ok) {
                return new Response(
                  JSON.stringify({ status: "queued", answer: null, error: null, lexion_phase: "answering", lexion_urls: parsedLexionUrls.length > 0 ? parsedLexionUrls : undefined, created_at: job.created_at, server_now: serverNowIso }),
                  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
              const errMsg = "Xizmat vaqtincha band, birozdan keyin qayta urinib ko'ring.";
              await supabaseAdmin
                .from("case_answer_jobs")
                .update({ status: "error", error: errMsg, lexion_phase: "error", lexion_fallback_reason: "lexion_2_xato", last_render_error: (rawErr || "").slice(0, 300), finished_at: new Date().toISOString() })
                .eq("id", id);
              return new Response(
                JSON.stringify({ status: "error", answer: null, error: errMsg, lexion_phase: "error" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            console.log(`[case-answer-status] Lexion 2-bosqich xatosi, fallback: job=${id}`);
            const fallbackResult = await startFallbackGeneral(id, job, ustoz_id, "lexion_2_xato");
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

      if (job.chat_keep_requested && !job.chat_keep_registered && newStatus === "done") {
        try {
          const keepCfg = await getKeepCfg();
          const cfgSvc = await getAnswerServiceConfig();
          await registerKeptNotebook(job, serviceData, keepCfg, {
            baseUrl: getBackendUrl(cfgSvc, job.backend ?? 1),
            key: cfgSvc.key,
          });
        } catch (e) {
          console.error("[case-answer-status] chat daftarini ro'yxatga olish:", e);
        }
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
          lexion_urls: parsedLexionUrls.length > 0 ? parsedLexionUrls : undefined,
          created_at: job.created_at,
          server_now: serverNowIso,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      console.error("[case-answer-status] Tarmoq xatosi:", fetchErr);
      return new Response(
        JSON.stringify({ status: job.status, answer: null, error: null, lexion_phase: job.lexion_phase || null, lexion_fallback: job.lexion_fallback || false, lexion_urls: parsedLexionUrls.length > 0 ? parsedLexionUrls : undefined, created_at: job.created_at, server_now: serverNowIso }),
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

// ── Chat: Lexion 1-bosqichda qayta qidirish (max 1 marta) ──
async function retryLexionSearch(
  jobId: string,
  job: { case_id: string | null; chat_kazus_text?: string | null; chat_title?: string | null; fallback_count: number | null; lexion_job_id?: string | null }
): Promise<{ retrySent: boolean }> {
  const preview = parseLexionJobId(job.lexion_job_id ?? "").preview;   // qayta urinish ham o'sha Lexion'ga
  const retryCount = job.fallback_count ?? 0;
  if (retryCount >= 1) {
    console.log(`[case-answer-status] retryLexionSearch: urinish chegarasi (${retryCount}), job=${jobId}`);
    return { retrySent: false };
  }

  const lexionCfg = await getLexionConfig(supabaseAdmin, preview);
  if (!lexionCfg.url || !lexionCfg.key) {
    return { retrySent: false };
  }

  const kazusText = job.chat_kazus_text || "";
  const title = job.chat_title || "Lexion";

  const lexionBody: Record<string, unknown> = {
    title: "Lexion",
    kazus_text: kazusText,
    external_id: `${jobId}-lex2`,
  };

  console.log(`[case-answer-status] retryLexionSearch: qayta yuborilmoqda, job=${jobId}`);
  const lexionResult = await sendToLexionSearch(lexionCfg, lexionBody);

  if (lexionResult.serviceJobId) {
    await supabaseAdmin
      .from("case_answer_jobs")
      .update({
        lexion_job_id: tagLexionJobId(lexionResult.serviceJobId, preview),
        lexion_phase: "lexion_searching",
        fallback_count: retryCount + 1,
        status: "queued",
      })
      .eq("id", jobId);
    return { retrySent: true };
  }

  return { retrySent: false };
}

// ── Chat: 2-bosqichda boshqa Render'ga qayta yuborish (max 1 marta) ──
async function redispatchChatWithSources(
  jobId: string,
  job: { case_id: string | null; lexion_urls: string | null; chat_kazus_text?: string | null; chat_title?: string | null; fallback_count: number | null; backend: number | null; chat_id: string | null; teacher_id: string; chat_followup: boolean | null }
): Promise<{ ok: boolean }> {
  const retryCount = job.fallback_count ?? 0;
  if (retryCount >= 1) {
    console.log(`[case-answer-status] redispatchChat: urinish chegarasi (${retryCount}), job=${jobId}`);
    return { ok: false };
  }

  const cfg = await getAnswerServiceConfig();
  if (!cfg.url || !cfg.key) return { ok: false };

  const urls = job.lexion_urls ? parseLexionUrls(job.lexion_urls) : [];
  if (urls.length === 0) return { ok: false };

  const serviceSources = urls.map(u => ({ title: "Lex.uz hujjati", url: u }));
  const title = job.chat_title || "Lexion";
  const kazusText = job.chat_kazus_text || "";

  const serviceBody: Record<string, unknown> = {
    title,
    kazus_text: kazusText,
    external_id: `${jobId}-ans2`,
    instruction: CHAT_INSTRUCTION,
    sources: serviceSources,
  };

  const oldBackend = job.backend ?? 1;
  const failoverBackends = await getFailoverBackends(cfg, oldBackend);
  if (failoverBackends.length === 0) return { ok: false };

  const newBackend = failoverBackends[0];
  console.log(`[case-answer-status] redispatchChat: backend=${oldBackend} -> backend=${newBackend}, job=${jobId}`);

  let keepFlag = false;
  const keepCfg = await getKeepCfg();
  if (keepCfg.on && job.chat_id) {
    if (job.chat_followup) {
      const old = await getChatNotebook(job.chat_id, job.teacher_id, { ignoreGrace: true });
      if (old) await expireChatNotebook(old.id);
    }
    if (await canKeepOn(newBackend, keepCfg)) {
      serviceBody.keep_notebook = true;
      keepFlag = true;
    }
  }

  const result = await sendToBackend(newBackend, cfg, serviceBody);
  if (result.serviceJobId) {
    await supabaseAdmin
      .from("case_answer_jobs")
      .update({
        backend: newBackend,
        service_job_id: result.serviceJobId,
        status: "queued",
        fallback_count: retryCount + 1,
        last_render_error: null,
        chat_followup: false,
        chat_keep_requested: keepFlag,
        chat_keep_registered: false,
      })
      .eq("id", jobId);
    return { ok: true };
  }

  if (result.errorMsg) {
    await supabaseAdmin
      .from("case_answer_jobs")
      .update({ last_render_error: result.errorMsg.slice(0, 300) })
      .eq("id", jobId);
  }

  return { ok: false };
}

// ── Lexion search uchun yuborish (retryLexionSearch ishlatadi) ──
async function sendToLexionSearch(
  lexionCfg: { url: string; key: string },
  serviceBody: Record<string, unknown>
): Promise<ServiceResult> {
  try {
    const serviceRes = await fetch(`${lexionCfg.url}/api/jobs`, {
      method: "POST",
      signal: AbortSignal.timeout(70_000),   // sovuq Render ~50 s uyg'onadi; undan uzoq osilsa uziladi
      headers: {
        "X-API-Key": lexionCfg.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serviceBody),
    });

    if (!serviceRes.ok) {
      const errText = await serviceRes.text().catch(() => "");
      let errMsg = "Lexion xizmati javob bermadi";
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
    console.error("[case-answer-status] Lexion tarmoq xatosi:", fetchErr);
    return { serviceJobId: null, errorStatus: 0, errorMsg: "Tarmoq xatosi" };
  }
}

// ── Fallback: Lexion ishlamasa, "Umumiy" rejim bilan yuborish ──
async function startFallbackGeneral(
  jobId: string,
  job: { case_id: string | null; answer_mode: string | null; lexion_phase: string | null; chat_kazus_text?: string | null; chat_title?: string | null },
  _ustoz_id: string,
  reason: string
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

  let title: string = caseRow?.sarlavha || "Kazus";
  let kazusText: string = caseRow?.tavsif || "";
  if (!job.case_id) {
    title = job.chat_title || "Lexion";
    kazusText = job.chat_kazus_text || "";
  }

  const isChat = !job.case_id;
  const serviceBody: Record<string, unknown> = {
    title,
    kazus_text: kazusText,
    external_id: `${jobId}-ans`,
    instruction: isChat ? CHAT_INSTRUCTION : INSTRUCTION,
    sources: [],
  };

  const backend = await pickBackend(cfg);
  const dispatched = await sendWithFailover(backend, cfg, serviceBody);
  const result = dispatched.result;

  if (result.serviceJobId) {
    await supabaseAdmin
      .from("case_answer_jobs")
      .update({
        backend: dispatched.backend,
        service_job_id: result.serviceJobId,
        status: "queued",
        lexion_fallback: true,
        lexion_phase: "answering",
        answer_mode: "general",
        lexion_fallback_reason: reason,
        fallback_count: 1,
      })
      .eq("id", jobId);
    return { ok: true };
  }

  return { ok: false, error: "Javob tayyorlanmadi. Qayta urinib ko'ring." };
}
// deploy-trigger Sat Oct 12 2026 03:50 UTC
