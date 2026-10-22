// deploy 2026-10-22 limit-oldin
// deploy 2026-10-22 mikrofon
// Sayt va Mini App mikrofoni: yozib olingan ovoz (≤2 daqiqa) → matn. Bot bilan bir xil Gemini "voice" havzasi.
// Kirish: { ustoz_id, audio (base64), mime }. Faqat NASHER_VOICE_USERS ("*" yoki id'lar) ro'yxatidagilar.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { PoolExhausted } from "../_shared/key-pool.ts";
import { transcribeAudio, VOICE_BUSY } from "../_shared/nasher-voice.ts";
import { chatQuota } from "../_shared/nasher-quota.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
// 2 daqiqalik opus/webm ~1–2 MB; base64 ≈ ×1.37 — 4 MB dan kattasi 2 daqiqadan uzun yoki yaroqsiz
const MAX_B64 = 4_000_000;
const MIME_RE = /^(audio|video)\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)(;.*)?$/;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Faqat POST" }, 405);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "JSON noto'g'ri" }, 400); }

  const userId = typeof b.ustoz_id === "string" ? b.ustoz_id.trim() : "";
  const audio = typeof b.audio === "string" ? b.audio : "";
  const mime = typeof b.mime === "string" ? b.mime.trim().toLowerCase() : "";
  if (!userId || !audio) return json({ error: "Ovoz yuborilmadi" }, 400);
  if (audio.length > MAX_B64) return json({ error: "🎤 Iltimos, 2 daqiqagacha gapiring." }, 413);
  if (!MIME_RE.test(mime)) return json({ error: "Ovoz formati qo'llanmaydi" }, 400);

  const { data: s } = await sb.from("settings").select("text_value").eq("key", "NASHER_VOICE_USERS").maybeSingle();
  const users = String(s?.text_value ?? "").trim();
  if (users !== "*" && !users.split(",").map((x) => x.trim()).includes(userId)) {
    return json({ error: "Ovozli savol tez orada qo'shiladi — hozircha yozib yuboring." }, 403);
  }

  // limit tugagan bo'lsa ovoz matnga aylantirilmaydi (kalit sarflanmasin)
  const block = await chatQuota(sb, userId);
  if (block) return json(block, 429);

  try {
    const text = await transcribeAudio(sb, audio, mime.split(";")[0]);
    if (!text) return json({ error: "🎤 Ovozni tushunib bo'lmadi. Aniqroq gapiring yoki yozib yuboring." }, 422);
    return json({ text });
  } catch (e) {
    console.error("[nasher-transcribe]", (e instanceof PoolExhausted ? e.detail : String(e)).slice(0, 300));
    return json({ error: e instanceof PoolExhausted ? VOICE_BUSY : "⚠️ Ovozni o'qib bo'lmadi. Birozdan keyin qayta urinib ko'ring yoki yozib yuboring.", busy: true }, 503);
  }
});
