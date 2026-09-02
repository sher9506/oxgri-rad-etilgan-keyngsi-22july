import { useState, useEffect } from 'react';
import { Users, ChevronRight, BookOpen, Star, FileText, ArrowLeft, Search, X, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Talaba {
  id?: string;
  ism: string;
  familiya: string;
  guruh: string;
  kurs: string;
  fraud_flag?: boolean;
  phone?: string;
  login_id?: string;
}

interface TalabaJavob {
  id: string;
  toplam_kod: string;
  toplam_mavzu?: string;
  created_at: string;
  javoblar: any[];
  baho: any[];
}

const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];
const GURUHLAR = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3'];

export default function TalabalarRoyhat() {
  const [talabalar, setTalabalar] = useState<Talaba[]>([]);
  const [tanlanganKurs, setTanlanganKurs] = useState<string>('barchasi');
  const [tanlanganGuruh, setTanlanganGuruh] = useState<string>('barchasi');
  const [qidiruv, setQidiruv] = useState('');
  const [tanlanganTalaba, setTanlanganTalaba] = useState<Talaba | null>(null);
  const [talabaJavoblari, setTalabaJavoblari] = useState<TalabaJavob[]>([]);
  const [talabaYuklanyapti, setTalabaYuklanyapti] = useState(false);
  const [tanlanganJavob, setTanlanganJavob] = useState<TalabaJavob | null>(null);
  const [toplamKazuslar, setToplamKazuslar] = useState<any[]>([]);
  const [ochiqKazuslar, setOchiqKazuslar] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    talabalarniYuklash();
  }, []);

  const talabalarniYuklash = async () => {
    try {
      const { data, error } = await supabase
        .from('talabalar')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const talabalarData: Talaba[] = (data || []).map((t: any) => ({
        id: t.id,
        ism: t.ism,
        familiya: t.familiya,
        guruh: t.guruh,
        kurs: t.kurs,
        fraud_flag: t.fraud_flag || false,
        phone: t.phone || '',
        login_id: t.login_id || '',
      }));

      setTalabalar(talabalarData);
      console.log('✅ Talabalar yuklandi:', talabalarData.length, 'ta');
    } catch (error: any) {
      console.error('❌ Talabalar yuklanmadi:', error);
      toast({ title: 'Xato', description: 'Talabalar ro\'yxatini yuklashda xatolik', variant: 'destructive' });
    }
  };

  const filtredTalabalar = talabalar
    .filter(t => {
      const kursOk = tanlanganKurs === 'barchasi' || t.kurs === tanlanganKurs;
      const guruhOk = tanlanganGuruh === 'barchasi' || t.guruh === tanlanganGuruh;
      const qidiruvOk = qidiruv === '' ||
        `${t.ism} ${t.familiya}`.toLowerCase().includes(qidiruv.toLowerCase());
      return kursOk && guruhOk && qidiruvOk;
    })
    .sort((a, b) => a.familiya.localeCompare(b.familiya, 'uz'));

  // Guruhlar bo'yicha guruhlash
  const guruhlarMap: Record<string, Record<string, Talaba[]>> = {};
  filtredTalabalar.forEach(t => {
    if (!guruhlarMap[t.kurs]) guruhlarMap[t.kurs] = {};
    if (!guruhlarMap[t.kurs][t.guruh]) guruhlarMap[t.kurs][t.guruh] = [];
    guruhlarMap[t.kurs][t.guruh].push(t);
  });

  const talabaJavoblariniYuklash = async (talaba: Talaba) => {
    setTanlanganTalaba(talaba);
    setTalabaYuklanyapti(true);
    setTalabaJavoblari([]);
    setTanlanganJavob(null);

    const fullName = `${talaba.ism} ${talaba.familiya}`;
    try {
      const { data: javoblar, error } = await supabase
        .from('javoblar')
        .select('*')
        .eq('oquvchi_ismi', fullName)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!javoblar || javoblar.length === 0) {
        setTalabaJavoblari([]);
        setTalabaYuklanyapti(false);
        return;
      }

      // Har bir javob uchun toplam mavzusini olish
      const kodlar = [...new Set(javoblar.map(j => j.toplam_kod))];
      const { data: toplamlar } = await supabase
        .from('toplamlar')
        .select('kod, mavzu, kazuslar')
        .in('kod', kodlar);

      const toplamMap: Record<string, { mavzu: string; kazuslar: any[] }> = {};
      (toplamlar || []).forEach(t => {
        toplamMap[t.kod] = { mavzu: t.mavzu || 'Mavzusiz', kazuslar: t.kazuslar || [] };
      });

      const boyitilgan = javoblar.map(j => ({
        ...j,
        toplam_mavzu: toplamMap[j.toplam_kod]?.mavzu || 'Mavzusiz',
        _kazuslar: toplamMap[j.toplam_kod]?.kazuslar || [],
      }));

      setTalabaJavoblari(boyitilgan as any);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Javoblarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setTalabaYuklanyapti(false);
    }
  };

  const javobniKor = (javob: TalabaJavob) => {
    setTanlanganJavob(javob);
    setToplamKazuslar((javob as any)._kazuslar || []);
    setOchiqKazuslar(new Set());
  };

  const kazusToggle = (idx: number) => {
    setOchiqKazuslar(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const ortachaBall = (baho: any[]) => {
    if (!baho || !baho.length) return 0;
    return Math.round(baho.reduce((s, b) => s + b.ball, 0) / baho.length);
  };

  const ballRang = (ball: number) => {
    if (ball >= 21) return 'text-green-600';
    if (ball >= 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  const ballBg = (ball: number) => {
    if (ball >= 21) return 'bg-green-100 border-green-300';
    if (ball >= 15) return 'bg-yellow-100 border-yellow-300';
    return 'bg-red-100 border-red-300';
  };

  // ─── Talaba batafsil ko'rinishi ───────────────────────────────────────────
  if (tanlanganJavob) {
    const umumiyBall = ortachaBall(tanlanganJavob.baho);
    const maksimal = tanlanganJavob.baho.length * 30;
    const foiz = maksimal ? Math.round((umumiyBall / maksimal) * 100) : 0;

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => { setTanlanganTalaba(null); setTanlanganJavob(null); }} className="hover:text-blue-600 transition-colors">Ro'yhat</button>
          <ChevronRight className="h-4 w-4" />
          <button onClick={() => setTanlanganJavob(null)} className="hover:text-blue-600 transition-colors">
            {tanlanganTalaba?.ism} {tanlanganTalaba?.familiya}
          </button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-800 font-medium">{tanlanganJavob.toplam_mavzu}</span>
        </div>

        {/* Umumiy natija kartasi */}
        <Card className="border-2 border-blue-400 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-1">{tanlanganJavob.toplam_mavzu}</h2>
                <p className="text-blue-100 text-sm">Toplam kodi: <span className="font-bold tracking-wider">{tanlanganJavob.toplam_kod}</span></p>
                <p className="text-blue-100 text-sm mt-1">
                  {new Date(tanlanganJavob.created_at).toLocaleString('uz-UZ')}
                </p>
              </div>
              <div className="text-right bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <p className="text-xs text-blue-200 mb-1">Umumiy natija</p>
                <p className={`text-5xl font-black ${foiz >= 70 ? 'text-green-300' : foiz >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>
                  {umumiyBall}
                </p>
                <p className="text-blue-200 text-sm">/ {maksimal} ball</p>
                <div className={`mt-2 text-lg font-bold ${foiz >= 70 ? 'text-green-300' : foiz >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>
                  {foiz}%
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${foiz >= 70 ? 'bg-green-400' : foiz >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${foiz}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Kazuslar bo'yicha batafsil */}
        <div className="space-y-4">
          {tanlanganJavob.baho.map((baho, idx) => {
            const kazus = toplamKazuslar[baho.kazus_index];
            const oquvchiJavob = tanlanganJavob.javoblar.find(j => j.kazus_index === baho.kazus_index);
            const ochiq = ochiqKazuslar.has(idx);

            return (
              <Card key={idx} className={`border-2 shadow-md transition-all ${ochiq ? 'border-blue-400' : 'border-gray-200 hover:border-blue-300'}`}>
                {/* Kazus header - bosish mumkin */}
                <button
                  className="w-full text-left"
                  onClick={() => kazusToggle(idx)}
                >
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 text-white font-bold w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                        {baho.kazus_index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Kazus {baho.kazus_index + 1}</p>
                        {kazus && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1 max-w-md">
                            {kazus.kazus?.slice(0, 80)}...
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`border-2 px-4 py-2 rounded-xl text-center ${ballBg(baho.ball)}`}>
                        <span className={`text-2xl font-black ${ballRang(baho.ball)}`}>{baho.ball}</span>
                        <span className="text-gray-500 text-sm"> / 30</span>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${ochiq ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </button>

                {/* Ochiq holat */}
                {ochiq && (
                  <div className="border-t border-gray-100 p-5 space-y-4">
                    {/* Kazus matni */}
                    {kazus && (
                      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">📋 Kazus matni</p>
                        <p className="text-sm text-blue-900 leading-relaxed">{kazus.kazus}</p>
                      </div>
                    )}

                    {/* To'g'ri javob */}
                    {kazus && (
                      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-xl">
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">✅ To'g'ri javob</p>
                        <p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap">{kazus.javob}</p>
                      </div>
                    )}

                    {/* O'quvchi javobi */}
                    <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-xl">
                      <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">✏️ Talaba javobi</p>
                      <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">
                        {oquvchiJavob?.javob || 'Javob berilmagan'}
                      </p>
                    </div>

                    {/* AI izohi */}
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">🤖 AI izohi</p>
                      <p className="text-sm text-amber-900 leading-relaxed">{baho.izoh}</p>
                    </div>

                    {/* Batafsil tahlil */}
                    {baho.batafsil_tahlil && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Xatolar */}
                        {baho.batafsil_tahlil.xatolar?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-3">❌ Topilgan xatolar</p>
                            <div className="space-y-2">
                              {baho.batafsil_tahlil.xatolar.map((x: any, xi: number) => (
                                <div key={xi} className={`text-xs p-2 rounded-lg border ${x.tur === 'imlo' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-100 border-red-200'}`}>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-white font-bold mr-2 text-[10px] ${x.tur === 'imlo' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                    {x.tur}
                                  </span>
                                  <span className="text-red-700">"{x.xato}"</span>
                                  <span className="text-gray-500"> → </span>
                                  <span className="text-green-700 font-semibold">"{x.togri}"</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Yetishmayotganlar */}
                        {baho.batafsil_tahlil.yetishmayotganlar?.length > 0 && (
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-3">⚠️ Yozilmay qolgan</p>
                            <ul className="space-y-1">
                              {baho.batafsil_tahlil.yetishmayotganlar.map((el: string, yi: number) => (
                                <li key={yi} className="text-xs text-orange-900 flex items-start gap-1">
                                  <span className="mt-0.5 flex-shrink-0">•</span> {el}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Orqaga tugma */}
        <button
          onClick={() => setTanlanganJavob(null)}
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-600 rounded-xl font-medium transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
          Orqaga
        </button>
      </div>
    );
  }

  // ─── Talaba javoblari ro'yhati ────────────────────────────────────────────
  if (tanlanganTalaba) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button onClick={() => setTanlanganTalaba(null)} className="hover:text-blue-600 transition-colors">Ro'yhat</button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-800 font-medium">{tanlanganTalaba.ism} {tanlanganTalaba.familiya}</span>
        </div>

        {/* Talaba profil kartasi */}
        <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <div className="flex items-center gap-5">
              <div className="bg-white/20 backdrop-blur-sm w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black">
                {tanlanganTalaba.familiya[0]}{tanlanganTalaba.ism[0]}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tanlanganTalaba.familiya} {tanlanganTalaba.ism}</h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                    {tanlanganTalaba.kurs.toUpperCase()}
                  </span>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                    Guruh: {tanlanganTalaba.guruh.toUpperCase()}
                  </span>
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                    {talabaJavoblari.length} ta test
                  </span>
                  {tanlanganTalaba.phone && (
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                      📱 {tanlanganTalaba.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Javoblar ro'yhati */}
        {talabaYuklanyapti ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-500">Yuklanmoqda...</p>
            </CardContent>
          </Card>
        ) : talabaJavoblari.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-500">Hali test topshirmagan</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {talabaJavoblari.map((javob, idx) => {
              const oball = ortachaBall(javob.baho);
              const maks = javob.baho.length * 30;
              const f = maks ? Math.round((oball / maks) * 100) : 0;
              return (
                <Card
                  key={javob.id}
                  className="border-2 border-gray-200 hover:border-blue-400 cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => javobniKor(javob)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 text-blue-700 font-bold w-10 h-10 rounded-xl flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-lg">{javob.toplam_mavzu}</p>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                              #{javob.toplam_kod}
                            </span>
                            <span>{new Date(javob.created_at).toLocaleDateString('uz-UZ')}</span>
                            <span>{javob.baho.length} ta kazus</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className={`text-3xl font-black ${ballRang(oball)}`}>{oball}</span>
                          <span className="text-gray-400 text-sm"> / {maks}</span>
                          <div className={`text-sm font-semibold mt-0.5 ${ballRang(oball)}`}>{f}%</div>
                        </div>
                        {/* Mini progress ring */}
                        <div className="relative w-12 h-12">
                          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                            <circle
                              cx="18" cy="18" r="15" fill="none"
                              stroke={f >= 70 ? '#16a34a' : f >= 50 ? '#ca8a04' : '#dc2626'}
                              strokeWidth="3"
                              strokeDasharray={`${(f / 100) * 94.2} 94.2`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <ChevronRight className="absolute inset-0 m-auto h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Orqaga */}
        <button
          onClick={() => setTanlanganTalaba(null)}
          className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-600 rounded-xl font-medium transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
          Orqaga
        </button>
      </div>
    );
  }

  // ─── Asosiy ro'yhat ko'rinishi ────────────────────────────────────────────
  const jami = filtredTalabalar.length;
  const kurslarHisob: Record<string, number> = {};
  talabalar.forEach(t => {
    kurslarHisob[t.kurs] = (kurslarHisob[t.kurs] || 0) + 1;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Talabalar Ro'yhati</h1>
                <p className="text-blue-100 text-sm mt-1">
                  Jami {talabalar.length} ta talaba ro'yxatdan o'tgan
                </p>
              </div>
            </div>
            {/* Kurs statistikasi */}
            <div className="hidden md:flex items-center gap-3">
              {KURSLAR.map(k => (
                <div key={k} className="bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl text-center">
                  <p className="text-lg font-black">{kurslarHisob[k] || 0}</p>
                  <p className="text-blue-200 text-xs">{k}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Filter va qidiruv */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Qidiruv */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Familiya yoki ism bo'yicha qidirish..."
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                className="pl-9 border-gray-300 focus:border-blue-400"
              />
              {qidiruv && (
                <button onClick={() => setQidiruv('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Kurs filtri */}
            <select
              value={tanlanganKurs}
              onChange={e => setTanlanganKurs(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 bg-white text-sm font-medium"
            >
              <option value="barchasi">Barcha kurslar</option>
              {KURSLAR.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>

            {/* Guruh filtri */}
            <select
              value={tanlanganGuruh}
              onChange={e => setTanlanganGuruh(e.target.value)}
              className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-400 bg-white text-sm font-medium"
            >
              <option value="barchasi">Barcha guruhlar</option>
              {GURUHLAR.map(g => (
                <option key={g} value={g}>{g.toUpperCase()}</option>
              ))}
            </select>

            {/* Natija */}
            <span className="text-sm text-gray-500 font-medium">
              {jami} ta topildi
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Talabalar ro'yhati - kurs va guruh bo'yicha */}
      {jami === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <Users className="h-20 w-20 text-gray-300 mx-auto mb-4" />
            <p className="text-xl font-medium text-gray-500">
              {talabalar.length === 0 ? 'Hali talabalar ro\'yxatdan o\'tmagan' : 'Qidiruv bo\'yicha talaba topilmadi'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(guruhlarMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([kurs, guruhlar]) => (
              <div key={kurs} className="space-y-4">
                {/* Kurs sarlavhasi */}
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold uppercase tracking-wide">
                    {kurs}
                  </div>
                  <div className="flex-1 h-0.5 bg-blue-100" />
                  <span className="text-sm text-gray-500">
                    {Object.values(guruhlar).reduce((s, a) => s + a.length, 0)} ta
                  </span>
                </div>

                {Object.entries(guruhlar)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([guruh, oqituvchilar]) => (
                    <Card key={guruh} className="border border-gray-200 shadow-sm overflow-hidden">
                      {/* Guruh header */}
                      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <BookOpen className="h-5 w-5 text-blue-600" />
                          <span className="font-bold text-gray-800 text-lg">
                            Guruh: {guruh.toUpperCase()}
                          </span>
                        </div>
                        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                          {oqituvchilar.length} talaba
                        </div>
                      </div>

                      {/* Talabalar ro'yhati */}
                      <div className="divide-y divide-gray-100">
                        {oqituvchilar.map((talaba, idx) => (
                          <button
                            key={idx}
                            onClick={() => talabaJavoblariniYuklash(talaba)}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-blue-50 transition-colors group"
                          >
                            <div className="flex items-center gap-4">
                              {/* Tartib raqami */}
                              <span className="w-8 text-sm font-semibold text-gray-400 text-right">
                                {idx + 1}.
                              </span>
                              {/* Avatar */}
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                                {talaba.familiya[0]?.toUpperCase()}
                              </div>
                              {/* Ism */}
                              <div className="text-left">
                                <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                                  {talaba.familiya} {talaba.ism}
                                  {talaba.fraud_flag && (
                                    <span title="Admin ko'rib chiqish kutilmoqda" className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex-shrink-0">!</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Star className="h-4 w-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </Card>
                  ))}
              </div>
            ))}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.35s ease-out; }
      `}</style>
    </div>
  );
}
