import { useState, useEffect, useRef, useCallback } from 'react';
import { useLang } from '@/contexts/LangContext';
import {
  TrendingUp, Users, Trophy, Medal, Calendar, RefreshCw, Eye,
  X, Edit, FileText, BookOpen, Clock, CheckCircle, XCircle,
  BarChart3, Minus, ChevronRight, ArrowLeft, Search, Filter,
  Play, Square, Zap, Star, LogIn
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Javob, Kazus } from '@/types';
import JavobTahlil from './JavobTahlil';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface TestJavob {
  id: string;
  test_id: string;
  test_kod: string;
  oquvchi_ismi: string;
  javoblar: { savol_index: number; javob: number }[];
  togri_soni: number;
  xato_soni: number;
  javob_berilmagan: number;
  foiz: number;
  sarflangan_vaqt?: number;
  created_at: string;
}

interface OquvchiNatijaItem {
  tur: 'test' | 'kazus';
  nomi: string;
  kod: string;
  ball: number;
  maksimalBall: number;
  foiz: number;
  created_at: string;
  rawJavob: any;
  testSavollar?: any[];
  kazuslar?: any[];
}

type UstozTabType = 'kod' | 'testlar' | 'kazuslar';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function formatVaqt(sekund?: number): string {
  if (!sekund || sekund <= 0) return '—';
  const d = Math.floor(sekund / 60);
  const s = sekund % 60;
  return d > 0 ? `${d}m ${s}s` : `${s}s`;
}

function foizRang(foiz: number) {
  if (foiz >= 85) return { text: 'text-green-600', bg: 'bg-green-500', border: 'border-green-300', light: 'bg-green-50' };
  if (foiz >= 60) return { text: 'text-yellow-600', bg: 'bg-yellow-500', border: 'border-yellow-300', light: 'bg-yellow-50' };
  return { text: 'text-red-600', bg: 'bg-red-500', border: 'border-red-300', light: 'bg-red-50' };
}

// ─────────────────────────────────────────────────────────────────────────────
// O'QUVCHI — SHAXSIY NATIJALAR
// ─────────────────────────────────────────────────────────────────────────────
function OquvchiNatijalar({ ism, familiya }: { ism: string; familiya: string }) {
  const fullName = `${ism} ${familiya}`;
  const { t } = useLang();
  const [natijalar, setNatijalar] = useState<OquvchiNatijaItem[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [filter, setFilter] = useState<'barchasi' | 'test' | 'kazus'>('barchasi');
  const [tanlanganNatija, setTanlanganNatija] = useState<OquvchiNatijaItem | null>(null);
  const [tanlanganBatafsil, setTanlanganBatafsil] = useState<{ tahlil: any; ball: number; maksimalBall: number } | null>(null);
  const { toast } = useToast();

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      // Kazus javoblari
      const { data: kazusJavoblar } = await supabase
        .from('javoblar')
        .select('*')
        .eq('oquvchi_ismi', fullName)
        .order('created_at', { ascending: false });

      // Test javoblari
      const { data: testJavoblar } = await supabase
        .from('test_javoblar')
        .select('*')
        .eq('oquvchi_ismi', fullName)
        .order('created_at', { ascending: false });

      const barcha: OquvchiNatijaItem[] = [];

      // Kazus natijalari
      for (const j of kazusJavoblar || []) {
        const { data: toplam } = await supabase
          .from('toplamlar')
          .select('mavzu, kazuslar')
          .eq('kod', j.toplam_kod)
          .maybeSingle();

        const jami = (j.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0);
        // Maksimal ballni mezon sozlamalaridan hisoblash
        const kazuslarData = toplam?.kazuslar || [];
        const maks = kazuslarData.length > 0
          ? (j.baho || []).reduce((s: number, b: any) => {
              const kz = kazuslarData[b.kazus_index];
              const mezonlar = kz?.mezon_sozlamalar || [];
              const kazusMaks = mezonlar.length > 0
                ? mezonlar.filter((m: any) => m.faol).reduce((ms: number, m: any) => ms + (m.ball || 0), 0)
                : 30;
              return s + kazusMaks;
            }, 0)
          : (j.baho || []).length * 30;
        barcha.push({
          tur: 'kazus',
          nomi: toplam?.mavzu || 'Kazus',
          kod: j.toplam_kod,
          ball: jami,
          maksimalBall: maks,
          foiz: maks > 0 ? Math.round((jami / maks) * 100) : 0,
          created_at: j.created_at,
          rawJavob: j,
          kazuslar: toplam?.kazuslar || [],
        });
      }

      // Test natijalari
      for (const j of testJavoblar || []) {
        const { data: test } = await supabase
          .from('testlar')
          .select('test_nomi, savollar')
          .eq('kod', j.test_kod)
          .maybeSingle();

        const jami = j.togri_soni + j.xato_soni + j.javob_berilmagan;
        barcha.push({
          tur: 'test',
          nomi: test?.test_nomi || 'Test',
          kod: j.test_kod,
          ball: j.togri_soni,
          maksimalBall: jami,
          foiz: j.foiz,
          created_at: j.created_at,
          rawJavob: j,
          testSavollar: test?.savollar || [],
        });
      }

      barcha.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNatijalar(barcha);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Natijalarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  }, [fullName, toast]);

  useEffect(() => { yuklash(); }, [yuklash]);

  const filtered = natijalar.filter(n => filter === 'barchasi' || n.tur === filter);
  const testlar = natijalar.filter(n => n.tur === 'test');
  const kazuslar = natijalar.filter(n => n.tur === 'kazus');
  const avgFoiz = natijalar.length > 0 ? Math.round(natijalar.reduce((s, n) => s + n.foiz, 0) / natijalar.length) : 0;

  if (yuklanyapti) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      <p className="text-gray-500 font-medium text-sm">{t('results.loading')}</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Sarlavha */}
      <Card className="border-2 border-blue-500 overflow-hidden shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                <TrendingUp className="h-6 w-6" /> {t('results.my_results')}
              </h2>
              <p className="text-blue-200 text-sm mt-1">{fullName}</p>
            </div>
            <button
              onClick={yuklash}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-sm font-bold transition-all"
            >
              <RefreshCw className="h-4 w-4" /> {t('results.refresh')}
            </button>
          </div>
        </div>
      </Card>

      {/* Statistika */}
      {natijalar.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('results.total'), value: natijalar.length, icon: BarChart3, color: 'blue' },
            { label: t('results.tests'), value: testlar.length, icon: FileText, color: 'green' },
            { label: t('results.cases'), value: kazuslar.length, icon: BookOpen, color: 'purple' },
            { label: t('results.avg'), value: `${avgFoiz}%`, icon: Trophy, color: 'yellow' },
          ].map((s, i) => (
            <Card key={i} className={`border-2 border-${s.color}-100`}>
              <CardContent className="pt-4 pb-3 text-center">
                <s.icon className={`h-5 w-5 text-${s.color}-500 mx-auto mb-1`} />
                <p className={`text-2xl font-black text-${s.color}-600`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      {natijalar.length > 0 && (
        <div className="flex items-center gap-2">
          {(['barchasi', 'test', 'kazus'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                filter === f
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              {f === 'barchasi' ? t('results.all') : f === 'test' ? `📝 ${t('results.tests')}` : `📋 ${t('results.cases')}`}
            </button>
          ))}
        </div>
      )}

      {/* Natijalar ro'yxati */}
      {filtered.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-200">
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-14 w-14 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-400">{t('results.no_results')}</p>
            <p className="text-xs text-gray-300 mt-1">{t('results.no_results_desc')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((natija, idx) => {
            const rang = foizRang(natija.foiz);
            return (
              <Card
                key={idx}
                onClick={() => setTanlanganNatija(natija)}
                className={`border-2 ${rang.border} cursor-pointer hover:shadow-md transition-all`}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-4">
                    {/* Tur belgisi */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      natija.tur === 'test' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      {natija.tur === 'test'
                        ? <FileText className="h-5 w-5 text-green-600" />
                        : <BookOpen className="h-5 w-5 text-purple-600" />
                      }
                    </div>

                    {/* Ma'lumot */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          natija.tur === 'test' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {natija.tur === 'test' ? '📝 TEST' : '📋 KAZUS'}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono">#{natija.kod}</span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm truncate">{natija.nomi}</p>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(natija.created_at).toLocaleString('uz-UZ', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                        {natija.tur === 'test' && natija.rawJavob?.sarflangan_vaqt > 0 && (
                          <span className="flex items-center gap-1 text-blue-500 font-semibold">
                            <Clock className="h-3 w-3" />
                            {formatVaqt(natija.rawJavob.sarflangan_vaqt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ball */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-3xl font-black ${rang.text}`}>{natija.foiz}%</p>
                      <p className="text-[10px] text-gray-400">
                        {natija.ball}/{natija.maksimalBall}
                        {natija.tur === 'test' ? " to'g'ri" : ' ball'}
                      </p>
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 ml-auto">
                        <div className={`h-full rounded-full ${rang.bg}`} style={{ width: `${natija.foiz}%` }} />
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Natija tafsilot modal */}
      {tanlanganNatija && (
        <OquvchiNatijaModal
          natija={tanlanganNatija}
          onClose={() => setTanlanganNatija(null)}
          onBatafsil={(tahlil, ball, maks) => setTanlanganBatafsil({ tahlil, ball, maksimalBall: maks })}
        />
      )}

      {/* AI batafsil */}
      {tanlanganBatafsil && (
        <JavobTahlil
          tahlil={tanlanganBatafsil.tahlil}
          ball={tanlanganBatafsil.ball}
          maksimalBall={tanlanganBatafsil.maksimalBall}
          onClose={() => setTanlanganBatafsil(null)}
        />
      )}

      <style>{`@keyframes fade-in { from { opacity:0 } to { opacity:1 } } .animate-fade-in { animation: fade-in 0.3s ease-out }`}</style>
    </div>
  );
}

// O'quvchi natija tafsilot modal
function OquvchiNatijaModal({
  natija, onClose, onBatafsil
}: {
  natija: OquvchiNatijaItem;
  onClose: () => void;
  onBatafsil: (tahlil: any, ball: number, maks: number) => void;
}) {
  const rang = foizRang(natija.foiz);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`text-white p-6 ${natija.tur === 'test' ? 'bg-gradient-to-r from-green-600 to-teal-600' : 'bg-gradient-to-r from-purple-600 to-blue-600'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-black px-3 py-1 bg-white/20 rounded-full uppercase tracking-widest">
                {natija.tur === 'test' ? '📝 Test' : '📋 Kazus'}
              </span>
              <h3 className="text-xl font-black mt-2">{natija.nomi}</h3>
              <p className="text-white/70 text-sm">Kod: {natija.kod}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`text-5xl font-black ${rang.text === 'text-green-600' ? 'text-green-300' : rang.text === 'text-yellow-600' ? 'text-yellow-300' : 'text-red-300'}`}>
                  {natija.foiz}%
                </p>
                <p className="text-white/60 text-xs">
                  {natija.ball}/{natija.maksimalBall}
                  {natija.tur === 'test' ? " to'g'ri" : ' ball'}
                </p>
              </div>
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Kontent */}
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* TEST */}
          {natija.tur === 'test' && natija.rawJavob && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-2 border-green-200">
                  <CardContent className="pt-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
                    <p className="text-3xl font-black text-green-600">{natija.rawJavob.togri_soni}</p>
                    <p className="text-[10px] text-gray-400">To'g'ri</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-red-200">
                  <CardContent className="pt-4 text-center">
                    <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
                    <p className="text-3xl font-black text-red-600">{natija.rawJavob.xato_soni}</p>
                    <p className="text-[10px] text-gray-400">Xato</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-gray-200">
                  <CardContent className="pt-4 text-center">
                    <Minus className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                    <p className="text-3xl font-black text-gray-500">{natija.rawJavob.javob_berilmagan}</p>
                    <p className="text-[10px] text-gray-400">Javobsiz</p>
                  </CardContent>
                </Card>
              </div>

              {natija.rawJavob.sarflangan_vaqt > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700">Sarflangan vaqt: {formatVaqt(natija.rawJavob.sarflangan_vaqt)}</span>
                </div>
              )}

              {/* Savollar */}
              {natija.testSavollar && natija.testSavollar.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-800 text-sm">Savollar tahlili:</h4>
                  {natija.testSavollar.map((savol: any, idx: number) => {
                    const oquvchiJavob = natija.rawJavob.javoblar?.find((j: any) => j.savol_index === idx);
                    const berilgan = oquvchiJavob?.javob;
                    const togri = berilgan !== undefined && berilgan !== -1 && berilgan === savol.togriJavob;
                    const javobBerilgan = berilgan !== undefined && berilgan !== -1;
                    return (
                      <div key={idx} className={`p-3 rounded-xl border-2 ${!javobBerilgan ? 'border-gray-200 bg-gray-50' : togri ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-start gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 ${!javobBerilgan ? 'bg-gray-400' : togri ? 'bg-green-500' : 'bg-red-500'}`}>
                            {!javobBerilgan ? '—' : togri ? '✓' : '✗'}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-xs">{idx + 1}. <span dangerouslySetInnerHTML={{ __html: savol.savol }} /></p>
                            {javobBerilgan && (
                              <p className={`text-[10px] mt-0.5 ${togri ? 'text-green-700' : 'text-red-700'}`}>
                                Javobingiz: {String.fromCharCode(65 + berilgan)}) <span dangerouslySetInnerHTML={{ __html: savol.variantlar[berilgan] }} />
                              </p>
                            )}
                            {!togri && savol.togriJavob !== undefined && (
                              <p className="text-[10px] text-green-700">
                                To'g'ri: {String.fromCharCode(65 + savol.togriJavob)}) <span dangerouslySetInnerHTML={{ __html: savol.variantlar[savol.togriJavob] }} />
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* KAZUS */}
          {natija.tur === 'kazus' && natija.rawJavob?.baho && (
            <div className="space-y-4">
              {natija.rawJavob.baho.map((baho: any, idx: number) => {
                const kazus = natija.kazuslar?.[baho.kazus_index];
                const oquvchiJavob = natija.rawJavob.javoblar?.find((j: any) => j.kazus_index === baho.kazus_index);
                // Maksimal ballni mezon sozlamalaridan hisoblash
                const mezonlar = kazus?.mezon_sozlamalar || [];
                const kazusMaks = mezonlar.length > 0
                  ? mezonlar.filter((m: any) => m.faol).reduce((s: number, m: any) => s + (m.ball || 0), 0)
                  : 30;
                const rang2 = baho.ball >= kazusMaks * 0.7 ? 'text-green-600' : baho.ball >= kazusMaks * 0.5 ? 'text-yellow-600' : 'text-red-600';
                return (
                  <div key={idx} className="border-2 border-gray-200 rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-gray-200">
                      <span className="font-black text-blue-700 text-sm">#{baho.kazus_index + 1} Kazus</span>
                      <div className="flex items-center gap-3">
                        <div>
                          <span className={`text-2xl font-black ${rang2}`}>{baho.ball}</span>
                          <span className="text-gray-400 text-xs"> / {kazusMaks}</span>
                        </div>
                        {baho.batafsil_tahlil && (
                          <button
                            onClick={() => onBatafsil(baho.batafsil_tahlil, baho.ball, kazusMaks)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" /> AI tahlil
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {kazus && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                          <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1">Vaziyat:</p>
                          <p className="text-xs text-blue-900 leading-relaxed">{kazus.kazus}</p>
                        </div>
                      )}
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                        <p className="text-[9px] font-black text-purple-700 uppercase tracking-widest mb-1">Sizning javobingiz:</p>
                        <p className="text-xs text-purple-900 leading-relaxed whitespace-pre-wrap">{oquvchiJavob?.javob || 'Javob berilmagan'}</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">AI xulosasi:</p>
                        <p className="text-xs text-slate-700 italic">"{baho.izoh}"</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USTOZ — KOD BILAN MONITORING
// ─────────────────────────────────────────────────────────────────────────────
type KodTuri = 'kazus' | 'test' | null;

function UstozKodMonitoring() {
  const { t } = useLang();
  const [kod, setKod] = useState('');
  const [kodTuri, setKodTuri] = useState<KodTuri>(null);
  const [toplamMavzu, setToplamMavzu] = useState('');
  const [toplamKazuslar, setToplamKazuslar] = useState<Kazus[]>([]);
  const [testSavollar, setTestSavollar] = useState<any[]>([]);
  const [javoblar, setJavoblar] = useState<Javob[]>([]);
  const [testJavoblar, setTestJavoblar] = useState<TestJavob[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [faol, setFaol] = useState(false);
  const [oxirgiYangilanish, setOxirgiYangilanish] = useState<Date | null>(null);
  const [tahrirlashModal, setTahrirlashModal] = useState<Javob | null>(null);
  const [tahrirlashBahoData, setTahrirlashBahoData] = useState<{ [key: number]: { ball: number; izoh: string } }>({});
  const [tahrirlashYuklanyapti, setTahrirlashYuklanyapti] = useState(false);
  const [tanlanganBatafsil, setTanlanganBatafsil] = useState<{ tahlil: any; ball: number; maksimalBall: number } | null>(null);
  const [tanlanganTestJavob, setTanlanganTestJavob] = useState<TestJavob | null>(null);
  const [testOrinlar, setTestOrinlar] = useState<Map<string, number>>(new Map());
  const intervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  const STORAGE_KEY = 'baholash_toplam_kod';

  useEffect(() => {
    const savedKod = localStorage.getItem(STORAGE_KEY);
    if (savedKod && savedKod.length === 5) {
      setKod(savedKod);
      setTimeout(() => kuzatishniBashlash(savedKod), 100);
    }
  }, []);

  useEffect(() => {
    if (tahrirlashModal) {
      const data: { [k: number]: { ball: number; izoh: string } } = {};
      tahrirlashModal.baho.forEach((b: any) => {
        data[b.kazus_index] = { ball: b.ball, izoh: b.izoh };
      });
      setTahrirlashBahoData(data);
    }
  }, [tahrirlashModal]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const kodTuriniAniqla = async (k: string): Promise<KodTuri> => {
    const [toplamRes, testRes] = await Promise.all([
      supabase.from('toplamlar').select('kod').eq('kod', k).maybeSingle(),
      supabase.from('testlar').select('kod').eq('kod', k).maybeSingle(),
    ]);
    if (toplamRes.data) return 'kazus';
    if (testRes.data) return 'test';
    return null;
  };

  const kazusNatijalarYuklash = async (k: string, showLoading: boolean) => {
    if (showLoading) setYuklanyapti(true);
    try {
      const { data: toplamData } = await supabase.from('toplamlar').select('mavzu, kazuslar').eq('kod', k).single();
      if (!toplamData) { setFaol(false); return; }
      const { data } = await supabase.from('javoblar').select('*').eq('toplam_kod', k).order('created_at', { ascending: true });
      const sorted = (data || []).map(j => ({
        ...j,
        _jami: (j.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0)
      })).sort((a, b) => b._jami - a._jami || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setToplamMavzu(toplamData.mavzu || 'Kazus');
      setToplamKazuslar(toplamData.kazuslar || []);
      setJavoblar(sorted as Javob[]);
      setFaol(true);
      setOxirgiYangilanish(new Date());
    } catch (e) { console.error(e); setFaol(false); }
    finally { if (showLoading) setYuklanyapti(false); }
  };

  const testNatijalarYuklash = async (k: string, showLoading: boolean) => {
    if (showLoading) setYuklanyapti(true);
    try {
      const { data: testData } = await supabase.from('testlar').select('test_nomi, savollar').eq('kod', k).single();
      if (!testData) { setFaol(false); return; }
      const { data } = await supabase.from('test_javoblar').select('*').eq('test_kod', k).order('togri_soni', { ascending: false });
      const arr = (data || []) as TestJavob[];
      arr.sort((a, b) => b.togri_soni - a.togri_soni || (a.sarflangan_vaqt ?? 99999) - (b.sarflangan_vaqt ?? 99999));
      const map = new Map<string, number>();
      arr.forEach((j, i) => map.set(j.oquvchi_ismi, i + 1));
      setToplamMavzu(testData.test_nomi || 'Test');
      setTestSavollar(testData.savollar || []);
      setTestJavoblar(arr);
      setTestOrinlar(map);
      setFaol(true);
      setOxirgiYangilanish(new Date());
    } catch (e) { console.error(e); setFaol(false); }
    finally { if (showLoading) setYuklanyapti(false); }
  };

  const natijalarYuklash = (showLoading = true, tur?: KodTuri, k?: string) => {
    const ishKod = k || kod;
    const ishTur = tur || kodTuri;
    if (ishTur === 'kazus') kazusNatijalarYuklash(ishKod, showLoading);
    else if (ishTur === 'test') testNatijalarYuklash(ishKod, showLoading);
  };

  const kuzatishniBashlash = async (customKod?: string) => {
    const k = (customKod || kod).trim();
    if (k.length !== 5) {
      toast({ title: 'Xato', description: "Kod 5 raqamdan iborat bo'lishi kerak", variant: 'destructive' });
      return;
    }
    setYuklanyapti(true);
    const tur = await kodTuriniAniqla(k);
    if (!tur) {
      toast({ title: 'Topilmadi', description: 'Bu kod bilan test yoki kazus topilmadi', variant: 'destructive' });
      setYuklanyapti(false);
      return;
    }
    setKodTuri(tur);
    localStorage.setItem(STORAGE_KEY, k);
    await (tur === 'kazus' ? kazusNatijalarYuklash(k, true) : testNatijalarYuklash(k, true));
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => natijalarYuklash(false, tur, k), 5000);
  };

  const toxtash = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    localStorage.removeItem(STORAGE_KEY);
    setFaol(false); setKod(''); setKodTuri(null);
    setJavoblar([]); setTestJavoblar([]); setToplamMavzu('');
    setToplamKazuslar([]); setTestSavollar([]); setOxirgiYangilanish(null);
    setTahrirlashModal(null); setTanlanganBatafsil(null); setTanlanganTestJavob(null);
  };

  const handleBahoSaqlash = async () => {
    if (!tahrirlashModal) return;
    for (const kazusIndex in tahrirlashBahoData) {
      const d = tahrirlashBahoData[kazusIndex];
      if (d.ball < 0 || d.ball > 30) {
        toast({ title: 'Xato', description: `Kazus ${Number(kazusIndex) + 1}: Ball 0-30`, variant: 'destructive' });
        return;
      }
      if (!d.izoh.trim()) {
        toast({ title: 'Xato', description: `Kazus ${Number(kazusIndex) + 1}: Izoh yozish majburiy`, variant: 'destructive' });
        return;
      }
    }
    setTahrirlashYuklanyapti(true);
    try {
      const yangiBaho = tahrirlashModal.baho.map((b: any) => {
        const yd = tahrirlashBahoData[b.kazus_index];
        return yd ? { ...b, ball: yd.ball, izoh: yd.izoh } : b;
      });
      const { error } = await supabase.from('javoblar').update({ baho: yangiBaho }).eq('id', tahrirlashModal.id);
      if (error) throw error;
      setJavoblar(prev => prev.map(j => j.id === tahrirlashModal.id ? { ...j, baho: yangiBaho } : j));
      toast({ title: 'Muvaffaqiyatli!', description: 'Baholar yangilandi' });
      setTahrirlashModal(null); setTahrirlashBahoData({});
    } catch (e) {
      toast({ title: 'Xato', description: 'Baholarni yangilashda xatolik', variant: 'destructive' });
    } finally { setTahrirlashYuklanyapti(false); }
  };

  // Kod kiritish ekrani
  if (!faol) return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <Card className="border-2 border-blue-400 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" /> {t('results.monitor')}
          </CardTitle>
          <p className="text-blue-200 text-xs mt-1">{t('results.by_code')}</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">{t('results.enter_code')}:</label>
            <Input
              placeholder="12345"
              value={kod}
              onChange={e => setKod(e.target.value.replace(/\D/g, '').slice(0, 5))}
              onKeyDown={e => e.key === 'Enter' && kod.length === 5 && kuzatishniBashlash()}
              maxLength={5}
              className="text-2xl font-black text-center tracking-widest h-14 border-2"
            />
          </div>
          <Button
            onClick={() => kuzatishniBashlash()}
            disabled={yuklanyapti || kod.length !== 5}
            className="w-full h-12 font-black"
          >
            {yuklanyapti ? t('results.detecting') : t('results.start_monitoring')}
          </Button>
        </CardContent>
      </Card>
      <style>{`@keyframes fade-in { from{opacity:0}to{opacity:1}} .animate-fade-in{animation:fade-in .3s ease-out}`}</style>
    </div>
  );

  const jami = kodTuri === 'test' ? testJavoblar.length : javoblar.length;

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
      {/* Header */}
      <Card className="border-2 border-blue-400 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${kodTuri === 'test' ? 'bg-green-400/70' : 'bg-yellow-400/70'}`}>
                  {kodTuri === 'test' ? '📝 TEST' : '📋 KAZUS'}
                </span>
                <h2 className="text-lg font-black">{toplamMavzu}</h2>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-200">
                <span className="font-mono font-bold">KOD: {kod}</span>
                <span className="flex items-center gap-1"><Users className="h-4 w-4" />{jami} javob</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {oxirgiYangilanish && (
                <span className="text-xs text-blue-300">{oxirgiYangilanish.toLocaleTimeString('uz-UZ')}</span>
              )}
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <Button onClick={toxtash} variant="secondary" size="sm">{t('results.stop')}</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* TEST natijalari */}
      {kodTuri === 'test' && (
        <>
          {testJavoblar.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 text-gray-200 mx-auto mb-3 animate-pulse" />
              <p className="text-gray-400 font-medium">Hali javob yo'q...</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {/* Statistika */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "O'rtacha", value: `${Math.round(testJavoblar.reduce((s,j)=>s+j.foiz,0)/testJavoblar.length)}%`, color: 'blue' },
                  { label: 'Jami', value: testJavoblar.length, color: 'gray' },
                  { label: "A'lo (85%+)", value: testJavoblar.filter(j=>j.foiz>=85).length, color: 'green' },
                  { label: 'Past (<50%)', value: testJavoblar.filter(j=>j.foiz<50).length, color: 'red' },
                ].map((s,i) => (
                  <Card key={i} className={`border border-${s.color}-200`}>
                    <CardContent className="py-3 text-center">
                      <p className={`text-2xl font-black text-${s.color}-600`}>{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {testJavoblar.map((javob, idx) => {
                const rang = foizRang(javob.foiz);
                const orin = testOrinlar.get(javob.oquvchi_ismi) || idx + 1;
                return (
                  <Card
                    key={javob.id}
                    onClick={() => setTanlanganTestJavob(javob)}
                    className={`border-2 cursor-pointer hover:shadow-lg transition-all ${
                      idx===0 ? 'border-yellow-400 bg-yellow-50' : idx===1 ? 'border-gray-400 bg-gray-50' : idx===2 ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-white shadow flex items-center justify-center font-black text-lg flex-shrink-0">
                          {idx===0 ? '🥇' : idx===1 ? '🥈' : idx===2 ? '🥉' : <span className="text-gray-500 text-base">{orin}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">{javob.oquvchi_ismi}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            <span className="text-green-600 font-bold">✓ {javob.togri_soni}</span>
                            <span className="text-red-600 font-bold">✗ {javob.xato_soni}</span>
                            {javob.sarflangan_vaqt && javob.sarflangan_vaqt > 0 && (
                              <span className="flex items-center gap-1 text-blue-600">
                                <Clock className="h-3 w-3" />{formatVaqt(javob.sarflangan_vaqt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={`text-4xl font-black ${rang.text}`}>{javob.foiz}%</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* KAZUS natijalari */}
      {kodTuri === 'kazus' && (
        <>
          {javoblar.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <Users className="h-16 w-16 text-gray-200 mx-auto mb-3 animate-pulse" />
              <p className="text-gray-400 font-medium">Hali javob yo'q...</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {javoblar.map((javob, idx) => {
                const jami2 = (javob.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0);
                const maks = (javob.baho || []).length * 30;
                const foiz = maks > 0 ? Math.round((jami2 / maks) * 100) : 0;
                const rang = foizRang(foiz);
                return (
                  <Card
                    key={javob.id}
                    onClick={() => setTahrirlashModal(javob)}
                    className={`border-2 cursor-pointer hover:shadow-lg transition-all ${
                      idx===0 ? 'border-yellow-400 bg-yellow-50' : idx===1 ? 'border-gray-400 bg-gray-50' : idx===2 ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <CardContent className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-white shadow flex items-center justify-center font-black flex-shrink-0">
                          {idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':<span className="text-gray-500 text-sm">{idx+1}</span>}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">{javob.oquvchi_ismi}</p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(javob.created_at).toLocaleString('uz-UZ', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`text-4xl font-black ${rang.text}`}>{jami2}</span>
                            <span className="text-gray-300 text-sm">/{maks}</span>
                            <p className={`text-xs font-bold ${rang.text}`}>{foiz}%</p>
                          </div>
                          <button className="p-2 hover:bg-blue-50 rounded-xl text-blue-500">
                            <Edit className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Auto yangilash indikator */}
      <div className="fixed bottom-6 right-6 bg-white rounded-full shadow-xl p-3 border-2 border-blue-400 z-30">
        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      </div>

      {/* TEST tafsilot modal */}
      {tanlanganTestJavob && (
        <TestJavobModal
          javob={tanlanganTestJavob}
          testNomi={toplamMavzu}
          savollar={testSavollar}
          onClose={() => setTanlanganTestJavob(null)}
        />
      )}

      {/* KAZUS baho tahrirlash modal */}
      {tahrirlashModal && (
        <KazusTahrirlashModal
          javob={tahrirlashModal}
          toplamKazuslar={toplamKazuslar}
          bahoData={tahrirlashBahoData}
          onBahoChange={(ki, f, v) => setTahrirlashBahoData(p => ({ ...p, [ki]: { ...p[ki], [f]: f === 'ball' ? Number(v) : v } }))}
          onSaqlash={handleBahoSaqlash}
          onClose={() => { setTahrirlashModal(null); setTahrirlashBahoData({}); }}
          yuklanyapti={tahrirlashYuklanyapti}
          onBatafsil={(tahlil, ball, maks) => setTanlanganBatafsil({ tahlil, ball, maksimalBall: maks })}
        />
      )}

      {/* AI batafsil */}
      {tanlanganBatafsil && (
        <JavobTahlil
          tahlil={tanlanganBatafsil.tahlil}
          ball={tanlanganBatafsil.ball}
          maksimalBall={tanlanganBatafsil.maksimalBall}
          onClose={() => setTanlanganBatafsil(null)}
        />
      )}

      <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}`}</style>
    </div>
  );
}

// Test javob tafsilot modal
function TestJavobModal({ javob, testNomi, savollar, onClose }: {
  javob: TestJavob; testNomi: string; savollar: any[]; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-black">{javob.oquvchi_ismi}</h3>
              <p className="text-green-200 text-xs">{testNomi}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-black ${javob.foiz>=85?'text-green-300':javob.foiz>=60?'text-yellow-300':'text-red-300'}`}>{javob.foiz}%</span>
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className={`grid gap-3 ${javob.sarflangan_vaqt&&javob.sarflangan_vaqt>0?'grid-cols-4':'grid-cols-3'}`}>
            {[
              { label: "To'g'ri", value: javob.togri_soni, color: 'green' },
              { label: 'Xato', value: javob.xato_soni, color: 'red' },
              { label: 'Javobsiz', value: javob.javob_berilmagan, color: 'gray' },
            ].map((s,i) => (
              <Card key={i} className={`border border-${s.color}-200`}>
                <CardContent className="py-3 text-center">
                  <p className={`text-2xl font-black text-${s.color}-600`}>{s.value}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </CardContent>
              </Card>
            ))}
            {javob.sarflangan_vaqt && javob.sarflangan_vaqt > 0 && (
              <Card className="border border-blue-200">
                <CardContent className="py-3 text-center">
                  <Clock className="h-4 w-4 text-blue-500 mx-auto mb-0.5" />
                  <p className="text-lg font-black text-blue-600">{formatVaqt(javob.sarflangan_vaqt)}</p>
                  <p className="text-[10px] text-gray-400">Vaqt</p>
                </CardContent>
              </Card>
            )}
          </div>
          {savollar.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-gray-800 text-sm">Savollar tahlili ({savollar.length} ta):</h4>
              {savollar.map((savol: any, idx: number) => {
                const oj = javob.javoblar?.find(j => j.savol_index === idx);
                const b = oj?.javob;
                const togri = b !== undefined && b !== -1 && b === savol.togriJavob;
                const berilgan = b !== undefined && b !== -1;
                return (
                  <div key={idx} className={`p-3 rounded-xl border-2 text-xs ${!berilgan?'border-gray-200 bg-gray-50':togri?'border-green-200 bg-green-50':'border-red-200 bg-red-50'}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-black text-[9px] flex-shrink-0 ${!berilgan?'bg-gray-400':togri?'bg-green-500':'bg-red-500'}`}>
                        {!berilgan?'—':togri?'✓':'✗'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{idx+1}. <span dangerouslySetInnerHTML={{__html:savol.savol}} /></p>
                        {berilgan && <p className={togri?'text-green-700':'text-red-700'}>Javobi: {String.fromCharCode(65+(b as number))}) <span dangerouslySetInnerHTML={{__html:savol.variantlar[b as number]}} /></p>}
                        {!togri && savol.togriJavob!==undefined && <p className="text-green-700">To'g'ri: {String.fromCharCode(65+savol.togriJavob)}) <span dangerouslySetInnerHTML={{__html:savol.variantlar[savol.togriJavob]}} /></p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Kazus baho tahrirlash modal
function KazusTahrirlashModal({ javob, toplamKazuslar, bahoData, onBahoChange, onSaqlash, onClose, yuklanyapti, onBatafsil }: {
  javob: Javob; toplamKazuslar: Kazus[]; bahoData: any;
  onBahoChange: (ki: number, f: 'ball'|'izoh', v: any) => void;
  onSaqlash: () => void; onClose: () => void;
  yuklanyapti: boolean;
  onBatafsil: (tahlil: any, ball: number, maks: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black flex items-center gap-2"><Edit className="h-5 w-5" />Baho tahrirlash</h3>
              <p className="text-blue-200 text-xs">{javob.oquvchi_ismi}</p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {javob.baho.map((baho: any, idx: number) => {
            const kazus = toplamKazuslar[baho.kazus_index];
            const oquvchiJavob = javob.javoblar.find((j: any) => j.kazus_index === baho.kazus_index);
            const currentData = bahoData[baho.kazus_index] || { ball: baho.ball, izoh: baho.izoh };
            return (
              <div key={idx} className="border-2 border-gray-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-blue-600">#{baho.kazus_index + 1} Kazus</h4>
                  <div>
                    <span className={`text-2xl font-black ${baho.ball>=21?'text-green-600':baho.ball>=15?'text-yellow-600':'text-red-600'}`}>{baho.ball}</span>
                    <span className="text-gray-400 text-sm"> / 30</span>
                  </div>
                </div>
                {kazus && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                    <p className="text-[9px] font-black text-blue-800 uppercase mb-1">Kazus:</p>
                    <p className="text-xs text-blue-900 leading-relaxed">{kazus.kazus}</p>
                  </div>
                )}
                {kazus && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                    <p className="text-[9px] font-black text-green-800 uppercase mb-1">To'g'ri javob:</p>
                    <p className="text-xs text-green-900 leading-relaxed whitespace-pre-wrap">{kazus.javob}</p>
                  </div>
                )}
                <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
                  <p className="text-[9px] font-black text-purple-800 uppercase mb-1">O'quvchi javobi:</p>
                  <p className="text-xs text-purple-900 leading-relaxed whitespace-pre-wrap">{oquvchiJavob?.javob || 'Javob berilmagan'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-700 mb-1 block">Ball (0-30):</label>
                    <input
                      type="number" min="0" max="30"
                      value={currentData.ball}
                      onChange={e => onBahoChange(baho.kazus_index, 'ball', e.target.value)}
                      className="w-24 px-3 py-2 border-2 border-gray-300 rounded-xl text-xl font-black text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {baho.batafsil_tahlil && (
                    <button
                      onClick={() => onBatafsil(baho.batafsil_tahlil, baho.ball, 30)}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-bold border-2 border-purple-300 text-purple-700 hover:bg-purple-50 rounded-xl"
                    >
                      <Eye className="h-3.5 w-3.5" /> AI tahlil
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700 mb-1 block">Ustoz izohi: <span className="text-red-500">*</span></label>
                  <Textarea
                    placeholder="Izoh yozing..."
                    value={currentData.izoh}
                    onChange={e => onBahoChange(baho.kazus_index, 'izoh', e.target.value)}
                    rows={3}
                    className="resize-none border-2 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-200 bg-white">
          <Button onClick={onSaqlash} disabled={yuklanyapti} className="w-full font-black h-11">
            {yuklanyapti ? 'Saqlanmoqda...' : "O'zgarishlarni saqlash"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USTOZ — O'Z TESTLARI/KAZUSLARI RO'YHATI
// ─────────────────────────────────────────────────────────────────────────────
interface UstozTestRoyhat {
  id: string; kod: string; test_nomi?: string; mavzu?: string;
  savollar?: any[]; kazuslar?: any[];
  created_at: string; is_active?: boolean; ommaviy?: boolean;
  narx?: number;
}

function UstozTestlarRoyhat({ ustozId, tur }: { ustozId: string; tur: 'test' | 'kazus' }) {
  const { t } = useLang();
  const [items, setItems] = useState<UstozTestRoyhat[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [tanlangan, setTanlangan] = useState<UstozTestRoyhat | null>(null);
  const [natijalar, setNatijalar] = useState<any[]>([]);
  const [natijalarYuklanyapti, setNatijalarYuklanyapti] = useState(false);
  const [tanlanganTestJavob, setTanlanganTestJavob] = useState<TestJavob | null>(null);
  const [tanlanganKazusJavob, setTanlanganKazusJavob] = useState<Javob | null>(null);
  const [tanlanganBatafsil, setTanlanganBatafsil] = useState<{ tahlil: any; ball: number; maksimalBall: number } | null>(null);
  const [bahoData, setBahoData] = useState<{ [k: number]: { ball: number; izoh: string } }>({});
  const [tahrirlashYuklanyapti, setTahrirlashYuklanyapti] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const yuklash = async () => {
      setYuklanyapti(true);
      const jadval = tur === 'test' ? 'testlar' : 'toplamlar';
      const { data } = await supabase.from(jadval).select('*').eq('ustoz_id', ustozId).order('created_at', { ascending: false });
      setItems((data || []) as UstozTestRoyhat[]);
      setYuklanyapti(false);
    };
    yuklash();
  }, [ustozId, tur]);

  const natijalarniYuklash = async (item: UstozTestRoyhat) => {
    setTanlangan(item);
    setNatijalarYuklanyapti(true);
    try {
      if (tur === 'test') {
        const { data } = await supabase.from('test_javoblar').select('*').eq('test_kod', item.kod).order('togri_soni', { ascending: false });
        const arr = (data || []) as TestJavob[];
        arr.sort((a,b) => b.togri_soni - a.togri_soni || (a.sarflangan_vaqt??99999)-(b.sarflangan_vaqt??99999));
        setNatijalar(arr);
      } else {
        const { data } = await supabase.from('javoblar').select('*').eq('toplam_kod', item.kod).order('created_at', { ascending: true });
        const sorted = (data||[]).map(j=>({...j,_jami:(j.baho||[]).reduce((s:number,b:any)=>s+(b.ball||0),0)})).sort((a,b)=>b._jami-a._jami);
        setNatijalar(sorted);
      }
    } catch (e) {
      toast({ title: 'Xato', description: 'Natijalarni yuklashda xatolik', variant: 'destructive' });
    } finally { setNatijalarYuklanyapti(false); }
  };

  const kazusBahoSaqlash = async () => {
    if (!tanlanganKazusJavob) return;
    for (const ki in bahoData) {
      const d = bahoData[ki];
      if (d.ball < 0 || d.ball > 30) { toast({ title: 'Xato', description: `Ball 0-30`, variant: 'destructive' }); return; }
      if (!d.izoh.trim()) { toast({ title: 'Xato', description: 'Izoh majburiy', variant: 'destructive' }); return; }
    }
    setTahrirlashYuklanyapti(true);
    try {
      const yangiBaho = tanlanganKazusJavob.baho.map((b: any) => {
        const yd = bahoData[b.kazus_index];
        return yd ? { ...b, ball: yd.ball, izoh: yd.izoh } : b;
      });
      const { error } = await supabase.from('javoblar').update({ baho: yangiBaho }).eq('id', tanlanganKazusJavob.id);
      if (error) throw error;
      setNatijalar(prev => prev.map(j => j.id === tanlanganKazusJavob.id ? { ...j, baho: yangiBaho, _jami: yangiBaho.reduce((s:number,b:any)=>s+(b.ball||0),0) } : j).sort((a,b)=>b._jami-a._jami));
      toast({ title: 'Saqlandi!' });
      setTanlanganKazusJavob(null); setBahoData({});
    } catch (e) {
      toast({ title: 'Xato', variant: 'destructive' });
    } finally { setTahrirlashYuklanyapti(false); }
  };

  const openKazusTahrirlash = (javob: any) => {
    const data: { [k: number]: { ball: number; izoh: string } } = {};
    (javob.baho || []).forEach((b: any) => { data[b.kazus_index] = { ball: b.ball, izoh: b.izoh }; });
    setBahoData(data);
    setTanlanganKazusJavob(javob);
  };

  if (yuklanyapti) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  // Natijalar ko'rinishi
  if (tanlangan) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => { setTanlangan(null); setNatijalar([]); }}
          className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {tur === 'test' ? t('results.back_to_tests') : t('results.back_to_cases')}
        </button>

        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{tur === 'test' ? tanlangan.test_nomi : tanlangan.mavzu || 'Kazus'}</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Kod: <span className="font-mono font-bold">{tanlangan.kod}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${tanlangan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tanlangan.is_active ? '● Faol' : '○ To\'xtatilgan'}
                </span>
              </div>
            </div>
          </CardHeader>
        </Card>

        {natijalarYuklanyapti ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : natijalar.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Hali javob yo'q</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {/* Statistika */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border border-blue-200"><CardContent className="py-3 text-center">
                <p className="text-2xl font-black text-blue-600">{natijalar.length}</p>
                <p className="text-[10px] text-gray-400">Ishtirokchilar</p>
              </CardContent></Card>
              <Card className="border border-green-200"><CardContent className="py-3 text-center">
                {tur === 'test'
                  ? <><p className="text-2xl font-black text-green-600">{natijalar.filter((j:any)=>j.foiz>=60).length}</p><p className="text-[10px] text-gray-400">O'tdi (60%+)</p></>
                  : <><p className="text-2xl font-black text-green-600">{natijalar.length > 0 ? Math.round(natijalar.reduce((s:number,j:any)=>s+(j._jami||0),0)/natijalar.length) : 0}</p><p className="text-[10px] text-gray-400">O'rtacha ball</p></>
                }
              </CardContent></Card>
              <Card className="border border-yellow-200"><CardContent className="py-3 text-center">
                {tur === 'test'
                  ? <><p className="text-2xl font-black text-yellow-600">{natijalar.length>0?Math.round(natijalar.reduce((s:any,j:any)=>s+j.foiz,0)/natijalar.length):0}%</p><p className="text-[10px] text-gray-400">O'rtacha</p></>
                  : <><p className="text-2xl font-black text-yellow-600">{natijalar.length>0?Math.round(natijalar.reduce((s:number,j:any)=>s+((j._jami||0)/((j.baho?.length||1)*30)*100),0)/natijalar.length):0}%</p><p className="text-[10px] text-gray-400">O'rtacha %</p></>
                }
              </CardContent></Card>
            </div>

            {/* Jadval */}
            {tur === 'test' ? (
              <div className="space-y-2">
                {natijalar.map((javob: TestJavob, idx: number) => {
                  const rang = foizRang(javob.foiz);
                  return (
                    <Card key={javob.id} onClick={()=>setTanlanganTestJavob(javob)} className={`border-2 ${rang.border} cursor-pointer hover:shadow-md transition-all`}>
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-black text-xs text-gray-500">{idx+1}</span>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">{javob.oquvchi_ismi}</p>
                            <div className="flex items-center gap-3 text-[10px] text-gray-400">
                              <span className="text-green-600">✓{javob.togri_soni}</span>
                              <span className="text-red-600">✗{javob.xato_soni}</span>
                              {javob.sarflangan_vaqt&&javob.sarflangan_vaqt>0&&<span className="text-blue-600">{formatVaqt(javob.sarflangan_vaqt)}</span>}
                            </div>
                          </div>
                          <p className={`text-2xl font-black ${rang.text}`}>{javob.foiz}%</p>
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {natijalar.map((javob: any, idx: number) => {
                  const maks = (javob.baho||[]).length*30;
                  const foiz = maks>0?Math.round((javob._jami/maks)*100):0;
                  const rang = foizRang(foiz);
                  return (
                    <Card key={javob.id} onClick={()=>openKazusTahrirlash(javob)} className={`border-2 ${rang.border} cursor-pointer hover:shadow-md transition-all`}>
                      <CardContent className="py-3 px-5">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-black text-xs text-gray-500">{idx+1}</span>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">{javob.oquvchi_ismi}</p>
                            <p className="text-[10px] text-gray-400">{new Date(javob.created_at).toLocaleString('uz-UZ',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-2xl font-black ${rang.text}`}>{javob._jami}</span>
                            <span className="text-gray-300 text-xs">/{maks}</span>
                            <p className={`text-[10px] font-bold ${rang.text}`}>{foiz}%</p>
                          </div>
                          <Edit className="h-4 w-4 text-blue-400" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Test tafsilot modal */}
        {tanlanganTestJavob && (
          <TestJavobModal
            javob={tanlanganTestJavob}
            testNomi={tanlangan.test_nomi || 'Test'}
            savollar={tanlangan.savollar || []}
            onClose={()=>setTanlanganTestJavob(null)}
          />
        )}

        {/* Kazus baho tahrirlash */}
        {tanlanganKazusJavob && (
          <KazusTahrirlashModal
            javob={tanlanganKazusJavob}
            toplamKazuslar={tanlangan.kazuslar || []}
            bahoData={bahoData}
            onBahoChange={(ki,f,v)=>setBahoData(p=>({...p,[ki]:{...p[ki],[f]:f==='ball'?Number(v):v}}))}
            onSaqlash={kazusBahoSaqlash}
            onClose={()=>{setTanlanganKazusJavob(null);setBahoData({});}}
            yuklanyapti={tahrirlashYuklanyapti}
            onBatafsil={(tahlil,ball,maks)=>setTanlanganBatafsil({tahlil,ball,maksimalBall:maks})}
          />
        )}

        {/* AI batafsil */}
        {tanlanganBatafsil && (
          <JavobTahlil
            tahlil={tanlanganBatafsil.tahlil}
            ball={tanlanganBatafsil.ball}
            maksimalBall={tanlanganBatafsil.maksimalBall}
            onClose={()=>setTanlanganBatafsil(null)}
          />
        )}

        <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}`}</style>
      </div>
    );
  }

  // Ro'yxat
  if (items.length === 0) return (
    <Card className="border-2 border-dashed border-gray-200">
      <CardContent className="py-14 text-center">
        {tur === 'test' ? <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" /> : <BookOpen className="h-12 w-12 text-gray-200 mx-auto mb-3" />}
        <p className="text-gray-400 font-medium">{tur === 'test' ? t('results.no_test_created') : t('results.no_case_created')}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3 animate-fade-in">
      {items.map(item => {
        const nomi = tur === 'test' ? item.test_nomi : item.mavzu || 'Kazus';
        const soni = tur === 'test' ? (item.savollar?.length || 0) : (item.kazuslar?.length || 0);
        return (
          <Card
            key={item.id}
            onClick={() => natijalarniYuklash(item)}
            className={`border-2 cursor-pointer hover:shadow-md transition-all ${item.is_active ? 'border-green-300' : 'border-gray-200 hover:border-blue-300'}`}
          >
            <CardContent className="py-4 px-5">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tur === 'test' ? 'bg-green-100' : 'bg-purple-100'}`}>
                  {tur === 'test' ? <FileText className="h-5 w-5 text-green-600" /> : <BookOpen className="h-5 w-5 text-purple-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm truncate">{nomi}</p>
                    {item.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-green-100 text-green-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />FAOL
                      </span>
                    )}
                    {item.ommaviy && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-700">Ommaviy</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                    <span className="font-mono">#{item.kod}</span>
                    <span>{soni} ta {tur === 'test' ? 'savol' : 'kazus'}</span>
                    <span>{new Date(item.created_at).toLocaleDateString('uz-UZ')}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        );
      })}
      <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USTOZ ASOSIY PANEL
// ─────────────────────────────────────────────────────────────────────────────
function UstozPanel({ ustozId }: { ustozId: string }) {
  const [tab, setTab] = useState<UstozTabType>('kod');
  const { t } = useLang();

  const tabs: { key: UstozTabType; label: string; icon: React.ReactNode }[] = [
    { key: 'kod', label: t('results.by_code'), icon: <Search className="h-4 w-4" /> },
    { key: 'testlar', label: t('results.my_tests'), icon: <FileText className="h-4 w-4" /> },
    { key: 'kazuslar', label: t('results.my_cases'), icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Sarlavha */}
      <Card className="border-2 border-blue-500 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <h2 className="text-lg font-black flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> {t('results.rating')}
          </h2>
          <p className="text-blue-200 text-xs mt-1">{t('results.monitor_desc')}</p>
        </div>
      </Card>

      {/* Tablar */}
      <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.key
                ? 'bg-white shadow-md text-blue-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab kontenti */}
      {tab === 'kod' && <UstozKodMonitoring />}
      {tab === 'testlar' && <UstozTestlarRoyhat ustozId={ustozId} tur="test" />}
      {tab === 'kazuslar' && <UstozTestlarRoyhat ustozId={ustozId} tur="kazus" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN TALAB — REYTING
// ─────────────────────────────────────────────────────────────────────────────
function ReytingKirishTalab() {
  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <Card className="border-2 border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 bg-amber-100 border-2 border-amber-300 rounded-3xl flex items-center justify-center">
            <Trophy className="h-10 w-10 text-amber-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-amber-900">Natijalar va Reyting</h3>
            <p className="text-amber-700 font-medium mt-2">Natijalaringizni ko'rish uchun tizimga kiring</p>
            <p className="text-amber-600 text-sm mt-1">O'z natijalaringizni kuzatish uchun hisobingizga kiring</p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            Tizimga kirish
          </button>
        </CardContent>
      </Card>
      <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}`}</style>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unused() {
  const { t } = useLang();
  const [kod, setKod] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [faol, setFaol] = useState(false);
  const [kodTuri, setKodTuri] = useState<KodTuri>(null);
  const [toplamMavzu, setToplamMavzu] = useState('');
  const [toplamKazuslar, setToplamKazuslar] = useState<Kazus[]>([]);
  const [testSavollar, setTestSavollar] = useState<any[]>([]);
  const [javoblar, setJavoblar] = useState<Javob[]>([]);
  const [testJavoblar, setTestJavoblar] = useState<TestJavob[]>([]);
  const [oxirgiYangilanish, setOxirgiYangilanish] = useState<Date | null>(null);
  const [testOrinlar, setTestOrinlar] = useState<Map<string, number>>(new Map());
  const [tanlanganTestJavob, setTanlanganTestJavob] = useState<TestJavob | null>(null);
  const intervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const kodTuriniAniqla = async (k: string): Promise<KodTuri> => {
    const [tRes, tRes2] = await Promise.all([
      supabase.from('toplamlar').select('kod').eq('kod', k).maybeSingle(),
      supabase.from('testlar').select('kod').eq('kod', k).maybeSingle(),
    ]);
    if (tRes.data) return 'kazus';
    if (tRes2.data) return 'test';
    return null;
  };

  const yuklash = async (showLoading: boolean, tur: KodTuri, k: string) => {
    if (showLoading) setYuklanyapti(true);
    try {
      if (tur === 'kazus') {
        const { data: td } = await supabase.from('toplamlar').select('mavzu,kazuslar').eq('kod', k).single();
        const { data } = await supabase.from('javoblar').select('*').eq('toplam_kod', k).order('created_at', { ascending: true });
        const sorted = (data||[]).map(j=>({...j,_jami:(j.baho||[]).reduce((s:number,b:any)=>s+(b.ball||0),0)})).sort((a,b)=>b._jami-a._jami);
        setToplamMavzu(td?.mavzu||'Kazus'); setToplamKazuslar(td?.kazuslar||[]); setJavoblar(sorted as Javob[]);
      } else {
        const { data: td } = await supabase.from('testlar').select('test_nomi,savollar').eq('kod', k).single();
        const { data } = await supabase.from('test_javoblar').select('*').eq('test_kod', k).order('togri_soni',{ascending:false});
        const arr = (data||[]) as TestJavob[];
        arr.sort((a,b)=>b.togri_soni-a.togri_soni||(a.sarflangan_vaqt??99999)-(b.sarflangan_vaqt??99999));
        const map=new Map<string,number>(); arr.forEach((j,i)=>map.set(j.oquvchi_ismi,i+1));
        setToplamMavzu(td?.test_nomi||'Test'); setTestSavollar(td?.savollar||[]); setTestJavoblar(arr); setTestOrinlar(map);
      }
      setFaol(true); setOxirgiYangilanish(new Date());
    } catch(e){} finally { if(showLoading) setYuklanyapti(false); }
  };

  const boshlash = async () => {
    const k = kod.trim();
    if (k.length !== 5) { toast({title:'Xato',description:'5 raqamli kod kiriting',variant:'destructive'}); return; }
    setYuklanyapti(true);
    const tur = await kodTuriniAniqla(k);
    if (!tur) { toast({title:'Topilmadi',description:'Bu kod bilan test yoki kazus topilmadi',variant:'destructive'}); setYuklanyapti(false); return; }
    setKodTuri(tur);
    await yuklash(true, tur, k);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(()=>yuklash(false,tur,k), 5000);
  };

  const toxtash = () => {
    if(intervalRef.current){clearInterval(intervalRef.current);intervalRef.current=null;}
    setFaol(false);setKod('');setKodTuri(null);setJavoblar([]);setTestJavoblar([]);setToplamMavzu('');
  };

  if (!faol) return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <Card className="border-2 border-blue-400 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
          <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5"/>{t('results.rating')}</CardTitle>
          <p className="text-blue-200 text-xs mt-1">{t('results.by_code')}</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <Input placeholder="12345" value={kod} onChange={e=>setKod(e.target.value.replace(/\D/g,'').slice(0,5))} onKeyDown={e=>e.key==='Enter'&&kod.length===5&&boshlash()} maxLength={5} className="text-2xl font-black text-center tracking-widest h-14 border-2"/>
          <Button onClick={boshlash} disabled={yuklanyapti||kod.length!==5} className="w-full h-12 font-black">
            {yuklanyapti ? t('results.detecting') : t('results.start_monitoring')}
          </Button>
        </CardContent>
      </Card>
      <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}`}</style>
    </div>
  );

  const jami = kodTuri==='test'?testJavoblar.length:javoblar.length;

  return (
    <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
      <Card className="border-2 border-blue-400 shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${kodTuri==='test'?'bg-green-400/70':'bg-yellow-400/70'}`}>{kodTuri==='test'?'📝 TEST':'📋 KAZUS'}</span>
                <h2 className="text-base font-black">{toplamMavzu}</h2>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-200">
                <span className="font-mono font-bold">#{kod}</span>
                <span>{jami} javob</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {oxirgiYangilanish && <span className="text-xs text-blue-300">{oxirgiYangilanish.toLocaleTimeString('uz-UZ')}</span>}
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse"/>
              <Button onClick={toxtash} variant="secondary" size="sm">{t('results.stop')}</Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Reyting */}
      {kodTuri==='test'&&(
        testJavoblar.length===0?(
          <Card><CardContent className="py-12 text-center"><FileText className="h-12 w-12 text-gray-200 mx-auto mb-2 animate-pulse"/><p className="text-gray-400 text-sm">Hali javob yo'q...</p></CardContent></Card>
        ):(
          <div className="space-y-2">
            {testJavoblar.map((j,i)=>{const rang=foizRang(j.foiz);return(
              <Card key={j.id} onClick={()=>setTanlanganTestJavob(j)} className={`border-2 ${rang.border} cursor-pointer hover:shadow-md transition-all ${i===0?'bg-yellow-50':i===1?'bg-gray-50':i===2?'bg-orange-50':''}`}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center font-black text-sm">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                    <div className="flex-1 min-w-0"><p className="font-bold text-gray-900 text-sm truncate">{j.oquvchi_ismi}</p><div className="flex gap-2 text-[10px]"><span className="text-green-600">✓{j.togri_soni}</span><span className="text-red-600">✗{j.xato_soni}</span></div></div>
                    <p className={`text-2xl font-black ${rang.text}`}>{j.foiz}%</p>
                  </div>
                </CardContent>
              </Card>
            );})}
          </div>
        )
      )}

      {kodTuri==='kazus'&&(
        javoblar.length===0?(
          <Card><CardContent className="py-12 text-center"><Users className="h-12 w-12 text-gray-200 mx-auto mb-2 animate-pulse"/><p className="text-gray-400 text-sm">Hali javob yo'q...</p></CardContent></Card>
        ):(
          <div className="space-y-2">
            {javoblar.map((j:any,i)=>{const maks=(j.baho||[]).length*30;const foiz=maks>0?Math.round((j._jami/maks)*100):0;const rang=foizRang(foiz);return(
              <Card key={j.id} className={`border-2 ${rang.border} ${i===0?'bg-yellow-50':i===1?'bg-gray-50':i===2?'bg-orange-50':''}`}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white shadow flex items-center justify-center font-black text-sm">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
                    <div className="flex-1"><p className="font-bold text-gray-900 text-sm">{j.oquvchi_ismi}</p></div>
                    <div className="text-right"><span className={`text-2xl font-black ${rang.text}`}>{j._jami}</span><span className="text-gray-300 text-xs">/{maks}</span></div>
                  </div>
                </CardContent>
              </Card>
            );})}
          </div>
        )
      )}

      <div className="fixed bottom-6 right-6 bg-white rounded-full shadow-xl p-3 border-2 border-blue-400 z-30">
        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin"/>
      </div>

      {tanlanganTestJavob&&<TestJavobModal javob={tanlanganTestJavob} testNomi={toplamMavzu} savollar={testSavollar} onClose={()=>setTanlanganTestJavob(null)}/>}
      <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}}.animate-fade-in{animation:fade-in .3s ease-out}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ASOSIY EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function RealVaqtNatijalar() {
  const { user } = useAuth();

  // O'quvchi — shaxsiy natijalar
  if (user?.rol === 'oquvchi' && user.ism && user.familiya) {
    return <OquvchiNatijalar ism={user.ism} familiya={user.familiya} />;
  }

  // Ustoz — monitoring + o'z testlari
  if (user?.rol === 'ustoz' && user.ustoz_id) {
    return <UstozPanel ustozId={user.ustoz_id} />;
  }

  // Login qilinmagan — kod monitoring + reyting kirish talab
  return <ReytingKirishTalab />;
}
