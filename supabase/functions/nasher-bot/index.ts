// deploy 2026-10-22 kvota-regex
// deploy 2026-10-22 tez-fix
// deploy 2026-10-22 ai-studio-avval
// deploy 2026-10-22 vertex
// deploy 2026-10-22 ovoz-tez
// nasher-bot — NaSher AI Telegram boti (verify_jwt = false: Telegram serverlari Authorization yubormaydi).
// 1) Telegram webhook (X-Telegram-Bot-Api-Secret-Token tekshiriladi):
//    /start — salomlashuv; akkaunt Telegram ID bo'yicha avtomatik ochiladi (telefon so'ralmaydi; talabalar.telegram_id).
//    settings.NASHER_CHANNEL kanaliga a'zolik MAJBURIY: a'zo bo'lmaganga darvoza xabari + «A'zo bo'ldim» tugmasi.
//    Matnli yoki ovozli (≤2 daq., Gemini "voice" havzasi) savol joriy suhbatda (5 soat). NASHER_FAST_USERS uchun
//    yo'naltiruvchi tez (Gemini) yoki Chuqur (NotebookLM) rejimni tanlaydi; "deep:<job>" tugmasi Chuqurda qayta so'raydi.
//    "Yangi suhbat" tugmasi (callback) yangi suhbat boshlaydi. Javobni nasher-bot-dispatch yetkazadi.
// 2) {action:"activate"} — admin panel: webhook, menyu tugmasi, buyruqlar va bot tavsiflarini o'rnatadi.
// 3) {action:"miniapp_auth", init_data} — Mini App: initData imzosi tekshirilib, FanFaster foydalanuvchi ID'si qaytariladi.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { tg, verifyInitData } from "../_shared/nasher-telegram.ts";
import { channelInfo } from "../_shared/nasher-channel.ts";
import { geminiText, geminiWithPool, loadPool, PoolExhausted } from "../_shared/key-pool.ts";
import { ROUTER_INSTRUCTION } from "../_shared/nasher-prompts.ts";

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
// ── Ovozli xabar → matn (Gemini, "voice" kalitlar havzasi) ──
const VOICE_MAX_SEC = 120;
const VOICE_TOO_LONG = "🎤 Iltimos, 2 daqiqagacha gapiring yoki ikkiga bo'lib yuboring.";
const VOICE_BUSY = "⏳ Xizmatdan foydalanuvchilar ko'pligi sababli vaqtincha kutishingizga to'g'ri keladi. Birozdan keyin qayta yuboring yoki savolingizni yozib yuboring.";
const TRANSCRIBE_PROMPT =
  "Bu ovozli xabarni so'zma-so'z matnga aylantir. Til o'zbek (ba'zan rus so'zlari aralashadi). " +
  "O'zbek lotin yozuvida, tinish belgilari bilan yoz. Faqat aytilgan matnni qaytar — izoh, sarlavha, tarjima qo'shma. " +
  "Agar nutq eshitilmasa, faqat bo'sh qator qaytar.";

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Telegram ovozini yuklab, matnga aylantiradi. null — ovoz bo'sh/tushunarsiz. PoolExhausted — hamma kalit band. */
const VOICE_FALLBACK_MODEL = "gemini-2.5-flash";

async function transcribeVoice(token: string, fileId: string, mime: string): Promise<string | null> {
  const f = await tg(token, "getFile", { file_id: fileId });
  const path = f.result?.file_path;
  if (!f.ok || !path) throw new Error("getFile: " + (f.description ?? "fayl yo'q"));
  const audio = await fetch(`https://api.telegram.org/file/bot${token}/${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!audio.ok) throw new Error("ovoz yuklanmadi: " + audio.status);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const model = (await settings(["NASHER_VOICE_MODEL"]))["NASHER_VOICE_MODEL"] || "gemini-3-flash-preview";
  const body = {
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: toBase64(bytes) } }, { text: TRANSCRIBE_PROMPT }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 1500 },
  };
  let data;
  try {
    ({ data } = await geminiWithPool(sb, "voice", model, body, { timeoutMs: 45_000 }));
  } catch (e) {
    // asosiy model kvotasi tugasa — zaxira model (kvotasi alohida); u ham band bo'lsa PoolExhausted foydalanuvchiga "kuting"
    if (!(e instanceof PoolExhausted) || model === VOICE_FALLBACK_MODEL) throw e;
    ({ data } = await geminiWithPool(sb, "voice", VOICE_FALLBACK_MODEL, body, { timeoutMs: 45_000 }));
  }
  const text = geminiText(data).trim();
  return text.length >= 3 ? text : null;
}

// ── Yangi imkoniyatlar avval sinov ro'yxatida: settings kaliti "*" (hamma) yoki vergul bilan talaba id'lari ──
async function allowed(key: "NASHER_FAST_USERS" | "NASHER_VOICE_USERS", userId: string): Promise<boolean> {
  const users = (await settings([key]))[key] ?? "";
  return users === "*" || users.split(",").map((s) => s.trim()).includes(userId);
}
const fastAllowed = (userId: string) => allowed("NASHER_FAST_USERS", userId);

async function routeQuestion(question: string): Promise<"fast" | "deep"> {
  const keys = (await loadPool(sb, "fast")).slice(0, 3);   // yo'naltirish uchun havzaning birinchi 3 ta kaliti
  if (!keys.length) return "deep";
  const model = (await settings(["NASHER_ROUTER_MODEL"]))["NASHER_ROUTER_MODEL"] || "gemini-3.1-flash-lite";
  try {
    // jami 3 soniya: ulgurmasa — tez rejim (tezlik ustun)
    const call = geminiWithPool(sb, "fast", model, {
      systemInstruction: { parts: [{ text: ROUTER_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: question.slice(0, 2500) }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 256 },
    }, { keys, timeoutMs: 2_500 });
    const { data } = await Promise.race([call, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("3 s o'tdi")), 3_000))]);
    return /DEEP/i.test(geminiText(data)) ? "deep" : "fast";
  } catch (e) {
    // yo'naltiruvchi ishlamasa — tezlik ustun: tez rejim (u ham ishlamasa, status o'zi Chuqurga o'tkazadi)
    console.warn("[nasher-bot] yo'naltiruvchi:", String(e).slice(0, 200));
    return "fast";
  }
}

// Mini App vositalari (?tool=…)
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
    } else if (typeof cq.data === "string" && cq.data.startsWith("deep:") && chatId) {
      // Tezkor javob yetarli bo'lmadi — o'sha savol Chuqur rejimda (NotebookLM, butun qonunchilik) qayta yuboriladi
      const user = await findUser(cq.from.id);
      const { data: job } = await sb.from("case_answer_jobs").select("chat_kazus_text, teacher_id")
        .eq("id", cq.data.slice(5)).maybeSingle();
      if (!user || !job?.chat_kazus_text || String(job.teacher_id) !== user.id) {
        await tg(token, "answerCallbackQuery", { callback_query_id: cq.id, text: "Savol topilmadi, uni qayta yozib yuboring." });
      } else {
        await tg(token, "answerCallbackQuery", { callback_query_id: cq.id, text: "🔎 Chuqur tahlil boshlandi" });
        const chat = await currentChat(cq.from.id, user.id);
        await submitQuestion(token, chatId, user.id, user.ism || cq.from.first_name || "", job.chat_kazus_text, chat.chatId, "deep");
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

  let text: string = (msg.text ?? "").trim();
  // Ovoz uzunligi yuklab olinmasdan tekshiriladi — uzun ovozga darhol muloyim rad
  const voice = msg.voice ?? msg.audio ?? msg.video_note;
  if (voice && (voice.duration ?? 0) > VOICE_MAX_SEC) {
    await reply(VOICE_TOO_LONG);
    return;
  }
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

  if (voice && !(await allowed("NASHER_VOICE_USERS", user.id))) {
    await reply("Savolingizni matn bilan yozib yuboring — ovozli xabar tez orada qo'shiladi.");
    return;
  }
  if (voice) {
    const wait = await reply("🎤 Ovozli xabaringiz matnga aylantirilmoqda…");
    const waitId = wait.result?.message_id;
    const show = (t: string) => waitId
      ? tg(token, "editMessageText", { chat_id: chatId, message_id: waitId, text: t, parse_mode: "HTML" })
      : reply(t);
    try {
      const heard = await transcribeVoice(token, voice.file_id, voice.mime_type ?? (msg.video_note ? "video/mp4" : "audio/ogg"));
      if (!heard) {
        await show("🎤 Ovozni tushunib bo'lmadi. Iltimos, aniqroq gapiring yoki savolingizni yozib yuboring.");
        return;
      }
      await show(`🎤 <b>Siz dedingiz:</b>\n<i>${esc(heard)}</i>`);
      text = heard;
    } catch (e) {
      // sinov davrida (ro'yxat "*" emas) — sinovchiga xatoning qisqa sababi ham ko'rsatiladi (kalitning faqat oxirgi 4 belgisi)
      const testing = (await settings(["NASHER_VOICE_USERS"]))["NASHER_VOICE_USERS"] !== "*";
      const why = e instanceof PoolExhausted ? e.detail : String(e);
      console.error("[nasher-bot] ovoz:", why.slice(0, 300));
      const note = testing ? `\n\n<code>${esc(why.slice(0, 300))}</code>` : "";
      await show((e instanceof PoolExhausted ? VOICE_BUSY
        : "⚠️ Ovozli xabarni o'qib bo'lmadi. Savolingizni yozib yuboring yoki birozdan keyin qayta urinib ko'ring.") + note);
      return;
    }
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
    await reply("Savolingizni matn yoki 🎤 ovozli xabar (2 daqiqagacha) bilan yuboring.");
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
  // Tez rejim yoqilgan foydalanuvchilarda savol yo'naltiriladi: oddiy savol — tez, murakkab kazus — Chuqur
  const mode = (await fastAllowed(user.id)) ? await routeQuestion(text) : "deep";
  await submitQuestion(token, chatId, user.id, name, text, chat.chatId, mode);
}

/** Savolni case-answer-submit ga yuboradi va kutish xabarini ko'rsatadi (javobni nasher-bot-dispatch yetkazadi). */
async function submitQuestion(token: string, chatId: number, userId: string, name: string, text: string, chatUuid: string, mode: "fast" | "deep") {
  const reply = (t: string, extra: Record<string, unknown> = {}) =>
    tg(token, "sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
  const head = mode === "fast" ? "⚡ <b>Tezkor javob tayyorlanmoqda" : "⏳ <b>Savolingiz qabul qilindi";
  const progress = await reply(`${head}${name ? ", " + esc(name) : ""}</b>\n\n▱▱▱▱▱▱▱▱▱▱  0%\n🔎 Kerakli qonun hujjatlari izlanmoqda…`);
  const progressId = progress.result?.message_id;
  await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });

  // Modda havolalari: settings.NASHER_BOT_CITE_CHAT_IDS dagi chat ID'lar uchun ("*" — hamma uchun; yozuv yo'q — o'chiq)
  const citeIds = (await settings(["NASHER_BOT_CITE_CHAT_IDS"]))["NASHER_BOT_CITE_CHAT_IDS"] ?? "";
  const cite = citeIds === "*" || citeIds.split(",").map((s) => s.trim()).includes(String(chatId));
  // Saytdagi bilan bir xil yo'l: case-answer-submit (kvota, Lexion, suhbat xotirasi, failover). Tez rejim = answer_style "lunda".
  const res = await fetch(`${SUPABASE_URL}/functions/v1/case-answer-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({
      kazus_text: text, title: text.slice(0, 60), ustoz_id: userId, answer_mode: "lexion", chat_id: chatUuid,
      ...(mode === "fast" ? { answer_style: "lunda" } : {}), ...(cite ? { cite_links: true } : {}),
    }),
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

