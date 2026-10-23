// Ustoz takliflar sahifasidan (fanfaster.uz/ustoz-takliflar.html) kelgan javobni loyiha egasiga Telegram'da yuboradi.
// Faqat qat'iy shakldagi qisqa ma'lumot qabul qilinadi; xabar doim bitta egaga ketadi (token sahifada yo'q).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const OWNER_CHAT_ID = 1106307310;   // loyiha egasi (Sherzodbek)
const TANLOV: Record<string, string> = { ha: "✅ Roziman", yoq: "❌ Yo'q", oylab: "🤔 O'ylab ko'rish kerak" };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const clip = (v: unknown, n: number) => esc(String(v ?? "").trim().slice(0, n));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Faqat POST" }, 405);
  const raw = await req.text();
  if (raw.length > 8000) return json({ error: "Juda katta" }, 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return json({ error: "JSON noto'g'ri" }, 400); }
  const items = Array.isArray(b?.javoblar) ? b.javoblar.slice(0, 20) : [];
  if (!items.length) return json({ error: "Javob yo'q" }, 400);

  const lines = items.map((it: any) => {
    const t = TANLOV[String(it?.tanlov)] ?? "— belgilanmadi";
    const izoh = clip(it?.izoh, 300);
    return `${clip(it?.n, 3)}. <b>${clip(it?.nomi, 80)}</b> — ${t}${izoh ? `\n   💬 ${izoh}` : ""}`;
  });
  const umumiy = clip(b?.umumiy, 600);
  const text = `📋 <b>Ustoz javobi: NaSher AI takliflari</b>\n👤 ${clip(b?.ism, 60) || "Ustoz"}\n\n${lines.join("\n")}` +
    (umumiy ? `\n\n📝 <b>Umumiy fikr:</b> ${umumiy}` : "");

  const { data } = await sb.from("settings").select("text_value").eq("key", "NASHER_BOT_TOKEN").maybeSingle();
  const token = data?.text_value;
  if (!token) return json({ error: "Yuborib bo'lmadi" }, 503);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text: text.slice(0, 4000), parse_mode: "HTML" }),
  });
  if (!r.ok) {
    console.error("[ustoz-javob] telegram", r.status, (await r.text()).slice(0, 200));
    return json({ error: "Yuborib bo'lmadi" }, 502);
  }
  return json({ ok: true });
});
