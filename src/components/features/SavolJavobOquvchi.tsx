import { useState, useEffect } from 'react';
import {
  ChevronRight, Layers, BookOpen, CheckCircle2, XCircle,
  Link2, RefreshCw, Trophy, Eye, EyeOff, ChevronLeft, Share2, Check
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { isDemoAvailable, markDemoUsed } from '@/lib/demo';
import { postRouteChange } from '@/lib/deepLink';

interface Bolim {
  id: string; nomi: string; faol: boolean; ustoz_ismi: string;
  tartib: number; _boblar?: Bob[]; _savollar_soni?: number;
}
interface Bob { id: string; bolim_id: string; nomi: string; tartib: number; _savollar?: Savol[]; }
interface Savol { id: string; bob_id: string; bolim_id: string; savol: string; javob: string; link?: string; tartib: number; }

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } }
};

export default function SavolJavobOquvchi() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useLang();

  if (!isAuthenticated) {
    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="max-w-md mx-auto mt-10 px-4">
        <div className="bg-white border-2 border-blue-100 rounded-3xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-5 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Layers className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">{t('sj.title')}</h2>
          {isDemoAvailable('savoljavob') ? (
            <>
              <p className="text-sm text-slate-400 mb-2">Bitta savol-javobni bepul ko'rishingiz mumkin</p>
              <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-xl inline-block mb-5">🎁 Demo: 1 ta bepul urinish</p>
            </>
          ) : (
            <p className="text-sm text-slate-400 mb-6">Savol-javob bo'limiga kirish uchun tizimga kiring</p>
          )}
          <div className="space-y-2">
            {isDemoAvailable('savoljavob') && (
              <button
                onClick={() => {
                  markDemoUsed('savoljavob');
                  window.dispatchEvent(new CustomEvent('demo-sj-start'));
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-emerald-600/25 active:scale-95"
              >
                Demo ko'rish
              </button>
            )}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-95"
            >
              Tizimga kirish
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [bolimlar, setBolimlar] = useState<Bolim[]>([]);
  const [sahifa, setSahifa] = useState<'bolimlar' | 'boblar' | 'savollar'>('bolimlar');
  const [tanlanganBolim, setTanlanganBolim] = useState<Bolim | null>(null);
  const [tanlanganBob, setTanlanganBob] = useState<Bob | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Demo: tizimga kirilmagan holda demo boshlash signalini eshitish
  useEffect(() => {
    const handler = () => { yuklash(); };
    window.addEventListener('demo-sj-start', handler);
    return () => window.removeEventListener('demo-sj-start', handler);
  }, []);

  // Deep-link: tashqaridan bolim/bob ochish
  useEffect(() => {
    if (bolimlar.length === 0) return;
    const handler = (e: Event) => {
      const { bolimId, bobId } = (e as CustomEvent).detail || {};
      if (!bolimId) return;
      const bolim = bolimlar.find(b => b.id === bolimId);
      if (bolim) {
        setTanlanganBolim(bolim);
        if (bobId) {
          const bob = bolim._boblar?.find(bb => bb.id === bobId);
          if (bob) {
            bobOch(bob, bolim);
          } else {
            setSahifa('boblar');
          }
        } else {
          setSahifa('boblar');
        }
      }
    };
    window.addEventListener('deeplink-sj', handler);
    return () => window.removeEventListener('deeplink-sj', handler);
  }, [bolimlar]);

  // Havola ulashish — bo'lim
  const handleShareBolim = (e: React.MouseEvent, bolim: Bolim) => {
    e.stopPropagation();
    const url = window.location.origin + window.location.pathname + '?tab=savol-javob/' + bolim.id;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(bolim.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: '✅ Havola nusxalandi!' });
    });
  };

  // Havola ulashish — bob
  const handleShareBob = (e: React.MouseEvent, bolim: Bolim, bob: Bob) => {
    e.stopPropagation();
    const url = window.location.origin + window.location.pathname + '?tab=savol-javob/' + bolim.id + '/' + bob.id;
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(bob.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: '✅ Havola nusxalandi!' });
    });
  };

  const [savollar, setSavollar] = useState<Savol[]>([]);
  const [joriyIndex, setJoriyIndex] = useState(0);
  const [natijalar, setNatijalar] = useState<{ savol_id: string; holat: 'topdi' | 'bilmadi' }[]>([]);
  const [tugatildi, setTugatildi] = useState(false);

  const [ochiqRejim, setOchiqRejim] = useState(false);
  const [javobKorsat, setJavobKorsat] = useState(false);

  useEffect(() => { yuklash(); }, []);

  const yuklash = async () => {
    setYuklanmoqda(true);
    try {
      const { data: bData } = await supabase.from('sj_bolimlar').select('*').eq('faol', true).order('tartib');
      if (!bData) return;
      const enriched = await Promise.all(bData.map(async (b: any) => {
        const { data: bobData } = await supabase.from('sj_boblar').select('*').eq('bolim_id', b.id).order('tartib');
        const boblar = await Promise.all((bobData || []).map(async (bob: any) => {
          const { data: sData } = await supabase.from('sj_savollar').select('id').eq('bob_id', bob.id);
          return { ...bob, _savollar: sData || [] };
        }));
        return { ...b, _boblar: boblar, _savollar_soni: boblar.reduce((s, bb) => s + bb._savollar.length, 0) };
      }));
      setBolimlar(enriched);
    } finally { setYuklanmoqda(false); }
  };

  const bobOch = async (bob: Bob, bolim: Bolim) => {
    if (!isAuthenticated && !isDemoAvailable('savoljavob')) {
      window.dispatchEvent(new CustomEvent('open-login-modal'));
      return;
    }
    // Deep-link: bob ochilganda URL yangilash
    postRouteChange('savol-javob/' + bolim.id + '/' + bob.id);
    setYuklanmoqda(true);
    try {
      const { data } = await supabase.from('sj_savollar').select('*').eq('bob_id', bob.id).order('tartib');
      if (!data?.length) { toast({ title: t('common.error'), variant: 'destructive' }); return; }
      const savollarData = !isAuthenticated ? data.slice(0, 1) : data;
      setSavollar(savollarData);
      setJoriyIndex(0);
      setJavobKorsat(false);
      setOchiqRejim(false);
      setNatijalar([]);
      setTugatildi(false);
      setTanlanganBolim(bolim);
      setTanlanganBob(bob);
      setSahifa('savollar');
    } finally { setYuklanmoqda(false); }
  };

  const jumpToQuestion = (index: number) => {
    setJoriyIndex(index);
    setJavobKorsat(false);
  };

  const holatBelgila = (holat: 'topdi' | 'bilmadi') => {
    const s = savollar[joriyIndex];
    const yangiNatijalar = [...natijalar.filter(n => n.savol_id !== s.id), { savol_id: s.id, holat }];
    setNatijalar(yangiNatijalar);
    setJavobKorsat(false);
    if (joriyIndex < savollar.length - 1) {
      setJoriyIndex(i => i + 1);
    } else {
      setTugatildi(true);
      natijalarniSaqla(yangiNatijalar);
    }
  };

  const natijalarniSaqla = async (finalResults: any[]) => {
    if (!user || !tanlanganBolim || !tanlanganBob) return;
    const oquvchi_ismi = `${user.ism} ${user.familiya}`;
    await supabase.from('sj_natijalar').upsert({
      bolim_id: tanlanganBolim.id, bob_id: tanlanganBob.id,
      oquvchi_ismi, natija: finalResults
    }, { onConflict: 'bolim_id,bob_id,oquvchi_ismi' });
  };

  // ─── BOLIMLAR ───────────────────────────────────────────────────────────────
  if (sahifa === 'bolimlar') return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="max-w-4xl mx-auto space-y-4 px-2">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-100"><Layers className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{t('sj.title')}</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{t('sj.library')}</p>
          </div>
        </div>
        <button onClick={yuklash} className="p-2 hover:bg-slate-50 rounded-full transition-all">
          <RefreshCw className={cn("h-4 w-4 text-slate-400", yuklanmoqda && "animate-spin")} />
        </button>
      </div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {bolimlar.map(b => (
          <Card key={b.id}
            onClick={() => { setTanlanganBolim(b); setSahifa('boblar'); postRouteChange('savol-javob/' + b.id); }}
            className="group border-slate-200 hover:border-blue-500 cursor-pointer transition-all shadow-none hover:shadow-md rounded-xl overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-start gap-2 mb-1.5">
                <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <h3 className="font-bold text-xs text-slate-800 leading-tight line-clamp-2">{b.nomi}</h3>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400">{b._boblar?.length} bob • {b._savollar_soni} savol</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleShareBolim(e, b)}
                    className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                    title="Havolani nusxalash"
                  >
                    {copiedId === b.id
                      ? <Check className="h-3 w-3 text-green-500" />
                      : <Share2 className="h-3 w-3 text-slate-300 group-hover:text-slate-400" />}
                  </button>
                  <ChevronRight className="h-3 w-3 text-slate-200 group-hover:text-blue-600 flex-shrink-0" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );

  // ─── BOBLAR ─────────────────────────────────────────────────────────────────
  if (sahifa === 'boblar' && tanlanganBolim) return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      className="max-w-4xl mx-auto space-y-3 px-2">
      <button
        onClick={() => { setSahifa('bolimlar'); postRouteChange('savol-javob'); }}
        className="fixed top-16 left-2 z-30 md:relative md:top-auto md:left-auto flex items-center gap-1 text-slate-400 font-bold hover:text-blue-600 transition-all uppercase text-[9px] tracking-widest px-1 bg-white/80 md:bg-transparent rounded-lg p-1 md:p-0">
        <ChevronLeft className="h-3 w-3" /> {t('sj.back')}
      </button>
      <div className="bg-slate-900 rounded-xl p-5 text-white shadow-sm border border-slate-800">
        <h2 className="text-base font-bold uppercase tracking-tight">{tanlanganBolim.nomi}</h2>
      </div>
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {tanlanganBolim._boblar?.map((bob, i) => (
          <Card key={bob.id} onClick={() => bobOch(bob, tanlanganBolim)} className="border-slate-200 hover:border-blue-500 cursor-pointer transition-all rounded-xl shadow-none group">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-[9px] text-slate-500 flex-shrink-0">{i + 1}</div>
              <div className="flex-1 font-semibold text-slate-700 text-xs leading-tight line-clamp-2">{bob.nomi}</div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => handleShareBob(e, tanlanganBolim, bob)}
                  className="p-1 rounded-md hover:bg-slate-100 transition-colors"
                  title="Havolani nusxalash"
                >
                  {copiedId === bob.id
                    ? <Check className="h-3 w-3 text-green-500" />
                    : <Share2 className="h-3 w-3 text-slate-200 group-hover:text-slate-400" />}
                </button>
                <ChevronRight className="h-3 w-3 text-slate-200 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );

  // ─── SAVOLLAR ───────────────────────────────────────────────────────────────
  if (sahifa === 'savollar') {

    if (tugatildi) return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="max-w-xl mx-auto text-center py-6 px-2">
        <Card className="rounded-3xl border-slate-200 shadow-2xl overflow-hidden bg-white">
          <div className="bg-slate-900 p-10 text-white">
            <Trophy className="h-14 w-14 mx-auto mb-4 text-blue-500" />
            <h2 className="text-3xl font-black mb-1">{Math.round(natijalar.filter(n => n.holat === 'topdi').length / savollar.length * 100)}%</h2>
            <p className="text-slate-400 text-xs uppercase tracking-widest">{tanlanganBob?.nomi}</p>
          </div>
          <CardContent className="p-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                <p className="text-3xl font-black text-green-600">{natijalar.filter(n => n.holat === 'topdi').length}</p>
                <p className="text-[10px] font-bold text-green-700 uppercase">{t('sj.knew_label')}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                <p className="text-3xl font-black text-red-600">{natijalar.filter(n => n.holat === 'bilmadi').length}</p>
                <p className="text-[10px] font-bold text-red-700 uppercase">{t('sj.didnt_know_label')}</p>
              </div>
            </div>
            <Button onClick={() => setSahifa('boblar')} variant="outline" className="w-full h-12 rounded-xl font-bold text-xs uppercase tracking-widest">{t('sj.back_to_bobs')}</Button>
            <Button onClick={() => { setJoriyIndex(0); setNatijalar([]); setTugatildi(false); setOchiqRejim(false); setJavobKorsat(false); }} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white uppercase tracking-widest shadow-lg shadow-blue-100">{t('sj.restart')}</Button>
          </CardContent>
        </Card>
      </motion.div>
    );

    const s = savollar[joriyIndex];
    const topdiSoni = natijalar.filter(n => n.holat === 'topdi').length;
    const bilmadiSoni = natijalar.filter(n => n.holat === 'bilmadi').length;

    return (
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
        className="max-w-4xl mx-auto space-y-4 px-2 pb-20">

        {/* HEADER */}
        <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl shadow-sm">
          <button onClick={() => setSahifa('boblar')} className="p-2 hover:bg-slate-50 rounded-lg transition-all">
            <ChevronLeft className="h-4 w-4 text-slate-400" />
          </button>
          <div className="flex-1 px-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[200px]">{tanlanganBob?.nomi}</span>
              <span className="text-[10px] font-black text-blue-600">{joriyIndex + 1} / {savollar.length}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${((joriyIndex + 1) / savollar.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="px-2 py-1 bg-green-50 text-green-600 rounded-md text-[9px] font-black border border-green-100">✅ {topdiSoni}</div>
            <div className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-[9px] font-black border border-red-100">❌ {bilmadiSoni}</div>
          </div>
        </div>

        {/* KARTOCHKA */}
        <div className="w-full">
          {ochiqRejim ? (
            <div className="rounded-2xl overflow-hidden border-2 border-indigo-400 shadow-2xl">
              <div className="bg-slate-900 text-white px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-block px-3 py-1 bg-blue-600/60 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                    {t('sj.question_num')} #{joriyIndex + 1}
                  </span>
                  <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest bg-indigo-500/20 px-2 py-1 rounded-full border border-indigo-400/30">
                    Ochiq rejim
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-bold text-white leading-snug">{s.savol}</h2>
              </div>
              <div className="bg-white px-6 py-5">
                <span className="inline-block px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-3">
                  {t('sj.confirmed_answer')}
                </span>
                <p className="text-base font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{s.javob}</p>
                {s.link && (
                  <a href={s.link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-blue-600 hover:underline font-bold text-[10px] mt-3">
                    <Link2 className="h-3.5 w-3.5" /> {t('sj.source')}
                  </a>
                )}
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => holatBelgila('topdi')}
                      className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-[11px] uppercase tracking-wider shadow-lg shadow-green-100">
                      <CheckCircle2 className="h-4 w-4" /> {t('sj.knew')} ✅
                    </button>
                    <button onClick={() => holatBelgila('bilmadi')}
                      className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-[11px] uppercase tracking-wider shadow-lg shadow-red-100">
                      <XCircle className="h-4 w-4" /> {t('sj.didnt_know')} ❌
                    </button>
                  </div>
                  <button onClick={() => { setOchiqRejim(false); setJavobKorsat(false); }}
                    className="w-full h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] uppercase tracking-wider">
                    <EyeOff className="h-3.5 w-3.5" /> Javobni yashirish (An'anaviy rejim)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {!javobKorsat && (
                <div className="w-full bg-white border border-slate-200 shadow-xl rounded-2xl p-6 md:p-10 flex flex-col items-center justify-center text-center min-h-[180px]">
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest mb-5">
                    {t('sj.question_num')} #{joriyIndex + 1}
                  </span>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-snug mb-7">{s.savol}</h2>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={() => setJavobKorsat(true)}
                      className="h-11 px-8 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95">
                      <Eye className="mr-2 h-4 w-4" /> {t('sj.show_answer')}
                    </Button>
                    <button onClick={() => setOchiqRejim(true)}
                      className="h-11 px-5 flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95">
                      <Eye className="h-3.5 w-3.5" /> Barcha javoblar ko'rinsin
                    </button>
                  </div>
                </div>
              )}
              {javobKorsat && (
                <div className="w-full bg-white border-2 border-blue-500 shadow-2xl rounded-2xl p-6 md:p-8 min-h-[180px]">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                      {t('sj.confirmed_answer')}
                    </span>
                    <p className="text-base md:text-lg font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">{s.javob}</p>
                    {s.link && (
                      <a href={s.link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 text-blue-600 hover:underline font-bold text-[10px] pt-1">
                        <Link2 className="h-3.5 w-3.5" /> {t('sj.source')}
                      </a>
                    )}
                    <div className="w-full pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                        <button onClick={() => holatBelgila('topdi')}
                          className="h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-[11px] uppercase tracking-wider shadow-lg shadow-green-100">
                          <CheckCircle2 className="h-4 w-4" /> {t('sj.knew')} ✅
                        </button>
                        <button onClick={() => holatBelgila('bilmadi')}
                          className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-[11px] uppercase tracking-wider shadow-lg shadow-red-100">
                          <XCircle className="h-4 w-4" /> {t('sj.didnt_know')} ❌
                        </button>
                      </div>
                      <div className="flex items-center justify-center gap-3 flex-wrap">
                        <button onClick={() => setOchiqRejim(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                          <Eye className="h-3.5 w-3.5" /> Barcha javoblar ko'rinsin
                        </button>
                        <button onClick={() => setJavobKorsat(false)}
                          className="text-[10px] font-bold text-slate-400 hover:text-blue-500 uppercase flex items-center gap-1 transition-colors">
                          Savolga qaytish
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* NAVIGATSIYA RAQAMLARI */}
        <Card className="border border-slate-200 rounded-2xl shadow-sm p-3 bg-white">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('sj.questions_nav')}</span>
            <div className="flex gap-3 text-[9px] font-black text-slate-400 uppercase tracking-tight">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> {t('sj.knew_nav')}</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> {t('sj.didnt_know_nav')}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {savollar.map((_, i) => {
              const res = natijalar.find(n => n.savol_id === savollar[i].id);
              const isActive = i === joriyIndex;
              return (
                <button key={i} onClick={() => jumpToQuestion(i)}
                  className={cn(
                    "w-7 h-7 rounded-lg font-bold transition-all flex items-center justify-center border text-[10px]",
                    isActive
                      ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-50 scale-110 z-10"
                      : res?.holat === 'topdi'
                        ? "bg-green-500 text-white border-green-500"
                        : res?.holat === 'bilmadi'
                          ? "bg-red-500 text-white border-red-500"
                          : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:bg-slate-50"
                  )}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </Card>
      </motion.div>
    );
  }

  return null;
}
