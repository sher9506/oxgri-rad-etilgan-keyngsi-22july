// ilmiy-ishlar — ustozlarning ilmiy ishlari (Google Scholar uchun) (verify_jwt = false).
// Ustoz (sessiya tokeni bilan):  'mine', 'upload_url', 'save', 'delete'
// Admin (admin kodi bilan):      'admin_list', 'admin_set'
// Hamma uchun o'qish — REST orqali, RLS faqat holat='tasdiqlangan' ni ko'rsatadi.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { isAdminCode, ustozIdFromToken } from '../_shared/auth.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BUCKET = 'blog-files';
const MAX_PDF = 20 * 1024 * 1024; // Scholar ~5 MB tavsiya qiladi; kattaroqlari ham qabul, lekin ogohlantiramiz
const TURLAR = ['maqola', 'tezis', 'dissertatsiya', 'preprint'];
const FIELDS = 'id, slug, sarlavha, mualliflar, annotatsiya, kalit_sozlar, nashr_turi, nashr_nomi, nashr_sanasi, til, pdf_path, scholar, huquq_tasdiq, holat, rad_sababi, created_at, updated_at, tasdiqlangan_at, ustoz_id';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
// Kutilgan xatolar 200 + { error } — brauzer data.error'dan o'qiydi.
const xato = (message: string) => json({ error: message });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown, maxItems: number, maxLen: number) =>
  (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,;\n]/) : [])
    .map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[ʻʼ'`‘’]/g, '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'ish';
}

// deno-lint-ignore no-explicit-any
function validate(b: any): { row?: Record<string, unknown>; error?: string } {
  const sarlavha = str(b.sarlavha, 300);
  const mualliflar = list(b.mualliflar, 20, 120);
  const annotatsiya = str(b.annotatsiya, 5000);
  const nashr_sanasi = str(b.nashr_sanasi, 10);
  const pdf_path = str(b.pdf_path, 300);
  if (sarlavha.length < 10) return { error: 'Sarlavha kamida 10 belgi bo\'lsin' };
  if (!mualliflar.length) return { error: 'Kamida bitta muallif kiriting' };
  if (annotatsiya.length < 100) return { error: 'Annotatsiya kamida 100 belgi bo\'lsin (Google Scholar talabi)' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nashr_sanasi)) return { error: 'Nashr sanasini kiriting' };
  if (!/^ilmiy\/[0-9a-f-]{36}\/[a-z0-9-]+\.pdf$/.test(pdf_path)) return { error: 'PDF faylni yuklang' };
  if (b.huquq_tasdiq !== true) return { error: 'Ishni joylashga huquqingiz borligini tasdiqlang' };
  return {
    row: {
      sarlavha, mualliflar, annotatsiya, nashr_sanasi, pdf_path,
      kalit_sozlar: list(b.kalit_sozlar, 15, 60),
      nashr_turi: TURLAR.includes(b.nashr_turi) ? b.nashr_turi : 'maqola',
      nashr_nomi: str(b.nashr_nomi, 300) || null,
      til: ['uz', 'ru', 'en'].includes(b.til) ? b.til : 'uz',
      scholar: b.scholar !== false,
      huquq_tasdiq: true,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return xato('POST kerak');

  try {
    const b = await req.json().catch(() => ({}));
    const action = b?.action;

    // ── Admin ──
    if (action === 'admin_list' || action === 'admin_set') {
      if (!(await isAdminCode(supabaseAdmin, b.code))) {
        await new Promise((r) => setTimeout(r, 800));
        return xato("Admin kodi noto'g'ri");
      }
      if (action === 'admin_list') {
        let q = supabaseAdmin.from('ilmiy_ishlar').select(FIELDS + ', ustoz(full_name)').order('created_at', { ascending: false }).limit(200);
        if (['kutilmoqda', 'tasdiqlangan', 'rad'].includes(b.holat)) q = q.eq('holat', b.holat);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        return json({ data });
      }
      if (!['tasdiqlangan', 'rad', 'kutilmoqda'].includes(b.holat)) return xato("Noto'g'ri holat");
      const { error } = await supabaseAdmin.from('ilmiy_ishlar').update({
        holat: b.holat,
        rad_sababi: b.holat === 'rad' ? str(b.rad_sababi, 500) || null : null,
        tasdiqlangan_at: b.holat === 'tasdiqlangan' ? new Date().toISOString() : null,
      }).eq('id', str(b.id, 40));
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    // ── Ustoz ──
    const ustozId = await ustozIdFromToken(supabaseAdmin, b.token);
    if (!ustozId) return json({ error: 'Sessiya tugagan — chiqib, qayta kiring', relogin: true });

    if (action === 'mine') {
      const { data, error } = await supabaseAdmin.from('ilmiy_ishlar').select(FIELDS).eq('ustoz_id', ustozId).order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return json({ data });
    }

    if (action === 'upload_url') {
      const size = Number(b.size);
      if (!(size > 0 && size <= MAX_PDF)) return xato('PDF 20 MB dan oshmasin');
      const path = `ilmiy/${ustozId}/${slugify(str(b.nom, 120))}-${Date.now().toString(36)}.pdf`;
      // shortcut: hajm brauzer aytganiga qarab tekshiriladi, signed URL o'zi cheklamaydi; kerak bo'lsa bucket file_size_limit qo'yish.
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw new Error(error.message);
      return json({ path, token: data.token });
    }

    if (action === 'save') {
      const v = validate(b);
      if (v.error) return xato(v.error);
      if (!String(v.row!.pdf_path).startsWith(`ilmiy/${ustozId}/`)) return xato('PDF faylni yuklang');
      if (b.id) {
        // Tahrirlangan ish qayta tekshiruvga tushadi.
        const { data, error } = await supabaseAdmin.from('ilmiy_ishlar')
          .update({ ...v.row, holat: 'kutilmoqda', rad_sababi: null, tasdiqlangan_at: null, updated_at: new Date().toISOString() })
          .eq('id', str(b.id, 40)).eq('ustoz_id', ustozId).select('id, slug').maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) return xato('Ish topilmadi');
        return json({ ok: true, ...data });
      }
      const base = slugify(String(v.row!.sarlavha));
      const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;
      const { data, error } = await supabaseAdmin.from('ilmiy_ishlar').insert({ ...v.row, ustoz_id: ustozId, slug }).select('id, slug').single();
      if (error) throw new Error(error.message);
      return json({ ok: true, ...data });
    }

    if (action === 'delete') {
      const { data } = await supabaseAdmin.from('ilmiy_ishlar').delete().eq('id', str(b.id, 40)).eq('ustoz_id', ustozId).select('pdf_path').maybeSingle();
      if (data?.pdf_path) await supabaseAdmin.storage.from(BUCKET).remove([data.pdf_path]);
      return json({ ok: true });
    }

    return xato("Noma'lum amal");
  } catch (e) {
    console.error('[ilmiy-ishlar] xato:', e instanceof Error ? e.message : String(e));
    return json({ error: 'Server xatosi' }, 500);
  }
});
