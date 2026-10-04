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

const MAX_KAZUS_LENGTH = 12000;
const MAX_SOURCES = 18;
const MAX_SOURCE_TEXT_LENGTH = 100000;
const MAX_SOURCE_TITLE_LENGTH = 120;
const SIGNED_URL_EXPIRY = 3600;
const STORAGE_BUCKET = "case-sources";

interface SourceInput {
  type: 'text' | 'url' | 'file';
  title?: string;
  content?: string;
  url?: string;
  storagePath?: string;
  fileKind?: string;
  fileSize?: number;
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
      const storagePath = typeof s.storagePath === 'string' ? s.storagePath : '';
      const content = typeof s.content === 'string' ? s.content : '';
      if (storagePath) {
        result.push({ type: 'file', title, storagePath, fileKind: typeof s.fileKind === 'string' ? s.fileKind : '', fileSize: typeof s.fileSize === 'number' ? s.fileSize : 0 });
      } else if (content.trim() && content.length >= MIN_SOURCE_TEXT_LENGTH) {
        result.push({ type: 'file', title, content });
      }
    }
  }
  return result;
}

async function getSetting(key: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("text_value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return "";
  return data.text_value || "";
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

// Faol statuslar: queued (navbatda) va running (bajarilmoqda).
// done/error — yakunlangan, hisobga kirmaydi.
const ACTIVE_STATUSES = ["queued", "running"];
// 10 daqiqadan eski, hali yakunlanmagan ishlar qotib qolgan deb hisoblanadi — sanalmaydi.
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
  // Teng — almashtirib tur
  return lastBackend === 1 ? 2 : 1;
}

async function createSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (error || !data?.signedUrl) {
    console.error("[case-answer-submit] Signed URL yaratilmadi:", path, error?.message);
    return null;
  }
  return data.signedUrl;
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
    console.error("[case-answer-submit] Tarmoq xatosi (backend " + backend + "):", fetchErr);
    return { serviceJobId: null, errorStatus: 0, errorMsg: "Tarmoq xatosi" };
  }
}

function is4xx(status: number): boolean {
  return status >= 400 && status < 500;
}

function isServerError(status: number): boolean {
  return status === 0 || (status >= 500);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { case_id, kazus_text, title, ustoz_id, sources } = body;
    const library_id: string | undefined = body.library_id;
    const save_library: boolean = !!body.save_library;
    const library_title: string | undefined = body.library_title;

    if (!case_id || !kazus_text || !title || !ustoz_id) {
      return new Response(
        JSON.stringify({ error: "Majburiy maydonlar yetishmayapti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (kazus_text.length > MAX_KAZUS_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Kazus matni 12000 belgidan oshmasligi kerak" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const libraryEnabled = await getSetting("answer_library_enabled") === "true";
    const useLibrary = libraryEnabled && (library_id || save_library);

    if (useLibrary && library_id && Array.isArray(sources) && sources.length > 0) {
      return new Response(
        JSON.stringify({ error: "Yangi manba qo'shish uchun avval tanlangan to'plamni olib tashlang." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validSources = validateSources(sources);
    if (Array.isArray(sources) && sources.length > MAX_SOURCES) {
      return new Response(
        JSON.stringify({ error: "Ko'pi bilan 18 ta manba qo'shish mumkin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (Array.isArray(sources) && sources.length > 0 && validSources.length === 0) {
      console.error("[case-answer-submit] Barcha manbalar bo'sh yoki juda qisqa:", sources.length, "ta keldi, 0 ta yaroqli");
      return new Response(
        JSON.stringify({ error: "Yuklangan manbalardan matn topilmadi. Fayllarning matnli ekanligini tekshiring (skaner qilingan PDF bo'lmasligi kerak)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: caseData, error: caseError } = await supabaseAdmin
      .from("moot_court_cases")
      .select("ustoz_id")
      .eq("id", case_id)
      .maybeSingle();

    if (caseError || !caseData) {
      console.error("[case-answer-submit] Kazus topilmadi:", case_id);
      return new Response(
        JSON.stringify({ error: "Kazus topilmadi" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (caseData.ustoz_id !== ustoz_id) {
      console.error("[case-answer-submit] Ruxsat yo'q:", ustoz_id, "!= case owner", caseData.ustoz_id);
      return new Response(
        JSON.stringify({ error: "Bu amal uchun ruxsat yo'q" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Saqlangan to'plam bilan ish (library_id) ──
    let libraryNotebookId = "";
    let libraryProfile = "";
    let libraryRowId: string | null = null;
    let creatingLibraryId: string | null = null;

    if (useLibrary && library_id) {
      const { data: lib, error: libError } = await supabaseAdmin
        .from("answer_source_libraries")
        .select("id, teacher_id, notebook_id, profile, status")
        .eq("id", library_id)
        .maybeSingle();

      if (libError || !lib) {
        return new Response(
          JSON.stringify({ error: "Saqlangan to'plam topilmadi." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (lib.teacher_id !== ustoz_id) {
        return new Response(
          JSON.stringify({ error: "Bu amal uchun ruxsat yo'q" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      libraryNotebookId = lib.notebook_id;
      libraryProfile = lib.profile;
      libraryRowId = lib.id;
    }

    // ── Yangi to'plam saqlash (save_library) ──
    if (useLibrary && save_library && !library_id && validSources.length > 0) {
      const { count, error: countError } = await supabaseAdmin
        .from("answer_source_libraries")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", ustoz_id)
        .in("status", ["creating", "ready"]);

      if (countError) {
        console.error("[case-answer-submit] To'plam sonini olish xatosi:", countError.message);
      } else if ((count ?? 0) >= 20) {
        const { data: libs } = await supabaseAdmin
          .from("answer_source_libraries")
          .select("id, title, sources, created_at, last_used_at")
          .eq("teacher_id", ustoz_id)
          .in("status", ["creating", "ready"])
          .order("last_used_at", { ascending: true, nullsFirst: true });

        const libList = (libs || []).map((row) => {
          const srcs = Array.isArray(row.sources) ? row.sources : [];
          return {
            id: row.id,
            title: row.title,
            source_count: srcs.length,
            sources: srcs.map((s: Record<string, unknown>) => ({ name: s.name ?? s.title ?? "", size: s.size ?? 0 })),
            last_used_at: row.last_used_at,
            created_at: row.created_at,
          };
        });

        return new Response(
          JSON.stringify({
            error: "Saqlangan manbalar soni 20 ga yetdi. Yangisini saqlash uchun birini o'chiring.",
            error_code: "library_full",
            libraries: libList,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const libTitle = (library_title || validSources[0]?.title || "Manba").slice(0, 80);
      const sourcesPreview = validSources.map((s) => ({
        name: s.title || "Manba",
        type: s.type,
        size: s.fileSize || (s.content ? s.content.length : 0),
      }));

      const { data: newLib, error: newLibError } = await supabaseAdmin
        .from("answer_source_libraries")
        .insert({
          teacher_id: ustoz_id,
          title: libTitle,
          sources: JSON.stringify(sourcesPreview),
          status: "creating",
        })
        .select("id")
        .single();

      if (newLibError || !newLib) {
        console.error("[case-answer-submit] To'plam yaratilmadi:", newLibError?.message);
      } else {
        creatingLibraryId = newLib.id;
      }
    }

    const cfg = await getAnswerServiceConfig();
    if (!cfg.url || !cfg.key) {
      console.error("[case-answer-submit] Tashqi xizmat sozlanmagan");
      return new Response(
        JSON.stringify({ error: "Javob tayyorlash xizmati hozir mavjud emas" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storagePaths: string[] = [];
    const serviceSources: { title: string; content?: string; url?: string }[] = [];
    for (const s of validSources) {
      if (s.type === 'url') {
        serviceSources.push({ title: s.title, url: s.url });
      } else if (s.type === 'file' && s.storagePath) {
        const { data: fileExists } = await supabaseAdmin.storage.from(STORAGE_BUCKET).list(s.storagePath.split('/').slice(0, -1).join('/'), { limit: 1, search: s.storagePath.split('/').pop() || '' });
        if (!fileExists || fileExists.length === 0) {
          console.error("[case-answer-submit] Fayl topilmadi (muddati tugagan):", s.storagePath);
          return new Response(
            JSON.stringify({ error: "Fayl muddati tugagan. Uni qayta yuklang." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const signedUrl = await createSignedUrl(s.storagePath);
        if (!signedUrl) {
          console.error("[case-answer-submit] Signed URL yaratilmadi, manba o'tkazib yuborildi:", s.title);
          continue;
        }
        storagePaths.push(s.storagePath);
        serviceSources.push({ title: s.title, url: signedUrl });
      } else {
        serviceSources.push({ title: s.title, content: s.content });
      }
    }

    // Create a job record first
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("case_answer_jobs")
      .insert({
        case_id,
        teacher_id: ustoz_id,
        status: "queued",
        source_count: validSources.length,
        source_file_paths: storagePaths.length > 0 ? JSON.stringify(storagePaths) : '[]',
      })
      .select("id")
      .single();

    if (jobError || !jobRow) {
      console.error("[case-answer-submit] Job yaratilmadi:", jobError?.message);
      return new Response(
        JSON.stringify({ error: "Job yaratilmadi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const jobId = jobRow.id;

    const instruction =
      "Siz professional O'zbekiston huquqshunosisiz. Quyidagi kazusni IRAC (Issue, Rule, Application, Conclusion) usulida va berilgan manbalar asosida tahlil qilib yeching. Javob oxirida hech qanday savol bermang va taklif qilmang, faqat tahlilni yozing.";

    console.log(`[case-answer-submit] external_id=${jobId} | ${validSources.length} ta manba (${storagePaths.length} fayl storage'dan)`);
    for (const s of serviceSources) {
      if (s.content) console.log(`[case-answer-submit]   • ${s.title}: ${s.content.length} belgi`);
      else console.log(`[case-answer-submit]   • ${s.title}: url manba`);
    }

    // ── Backend tanlash ──
    const backend = await pickBackend(cfg);
    console.log(`[case-answer-submit] backend=${backend} tanlandi, external_id=${jobId}`);

    const serviceBody: Record<string, unknown> = {
      title,
      kazus_text,
      external_id: jobId,
      instruction,
      sources: serviceSources,
    };

    if (useLibrary && library_id && libraryNotebookId) {
      serviceBody.notebook_id = libraryNotebookId;
      serviceBody.profile = libraryProfile;
    } else if (useLibrary && save_library && creatingLibraryId) {
      serviceBody.keep = true;
      serviceBody.library_title = (library_title || validSources[0]?.title || "Manba").slice(0, 80);
    }

    // ── Birinchi urinish ──
    let result = await sendToBackend(backend, cfg, serviceBody);

    // ── Failover: faqat 5xx / tarmoq xatosi bo'lsa, ikkinchi backend'ga ──
    if (!result.serviceJobId && isServerError(result.errorStatus ?? 0) && cfg.url2) {
      const fallbackBackend = backend === 1 ? 2 : 1;
      console.log(`[case-answer-submit] backend=${backend} yiqildi, failover -> backend=${fallbackBackend}, external_id=${jobId}`);
      result = await sendToBackend(fallbackBackend, cfg, serviceBody);
      if (result.serviceJobId) {
        // Muvaffaqiyatli failover — job'ga fallback backend'ni yozamiz
        await supabaseAdmin
          .from("case_answer_jobs")
          .update({ backend: fallbackBackend, service_job_id: result.serviceJobId, status: "queued" })
          .eq("id", jobId);
      }
    } else if (result.serviceJobId) {
      // Muvaffaqiyatli — backend va service_job_id ni saqlaymiz
      await supabaseAdmin
        .from("case_answer_jobs")
        .update({ backend, service_job_id: result.serviceJobId, status: "queued" })
        .eq("id", jobId);
    }

    // ── Xato ishlovi ──
    if (!result.serviceJobId) {
      const errMsg = result.errorMsg || "Tashqi xizmat javob bermadi";
      let isFileSourceError = false;
      if (storagePaths.length > 0 && /manba|havola|url|source|open|read|fetch/i.test(errMsg)) {
        isFileSourceError = true;
      }

      // 4xx — foydalanuvchiga aniq xabar; 5xx/tarmoq — umumiy xabar
      const isClientError = is4xx(result.errorStatus ?? 0);
      const userMsg = isFileSourceError
        ? "Faylni o'qib bo'lmadi. Boshqa fayl yuklab ko'ring yoki matnini \u00ab+ Matn\u00bb orqali qo'shing."
        : isClientError
          ? errMsg.slice(0, 200)
          : "AI javob tayyorlanmadi. Keyinroq urinib ko'ring.";

      await supabaseAdmin
        .from("case_answer_jobs")
        .update({ status: "error", error: userMsg })
        .eq("id", jobId);
      return new Response(
        JSON.stringify({ error: userMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Library ma'lumotlarini job qatoriga saqlash (status polling uchun)
    if (creatingLibraryId || libraryRowId) {
      await supabaseAdmin
        .from("case_answer_jobs")
        .update({
          library_id: creatingLibraryId || libraryRowId,
          is_library_reuse: !!library_id,
        })
        .eq("id", jobId);
    }

    return new Response(
      JSON.stringify({ id: jobId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[case-answer-submit] Kutilmagan xato:", err);
    return new Response(
      JSON.stringify({ error: "Javob tayyorlanmadi. Qayta urinib ko'ring." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
