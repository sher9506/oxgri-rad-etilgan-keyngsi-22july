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
const MAX_SOURCES = 10;
const MAX_SOURCE_TEXT_LENGTH = 100000;
const MAX_SOURCE_TITLE_LENGTH = 120;

interface SourceInput {
  type: 'text' | 'url';
  title?: string;
  content?: string;
  url?: string;
}

function validateSources(sources: unknown): SourceInput[] {
  if (!Array.isArray(sources)) return [];
  const result: SourceInput[] = [];
  for (let i = 0; i < sources.length && result.length < MAX_SOURCES; i++) {
    const s = sources[i] as Record<string, unknown>;
    if (!s || typeof s !== 'object') continue;
    const type = s.type;
    if (type !== 'text' && type !== 'url') continue;
    let title = typeof s.title === 'string' ? s.title.trim().slice(0, MAX_SOURCE_TITLE_LENGTH) : '';
    if (!title) title = `Manba ${i + 1}`;
    if (type === 'text') {
      const content = typeof s.content === 'string' ? s.content : '';
      if (!content.trim()) continue;
      if (content.length > MAX_SOURCE_TEXT_LENGTH) continue;
      result.push({ type: 'text', title, content });
    } else {
      const url = typeof s.url === 'string' ? s.url.trim() : '';
      if (!url.match(/^https?:\/\/.+/i)) continue;
      result.push({ type: 'url', title, url });
    }
  }
  return result;
}

async function getAnswerServiceConfig(): Promise<{ url: string; key: string }> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, text_value")
    .in("key", ["ANSWER_SERVICE_URL", "ANSWER_SERVICE_KEY"]);
  if (error || !data) return { url: "", key: "" };
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.text_value) map[row.key] = row.text_value;
  }
  return { url: map["ANSWER_SERVICE_URL"] || "", key: map["ANSWER_SERVICE_KEY"] || "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { case_id, kazus_text, title, ustoz_id, sources } = body;

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

    const validSources = validateSources(sources);
    if (Array.isArray(sources) && sources.length > MAX_SOURCES) {
      return new Response(
        JSON.stringify({ error: "Ko'pi bilan 10 ta manba qo'shish mumkin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the teacher owns this case
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

    const { url: ANSWER_SERVICE_URL, key: ANSWER_SERVICE_KEY } = await getAnswerServiceConfig();
    if (!ANSWER_SERVICE_URL || !ANSWER_SERVICE_KEY) {
      console.error("[case-answer-submit] Tashqi xizmat sozlanmagan");
      return new Response(
        JSON.stringify({ error: "Javob tayyorlash xizmati hozir mavjud emas" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a job record first
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("case_answer_jobs")
      .insert({
        case_id,
        teacher_id: ustoz_id,
        status: "queued",
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
      "Siz professional O'zbekiston huquqshunosisiz. Quyidagi kazusni IRAC (Issue, Rule, Application, Conclusion) usulida va berilgan manbalar asosida tahlil qilib yeching. Javob oxirida hech qanday savol bermang va taklif qilmang, faqat tahlilni yozing.\n\nKAZUS MATNI:\n" +
      kazus_text;

    // Build sources payload: text/file → {title, content}, url → {title, url}
    const serviceSources = validSources.map(s => {
      if (s.type === 'url') return { title: s.title, url: s.url };
      return { title: s.title, content: s.content };
    });

    let serviceJobId: string | null = null;

    try {
      const serviceBody: Record<string, unknown> = {
        title,
        kazus_text,
        external_id: jobId,
        instruction,
        sources: serviceSources,
      };
      const serviceRes = await fetch(`${ANSWER_SERVICE_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "X-API-Key": ANSWER_SERVICE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serviceBody),
      });

      if (!serviceRes.ok) {
        const errText = await serviceRes.text().catch(() => "");
        console.error("[case-answer-submit] Tashqi xizmat xatosi:", serviceRes.status, errText);
        await supabaseAdmin
          .from("case_answer_jobs")
          .update({ status: "error", error: "Tashqi xizmat javob bermadi" })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ error: "Javob tayyorlanmadi. Qayta urinib ko'ring." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serviceData = await serviceRes.json();
      serviceJobId = serviceData.job_id ?? null;

      if (!serviceJobId) {
        console.error("[case-answer-submit] Tashqi xizmat job_id qaytarmadi");
        await supabaseAdmin
          .from("case_answer_jobs")
          .update({ status: "error", error: "Tashqi xizmat job_id qaytarmadi" })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ error: "Javob tayyorlanmadi. Qayta urinib ko'ring." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (fetchErr) {
      console.error("[case-answer-submit] Tarmoq xatosi:", fetchErr);
      await supabaseAdmin
        .from("case_answer_jobs")
        .update({ status: "error", error: "Tarmoq xatosi" })
        .eq("id", jobId);
      return new Response(
        JSON.stringify({ error: "Javob tayyorlanmadi. Qayta urinib ko'ring." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job with service_job_id
    await supabaseAdmin
      .from("case_answer_jobs")
      .update({ service_job_id: serviceJobId, status: "queued" })
      .eq("id", jobId);

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
