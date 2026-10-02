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
    const { library_id, ustoz_id } = body;

    if (!library_id || !ustoz_id) {
      return new Response(
        JSON.stringify({ error: "library_id va ustoz_id majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    const { data: lib, error: libError } = await supabaseAdmin
      .from("answer_source_libraries")
      .select("id, teacher_id, notebook_id, profile")
      .eq("id", library_id)
      .maybeSingle();

    if (libError || !lib) {
      return new Response(
        JSON.stringify({ error: "To'plam topilmadi" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (lib.teacher_id !== ustoz_id) {
      // Check if admin
      const { data: teacher } = await supabaseAdmin
        .from("ustoz")
        .select("rol")
        .eq("ustoz_id", ustoz_id)
        .maybeSingle();
      if (!teacher || teacher.rol !== "admin") {
        return new Response(
          JSON.stringify({ error: "Bu amal uchun ruxsat yo'q" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Call external service to delete the notebook
    const { url: ANSWER_SERVICE_URL, key: ANSWER_SERVICE_KEY } = await getAnswerServiceConfig();
    if (ANSWER_SERVICE_URL && ANSWER_SERVICE_KEY && lib.notebook_id && lib.profile) {
      try {
        const res = await fetch(
          `${ANSWER_SERVICE_URL}/api/notebooks/${lib.profile}/${lib.notebook_id}`,
          {
            method: "DELETE",
            headers: {
              "X-API-Key": ANSWER_SERVICE_KEY,
              "Content-Type": "application/json",
            },
          }
        );
        if (!res.ok) {
          console.error("[case-library-delete] Tashqi xizmat o'chirish xatosi:", res.status);
          return new Response(
            JSON.stringify({ error: "O'chirib bo'lmadi. Keyinroq urinib ko'ring." }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (fetchErr) {
        console.error("[case-library-delete] Tarmoq xatosi:", fetchErr);
        return new Response(
          JSON.stringify({ error: "O'chirib bo'lmadi. Keyinroq urinib ko'ring." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Delete the row
    const { error: delError } = await supabaseAdmin
      .from("answer_source_libraries")
      .delete()
      .eq("id", library_id);

    if (delError) {
      console.error("[case-library-delete] DB o'chirish xatosi:", delError.message);
      return new Response(
        JSON.stringify({ error: "O'chirib bo'lmadi. Keyinroq urinib ko'ring." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[case-library-delete] Kutilmagan xato:", err);
    return new Response(
      JSON.stringify({ error: "O'chirib bo'lmadi. Keyinroq urinib ko'ring." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

