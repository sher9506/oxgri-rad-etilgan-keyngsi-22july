// deploy 2026-10-21 new-alphabet
// nasher-bot — NaSher AI Telegram boti (verify_jwt = false: Telegram serverlari Authorization yubormaydi).
// 1) Telegram webhook (X-Telegram-Bot-Api-Secret-Token tekshiriladi):
//    /start — salomlashuv; akkaunt Telegram ID bo'yicha avtomatik ochiladi (telefon so'ralmaydi; talabalar.telegram_id).
//    settings.NASHER_CHANNEL kanaliga a'zolik MAJBURIY: a'zo bo'lmaganga darvoza xabari + «A'zo bo'ldim» tugmasi.
//    Matnli savol — Chuqur (Lexion) rejimi, joriy suhbatda (5 soat).
//    "Yangi suhbat" tugmasi (callback) yangi suhbat boshlaydi. Javobni nasher-bot-dispatch yetkazadi.
// 2) {action:"activate"} — admin panel: webhook, menyu tugmasi, buyruqlar va bot tavsiflarini o'rnatadi.
// 3) {action:"miniapp_auth", init_data} — Mini App: initData imzosi tekshirilib, FanFaster foydalanuvchi ID'si qaytariladi.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { tg, verifyInitData } from "../_shared/nasher-telegram.ts";
import { channelInfo } from "../_shared/nasher-channel.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const MIN_LEN = 10;
const MAX_LEN = 2500;
const CHAT_TTL_MS = 5 * 60 * 60 * 1000;   // saytdagi suhbat xotirasi bilan bir xil
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/nasher-bot`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hi = (name: string) => `Assalomu alaykum${name ? ", " + esc(name) : ""}!`;

const WELCOME = (name: string, channel: string) =>
  `👋 ${hi(name)}\n\n` +
  "⚖️ <b>NaSher AI</b> — O'zbekiston qonunchiligi bo'yicha yordamchingiz.\n\n" +
  (channel ? `✅ Siz ${esc(channel)} kanalimizga a'zosiz — rahmat!\n\n` : "") +
  "✍️ Vaziyatingizni oddiy so'zlar bilan shu yerga yozing (xohlasangiz — ilovada) — kerakli qonunlarni topib, moddalar bilan tushuntirib beraman.\n" +
  "⏱ Javob 2–3 daqiqada keladi, tayyor bo'lganda o'zim yuboraman.\n" +
  "💬 Suhbat 5 soat davom etadi: keyingi savollaringizda oldingilarini eslayman.";

// Kanalga a'zo bo'lmaganlar uchun darvoza: savol qabul qilinmaydi
const GATE = (name: string, channel: string) =>
  `👋 ${hi(name)}\n\n` +
  "⚖️ <b>NaSher AI</b> — O'zbekiston qonunchiligi bo'yicha yordamchingiz.\n\n" +
  `Botdan foydalanish va yangiliklardan birinchi bo'lib xabardor bo'lish uchun ${esc(channel)} kanalimizga a'zo bo'ling.\n\n` +
  "1️⃣ «Kanalga qo'shilish» ni bosing\n" +
  "2️⃣ Qaytib, «A'zo bo'ldim» ni bosing — tekshirib, darhol savolingizni kutaman 👇";
const GATE_KEYBOARD = (channel: string) => ({ inline_keyboard: [
  [{ text: "📢 Kanalga qo'shilish", url: `https://t.me/${channel.replace(/^@/, "")}` }],
  [{ text: "✅ A'zo bo'ldim", callback_data: "check_channel" }],
] });

/** Kanal darvozasi: member false — a'zo emas; null — kanal sozlanmagan yoki tekshirib bo'lmadi (to'siq qo'yilmaydi). */
async function channelGate(userId: string, tgId: number): Promise<{ channel: string; member: boolean | null }> {
  const ch = await channelInfo(sb, userId, tgId, true);
  return { channel: ch.channel ?? "", member: ch.channel ? ch.member : null };
}
// Mini App vositalari (?tool=…): savol matniga qarab mos tugmalar
const TOOL_RULES: { id: string; text: string; re: RegExp }[] = [
  { id: "aliment", text: "👶 Aliment kalkulyatori", re: /aliment|алимент/i },
  { id: "boj", text: "🧮 Davlat boji kalkulyatori", re: /davlat boji|sud boji|boj\b|пошлин|божи/i },
  { id: "shablon", text: "📄 Ariza namunalari (Word)", re: /ariza|da'vo|daʼvo|shikoyat|namuna|shablon|ариза|даъво|шикоят/i },
  { id: "sud", text: "🏛 Sud manzillari", re: /sud(ga|ning)? (manzil|telefon|qayer)|qaysi sudga|sud manzil|суд манзил/i },
];
const matchTools = (q: string) => TOOL_RULES.filter((t) => t.re.test(q));
const toolUrl = (miniUrl: string, id: string) => miniUrl + (miniUrl.includes("?") ? "&" : "?") + "tool=" + id;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function settings(keys: string[]): Promise<Record<string, string>> {
  const { data } = await sb.from("settings").select("key, text_value").in("key", keys);
  const m: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) m[r.key] = String(r.text_value).trim();
  return m;
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

/** Telefonsiz kirish: Telegram ID bo'yicha akkaunt topiladi, bo'lmasa yangi talaba yaratiladi (telegram-login-callback kabi login_id telefon emas). */
async function findOrRegister(from: any): Promise<{ id: string; ism: string } | null> {
  const found = await findUser(from.id);
  if (found) return found;
  const { data: created, error } = await sb.from("talabalar").insert({
    ism: from.first_name || "Foydalanuvchi", familiya: from.last_name || "", guruh: "", kurs: "",
    login_id: `tg_${from.id}`, telegram_chat_id: String(from.id),
    telegram_id: from.id, telegram_username: from.username || null, telegram_ism: from.first_name || null,
  }).select("id, ism").single();
  if (error || !created) {
    console.error("[nasher-bot] talaba yaratilmadi:", error?.message);
    return null;
  }
  return { id: String(created.id), ism: created.ism ?? "" };
}

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
    "⚖️ NaSher AI — bepul, ro'yxatsiz huquqiy yordamchi.\n\n" +
    "• Vaziyatingizni oddiy so'zlar bilan yozing\n" +
    "• 3000+ qonun hujjati ichidan keraklisini topadi\n" +
    "• Har modda va Plenum bandiga aniq lex.uz havolasi\n" +
    "• Javob tayyor bo'lganda o'zi yuboradi\n\n" +
    "Yangiliklardan birinchi bo'lib xabardor bo'lish uchun @fanfasteruz kanaliga a'zolik so'raladi.\n\n" +
    "«Start» ni bosing 👇" });
  await tg(token, "setMyShortDescription", { short_description:
    "Bepul, ro'yxatsiz. O'zbekiston qonunchiligi bo'yicha savolingizga har modda va Plenum bandiga aniq lex.uz havolasi bilan javob." });
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
    } else if (cq.data === "check_channel" && chatId) {
      // «A'zo bo'ldim» — Telegram'dan qayta tekshiriladi
      const user = await findOrRegister(cq.from);
      const name = user?.ism || cq.from.first_name || "";
      const gate = user ? await channelGate(user.id, cq.from.id) : { channel: "", member: null };
      if (gate.member === false) {
        await tg(token, "answerCallbackQuery", { callback_query_id: cq.id, show_alert: true,
          text: `Hali a'zo emassiz. Avval «Kanalga qo'shilish» ni bosing, keyin «A'zo bo'ldim» ni bosing.` });
      } else {
        await tg(token, "answerCallbackQuery", { callback_query_id: cq.id, text: "✅ Tasdiqlandi" });
        await tg(token, "sendMessage", { chat_id: chatId, parse_mode: "HTML",
          text: `✅ Rahmat${name ? ", " + esc(name) : ""}! Siz ${esc(gate.channel)} kanalimizga a'zo bo'ldingiz.\n\n✍️ Endi savolingizni shu yerga yozing — yoki, xohlasangiz, ilovada davom eting 👇`,
          ...(miniUrl ? { reply_markup: { inline_keyboard: [[{ text: "📱 NaSher AI ilovasi", web_app: { url: miniUrl } }]] } } : {}) });
      }
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
  const appButton = miniUrl ? { inline_keyboard: [
    [{ text: "📱 NaSher AI ilovasi", web_app: { url: miniUrl } }],
    [{ text: "🧰 Vositalar: kalkulyator, ariza namunalari, sud manzillari", web_app: { url: toolUrl(miniUrl, "menu") } }],
  ] } : undefined;

  const text: string = (msg.text ?? "").trim();
  const user = await findOrRegister(from);
  if (!user) {
    await reply("⚠️ Akkauntni ochib bo'lmadi. Birozdan keyin qayta urinib ko'ring.");
    return;
  }
  const name = user.ism || from.first_name || "";
  // Kanal darvozasi: har xabarda jonli tekshiriladi — chiqib ketganlar ham darhol taklif oladi
  const gate = await channelGate(user.id, from.id);
  if (gate.member === false) {
    await reply(GATE(name, gate.channel), { reply_markup: GATE_KEYBOARD(gate.channel) });
    return;
  }

  if (text.startsWith("/start") || text === "/help") {
    await reply(WELCOME(name, gate.channel), appButton ? { reply_markup: appButton } : {});
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
  const progress = await reply(`⏳ <b>Savolingiz qabul qilindi${name ? ", " + esc(name) : ""}</b>\n\n▱▱▱▱▱▱▱▱▱▱  0%\n🔎 Kerakli qonun hujjatlari izlanmoqda…`);
  const progressId = progress.result?.message_id;
  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  // Modda havolalari: settings.NASHER_BOT_CITE_CHAT_IDS dagi chat ID'lar uchun ("*" — hamma uchun; yozuv yo'q — o'chiq)
  const citeIds = (await settings(["NASHER_BOT_CITE_CHAT_IDS"]))["NASHER_BOT_CITE_CHAT_IDS"] ?? "";
  const cite = citeIds === "*" || citeIds.split(",").map((s) => s.trim()).includes(String(chatId));
  // Saytdagi bilan bir xil yo'l: case-answer-submit (kvota, Lexion, suhbat xotirasi, failover)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/case-answer-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ kazus_text: text, title: text.slice(0, 60), ustoz_id: user.id, answer_mode: "lexion", chat_id: chat.chatId, ...(cite ? { cite_links: true } : {}) }),
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
  // Savol mavzusiga mos vosita (kalkulyator/shablon/manzil) — javobni kutmasdan ochib ko'rish uchun
  const tools = miniUrl ? matchTools(text) : [];
  if (tools.length) {
    await reply("Javob tayyorlanayotganda foydali bo'lishi mumkin 👇", { reply_markup: { inline_keyboard:
      tools.map((t) => [{ text: t.text, web_app: { url: toolUrl(miniUrl, t.id) } }]) } });
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

