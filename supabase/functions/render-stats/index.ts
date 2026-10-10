// Render backend statistikasi proxy — admin panel uchun
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

type BackendTarget = { backend: number; url: string };
type BackendResult = {
  backend: number;
  status: "ok" | "unavailable" | "unconfigured";
  http_status: number | null;
  stats: Record<string, unknown> | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("settings")
      .select("key, text_value")
      .in("key", ["ANSWER_SERVICE_URL", "ANSWER_SERVICE_URL_2", "ANSWER_SERVICE_URL_3", "ANSWER_SERVICE_KEY"]);

    if (error) throw error;

    const settings: Record<string, string> = {};
    for (const row of data ?? []) {
      if (row.text_value) settings[row.key] = row.text_value.trim();
    }

    const key = settings.ANSWER_SERVICE_KEY ?? "";
    const targets: BackendTarget[] = [
      { backend: 1, url: settings.ANSWER_SERVICE_URL ?? "" },
      { backend: 2, url: settings.ANSWER_SERVICE_URL_2 ?? "" },
      { backend: 3, url: settings.ANSWER_SERVICE_URL_3 ?? "" },
    ];

    const results = await Promise.all(targets.map(async (target): Promise<BackendResult> => {
      if (!target.url) {
        return { backend: target.backend, status: "unconfigured", http_status: null, stats: null };
      }
      if (!key) {
        return { backend: target.backend, status: "unavailable", http_status: null, stats: null };
      }

      try {
        const response = await fetch(`${target.url}/api/stats`, {
          headers: { "X-API-Key": key },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          return { backend: target.backend, status: "unavailable", http_status: response.status, stats: null };
        }
        const payload: unknown = await response.json();
        const stats = payload && typeof payload === "object" && !Array.isArray(payload)
          ? payload as Record<string, unknown>
          : null;
        return { backend: target.backend, status: stats ? "ok" : "unavailable", http_status: response.status, stats };
      } catch {
        return { backend: target.backend, status: "unavailable", http_status: null, stats: null };
      }
    }));

    return new Response(JSON.stringify({ backends: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[render-stats] So'rov xatosi:", error);
    return new Response(JSON.stringify({ error: "Render statistikasi olinmadi" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
