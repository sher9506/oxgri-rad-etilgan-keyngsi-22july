import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, ChevronRight, ArrowLeft, FileText, Trash2,
  Phone, Lock, Eye, EyeOff, Calendar, BookOpen, X, CheckCircle2, XCircle,
  RefreshCw, Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface OquvchilarRoyhatProps {
  ustozId?: string; // Agar ustoz uchun bo'lsa — faqat uning test/kazuslarini yechganlar
  mode?: 'admin' | 'ustoz'; // default: admin
}

interface Talaba {
  id: string;
  ism: string;
  familiya: string;
  guruh: string;
  kurs: string;
  login_id: string | null;
  phone: string | null;
  parol_hash: string | null;
  fraud_flag: boolean;
  telegram_chat_id: number | null;
}

interface TalabaProfilData {
  talaba: Talaba;
  testJavoblar: any[];
  kazusJavoblar: any[];
}

const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];
const GURUHLAR = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3'];

export default function OquvchilarRoyhat({ ustozId, mode = 'admin' }: OquvchilarRoyhatProps) {
  const { toast } = useToast();
  const [talabalar, setTalabalar] = useState<Talaba[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(true);
  const [qidiruv, setQidiruv] = useState('');
  const [tanlanganKurs, setTanlanganKurs] = useState('barchasi');
  const [tanlanganGuruh, setTanlanganGuruh] = useState('barchasi');
  const [tanlanganTalaba, setTanlanganTalaba] = useState<TalabaProfilData | null>(null);
  const [profilYuklanmoqda, setProfilYuklanmoqda] = useState(false);
  const [parolKor, setParolKor] = useState(false);
  const [ochiqKazuslar, setOchiqKazuslar] = useState<Set<string>>(new Set());
  const [ochiqTestlar, setOchiqTestlar] = useState<Set<string>>(new Set());

  const yuklash = useCallback(async () => {
    setYuklanmoqda(true);
    try {
      if (mode === 'ustoz' && ustozId) {
        // Ustoz rejimi: faqat bu ustozning test/kazuslarini yechganlar
        const [testJavobRes, kazusJavobRes] = await Promise.all([
          supabase.from('test_javoblar').select('oquvchi_ismi').eq('test_kod', '').neq('oquvchi_ismi', ''),
          supabase.from('javoblar').select('oquvchi_ismi').neq('oquvchi_ismi', ''),
        ]);

        // Ustozning testlari va toplamlarini olish
        const [testlarRes, toplamlarRes] = await Promise.all([
          supabase.from('testlar').select('kod').eq('ustoz_id', ustozId),
          supabase.from('toplamlar').select('kod').eq('ustoz_id', ustozId),
        ]);

        const testKodlar = (testlarRes.data || []).map((t: any) => t.kod);
        const toplamKodlar = (toplamlarRes.data || []).map((t: any) => t.kod);

        // Ushbu test/toplamlarni yechgan o'quvchilar ismlarini to'plash
        const ismlar = new Set<string>();

        if (testKodlar.length > 0) {
          const { data } = await supabase.from('test_javoblar').select('oquvchi_ismi').in('test_kod', testKodlar);
          (data || []).forEach((j: any) => ismlar.add(j.oquvchi_ismi));
        }
        if (toplamKodlar.length > 0) {
          const { data } = await supabase.from('javoblar').select('oquvchi_ismi').in('toplam_kod', toplamKodlar);
          (data || []).forEach((j: any) => ismlar.add(j.oquvchi_ismi));
        }

        if (ismlar.size === 0) {
          setTalabalar([]);
          setYuklanmoqda(false);
          return;
        }

        // Ushbu ismlar bilan talabalarni olish
        const { data: tData } = await supabase
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, login_id, phone, parol_hash, fraud_flag, telegram_chat_id')
          .order('familiya', { ascending: true });

        const filtred = (tData || []).filter((t: any) => ismlar.has(`${t.ism} ${t.familiya}`));
        setTalabalar(filtred);
      } else {
        // Admin rejimi: barcha talabalar
        const { data, error } = await supabase
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, login_id, phone, parol_hash, fraud_flag, telegram_chat_id')
          .order('familiya', { ascending: true });
        if (error) throw error;
        setTalabalar(data || []);
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Talabalar yuklanmadi', variant: 'destructive' });
    } finally {
      setYuklanmoqda(false);
    }
  }, [ustozId, mode]);

  useEffect(() => { yuklash(); }, [yuklash]);

  const profilOchish = async (talaba: Talaba) => {
    setProfilYuklanmoqda(true);
    const fullIsm = `${talaba.ism} ${talaba.familiya}`;

    try {
      let testJavoblar: any[] = [];
      let kazusJavoblar: any[] = [];

      if (mode === 'ustoz' && ustozId) {
        // Faqat ushbu ustozning testlari bo'yicha
        const [testlarRes, toplamlarRes] = await Promise.all([
          supabase.from('testlar').select('kod, test_nomi').eq('ustoz_id', ustozId),
          supabase.from('toplamlar').select('kod, mavzu, kazuslar').eq('ustoz_id', ustozId),
        ]);

        const testKodlar = (testlarRes.data || []).map((t: any) => t.kod);
        const toplamKodlar = (toplamlarRes.data || []).map((t: any) => t.kod);

        if (testKodlar.length > 0) {
          const { data } = await supabase.from('test_javoblar').select('*').eq('oquvchi_ismi', fullIsm).in('test_kod', testKodlar).order('created_at', { ascending: false });
          testJavoblar = (data || []).map((j: any) => ({
            ...j,
            _test_nomi: testlarRes.data?.find((t: any) => t.kod === j.test_kod)?.test_nomi || j.test_kod,
          }));
        }
        if (toplamKodlar.length > 0) {
          const { data } = await supabase.from('javoblar').select('*').eq('oquvchi_ismi', fullIsm).in('toplam_kod', toplamKodlar).order('created_at', { ascending: false });
          kazusJavoblar = (data || []).map((j: any) => ({
            ...j,
            _toplam: toplamlarRes.data?.find((t: any) => t.kod === j.toplam_kod) || null,
          }));
        }
      } else {
        // Admin: barcha test va kazuslar
        const [testRes, kazusRes] = await Promise.all([
          supabase.from('test_javoblar').select('*').eq('oquvchi_ismi', fullIsm).order('created_at', { ascending: false }),
          supabase.from('javoblar').select('*').eq('oquvchi_ismi', fullIsm).order('created_at', { ascending: false }),
        ]);

        testJavoblar = testRes.data || [];
        // Test nomlarini yuklash
        const testKodlar = [...new Set(testJavoblar.map((j: any) => j.test_kod))];
        if (testKodlar.length > 0) {
          const { data: testlarData } = await supabase.from('testlar').select('kod, test_nomi').in('kod', testKodlar);
          const testMap: Record<string, string> = {};
          (testlarData || []).forEach((t: any) => { testMap[t.kod] = t.test_nomi; });
          testJavoblar = testJavoblar.map((j: any) => ({ ...j, _test_nomi: testMap[j.test_kod] || j.test_kod }));
        }

        const kazusRaw = kazusRes.data || [];
        const toplamKodlar = [...new Set(kazusRaw.map((j: any) => j.toplam_kod))];
        if (toplamKodlar.length > 0) {
          const { data: toplamlarData } = await supabase.from('toplamlar').select('kod, mavzu, kazuslar').in('kod', toplamKodlar);
          const toplamMap: Record<string, any> = {};
          (toplamlarData || []).forEach((t: any) => { toplamMap[t.kod] = t; });
          kazusJavoblar = kazusRaw.map((j: any) => ({ ...j, _toplam: toplamMap[j.toplam_kod] || null }));
        } else {
          kazusJavoblar = kazusRaw;
        }
      }

      setTanlanganTalaba({ talaba, testJavoblar, kazusJavoblar });
      setOchiqKazuslar(new Set());
      setOchiqTestlar(new Set());
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Ma\'lumotlar yuklanmadi', variant: 'destructive' });
    } finally {
      setProfilYuklanmoqda(false);
    }
  };

  const natijalarOchirish = async (type: 'test' | 'kazus', id: string) => {
    if (!confirm("Bu natijani o'chirmoqchimisiz?")) return;
    try {
      if (type === 'test') {
        await supabase.from('test_javoblar').delete().eq('id', id);
        setTanlanganTalaba(prev => prev ? { ...prev, testJavoblar: prev.testJavoblar.filter((j: any) => j.id !== id) } : null);
      } else {
        await supabase.from('javoblar').delete().eq('id', id);
        setTanlanganTalaba(prev => prev ? { ...prev, kazusJavoblar: prev.kazusJavoblar.filter((j: any) => j.id !== id) } : null);
      }
      toast({ title: "O'chirildi!" });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const talabaOchirish = async (talaba: Talaba) => {
    if (!confirm(`${talaba.familiya} ${talaba.ism}ni o'chirmoqchimisiz?`)) return;
    try {
      await supabase.from('talabalar').delete().eq('id', talaba.id);
      setTalabalar(prev => prev.filter(t => t.id !== talaba.id));
      setTanlanganTalaba(null);
      toast({ title: "O'chirildi!" });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  // Filtrlash
  const filtred = talabalar.filter(t => {
    const kOk = tanlanganKurs === 'barchasi' || t.kurs === tanlanganKurs;
    const gOk = tanlanganGuruh === 'barchasi' || t.guruh === tanlanganGuruh;
    const qOk = !qidiruv || `${t.ism} ${t.familiya}`.toLowerCase().includes(qidiruv.toLowerCase());
    return kOk && gOk && qOk;
  });

  // Guruh bo'yicha guruhlash
  const guruhlarMap: Record<string, Record<string, Talaba[]>> = {};
  filtred.forEach(t => {
    if (!guruhlarMap[t.kurs]) guruhlarMap[t.kurs] = {};
    if (!guruhlarMap[t.kurs][t.guruh]) guruhlarMap[t.kurs][t.guruh] = [];
    guruhlarMap[t.kurs][t.guruh].push(t);
  });

  // ── PROFIL SAHIFA ──────────────────────────────────────────────────────────
  if (profilYuklanmoqda) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-500">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (tanlanganTalaba) {
    const { talaba, testJavoblar, kazusJavoblar } = tanlanganTalaba;
    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => setTanlanganTalaba(null)} className="hover:text-blue-600 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Ro'yxat
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-gray-800">{talaba.familiya} {talaba.ism}</span>
        </div>

        {/* Talaba profil karta */}
        <Card className="border-2 border-blue-400 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black">
                  {talaba.familiya[0]}{talaba.ism[0]}
                </div>
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {talaba.familiya} {talaba.ism}
                    {talaba.fraud_flag && <span className="bg-orange-500 text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">⚠️ Shubhali</span>}
                  </h2>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">{talaba.kurs}</span>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">{talaba.guruh.toUpperCase()}</span>
                    {talaba.phone && <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{talaba.phone}</span>}
                    {talaba.telegram_chat_id && <span className="bg-green-500/50 px-3 py-1 rounded-full text-sm font-semibold">✈️ Telegram</span>}
                  </div>
                </div>
              </div>
              {mode === 'admin' && (
                <button onClick={() => talabaOchirish(talaba)} className="bg-white/10 hover:bg-red-500 px-3 py-2 rounded-xl flex items-center gap-1.5 text-sm font-bold transition-all">
                  <Trash2 className="h-4 w-4" /> O'chirish
                </button>
              )}
            </div>

            {/* Login va parol info */}
            {mode === 'admin' && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-1">Login ID</p>
                  <p className="font-mono font-bold text-sm">{talaba.login_id || 'Kiritilmagan'}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-1">Parol holati</p>
                  <div className="flex items-center gap-2">
                    {talaba.parol_hash ? (
                      <span className="flex items-center gap-1 text-green-300 font-bold text-sm"><CheckCircle2 className="h-4 w-4" /> O'rnatilgan</span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-300 font-bold text-sm"><XCircle className="h-4 w-4" /> O'rnatilmagan</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Statistika */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-black text-indigo-700">{testJavoblar.length}</p>
            <p className="text-sm text-indigo-600 font-semibold mt-1">Test yechilgan</p>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-black text-emerald-700">{kazusJavoblar.length}</p>
            <p className="text-sm text-emerald-600 font-semibold mt-1">Kazus yechilgan</p>
          </div>
        </div>

        {/* TESTLAR */}
        {testJavoblar.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-600" /> Yechilgan testlar
            </h3>
            {testJavoblar.map((j: any) => {
              const ochiq = ochiqTestlar.has(j.id);
              return (
                <Card key={j.id} className="border border-indigo-200 hover:border-indigo-400 transition-all">
                  <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setOchiqTestlar(prev => { const n = new Set(prev); n.has(j.id) ? n.delete(j.id) : n.add(j.id); return n; })}>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{j._test_nomi || j.test_kod}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">#{j.test_kod}</span>
                        <span className="text-green-600 font-bold">{j.togri_soni} to'g'ri</span>
                        <span className="text-red-500 font-bold">{j.xato_soni} xato</span>
                        <span className="text-gray-400">{j.foiz}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black ${j.foiz >= 70 ? 'text-green-600' : j.foiz >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{j.foiz}%</span>
                      {mode === 'admin' && (
                        <button onClick={e => { e.stopPropagation(); natijalarOchirish('test', j.id); }} className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {ochiq && (
                    <div className="border-t border-indigo-100 px-4 pb-4 pt-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-green-50 p-3 rounded-xl text-center border border-green-100">
                          <p className="text-2xl font-black text-green-600">{j.togri_soni}</p>
                          <p className="text-green-700 font-semibold text-xs">To'g'ri</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-xl text-center border border-red-100">
                          <p className="text-2xl font-black text-red-600">{j.xato_soni}</p>
                          <p className="text-red-700 font-semibold text-xs">Xato</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center border border-gray-200">
                          <p className="text-2xl font-black text-gray-600">{j.javob_berilmagan}</p>
                          <p className="text-gray-600 font-semibold text-xs">Javobsiz</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(j.created_at).toLocaleString('uz-UZ')}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* KAZUSLAR */}
        {kazusJavoblar.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" /> Yechilgan kazuslar
            </h3>
            {kazusJavoblar.map((j: any) => {
              const umumiyBall = (j.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0);
              const maks = (j.baho || []).length * 30;
              const foiz = maks ? Math.round((umumiyBall / maks) * 100) : 0;
              const ochiq = ochiqKazuslar.has(j.id);
              return (
                <Card key={j.id} className="border border-emerald-200 hover:border-emerald-400 transition-all">
                  <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setOchiqKazuslar(prev => { const n = new Set(prev); n.has(j.id) ? n.delete(j.id) : n.add(j.id); return n; })}>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{j._toplam?.mavzu || 'Mavzusiz'}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs">#{j.toplam_kod}</span>
                        <span className="text-gray-400">{(j.baho || []).length} kazus</span>
                        <span className={`font-bold ${foiz >= 70 ? 'text-green-600' : foiz >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{umumiyBall}/{maks} ball</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-black ${foiz >= 70 ? 'text-green-600' : foiz >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{foiz}%</span>
                      {mode === 'admin' && (
                        <button onClick={e => { e.stopPropagation(); natijalarOchirish('kazus', j.id); }} className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {ochiq && (
                    <div className="border-t border-emerald-100 px-4 pb-4 pt-3 space-y-2">
                      {(j.baho || []).map((b: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                          <span className="text-sm text-gray-600">Kazus {b.kazus_index + 1}</span>
                          <span className={`font-black ${b.ball >= 21 ? 'text-green-600' : b.ball >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{b.ball}/30</span>
                        </div>
                      ))}
                      <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(j.created_at).toLocaleString('uz-UZ')}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {testJavoblar.length === 0 && kazusJavoblar.length === 0 && (
          <Card>
            <div className="py-12 text-center text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="font-medium">Hali hech qanday natija yo'q</p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ── RO'YXAT SAHIFA ────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <Card className={`border-2 ${mode === 'admin' ? 'border-red-500' : 'border-blue-500'} shadow-lg overflow-hidden`}>
        <div className={`bg-gradient-to-r ${mode === 'admin' ? 'from-red-700 to-red-600' : 'from-blue-700 to-blue-600'} text-white p-5`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl"><Users className="h-6 w-6" /></div>
              <div>
                <h1 className="text-xl font-bold">
                  {mode === 'ustoz' ? "O'quvchilarim ro'yxati" : "Talabalar ro'yxati"}
                </h1>
                <p className="text-white/70 text-sm mt-0.5">
                  {yuklanmoqda ? 'Yuklanmoqda...' : `${talabalar.length} ta talaba`}
                  {mode === 'ustoz' && ' — faqat sizning sinovlaringizni yechanlar'}
                </p>
              </div>
            </div>
            <button onClick={yuklash} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
              <RefreshCw className={`h-4 w-4 ${yuklanmoqda ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Filtrlar */}
      <Card className="border border-gray-200">
        <div className="p-4 space-y-3">
          {/* Qidiruv */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Ism yoki familiya bo'yicha qidirish..."
              value={qidiruv}
              onChange={e => setQidiruv(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 text-sm"
            />
            {qidiruv && (
              <button onClick={() => setQidiruv('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Kurs va guruh */}
          <div className="flex gap-2 flex-wrap">
            <select value={tanlanganKurs} onChange={e => setTanlanganKurs(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white text-sm">
              <option value="barchasi">Barcha kurslar</option>
              {KURSLAR.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <select value={tanlanganGuruh} onChange={e => setTanlanganGuruh(e.target.value)} className="px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white text-sm">
              <option value="barchasi">Barcha guruhlar</option>
              {GURUHLAR.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
            </select>
            <span className="px-3 py-2 text-sm text-gray-500 self-center">{filtred.length} ta</span>
          </div>
        </div>
      </Card>

      {/* Ro'yxat */}
      {yuklanmoqda ? (
        <Card><div className="py-16 text-center"><Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-3" /><p className="text-gray-500">Yuklanmoqda...</p></div></Card>
      ) : filtred.length === 0 ? (
        <Card><div className="py-16 text-center"><Users className="h-16 w-16 text-gray-200 mx-auto mb-3" /><p className="text-gray-500 font-medium">{talabalar.length === 0 ? 'Hali o\'quvchilar yo\'q' : 'Qidiruv bo\'yicha topilmadi'}</p></div></Card>
      ) : (
        <div className="space-y-5">
          {Object.entries(guruhlarMap).sort(([a], [b]) => a.localeCompare(b)).map(([kurs, guruhlar]) => (
            <div key={kurs} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={`${mode === 'admin' ? 'bg-red-600' : 'bg-blue-600'} text-white px-4 py-1.5 rounded-xl text-sm font-bold uppercase`}>{kurs}</div>
                <div className="flex-1 h-0.5 bg-gray-100" />
              </div>
              {Object.entries(guruhlar).sort(([a], [b]) => a.localeCompare(b)).map(([guruh, talabaList]) => (
                <Card key={guruh} className="border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
                    <span className="font-bold text-gray-700">Guruh: {guruh.toUpperCase()}</span>
                    <span className={`${mode === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} px-2.5 py-0.5 rounded-full text-xs font-bold`}>{talabaList.length} talaba</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {talabaList.map((t, idx) => (
                      <div key={t.id} className="flex items-center px-5 py-3 hover:bg-gray-50 transition-colors group">
                        <button className="flex items-center gap-3 flex-1 text-left" onClick={() => profilOchish(t)}>
                          <span className="w-7 text-sm text-gray-400 font-semibold">{idx + 1}.</span>
                          <div className={`w-8 h-8 rounded-xl ${mode === 'admin' ? 'bg-gradient-to-br from-red-500 to-red-700' : 'bg-gradient-to-br from-blue-500 to-blue-700'} text-white font-bold text-xs flex items-center justify-center`}>
                            {t.familiya[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                              {t.familiya} {t.ism}
                              {t.fraud_flag && <span className="inline-flex items-center justify-center w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black">!</span>}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {t.login_id && <span className="text-[10px] text-gray-400 font-mono">{t.login_id}</span>}
                              {t.telegram_chat_id && <span className="text-[10px] text-green-600 font-bold">✈️ TG</span>}
                            </div>
                          </div>
                        </button>
                        {mode === 'admin' && (
                          <button onClick={() => talabaOchirish(t)} className="p-2 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors ml-2">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 ml-1" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } } .animate-fade-in { animation: fade-in 0.3s ease-out; }`}</style>
    </div>
  );
}
