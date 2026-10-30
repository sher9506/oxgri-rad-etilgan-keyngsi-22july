import { useEffect, useState } from 'react';
import { GraduationCap, Plus, Upload, Loader2, Trash2, Edit3, ExternalLink, FileText, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { type IlmiyIsh, NASHR_TURLARI, HOLATLAR, ReloginError, ilmiyInvoke, uploadIlmiyPdf, pdfPublicUrl } from '@/lib/ilmiyIshlar';

const bosh = {
  sarlavha: '', mualliflar: '', annotatsiya: '', kalit_sozlar: '', nashr_turi: 'maqola' as IlmiyIsh['nashr_turi'],
  nashr_nomi: '', nashr_sanasi: '', til: 'uz' as IlmiyIsh['til'], pdf_path: '', scholar: true, huquq_tasdiq: false,
};

const input = 'w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all';
const label = 'block text-xs font-bold text-gray-700 mb-1.5';

const holatRang: Record<IlmiyIsh['holat'], string> = {
  kutilmoqda: 'bg-amber-50 text-amber-700 border-amber-200',
  tasdiqlangan: 'bg-green-50 text-green-700 border-green-200',
  rad: 'bg-red-50 text-red-700 border-red-200',
};

/** Ustoz kabineti: ilmiy ishlarni Google Scholar uchun yuklash (admin tasdiqlaydi). */
export default function IlmiyIshlarUstoz() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const token = user?.session_token || '';
  const [ishlar, setIshlar] = useState<IlmiyIsh[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof bosh | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const xatoniKorsat = (e: unknown) => {
    if (e instanceof ReloginError) {
      toast({ title: 'Qayta kiring', description: 'Xavfsizlik yangilangani uchun bir marta chiqib, qayta kirishingiz kerak.', variant: 'destructive' });
      logout();
      return;
    }
    toast({ title: 'Xatolik', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
  };

  const yuklash = async () => {
    setLoading(true);
    try {
      const { data } = await ilmiyInvoke<{ data: IlmiyIsh[] }>({ action: 'mine', token });
      setIshlar(data || []);
    } catch (e) {
      xatoniKorsat(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    yuklash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const ochish = (ish?: IlmiyIsh) => {
    setEditId(ish?.id ?? null);
    setForm(ish ? {
      sarlavha: ish.sarlavha, mualliflar: ish.mualliflar.join('\n'), annotatsiya: ish.annotatsiya,
      kalit_sozlar: ish.kalit_sozlar.join(', '), nashr_turi: ish.nashr_turi, nashr_nomi: ish.nashr_nomi || '',
      nashr_sanasi: ish.nashr_sanasi, til: ish.til, pdf_path: ish.pdf_path, scholar: ish.scholar, huquq_tasdiq: ish.huquq_tasdiq,
    } : { ...bosh, mualliflar: user ? `${user.familiya} ${user.ism}`.trim() : '' });
  };

  const pdfTanlash = async (file: File | undefined) => {
    if (!file || !form) return;
    setUploading(true);
    try {
      const path = await uploadIlmiyPdf(token, file, form.sarlavha || file.name.replace(/\.pdf$/i, ''));
      setForm({ ...form, pdf_path: path });
      toast({ title: 'PDF yuklandi', description: file.size > 5 * 1024 * 1024 ? "Fayl 5 MB dan katta — Google Scholar kattaroq PDF'larni o'tkazib yuborishi mumkin." : file.name });
    } catch (e) {
      xatoniKorsat(e);
    } finally {
      setUploading(false);
    }
  };

  const saqlash = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await ilmiyInvoke({ action: 'save', token, id: editId, ...form, mualliflar: form.mualliflar.split('\n'), kalit_sozlar: form.kalit_sozlar });
      toast({ title: 'Yuborildi', description: 'Ish admin tekshiruviga yuborildi. Tasdiqlangach saytda va Google Scholar uchun ochiladi.' });
      setForm(null);
      yuklash();
    } catch (e) {
      xatoniKorsat(e);
    } finally {
      setSaving(false);
    }
  };

  const ochirish = async (ish: IlmiyIsh) => {
    if (!window.confirm(`«${ish.sarlavha}» o'chirilsinmi?`)) return;
    try {
      await ilmiyInvoke({ action: 'delete', token, id: ish.id });
      yuklash();
    } catch (e) {
      xatoniKorsat(e);
    }
  };

  if (!token) {
    return (
      <div className="max-w-3xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Ilmiy ish joylash uchun xavfsizlik yangilanganidan keyin bir marta <b>chiqib, qayta kiring</b>.
        <button onClick={logout} className="mt-3 block rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white">Chiqish</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900">Ilmiy ishlarim</h1>
            <p className="text-xs text-gray-500">Google Scholar'da chiqishi uchun ilmiy ishlaringizni joylang</p>
          </div>
        </div>
        {!form && (
          <button onClick={() => ochish()} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all">
            <Plus className="h-4 w-4" /> Ilmiy ish qo'shish
          </button>
        )}
      </div>

      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
        Faqat <b>ilmiy ishlar</b> joylanadi: maqola, tezis, dissertatsiya, preprint. Blog postlari bu yerga emas, «Blog yozish»ga.
        Ish admin tasdiqlagandan keyin <code>fanfaster.uz/ilmiy</code> sahifasida chiqadi; Google Scholar uni odatda 2–8 haftada topadi.
      </div>

      {form ? (
        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900">{editId ? 'Ishni tahrirlash' : 'Yangi ilmiy ish'}</h2>
            <button onClick={() => setForm(null)} className="text-gray-400 hover:text-gray-600" aria-label="Yopish"><X className="h-4 w-4" /></button>
          </div>
          <div>
            <label className={label}>Sarlavha *</label>
            <input className={input} value={form.sarlavha} onChange={(e) => setForm({ ...form, sarlavha: e.target.value })} />
          </div>
          <div>
            <label className={label}>Mualliflar * <span className="font-normal text-gray-400">(har birini yangi qatorda, «Familiya Ism»)</span></label>
            <textarea className={input} rows={3} value={form.mualliflar} onChange={(e) => setForm({ ...form, mualliflar: e.target.value })} />
          </div>
          <div>
            <label className={label}>Annotatsiya * <span className="font-normal text-gray-400">(kamida 100 belgi)</span></label>
            <textarea className={input} rows={6} value={form.annotatsiya} onChange={(e) => setForm({ ...form, annotatsiya: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Ish turi</label>
              <select className={input} value={form.nashr_turi} onChange={(e) => setForm({ ...form, nashr_turi: e.target.value as IlmiyIsh['nashr_turi'] })}>
                {Object.entries(NASHR_TURLARI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Nashr sanasi *</label>
              <input type="date" className={input} value={form.nashr_sanasi} onChange={(e) => setForm({ ...form, nashr_sanasi: e.target.value })} />
            </div>
            <div>
              <label className={label}>Jurnal / konferensiya nomi</label>
              <input className={input} value={form.nashr_nomi} onChange={(e) => setForm({ ...form, nashr_nomi: e.target.value })} />
            </div>
            <div>
              <label className={label}>Til</label>
              <select className={input} value={form.til} onChange={(e) => setForm({ ...form, til: e.target.value as IlmiyIsh['til'] })}>
                <option value="uz">O'zbekcha</option><option value="ru">Ruscha</option><option value="en">Inglizcha</option>
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Kalit so'zlar <span className="font-normal text-gray-400">(vergul bilan)</span></label>
            <input className={input} value={form.kalit_sozlar} onChange={(e) => setForm({ ...form, kalit_sozlar: e.target.value })} />
          </div>
          <div>
            <label className={label}>To'liq matn (PDF) *</label>
            <label className={`inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-600 ${uploading ? 'opacity-60' : 'cursor-pointer hover:bg-blue-100'}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Yuklanmoqda…' : form.pdf_path ? 'Boshqa PDF tanlash' : 'PDF yuklash'}
              <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={uploading} onChange={(e) => { pdfTanlash(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {form.pdf_path && <p className="mt-1 flex items-center gap-1 text-xs text-green-700"><FileText className="h-3.5 w-3.5" /> PDF biriktirildi</p>}
            <p className="mt-1 text-[11px] text-gray-400">Google Scholar uchun PDF 5 MB dan kichik va matni ko'chiriladigan (skan emas) bo'lgani yaxshi.</p>
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input type="checkbox" className="mt-0.5" checked={form.scholar} onChange={(e) => setForm({ ...form, scholar: e.target.checked })} />
            <span><b>Google Scholar'da chiqsin.</b> Agar ish jurnalda chop etilgan bo'lsa va jurnal qayta joylashni taqiqlasa, belgini olib tashlang.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700">
            <input type="checkbox" className="mt-0.5" checked={form.huquq_tasdiq} onChange={(e) => setForm({ ...form, huquq_tasdiq: e.target.checked })} />
            <span>Bu ish meniki (yoki hammualliflarim roziligi bor) va uni ochiq joylashga huquqim bor. *</span>
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setForm(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600">Bekor qilish</button>
            <button onClick={saqlash} disabled={saving || uploading} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-60">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Tekshiruvga yuborish
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : ishlar.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">Hozircha ilmiy ish yo'q.</div>
      ) : (
        <div className="space-y-3">
          {ishlar.map((ish) => (
            <div key={ish.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-900">{ish.sarlavha}</p>
                  <p className="mt-1 text-xs text-gray-500">{ish.mualliflar.join(', ')} · {NASHR_TURLARI[ish.nashr_turi]} · {ish.nashr_sanasi}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${holatRang[ish.holat]}`}>{HOLATLAR[ish.holat]}</span>
              </div>
              {ish.holat === 'rad' && ish.rad_sababi && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Sabab: {ish.rad_sababi}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {ish.holat === 'tasdiqlangan' && (
                  <>
                    <a href={`/ilmiy/${ish.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700"><ExternalLink className="h-3.5 w-3.5" /> Sahifasi</a>
                    <a href={pdfPublicUrl(ish.slug)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600"><FileText className="h-3.5 w-3.5" /> PDF</a>
                  </>
                )}
                <button onClick={() => ochish(ish)} className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600"><Edit3 className="h-3.5 w-3.5" /> Tahrirlash</button>
                <button onClick={() => ochirish(ish)} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600"><Trash2 className="h-3.5 w-3.5" /> O'chirish</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
