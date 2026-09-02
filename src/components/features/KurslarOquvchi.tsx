/**
 * KurslarOquvchi — O'quvchi uchun kurs ko'rish sahifasi
 * Dizayn: 3-ustunli kartochkalar, scroll animatsiya, hover effektlar
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, Play, CheckCircle, ChevronRight,
  FileText, Youtube, Globe, Music,
  Loader2, ArrowLeft, Award, Star,
  GraduationCap, BookMarked, Sparkles, Zap, Lock,
  Users, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import SecureViewer from './SecureViewer';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Kurs { id: string; nomi: string; tavsif: string | null; rasm_url: string | null; ustoz_ismi: string; faol: boolean; tartib: number; }
interface Modul { id: string; kurs_id: string; nomi: string; tavsif: string | null; tartib: number; faol: boolean; }
interface Dars { id: string; modul_id: string; kurs_id: string; nomi: string; tavsif: string | null; tartib: number; }
interface Kontent { id: string; dars_id: string; tur: string; nomi: string; kontent_url: string | null; youtube_id: string | null; matn_kontent: string | null; tartib: number; fayl_hajm: number | null; }
interface Aktivlik { id: string; dars_id: string; tur: string; nomi: string; ref_kod: string | null; tartib: number; }

// ── GRADIENT PALETTE ────────────────────────────────────────────────────────
const KURS_GRADIENTS = [
  { from: '#4F46E5', to: '#6366f1' },   // indigo
  { from: '#059669', to: '#10b981' },   // emerald
  { from: '#7C3AED', to: '#8B5CF6' },   // violet
  { from: '#DC2626', to: '#EF4444' },   // rose
  { from: '#D97706', to: '#F59E0B' },   // amber
  { from: '#0891B2', to: '#06B6D4' },   // cyan
];
const MODUL_COLORS = [
  { bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  { bg: 'bg-amber-600', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { bg: 'bg-rose-600', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
];

function gradientFor(str: string) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return KURS_GRADIENTS[sum % KURS_GRADIENTS.length];
}

// ── YOUTUBE EMBED ──────────────────────────────────────────────────────────
function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-lg" style={{ paddingBottom: '56.25%' }}>
      <iframe src={`https://www.youtube.com/embed/${videoId}`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0 w-full h-full border-0" />
    </div>
  );
}

function KontentIkon({ tur }: { tur: string }) {
  switch (tur) {
    case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />;
    case 'audio': return <Music className="h-4 w-4 text-purple-500" />;
    case 'pdf': return <FileText className="h-4 w-4 text-red-600" />;
    case 'docx': return <FileText className="h-4 w-4 text-blue-600" />;
    case 'html': return <Globe className="h-4 w-4 text-green-600" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
}

// ── SCROLL REVEAL HOOK ─────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

// ── KURS KARTOCHKA (scroll-reveal bilan) ──────────────────────────────────
function KursKartochka({ kurs, idx, onClick }: { kurs: Kurs; idx: number; onClick: () => void }) {
  const { ref, visible } = useScrollReveal();
  const grad = gradientFor(kurs.id);
  const [pressed, setPressed] = useState(false);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(36px)',
        transition: `opacity 0.5s ease ${idx * 0.07}s, transform 0.5s ease ${idx * 0.07}s`,
      }}
    >
      <button
        onClick={onClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        className="group w-full text-left"
        style={{
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.15s ease',
        }}
      >
        <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-indigo-100 hover:-translate-y-1 active:translate-y-0 flex flex-col h-full">
          {/* Muqova */}
          <div className="relative overflow-hidden" style={{ height: '130px' }}>
            {kurs.rasm_url ? (
              <>
                <img src={kurs.rasm_url} alt={kurs.nomi} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </>
            ) : (
              <>
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }} />
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="absolute top-3 right-3 opacity-15">
                  <BookMarked className="h-14 w-14 text-white" />
                </div>
                <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
              </>
            )}

            {/* Play badge */}
            <div className="absolute top-2.5 left-2.5">
              <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 scale-75 group-hover:scale-100">
                <Play className="h-3 w-3 fill-indigo-600 text-indigo-600" />
              </div>
            </div>

            {/* Kurs nomi overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white font-black text-[13px] leading-tight line-clamp-2 drop-shadow">{kurs.nomi}</p>
            </div>
          </div>

          {/* Info qism */}
          <div className="p-3 flex flex-col flex-1">
            {kurs.tavsif && (
              <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-2">{kurs.tavsif}</p>
            )}
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50">
              <div
                className="w-6 h-6 rounded-lg text-white flex items-center justify-center font-black text-[9px] uppercase flex-shrink-0 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
              >
                {kurs.ustoz_ismi?.split(' ')[0]?.[0]}{kurs.ustoz_ismi?.split(' ')[1]?.[0]}
              </div>
              <p className="text-[10px] font-semibold text-gray-500 truncate flex-1">{kurs.ustoz_ismi}</p>
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ASOSIY KOMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function KurslarOquvchi({ onNavigate }: { onNavigate?: (tab: string, extra?: any) => void }) {
  const { user } = useAuth();
  const oquvchiIsmi = user ? `${user.ism} ${user.familiya}` : '';

  const [kurslar, setKurslar] = useState<Kurs[]>([]);
  const [tanlanganKurs, setTanlanganKurs] = useState<Kurs | null>(null);
  const [modullar, setModullar] = useState<Modul[]>([]);
  const [darslar, setDarslar] = useState<Record<string, Dars[]>>({});
  const [kontentMap, setKontentMap] = useState<Record<string, Kontent[]>>({});
  const [aktivlikMap, setAktivlikMap] = useState<Record<string, Aktivlik[]>>({});
  const [ochiqModullar, setOchiqModullar] = useState<Set<string>>(new Set());
  const [ochiqDarslar, setOchiqDarslar] = useState<Set<string>>(new Set());
  const [tugallanganDarslar, setTugallanganDarslar] = useState<Set<string>>(new Set());
  const [tanlanganKontent, setTanlanganKontent] = useState<Kontent | null>(null);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [darsYuklanyapti, setDarsYuklanyapti] = useState<string | null>(null);
  const [progressYuklanyapti, setProgressYuklanyapti] = useState(false);

  useEffect(() => {
    supabase.from('kurslar').select('*').eq('faol', true).order('tartib')
      .then(({ data }) => { setKurslar(data || []); setYuklanyapti(false); });
  }, []);

  const progressYuklash = useCallback(async (kursId: string) => {
    if (!oquvchiIsmi) return;
    const { data } = await supabase.from('kurs_progress').select('tugallangan_darslar')
      .eq('kurs_id', kursId).eq('oquvchi_ismi', oquvchiIsmi).maybeSingle();
    if (data?.tugallangan_darslar) setTugallanganDarslar(new Set(data.tugallangan_darslar));
  }, [oquvchiIsmi]);

  const kursniTanlash = async (kurs: Kurs) => {
    setTanlanganKurs(kurs);
    setYuklanyapti(true);
    setOchiqModullar(new Set());
    setOchiqDarslar(new Set());
    setKontentMap({});
    setAktivlikMap({});

    const [{ data: modData }, { data: darData }] = await Promise.all([
      supabase.from('kurs_modullar').select('*').eq('kurs_id', kurs.id).eq('faol', true).order('tartib'),
      supabase.from('kurs_darslar').select('*').eq('kurs_id', kurs.id).order('tartib'),
    ]);
    const modulList = modData || [];
    const darsList = darData || [];
    const darsMap: Record<string, Dars[]> = {};
    modulList.forEach((m: any) => { darsMap[m.id] = darsList.filter((d: Dars) => d.modul_id === m.id); });
    setModullar(modulList);
    setDarslar(darsMap);
    if (modulList.length > 0) setOchiqModullar(new Set([modulList[0].id]));
    await progressYuklash(kurs.id);
    setYuklanyapti(false);
  };

  const darsniOchish = async (darsId: string) => {
    const yangi = new Set(ochiqDarslar);
    if (yangi.has(darsId)) { yangi.delete(darsId); setOchiqDarslar(yangi); return; }
    yangi.add(darsId);
    setOchiqDarslar(yangi);
    if (kontentMap[darsId]) return;
    setDarsYuklanyapti(darsId);
    const [{ data: kData }, { data: aData }] = await Promise.all([
      supabase.from('kurs_kontent').select('*').eq('dars_id', darsId).order('tartib'),
      supabase.from('kurs_aktivliklar').select('*').eq('dars_id', darsId).order('tartib'),
    ]);
    setKontentMap(prev => ({ ...prev, [darsId]: kData || [] }));
    setAktivlikMap(prev => ({ ...prev, [darsId]: aData || [] }));
    setDarsYuklanyapti(null);
  };

  const darsniTugallash = async (darsId: string) => {
    if (!tanlanganKurs || !oquvchiIsmi || tugallanganDarslar.has(darsId)) return;
    setProgressYuklanyapti(true);
    const yangi = new Set(tugallanganDarslar);
    yangi.add(darsId);
    setTugallanganDarslar(yangi);
    const { data: mavjud } = await supabase.from('kurs_progress').select('id')
      .eq('kurs_id', tanlanganKurs.id).eq('oquvchi_ismi', oquvchiIsmi).maybeSingle();
    if (mavjud) {
      await supabase.from('kurs_progress').update({ tugallangan_darslar: [...yangi], updated_at: new Date().toISOString() }).eq('id', mavjud.id);
    } else {
      await supabase.from('kurs_progress').insert({ kurs_id: tanlanganKurs.id, oquvchi_ismi: oquvchiIsmi, tugallangan_darslar: [...yangi] });
    }
    setProgressYuklanyapti(false);
  };

  const progressHisoblash = () => {
    const barcha = Object.values(darslar).flat();
    if (barcha.length === 0) return 0;
    return Math.round((tugallanganDarslar.size / barcha.length) * 100);
  };

  const aktivlikniOchish = (a: Aktivlik) => {
    if (!a.ref_kod) return;
    if (a.tur === 'test') {
      onNavigate?.('sinov');
      setTimeout(() => window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod: a.ref_kod } })), 400);
    } else if (a.tur === 'kazus') {
      onNavigate?.('sinov');
      setTimeout(() => window.dispatchEvent(new CustomEvent('auto-start-kazus', { detail: { kod: a.ref_kod } })), 400);
    }
  };

  const secureKontent = tanlanganKontent && tanlanganKontent.tur !== 'youtube' && tanlanganKontent.tur !== 'audio'
    ? { id: tanlanganKontent.id, nomi: tanlanganKontent.nomi, fayl_url: tanlanganKontent.kontent_url || '', fayl_tur: tanlanganKontent.tur }
    : null;
  if (secureKontent && tanlanganKontent) return <SecureViewer material={secureKontent} onOrqaga={() => setTanlanganKontent(null)} />;

  // ── KURSLAR RO'YXATI ─────────────────────────────────────────────────────
  if (!tanlanganKurs) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white px-7 py-8 shadow-2xl">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '30px 30px' }} />
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/20 rounded-full -translate-y-40 translate-x-40" />
          <div className="absolute bottom-0 left-8 w-52 h-52 bg-blue-600/15 rounded-full translate-y-28" />
          <div className="absolute top-6 right-8 opacity-10">
            <GraduationCap className="h-28 w-28" />
          </div>
          <div className="relative z-10 flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-blue-500/25 border border-blue-400/30 px-3 py-1 rounded-full mb-3">
                <Sparkles className="h-3 w-3 text-blue-300" />
                <span className="text-blue-200 text-xs font-bold tracking-wide">O'quv kurslar</span>
              </div>
              <h1 className="text-3xl font-black mb-1.5 leading-tight">Kurslar</h1>
              <p className="text-blue-300 text-sm max-w-xs leading-relaxed">
                O'z darajangizga mos kursni tanlang va bilimingizni oshiring
              </p>
            </div>
            {kurslar.length > 0 && (
              <div className="flex gap-3">
                <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl px-5 py-3 text-center">
                  <p className="text-2xl font-black">{kurslar.length}</p>
                  <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Kurslar</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kurslar gridi */}
        {yuklanyapti ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-9 w-9 text-indigo-600 animate-spin" />
            <p className="text-gray-400 text-sm">Yuklanmoqda...</p>
          </div>
        ) : kurslar.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100 shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-blue-400" />
            </div>
            <p className="font-bold text-gray-500 text-lg mb-1">Hozircha aktiv kurslar yo'q</p>
            <p className="text-gray-400 text-sm">Ustoz tomonidan kurslar tayyorlanmoqda...</p>
          </div>
        ) : (
          /* 3 ustunli grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kurslar.map((kurs, i) => (
              <KursKartochka key={kurs.id} kurs={kurs} idx={i} onClick={() => kursniTanlash(kurs)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── KURS ICHKI KO'RINISHI ────────────────────────────────────────────────
  const progress = progressHisoblash();
  const jami = Object.values(darslar).flat().length;
  const grad = gradientFor(tanlanganKurs.id);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Kurs sarlavha */}
      <div
        className="relative overflow-hidden text-white rounded-3xl p-6 mb-5 shadow-2xl"
        style={{ background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)` }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
        <div className="absolute top-0 right-0 w-52 h-52 bg-white/10 rounded-full -translate-y-28 translate-x-28" />
        <div className="relative z-10">
          <button
            onClick={() => { setTanlanganKurs(null); setModullar([]); setDarslar({}); setKontentMap({}); setAktivlikMap({}); setTugallanganDarslar(new Set()); }}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-bold mb-4 bg-white/10 hover:bg-white/20 active:bg-white/30 px-3 py-1.5 rounded-xl transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Kurslar ro'yxati
          </button>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-black leading-tight mb-1">{tanlanganKurs.nomi}</h1>
              {tanlanganKurs.tavsif && <p className="text-white/60 text-sm">{tanlanganKurs.tavsif}</p>}
              <div className="flex items-center gap-2 mt-3">
                <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center font-black text-[10px]">
                  {tanlanganKurs.ustoz_ismi?.[0]}
                </div>
                <span className="text-white/70 text-xs font-semibold">{tanlanganKurs.ustoz_ismi}</span>
              </div>
            </div>
            {/* Progress */}
            <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[140px] flex-shrink-0">
              {progress === 100 ? (
                <div className="flex flex-col items-center gap-1">
                  <Award className="h-8 w-8 text-yellow-300" />
                  <p className="font-black text-white text-sm">Tugallandi!</p>
                  <p className="text-white/60 text-[10px]">{jami}/{jami} dars</p>
                </div>
              ) : (
                <>
                  <div className="text-4xl font-black text-white mb-1">{progress}%</div>
                  <div className="text-white/60 text-[10px] font-semibold mb-2">{tugallanganDarslar.size}/{jami} dars</div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white/80 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {yuklanyapti ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-9 w-9 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {modullar.map((modul, mIdx) => {
            const modulDarslar = darslar[modul.id] || [];
            const tugallanganSon = modulDarslar.filter(d => tugallanganDarslar.has(d.id)).length;
            const modulOchiq = ochiqModullar.has(modul.id);
            const modulTugallangan = tugallanganSon === modulDarslar.length && modulDarslar.length > 0;
            const rang = MODUL_COLORS[mIdx % MODUL_COLORS.length];

            return (
              <div key={modul.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200 ${modulOchiq ? rang.border : 'border-gray-100 hover:border-gray-200'}`}>
                <button
                  onClick={() => { const n = new Set(ochiqModullar); n.has(modul.id) ? n.delete(modul.id) : n.add(modul.id); setOchiqModullar(n); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 ${modulOchiq ? rang.light : 'hover:bg-gray-50'} active:opacity-80 transition-all text-left`}
                >
                  <div className={`w-10 h-10 rounded-xl ${modulTugallangan ? 'bg-emerald-500' : rang.bg} text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-md`}>
                    {modulTugallangan ? <CheckCircle className="h-5 w-5" /> : mIdx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-gray-900 text-sm">{modul.nomi}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={`text-xs font-semibold ${rang.text}`}>{tugallanganSon}/{modulDarslar.length} dars</p>
                      {modulDarslar.length > 0 && (
                        <div className="flex-1 max-w-[80px] h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full ${rang.bg} rounded-full transition-all duration-500`} style={{ width: `${(tugallanganSon / modulDarslar.length) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`transition-transform duration-200 ${modulOchiq ? 'rotate-90' : ''}`}>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </button>

                {modulOchiq && (
                  <div className="border-t border-gray-100">
                    {modulDarslar.length === 0 ? (
                      <div className="px-5 py-5 text-sm text-gray-400 text-center">Darslar qo'shilmagan</div>
                    ) : modulDarslar.map((dars, dIdx) => {
                      const darsOchiq = ochiqDarslar.has(dars.id);
                      const tugallangan = tugallanganDarslar.has(dars.id);
                      const kontentlar = kontentMap[dars.id] || [];
                      const aktivliklar = aktivlikMap[dars.id] || [];

                      return (
                        <div key={dars.id} className="border-b border-gray-50 last:border-b-0">
                          <button
                            onClick={() => darsniOchish(dars.id)}
                            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all active:opacity-70 ${darsOchiq ? rang.light : 'hover:bg-gray-50'}`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black transition-all ${tugallangan ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : darsOchiq ? `${rang.bg} text-white shadow-sm` : 'bg-gray-100 text-gray-500'}`}>
                              {tugallangan ? <CheckCircle className="h-4 w-4" /> : dIdx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-bold truncate ${tugallandan ? 'text-emerald-700' : darsOchiq ? 'text-gray-900' : 'text-gray-700'}`}>{dars.nomi}</p>
                              {dars.tavsif && !darsOchiq && <p className="text-[10px] text-gray-400 truncate mt-0.5">{dars.tavsif}</p>}
                            </div>
                            {darsYuklanyapti === dars.id
                              ? <Loader2 className="h-3.5 w-3.5 text-indigo-500 animate-spin flex-shrink-0" />
                              : <div className={`transition-transform duration-200 ${darsOchiq ? 'rotate-90' : ''}`}><ChevronRight className="h-3.5 w-3.5 text-gray-400" /></div>
                            }
                          </button>

                          {darsOchiq && (
                            <div className={`${rang.light} border-t ${rang.border} px-5 pb-5 pt-4 space-y-3`}>
                              {kontentlar.length === 0 && aktivliklar.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-3">Kontent qo'shilmagan</p>
                              ) : (
                                <>
                                  {kontentlar.filter(k => k.tur === 'youtube' && k.youtube_id).map(k => (
                                    <div key={k.id} className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <div className="bg-red-50 p-1.5 rounded-lg"><Youtube className="h-4 w-4 text-red-500" /></div>
                                        <span className="text-sm font-bold text-gray-800">{k.nomi}</span>
                                      </div>
                                      <YouTubeEmbed videoId={k.youtube_id!} />
                                    </div>
                                  ))}
                                  {kontentlar.filter(k => k.tur === 'audio' && k.kontent_url).map(k => (
                                    <div key={k.id} className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-purple-50 p-1.5 rounded-lg"><Music className="h-4 w-4 text-purple-500" /></div>
                                        <p className="text-sm font-bold text-gray-800">{k.nomi}</p>
                                      </div>
                                      <audio src={k.kontent_url!} controls className="w-full h-10" />
                                    </div>
                                  ))}
                                  {kontentlar.filter(k => ['pdf', 'docx', 'html'].includes(k.tur) && k.kontent_url).map(k => (
                                    <button key={k.id} onClick={() => setTanlanganKontent(k)}
                                      className="w-full flex items-center gap-3 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 hover:border-indigo-300 rounded-2xl px-4 py-3 text-left transition-all group shadow-sm hover:shadow-md">
                                      <div className="bg-gray-50 group-hover:bg-indigo-50 p-2 rounded-xl transition-colors"><KontentIkon tur={k.tur} /></div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">{k.nomi}</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-semibold mt-0.5">{k.tur}{k.fayl_hajm ? ` • ${(k.fayl_hajm / 1024).toFixed(0)} KB` : ''}</p>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                                    </button>
                                  ))}
                                  {aktivliklar.map(a => (
                                    <button key={a.id} onClick={() => aktivlikniOchish(a)} disabled={!a.ref_kod}
                                      className="w-full flex items-center gap-3 bg-white hover:bg-orange-50 active:bg-orange-100 border border-orange-100 hover:border-orange-300 rounded-2xl px-4 py-3 text-left transition-all group shadow-sm hover:shadow-md disabled:opacity-50">
                                      <div className="bg-orange-50 group-hover:bg-orange-100 p-2 rounded-xl transition-colors"><Zap className="h-4 w-4 text-orange-500" /></div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{a.nomi}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${a.tur === 'test' ? 'bg-orange-100 text-orange-700' : 'bg-violet-100 text-violet-700'}`}>{a.tur.toUpperCase()}</span>
                                          {a.ref_kod && <span className="text-[10px] text-gray-400 font-mono">Kod: {a.ref_kod}</span>}
                                        </div>
                                      </div>
                                      <div className="bg-orange-100 group-hover:bg-orange-200 rounded-xl p-1.5 transition-colors">
                                        <Play className="h-4 w-4 text-orange-600 fill-orange-600" />
                                      </div>
                                    </button>
                                  ))}

                                  {!tugallangan && (kontentlar.length > 0 || aktivliklar.length > 0) && (
                                    <button
                                      onClick={() => darsniTugallash(dars.id)}
                                      disabled={progressYuklanyapti}
                                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-[0.98] text-white text-sm font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 mt-1"
                                    >
                                      {progressYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                      Darsni tugallandi deb belgilash
                                    </button>
                                  )}
                                  {tugallangan && (
                                    <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-bold py-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                                      <CheckCircle className="h-4 w-4" /> Dars muvaffaqiyatli tugallandi!
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {progress === 100 && jami > 0 && (
            <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white rounded-3xl p-8 text-center shadow-2xl">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative z-10">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="h-12 w-12 text-yellow-300" />
                </div>
                <h3 className="font-black text-2xl mb-2">🎉 Tabriklaymiz!</h3>
                <p className="text-emerald-100 text-sm max-w-sm mx-auto">
                  Siz "<strong className="text-white">{tanlanganKurs.nomi}</strong>" kursini muvaffaqiyatli yakunladingiz!
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
