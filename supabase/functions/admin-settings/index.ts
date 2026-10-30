// admin-settings — admin panel `settings` jadvalini shu funksiya orqali o'qiydi/yozadi (verify_jwt = false).
// Brauzer anon kaliti bilan settings'dagi maxfiy qiymatlarni (bot tokenlari, API kalitlar) ko'rmaydi;
// admin kodi serverda tekshiriladi: settings.ADMIN_PANEL_CODE_HASH = sha256(kod) hex.
// So'rov: { code, query: { op, columns?, payload?, onConflict?, filters: [['eq'|'in', 'key', v]], single? } }
// yoki { code, verify: true } — faqat kodni tekshirish.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const COLUMNS = /^[\w\s,*]{1,200}$/;
const FIELDS = new Set(['key', 'text_value', 'value', 'tavsif']);

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function isAdmin(code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || code.length < 8 || code.length > 200) return false;
  const { data } = await supabaseAdmin.from('settings').select('text_value').eq('key', 'ADMIN_PANEL_CODE_HASH').maybeSingle();
  const stored = (data?.text_value || '').trim().toLowerCase();
  if (!stored) return false;
  return timingSafeEqual(await sha256Hex(code), stored);
}

// Faqat settings ustunlari yoziladi, kalit bo'sh bo'lmasin.
function cleanRow(r: unknown): Record<string, unknown> | null {
  if (!r || typeof r !== 'object') return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) if (FIELDS.has(k)) out[k] = v;
  return typeof out.key === 'string' && out.key.trim() ? out : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { code, verify, query } = await req.json();
    if (!(await isAdmin(code))) {
      // shortcut: urinishlar soni cheklanmagan — kod tasodifiy va uzun bo'lgani uchun; kerak bo'lsa IP bo'yicha limit qo'shish.
      await new Promise((r) => setTimeout(r, 800));
      return json({ data: null, error: { message: "Admin kodi noto'g'ri" } }, 401);
    }
    if (verify) return json({ ok: true });

    const q = query ?? {};
    const filters: [string, string, unknown][] = Array.isArray(q.filters) ? q.filters : [];
    if (filters.some(([op, col]) => !['eq', 'in'].includes(op) || col !== 'key')) {
      return json({ data: null, error: { message: "Filtr faqat key bo'yicha" } }, 400);
    }
    const columns = typeof q.columns === 'string' && COLUMNS.test(q.columns) ? q.columns : '*';

    // deno-lint-ignore no-explicit-any
    let b: any;
    if (q.op === 'select') {
      b = supabaseAdmin.from('settings').select(columns);
    } else if (q.op === 'upsert') {
      const rows = (Array.isArray(q.payload) ? q.payload : [q.payload]).map(cleanRow);
      if (!rows.length || rows.some((r: unknown) => !r)) return json({ data: null, error: { message: "Noto'g'ri qator" } }, 400);
      b = supabaseAdmin.from('settings').upsert(rows, { onConflict: 'key' });
      if (q.columns) b = b.select(columns);
    } else if (q.op === 'update' || q.op === 'delete') {
      if (!filters.length) return json({ data: null, error: { message: 'Filtrsiz o\'zgartirish taqiqlangan' } }, 400);
      const patch = cleanRow({ key: 'x', ...(q.payload ?? {}) });
      if (patch) delete patch.key;
      b = q.op === 'update' ? supabaseAdmin.from('settings').update(patch) : supabaseAdmin.from('settings').delete();
      if (q.columns) b = b.select(columns);
    } else {
      return json({ data: null, error: { message: "Noma'lum amal" } }, 400);
    }

    for (const [op, col, val] of filters) b = op === 'eq' ? b.eq(col, val) : b.in(col, Array.isArray(val) ? val : [val]);
    if (q.single === 'maybe') b = b.maybeSingle();
    else if (q.single === 'one') b = b.single();

    const { data, error } = await b;
    if (error) console.error('[admin-settings]', q.op, error.message);
    return json({ data: data ?? null, error: error ? { message: error.message } : null });
  } catch (e) {
    console.error('[admin-settings] xato:', e instanceof Error ? e.message : String(e));
    return json({ data: null, error: { message: 'Server xatosi' } }, 500);
  }
});
