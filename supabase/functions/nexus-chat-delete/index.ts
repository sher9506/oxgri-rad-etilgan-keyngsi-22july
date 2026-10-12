// nexus-chat-delete — foydalanuvchining shu chat'dagi faol xotira qatorini 'expired' qiladi.
// deploy-trigger Sat Oct 12 2026 16:10 UTC
// Auth: case-answer-status bilan AYNAN bir xil — body'dan user_id olinadi.
// verify_jwt = false (config.toml).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, chat_id } = body as {
      user_id?: string;
      chat_id?: string;
    };

    if (!user_id || !chat_id) {
      return new Response(
        JSON.stringify({ error: "user_id va chat_id majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Faqat o'sha user_id ning shu chat_id qatorini 'expired' qilamiz
    const { data, error } = await sb
      .from("nexus_chat_notebooks")
      .update({ status: "expired" })
      .eq("user_id", user_id)
      .eq("chat_id", chat_id)
      .eq("status", "active")
      .select("id");

    if (error) {
      console.error("[nexus-chat-delete] Xato:", error.message);
      return new Response(
        JSON.stringify({ error: "O'chirib bo'lmadi" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) case_answer_jobs dagi shu chat qatorlariga deleted_at = now() qo'y (DELETE QILMASDAN)
    const nowIso = new Date().toISOString();
    const { error: jobErr } = await sb
      .from("case_answer_jobs")
      .update({ deleted_at: nowIso })
      .eq("teacher_id", user_id)
      .eq("chat_id", chat_id)
      .eq("job_kind", "chat")
      .is("deleted_at", null);

    if (jobErr) {
      console.error("[nexus-chat-delete] case_answer_jobs soft-delete xatosi:", jobErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true, expired: data?.length ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[nexus-chat-delete] Xato:", err);
    return new Response(
      JSON.stringify({ error: "O'chirib bo'lmadi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
