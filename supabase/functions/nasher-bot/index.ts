// nasher-bot — NaSher AI Telegram boti (verify_jwt = false: Telegram serverlari Authorization yubormaydi).
// 1) Telegram webhook (X-Telegram-Bot-Api-Secret-Token tekshiriladi):
//    /start — salomlashuv; FanFaster'ga kirmagan bo'lsa telefon raqam so'raladi (boshqa FanFaster botlari bilan bir xil:
//    talabalar.telegram_id / telefon -> bitta akkaunt). Matnli savol — Chuqur (Lexion) rejimi, joriy suhbatda (5 soat).
//    "Yangi suhbat" tugmasi (callback) yangi suhbat boshlaydi. Javobni nasher-bot-dispatch yetkazadi.
// 2) {action:"activate"} — admin panel: webhook, menyu tugmasi, buyruqlar va bot tavsiflarini o'rnatadi.
// 3) {action:"miniapp_auth", init_data} — Mini App: initData imzosi tekshirilib, FanFaster foydalanuvchi ID'si qaytariladi.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { tg, verifyInitData } from "../_shared/nasher-telegram.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const MIN_LEN = 10;
const MAX_LEN = 2500;
const CHAT_TTL_MS = 5 * 60 * 60 * 1000;   // saytdagi suhbat xotirasi bilan bir xil
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/nasher-bot`;

const WELCOME_KNOWN = (name: string) =>
  `👋 Assalomu alaykum${name ? ", " + esc(name) : ""}!\n\n` +
  "⚖️ <b>NaSher AI</b> — O'zbekiston qonunchiligi bo'yicha yordamchingiz.\n\n" +
  "✍️ Vaziyatingizni oddiy so'zlar bilan yozing — kerakli qonunlarni topib, moddalar bilan tushuntirib beraman.\n" +
  "⏱ Javob 2–3 daqiqada keladi, tayyor bo'lganda o'zim yuboraman.\n" +
  "💬 Suhbat 5 soat davom etadi: keyingi savollaringizda oldingilarini eslayman.";

const WELCOME_NEW =
  "👋 Assalomu alaykum!\n\n" +
  "⚖️ <b>NaSher AI</b> — O'zbekiston qonunchiligi bo'yicha yordamchi.\n\n" +
  "Boshlash uchun bir marta <b>telefon raqamingizni ulashing</b> 👇\n" +
  "<i>Shu bilan FanFaster akkauntingiz ochiladi (akkauntingiz bo'lsa, o'shanga ulanadi).</i>";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function settings(keys: string[]): Promise<Record<string, string>> {
  const { data } = await sb.from("settings").select("key, text_value").in("key", keys);
  const m: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) m[r.key] = String(r.text_value).trim();
  return m;
}

function normalizePhone(phone: string): string {   // telegram-miniapp-auth dagi bilan bir xil qoida
  let d = phone.replace(/\D/g, "");
  if (!d.startsWith("998")) {
    if (d.startsWith("0")) d = "998" + d.slice(1);
    else if (d.length <= 9) d = "998" + d;
  }
  return d;
}

// ── FanFaster foydalanuvchisi (boshqa botlar bilan umumiy: talabalar.telegram_id) ──
async function findUser(tgId: number): Promise<{ id: string; ism: string } | null> {
  const { data } = await sb.from("talabalar").select("id, ism").eq("telegram_id", tgId).is("merged_into", null).maybeSingle();
  if (data) return { id: String(data.id), ism: data.ism ?? "" };
  const { data: byChat } = await sb.from("talabalar").select("id, ism, telegram_id")
    .eq("telegram_chat_id", String(tgId)).is("merged_into", null).maybeSingle();
  if (byChat) {
    if (!byChat.telegram_id) await sb.from("talabalar").update({ telegram_id: tgId }).eq("id", byChat.id);
    return { id: String(byChat.id), ism: byChat.ism ?? "" };
  }
  return null;
}

/** Telefon orqali kirish: telefon bo'yicha mavjud akkaunt topiladi, bo'lmasa yangi talaba yaratiladi. */
async function registerByPhone(from: any, rawPhone: string): Promise<{ id: string; ism: string } | null> {
  const phone = normalizePhone(rawPhone);
  await sb.from("miniapp_contacts").upsert({ telegram_id: from.id, phone }, { onConflict: "telegram_id" });
  const tgFields = { telegram_id: from.id, telegram_username: from.username || null, telegram_ism: from.first_name || null };
  const { data: byPhone } = await sb.from("talabalar").select("id, ism")
    .in("phone", [phone, "+" + phone]).is("merged_into", null).maybeSingle();
  if (byPhone) {
    await sb.from("talabalar").update(tgFields).eq("id", byPhone.id);
    return { id: String(byPhone.id), ism: byPhone.ism ?? "" };
  }
  const { data: created, error } = await sb.from("talabalar").insert({
    ism: from.first_name || "Foydalanuvchi", familiya: from.last_name || "", guruh: "", kurs: "",
    login_id: phone, phone, telegram_chat_id: String(from.id), ...tgFields,
  }).select("id, ism").single();
  if (error || !created) {
    console.error("[nasher-bot] talaba yaratilmadi:", error?.message);
    return null;
  }
  return { id: String(created.id), ism: created.ism ?? "" };
}

const CONTACT_KEYBOARD = {
  keyboard: [[{ text: "📱 Telefon raqamni ulashish", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

// ── Admin: botni faollashtirish ──
async function activate(): Promise<Response> {
  const s = await settings(["NASHER_BOT_TOKEN", "NASHER_MINIAPP_URL"]);
  const token = s["NASHER_BOT_TOKEN"];
  if (!token) return json({ ok: false, description: "Avval bot tokenini saqlang" }, 400);
  const me = await tg(token, "getMe", {});
  if (!me.ok) return json({ ok: false, description: "Token noto'g'ri: " + (me.description ?? "") }, 400);

  const secret = crypto.randomUUID().replace(/-/g, "");
  await sb.from("settings").upsert({ key: "NASHER_BOT_WEBHOOK_SECRET", text_value: secret, value: true }, { onConflict: "key" });
  const hook = await tg(token, "setWebhook", {
    url: WEBHOOK_URL, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true,
  });
  if (!hook.ok) return json({ ok: false, description: "Webhook o'rnatilmadi: " + (hook.description ?? "") }, 400);

  await tg(token, "setMyCommands", { commands: [
    { command: "start", description: "Boshlash" },
    { command: "yangi", description: "Yangi suhbat boshlash" },
  ] });
  if (s["NASHER_MINIAPP_URL"]) {
    await tg(token, "setChatMenuButton", { menu_button: { type: "web_app", text: "NaSher AI", web_app: { url: s["NASHER_MINIAPP_URL"] } } });
  }
  await tg(token, "setMyName", { name: "NaSher AI · FanFaster" });
  await tg(token, "setMyDescription", { description:
    "⚖️ NaSher AI — FanFaster platformasining huquqiy AI yordamchisi.\n\n" +
    "• Vaziyatingizni oddiy so'zlar bilan yozing\n" +
    "• 3000+ qonun hujjati ichidan keraklisini topadi\n" +
    "• Moddalar bilan tushunarli javob beradi\n" +
    "• Javob tayyor bo'lganda o'zi yuboradi\n\n" +
    "«Start» ni bosing 👇" });
  await tg(token, "setMyShortDescription", { short_description:
    "FanFaster.uz ning AI yordamchisi: O'zbekiston qonunchiligi bo'yicha savolingizga qonun moddalari bilan javob beradi." });
  return json({ ok: true, username: me.result?.username, webhook: WEBHOOK_URL });
}

// ── Mini App: initData -> FanFaster foydalanuvchisi ──
async function miniappAuth(initData: string): Promise<Response> {
  const { NASHER_BOT_TOKEN: token } = await settings(["NASHER_BOT_TOKEN"]);
  if (!token || !initData) return json({ error: "Bot sozlanmagan" }, 400);
  const tgId = await verifyInitData(initData, token);
  if (!tgId) return json({ error: "Telegram ma'lumoti tasdiqlanmadi" }, 401);
  const user = await findUser(tgId);
  if (!user) return json({ need_register: true });
  return json({ user_id: user.id });
}

// ── Joriy suhbat (5 soat) ──
async function currentChat(tgId: number, userId: string): Promise<{ chatId: string; expiredOld: boolean }> {
  const { data: st } = await sb.from("nasher_tg_state").select("chat_id, chat_started_at, user_id").eq("telegram_id", tgId).maybeSingle();
  const started = st?.chat_started_at ? new Date(st.chat_started_at).getTime() : null;
  const alive = st && st.user_id === userId && (started === null || Date.now() - started < CHAT_TTL_MS);
  if (alive) {
    if (started === null) {   // "Yangi suhbat" bosilgan, birinchi savol shu
      await sb.from("nasher_tg_state").update({ chat_started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("telegram_id", tgId);
    }
    return { chatId: st!.chat_id, expiredOld: false };
  }
  const chatId = crypto.randomUUID();
  await sb.from("nasher_tg_state").upsert({
    telegram_id: tgId, user_id: userId, chat_id: chatId,
    chat_started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
  return { chatId, expiredOld: !!st && st.user_id === userId };
}

async function startNewChat(tgId: number, userId: string) {
  await sb.from("nasher_tg_state").upsert({
    telegram_id: tgId, user_id: userId, chat_id: crypto.randomUUID(), chat_started_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

// ── Telegram yangilanishlari ──
async function onUpdate(body: any, token: string, miniUrl: string) {
  // Tugma bosildi
  if (body.callback_query) {
    const cq = body.callback_query;
    const chatId = cq.message?.chat?.id;
    if (cq.data === "new_chat" && chatId) {
      const user = await findUser(cq.from.id);
      if (user) await startNewChat(cq.from.id, user.id);
      await tg(token, "answerCallbackQuery", { callback_query_id: cq.id, text: "🆕 Yangi suhbat boshlandi" });
      await tg(token, "sendMessage", { chat_id: chatId, parse_mode: "HTML",
        text: "🆕 <b>Yangi suhbat boshlandi.</b>\nSavolingizni yozing — oldingi suhbat bu javobga ta'sir qilmaydi." });
    } else {
      await tg(token, "answerCallbackQuery", { callback_query_id: cq.id });
    }
    return;
  }

  const msg = body.message;
  if (!msg) return;
  const chatId = msg.chat?.id;
  const from = msg.from;
  if (!chatId || !from?.id || msg.chat?.type !== "private") return;   // guruhlarda ishlamaydi
  const reply = (t: string, extra: Record<string, unknown> = {}) =>
    tg(token, "sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
  const appButton = miniUrl ? { inline_keyboard: [[{ text: "📱 NaSher AI ilovasi", web_app: { url: miniUrl } }]] } : undefined;

  // Telefon ulashildi -> FanFaster'ga kirish
  if (msg.contact) {
    if (msg.contact.user_id !== from.id) {
      await reply("Iltimos, <b>o'zingizning</b> raqamingizni tugma orqali ulashing.", { reply_markup: CONTACT_KEYBOARD });
      return;
    }
    const user = await registerByPhone(from, msg.contact.phone_number);
    if (!user) {
      await reply("⚠️ Akkauntni ochib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
      return;
    }
    await reply("✅ <b>Tayyor!</b> FanFaster akkauntingiz ulandi.\n\nEndi savolingizni yozing 👇", { reply_markup: { remove_keyboard: true } });
    return;
  }

  const text: string = (msg.text ?? "").trim();
  const user = await findUser(from.id);

  if (text.startsWith("/start") || text === "/help") {
    if (user) await reply(WELCOME_KNOWN(user.ism || from.first_name || ""), appButton ? { reply_markup: appButton } : {});
    else await reply(WELCOME_NEW, { reply_markup: CONTACT_KEYBOARD });
    return;
  }
  if (!user) {
    await reply("Davom etish uchun avval telefon raqamingizni ulashing 👇", { reply_markup: CONTACT_KEYBOARD });
    return;
  }
  if (text === "/yangi") {
    await startNewChat(from.id, user.id);
    await reply("🆕 <b>Yangi suhbat boshlandi.</b>\nSavolingizni yozing.");
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

  const chat = await currentChat(from.id, user.id);
  if (chat.expiredOld) {
    await reply("⏰ <b>Oldingi suhbat yopildi</b> — har bir suhbat 5 soat saqlanadi.\nBu savol <b>yangi suhbatda</b> boshlanadi (oldingi savollaringizni bu safar eslamayman).");
  }
  const progress = await reply("⏳ <b>Savolingiz qabul qilindi</b>\n\n▱▱▱▱▱▱▱▱▱▱  0%\n🔎 Kerakli qonun hujjatlari izlanmoqda…");
  const progressId = progress.result?.message_id;
  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  // Saytdagi bilan bir xil yo'l: case-answer-submit (kvota, Lexion, suhbat xotirasi, failover)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/case-answer-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ kazus_text: text, title: text.slice(0, 60), ustoz_id: user.id, answer_mode: "lexion", chat_id: chat.chatId }),
    signal: AbortSignal.timeout(100_000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) } as unknown as Response));
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.id) {
    const err = data?.error || "Hozir javob tayyorlab bo'lmadi. Birozdan keyin qayta urinib ko'ring.";
    console.error("[nasher-bot] submit xato:", res.status, err);
    if (progressId) await tg(token, "editMessageText", { chat_id: chatId, message_id: progressId, text: `⚠️ ${err}` });
    else await reply(`⚠️ ${esc(err)}`);
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

    const s = await settings(["NASHER_BOT_TOKEN", "NASHER_BOT_WEBHOOK_SECRET", "NASHER_MINIAPP_URL"]);
    if (!s["NASHER_BOT_TOKEN"] || req.headers.get("x-telegram-bot-api-secret-token") !== s["NASHER_BOT_WEBHOOK_SECRET"]) {
      return json({ ok: false }, 403);
    }
    // Telegram 60 s ichida javob kutadi; savol yuborish uzoq bo'lishi mumkin — fonda bajariladi
    const work = onUpdate(body, s["NASHER_BOT_TOKEN"], s["NASHER_MINIAPP_URL"] ?? "")
      .catch((e) => console.error("[nasher-bot] xato:", e));
    const rt = (globalThis as Record<string, unknown>).EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    if (rt?.waitUntil) rt.waitUntil(work);
    else await work;
    return json({ ok: true });
  } catch (e) {
    console.error("[nasher-bot] xato:", e);
    return json({ ok: true });   // Telegram xatoda qayta-qayta yubormasin
  }
});
