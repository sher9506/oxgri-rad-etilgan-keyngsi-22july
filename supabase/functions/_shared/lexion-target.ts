// Lexion (URL topuvchi) Render manzili. Preview sayt yangi Lexion'ni sinaydi, fanfaster.uz eskisida qoladi.
// shortcut: preview manzili kodda qattiq yozilgan (foydalanuvchi URL bera olmaydi — SSRF yo'q); sinov tugagach olib tashlanadi.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
const PREVIEW_LEXION_URL = "https://lexion-model.onrender.com";
const PREVIEW_TAG = "p:";   // preview ishining lexion_job_id'si shu bilan boshlanadi: status ham o'sha Lexion'ni so'raydi
export async function getLexionConfig(db: SupabaseClient, preview = false): Promise<{ url: string; key: string }> {
  const { data, error } = await db
    .from("settings")
    .select("key, text_value")
    .in("key", ["LEXION_RENDER_URL", "LEXION_RENDER_API_KEY"]);
  if (error || !data) return { url: "", key: "" };
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.text_value) map[row.key] = row.text_value;
  }
  return {
    url: preview ? PREVIEW_LEXION_URL : (map["LEXION_RENDER_URL"] || "").trim(),
    key: (map["LEXION_RENDER_API_KEY"] || "").trim(),
  };
}
export function tagLexionJobId(id: string, preview: boolean): string {
  return preview ? PREVIEW_TAG + id : id;
}
export function parseLexionJobId(stored: string): { id: string; preview: boolean } {
  return stored.startsWith(PREVIEW_TAG)
    ? { id: stored.slice(PREVIEW_TAG.length), preview: true }
    : { id: stored, preview: false };
}

