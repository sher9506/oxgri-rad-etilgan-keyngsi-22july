// Tez rejim (Lo'nda): savol to'g'ridan-to'g'ri Gemini'ga ("fast" kalitlar havzasi), Render/NotebookLM'siz.
// Yoqilgan: settings.NASHER_FAST_USERS ("*" yoki talaba id'lari) va havzada kamida bitta kalit bo'lsa.
// NASHER_FAST_SEARCH = "off" bo'lmasa, Gemini Google qidiruvi bilan amaldagi qonun matnini tekshiradi (modda raqamlari aniqroq).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { geminiText, geminiWithPool, loadPool, type PoolKey } from "./key-pool.ts";
import { FAST_INSTRUCTION } from "./nasher-prompts.ts";

export interface FastCfg { keys: PoolKey[]; model: string; search: boolean }

export async function fastConfig(sb: SupabaseClient, userId: string): Promise<FastCfg | null> {
  const { data } = await sb.from("settings").select("key, text_value")
    .in("key", ["NASHER_FAST_USERS", "NASHER_FAST_MODEL", "NASHER_FAST_SEARCH"]);
  const s: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) s[r.key] = String(r.text_value).trim();
  const users = s["NASHER_FAST_USERS"] ?? "";
  if (users !== "*" && !users.split(",").map((x) => x.trim()).includes(String(userId))) return null;
  const keys = await loadPool(sb, "fast");
  if (!keys.length) return null;
  return { keys, model: s["NASHER_FAST_MODEL"] || "gemini-3-flash-preview", search: s["NASHER_FAST_SEARCH"] !== "off" };
}

/** Shu suhbatdagi oxirgi 2 ta savol-javob — aniqlashtiruvchi savolga berilgan javobni tushunish uchun */
export async function chatHistory(sb: SupabaseClient, chatId: string | null, excludeId: string): Promise<{ q: string; a: string }[]> {
  if (!chatId) return [];
  const { data } = await sb.from("case_answer_jobs").select("chat_kazus_text, answer")
    .eq("chat_id", chatId).eq("status", "done").neq("id", excludeId)
    .order("created_at", { ascending: false }).limit(2);
  return (data ?? []).reverse()
    .filter((r) => r.chat_kazus_text && r.answer)
    .map((r) => ({ q: String(r.chat_kazus_text).slice(0, 1500), a: String(r.answer).slice(0, 2500) }));
}

/** Tezkor javob matni. PoolExhausted — hamma kalit band (chaqiruvchi Chuqur rejimga o'tkazadi). */
export async function answerFast(sb: SupabaseClient, cfg: FastCfg, question: string, history: { q: string; a: string }[]): Promise<string> {
  const contents = [
    ...history.flatMap((h) => [
      { role: "user", parts: [{ text: h.q }] },
      { role: "model", parts: [{ text: h.a }] },
    ]),
    { role: "user", parts: [{ text: question }] },
  ];
  const body = {
    systemInstruction: { parts: [{ text: FAST_INSTRUCTION }] },
    contents,
    ...(cfg.search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
  };
  const { data } = await geminiWithPool(sb, "fast", cfg.model, body, { keys: cfg.keys, timeoutMs: 45_000 });
  const text = geminiText(data);
  if (!text) throw new Error("Gemini bo'sh javob qaytardi");
  return text;
}
