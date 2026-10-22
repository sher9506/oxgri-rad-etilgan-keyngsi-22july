// deploy 2026-10-22 xatolar-1-5
// Ovoz → matn (Gemini; voice, keyin fast va router kalitlar havzalari): bot (Telegram ovozi) va sayt/Mini App mikrofoni uchun umumiy.
// Asosiy model band (503) yoki kvotasi tugasa — zaxira model; u ham ishlamasa xato chaqiruvchiga (PoolExhausted — "kuting").
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { geminiText, geminiWithPool, PoolExhausted } from "./key-pool.ts";

export const VOICE_MAX_SEC = 120;
export const VOICE_TOO_LONG = "🎤 Iltimos, 2 daqiqagacha gapiring yoki ikkiga bo'lib yuboring.";
export const VOICE_BUSY = "⏳ Xizmatdan foydalanuvchilar ko'pligi sababli vaqtincha kutishingizga to'g'ri keladi. Birozdan keyin qayta yuboring yoki savolingizni yozib yuboring.";
const VOICE_FALLBACK_MODEL = "gemini-2.5-flash";
const VOICE_POOLS = ["voice", "fast", "router"] as const;
const TRANSCRIBE_PROMPT =
  "Bu ovozli xabarni so'zma-so'z matnga aylantir. Til o'zbek (ba'zan rus so'zlari aralashadi). " +
  "O'zbek lotin yozuvida, tinish belgilari bilan yoz. Faqat aytilgan matnni qaytar — izoh, sarlavha, tarjima qo'shma. " +
  "Agar nutq eshitilmasa, faqat bo'sh qator qaytar.";

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Matn yoki null (nutq yo'q/tushunarsiz). audioBase64 — base64 qilingan audio. */
export async function transcribeAudio(sb: SupabaseClient, audioBase64: string, mime: string): Promise<string | null> {
  const { data: row } = await sb.from("settings").select("text_value").eq("key", "NASHER_VOICE_MODEL").maybeSingle();
  const model = String(row?.text_value ?? "").trim() || "gemini-3-flash-preview";
  const body = (m: string) => ({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: audioBase64 } }, { text: TRANSCRIBE_PROMPT }] }],
    // Gemini 3: o'ylashsiz — tezroq va o'ylash tokenlari matnni kesib qo'ymaydi
    generationConfig: { temperature: 0, maxOutputTokens: 2000, ...(m.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}) },
  });
  // umumiy muddat 60 s (zaxira model bilan birga): bot/server funksiyasi to'xtatilmasidan oldin foydalanuvchiga javob qaytsin
  const deadline = Date.now() + 60_000;
  // har model uchun havzalar navbat bilan: voice → fast → router (biri ishlamasa keyingisi)
  let lastErr: unknown = new PoolExhausted("voice");
  for (const m of model === VOICE_FALLBACK_MODEL ? [model] : [model, VOICE_FALLBACK_MODEL]) {
    for (const pool of VOICE_POOLS) {
      if (deadline - Date.now() < 3_000) throw lastErr;
      try {
        const { data } = await geminiWithPool(sb, pool, m, body(m), { timeoutMs: 45_000, deadline });
        const text = geminiText(data).trim();
        return text.length >= 3 ? text : null;
      } catch (e) {
        lastErr = e;
        console.warn(`[nasher-voice] ${m}/${pool} ishlamadi:`, (e instanceof PoolExhausted ? e.detail : String(e)).slice(0, 200));
      }
    }
  }
  throw lastErr;
}
