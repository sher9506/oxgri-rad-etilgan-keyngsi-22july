const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const fileUrl = url.searchParams.get("url");

    if (!fileUrl) {
      return new Response(
        JSON.stringify({ error: "url parametri kerak" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Noto'g'ri URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith(".onspace.ai") && !host.endsWith(".supabase.co")) {
      return new Response(
        JSON.stringify({ error: "Faqat onspace.ai va supabase.co domenlariga ruxsat berilgan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch(fileUrl, {
      headers: { "User-Agent": "Supabase-Proxy/1.0" },
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ error: `Fayl serveri xatosi: ${resp.status}` }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    const contentLength = resp.headers.get("content-length");

    const headers: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    };
    if (contentLength) headers["Content-Length"] = contentLength;

    return new Response(resp.body, { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || "Server xatosi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
