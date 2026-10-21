// deploy 2026-10-22 kvota-regex
// Gemini kalitlari havzasi (nasher_api_keys): navbat bilan ishlatish, 429/kvotada keyingisiga o'tish, kunlik hisob.
// Kalitlar faqat service_role orqali o'qiladi; loglarga hech qachon to'liq kalit yozilmaydi (faqat oxirgi 4 belgi).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type Pool = "voice" | "fast";
export interface PoolKey { id: string; api_key: string }

export const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const VERTEX_BASE = "https://aiplatform.googleapis.com/v1/publishers/google/models";

/**
 * Gemini generateContent so'rovi. Avval AI Studio manzili (AIza… va yangi AQ.… kalitlari shu yerda ishlaydi);
 * AQ.… kaliti u yerda 401/403 olsa — Vertex AI (express mode) manzili sinab ko'riladi. Javob: oxirgi urinish natijasi.
 */
export async function fetchGemini(apiKey: string, model: string, body: unknown, timeoutMs: number): Promise<{ status: number; text: string }> {
  const call = async (base: string) => {
    const res = await fetch(`${base}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { status: res.status, text: await res.text() };
  };
  const first = await call(GEMINI_BASE);
  if (apiKey.startsWith("AQ.") && (first.status === 401 || first.status === 403)) {
    const vertex = await call(VERTEX_BASE);
    if (vertex.status < 400 || vertex.status === 429) return vertex;
  }
  return first;
}
export const tail = (k: string) => "…" + k.slice(-4);

/** Hamma kalitlar 429 / kvota bilan qaytdi — chaqiruvchi foydalanuvchiga "kuting" deydi yoki chuqur rejimga o'tadi. */
export class PoolExhausted extends Error {
  constructor(public pool: Pool, public detail = "") { super(`${pool}: barcha kalitlar band yoki kvotasi tugagan`); }
}

export async function loadPool(sb: SupabaseClient, pool: Pool): Promise<PoolKey[]> {
  const { data } = await sb.from("nasher_api_keys").select("id, api_key").eq("pool", pool).eq("enabled", true).order("created_at");
  return (data ?? []) as PoolKey[];
}

type Kind = "ok" | "quota" | "error";
export async function recordUsage(sb: SupabaseClient, keyId: string, kind: Kind, status: string) {
  const { error } = await sb.rpc("nasher_api_usage_add", { p_key: keyId, p_kind: kind, p_status: status });
  if (error) console.warn("[key-pool] hisob yozilmadi:", error.message);
}

// "rate" so'zi "generativelanguage" ichida ham bor — shuning uchun faqat aniq kvota iboralari
const isQuota = (status: number, body: string) =>
  status === 429 || (status === 403 && /\bquota\b|exceeded|rate.?limit/i.test(body)) || /RESOURCE_EXHAUSTED/.test(body);

/**
 * Gemini generateContent: tasodifiy kalitdan boshlab navbat bilan (parallel so'rovlar kalitlarga teng tarqaladi).
 * 429/kvota yoki 5xx — keyingi kalit; 400 — so'rovning o'zi xato, boshqa kalit yordam bermaydi.
 */
export async function geminiWithPool(
  sb: SupabaseClient, pool: Pool, model: string, body: unknown, opts: { keys?: PoolKey[]; timeoutMs?: number } = {},
): Promise<{ data: any; key: PoolKey }> {
  const keys = opts.keys ?? await loadPool(sb, pool);
  if (!keys.length) throw new PoolExhausted(pool);
  const start = Math.floor(Math.random() * keys.length);
  let lastErr = "";
  let allQuota = true;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[(start + i) % keys.length];
    try {
      const res = await fetchGemini(key.api_key, model, body, opts.timeoutMs ?? 60_000);
      const text = res.text;
      if (res.status < 400) {
        await recordUsage(sb, key.id, "ok", "200");
        return { data: JSON.parse(text), key };
      }
      if (isQuota(res.status, text)) {
        await recordUsage(sb, key.id, "quota", String(res.status));
        lastErr = `${tail(key.api_key)}: ${res.status} kvota`;
        continue;
      }
      allQuota = false;
      await recordUsage(sb, key.id, "error", String(res.status));
      lastErr = `${tail(key.api_key)}: ${res.status} ${text.slice(0, 200)}`;
      if (res.status === 400) break;
    } catch (e) {
      allQuota = false;
      await recordUsage(sb, key.id, "error", "network");
      lastErr = `${tail(key.api_key)}: ${String(e).slice(0, 200)}`;
    }
  }
  console.warn(`[key-pool] ${pool}: ${lastErr}`);
  if (allQuota) throw new PoolExhausted(pool, lastErr);
  throw new Error(lastErr || "Gemini javob bermadi");
}

/** Javobdagi matn qismlari */
export const geminiText = (data: any): string =>
  (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
