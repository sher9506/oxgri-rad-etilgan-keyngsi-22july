// ustoz-auth — ustoz login'i va parol tiklash serverda (verify_jwt = false).
// Brauzer endi parol xeshini ko'rmaydi: parol shu yerda tekshiriladi, to'g'ri bo'lsa
// sessiya tokeni beriladi (bazada faqat sha256(token) saqlanadi).
// Eski xesh sha256(parol + 'juris_salt_2024') qabul qilinadi va birinchi kirishda bcrypt'ga almashtiriladi.
//
// action: 'login'        { login, parol }                → { token, ustoz }
//         'verify'       { token }                       → { ustoz }
//         'logout'       { token }                       → { ok }
//         'reset_send'   { login }                       → { ok }   (kod Telegram'ga)
//         'reset_check'  { login, kod }                  → { ok }
//         'reset_set'    { login, kod, yangi_parol }     → { ok }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { corsHeaders } from '../_shared/cors.ts';
import { sha256Hex, timingSafeEqual } from '../_shared/auth.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const SESSIYA_KUN = 30;
const LOGIN_LIMIT = 10;      // 15 daqiqada bitta login uchun noto'g'ri urinishlar
const KOD_URINISH = 5;       // bitta tiklash kodi uchun urinishlar
const USTOZ_FIELDS = 'id, full_name, username, phone, status, blog_huquqi, ustoz_huquqi, telegram_chat_id';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
// Kutilgan xatolar 200 + { error } bilan qaytadi — brauzer supabase.functions.invoke'da data.error'dan o'qiydi.
const xato = (message: string, _status?: number) => json({ error: message });


function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' }[c]!));
}


/** Telefon/username: «+998...», «998...» variantlari — eski LoginModal bilan bir xil qidiruv. */
function loginVariants(login: string): string[] {
  const raw = String(login ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  const base = /^\d{9,15}$/.test(digits) ? digits : raw;
  return [...new Set([base, '+' + base, raw])].filter((v) => v && v.length <= 64);
}

// deno-lint-ignore no-explicit-any
async function findUstoz(login: string, fields: string): Promise<any | null> {
  const v = loginVariants(login);
  if (!v.length) return null;
  const list = v.map((x) => `"${x.replace(/"/g, '')}"`).join(',');
  const { data, error } = await supabaseAdmin.from('ustoz').select(fields).or(`phone.in.(${list}),username.in.(${list})`).limit(2);
  if (error) throw new Error(error.message);
  return data && data.length === 1 ? data[0] : null; // bir nechta mos kelsa — xavfsizlik uchun hech biri
}

async function tooManyAttempts(kalit: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabaseAdmin.from('auth_urinishlar').select('id', { count: 'exact', head: true }).eq('kalit', kalit).gte('created_at', since);
  return (count ?? 0) >= LOGIN_LIMIT;
}

async function checkPassword(parol: string, stored: string | null): Promise<{ ok: boolean; upgrade: boolean }> {
  if (!stored) return { ok: false, upgrade: false };
  if (stored.startsWith('$2')) return { ok: await bcrypt.compare(parol, stored), upgrade: false };
  const legacy = await sha256Hex(parol + 'juris_salt_2024');
  const ok = timingSafeEqual(legacy, stored.trim().toLowerCase());
  return { ok, upgrade: ok };
}

function strongEnough(p: string): boolean {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128 && /[A-Z]/.test(p) && /[0-9]/.test(p);
}

// deno-lint-ignore no-explicit-any
const publicUstoz = (u: any) => ({
  id: u.id, full_name: u.full_name, username: u.username, phone: u.phone,
  blog_huquqi: u.blog_huquqi ?? false, ustoz_huquqi: u.ustoz_huquqi ?? false,
});

async function sendTelegram(chatId: number | string, text: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('settings').select('text_value').eq('key', 'TELEGRAM_TOKEN').maybeSingle();
  const token = data?.text_value?.trim();
  if (!token) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return (await r.json().catch(() => ({})))?.ok === true;
}

// deno-lint-ignore no-explicit-any
async function activeResetCode(ustozId: string): Promise<any | null> {
  const { data } = await supabaseAdmin.from('ustoz_parol_tiklash').select('id, kod_hash, expires_at, urinishlar')
    .eq('ustoz_id', ustozId).eq('ishlatilgan', false).gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

/** Kodni tekshiradi; noto'g'ri bo'lsa urinish sanaladi. */
async function verifyResetCode(login: string, kod: string) {
  const ustoz = await findUstoz(login, 'id');
  if (!ustoz || !/^\d{6}$/.test(String(kod ?? ''))) return null;
  const row = await activeResetCode(ustoz.id);
  if (!row || row.urinishlar >= KOD_URINISH) return null;
  if (!timingSafeEqual(await sha256Hex(String(kod)), row.kod_hash)) {
    await supabaseAdmin.from('ustoz_parol_tiklash').update({ urinishlar: row.urinishlar + 1 }).eq('id', row.id);
    return null;
  }
  return { ustozId: ustoz.id as string, rowId: row.id as string };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return xato('POST kerak', 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'login') {
      const { login, parol } = body;
      if (typeof login !== 'string' || typeof parol !== 'string' || !parol || parol.length > 128) return xato("Telefon raqam va parolni kiriting");
      const kalit = 'ustoz:' + loginVariants(login)[0];
      if (await tooManyAttempts(kalit)) return xato("Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.", 429);

      const ustoz = await findUstoz(login, USTOZ_FIELDS + ', parol_hash');
      const check = await checkPassword(parol, ustoz?.parol_hash ?? null);
      if (!ustoz || !check.ok) {
        await supabaseAdmin.from('auth_urinishlar').insert({ kalit });
        return xato("Telefon raqam yoki parol noto'g'ri", 401);
      }
      if (ustoz.status !== 'approved') {
        return xato(ustoz.status === 'pending' ? 'Hisobingiz hali admin tomonidan tasdiqlanmagan.' : 'Hisobingiz rad etilgan.', 403);
      }
      if (check.upgrade) {
        await supabaseAdmin.from('ustoz').update({ parol_hash: await bcrypt.hash(parol, 10) }).eq('id', ustoz.id);
      }
      const token = randomToken();
      const { error } = await supabaseAdmin.from('ustoz_sessiyalar').insert({
        ustoz_id: ustoz.id,
        token_hash: await sha256Hex(token),
        expires_at: new Date(Date.now() + SESSIYA_KUN * 86_400_000).toISOString(),
      });
      if (error) throw new Error(error.message);
      await supabaseAdmin.from('auth_urinishlar').delete().eq('kalit', kalit);
      return json({ token, ustoz: publicUstoz(ustoz) });
    }

    if (action === 'verify' || action === 'logout') {
      if (typeof body.token !== 'string' || body.token.length < 20) return xato('Token kerak', 401);
      const hash = await sha256Hex(body.token);
      if (action === 'logout') {
        await supabaseAdmin.from('ustoz_sessiyalar').delete().eq('token_hash', hash);
        return json({ ok: true });
      }
      const { data: s } = await supabaseAdmin.from('ustoz_sessiyalar').select('ustoz_id, expires_at').eq('token_hash', hash).maybeSingle();
      if (!s || new Date(s.expires_at) < new Date()) return xato('Sessiya tugagan, qayta kiring', 401);
      const { data: u } = await supabaseAdmin.from('ustoz').select(USTOZ_FIELDS).eq('id', s.ustoz_id).maybeSingle();
      if (!u || u.status !== 'approved') return xato('Hisob faol emas', 403);
      await supabaseAdmin.from('ustoz_sessiyalar').update({ last_seen: new Date().toISOString() }).eq('token_hash', hash);
      return json({ ustoz: publicUstoz(u) });
    }

    if (action === 'reset_send') {
      const kalit = 'reset:' + loginVariants(body.login)[0];
      if (await tooManyAttempts(kalit)) return xato("Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.", 429);
      await supabaseAdmin.from('auth_urinishlar').insert({ kalit });
      const ustoz = await findUstoz(body.login, 'id, telegram_chat_id');
      if (!ustoz) return xato('Bu telefon raqam bilan ustoz topilmadi', 404);
      if (!ustoz.telegram_chat_id) return xato('Telegram ulanmagan', 400);
      const kod = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
      await supabaseAdmin.from('ustoz_parol_tiklash').update({ ishlatilgan: true }).eq('ustoz_id', ustoz.id).eq('ishlatilgan', false);
      await supabaseAdmin.from('ustoz_parol_tiklash').insert({
        ustoz_id: ustoz.id,
        kod_hash: await sha256Hex(kod),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
      const sent = await sendTelegram(ustoz.telegram_chat_id,
        `🔐 <b>Parolni tiklash kodi (Ustoz)</b>\n\nKodingiz: <code>${kod}</code>\n\n⚠️ 10 daqiqa amal qiladi. Kodni hech kimga bermang.`);
      if (!sent) return xato('Bot sozlanmagan yoki xabar yuborilmadi', 502);
      return json({ ok: true });
    }

    if (action === 'reset_check') {
      return (await verifyResetCode(body.login, body.kod)) ? json({ ok: true }) : xato("Kod noto'g'ri yoki muddati o'tgan", 400);
    }

    if (action === 'reset_set') {
      if (!strongEnough(body.yangi_parol)) return xato('Parol kamida 8 belgi, katta harf va raqamdan iborat bo\'lsin');
      const ok = await verifyResetCode(body.login, body.kod);
      if (!ok) return xato("Kod noto'g'ri yoki muddati o'tgan", 400);
      await supabaseAdmin.from('ustoz').update({ parol_hash: await bcrypt.hash(body.yangi_parol, 10) }).eq('id', ok.ustozId);
      await supabaseAdmin.from('ustoz_parol_tiklash').update({ ishlatilgan: true }).eq('id', ok.rowId);
      await supabaseAdmin.from('ustoz_sessiyalar').delete().eq('ustoz_id', ok.ustozId); // eski sessiyalar bekor
      return json({ ok: true });
    }

    return xato("Noma'lum amal");
  } catch (e) {
    console.error('[ustoz-auth] xato:', e instanceof Error ? e.message : String(e));
    return json({ error: 'Server xatosi' }, 500);
  }
});
