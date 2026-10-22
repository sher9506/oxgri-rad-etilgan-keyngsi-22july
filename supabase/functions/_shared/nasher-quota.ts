// NaSher savol limiti (5 soatlik sirpanuvchi oyna) + "oldingi savol hali bajarilmoqda" tekshiruvi.
// case-answer-submit (yakuniy himoya) va bot (ovozni matnga aylantirish/AI'dan OLDIN, kalit sarflanmasin) uchun umumiy.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { channelInfo, CHANNEL_BONUS } from "./nasher-channel.ts";

export const CHAT_LIMIT_COUNT = 8;
export const CHAT_LIMIT_WINDOW_HOURS = 5;

export interface QuotaBlock { code: "active_job" | "quota_exceeded" | "unknown_user"; error: string; next_reset_at: string | null }

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * null — savol berish mumkin; aks holda sabab. Ustozlar uchun limit yo'q; talabalar va tg_ — limitli;
 * bazada yo'q ID — rad (o'ylab topilgan ID bilan Gemini kalitlarini sarflab bo'lmasin).
 * skipWindow — «Chuqur tahlil» qayta so'rovi: 5 soatlik limitga qo'shilmaydi, faqat faol so'rov tekshiriladi.
 */
export async function chatQuota(sb: SupabaseClient, userId: string, opts: { skipWindow?: boolean } = {}): Promise<QuotaBlock | null> {
  const isTg = userId.startsWith("tg_");
  const { data: talabaRow } = !isTg && isUuid(userId) ? await sb.from("talabalar").select("id").eq("id", userId).maybeSingle() : { data: null };
  if (!talabaRow && !isTg) {
    const { data: ustozRow } = isUuid(userId) ? await sb.from("ustoz").select("id").eq("id", userId).maybeSingle() : { data: null };
    if (ustozRow) return null;
    return { code: "unknown_user", error: "Foydalanuvchi topilmadi. Iltimos, qayta kiring.", next_reset_at: null };
  }

  // Faol so'rov: oxirgi 20 daqiqada queued/running chat job
  const activeWindowStart = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { count: activeCount } = await sb.from("case_answer_jobs")
    .select("id", { count: "exact", head: true })
    .eq("job_kind", "chat").eq("teacher_id", userId).in("status", ["queued", "running"])
    .is("deleted_at", null)   // o'chirilgan chatdagi job hech kim kuzatmaydi: talabani bloklamasin
    .gte("created_at", activeWindowStart)
    // tez javob 1 daqiqadan oshmaydi: 3 daqiqadan eski "running" tez job — osilib qolgan, foydalanuvchini bloklamasin
    .or(`answer_mode.is.null,answer_mode.neq.fast,created_at.gte.${new Date(Date.now() - 3 * 60 * 1000).toISOString()}`);
  if ((activeCount ?? 0) > 0) {
    return { code: "active_job", error: "Oldingi so'rovingiz hali bajarilmoqda. Iltimos javobni kuting.", next_reset_at: null };
  }
  if (opts.skipWindow) return null;

  const windowMs = CHAT_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const { count: windowCount } = await sb.from("case_answer_jobs")
    .select("id", { count: "exact", head: true })
    .eq("job_kind", "chat").eq("teacher_id", userId).in("status", ["queued", "running", "done"])
    .is("deep_of", null)   // «Chuqur tahlil» qayta so'rovi limitga qo'shilmaydi
    .gte("created_at", windowStart);
  // Kanal a'zolariga +CHANNEL_BONUS (Telegram faqat asosiy limit tugaganda so'raladi)
  const chatLimit = (windowCount ?? 0) >= CHAT_LIMIT_COUNT && (await channelInfo(sb, userId)).member
    ? CHAT_LIMIT_COUNT + CHANNEL_BONUS : CHAT_LIMIT_COUNT;
  if ((windowCount ?? 0) < chatLimit) return null;

  // Tiklanish vaqti: oynadagi eng eski job + 5 soat
  const { data: oldestJob } = await sb.from("case_answer_jobs")
    .select("created_at")
    .eq("job_kind", "chat").eq("teacher_id", userId).in("status", ["queued", "running", "done"])
    .is("deep_of", null)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  return {
    code: "quota_exceeded",
    error: `Savol limiti tugadi. ${CHAT_LIMIT_WINDOW_HOURS} soatdan keyin yana yozishingiz mumkin.`,
    next_reset_at: oldestJob ? new Date(new Date(oldestJob.created_at).getTime() + windowMs).toISOString() : null,
  };
}

/** Bot uchun: "Savol limiti tugadi. Soat 06:57 da (1 soat 23 daqiqadan keyin) yana yozishingiz mumkin." */
export function quotaText(q: QuotaBlock): string {
  if (q.code !== "quota_exceeded" || !q.next_reset_at) return q.error;
  const at = new Date(q.next_reset_at);
  const mins = Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60000));
  const hm = new Date(at.getTime() + 5 * 3600_000).toISOString().slice(11, 16);   // Toshkent vaqti (UTC+5)
  const left = mins >= 60 ? `${Math.floor(mins / 60)} soat${mins % 60 ? ` ${mins % 60} daqiqa` : ""}` : `${mins} daqiqa`;
  return `⏳ Savol limiti tugadi. Soat ${hm} da (${left}dan keyin) yana yozishingiz mumkin.`;
}

/**
 * «Chuqur tahlil» qayta so'rovi to'g'rimi: o'sha foydalanuvchining tayyor TEZ javobi va undan hali Chuqur so'ralmagan.
 * "used" — allaqachon so'ralgan (tugma ikki marta bosilgan). Yakuniy himoya — bazadagi unikal indeks.
 */
export async function checkDeepOf(sb: SupabaseClient, userId: string, deepOf: string): Promise<"ok" | "used" | "invalid"> {
  if (!isUuid(deepOf)) return "invalid";
  const { data: src } = await sb.from("case_answer_jobs").select("teacher_id, answer_mode, status").eq("id", deepOf).maybeSingle();
  if (!src || String(src.teacher_id) !== userId || src.answer_mode !== "fast" || src.status !== "done") return "invalid";
  const { count } = await sb.from("case_answer_jobs").select("id", { count: "exact", head: true }).eq("deep_of", deepOf);
  return (count ?? 0) > 0 ? "used" : "ok";
}
