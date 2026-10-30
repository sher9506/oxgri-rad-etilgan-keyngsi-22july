import { useEffect, useState } from 'react';
import { GraduationCap, Check, X, FileText, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { withAdminCode } from '@/lib/adminSettings';
import { type IlmiyIsh, NASHR_TURLARI, HOLATLAR, ilmiyInvoke } from '@/lib/ilmiyIshlar';

const FILTRLAR: { key: IlmiyIsh['holat']; label: string }[] = [
  { key: 'kutilmoqda', label: 'Tekshiruvda' },
  { key: 'tasdiqlangan', label: 'Tasdiqlangan' },
  { key: 'rad', label: 'Rad etilgan' },
];

/** Admin: ustozlar yuklagan ilmiy ishlarni Google Scholar uchun tasdiqlash. */
export default function IlmiyIshlarAdmin() {
  const { toast } = useToast();
  const [holat, setHolat] = useState<IlmiyIsh['holat']>('kutilmoqda');
  const [ishlar, setIshlar] = useState<IlmiyIsh[]>([]);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState<string | null>(null);

  const yuklash = async () => {
    setLoading(true);
    try {
      const { data } = await ilmiyInvoke<{ data: IlmiyIsh[] }>(withAdminCode({ action: 'admin_list', holat }));
      setIshlar(data || []);
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    yuklash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holat]);

  const ozgartirish = async (ish: IlmiyIsh, yangi: IlmiyIsh['holat']) => {
    let rad_sababi: string | null = null;
    if (yangi === 'rad') {
      rad_sababi = window.prompt('Rad etish sababi (ustozga ko\'rinadi):', 'Ilmiy ish talablariga mos emas');
      if (rad_sababi === null) return;
    }
    setBand(ish.id);
    try {
      await ilmiyInvoke(withAdminCode({ action: 'admin_set', id: ish.id, holat: yangi, rad_sababi }));
      toast({ title: yangi === 'tasdiqlangan' ? 'Tasdiqlandi — saytda va Scholar uchun ochildi' : HOLATLAR[yangi] });
      yuklash();
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBand(null);
    }
  };

  // Tasdiqlanmagan PDF hali ochiq sahifada yo'q — admin uni ombordagi to'g'ridan-to'g'ri havoladan ko'radi.
  const pdfUrl = (ish: IlmiyIsh) => supabase.storage.from('blog-files').getPublicUrl(ish.pdf_path).data.publicUrl;

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50"><GraduationCap className="h-5 w-5 text-blue-600" /></div>
        <div>
          <h1 className="text-lg font-black text-gray-900">Google Scholar maqolalari</h1>
          <p className="text-xs text-gray-500">Faqat haqiqiy ilmiy ishlarni tasdiqlang — aks holda Scholar butun bo'limni e'tiborsiz qoldirishi mumkin.</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {FILTRLAR.map((f) => (
          <button key={f.key} onClick={() => setHolat(f.key)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${holat === f.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : ishlar.length === 0 ? (
        <div className="py-16 text-center text-sm text-gray-400">Bu bo'limda ish yo'q.</div>
      ) : (
        <div className="space-y-3">
          {ishlar.map((ish) => (
            <div key={ish.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-black text-gray-900">{ish.sarlavha}</p>
              <p className="mt-1 text-xs text-gray-500">
                {ish.mualliflar.join(', ')} · {NASHR_TURLARI[ish.nashr_turi]}{ish.nashr_nomi ? ` · ${ish.nashr_nomi}` : ''} · {ish.nashr_sanasi} · yuklagan: {ish.ustoz?.full_name || '—'}
              </p>
              <p className="mt-2 line-clamp-4 text-xs leading-5 text-gray-700">{ish.annotatsiya}</p>
              <p className="mt-2 text-[11px] text-gray-400">
                Scholar: {ish.scholar ? 'ha' : "yo'q (faqat saytda)"} · kalit so'zlar: {ish.kalit_sozlar.join(', ') || '—'}
              </p>
              {ish.holat === 'rad' && ish.rad_sababi && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">Sabab: {ish.rad_sababi}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={pdfUrl(ish)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700"><FileText className="h-3.5 w-3.5" /> PDF'ni ko'rish</a>
                {ish.holat === 'tasdiqlangan' && (
                  <a href={`/ilmiy/${ish.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700"><ExternalLink className="h-3.5 w-3.5" /> Sahifasi</a>
                )}
                {ish.holat !== 'tasdiqlangan' && (
                  <button disabled={band === ish.id} onClick={() => ozgartirish(ish, 'tasdiqlangan')} className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Tasdiqlash</button>
                )}
                {ish.holat !== 'rad' && (
                  <button disabled={band === ish.id} onClick={() => ozgartirish(ish, 'rad')} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-60"><X className="h-3.5 w-3.5" /> Rad etish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
