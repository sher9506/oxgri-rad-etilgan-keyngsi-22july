// Lexion (URL topuvchi) Render manzili. Sayt (fanfaster.uz va preview) yangi Lexion'ni ishlatadi; bot hozircha settings'dagi eskisida.
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
const EXTRA_SEP = "~";   // ikkinchi (parallel) Lexion qidiruvining ID'si: "p:<id1>~<id2>"
export function tagLexionJobId(id: string, preview: boolean, extraId?: string | null): string {
  return (preview ? PREVIEW_TAG + id : id) + (extraId ? EXTRA_SEP + extraId : "");
}
export function parseLexionJobId(stored: string): { id: string; preview: boolean; extra: string | null } {
  const [main, extra = null] = stored.split(EXTRA_SEP);
  return main.startsWith(PREVIEW_TAG)
    ? { id: main.slice(PREVIEW_TAG.length), preview: true, extra }
    : { id: main, preview: false, extra };
}

/** Ikki qidiruv natijasini navbatma-navbat birlashtiradi (a1, b1, a2, b2...): har ikkisining eng moslari oldinda qoladi */
export function interleaveUrls(a: string[], b: string[], max = 15): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    for (const u of [a[i], b[i]]) if (u && !out.includes(u)) out.push(u);
  }
  return out.slice(0, max);
}

