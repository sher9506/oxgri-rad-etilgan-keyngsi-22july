import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, FileText, GraduationCap, Search, Quote, Check, Calendar, Languages, BookOpen, Send, Link2, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { setDocumentTitle, resetDocumentTitle } from '@/lib/seo';
import { formatDate } from '@/lib/blogUtils';
import { type IlmiyIsh, NASHR_TURLARI, pdfPublicUrl } from '@/lib/ilmiyIshlar';

const FIELDS = 'slug, sarlavha, mualliflar, annotatsiya, kalit_sozlar, nashr_turi, nashr_nomi, nashr_sanasi, til';
const TILLAR: Record<string, string> = { uz: "O'zbekcha", ru: 'Ruscha', en: 'Inglizcha' };
const TUR_RANG: Record<IlmiyIsh['nashr_turi'], string> = {
  maqola: 'from-blue-600 to-indigo-700',
  tezis: 'from-emerald-600 to-teal-700',
  dissertatsiya: 'from-violet-600 to-purple-700',
  preprint: 'from-amber-500 to-orange-600',
};
type Filtr = 'hammasi' | IlmiyIsh['nashr_turi'];

/** Iqtibos: «Familiya I. Sarlavha // Nashr. Yil. URL» (GOST uslubiga yaqin). */
function iqtibos(i: IlmiyIsh): string {
  const mualliflar = i.mualliflar.map((m) => {
    const [fam, ...ism] = m.split(' ');
    return ism.length ? `${fam} ${ism.map((x) => x[0] + '.').join(' ')}` : m;
  }).join(', ');
  return `${mualliflar} ${i.sarlavha}${i.nashr_nomi ? ` // ${i.nashr_nomi}` : ''}. ${i.nashr_sanasi.slice(0, 4)}. URL: https://fanfaster.uz/ilmiy/${i.slug}`;
}

/** /ilmiy (ro'yxat, ilova ichida) va /ilmiy/:slug (ish sahifasi). SEO va Scholar teglari serverda — functions/ilmiy. */
export default function IlmiyIshlarPublic({ slug }: { slug?: string }) {
  const [ishlar, setIshlar] = useState<IlmiyIsh[]>([]);
  const [loading, setLoading] = useState(true);
  const [qidiruv, setQidiruv] = useState('');
  const [filtr, setFiltr] = useState<Filtr>('hammasi');
  const [nusxa, setNusxa] = useState<'' | 'iqtibos' | 'havola'>('');

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

  const korinadigan = useMemo(() => {
    const q = qidiruv.trim().toLowerCase();
    return ishlar.filter((i) =>
      (filtr === 'hammasi' || i.nashr_turi === filtr) &&
      (!q || `${i.sarlavha} ${i.mualliflar.join(' ')} ${i.kalit_sozlar.join(' ')} ${i.annotatsiya}`.toLowerCase().includes(q)));
  }, [ishlar, qidiruv, filtr]);

  const nusxala = (tur: 'iqtibos' | 'havola', matn: string) => {
    navigator.clipboard.writeText(matn).then(() => {
      setNusxa(tur);
      setTimeout(() => setNusxa(''), 2000);
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  // ── Ish sahifasi ──
  if (slug) {
    const ish = ishlar[0];
    if (!ish) {
      return (
        <div className="max-w-3xl mx-auto py-20 text-center">
          <p className="text-sm font-bold text-gray-500 mb-4">Ish topilmadi yoki hali tasdiqlanmagan.</p>
          <Link to="/ilmiy" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">Ilmiy ishlarga qaytish</Link>
        </div>
      );
    }
    const url = `https://fanfaster.uz/ilmiy/${ish.slug}`;
    return (
      <div className="max-w-4xl mx-auto">
        <nav className="flex items-center gap-1.5 mb-6 text-xs text-gray-400">
          <Link to="/ilmiy" className="hover:text-blue-600 transition-colors font-medium">Ilmiy ishlar</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-600 font-medium truncate max-w-[240px]">{ish.sarlavha}</span>
        </nav>

        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`bg-gradient-to-br ${TUR_RANG[ish.nashr_turi]} px-6 py-8 md:px-10 md:py-10 text-white`}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1 text-[11px] font-bold">
              <GraduationCap className="h-3.5 w-3.5" /> {NASHR_TURLARI[ish.nashr_turi]}
            </span>
            <h1 className="mt-4 font-serif text-2xl md:text-[34px] font-bold leading-tight">{ish.sarlavha}</h1>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/90"><Users className="h-4 w-4" /> {ish.mualliflar.join(', ')}</p>
          </div>

          <div className="p-6 md:p-10">
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500 pb-6 mb-6 border-b border-gray-100">
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(ish.nashr_sanasi)}</span>
              <span className="flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> {TILLAR[ish.til] ?? ish.til}</span>
              {ish.nashr_nomi && <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {ish.nashr_nomi}</span>}
            </div>

            <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Annotatsiya</h2>
            <p className="whitespace-pre-line font-serif text-[16px] leading-8 text-gray-800">{ish.annotatsiya}</p>

            {ish.kalit_sozlar.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {ish.kalit_sozlar.map((k) => (
                  <span key={k} className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">{k}</span>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={pdfPublicUrl(ish.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors">
                <FileText className="h-4 w-4" /> To'liq matn (PDF)
              </a>
              <button onClick={() => nusxala('iqtibos', iqtibos(ish))} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors">
                {nusxa === 'iqtibos' ? <Check className="h-4 w-4 text-green-600" /> : <Quote className="h-4 w-4" />} {nusxa === 'iqtibos' ? 'Nusxalandi' : 'Iqtibos keltirish'}
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Iqtibos uchun</p>
              <p className="text-xs leading-5 text-gray-700 select-all">{iqtibos(ish)}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-gray-400 mr-1">Ulashish:</span>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(ish.sarlavha)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"><Send className="h-3.5 w-3.5" /> Telegram</a>
              <button onClick={() => nusxala('havola', url)} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">
                {nusxa === 'havola' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link2 className="h-3.5 w-3.5" />} {nusxa === 'havola' ? 'Nusxalandi' : 'Havola'}
              </button>
            </div>
          </div>
        </article>
      </div>
    );
  }

  // ── Ro'yxat ──
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Ilmiy ishlar</h1>
          <p className="text-sm text-gray-500 mt-0.5">FanFaster ustozlari va mualliflarining huquq sohasidagi ilmiy ishlari</p>
        </div>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={qidiruv}
          onChange={(e) => setQidiruv(e.target.value)}
          placeholder="Sarlavha, muallif yoki kalit so'z bo'yicha qidirish..."
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
        />
      </div>

      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {(['hammasi', 'maqola', 'tezis', 'dissertatsiya', 'preprint'] as Filtr[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltr(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filtr === f ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
          >
            {f === 'hammasi' ? 'Barchasi' : NASHR_TURLARI[f]}
          </button>
        ))}
      </div>

      {korinadigan.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4"><GraduationCap className="h-8 w-8 text-gray-300" /></div>
          <p className="text-sm font-bold text-gray-400 mb-1">{qidiruv || filtr !== 'hammasi' ? 'Ish topilmadi' : "Hozircha ilmiy ishlar yo'q"}</p>
          <p className="text-xs text-gray-400">{qidiruv ? "Boshqa kalit so'z bilan urinib ko'ring" : 'Ustozlar ilmiy ish joylaganda shu yerda ko\'rinadi'}</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {korinadigan.map((i) => (
            <Link key={i.slug} to={`/ilmiy/${i.slug}`} className="group flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300">
              <div className={`bg-gradient-to-br ${TUR_RANG[i.nashr_turi]} px-5 py-4 text-white`}>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 px-2.5 py-0.5 text-[10px] font-bold"><GraduationCap className="h-3 w-3" /> {NASHR_TURLARI[i.nashr_turi]}</span>
                <p className="mt-3 font-serif text-lg font-bold leading-snug line-clamp-3">{i.sarlavha}</p>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <p className="text-xs font-semibold text-gray-700">{i.mualliflar.join(', ')}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{formatDate(i.nashr_sanasi)}{i.nashr_nomi ? ` · ${i.nashr_nomi}` : ''}</p>
                <p className="mt-3 text-sm leading-6 text-gray-600 line-clamp-3">{i.annotatsiya}</p>
                {i.kalit_sozlar.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {i.kalit_sozlar.slice(0, 4).map((k) => <span key={k} className="rounded-full bg-gray-50 border border-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{k}</span>)}
                  </div>
                )}
                <span className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:gap-2 transition-all">O'qish <ChevronRight className="h-3.5 w-3.5" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
