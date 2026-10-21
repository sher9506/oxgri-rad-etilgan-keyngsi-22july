// Kanal bonusi: settings.NASHER_CHANNEL ("@fanfasteruz") a'zolariga 5 soatlik savol limitiga +CHANNEL_BONUS.
// settings.NASHER_CHANNEL_USERS: "*" — hamma uchun, yoki vergul bilan talaba id'lari (sinov); yozuv yo'q — o'chiq.
// A'zolik Telegram getChatMember bilan tekshiriladi (bot kanalda admin bo'lishi shart). Tasdiqlangan a'zolik
// talabalar.nasher_channel_ok_at da 1 kun keshlanadi; a'zo bo'lmaganlar qayta tekshiriladi (qo'shilgan zahoti bonus ishlasin).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CHANNEL_BONUS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** channel null — funksiya o'chiq (yoki tekshirib bo'lmadi); member null — foydalanuvchi Telegram bilan bog'lanmagan. */
export interface ChannelInfo { channel: string | null; member: boolean | null }
const OFF: ChannelInfo = { channel: null, member: null };

export async function channelInfo(sb: SupabaseClient, userId: string, tgId?: string | number | null): Promise<ChannelInfo> {
  const { data } = await sb.from("settings").select("key, text_value")
    .in("key", ["NASHER_CHANNEL", "NASHER_CHANNEL_USERS", "NASHER_BOT_TOKEN"]);
  const s: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) s[r.key] = String(r.text_value).trim();
  const channel = s["NASHER_CHANNEL"], token = s["NASHER_BOT_TOKEN"], users = s["NASHER_CHANNEL_USERS"] ?? "";
  if (!channel || !token) return OFF;
  if (users !== "*" && !users.split(",").map((x) => x.trim()).includes(String(userId))) return OFF;

  const { data: row } = await sb.from("talabalar").select("telegram_id, telegram_chat_id, nasher_channel_ok_at")
    .eq("id", userId).maybeSingle();
  if (row?.nasher_channel_ok_at && Date.now() - new Date(row.nasher_channel_ok_at).getTime() < DAY_MS) {
    return { channel, member: true };
  }
  // sayt logini (Telegram login-bot) telegram_chat_id ni yozadi — shaxsiy chatda u foydalanuvchi ID'si bilan bir xil
  const tg = tgId ?? row?.telegram_id ?? row?.telegram_chat_id ?? (String(userId).startsWith("tg_") ? String(userId).slice(3) : null);
  if (!tg) return { channel, member: null };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel, user_id: Number(tg) }), signal: AbortSignal.timeout(5000),
    });
    const j = await res.json();
    if (!j.ok) {   // bot kanalda admin emas va h.k. — taklif/bonus ko'rsatilmaydi, limit avvalgidek
      console.warn("[nasher-channel] getChatMember:", j.description);
      return OFF;
    }
    const member = ["member", "administrator", "creator"].includes(j.result?.status);
    if (member && row) await sb.from("talabalar").update({ nasher_channel_ok_at: new Date().toISOString() }).eq("id", userId);
    return { channel, member };
  } catch (e) {
    console.warn("[nasher-channel] tekshirib bo'lmadi:", String(e));
    return OFF;
  }
}
