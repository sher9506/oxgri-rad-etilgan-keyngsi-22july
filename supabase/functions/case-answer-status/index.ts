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

const ANSWER_SERVICE_URL = Deno.env.get("ANSWER_SERVICE_URL") ?? "";
const ANSWER_SERVICE_KEY = Deno.env.get("ANSWER_SERVICE_KEY") ?? "";

function sanitizeAnswer(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bNotebookLM\b/gi, "manba")
    .replace(/\bGemini Notebook\b/gi, "manba")
    .replace(/\bNotebook\b/gi, "manba");
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

    // Fetch the job and verify ownership
    const { data: job, error: jobError } = await supabaseAdmin
      .from("case_answer_jobs")
      .select("id, case_id, teacher_id, service_job_id, status, answer, error")
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
        JSON.stringify({ status: "done", answer: sanitizeAnswer(job.answer || ""), error: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (job.status === "error") {
      return new Response(
        JSON.stringify({ status: "error", answer: null, error: job.error || "Xatolik yuz berdi" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Still queued or running — poll the external service
    if (!job.service_job_id) {
      return new Response(
        JSON.stringify({ status: job.status, answer: null, error: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ANSWER_SERVICE_URL || !ANSWER_SERVICE_KEY) {
      console.error("[case-answer-status] Tashqi xizmat sozlanmagan");
      return new Response(
        JSON.stringify({ status: "error", answer: null, error: "Javob tayyorlash xizmati hozir mavjud emas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const serviceRes = await fetch(
        `${ANSWER_SERVICE_URL}/api/jobs/${job.service_job_id}`,
        {
          method: "GET",
          headers: {
            "X-API-Key": ANSWER_SERVICE_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (!serviceRes.ok) {
        const errText = await serviceRes.text().catch(() => "");
        console.error("[case-answer-status] Tashqi xizmat xatosi:", serviceRes.status, errText);
        return new Response(
          JSON.stringify({ status: job.status, answer: null, error: null }),
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
        errorMsg = typeof serviceData.error === "string" ? serviceData.error : "Tashqi xizmat xatosi";
      } else if (remoteStatus === "running" || remoteStatus === "processing") {
        newStatus = "running";
      } else if (remoteStatus === "queued" || remoteStatus === "pending") {
        newStatus = "queued";
      }

      // Persist the updated state
      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (answer !== null) updatePayload.answer = answer;
      if (errorMsg !== null) updatePayload.error = errorMsg;

      await supabaseAdmin
        .from("case_answer_jobs")
        .update(updatePayload)
        .eq("id", id);

      return new Response(
        JSON.stringify({
          status: newStatus,
          answer: answer !== null ? sanitizeAnswer(answer) : null,
          error: errorMsg,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      console.error("[case-answer-status] Tarmoq xatosi:", fetchErr);
      return new Response(
        JSON.stringify({ status: job.status, answer: null, error: null }),
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
