import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, resetDocumentTitle } from '@/lib/seo';
import { type IlmiyIsh, NASHR_TURLARI, pdfPublicUrl } from '@/lib/ilmiyIshlar';

const FIELDS = 'slug, sarlavha, mualliflar, annotatsiya, kalit_sozlar, nashr_turi, nashr_nomi, nashr_sanasi, til';

/** /ilmiy va /ilmiy/:slug — tasdiqlangan ilmiy ishlar (SEO va Scholar teglari serverda, functions/ilmiy). */
export default function IlmiyIshlarPublic({ slug }: { slug?: string }) {
  const [ishlar, setIshlar] = useState<IlmiyIsh[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from('ilmiy_ishlar').select(FIELDS).order('nashr_sanasi', { ascending: false });
    if (slug) q = q.eq('slug', slug).limit(1);
    q.then(({ data, error }) => {
      if (error) console.error('Ilmiy ishlar yuklash xatosi:', error.message);
      setIshlar((data as IlmiyIsh[]) || []);
      setLoading(false);
      setDocumentTitle(slug && data?.[0] ? `${data[0].sarlavha} — FanFaster` : 'Ilmiy ishlar — FanFaster');
    });
    return () => resetDocumentTitle();
  }, [slug]);

  const ish = slug ? ishlar[0] : undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to={slug ? '/ilmiy' : '/'} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600">
        <ArrowLeft className="h-4 w-4" /> {slug ? 'Ilmiy ishlar' : 'FanFaster'}
      </Link>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Yuklanmoqda…</div>
      ) : slug ? (
        !ish ? (
          <div className="py-16 text-center text-sm text-gray-400">Ish topilmadi yoki hali tasdiqlanmagan.</div>
        ) : (
          <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold text-blue-600">{NASHR_TURLARI[ish.nashr_turi]}{ish.nashr_nomi ? ` · ${ish.nashr_nomi}` : ''} · {ish.nashr_sanasi}</p>
            <h1 className="mt-2 font-serif text-2xl font-bold leading-snug text-gray-900">{ish.sarlavha}</h1>
            <p className="mt-3 text-sm font-semibold text-gray-700">{ish.mualliflar.join(', ')}</p>
            <h2 className="mt-6 text-sm font-black uppercase tracking-wide text-gray-500">Annotatsiya</h2>
            <p className="mt-2 whitespace-pre-line font-serif text-[15px] leading-7 text-gray-800">{ish.annotatsiya}</p>
            {ish.kalit_sozlar.length > 0 && <p className="mt-4 text-sm text-gray-600"><b>Kalit so'zlar:</b> {ish.kalit_sozlar.join(', ')}</p>}
            <a href={pdfPublicUrl(ish.slug)} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
              <FileText className="h-4 w-4" /> To'liq matn (PDF)
            </a>
          </article>
        )
      ) : (
        <>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50"><GraduationCap className="h-5 w-5 text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Ilmiy ishlar</h1>
              <p className="text-sm text-gray-500">FanFaster ustozlari va mualliflarining huquq sohasidagi ilmiy ishlari</p>
            </div>
          </div>
          {ishlar.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">Hozircha ilmiy ishlar yo'q.</div>
          ) : (
            <div className="space-y-3">
              {ishlar.map((i) => (
                <Link key={i.slug} to={`/ilmiy/${i.slug}`} className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-200">
                  <p className="font-serif text-base font-bold text-gray-900">{i.sarlavha}</p>
                  <p className="mt-1 text-xs text-gray-500">{i.mualliflar.join(', ')} · {NASHR_TURLARI[i.nashr_turi]} · {i.nashr_sanasi.slice(0, 4)}</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
