// nexus-chats-status — foydalanuvchining suhbat xotira holatini qaytaradi.
// Auth: case-answer-status bilan AYNAN bir xil — body'dan ustoz_id/user_id olinadi,
// service-role bilan o'sha user_id qatorlari xolos o'qiladi.
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

async function getSetting(key: string): Promise<string> {
  const { data } = await sb
    .from("settings")
    .select("text_value")
    .eq("key", key)
    .maybeSingle();
  return data?.text_value ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, chat_ids } = body as {
      user_id?: string;
      chat_ids?: string[];
    };

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ids = Array.isArray(chat_ids)
      ? chat_ids.filter((c): c is string => typeof c === "string" && c.length > 0).slice(0, 50)
      : [];

    const memoryEnabled = (await getSetting("NEXUS_KEEP_NOTEBOOK")).toLowerCase() === "on";
    const maxActiveStr = await getSetting("NEXUS_MAX_ACTIVE_CHATS_PER_USER");
    const maxActive = Math.max(1, parseInt(maxActiveStr, 10) || 15);

    const nowIso = new Date().toISOString();

    // Faol qatorlar soni (status='active' va expires_at > now)
    let activeCount = 0;
    const { count } = await sb
      .from("nexus_chat_notebooks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user_id)
      .eq("status", "active")
      .gt("expires_at", nowIso);
    activeCount = count ?? 0;

    // So'ralgan chat_id lar bo'yicha holat
    const chats: Record<string, { status: string; expires_at: string | null; turns: number }> = {};
    if (ids.length > 0) {
      const { data: rows } = await sb
        .from("nexus_chat_notebooks")
        .select("chat_id, status, expires_at, turns")
        .eq("user_id", user_id)
        .in("chat_id", ids);

      for (const row of rows ?? []) {
        chats[row.chat_id] = {
          status: row.status ?? "active",
          expires_at: row.expires_at ?? null,
          turns: row.turns ?? 0,
        };
      }
    }

    return new Response(
      JSON.stringify({
        server_now: nowIso,
        memory_enabled: memoryEnabled,
        max_active: maxActive,
        active_count: activeCount,
        chats,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[nexus-chats-status] Xato:", err);
    return new Response(
      JSON.stringify({ error: "Holatni olib bo'lmadi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
