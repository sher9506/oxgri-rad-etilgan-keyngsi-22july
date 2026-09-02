import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, Library, Layout, ChevronRight,
  ArrowLeft, Lock, ShieldCheck, BookOpenCheck,
  Layers, Search, Eye, Music, Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import SecureViewer from './SecureViewer';
import { isDemoAvailable, markDemoUsed } from '@/lib/demo';
import { parseOqMatSubPath, postRouteChange, getCurrentCleanPath } from '@/lib/deepLink';

interface Material {
  id: string; bob_id: string; bolim_id: string; nomi: string;
  fayl_url: string; fayl_tur: string; fayl_hajm?: number; tartib: number;
}
interface Bob {
  id: string; bolim_id: string; nomi: string; tartib: number;
  yashirin?: boolean; _materiallar?: Material[];
}
interface Bolim {
  id: string; nomi: string; tavsif: string | null; faol: boolean;
  ustoz_ismi: string; admin_bloklangan?: boolean;
  _boblar?: Bob[]; _materiallar_soni?: number; _korishlar_soni?: number;
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } }
};

// ── Neumorphism card fon ranglari ──────────────────────────────────────────
const NM_BG_ODD  = '#E0E8F0';  // asosiy fon
const NM_BG_EVEN = '#E2DFE9';  // juft karta foni

function nmShadow(bg: string) {
  // har bir fon uchun to'g'ri soya juftligi
  if (bg === NM_BG_EVEN) {
    return '8px 8px 16px #c5c2cf, -8px -8px 16px #ffffff';
  }
  return '8px 8px 16px #beccd8, -8px -8px 16px #ffffff';
}

function nmShadowHover(bg: string) {
  if (bg === NM_BG_EVEN) {
    return 'inset 6px 6px 12px #c5c2cf, inset -6px -6px 12px #ffffff';
  }
  return 'inset 6px 6px 12px #beccd8, inset -6px -6px 12px #ffffff';
}

export default function OquvMateriallarOquvchi() {
  const { isAuthenticated, user } = useAuth();
  const { t } = useLang();
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [bolimlar, setBolimlar] = useState<Bolim[]>([]);
  const [tanlanganBolim, setTanlanganBolim] = useState<Bolim | null>(null);
  const [tanlanganMaterial, setTanlanganMaterial] = useState<Material | null>(null);
  const [sahifa, setSahifa] = useState<'bolimlar' | 'boblar' | 'material'>('bolimlar');
  const [qidiruv, setQidiruv] = useState('');
  const [pendingMaterialId, setPendingMaterialId] = useState<string | null>(null);
  const [pendingDeepSubPath, setPendingDeepSubPath] = useState<string | null>(null);
  // hover tracking
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { yuklash(); }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const materialId = event.detail?.materialId;
      if (!materialId) return;
      setPendingMaterialId(materialId);
    };
    window.addEventListener('auto-open-material', handler as EventListener);
    return () => window.removeEventListener('auto-open-material', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const subPath: string = event.detail?.subPath || '';
      if (!subPath) return;
      setPendingDeepSubPath(subPath);
    };
    window.addEventListener('deeplink-oqmat', handler as EventListener);
    return () => window.removeEventListener('deeplink-oqmat', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!pendingMaterialId || bolimlar.length === 0) return;
    const allMaterials = bolimlar.flatMap((bolim) => bolim._boblar || []).flatMap((bob) => bob._materiallar || []);
    const match = allMaterials.find((mat) => mat.id === pendingMaterialId);
    if (match) {
      setTanlanganMaterial(match);
      setSahifa('material');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setPendingMaterialId(null);
    }
  }, [pendingMaterialId, bolimlar]);

  useEffect(() => {
    if (!pendingDeepSubPath || bolimlar.length === 0) return;
    const { bolimId, bobId, materialId } = parseOqMatSubPath(pendingDeepSubPath);
    let targetBolim: Bolim | null = null;
    if (bolimId) targetBolim = bolimlar.find(b => b.id === bolimId) || null;
    if (!targetBolim && bolimlar.length > 0) {
      if (materialId) {
        for (const b of bolimlar) {
          for (const bob of b._boblar || []) {
            const found = (bob._materiallar || []).find(m => m.id === materialId);
            if (found) { targetBolim = b; break; }
          }
          if (targetBolim) break;
        }
      }
    }
    if (targetBolim) {
      setTanlanganBolim(targetBolim);
      setSahifa('boblar');
      if (materialId) {
        const allMats = (targetBolim._boblar || []).flatMap(b => b._materiallar || []);
        const mat = allMats.find(m => m.id === materialId);
        if (mat) { setTanlanganMaterial(mat); setSahifa('material'); }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setPendingDeepSubPath(null);
  }, [pendingDeepSubPath, bolimlar]);

  const openLogin = () => window.dispatchEvent(new CustomEvent('open-login-modal'));
  const oquvchiIsmi = user ? `${user.ism} ${user.familiya}` : '';

  const yuklash = async () => {
    setYuklanmoqda(true);
    try {
      const { data: bData } = await supabase.from('om_bolimlar').select('*').eq('faol', true).eq('admin_bloklangan', false).order('tartib', { ascending: true });
      if (!bData) { setBolimlar([]); return; }
      const { data: korishlarData } = await supabase.from('om_korishlar').select('bolim_id');
      const korishlarMap: Record<string, number> = {};
      (korishlarData || []).forEach((k: any) => { korishlarMap[k.bolim_id] = (korishlarMap[k.bolim_id] || 0) + 1; });
      const enriched = await Promise.all(bData.map(async (b: any) => {
        const { data: bobData } = await supabase.from('om_boblar').select('*').eq('bolim_id', b.id).order('tartib', { ascending: true });
        const faolBoblar = (bobData || []).filter((bob: any) => !bob.yashirin);
        const boblarWithMats = await Promise.all(faolBoblar.map(async (bob: any) => {
          const { data: matData } = await supabase.from('om_materiallar').select('*').eq('bob_id', bob.id).order('tartib', { ascending: true });
          return { ...bob, _materiallar: matData || [] };
        }));
        const matSoni = boblarWithMats.reduce((acc, c) => acc + (c._materiallar?.length || 0), 0);
        return { ...b, _boblar: boblarWithMats, _materiallar_soni: matSoni, _korishlar_soni: korishlarMap[b.id] || 0 };
      }));
      setBolimlar(enriched);
    } finally { setYuklanmoqda(false); }
  };

  const bolimniOchish = async (b: Bolim) => {
    setTanlanganBolim(b); setSahifa('boblar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (isAuthenticated && oquvchiIsmi) {
      const { data: mavjud } = await supabase.from('om_korishlar').select('id').eq('bolim_id', b.id).eq('oquvchi_ismi', oquvchiIsmi).maybeSingle();
      if (!mavjud) {
        await supabase.from('om_korishlar').insert({ bolim_id: b.id, oquvchi_ismi: oquvchiIsmi });
        setBolimlar(prev => prev.map(bolim => bolim.id === b.id ? { ...bolim, _korishlar_soni: (bolim._korishlar_soni || 0) + 1 } : bolim));
      }
    }
  };

  const materialniOchish = (mat: Material) => {
    if (!isAuthenticated) {
      if (isDemoAvailable('material')) {
        markDemoUsed('material');
        setTanlanganMaterial(mat); setSahifa('material');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        postRouteChange(`oqmatlar/${mat.bolim_id}/${mat.bob_id}/${mat.id}`);
      } else {
        openLogin();
      }
      return;
    }
    setTanlanganMaterial(mat); setSahifa('material');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    postRouteChange(`oqmatlar/${mat.bolim_id}/${mat.bob_id}/${mat.id}`);
  };

  const orqagaQaytish = () => { setTanlanganMaterial(null); setSahifa('boblar'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const getFaylIcon = (tur: string) => {
    if (tur === 'pdf') return <FileText className="text-rose-500" />;
    if (tur === 'docx') return <FileText className="text-blue-500" />;
    if (tur === 'audio') return <Music className="text-purple-500" />;
    if (tur === 'video') return <Film className="text-emerald-500" />;
    return <Layout className="text-amber-500" />;
  };

  if (sahifa === 'material' && tanlanganMaterial) {
    return <SecureViewer material={tanlanganMaterial} onOrqaga={orqagaQaytish} />;
  }

  const filteredBolimlar = bolimlar.filter(b => b.nomi.toLowerCase().includes(qidiruv.toLowerCase()));

  return (
    // sahifa foni — neumorphism uchun zarur
    <div className="max-w-6xl mx-auto space-y-6 pb-20" style={{ background: 'transparent' }}>

      {/* HEADER */}
      <div className="bg-white/90 backdrop-blur-md p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20 transform -rotate-3">
            <Library className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {sahifa === 'bolimlar' ? t('om.title') : tanlanganBolim?.nomi}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sahifa === 'boblar' && (
            <button onClick={() => { setSahifa('bolimlar'); setTanlanganBolim(null); }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl text-xs font-bold transition-all">
              <ArrowLeft className="w-3.5 h-3.5" /> {t('om.back')}
            </button>
          )}
          <button onClick={yuklash}
            className="p-3 bg-slate-50 hover:bg-white hover:shadow-md border border-slate-100 rounded-xl text-slate-500 hover:text-blue-600 transition-all active:scale-90">
            <RefreshCw className={`h-4 w-4 ${yuklanmoqda ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* SEARCH */}
      {sahifa === 'bolimlar' && (
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" />
          <input type="text" placeholder={t('om.search')} value={qidiruv} onChange={(e) => setQidiruv(e.target.value)}
            className="w-full h-14 pl-12 pr-6 bg-white border border-slate-100 rounded-2xl shadow-sm outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 transition-all text-slate-700 font-medium text-sm" />
        </div>
      )}

      {/* CONTENT */}
      <AnimatePresence mode="wait">
        {sahifa === 'bolimlar' ? (
          <motion.div key="bolimlar-grid"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }}
            className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            style={{ background: 'transparent' }}
          >
            {yuklanmoqda && bolimlar.length === 0
              ? [1,2,3,4,5,6].map(i => {
                  const bg = i % 2 !== 0 ? NM_BG_ODD : NM_BG_EVEN;
                  return (
                    <div key={i} className="h-52 rounded-[24px] animate-pulse"
                      style={{ background: bg, boxShadow: nmShadow(bg) }} />
                  );
                })
              : filteredBolimlar.map((b, idx) => {
                  const bg = idx % 2 === 0 ? NM_BG_ODD : NM_BG_EVEN;
                  const isHovered = hoveredId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => bolimniOchish(b)}
                      onMouseEnter={() => setHoveredId(b.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="cursor-pointer p-5 md:p-6 relative overflow-hidden"
                      style={{
                        background: bg,
                        borderRadius: 24,
                        border: 'none',
                        boxShadow: isHovered ? nmShadowHover(bg) : nmShadow(bg),
                        transform: isHovered ? 'scale(0.98)' : 'scale(1)',
                        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                      }}
                    >
                      {/* İkon */}
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500"
                        style={{
                          background: isHovered ? '#3B82F6' : 'rgba(59,130,246,0.12)',
                          boxShadow: isHovered
                            ? 'inset 3px 3px 6px rgba(0,0,0,0.15), inset -2px -2px 4px rgba(255,255,255,0.3)'
                            : '4px 4px 8px rgba(0,0,0,0.08), -3px -3px 8px rgba(255,255,255,0.9)',
                        }}
                      >
                        <Layers className="h-6 w-6" style={{ color: isHovered ? '#fff' : '#3B82F6' }} />
                      </div>

                      {/* Nomi */}
                      <h3
                        className="text-base font-black leading-tight mb-2 uppercase tracking-tight line-clamp-2 transition-colors duration-200"
                        style={{ color: isHovered ? '#1D4ED8' : '#1E293B' }}
                      >
                        {b.nomi}
                      </h3>

                      {/* Tavsif */}
                      {b.tavsif && (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 font-medium italic mb-3">
                          {b.tavsif}
                        </p>
                      )}

                      {/* Ustoz */}
                      <p className="text-[10px] font-bold text-slate-400 mb-3">
                        {b.ustoz_ismi?.split(' ')[0]}
                      </p>

                      {/* Divider */}
                      <div
                        className="mb-3"
                        style={{
                          height: 1,
                          background: isHovered
                            ? 'rgba(59,130,246,0.2)'
                            : 'rgba(0,0,0,0.06)',
                        }}
                      />

                      {/* Stats */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-3 flex-wrap">
                          <span className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase">
                            <BookOpenCheck className="w-3 h-3 opacity-60" />
                            {b._boblar?.length || 0} {t('om.bobs').toUpperCase()}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase">
                            <FileText className="w-3 h-3 opacity-60" />
                            {b._materiallar_soni || 0} {t('om.files').toUpperCase()}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] font-black text-violet-500 uppercase">
                            <Eye className="w-3 h-3 opacity-60" />
                            {b._korishlar_soni || 0}
                          </span>
                        </div>
                        {/* Arrow */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                          style={{
                            background: isHovered ? '#3B82F6' : 'rgba(0,0,0,0.05)',
                            boxShadow: isHovered
                              ? 'inset 2px 2px 4px rgba(0,0,0,0.2)'
                              : '2px 2px 5px rgba(0,0,0,0.08), -2px -2px 5px rgba(255,255,255,0.9)',
                          }}
                        >
                          <ChevronRight
                            className="w-4 h-4 transition-all"
                            style={{ color: isHovered ? '#fff' : '#94A3B8', transform: isHovered ? 'translateX(1px)' : 'none' }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </motion.div>
        ) : (
          <motion.div key="boblar-list"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-4xl mx-auto space-y-6"
          >
            {tanlanganBolim?.tavsif && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3">
                <p className="text-sm text-blue-700 font-medium italic leading-relaxed">{tanlanganBolim.tavsif}</p>
              </div>
            )}
            <div className="space-y-6">
              {tanlanganBolim?._boblar?.map((bob, idx) => (
                <div key={bob.id} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-lg shadow-slate-200">
                      {idx + 1}
                    </div>
                    <h2 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-tight">{bob.nomi}</h2>
                  </div>
                  <div className="grid gap-3">
                    {bob._materiallar?.map((mat) => (
                      <motion.div key={mat.id}
                        whileHover={isAuthenticated ? { x: 4 } : {}}
                        onClick={() => materialniOchish(mat)}
                        className={`group flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-300 ${
                          isAuthenticated
                            ? 'bg-white border-slate-100 hover:border-blue-400 cursor-pointer shadow-sm hover:shadow-md'
                            : 'bg-slate-50/50 border-transparent opacity-70 cursor-default'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                            isAuthenticated
                              ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}>
                            {getFaylIcon(mat.fayl_tur)}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-blue-700 transition-colors">{mat.nomi}</h4>
                            <div className="flex items-center gap-2">
                              {!isAuthenticated ? (
                                <button onClick={(e) => { e.stopPropagation(); if (isDemoAvailable('material')) { materialniOchish(mat); } else { openLogin(); } }}
                                  className="text-[9px] text-emerald-600 font-black uppercase underline hover:text-emerald-800 tracking-widest">
                                  {isDemoAvailable('material') ? '🎁 Demo' : t('om.login_required')}
                                </button>
                              ) : (
                                <>
                                  <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase">
                                    <ShieldCheck className="w-3 h-3" /> {t('om.verified')}
                                  </span>
                                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{mat.fayl_tur}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAuthenticated ? (
                            <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="p-2.5 bg-slate-100 rounded-xl">
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <div className="pt-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-100 shadow-sm rounded-xl">
          <div className="w-5 h-5 rounded-lg bg-emerald-500 flex items-center justify-center">
            <ShieldCheck className="w-3 h-3 text-white" />
          </div>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">{t('om.secure_library')}</span>
        </div>
      </div>
    </div>
  );
}
