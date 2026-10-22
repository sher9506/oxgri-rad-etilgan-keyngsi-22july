// deploy 2026-10-22 kesilgan-javob
// Tez rejim (Lo'nda): savol to'g'ridan-to'g'ri Gemini'ga ("fast" kalitlar havzasi), Render/NotebookLM'siz.
// Yoqilgan: settings.NASHER_FAST_USERS ("*" yoki talaba id'lari) va havzada kamida bitta kalit bo'lsa.
// NASHER_FAST_SEARCH = "off" bo'lmasa, Gemini Google qidiruvi bilan amaldagi qonun matnini tekshiradi (modda raqamlari aniqroq).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { geminiText, geminiWithPool, loadPool, PoolExhausted, type PoolKey } from "./key-pool.ts";
import { FAST_INSTRUCTION } from "./nasher-prompts.ts";

const FALLBACK_MODEL = "gemini-2.5-flash";

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

/** Bir urinishning so'rov tanasi: qidiruv va "o'ylash" sozlamasi ixtiyoriy (ba'zi kalit/modellar ularni qo'llamaydi) */
function fastBody(contents: unknown[], search: boolean, thinking: boolean) {
  return {
    systemInstruction: { parts: [{ text: FAST_INSTRUCTION }] },
    contents,
    ...(search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      temperature: 0.2,
      // "o'ylash" tokenlari ham shu chegaraga kiradi — kichik chegara bo'sh javobga olib keladi
      maxOutputTokens: 8192,
      ...(thinking ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
    },
  };
}

/**
 * Tezkor javob matni. Ketma-ket urinishlar: (qidiruv + past o'ylash) → (qidiruvsiz) → (oddiy so'rov) → zaxira model.
 * Hammasi muvaffaqiyatsiz bo'lsa xato (chaqiruvchi Chuqurga o'tkazadi); faqat kvota bo'lsa — PoolExhausted.
 */
export async function answerFast(sb: SupabaseClient, cfg: FastCfg, question: string, history: { q: string; a: string }[]): Promise<string> {
  const contents = [
    ...history.flatMap((h) => [
      { role: "user", parts: [{ text: h.q }] },
      { role: "model", parts: [{ text: h.a }] },
    ]),
    { role: "user", parts: [{ text: question }] },
  ];
  // [model, qidiruv, o'ylash]; zaxira model (2.5) kvotasi alohida va thinkingLevel'ni bilmaydi — o'ylashsiz
  const attempts: [string, boolean, boolean][] = [
    ...(cfg.search ? [[cfg.model, true, true]] as [string, boolean, boolean][] : []),
    [cfg.model, false, true], [cfg.model, false, false],
    ...(cfg.model !== FALLBACK_MODEL ? [[FALLBACK_MODEL, false, false]] as [string, boolean, boolean][] : []),
  ];
  const errors: string[] = [];
  let exhausted: PoolExhausted | null = null;
  let partial = "";   // MAX_TOKENS bilan kesilgan javob — boshqa urinishlar ham ishlamasa, oxirgi chora
  for (const [model, search, thinking] of attempts) {
    if (exhausted && model === cfg.model) continue;   // asosiy model kvotasi tugagan — darhol zaxiraga
    try {
      const { data } = await geminiWithPool(sb, "fast", model, fastBody(contents, search, thinking), { keys: cfg.keys, timeoutMs: 40_000 });
      const text = geminiText(data);
      const finish = data?.candidates?.[0]?.finishReason ?? "?";
      // kesilgan javob gap o'rtasida uziladi (o'ylash tokenlari chegarani yeydi) — keyingi urinish o'ylashsiz
      if (text && finish !== "MAX_TOKENS") return text;
      if (text && text.length > partial.length) partial = text;
      errors.push(`${model}: ${text ? "kesilgan" : "bo'sh"} javob (${finish}, qidiruv=${search}, o'ylash=${thinking})`);
    } catch (e) {
      if (e instanceof PoolExhausted) exhausted = e;
      errors.push(`${model}: ${String(e).slice(0, 160)} (qidiruv=${search}, o'ylash=${thinking})`);
    }
  }
  console.warn("[nasher-fast]", errors.join(" | "));
  if (partial) return partial + " …";
  if (exhausted && errors.every((x) => x.includes("kalitlar band"))) throw exhausted;
  throw new Error("Gemini javob bermadi: " + errors.join(" | "));
}
