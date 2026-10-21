// deploy 2026-10-19 lunda-lexion
// nasher-bot-dispatch — pg_cron har daqiqada chaqiradi (x-cron-secret, verify_jwt = false).
// Botdan kelgan savollarda brauzer yo'q, Lexion bosqichlarini case-answer-status polling'i harakatga keltiradi:
// shu funksiya ~50 s davomida har 8 s da kutilayotgan bot ishlarini so'raydi, progress xabarini yangilaydi
// va javob tayyor bo'lganda Telegram'ga yuboradi.

import { createClient } from "npm:@supabase/supabase-js@2";
import { chatAppUrl, lawLinks, prepareAnswer, progressText, splitMessage, tg, toTelegramHtml, htmlToPlain } from "../_shared/nasher-telegram.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const RUN_MS = 50_000;
const TICK_MS = 8_000;   // har soniyada emas: Telegram ~30 so'rov/s chegarasi, ko'p foydalanuvchida bot bloklanadi
const MAX_AGE_MIN = 35;


const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

let lexNames: Record<string, string> | null = null;
async function names(miniUrl: string): Promise<Record<string, string>> {
  if (lexNames) return lexNames;
  try {
    const origin = new URL(miniUrl || "https://fanfaster.uz").origin;
    lexNames = await (await fetch(`${origin}/lex-names.json`, { signal: AbortSignal.timeout(10_000) })).json();
  } catch {
    lexNames = {};   // nomlar bo'lmasa "Qonun hujjati №ID" ko'rinadi
  }
  return lexNames!;
}

interface BotJob {
  id: string;
  teacher_id: string;
  chat_id: string | null;
  created_at: string;
  tg_chat_id: number;
  tg_progress_msg_id: number | null;
  tg_phase: string | null;
}

async function claimDelivery(id: string): Promise<boolean> {
  // ikki parallel ishga tushirish bitta javobni ikki marta yubormasin
  const { data } = await sb.from("case_answer_jobs")
    .update({ tg_delivered_at: new Date().toISOString() })
    .eq("id", id).is("tg_delivered_at", null).select("id");
  return !!data && data.length > 0;
}

async function handle(job: BotJob, token: string, miniUrl: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/case-answer-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ id: job.id, ustoz_id: job.teacher_id }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await res.json().catch(() => null);
  if (!data) return;
  const chat = job.tg_chat_id;

  if (data.status === "done" || data.status === "error") {
    if (!(await claimDelivery(job.id))) return;
    if (job.tg_progress_msg_id) await tg(token, "deleteMessage", { chat_id: chat, message_id: job.tg_progress_msg_id });

    if (data.status === "error") {
      await tg(token, "sendMessage", { chat_id: chat, text: `⚠️ ${data.error || "Javob tayyorlab bo'lmadi."}\n\nSavolni qayta yuborib ko'ring.` });
      return;
    }
    const parts = splitMessage(toTelegramHtml(prepareAnswer(data.answer || "")));
    const urls: string[] = Array.isArray(data.lexion_urls) ? data.lexion_urls : [];
    const laws = lawLinks(urls, urls.length ? await names(miniUrl) : {});
    if (laws) parts.push(laws);
    // Mini App aynan shu suhbatni ochadi; "Yangi suhbat" — keyingi savol yangi suhbatda
    const markup = { inline_keyboard: [
      ...(miniUrl ? [[{ text: "📱 To'liq ko'rish", web_app: { url: chatAppUrl(miniUrl, job.chat_id) } }]] : []),
      [{ text: "🆕 Yangi suhbat", callback_data: "new_chat" }],
    ] };
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      const r = await tg(token, "sendMessage", {
        chat_id: chat, text: parts[i], parse_mode: "HTML", disable_web_page_preview: true,
        ...(last && markup ? { reply_markup: markup } : {}),
      });
      if (!r.ok) {   // HTML xatosi bo'lsa — oddiy matn bilan qayta
        await tg(token, "sendMessage", { chat_id: chat, text: htmlToPlain(parts[i]), ...(last && markup ? { reply_markup: markup } : {}) });
      }
    }
    return;
  }

  const urls = Array.isArray(data.lexion_urls) ? data.lexion_urls : [];
  const phase = urls.length > 0 ? "reading" : "searching";
  if (phase !== job.tg_phase) {
    await sb.from("case_answer_jobs").update({ tg_phase: phase }).eq("id", job.id);
    job.tg_phase = phase;
  }
  // har tick'da yangilanadi: vaqt o'zgargani uchun matn har safar boshqacha (Telegram "not modified" demaydi)
  if (job.tg_progress_msg_id) {
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(job.created_at).getTime()) / 1000));
    await tg(token, "editMessageText", {
      chat_id: chat, message_id: job.tg_progress_msg_id, parse_mode: "HTML",
      text: progressText(elapsed, phase, urls.length),
    });
  }
  await tg(token, "sendChatAction", { chat_id: chat, action: "typing" });
}

Deno.serve(async (req) => {
  const { data: rows } = await sb.from("settings").select("key, text_value")
    .in("key", ["CRON_SECRET", "NASHER_BOT_TOKEN", "NASHER_MINIAPP_URL"]);
  const s: Record<string, string> = {};
  for (const r of rows ?? []) if (r.text_value) s[r.key] = String(r.text_value).trim();
  if (!s["CRON_SECRET"] || req.headers.get("x-cron-secret") !== s["CRON_SECRET"]) return json({ error: "forbidden" }, 403);
  const token = s["NASHER_BOT_TOKEN"];
  if (!token) return json({ ok: true, skipped: "token yo'q" });

  const until = Date.now() + RUN_MS;
  let handled = 0;
  while (Date.now() < until) {
    const since = new Date(Date.now() - MAX_AGE_MIN * 60_000).toISOString();
    const { data: jobs } = await sb.from("case_answer_jobs")
      .select("id, teacher_id, chat_id, created_at, tg_chat_id, tg_progress_msg_id, tg_phase")
      .not("tg_chat_id", "is", null).is("tg_delivered_at", null).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(20);
    if (!jobs || jobs.length === 0) break;   // ish yo'q — keyingi daqiqagacha kutamiz
    await Promise.all((jobs as BotJob[]).map((j) =>
      handle(j, token, s["NASHER_MINIAPP_URL"] ?? "").catch((e) => console.error("[nasher-bot-dispatch]", j.id, e))));
    handled += jobs.length;
    if (Date.now() + TICK_MS < until) await new Promise((r) => setTimeout(r, TICK_MS));
    else break;
  }
  return json({ ok: true, handled });
});


