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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, user_role, model, savol } = body as {
      user_id?: string;
      user_role?: string;
      model?: string;
      savol?: string;
    };

    if (!user_id || !savol || !model) {
      return new Response(
        JSON.stringify({ error: "user_id, model va savol majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (model !== "manbali" && model !== "lexion") {
      return new Response(
        JSON.stringify({ error: "Model 'manbali' yoki 'lexion' bo'lishi kerak" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (savol.length > MAX_SAVOL_LENGTH) {
      return new Response(
        JSON.stringify({ error: "Savol 12000 belgidan oshmasligi kerak" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Duplicate prevention: check if user already has an active job
    const { data: existing } = await supabaseAdmin
      .from("chat_jobs")
      .select("id, status")
      .eq("user_id", user_id)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          id: existing.id,
          status: existing.status,
          already_active: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new job
    const { data: jobRow, error: jobError } = await supabaseAdmin
      .from("chat_jobs")
      .insert({
        user_id,
        user_role: user_role || "oquvchi",
        model,
        savol,
        status: "queued",
        phase: "qidiryapti",
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

    // Queue position
    const { count } = await supabaseAdmin
      .from("chat_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["queued", "running"]);

    console.log(`[chat-submit] Job created: ${jobRow.id}, model=${model}, queue≈${count}`);

    // Trigger worker (fire and forget)
    const workerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-worker`;
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ trigger: true }),
    }).catch((e) => console.warn("[chat-submit] Worker trigger failed:", e));

    return new Response(
      JSON.stringify({ id: jobRow.id, queue_position: count ?? 1 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[chat-submit] xato:", err);
    return new Response(
      JSON.stringify({ error: "So'rovni qayta ishlashda xatolik" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

