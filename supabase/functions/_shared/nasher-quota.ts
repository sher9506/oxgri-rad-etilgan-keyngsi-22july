// NaSher savol limiti (5 soatlik sirpanuvchi oyna) + "oldingi savol hali bajarilmoqda" tekshiruvi.
// case-answer-submit (yakuniy himoya) va bot (ovozni matnga aylantirish/AI'dan OLDIN, kalit sarflanmasin) uchun umumiy.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { channelInfo, CHANNEL_BONUS } from "./nasher-channel.ts";

export const CHAT_LIMIT_COUNT = 8;
export const CHAT_LIMIT_WINDOW_HOURS = 5;

export interface QuotaBlock { code: "active_job" | "quota_exceeded"; error: string; next_reset_at: string | null }

/** null — savol berish mumkin; aks holda sabab. Ustozlar (talaba/tg_ emas) uchun limit yo'q. */
export async function chatQuota(sb: SupabaseClient, userId: string): Promise<QuotaBlock | null> {
  const { data: talabaRow } = await sb.from("talabalar").select("id").eq("id", userId).maybeSingle();
  if (!talabaRow && !userId.startsWith("tg_")) return null;

  // Faol so'rov: oxirgi 20 daqiqada queued/running chat job
  const activeWindowStart = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const { count: activeCount } = await sb.from("case_answer_jobs")
    .select("id", { count: "exact", head: true })
    .eq("job_kind", "chat").eq("teacher_id", userId).in("status", ["queued", "running"])
    .is("deleted_at", null)   // o'chirilgan chatdagi job hech kim kuzatmaydi: talabani bloklamasin
    .gte("created_at", activeWindowStart);
  if ((activeCount ?? 0) > 0) {
    return { code: "active_job", error: "Oldingi so'rovingiz hali bajarilmoqda. Iltimos javobni kuting.", next_reset_at: null };
  }

  const windowMs = CHAT_LIMIT_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs).toISOString();
  const { count: windowCount } = await sb.from("case_answer_jobs")
    .select("id", { count: "exact", head: true })
    .eq("job_kind", "chat").eq("teacher_id", userId).in("status", ["queued", "running", "done"])
    .gte("created_at", windowStart);
  // Kanal a'zolariga +CHANNEL_BONUS (Telegram faqat asosiy limit tugaganda so'raladi)
  const chatLimit = (windowCount ?? 0) >= CHAT_LIMIT_COUNT && (await channelInfo(sb, userId)).member
    ? CHAT_LIMIT_COUNT + CHANNEL_BONUS : CHAT_LIMIT_COUNT;
  if ((windowCount ?? 0) < chatLimit) return null;

  // Tiklanish vaqti: oynadagi eng eski job + 5 soat
  const { data: oldestJob } = await sb.from("case_answer_jobs")
    .select("created_at")
    .eq("job_kind", "chat").eq("teacher_id", userId).in("status", ["queued", "running", "done"])
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
