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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { ustoz_id } = body;

    if (!ustoz_id) {
      return new Response(
        JSON.stringify({ error: "ustoz_id majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("answer_source_libraries")
      .select("id, title, sources, status, created_at, last_used_at")
      .eq("teacher_id", ustoz_id)
      .in("status", ["creating", "ready"])
      .order("last_used_at", { ascending: true, nullsFirst: true });

    if (error) {
      console.error("[case-library-list] DB xatosi:", error.message);
      return new Response(
        JSON.stringify({ error: "Ro'yxatni olishda xatolik" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const libraries = (data || []).map((row) => {
      const sources = Array.isArray(row.sources) ? row.sources : [];
      return {
        id: row.id,
        title: row.title,
        source_count: sources.length,
        sources: sources.map((s: Record<string, unknown>) => ({
          name: s.name ?? s.title ?? "",
          size: s.size ?? 0,
        })),
        last_used_at: row.last_used_at,
        created_at: row.created_at,
      };
    });

    return new Response(
      JSON.stringify({ libraries }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[case-library-list] Kutilmagan xato:", err);
    return new Response(
      JSON.stringify({ error: "Ro'yxatni olishda xatolik" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

