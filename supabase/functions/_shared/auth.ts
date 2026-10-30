// Edge funksiyalar uchun umumiy autentifikatsiya yordamchilari:
// admin kodi (settings.ADMIN_PANEL_CODE_HASH) va ustoz sessiya tokeni (ustoz_sessiyalar).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Admin kodi to'g'rimi: sha256(kod) === settings.ADMIN_PANEL_CODE_HASH. */
export async function isAdminCode(sb: SupabaseClient, code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || code.length < 8 || code.length > 200) return false;
  const { data } = await sb.from('settings').select('text_value').eq('key', 'ADMIN_PANEL_CODE_HASH').maybeSingle();
  const stored = (data?.text_value || '').trim().toLowerCase();
  if (!stored) return false;
  return timingSafeEqual(await sha256Hex(code), stored);
}

/** Ustoz sessiya tokeni → tasdiqlangan ustoz id'si yoki null (muddati o'tgan / soxta / faol emas). */
export async function ustozIdFromToken(sb: SupabaseClient, token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const hash = await sha256Hex(token);
  const { data: s } = await sb.from('ustoz_sessiyalar').select('ustoz_id, expires_at').eq('token_hash', hash).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const { data: u } = await sb.from('ustoz').select('status').eq('id', s.ustoz_id).maybeSingle();
  return u?.status === 'approved' ? s.ustoz_id : null;
}
