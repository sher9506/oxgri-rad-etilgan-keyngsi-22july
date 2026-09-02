import { useState, useEffect } from 'react';
import { FileText, BarChart3, Trophy, Edit, Trash2, Eye, Calendar, Users, Clock, BookOpen, Share2, Timer, Play, Square, Globe, Zap } from 'lucide-react';


import GuruhgaUlashModal from './GuruhgaUlashModal';
import AvtomatikBoshlash from './AvtomatikBoshlash';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import TestYaratish from './TestYaratish';

interface Test {
  id: string;
  kod: string;
  test_nomi: string;
  ustoz_id: string;
  ustoz_ismi: string;
  savollar: any[];
  vaqt_daqiqa: number;
  timer_turi?: 'individual' | 'umumiy';
  created_at: string;
  is_active?: boolean;
  ommaviy?: boolean;
}

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

const formatVaqt = (sekund: number) => {
  if (!sekund) return '—';
  const d = Math.floor(sekund / 60);
  const s = sekund % 60;
  return d > 0 ? `${d}m ${s}s` : `${s}s`;
};

export default function TestlarKabineti() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'yaratish' | 'testlarim' | 'statistika' | 'avtomatik'>('testlarim');
  const [testlar, setTestlar] = useState<Test[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [tanlanganTest, setTanlanganTest] = useState<Test | null>(null);
  const [testJavoblar, setTestJavoblar] = useState<TestJavob[]>([]);
  const [javoblarYuklanyapti, setJavoblarYuklanyapti] = useState(false);
  const [tanlanganJavob, setTanlanganJavob] = useState<TestJavob | null>(null);
  const [tahrirlashRejimiTest, setTahrirlashRejimiTest] = useState<Test | null>(null);
  const [ulashModal, setUlashModal] = useState<{ kod: string; nomi: string; ommaviy?: boolean; savollarSoni?: number; vaqtDaqiqa?: number; ustozIsmi?: string; narx?: number } | null>(null);
  const [avtomatikModal, setAvtomatikModal] = useState<{ kod: string } | null>(null);
  const [startToggleYuklanyapti, setStartToggleYuklanyapti] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (activeTab === 'testlarim' && user?.ustoz_id) {
      testlarniYuklash();
    }
  }, [activeTab, user]);

  const testlarniYuklash = async () => {
    if (!user?.ustoz_id) return;
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('testlar').select('*').eq('ustoz_id', user.ustoz_id).order('created_at', { ascending: false });
      if (error) throw error;
      setTestlar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Testlarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  // START/STOP toggle
  const startStopToggle = async (test: Test) => {
    setStartToggleYuklanyapti(test.id);
    const yangiHolat = !test.is_active;
    try {
      const { error } = await supabase
        .from('testlar')
        .update({ is_active: yangiHolat })
        .eq('id', test.id);
      if (error) throw error;

      if (yangiHolat) {
        await supabase.from('test_sessiyalar').update({ faol: false }).eq('test_kod', test.kod).eq('faol', true);
        await supabase.from('test_sessiyalar').insert({
          test_kod: test.kod,
          test_id: test.id,
          sessiya_turi: 'manual',
          ruxsatli_oquvchilar: null,
          faol: true,
        });
      } else {
        await supabase.from('test_sessiyalar').update({ faol: false }).eq('test_kod', test.kod).eq('faol', true);
      }

      setTestlar(prev => prev.map(t => t.id === test.id ? { ...t, is_active: yangiHolat } : t));
      toast({
        title: yangiHolat ? '▶ Test boshlandi!' : '⏹ Test to\'xtatildi',
        description: yangiHolat
          ? `Barcha o'quvchilar "${test.test_nomi}" testiga kira oladi`
          : `"${test.test_nomi}" testi to'xtatildi`,
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Holatni yangilashda xatolik', variant: 'destructive' });
    } finally {
      setStartToggleYuklanyapti(null);
    }
  };

  const testniOchirish = async (testId: string, testKod: string) => {
    if (!confirm("Rostdan ham bu testni o'chirmoqchimisiz? Barcha o'quvchi natijalari ham o'chib ketadi!")) return;
    // O'chirilayotganini UI da ko'rsatish
    setTestlar(prev => prev.filter(t => t.id !== testId));
    let xatoBar = false;
    // Bog'liq barcha yozuvlarni majburiy o'chirish (xato bo'lsa ham davom etish)
    try { await supabase.from('test_javoblar').delete().eq('test_kod', testKod); } catch (e) { console.warn('test_javoblar o\'chirishda:', e); }
    try { await supabase.from('test_sessiyalar').delete().eq('test_kod', testKod); } catch (e) { console.warn('test_sessiyalar o\'chirishda:', e); }
    try { await supabase.from('auto_start_signals').delete().eq('kod', testKod).eq('tur', 'test'); } catch (e) { console.warn('auto_start_signals o\'chirishda:', e); }
    // Testni o'chirish
    try {
      const { error } = await supabase.from('testlar').delete().eq('id', testId);
      if (error) {
        console.error('Test o\'chirishda xato:', error);
        // Majburiy o'chirish: RLS yoki constraint bilan bog'liq muammo bo'lsa ID orqali qayta urinish
        const { error: error2 } = await supabase.from('testlar').delete().eq('id', testId).eq('kod', testKod);
        if (error2) { xatoBar = true; console.error('Ikkinchi urinishda ham xato:', error2); }
      }
    } catch (e: any) { xatoBar = true; console.error('Test delete exception:', e); }
    if (xatoBar) {
      // Agar o'chmas bo'lsa, ro'yxatni qaytadan yuklash
      toast({ title: 'Xato', description: "Testni o'chirishda muammo yuz berdi, qayta yuklandi", variant: 'destructive' });
      await testlarniYuklash();
    } else {
      toast({ title: "✅ O'chirildi!", description: "Test va barcha natijalari o'chirildi" });
    }
  };

  const testNatijalariniKorish = async (test: Test) => {
    setTanlanganTest(test);
    setJavoblarYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('test_javoblar').select('*').eq('test_kod', test.kod)
        .order('togri_soni', { ascending: false });
      if (error) throw error;
      const tartiblangan = (data || []).sort((a: TestJavob, b: TestJavob) => {
        if (b.togri_soni !== a.togri_soni) return b.togri_soni - a.togri_soni;
        return (a.sarflangan_vaqt ?? 99999) - (b.sarflangan_vaqt ?? 99999);
      });
      setTestJavoblar(tartiblangan);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Natijalarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setJavoblarYuklanyapti(false);
    }
  };

  const testniTahrirlash = (test: Test) => {
    setTahrirlashRejimiTest(test);
    setActiveTab('yaratish');
  };

  if (!user || user.rol !== 'ustoz') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
            <CardTitle className="text-center">Testlar Kabineti</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Testlar kabinetiga kirish uchun ustoz sifatida tizimga kiring.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // JAVOB BATAFSIL
  // ─────────────────────────────────────────────────────────────────────────
  if (tanlanganJavob && tanlanganTest) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setTanlanganJavob(null)} size="sm">← Orqaga</Button>
          <h2 className="text-xl font-bold text-gray-800">{tanlanganTest.test_nomi} — Batafsil</h2>
        </div>
        <Card className="border-2 border-green-500 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-2xl font-bold">{tanlanganJavob.oquvchi_ismi}</h3>
                <p className="text-green-100 text-sm mt-1">{tanlanganTest.test_nomi}</p>
                {tanlanganJavob.sarflangan_vaqt ? (
                  <p className="text-green-200 text-sm mt-1 flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" />
                    Sarflangan vaqt: <strong className="text-white ml-1">{formatVaqt(tanlanganJavob.sarflangan_vaqt)}</strong>
                  </p>
                ) : null}
              </div>
              <div className={`text-5xl font-bold ${
                tanlanganJavob.foiz >= 85 ? 'text-green-300' : tanlanganJavob.foiz >= 70 ? 'text-blue-300' : tanlanganJavob.foiz >= 50 ? 'text-yellow-300' : 'text-red-300'
              }`}>{tanlanganJavob.foiz}%</div>
            </div>
          </div>
        </Card>

        <div className={`grid gap-4 ${tanlanganJavob.sarflangan_vaqt ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
          <Card className="border-2 border-green-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-green-600">{tanlanganJavob.togri_soni}</p><p className="text-sm text-gray-600 mt-1">To'g'ri javob</p></CardContent></Card>
          <Card className="border-2 border-red-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-red-600">{tanlanganJavob.xato_soni}</p><p className="text-sm text-gray-600 mt-1">Xato javob</p></CardContent></Card>
          <Card className="border-2 border-gray-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-gray-600">{tanlanganJavob.javob_berilmagan}</p><p className="text-sm text-gray-600 mt-1">Javobsiz</p></CardContent></Card>
          {tanlanganJavob.sarflangan_vaqt ? (
            <Card className="border-2 border-blue-200"><CardContent className="pt-4 text-center"><Timer className="h-6 w-6 text-blue-500 mx-auto mb-1" /><p className="text-2xl font-bold text-blue-600">{formatVaqt(tanlanganJavob.sarflangan_vaqt)}</p><p className="text-xs text-gray-600 mt-1">Sarflangan vaqt</p></CardContent></Card>
          ) : null}
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-lg text-gray-800">Savollar tahlili:</h3>
          {tanlanganTest.savollar.map((savol: any, idx: number) => {
            const oquvchiJavob = tanlanganJavob.javoblar.find((j) => j.savol_index === idx);
            const berilganJavob = oquvchiJavob?.javob;
            const togri = berilganJavob !== undefined && berilganJavob === savol.togriJavob;
            const javobBerilgan = berilganJavob !== undefined && berilganJavob !== -1;
            return (
              <div key={idx} className={`p-4 rounded-xl border-2 ${!javobBerilgan ? 'border-gray-300 bg-gray-50' : togri ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm ${!javobBerilgan ? 'bg-gray-400' : togri ? 'bg-green-500' : 'bg-red-500'}`}>
                    {!javobBerilgan ? '—' : togri ? '✓' : '✗'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 mb-2">{idx + 1}. {savol.savol}</p>
                    <div className="space-y-1 text-sm">
                      {javobBerilgan && <p className={togri ? 'text-green-700' : 'text-red-700'}><span className="font-semibold">Javobi:</span> {String.fromCharCode(65 + (berilganJavob as number))}) {savol.variantlar[berilganJavob as number]}</p>}
                      {!togri && <p className="text-green-700"><span className="font-semibold">To'g'ri:</span> {String.fromCharCode(65 + savol.togriJavob)}) {savol.variantlar[savol.togriJavob]}</p>}
                      {!javobBerilgan && <p className="text-gray-500">Javob berilmagan</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST NATIJALARI
  // ─────────────────────────────────────────────────────────────────────────
  if (tanlanganTest) {
    const hasVaqt = testJavoblar.some(j => j.sarflangan_vaqt);
    const ortachaVaqt = hasVaqt
      ? Math.round(testJavoblar.filter(j => j.sarflangan_vaqt).reduce((s, j) => s + (j.sarflangan_vaqt || 0), 0) / testJavoblar.filter(j => j.sarflangan_vaqt).length)
      : 0;
    const tartiblangan = [...testJavoblar].sort((a, b) => {
      if (b.foiz !== a.foiz) return b.foiz - a.foiz;
      if (a.sarflangan_vaqt && b.sarflangan_vaqt) return a.sarflangan_vaqt - b.sarflangan_vaqt;
      return 0;
    });

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => { setTanlanganTest(null); setTestJavoblar([]); }} size="sm">← Orqaga</Button>
          <h2 className="text-xl font-bold text-gray-800">Test natijalari</h2>
        </div>

        <Card className="border-2 border-blue-500 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-2xl">{tanlanganTest.test_nomi}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-blue-100 mt-2 flex-wrap">
                  <span className="font-bold text-lg">Kod: {tanlanganTest.kod}</span>
                  <span className="flex items-center gap-1"><FileText className="h-4 w-4" />{tanlanganTest.savollar.length} ta savol</span>
                  <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{tanlanganTest.vaqt_daqiqa} daqiqa</span>
                  <span className="flex items-center gap-1"><Users className="h-4 w-4" />{testJavoblar.length} ta javob</span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {testJavoblar.length > 0 && (
          <div className={`grid gap-4 ${hasVaqt ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            <Card className="border-2 border-blue-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-blue-600">{Math.round(testJavoblar.reduce((s, j) => s + j.foiz, 0) / testJavoblar.length)}%</p><p className="text-xs text-gray-600 mt-1">O'rtacha foiz</p></CardContent></Card>
            <Card className="border-2 border-green-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-green-600">{testJavoblar.length}</p><p className="text-xs text-gray-600 mt-1">Jami qatnashdi</p></CardContent></Card>
            <Card className="border-2 border-yellow-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-yellow-600">{testJavoblar.filter(j => j.foiz >= 85).length}</p><p className="text-xs text-gray-600 mt-1">A'lo (85%+)</p></CardContent></Card>
            <Card className="border-2 border-red-200"><CardContent className="pt-4 text-center"><p className="text-3xl font-bold text-red-600">{testJavoblar.filter(j => j.foiz < 50).length}</p><p className="text-xs text-gray-600 mt-1">Qoniqarsiz (&lt;50%)</p></CardContent></Card>
            {hasVaqt && <Card className="border-2 border-indigo-200 bg-indigo-50"><CardContent className="pt-4 text-center"><Timer className="h-5 w-5 text-indigo-500 mx-auto mb-1" /><p className="text-xl font-bold text-indigo-600">{formatVaqt(ortachaVaqt)}</p><p className="text-xs text-gray-600 mt-1">O'rtacha vaqt</p></CardContent></Card>}
          </div>
        )}

        {javoblarYuklanyapti ? (
          <Card><CardContent className="py-16 text-center"><div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" /><p className="text-gray-500">Yuklanmoqda...</p></CardContent></Card>
        ) : testJavoblar.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><FileText className="h-20 w-20 text-gray-300 mx-auto mb-4" /><p className="text-xl font-medium text-gray-500">Hali javob yo'q</p></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {tartiblangan.map((javob, index) => (
              <Card key={javob.id} className="border-2 border-gray-200 hover:border-blue-400 cursor-pointer hover:shadow-lg transition-all" onClick={() => setTanlanganJavob(javob)}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${index === 0 ? 'bg-amber-400 text-white text-sm' : index === 1 ? 'bg-slate-400 text-white text-sm' : index === 2 ? 'bg-orange-600 text-white text-sm' : 'bg-blue-100 text-blue-700 text-sm'}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{javob.oquvchi_ismi}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(javob.created_at).toLocaleDateString('uz-UZ')}</span>
                        <span className="text-green-600 font-semibold">✓ {javob.togri_soni}</span>
                        <span className="text-red-600 font-semibold">✗ {javob.xato_soni}</span>
                        {javob.javob_berilmagan > 0 && <span className="text-gray-500">— {javob.javob_berilmagan}</span>}
                        {javob.sarflangan_vaqt ? <span className="flex items-center gap-1 text-blue-600 font-medium"><Timer className="h-3.5 w-3.5" />{formatVaqt(javob.sarflangan_vaqt)}</span> : null}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-3xl font-black ${javob.foiz >= 85 ? 'text-green-600' : javob.foiz >= 70 ? 'text-blue-600' : javob.foiz >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{javob.foiz}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ASOSIY KO'RINISH
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-2 border-[hsl(221,83%,53%)] shadow-lg">
        <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
          <CardTitle className="text-2xl flex items-center gap-2">
            <BookOpen className="h-7 w-7" />Testlar Kabineti
          </CardTitle>
          <p className="text-sm text-blue-100 mt-1">Test yaratish, natijalarni ko'rish va START/STOP boshqaruvi</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button onClick={() => setActiveTab('testlarim')} variant={activeTab === 'testlarim' ? 'default' : 'outline'} size="sm"><FileText className="h-4 w-4 mr-1" />Testlarim</Button>
            <Button onClick={() => setActiveTab('yaratish')} variant={activeTab === 'yaratish' ? 'default' : 'outline'} size="sm"><BarChart3 className="h-4 w-4 mr-1" />Yangi test</Button>
            <Button onClick={() => setActiveTab('statistika')} variant={activeTab === 'statistika' ? 'default' : 'outline'} size="sm"><Trophy className="h-4 w-4 mr-1" />Statistika</Button>
            <Button onClick={() => setActiveTab('avtomatik')} variant={activeTab === 'avtomatik' ? 'default' : 'outline'} size="sm" className={activeTab === 'avtomatik' ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : 'border-green-400 text-green-700 hover:bg-green-50'}><Zap className="h-4 w-4 mr-1" />Avtomatik</Button>
          </div>
        </CardContent>
      </Card>

      <div className="animate-slide-in">
        {activeTab === 'yaratish' && (
          <TestYaratish
            tahrirlashUchunTest={tahrirlashRejimiTest}
            onTahrirlashTugadi={() => {
              setTahrirlashRejimiTest(null);
              setActiveTab('testlarim');
              testlarniYuklash();
            }}
          />
        )}

        {activeTab === 'testlarim' && (
          <div>
            {yuklanyapti ? (
              <Card><CardContent className="py-16 text-center"><div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" /><p className="text-gray-500">Yuklanmoqda...</p></CardContent></Card>
            ) : testlar.length === 0 ? (
              <Card><CardContent className="py-20 text-center"><FileText className="h-20 w-20 text-gray-300 mx-auto mb-4" /><p className="text-xl font-medium text-gray-500">Hali test yaratilmagan</p><Button onClick={() => setActiveTab('yaratish')} className="mt-6">Test yaratish</Button></CardContent></Card>
            ) : (
              <div className="space-y-4">
                {testlar.map((test) => (
                  <Card key={test.id} className={`border-2 transition-all hover:shadow-lg ${test.is_active ? 'border-green-400 shadow-green-100' : 'border-gray-200 hover:border-blue-400'}`}>
                    <CardContent className="py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-xl font-bold text-gray-900">{test.test_nomi}</h3>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2 ${
                              test.is_active ? 'bg-green-100 border-green-400 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                            }`}>
                              <span className={`w-2 h-2 rounded-full ${test.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                              {test.is_active ? 'FAOL' : 'TO\'XTATILGAN'}
                            </span>
                            {test.ommaviy && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 border border-emerald-300 text-emerald-700">
                                <Globe className="h-3 w-3" />Ommaviy
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">Kod: {test.kod}</span>
                            <span className="flex items-center gap-1"><FileText className="h-4 w-4" />{test.savollar.length} ta savol</span>
                            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{test.vaqt_daqiqa} daqiqa</span>
                            {test.timer_turi && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${test.timer_turi === 'individual' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                                <Timer className="h-3 w-3" />{test.timer_turi === 'individual' ? 'Individual' : 'Umumiy'}
                              </span>
                            )}
                            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(test.created_at).toLocaleDateString('uz-UZ')}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            onClick={() => startStopToggle(test)}
                            disabled={startToggleYuklanyapti === test.id}
                            size="sm"
                            className={`font-bold h-9 min-w-[100px] ${
                              test.is_active
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                          >
                            {startToggleYuklanyapti === test.id ? (
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mx-auto" />
                            ) : test.is_active ? (
                              <><Square className="h-4 w-4 mr-1" />STOP</>
                            ) : (
                              <><Play className="h-4 w-4 mr-1" />START</>
                            )}
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => setAvtomatikModal({ kod: test.kod })}
                              variant="outline" size="sm"
                              className="border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 h-8 px-2"
                              title="Avtomatik boshlash (Qat'iy Nazorat)"
                            >
                              <Zap className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              onClick={() => setUlashModal({ kod: test.kod, nomi: test.test_nomi, ommaviy: test.ommaviy, savollarSoni: test.savollar?.length, vaqtDaqiqa: test.vaqt_daqiqa, ustozIsmi: test.ustoz_ismi, narx: (test as any).narx })}
                              variant="outline" size="sm"
                              className="border-2 border-green-400 text-green-700 hover:bg-green-50 h-8 px-2"
                              title="Ulashish va ommaviy qilish"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button onClick={() => testNatijalariniKorish(test)} variant="outline" size="sm" className="border-2 border-blue-400 text-blue-700 hover:bg-blue-50 h-8 px-2">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button onClick={() => testniTahrirlash(test)} variant="outline" size="sm" className="border-2 border-amber-400 text-amber-700 hover:bg-amber-50 h-8 px-2">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button onClick={() => testniOchirish(test.id, test.kod)} variant="outline" size="sm" className="border-2 border-red-400 text-red-700 hover:bg-red-50 h-8 px-2">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'statistika' && (
          <Card><CardContent className="py-20 text-center"><Trophy className="h-20 w-20 text-gray-300 mx-auto mb-4" /><p className="text-xl font-medium text-gray-500">Statistika tez orada</p></CardContent></Card>
        )}

        {activeTab === 'avtomatik' && user?.ustoz_id && (
          <AvtomatikBoshlash ustozId={user.ustoz_id} tur="test" />
        )}
      </div>

      {/* Avtomatik boshlash modal */}
      {avtomatikModal && user?.ustoz_id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAvtomatikModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-700 to-green-700 text-white px-5 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><Zap className="h-5 w-5" /></div>
                <div>
                  <p className="font-black text-lg">Qat'iy Nazorat</p>
                  <p className="text-emerald-100 text-xs">Kod: {avtomatikModal.kod}</p>
                </div>
              </div>
              <button onClick={() => setAvtomatikModal(null)} className="hover:bg-white/20 p-2 rounded-xl transition-colors text-white font-bold text-lg leading-none">&times;</button>
            </div>
            <div className="p-4">
              <AvtomatikBoshlash ustozId={user.ustoz_id} defaultKod={avtomatikModal.kod} tur="test" />
            </div>
          </div>
        </div>
      )}

      {ulashModal && (
        <GuruhgaUlashModal
          isOpen={!!ulashModal}
          onClose={() => setUlashModal(null)}
          tur="test"
          kod={ulashModal.kod}
          nomi={ulashModal.nomi}
          ustozId={user.ustoz_id}
          ommaviyHolat={ulashModal.ommaviy}
          savollarSoni={ulashModal.savollarSoni}
          vaqtDaqiqa={ulashModal.vaqtDaqiqa}
          ustozIsmi={ulashModal.ustozIsmi}
          narx={ulashModal.narx}
          onOmmaviyOzgartirish={(yangiHolat) => {
            setTestlar(prev => prev.map(t => t.kod === ulashModal.kod ? { ...t, ommaviy: yangiHolat } : t));
          }}
        />
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
