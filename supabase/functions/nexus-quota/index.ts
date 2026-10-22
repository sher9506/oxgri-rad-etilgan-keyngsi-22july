// deploy 2026-10-22 xatolar-1-5
// nexus-quota — Nexus AI uchun o'qish uchun limit ma'lumoti
// Hech narsa yozmaydi. verify_jwt = false (anon front chaqira oladi)
import { createClient } from "npm:@supabase/supabase-js@2";
import { channelInfo, CHANNEL_BONUS } from "../_shared/nasher-channel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const CHAT_LIMIT_COUNT = 8;
const CHAT_LIMIT_WINDOW_HOURS = 5;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id } = body as { user_id?: string };

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ustozlar uchun limit yo'q
    const { data: talabaRow } = await supabaseAdmin
      .from("talabalar")
      .select("id")
      .eq("id", user_id)
      .maybeSingle();

    // Telegram (bot / Mini App) foydalanuvchilari ham talabalar kabi limitli
    const isStudent = !!talabaRow || String(user_id).startsWith("tg_");

    if (!isStudent) {
      return new Response(
        JSON.stringify({
          limit: CHAT_LIMIT_COUNT,
          window_hours: CHAT_LIMIT_WINDOW_HOURS,
          used: 0,
          remaining: CHAT_LIMIT_COUNT,
          next_reset_at: null,
          server_now: new Date().toISOString(),
          is_unlimited: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const windowMs = CHAT_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
    const windowStart = new Date(Date.now() - windowMs).toISOString();

    const { count: windowCount } = await supabaseAdmin
      .from("case_answer_jobs")
      .select("id", { count: "exact", head: true })
      .eq("job_kind", "chat")
      .eq("teacher_id", user_id)
      .in("status", ["queued", "running", "done"])
      .is("deep_of", null)   // «Chuqur tahlil» qayta so'rovi limitga qo'shilmaydi
      .gte("created_at", windowStart);

    const used = windowCount ?? 0;
    const ch = await channelInfo(supabaseAdmin, String(user_id));
    const limit = CHAT_LIMIT_COUNT + (ch.member ? CHANNEL_BONUS : 0);
    const remaining = Math.max(0, limit - used);

    let nextResetAt: string | null = null;
    if (used > 0) {
      const { data: oldestJob } = await supabaseAdmin
        .from("case_answer_jobs")
        .select("created_at")
        .eq("job_kind", "chat")
        .eq("teacher_id", user_id)
        .in("status", ["queued", "running", "done"])
        .is("deep_of", null)   // «Chuqur tahlil» qayta so'rovi limitga qo'shilmaydi
        .gte("created_at", windowStart)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (oldestJob) {
        nextResetAt = new Date(new Date(oldestJob.created_at).getTime() + windowMs).toISOString();
      }
    }

    return new Response(
      JSON.stringify({
        limit,
        window_hours: CHAT_LIMIT_WINDOW_HOURS,
        used,
        remaining,
        channel: ch.channel,            // null — kanal taklifi o'chiq
        channel_member: ch.member,      // null — Telegram bog'lanmagan
        channel_bonus: CHANNEL_BONUS,
        next_reset_at: nextResetAt,
        server_now: new Date().toISOString(),
        is_unlimited: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[nexus-quota] Xato:", err);
    return new Response(
      JSON.stringify({ error: "Limit ma'lumotini olib bo'lmadi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// nexus-deploy-trigger Sat Oct 10 21:11:36 UTC 2026

