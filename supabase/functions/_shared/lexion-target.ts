// Lexion target config va job ID encoding/decoding uchun shared helper.

interface LexionConfig {
  url: string;
  key: string;
}

// Preview flag'ga qarab Lexion RENDER URL va API KEY ni settings'dan oladi.
// preview=true bo'lsa, alohida preview kalitlarini sinab ko'radi; bo'lmasa oddiy kalitlarga qaytadi.
export async function getLexionConfig(
  supabaseAdmin: { from: (table: string) => unknown },
  preview: boolean
): Promise<LexionConfig> {
  const keys = preview
    ? ["LEXION_RENDER_URL_PREVIEW", "LEXION_RENDER_API_KEY_PREVIEW", "LEXION_RENDER_URL", "LEXION_RENDER_API_KEY"]
    : ["LEXION_RENDER_URL", "LEXION_RENDER_API_KEY"];

  const sb = (supabaseAdmin as { from: (t: string) => { select: (c: string) => { in: (col: string, vals: string[]) => { maybeSingle?: () => Promise<{ data: { key: string; text_value: string | null } | null; error: unknown }>; data?: { key: string; text_value: string | null }[]; error?: unknown } } } }).from("settings");
  const result = await sb.select("key, text_value").in("key", keys);
  const rows: { key: string; text_value: string | null }[] = (result.data as { key: string; text_value: string | null }[]) ?? [];
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.text_value) map[row.key] = row.text_value;
  }

  const url = preview
    ? (map["LEXION_RENDER_URL_PREVIEW"] || map["LEXION_RENDER_URL"] || "").trim()
    : (map["LEXION_RENDER_URL"] || "").trim();
  const key = preview
    ? (map["LEXION_RENDER_API_KEY_PREVIEW"] || map["LEXION_RENDER_API_KEY"] || "").trim()
    : (map["LEXION_RENDER_API_KEY"] || "").trim();

  return { url, key };
}

// Job ID va preview flag'ni bitta string'ga encode qiladi.
// Format: preview bo'lsa "p:<id>", aks holda "<id>".
export function tagLexionJobId(id: string | null, preview: boolean): string | null {
  if (!id) return null;
  return preview ? `p:${id}` : id;
}

// Encoded lexion_job_id ni parse qiladi: { id, preview }.
export function parseLexionJobId(stored: string | null): { id: string; preview: boolean } {
  if (!stored) return { id: "", preview: false };
  if (stored.startsWith("p:")) return { id: stored.slice(2), preview: true };
  return { id: stored, preview: false };
}
