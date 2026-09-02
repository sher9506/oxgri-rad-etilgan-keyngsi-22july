import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import {
  BarChart2, TrendingUp, AlertTriangle,
  BookOpen, FileText, ChevronRight, ChevronLeft, RefreshCw,
  Users, Target, Flame, Eye, Loader2, Trophy, Brain, BookMarked,
  Search, User, Star, GraduationCap,
  ArrowLeft, ChevronDown, ChevronUp, CheckCircle, XCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ─── Ranglar ───────────────────────────────────────────────────────────────
const PALETTE = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#14b8a6','#ec4899','#f97316','#6366f1','#84cc16',
];
const COLORS = { green: '#10b981', red: '#ef4444', blue: '#3b82f6', amber: '#f59e0b', purple: '#8b5cf6', gray: '#94a3b8' };

// ─── Custom Tooltip ─────────────────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-xl shadow-2xl border border-white/10 text-xs">
      <p className="font-bold mb-1 text-gray-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color }}>{p.name}: <span className="font-black">{p.value}</span></p>
      ))}
    </div>
  );
};

// ─── StatCard ──────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = 'blue', icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: any;
}) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
  };
  return (
    <div className={`border-2 rounded-2xl p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-4 w-4 opacity-70" />}
        <p className="text-xs font-bold opacity-70 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
};

// ─── Foiz indikator ─────────────────────────────────────────────────────
const FoizBar = ({ foiz, showLabel = true }: { foiz: number; showLabel?: boolean }) => {
  const color = foiz >= 85 ? '#10b981' : foiz >= 70 ? '#3b82f6' : foiz >= 50 ? '#f59e0b' : '#ef4444';
  const emoji = foiz >= 85 ? '🟢' : foiz >= 70 ? '🔵' : foiz >= 50 ? '⚠️' : '🔴';
  return (
    <div className="flex items-center gap-2">
      {showLabel && <span className="text-[10px]">{emoji}</span>}
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${foiz}%`, background: color }} />
      </div>
      {showLabel && <span className="text-xs font-black w-8 text-right" style={{ color }}>{foiz}%</span>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// O'QUVCHI SHAXSIY ANALITIKA (Profil sahifasi)
// ════════════════════════════════════════════════════════════════════════════
function OquvchiShaxsiyAnalitika({ oquvchiIsmi, onOrqaga }: { oquvchiIsmi: string; onOrqaga: () => void }) {
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [testJavoblar, setTestJavoblar] = useState<any[]>([]);
  const [kazusJavoblar, setKazusJavoblar] = useState<any[]>([]);
  const [materialKorishlar, setMaterialKorishlar] = useState<any[]>([]);
  const [testMap, setTestMap] = useState<Record<string, any>>({});
  const [toplamMap, setToplamMap] = useState<Record<string, any>>({});
  const [kengaytirigan, setKengaytirigan] = useState<string | null>(null);
  const [aktifTab, setAktifTab] = useState<'testlar' | 'kazuslar' | 'materiallar'>('testlar');

  useEffect(() => { yuklash(); }, [oquvchiIsmi]);

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const [tjRes, kjRes, krRes] = await Promise.all([
        supabase.from('test_javoblar').select('*').eq('oquvchi_ismi', oquvchiIsmi).order('created_at', { ascending: false }),
        supabase.from('javoblar').select('*').eq('oquvchi_ismi', oquvchiIsmi).order('created_at', { ascending: false }),
        supabase.from('om_korishlar').select('bolim_id, created_at').eq('oquvchi_ismi', oquvchiIsmi).order('created_at', { ascending: false }),
      ]);
      const tj = tjRes.data || [];
      const kj = kjRes.data || [];
      setTestJavoblar(tj);
      setKazusJavoblar(kj);
      if (tj.length > 0) {
        const testKodlar = [...new Set(tj.map((t: any) => t.test_kod))] as string[];
        const { data: tDB } = await supabase.from('testlar').select('kod, test_nomi, savollar').in('kod', testKodlar);
        const map: Record<string, any> = {};
        (tDB || []).forEach((t: any) => { map[t.kod] = t; });
        setTestMap(map);
      }
      if (kj.length > 0) {
        const kodlar = [...new Set(kj.map((j: any) => j.toplam_kod))] as string[];
        const { data: tDB2 } = await supabase.from('toplamlar').select('kod, mavzu, kazuslar').in('kod', kodlar);
        const map2: Record<string, any> = {};
        (tDB2 || []).forEach((t: any) => { map2[t.kod] = t; });
        setToplamMap(map2);
      }
      if ((krRes.data || []).length > 0) {
        const bolimIds = (krRes.data || []).map((k: any) => k.bolim_id);
        const { data: bolimlar } = await supabase.from('om_bolimlar').select('id, nomi').in('id', bolimIds);
        const bMap: Record<string, string> = {};
        (bolimlar || []).forEach((b: any) => { bMap[b.id] = b.nomi; });
        setMaterialKorishlar((krRes.data || []).map((k: any) => ({
          bolimId: k.bolim_id, bolimNomi: bMap[k.bolim_id] || "Noma'lum", sana: k.created_at,
        })));
      }
    } finally { setYuklanyapti(false); }
  };

  if (yuklanyapti) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
      <p className="text-gray-400 font-medium">Yuklanmoqda...</p>
    </div>
  );

  const avgFoiz = testJavoblar.length > 0
    ? Math.round(testJavoblar.reduce((s, j) => s + (j.foiz || 0), 0) / testJavoblar.length) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={onOrqaga} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> O'quvchilar ro'yxatiga qaytish
      </button>

      {/* Sarlavha */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-2xl">
            {oquvchiIsmi.split(' ')[0]?.[0]}{oquvchiIsmi.split(' ')[1]?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-black">{oquvchiIsmi}</h2>
            <p className="text-indigo-200 text-sm mt-0.5">{testJavoblar.length} test · {kazusJavoblar.length} kazus · {materialKorishlar.length} material</p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-black ${avgFoiz >= 70 ? 'text-green-300' : avgFoiz >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>{avgFoiz}%</p>
            <p className="text-indigo-200 text-xs">o'rtacha natija</p>
          </div>
        </div>
      </div>

      {/* Stat kartalar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Testlar" value={testJavoblar.length} icon={FileText} color="blue" />
        <StatCard label="Kazuslar" value={kazusJavoblar.length} icon={Brain} color="purple" />
        <StatCard label="Materiallar" value={materialKorishlar.length} icon={BookOpen} color="teal" />
      </div>

      {/* Tablar */}
      <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-xl">
        {[
          { id: 'testlar', label: 'Testlar', icon: FileText, cnt: testJavoblar.length, color: 'blue' },
          { id: 'kazuslar', label: 'Kazuslar', icon: Brain, cnt: kazusJavoblar.length, color: 'purple' },
          { id: 'materiallar', label: 'Materiallar', icon: BookOpen, cnt: materialKorishlar.length, color: 'teal' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setAktifTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${aktifTab === tab.id ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${aktifTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>{tab.cnt}</span>
          </button>
        ))}
      </div>

      {/* TESTLAR */}
      {aktifTab === 'testlar' && (
        <div className="space-y-3">
          {testJavoblar.length === 0 ? (
            <div className="text-center py-10 text-gray-400"><FileText className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>Hali test yechmagan</p></div>
          ) : testJavoblar.map((javob: any) => {
            const test = testMap[javob.test_kod];
            const isOpen = kengaytirigan === javob.id;
            const foizRang = javob.foiz >= 70 ? 'text-green-600 border-green-200 bg-green-50' : javob.foiz >= 50 ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-red-600 border-red-200 bg-red-50';
            return (
              <div key={javob.id} className={`border-2 rounded-xl overflow-hidden transition-all ${isOpen ? 'border-blue-300' : 'border-gray-200 hover:border-blue-200'}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setKengaytirigan(isOpen ? null : javob.id)}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 border-2 ${foizRang}`}>{javob.foiz}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">{test?.test_nomi || javob.test_kod}</p>
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                      <span className="text-green-600 font-bold">✓{javob.togri_soni}</span>
                      <span className="text-red-600 font-bold">✗{javob.xato_soni}</span>
                      <span>{new Date(javob.created_at).toLocaleDateString('uz-UZ')}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
                {isOpen && test?.savollar?.length > 0 && (
                  <div className="border-t border-gray-100 p-3 space-y-1.5 bg-gray-50">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Savollar tahlili:</p>
                    {test.savollar.map((savol: any, idx: number) => {
                      const oj = (javob.javoblar || []).find((j: any) => j.savol_index === idx);
                      const b = oj?.javob;
                      const togri = b !== undefined && b !== -1 && b === savol.togriJavob;
                      const berilgan = b !== undefined && b !== -1;
                      return (
                        <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${!berilgan ? 'bg-gray-100' : togri ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white font-black text-[9px] flex-shrink-0 ${!berilgan ? 'bg-gray-400' : togri ? 'bg-green-500' : 'bg-red-500'}`}>
                            {!berilgan ? '—' : togri ? '✓' : '✗'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-700 line-clamp-1">{idx + 1}. <span dangerouslySetInnerHTML={{ __html: savol.savol }} /></p>
                            {berilgan && !togri && <p className="text-green-700 text-[10px] mt-0.5">To'g'ri: {String.fromCharCode(65 + savol.togriJavob)}) <span dangerouslySetInnerHTML={{ __html: savol.variantlar?.[savol.togriJavob] || '' }} /></p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* KAZUSLAR */}
      {aktifTab === 'kazuslar' && (
        <div className="space-y-3">
          {kazusJavoblar.length === 0 ? (
            <div className="text-center py-10 text-gray-400"><Brain className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>Hali kazus yechmagan</p></div>
          ) : kazusJavoblar.map((javob: any) => {
            const toplam = toplamMap[javob.toplam_kod];
            const jami = (javob.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0);
            const maks = (javob.baho || []).length * 30;
            const foiz = maks > 0 ? Math.round((jami / maks) * 100) : 0;
            const isOpen = kengaytirigan === javob.id + '_k';
            return (
              <div key={javob.id} className={`border-2 rounded-xl overflow-hidden transition-all ${isOpen ? 'border-purple-300' : 'border-gray-200 hover:border-purple-200'}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50" onClick={() => setKengaytirigan(isOpen ? null : javob.id + '_k')}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 border-2 ${foiz >= 70 ? 'text-green-600 border-green-200 bg-green-50' : foiz >= 50 ? 'text-amber-600 border-amber-200 bg-amber-50' : 'text-red-600 border-red-200 bg-red-50'}`}>{foiz}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">{toplam?.mavzu || javob.toplam_kod}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      <span className="text-blue-600 font-bold">{jami}/{maks} ball</span>
                      <span>{new Date(javob.created_at).toLocaleDateString('uz-UZ')}</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
                {isOpen && (javob.baho || []).length > 0 && (
                  <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50">
                    {(javob.baho || []).map((baho: any, bi: number) => {
                      const kazus = toplam?.kazuslar?.[baho.kazus_index];
                      return (
                        <div key={bi} className="bg-white border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-purple-600">Kazus {baho.kazus_index + 1}</span>
                            <span className={`text-sm font-black ${baho.ball >= 21 ? 'text-green-600' : baho.ball >= 15 ? 'text-amber-600' : 'text-red-600'}`}>{baho.ball}/30</span>
                          </div>
                          {kazus && <p className="text-[10px] text-gray-500 line-clamp-2 mb-1">{kazus.kazus}</p>}
                          <p className="text-[10px] text-gray-500 italic">"{baho.izoh}"</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MATERIALLAR */}
      {aktifTab === 'materiallar' && (
        <div className="space-y-2">
          {materialKorishlar.length === 0 ? (
            <div className="text-center py-10 text-gray-400"><BookOpen className="h-12 w-12 mx-auto mb-2 opacity-30" /><p>Hali material ko'rmagan</p></div>
          ) : materialKorishlar.map((k: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white border-2 border-teal-100 hover:border-teal-300 rounded-xl transition-all">
              <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{k.bolimNomi}</p>
                <p className="text-[10px] text-gray-400">{new Date(k.sana).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <Eye className="h-4 w-4 text-teal-400 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TESTLAR TAB
// ════════════════════════════════════════════════════════════════════════════
function TestlarTab({ testlar, onTestTanla, onOquvchiTanla }: {
  testlar: any[]; onTestTanla: (t: any) => void; onOquvchiTanla: (ism: string) => void;
}) {
  const [tanlanganTest, setTanlanganTest] = useState<any | null>(null);
  const [javoblar, setJavoblar] = useState<any[]>([]);
  const [savolMa, setSavolMa] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [rosterOchiq, setRosterOchiq] = useState(false);
  const [tanlanganSavol, setTanlanganSavol] = useState<number | null>(null);

  const testniOch = async (test: any) => {
    setTanlanganTest(test);
    setYuklanyapti(true);
    setRosterOchiq(false);
    setSavolMa([]);
    try {
      const { data } = await supabase.from('test_javoblar').select('*').eq('test_kod', test.kod);
      const javoblarData = data || [];
      setJavoblar(javoblarData);
      const savollar = test.savollar || [];
      const ma = savollar.map((savol: any, idx: number) => {
        let togri = 0, xato = 0, javobBerilmagan = 0;
        javoblarData.forEach((j: any) => {
          const jArr = Array.isArray(j.javoblar) ? j.javoblar : [];
          const found = jArr.find((jj: any) => jj.savol_index === idx);
          if (!found || found.javob === undefined || found.javob === null || found.javob === -1) { javobBerilmagan++; }
          else if (Number(found.javob) === Number(savol.togriJavob)) { togri++; }
          else { xato++; }
        });
        const jami2 = javoblarData.length;
        const togriForiz = jami2 > 0 ? Math.round((togri / jami2) * 100) : 0;
        return {
          idx, savol: savol.savol?.length > 45 ? savol.savol.slice(0, 45) + '…' : savol.savol,
          savol_full: savol.savol, togri, xato, javobBerilmagan, togriForiz,
          xatoForiz: jami2 > 0 ? Math.round((xato / jami2) * 100) : 0, jami: jami2,
          variantlar: savol.variantlar || [], togriJavob: savol.togriJavob,
          qiyinlik: togriForiz < 40 ? 'qiyin' : togriForiz < 70 ? "o'rtacha" : 'oson',
        };
      });
      setSavolMa(ma);
    } finally { setYuklanyapti(false); }
  };

  // Testlar ro'yxati
  if (!tanlanganTest) {
    return (
      <div className="space-y-3">
        {testlar.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <FileText className="h-16 w-16 mx-auto mb-3 opacity-30" />
            <p>Hali testlar yaratilmagan</p>
          </div>
        ) : testlar.map((test) => (
          <div key={test.id}
            className="bg-white border-2 border-gray-100 hover:border-blue-300 rounded-2xl p-4 cursor-pointer transition-all group hover:shadow-md"
            onClick={() => testniOch(test)}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                (test.ortacha_foiz || 0) >= 70 ? 'bg-green-100 text-green-700' : (test.ortacha_foiz || 0) >= 50 ? 'bg-amber-100 text-amber-700' : test.javoblar_soni > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>{test.ortacha_foiz > 0 ? `${test.ortacha_foiz}%` : '—'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors truncate">{test.test_nomi}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[10px] font-mono text-gray-400">#{test.kod}</span>
                  <span className="text-[10px] text-gray-500">{test.savollar?.length || 0} savol</span>
                  <span className="text-[10px] font-bold text-blue-600">{test.javoblar_soni || 0} qatnashuvchi</span>
                </div>
                {(test.ortacha_foiz || 0) > 0 && <FoizBar foiz={test.ortacha_foiz} />}
              </div>
              <div className="p-2 bg-blue-50 group-hover:bg-blue-100 rounded-xl transition-all">
                <BarChart2 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Test ichki sahifa
  if (yuklanyapti) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
      <p className="text-gray-400">Tahlil hisoblanmoqda...</p>
    </div>
  );

  const rosterJadval = [...javoblar].sort((a, b) => b.foiz - a.foiz);
  const qiyinlarTop3 = [...savolMa].sort((a, b) => a.togriForiz - b.togriForiz).slice(0, 3);
  const pieData = [
    { name: "To'g'ri", value: savolMa.reduce((s, m) => s + m.togri, 0) },
    { name: "Xato", value: savolMa.reduce((s, m) => s + m.xato, 0) },
    { name: "Javobsiz", value: savolMa.reduce((s, m) => s + m.javobBerilmagan, 0) },
  ];
  const ortachaFoiz = javoblar.length > 0 ? Math.round(javoblar.reduce((s, j) => s + (j.foiz || 0), 0) / javoblar.length) : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={() => setTanlanganTest(null)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-blue-600 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Testlar ro'yxatiga qaytish
      </button>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-black mb-1">{tanlanganTest.test_nomi}</h2>
        <div className="flex flex-wrap gap-3 text-sm text-blue-100">
          <span>Kod: <strong className="text-white">{tanlanganTest.kod}</strong></span>
          <span>{tanlanganTest.savollar?.length || 0} ta savol</span>
          <span>{javoblar.length} ta qatnashuvchi</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Qatnashuvchi" value={javoblar.length} icon={Users} color="blue" />
        <StatCard label="O'rtacha foiz" value={`${ortachaFoiz}%`} icon={Target} color="green" />
        <StatCard label="Savollar" value={tanlanganTest.savollar?.length || 0} icon={FileText} color="purple" />
        <StatCard label="Eng qiyin" value={qiyinlarTop3[0] ? `S${qiyinlarTop3[0].idx + 1}` : '—'}
          sub={qiyinlarTop3[0] ? `${qiyinlarTop3[0].togriForiz}%` : ''} icon={Flame} color="red" />
      </div>

      {/* STUDENT ROSTER — o'quvchilar bosilsa profil ochiladi */}
      <div className="bg-white border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => setRosterOchiq(v => !v)}>
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-xl"><Users className="h-4 w-4 text-indigo-600" /></div>
            <div>
              <h3 className="font-black text-gray-800 text-sm">O'quvchilar ro'yxati</h3>
              <p className="text-[10px] text-gray-400">Ismga bosing — shaxsiy analitikani ko'ring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{rosterJadval.length} ta</span>
            {rosterOchiq ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
        {rosterOchiq && (
          <div className="border-t border-indigo-100">
            {rosterJadval.map((j: any, idx: number) => (
              <div key={j.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 border-b border-indigo-50 last:border-0 transition-all cursor-pointer group"
                onClick={() => onOquvchiTanla(j.oquvchi_ismi)}>
                <span className="w-6 text-center font-black text-xs text-gray-400">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 group-hover:text-indigo-700 transition-colors">{j.oquvchi_ismi}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span className="text-green-600">✓{j.togri_soni}</span>
                    <span className="text-red-600">✗{j.xato_soni}</span>
                  </div>
                </div>
                <div className={`text-sm font-black px-2 py-0.5 rounded-lg ${j.foiz >= 70 ? 'text-green-600 bg-green-50' : j.foiz >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>
                  {j.foiz}%
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-indigo-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pie Chart */}
      {savolMa.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4 text-sm uppercase tracking-wider">Umumiy javoblar taqsimoti</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={[COLORS.green, COLORS.red, COLORS.gray][i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 grid grid-cols-1 gap-2">
              {pieData.map((p, i) => {
                const colors = [COLORS.green, COLORS.red, COLORS.gray];
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border"
                    style={{ borderColor: colors[i] + '40', background: colors[i] + '10' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: colors[i] }} />
                      <span className="font-bold text-sm text-gray-700">{p.name}</span>
                    </div>
                    <span className="font-black text-lg" style={{ color: colors[i] }}>{p.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Qiyin savollar */}
      {qiyinlarTop3.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-5 w-5 text-red-600" />
            <h3 className="font-black text-red-800 text-sm">Eng qiyin savollar</h3>
          </div>
          <div className="space-y-2">
            {qiyinlarTop3.map((s, i) => (
              <div key={i} className="bg-white border border-red-100 rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-black text-red-600">Savol {s.idx + 1}</span>
                  <span className="text-sm font-black text-red-700">{s.togriForiz}%</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">{s.savol_full}</p>
                <FoizBar foiz={s.togriForiz} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Savollar batafsil */}
      {savolMa.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4 text-sm uppercase tracking-wider">Savollar tahlili</h3>
          <div className="space-y-2">
            {savolMa.map((s) => (
              <div key={s.idx}
                className={`border-2 rounded-xl cursor-pointer transition-all hover:border-blue-300 ${tanlanganSavol === s.idx ? 'border-blue-400' : 'border-gray-100'}`}
                onClick={() => setTanlanganSavol(tanlanganSavol === s.idx ? null : s.idx)}>
                <div className="flex items-center gap-3 p-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                    s.qiyinlik === 'qiyin' ? 'bg-red-100 text-red-700' : s.qiyinlik === "o'rtacha" ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>{s.idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{s.savol}</p>
                    <FoizBar foiz={s.togriForiz} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] font-bold bg-green-50 text-green-700 px-1.5 py-0.5 rounded">✓{s.togri}</span>
                    <span className="text-[10px] font-bold bg-red-50 text-red-700 px-1.5 py-0.5 rounded">✗{s.xato}</span>
                  </div>
                </div>
                {tanlanganSavol === s.idx && (
                  <div className="px-3 pb-3 border-t border-gray-50">
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-xl p-3 mt-2 mb-2 leading-relaxed">{s.savol_full}</p>
                    <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">To'g'ri javob:</p>
                    <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-xl p-2 font-semibold">
                      {String.fromCharCode(65 + Number(s.togriJavob))}) {s.variantlar[s.togriJavob]}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// KAZUSLAR TAB
// ════════════════════════════════════════════════════════════════════════════
function KazuslarTab({ toplamlar, onOquvchiTanla }: { toplamlar: any[]; onOquvchiTanla: (ism: string) => void }) {
  const [tanlanganToplam, setTanlanganToplam] = useState<any | null>(null);
  const [javoblar, setJavoblar] = useState<any[]>([]);
  const [kazusMa, setKazusMa] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [rosterOchiq, setRosterOchiq] = useState(false);

  const toplamniOch = async (toplam: any) => {
    setTanlanganToplam(toplam);
    setYuklanyapti(true);
    setRosterOchiq(false);
    try {
      const { data } = await supabase.from('javoblar').select('*').eq('toplam_kod', toplam.kod).not('baho', 'is', null);
      const allJavoblar = data || [];
      setJavoblar(allJavoblar);
      const kazuslar = toplam.kazuslar || [];
      const ma = kazuslar.slice(0, 10).map((kazus: any, idx: number) => {
        const bahoArr: any[] = [];
        allJavoblar.forEach(j => {
          const b = Array.isArray(j.baho) ? j.baho.find((bb: any) => bb.kazus_index === idx) : null;
          if (b) bahoArr.push(b);
        });
        if (!bahoArr.length) return null;
        const avgBall = Math.round(bahoArr.reduce((s, b) => s + (b.ball || 0), 0) / bahoArr.length);
        const yetishMap: Record<string, number> = {};
        allJavoblar.forEach(j => {
          const b = Array.isArray(j.baho) ? j.baho.find((bb: any) => bb.kazus_index === idx) : null;
          const yetish = b?.batafsil_tahlil?.yetishmayotganlar || [];
          yetish.forEach((el: string) => {
            const k = el.replace(/"/g, '').trim();
            yetishMap[k] = (yetishMap[k] || 0) + 1;
          });
        });
        const yetishSorted = Object.entries(yetishMap).sort(([, a], [, b]) => b - a).slice(0, 6)
          .map(([text, count]) => ({ text, count, foiz: Math.round((count / allJavoblar.length) * 100) }));
        const ballTaqsimot = [
          { range: '0-10', count: bahoArr.filter(b => b.ball <= 10).length },
          { range: '11-15', count: bahoArr.filter(b => b.ball > 10 && b.ball <= 15).length },
          { range: '16-20', count: bahoArr.filter(b => b.ball > 15 && b.ball <= 20).length },
          { range: '21-25', count: bahoArr.filter(b => b.ball > 20 && b.ball <= 25).length },
          { range: '26-30', count: bahoArr.filter(b => b.ball > 25).length },
        ];
        return { idx, kazus_full: kazus.kazus, totalResponses: bahoArr.length, avgBall, yetishSorted, ballTaqsimot };
      }).filter(Boolean);
      setKazusMa(ma);
    } finally { setYuklanyapti(false); }
  };

  if (!tanlanganToplam) {
    return (
      <div className="space-y-3">
        {toplamlar.length === 0 ? (
          <div className="py-16 text-center text-gray-400"><Brain className="h-16 w-16 mx-auto mb-3 opacity-30" /><p>Hali kazus toplamlar yo'q</p></div>
        ) : toplamlar.map((toplam) => (
          <div key={toplam.id}
            className="bg-white border-2 border-gray-100 hover:border-purple-300 rounded-2xl p-4 cursor-pointer transition-all group hover:shadow-md"
            onClick={() => toplamniOch(toplam)}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                (toplam.ortacha_foiz || 0) >= 70 ? 'bg-green-100 text-green-700' : (toplam.ortacha_foiz || 0) >= 50 ? 'bg-amber-100 text-amber-700' : toplam.javoblar_soni > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
              }`}>{toplam.ortacha_foiz > 0 ? `${toplam.ortacha_foiz}%` : '—'}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 group-hover:text-purple-700 transition-colors truncate">{toplam.mavzu || "Kazus to'plami"}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-gray-400">#{toplam.kod}</span>
                  <span className="text-[10px] text-gray-500">{toplam.kazuslar?.length || 0} kazus</span>
                  <span className="text-[10px] font-bold text-purple-600">{toplam.javoblar_soni || 0} javob</span>
                </div>
                {(toplam.ortacha_foiz || 0) > 0 && <FoizBar foiz={toplam.ortacha_foiz} />}
              </div>
              <div className="p-2 bg-purple-50 group-hover:bg-purple-100 rounded-xl transition-all">
                <Brain className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (yuklanyapti) return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-3" />
      <p className="text-gray-400">Tahlil hisoblanmoqda...</p>
    </div>
  );

  const rosterJadval = [...javoblar].map(j => {
    const jami = (j.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0);
    const maks = (j.baho || []).length * 30;
    return { ...j, jami, maks, foiz: maks > 0 ? Math.round((jami / maks) * 100) : 0 };
  }).sort((a, b) => b.foiz - a.foiz);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <button onClick={() => setTanlanganToplam(null)} className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-purple-600 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Kazuslar ro'yxatiga qaytish
      </button>

      <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-2xl p-5 text-white">
        <h2 className="text-xl font-black mb-1">{tanlanganToplam.mavzu || "Kazus to'plami"}</h2>
        <div className="flex flex-wrap gap-3 text-sm text-purple-100">
          <span>Kod: <strong className="text-white">{tanlanganToplam.kod}</strong></span>
          <span>{tanlanganToplam.kazuslar?.length || 0} ta kazus</span>
          <span>{javoblar.length} ta javob</span>
        </div>
      </div>

      {/* STUDENT ROSTER */}
      <div className="bg-white border-2 border-purple-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-purple-50 transition-colors" onClick={() => setRosterOchiq(v => !v)}>
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-xl"><Users className="h-4 w-4 text-purple-600" /></div>
            <div>
              <h3 className="font-black text-gray-800 text-sm">O'quvchilar ro'yxati</h3>
              <p className="text-[10px] text-gray-400">Ismga bosing — shaxsiy analitikani ko'ring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{rosterJadval.length} ta</span>
            {rosterOchiq ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
        {rosterOchiq && (
          <div className="border-t border-purple-100">
            {rosterJadval.map((j: any, idx: number) => (
              <div key={j.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-50 border-b border-purple-50 last:border-0 cursor-pointer group transition-all"
                onClick={() => onOquvchiTanla(j.oquvchi_ismi)}>
                <span className="w-6 text-center font-black text-xs text-gray-400">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 group-hover:text-purple-700 transition-colors">{j.oquvchi_ismi}</p>
                  <p className="text-[10px] text-gray-400">{j.jami}/{j.maks} ball</p>
                </div>
                <span className={`text-sm font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${j.foiz >= 70 ? 'text-green-600 bg-green-50' : j.foiz >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'}`}>{j.foiz}%</span>
                <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-purple-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {kazusMa.map((km) => (
        <div key={km.idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="border-l-4 border-purple-500 pl-4">
            <p className="text-xs font-black text-purple-600 uppercase tracking-wider mb-1">Kazus {km.idx + 1}</p>
            <p className="text-sm text-gray-700 font-medium leading-relaxed line-clamp-3">{km.kazus_full}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-blue-700">{km.avgBall}<span className="text-xs text-gray-400"> / 30</span></p>
              <p className="text-xs text-blue-500 font-bold mt-0.5">O'rtacha ball</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-black text-purple-700">{km.totalResponses}</p>
              <p className="text-xs text-purple-500 font-bold mt-0.5">Javoblar</p>
            </div>
          </div>
          {km.ballTaqsimot && (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={km.ballTaqsimot} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" name="O'quvchilar" radius={[4, 4, 0, 0]}>
                  {km.ballTaqsimot.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          {km.yetishSorted?.length > 0 && (
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">⚠️ E'tibordan chetda qolgan elementlar</p>
              <div className="space-y-1.5">
                {km.yetishSorted.map((item: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-gray-700 truncate max-w-[70%]">{item.text}</p>
                        <span className="text-xs font-black text-gray-600">{item.foiz}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${item.foiz}%`, background: PALETTE[i % PALETTE.length] }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 font-bold flex-shrink-0">{item.count} ta</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MATERIALLAR TAB — Ko'ruvchi o'quvchilar + profil o'tish
// ════════════════════════════════════════════════════════════════════════════
function MateriallarTab({ materiallar, onOquvchiTanla }: { materiallar: any[]; onOquvchiTanla: (ism: string) => void }) {
  const [ochiqBolim, setOchiqBolim] = useState<string | null>(null);

  if (materiallar.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <BookOpen className="h-16 w-16 mx-auto mb-3 opacity-30" />
        <p>Hali o'quv materiallar yo'q</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {materiallar.map((m: any, i: number) => {
        const isOpen = ochiqBolim === m.bolim_id;
        const korishlarSoni = m.korish_soni || 0;
        const signal = korishlarSoni >= 10 ? '🔥' : korishlarSoni >= 5 ? '🟢' : korishlarSoni > 0 ? '⚠️' : '⚪';

        return (
          <div key={m.bolim_id} className={`border-2 rounded-2xl overflow-hidden transition-all ${isOpen ? 'border-teal-300 shadow-md' : 'border-gray-100 hover:border-teal-200'}`}>
            {/* Material sarlavha */}
            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-teal-50 transition-colors bg-white"
              onClick={() => setOchiqBolim(isOpen ? null : m.bolim_id)}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                style={{ background: PALETTE[i % PALETTE.length] + '20', color: PALETTE[i % PALETTE.length] }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{m.bolim_nomi}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.faol ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.faol ? 'Faol' : 'Yashirin'}</span>
                  <span className="text-[10px] text-gray-400">{m.bob_soni} bob · {m.material_soni} material</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0 mr-2">
                <p className="text-xl font-black" style={{ color: PALETTE[i % PALETTE.length] }}>{korishlarSoni} {signal}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">ko'rish</p>
              </div>
              {m.korilgan_oquvchilar?.length > 0 ? (
                isOpen ? <ChevronUp className="h-4 w-4 text-teal-500 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-300 flex-shrink-0" />
              ) : <div className="w-4" />}
            </div>

            {/* Ko'rgan o'quvchilar — bosilsa profilga o'tish */}
            {isOpen && m.korilgan_oquvchilar?.length > 0 && (
              <div className="border-t border-teal-100 bg-teal-50/30">
                <div className="px-4 py-2 border-b border-teal-100">
                  <p className="text-[10px] font-black text-teal-700 uppercase tracking-wider">
                    👥 Ko'rgan o'quvchilar ({m.korilgan_oquvchilar.length} ta) — profilni ko'rish uchun bosing
                  </p>
                </div>
                <div className="divide-y divide-teal-50">
                  {m.korilgan_oquvchilar.map((oq: string, oi: number) => (
                    <div key={oi}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-teal-100 cursor-pointer group transition-all"
                      onClick={() => onOquvchiTanla(oq)}>
                      <div className="w-7 h-7 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 font-black text-xs flex-shrink-0">
                        {oq[0]}
                      </div>
                      <p className="flex-1 font-semibold text-sm text-gray-800 group-hover:text-teal-700 transition-colors">{oq}</p>
                      <div className="flex items-center gap-1 text-teal-400 group-hover:text-teal-600 transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isOpen && (!m.korilgan_oquvchilar || m.korilgan_oquvchilar.length === 0) && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 text-center">
                <p className="text-xs text-gray-400">Hali hech kim ko'rmagan</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// O'QUVCHILAR ANALITIKA RO'YHAT
// ════════════════════════════════════════════════════════════════════════════
function OquvchilarTab({ onOquvchiTanla }: { onOquvchiTanla: (ism: string) => void }) {
  const [qidiruv, setQidiruv] = useState('');
  const [oquvchilar, setOquvchilar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);

  useEffect(() => { yuklash(); }, []);

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const [tjRes, kjRes] = await Promise.all([
        supabase.from('test_javoblar').select('oquvchi_ismi, foiz, created_at'),
        supabase.from('javoblar').select('oquvchi_ismi, baho'),
      ]);
      const studentMap: Record<string, { testSoni: number; avgFoiz: number; kazusSoni: number; foizlar: number[] }> = {};
      (tjRes.data || []).forEach((j: any) => {
        if (!j.oquvchi_ismi) return;
        if (!studentMap[j.oquvchi_ismi]) studentMap[j.oquvchi_ismi] = { testSoni: 0, avgFoiz: 0, kazusSoni: 0, foizlar: [] };
        studentMap[j.oquvchi_ismi].testSoni++;
        studentMap[j.oquvchi_ismi].foizlar.push(j.foiz || 0);
      });
      (kjRes.data || []).forEach((j: any) => {
        if (!j.oquvchi_ismi) return;
        if (!studentMap[j.oquvchi_ismi]) studentMap[j.oquvchi_ismi] = { testSoni: 0, avgFoiz: 0, kazusSoni: 0, foizlar: [] };
        studentMap[j.oquvchi_ismi].kazusSoni++;
      });
      const list = Object.entries(studentMap).map(([ism, d]) => ({
        ism, testSoni: d.testSoni, kazusSoni: d.kazusSoni,
        avgFoiz: d.foizlar.length > 0 ? Math.round(d.foizlar.reduce((a, b) => a + b, 0) / d.foizlar.length) : 0,
      })).sort((a, b) => b.avgFoiz - a.avgFoiz);
      setOquvchilar(list);
    } finally { setYuklanyapti(false); }
  };

  const filtered = oquvchilar.filter(o => o.ism.toLowerCase().includes(qidiruv.toLowerCase()));

  return (
    <div className="space-y-4">
      {/* Qidiruv */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input placeholder="O'quvchi ismi bo'yicha qidirish..."
          value={qidiruv} onChange={e => setQidiruv(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 focus:border-blue-400 rounded-xl text-sm outline-none transition-colors" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Jami o'quvchi" value={oquvchilar.length} icon={Users} color="blue" />
        <StatCard label="A'lo (85%+)" value={oquvchilar.filter(o => o.avgFoiz >= 85).length} icon={Star} color="green" />
        <StatCard label="Past (<50%)" value={oquvchilar.filter(o => o.avgFoiz < 50 && o.testSoni > 0).length} icon={AlertTriangle} color="red" />
      </div>

      {yuklanyapti ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><User className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>O'quvchi topilmadi</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((oq, idx) => {
            const foizRang = oq.avgFoiz >= 70 ? 'text-green-600 bg-green-50 border-green-200' :
              oq.avgFoiz >= 50 ? 'text-amber-600 bg-amber-50 border-amber-200' :
              oq.testSoni > 0 ? 'text-red-600 bg-red-50 border-red-200' : 'text-gray-500 bg-gray-50 border-gray-200';
            return (
              <div key={oq.ism} onClick={() => onOquvchiTanla(oq.ism)}
                className="flex items-center gap-3 p-3 bg-white border-2 border-gray-100 hover:border-blue-300 rounded-xl cursor-pointer transition-all hover:shadow-md group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 border ${foizRang}`}>
                  {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : <User className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm group-hover:text-blue-700 transition-colors">{oq.ism}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                    <span className="text-blue-600 font-bold">📝 {oq.testSoni}</span>
                    <span className="text-purple-600 font-bold">📋 {oq.kazusSoni}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {oq.testSoni > 0 && <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${foizRang}`}>{oq.avgFoiz}%</span>}
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ASOSIY ANALITIKA PANELI
// ════════════════════════════════════════════════════════════════════════════
export default function Analitika() {
  // 3 tab: testlar | kazuslar | materiallar (o'quvchilar alohida sohib)
  const [aktifTab, setAktifTab] = useState<'testlar' | 'kazuslar' | 'materiallar'>('testlar');
  const [testlar, setTestlar] = useState<any[]>([]);
  const [toplamlar, setToplamlar] = useState<any[]>([]);
  const [materiallar, setMateriallar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [tanlanganOquvchi, setTanlanganOquvchi] = useState<string | null>(null);
  const [umumiyStats, setUmumiyStats] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [xatolarTop3, setXatolarTop3] = useState<any[]>([]);

  useEffect(() => { yuklash(); }, []);

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const [testRes, toplamRes, matRes, testJavRes, kazusJavRes, korishRes] = await Promise.all([
        supabase.from('testlar').select('id,kod,test_nomi,savollar,vaqt_daqiqa,ustoz_ismi,created_at').order('created_at', { ascending: false }),
        supabase.from('toplamlar').select('id,kod,mavzu,kazuslar,vaqt_daqiqa,ustoz_ismi,created_at').order('created_at', { ascending: false }),
        supabase.from('om_bolimlar').select('id,nomi,faol,created_at').order('created_at', { ascending: false }),
        supabase.from('test_javoblar').select('test_kod,foiz,togri_soni,javoblar,created_at').order('created_at', { ascending: false }),
        supabase.from('javoblar').select('toplam_kod,created_at,baho').order('created_at', { ascending: false }),
        supabase.from('om_korishlar').select('bolim_id,oquvchi_ismi,created_at'),
      ]);

      const testlarData = testRes.data || [];
      const toplamlarData = toplamRes.data || [];
      const matData = matRes.data || [];
      const testJavData = testJavRes.data || [];
      const kazusJavData = kazusJavRes.data || [];
      const korishData = korishRes.data || [];

      // Test javob map
      const testJavMap: Record<string, number> = {};
      const testFoizMap: Record<string, number[]> = {};
      testJavData.forEach((j: any) => {
        testJavMap[j.test_kod] = (testJavMap[j.test_kod] || 0) + 1;
        if (!testFoizMap[j.test_kod]) testFoizMap[j.test_kod] = [];
        testFoizMap[j.test_kod].push(j.foiz || 0);
      });

      const kazusJavMap: Record<string, number> = {};
      kazusJavData.forEach((j: any) => { kazusJavMap[j.toplam_kod] = (kazusJavMap[j.toplam_kod] || 0) + 1; });

      const korishMap: Record<string, { soni: number; oquvchilar: string[] }> = {};
      korishData.forEach((k: any) => {
        if (!korishMap[k.bolim_id]) korishMap[k.bolim_id] = { soni: 0, oquvchilar: [] };
        korishMap[k.bolim_id].soni++;
        if (k.oquvchi_ismi && !korishMap[k.bolim_id].oquvchilar.includes(k.oquvchi_ismi)) {
          korishMap[k.bolim_id].oquvchilar.push(k.oquvchi_ismi);
        }
      });

      const enrichedTests = testlarData.map((t: any) => ({
        ...t,
        javoblar_soni: testJavMap[t.kod] || 0,
        ortacha_foiz: testFoizMap[t.kod]?.length
          ? Math.round(testFoizMap[t.kod].reduce((a, b) => a + b, 0) / testFoizMap[t.kod].length)
          : 0,
      }));

      const enrichedToplamlar = toplamlarData.map((t: any) => ({ ...t, javoblar_soni: kazusJavMap[t.kod] || 0 }));

      const enrichedMat = matData.map((m: any) => ({
        ...m,
        korish_soni: korishMap[m.id]?.soni || 0,
        korilgan_oquvchilar: korishMap[m.id]?.oquvchilar || [],
        bob_soni: 0,
        material_soni: 0,
      })).sort((a: any, b: any) => b.korish_soni - a.korish_soni);

      setTestlar(enrichedTests);
      setToplamlar(enrichedToplamlar);
      setMateriallar(enrichedMat);

      // Xato savollar top3
      const savolXatoMap: Record<string, { savol: string; xatoSoni: number; jami: number; testNomi: string }> = {};
      testlarData.forEach((test: any) => {
        const savollar = test.savollar || [];
        const javoblarBuTest = testJavData.filter((j: any) => j.test_kod === test.kod);
        savollar.forEach((savol: any, idx: number) => {
          let xato = 0;
          javoblarBuTest.forEach((j: any) => {
            const jArr = Array.isArray(j.javoblar) ? j.javoblar : [];
            const found = jArr.find((jj: any) => jj.savol_index === idx);
            if (found && found.javob !== -1 && Number(found.javob) !== Number(savol.togriJavob)) xato++;
          });
          if (javoblarBuTest.length > 0) {
            savolXatoMap[`${test.kod}_${idx}`] = { savol: savol.savol?.slice(0, 80) || '', xatoSoni: xato, jami: javoblarBuTest.length, testNomi: test.test_nomi };
          }
        });
      });
      const top3 = Object.values(savolXatoMap).filter(s => s.jami > 0)
        .sort((a, b) => (b.xatoSoni / b.jami) - (a.xatoSoni / a.jami)).slice(0, 3)
        .map(s => ({ ...s, xatoFoiz: Math.round((s.xatoSoni / s.jami) * 100) }));
      setXatolarTop3(top3);

      setUmumiyStats({
        jami_testlar: testlarData.length, jami_toplamlar: toplamlarData.length,
        jami_materiallar: matData.length, jami_test_javoblar: testJavData.length,
        jami_kazus_javoblar: kazusJavData.length, jami_korishlar: korishData.length,
      });

      const trendMap: Record<string, { sana: string; testlar: number; kazuslar: number }> = {};
      const bugun = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(bugun); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        trendMap[key] = { sana: key.slice(5), testlar: 0, kazuslar: 0 };
      }
      testJavData.forEach((j: any) => { const key = j.created_at?.split('T')[0]; if (trendMap[key]) trendMap[key].testlar++; });
      kazusJavData.forEach((j: any) => { const key = j.created_at?.split('T')[0]; if (trendMap[key]) trendMap[key].kazuslar++; });
      setTrendData(Object.values(trendMap));
    } finally { setYuklanyapti(false); }
  }, []);

  // O'quvchi profil sahifasi
  if (tanlanganOquvchi) return (
    <div className="max-w-5xl mx-auto p-1">
      <OquvchiShaxsiyAnalitika oquvchiIsmi={tanlanganOquvchi} onOrqaga={() => setTanlanganOquvchi(null)} />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-in fade-in duration-300">

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-xl border border-white/20"><BarChart2 className="h-7 w-7 text-blue-400" /></div>
            <div>
              <h1 className="text-2xl font-black">Analitika Markazi</h1>
              <p className="text-slate-400 text-sm mt-0.5">Test, Kazus va Materiallar chuqur tahlili</p>
            </div>
          </div>
          <button onClick={yuklash} disabled={yuklanyapti}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold transition-all">
            <RefreshCw className={`h-4 w-4 ${yuklanyapti ? 'animate-spin' : ''}`} /> Yangilash
          </button>
        </div>
      </div>

      {/* Umumiy statistika */}
      {umumiyStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Jami testlar" value={umumiyStats.jami_testlar} icon={FileText} color="blue" />
          <StatCard label="Test yechildi" value={umumiyStats.jami_test_javoblar} icon={Users} color="green" />
          <StatCard label="Kazus yechildi" value={umumiyStats.jami_kazus_javoblar} icon={Brain} color="purple" />
          <StatCard label="Material ko'rishlar" value={umumiyStats.jami_korishlar} icon={Eye} color="teal" />
          <StatCard label="O'quv materiallari" value={umumiyStats.jami_materiallar} icon={BookMarked} color="amber" />
          <StatCard label="Kazus toplamlar" value={umumiyStats.jami_toplamlar} icon={Target} color="blue" />
        </div>
      )}

      {/* Trend grafik */}
      {trendData.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 className="font-black text-gray-800 mb-4 text-sm uppercase tracking-wider">Oxirgi 7 kun faollik</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTest" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorKazus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sana" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip content={<CustomBarTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="testlar" name="Test yechildi" stroke="#3b82f6" fill="url(#colorTest)" strokeWidth={2} />
              <Area type="monotone" dataKey="kazuslar" name="Kazus yechildi" stroke="#8b5cf6" fill="url(#colorKazus)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Zaif nuqtalar */}
      {xatolarTop3.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-red-500 p-2 rounded-xl"><AlertTriangle className="h-4 w-4 text-white" /></div>
            <h3 className="font-black text-red-800 text-sm">🔴 Kursning Zaif Nuqtasi — Top-3 Qiyin Savollar</h3>
          </div>
          <div className="space-y-2">
            {xatolarTop3.map((s: any, i: number) => (
              <div key={i} className="bg-white border border-red-100 rounded-xl p-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center font-black text-xs flex-shrink-0 mt-0.5">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-500 mb-0.5">{s.testNomi}</p>
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2">{s.savol}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-black text-red-600">{s.xatoFoiz}%</p>
                  <p className="text-[10px] text-gray-400">xato</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ASOSIY TABLAR: Testlar | Kazuslar | Materiallar */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Tab navigatsiya */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'testlar', label: 'Testlar', icon: FileText, color: 'blue', cnt: testlar.length },
            { id: 'kazuslar', label: 'Kazuslar', icon: Brain, color: 'purple', cnt: toplamlar.length },
            { id: 'materiallar', label: 'Materiallar', icon: BookOpen, color: 'teal', cnt: materiallar.length },
          ].map(tab => {
            const activeColors: Record<string, string> = {
              blue: 'border-blue-500 text-blue-700 bg-blue-50',
              purple: 'border-purple-500 text-purple-700 bg-purple-50',
              teal: 'border-teal-500 text-teal-700 bg-teal-50',
            };
            return (
              <button key={tab.id} onClick={() => setAktifTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-3 text-xs font-black border-b-2 transition-all ${aktifTab === tab.id ? activeColors[tab.color] : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${aktifTab === tab.id ? 'bg-white' : 'bg-gray-100 text-gray-500'}`}>{tab.cnt}</span>
              </button>
            );
          })}
        </div>

        {/* Tab kontent */}
        <div className="p-4">
          {yuklanyapti ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-3" />
              <p className="text-gray-400 font-medium">Ma'lumotlar yuklanmoqda...</p>
            </div>
          ) : (
            <>
              {aktifTab === 'testlar' && (
                <TestlarTab testlar={testlar} onTestTanla={() => {}} onOquvchiTanla={setTanlanganOquvchi} />
              )}
              {aktifTab === 'kazuslar' && (
                <KazuslarTab toplamlar={toplamlar} onOquvchiTanla={setTanlanganOquvchi} />
              )}
              {aktifTab === 'materiallar' && (
                <MateriallarTab materiallar={materiallar} onOquvchiTanla={setTanlanganOquvchi} />
              )}
            </>
          )}
        </div>
      </div>

      {/* O'quvchilar bo'limi (alohida qidiruv) */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl"><GraduationCap className="h-4 w-4 text-white" /></div>
          <div>
            <h2 className="font-black text-gray-800 text-sm">O'quvchilar Analitikasi</h2>
            <p className="text-[10px] text-gray-500">O'quvchini tanlang — shaxsiy profilni ko'ring</p>
          </div>
        </div>
        <div className="p-4">
          <OquvchilarTab onOquvchiTanla={setTanlanganOquvchi} />
        </div>
      </div>
    </div>
  );
}
