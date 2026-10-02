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
      .select("id, case_id, teacher_id, service_job_id, status, answer, error, library_id, is_library_reuse")
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

    const { url: ANSWER_SERVICE_URL, key: ANSWER_SERVICE_KEY } = await getAnswerServiceConfig();
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
        if (serviceRes.status === 404) {
          const errMsg = "Javob tayyorlanmadi (xizmat qayta ishga tushgan). Qayta urinib ko'ring.";
          await supabaseAdmin
            .from("case_answer_jobs")
            .update({ status: "error", error: errMsg })
            .eq("id", id);
          return new Response(
            JSON.stringify({ status: "error", answer: null, error: errMsg }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
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
        const rawErr = typeof serviceData.error === "string" ? serviceData.error : "Tashqi xizmat xatosi";
        const errorCode = typeof serviceData.error_code === "string" ? serviceData.error_code : "";

        // library_missing — saqlangan to'plam o'chirilgan yoki topilmagan
        if (errorCode === "library_missing") {
          errorMsg = "Saqlangan manbalar topilmadi. Manbalarni qayta qo'shing.";
          // library_id'ni o'chirib qo'yamiz ki UI library seçimni tozlasin
          if (job.library_id) {
            try {
              await supabaseAdmin
                .from("answer_source_libraries")
                .delete()
                .eq("id", job.library_id);
            } catch { /* ignore */ }
          }
        } else {
          // Fayl manbasi bilan bog'liq xato bo'lsa, aniq xabar ko'rsatish
          const { data: jobFiles } = await supabaseAdmin
            .from("case_answer_jobs")
            .select("source_file_paths")
            .eq("id", id)
            .maybeSingle();
          const hasFilePaths = Array.isArray(jobFiles?.source_file_paths)
            ? jobFiles.source_file_paths.length > 0
            : (typeof jobFiles?.source_file_paths === 'string' && JSON.parse(jobFiles.source_file_paths).length > 0);
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
      // Agar ish muvaffaqiyatli bo'lsa va library_id bog'langan bo'lsa:
      // - creating status'dagi qatorni ready ga o'tkazamiz
      // - notebook_id va profile ni saqlaymiz (main.py keep=True qaytargan)
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
          // notebook_id/profile kelmadi — creating qatorni o'chiramiz
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

        // Clean up uploaded files from Storage after job completion
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
            // Clear paths after cleanup
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

