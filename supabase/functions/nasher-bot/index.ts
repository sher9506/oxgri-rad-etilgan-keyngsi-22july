// nasher-bot — NaSher AI Telegram boti (verify_jwt = false: Telegram serverlari Authorization yubormaydi).
// 1) Telegram webhook: X-Telegram-Bot-Api-Secret-Token tekshiriladi. /start — salomlashuv + Mini App tugmasi.
//    Matnli savol — Chuqur (Lexion) rejimida case-answer-submit orqali job yaratiladi; javobni nasher-bot-dispatch yetkazadi.
// 2) {action:"activate"} — admin panel: settings dagi token bilan webhook, menyu tugmasi va buyruqlarni o'rnatadi.
// 3) {action:"miniapp_auth", init_data} — Mini App: initData imzosi tekshirilib, foydalanuvchi kaliti qaytariladi.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { tg, tgUserKey, verifyInitData } from "../_shared/nasher-telegram.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const MIN_LEN = 10;
const MAX_LEN = 2500;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/nasher-bot`;

const WELCOME =
  "👋 <b>NaSher AI</b> — O'zbekiston qonunchiligi bo'yicha yordamchi.\n\n" +
  "Huquqiy savolingizni oddiy so'zlar bilan yozing. Men kerakli qonun hujjatlarini topib, moddalar bilan tushuntirib beraman.\n\n" +
  "⏱ Javob odatda 2–3 daqiqada keladi — kutib o'tirishingiz shart emas, tayyor bo'lganda o'zim yuboraman.\n\n" +
  "📱 Qisqa yoki tezkor javob, suhbatlar tarixi kerak bo'lsa — pastdagi <b>NaSher AI</b> tugmasini bosing.";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function settings(keys: string[]): Promise<Record<string, string>> {
  const { data } = await sb.from("settings").select("key, text_value").in("key", keys);
  const m: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) m[r.key] = String(r.text_value).trim();
  return m;
}

async function saveSetting(key: string, value: string) {
  await sb.from("settings").upsert({ key, text_value: value, value: true }, { onConflict: "key" });
}

function miniAppButton(url: string) {
  return { inline_keyboard: [[{ text: "📱 NaSher AI", web_app: { url } }]] };
}

// ── Admin: botni faollashtirish ──
async function activate(): Promise<Response> {
  const s = await settings(["NASHER_BOT_TOKEN", "NASHER_MINIAPP_URL"]);
  const token = s["NASHER_BOT_TOKEN"];
  if (!token) return json({ ok: false, description: "Avval bot tokenini saqlang" }, 400);
  const me = await tg(token, "getMe", {});
  if (!me.ok) return json({ ok: false, description: "Token noto'g'ri: " + (me.description ?? "") }, 400);

  const secret = crypto.randomUUID().replace(/-/g, "");
  await saveSetting("NASHER_BOT_WEBHOOK_SECRET", secret);
  const hook = await tg(token, "setWebhook", {
    url: WEBHOOK_URL, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true,
  });
  if (!hook.ok) return json({ ok: false, description: "Webhook o'rnatilmadi: " + (hook.description ?? "") }, 400);

  await tg(token, "setMyCommands", { commands: [{ command: "start", description: "Boshlash" }] });
  if (s["NASHER_MINIAPP_URL"]) {
    await tg(token, "setChatMenuButton", {
      menu_button: { type: "web_app", text: "NaSher AI", web_app: { url: s["NASHER_MINIAPP_URL"] } },
    });
  }
  await tg(token, "setMyDescription", {
    description: "O'zbekiston qonunchiligi bo'yicha savolingizga qonun hujjatlari asosida javob beradi.",
  });
  return json({ ok: true, username: me.result?.username, webhook: WEBHOOK_URL });
}

// ── Mini App: initData -> foydalanuvchi kaliti ──
async function miniappAuth(initData: string): Promise<Response> {
  const { NASHER_BOT_TOKEN: token } = await settings(["NASHER_BOT_TOKEN"]);
  if (!token || !initData) return json({ error: "Bot sozlanmagan" }, 400);
  const tgId = await verifyInitData(initData, token);
  if (!tgId) return json({ error: "Telegram ma'lumoti tasdiqlanmadi" }, 401);
  return json({ user_id: await tgUserKey(SERVICE_KEY, tgId) });
}

// ── Telegram xabari ──
async function onMessage(msg: any, token: string, miniUrl: string) {
  const chatId = msg.chat?.id;
  const fromId = msg.from?.id;
  if (!chatId || !fromId || msg.chat?.type !== "private") return;   // guruhlarda ishlamaydi
  const text: string = (msg.text ?? "").trim();
  const reply = (t: string, extra: Record<string, unknown> = {}) =>
    tg(token, "sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

  if (text.startsWith("/start") || text === "/help") {
    await reply(WELCOME, miniUrl ? { reply_markup: miniAppButton(miniUrl) } : {});
    return;
  }
  if (!text) {
    await reply("Hozircha faqat matnli savol qabul qilinadi. Savolingizni yozib yuboring.");
    return;
  }
  if (text.startsWith("/")) {
    await reply("Savolingizni oddiy matn bilan yozing.");
    return;
  }
  if (text.length < MIN_LEN) {
    await reply(`Savolni batafsilroq yozing (kamida ${MIN_LEN} belgi). Masalan: <i>«Ish beruvchi meni ogohlantirmasdan bo'shatdi, nima qilsam bo'ladi?»</i>`);
    return;
  }
  if (text.length > MAX_LEN) {
    await reply(`Savol juda uzun (${text.length} belgi). Iltimos, ${MAX_LEN} belgigacha qisqartiring.`);
    return;
  }

  const userKey = await tgUserKey(SERVICE_KEY, fromId);
  const progress = await reply("⏳ Savolingiz qabul qilindi.\n🔎 Kerakli qonun hujjatlari izlanmoqda…");
  const progressId = progress.result?.message_id;
  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  // Job saytdagi bilan bir xil yo'l: case-answer-submit (kvota, Lexion, failover hammasi o'sha yerda)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/case-answer-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({
      kazus_text: text,
      title: text.slice(0, 60),
      ustoz_id: userKey,
      answer_mode: "lexion",
    }),
    signal: AbortSignal.timeout(100_000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) } as unknown as Response));
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.id) {
    const err = data?.error || "Hozir javob tayyorlab bo'lmadi. Birozdan keyin qayta urinib ko'ring.";
    console.error("[nasher-bot] submit xato:", res.status, err);
    if (progressId) await tg(token, "editMessageText", { chat_id: chatId, message_id: progressId, text: `⚠️ ${err}` });
    else await reply(`⚠️ ${err}`);
    return;
  }

  await sb.from("case_answer_jobs")
    .update({ tg_chat_id: chatId, tg_progress_msg_id: progressId ?? null, tg_phase: "searching" })
    .eq("id", data.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: true });
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.action === "activate") return await activate();
    if (body?.action === "miniapp_auth") return await miniappAuth(String(body.init_data ?? ""));

    // Telegram webhook
    const s = await settings(["NASHER_BOT_TOKEN", "NASHER_BOT_WEBHOOK_SECRET", "NASHER_MINIAPP_URL"]);
    if (!s["NASHER_BOT_TOKEN"] || req.headers.get("x-telegram-bot-api-secret-token") !== s["NASHER_BOT_WEBHOOK_SECRET"]) {
      return json({ ok: false }, 403);
    }
    if (body?.message) {
      // Telegram 60 s ichida javob kutadi; submit uzoq bo'lishi mumkin — fonda bajariladi
      const work = onMessage(body.message, s["NASHER_BOT_TOKEN"], s["NASHER_MINIAPP_URL"] ?? "")
        .catch((e) => console.error("[nasher-bot] xabar xatosi:", e));
      const rt = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
      if (rt?.waitUntil) rt.waitUntil(work);
      else await work;
    }
    return json({ ok: true });
  } catch (e) {
    console.error("[nasher-bot] xato:", e);
    return json({ ok: true });   // Telegram xatoda qayta-qayta yubormasin
  }
});


