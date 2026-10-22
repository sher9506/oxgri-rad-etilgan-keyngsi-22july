// deploy 2026-10-22 router-model2
// deploy 2026-10-22 router-model
// deploy 2026-10-22 router-havza
// deploy 2026-10-22 tez-fix
// deploy 2026-10-22 ai-studio-avval
// NaSher Gemini kalitlari havzasini boshqarish (admin panel). Auth: x-admin-code — PIN (secret NASHER_ADMIN_CODE yoki nasher_private_settings dagi SHA-256 xesh).
// To'liq kalit hech qachon javobga yoki logga chiqmaydi — faqat boshi va oxirgi 4 belgisi.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchGemini, GEMINI_BASE, tail, type Pool } from "../_shared/key-pool.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { ...corsHeaders, "Access-Control-Allow-Headers": corsHeaders["Access-Control-Allow-Headers"] + ", x-admin-code" };
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const LIMIT: Record<Pool, number> = { voice: 10, fast: 15, router: 3 };
const MODEL_KEY = { fast: "NASHER_FAST_MODEL", voice: "NASHER_VOICE_MODEL", router: "NASHER_ROUTER_MODEL" } as const;
const DEFAULT_MODEL = "gemini-3-flash-preview";
const ROUTER_DEFAULT_MODEL = "gemini-3-flash-preview";   // bot/index.ts bilan bir xil
// Google AI Studio kalitlari: eski "AIza…" va yangi "AQ.…" formatlari
const KEY_RE = /^(AIza[0-9A-Za-z_\-]{30,}|AQ\.[0-9A-Za-z_\-.]{20,})$/;
const MODEL_RE = /^gemini-[\w.\-]+$/;

const mask = (k: string) => k.slice(0, 4) + tail(k);
const isPool = (p: unknown): p is Pool => p === "voice" || p === "fast" || p === "router";
const tashkentDay = (offsetDays = 0) =>
  new Date(Date.now() + 5 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function readModels(): Promise<Record<keyof typeof MODEL_KEY, string>> {
  const { data, error } = await sb.from("settings").select("key, text_value").in("key", Object.values(MODEL_KEY));
  if (error) console.warn("[nasher-keys] settings o'qilmadi:", error.message);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, String(r.text_value ?? "").trim()]));
  return {
    fast: m[MODEL_KEY.fast] || DEFAULT_MODEL,
    voice: m[MODEL_KEY.voice] || DEFAULT_MODEL,
    router: m[MODEL_KEY.router] || ROUTER_DEFAULT_MODEL,
  };
}

/** Kichik haqiqiy so'rov bilan kalitni sinash. invalid=true bo'lsa kalit saqlanmaydi. */
/** Google xato matni (kalitsiz, qisqa) — admin sababini darhol ko'rsin */
const googleError = (body: string) => {
  try { return String(JSON.parse(body)?.error?.message ?? body).slice(0, 220); } catch { return body.slice(0, 220); }
};

async function testKey(pool: Pool, apiKey: string): Promise<{ status: string; ok: boolean; invalid: boolean; message: string }> {
  const model = (await readModels())[pool];
  try {
    const res = await fetchGemini(apiKey, model, { contents: [{ parts: [{ text: "Salom" }] }], generationConfig: { maxOutputTokens: 5 } }, 20_000);
    const body = res.text;
    if (res.status < 400) return { status: "ok", ok: true, invalid: false, message: `✅ Kalit ishlayapti (${model})` };
    if (res.status === 429 || /RESOURCE_EXHAUSTED/.test(body))
      return { status: "kvota tugagan (429)", ok: false, invalid: false, message: "⏳ Kalit to'g'ri, lekin kvotasi hozir tugagan (429). Keyinroq tiklanadi." };
    if (res.status === 400 || res.status === 403) {
      // 400 "model not found" — kalit emas, model xato
      if (/not found|is not supported/i.test(body))
        return { status: `model xato (${res.status})`, ok: false, invalid: false, message: `❌ Model topilmadi: ${model}. Model nomini tekshiring.` };
      return { status: "kalit noto'g'ri (400/403)", ok: false, invalid: true, message: `❌ Kalit noto'g'ri yoki ruxsati yo'q (${res.status}). Google: ${googleError(body)}` };
    }
    if (res.status === 404) return { status: "model xato (404)", ok: false, invalid: false, message: `❌ Model topilmadi: ${model}.` };
    return { status: `xato (${res.status})`, ok: false, invalid: false, message: `❌ Gemini xatosi: ${res.status}. Google: ${googleError(body)}` };
  } catch (e) {
    console.warn("[nasher-keys] sinov tarmoq xatosi:", String(e).slice(0, 200));
    return { status: "tarmoq xatosi", ok: false, invalid: false, message: "❌ Gemini bilan bog'lanib bo'lmadi (tarmoq/timeout)." };
  }
}

async function list(pool: Pool) {
  const { data: keys, error } = await sb.from("nasher_api_keys")
    .select("id, label, api_key, enabled, last_test_at, last_test_status").eq("pool", pool).order("created_at");
  if (error) throw new Error("Kalitlar o'qilmadi: " + error.message);
  const ids = (keys ?? []).map((k) => k.id);
  const today = tashkentDay();
  const { data: usage, error: uErr } = ids.length
    ? await sb.from("nasher_api_usage").select("key_id, day, ok, quota, errors").in("key_id", ids).gte("day", tashkentDay(6))
    : { data: [], error: null };
  if (uErr) console.warn("[nasher-keys] hisob o'qilmadi:", uErr.message);
  return (keys ?? []).map(({ api_key, ...k }) => {
    const rows = (usage ?? []).filter((u) => u.key_id === k.id);
    const t = rows.find((u) => u.day === today);
    const sum = (f: "ok" | "quota" | "errors") => rows.reduce((s, u) => s + (u[f] ?? 0), 0);
    return {
      ...k,
      masked: mask(api_key),
      today: { ok: t?.ok ?? 0, quota: t?.quota ?? 0, errors: t?.errors ?? 0 },
      week: { ok: sum("ok"), quota: sum("quota"), errors: sum("errors") },
    };
  });
}

const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

/** PIN tekshiruvi: secret NASHER_ADMIN_CODE bo'lsa — u bilan; bo'lmasa yopiq jadvaldagi SHA-256 xesh bilan
 *  (nasher_private_settings: RLS, faqat service_role; PIN'ning o'zi hech qayerda saqlanmaydi). */
async function pinOk(given: string): Promise<boolean | null> {
  const env = Deno.env.get("NASHER_ADMIN_CODE");
  if (env) return safeEqual(given, env);
  const { data } = await sb.from("nasher_private_settings").select("value").eq("key", "NASHER_ADMIN_PIN_SHA256").maybeSingle();
  if (!data?.value) return null;
  return safeEqual(await sha256(given), String(data.value).toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ok = await pinOk(req.headers.get("x-admin-code") ?? "");
  if (ok === null) return json({ error: "PIN sozlanmagan" }, 503);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 1500));   // PIN'ni tanlab topishni sekinlashtirish
    return json({ error: "PIN noto'g'ri" }, 401);
  }
  if (req.method !== "POST") return json({ error: "Faqat POST" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "JSON noto'g'ri" }, 400); }
  const id = typeof b.id === "string" ? b.id : "";

  try {
    switch (b.action) {
      case "list": {
        if (!isPool(b.pool)) return json({ error: "pool: voice, fast yoki router" }, 400);
        return json({ keys: await list(b.pool), limit: LIMIT[b.pool] });
      }
      case "add": {
        if (!isPool(b.pool)) return json({ error: "pool: voice, fast yoki router" }, 400);
        const apiKey = String(b.api_key ?? "").trim();
        const label = String(b.label ?? "").trim().slice(0, 60);
        if (!KEY_RE.test(apiKey)) return json({ error: "Kalit ko'rinishi noto'g'ri (AIza… yoki AQ. bilan boshlanishi kerak)" }, 400);
        const { data: existing } = await sb.from("nasher_api_keys").select("api_key").eq("pool", b.pool);
        if ((existing ?? []).some((r) => r.api_key === apiKey)) return json({ error: "Bu kalit allaqachon qo'shilgan" }, 409);
        if ((existing ?? []).length >= LIMIT[b.pool]) return json({ error: `Ko'pi bilan ${LIMIT[b.pool]} ta kalit` }, 400);
        const t = await testKey(b.pool, apiKey);
        console.log(`[nasher-keys] add ${b.pool} ${tail(apiKey)}: ${t.status}`);
        if (t.invalid) return json({ error: t.message, test: t }, 400);
        const { error } = await sb.from("nasher_api_keys").insert({
          pool: b.pool, api_key: apiKey, label, last_test_at: new Date().toISOString(), last_test_status: t.status,
        });
        if (error) return json({ error: error.code === "23505" ? "Bu kalit allaqachon qo'shilgan" : "Saqlanmadi: " + error.message }, 400);
        return json({ ok: true, test: t });
      }
      case "test": {
        const { data: k } = await sb.from("nasher_api_keys").select("pool, api_key").eq("id", id).maybeSingle();
        if (!k) return json({ error: "Kalit topilmadi" }, 404);
        const t = await testKey(k.pool as Pool, k.api_key);
        console.log(`[nasher-keys] test ${k.pool} ${tail(k.api_key)}: ${t.status}`);
        await sb.from("nasher_api_keys").update({ last_test_at: new Date().toISOString(), last_test_status: t.status }).eq("id", id);
        return json({ ok: true, test: t });
      }
      case "toggle": {
        const { error } = await sb.from("nasher_api_keys").update({ enabled: b.enabled === true }).eq("id", id);
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "delete": {
        const { error } = await sb.from("nasher_api_keys").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "models":
        return json({ models: await readModels() });
      case "available_models": {
        // birinchi yoqilgan kalit ko'ra oladigan generateContent modellari — model nomini taxmin qilmaslik uchun
        const { data: k } = await sb.from("nasher_api_keys").select("api_key").eq("enabled", true).limit(1).maybeSingle();
        if (!k) return json({ error: "Avval kalit qo'shing" }, 400);
        const res = await fetch(`${GEMINI_BASE}?pageSize=1000`, { headers: { "x-goog-api-key": k.api_key }, signal: AbortSignal.timeout(15_000) });
        const body = await res.text();
        if (!res.ok) return json({ error: `Google ${res.status}: ${googleError(body)}` }, 502);
        const names = (JSON.parse(body).models ?? [])
          .filter((m: any) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
          .map((m: any) => String(m.name).replace(/^models\//, ""))
          .filter((n: string) => n.startsWith("gemini-"));
        return json({ available: names });
      }
      case "fast_log": {
        // Oxirgi tez savollar: qancha vaqt oldi, Chuqurga o'tgan bo'lsa — sababi (RLS tufayli mijoz buni ko'ra olmaydi)
        const { data, error } = await sb.from("case_answer_jobs")
          .select("id, created_at, finished_at, status, answer_mode, lexion_fallback_reason")
          .or("answer_mode.eq.fast,lexion_fallback_reason.like.tez→chuqur*")
          .order("created_at", { ascending: false }).limit(15);
        if (error) throw new Error(error.message);
        return json({ jobs: data ?? [] });
      }
      case "set_model": {
        const pool = b.pool as keyof typeof MODEL_KEY;
        const model = String(b.model ?? "").trim();
        if (!(pool in MODEL_KEY)) return json({ error: "pool: fast, voice yoki router" }, 400);
        if (!MODEL_RE.test(model)) return json({ error: "Model nomi gemini-… ko'rinishida bo'lishi kerak" }, 400);
        const { error } = await sb.from("settings").upsert(
          { key: MODEL_KEY[pool], text_value: model, value: true, tavsif: `NaSher ${pool} modeli` }, { onConflict: "key" });
        if (error) throw new Error(error.message);
        return json({ ok: true, models: await readModels() });
      }
      default:
        return json({ error: "Noma'lum action" }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[nasher-keys] ${String(b.action)}:`, msg);
    return json({ error: "Server xatosi: " + msg }, 500);
  }
});
