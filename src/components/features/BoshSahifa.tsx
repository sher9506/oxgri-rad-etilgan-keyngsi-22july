import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, Users, Star, Sparkles, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/contexts/LangContext';

interface OquvchiReyting {
  ism_familiya: string;
  kurs: string;
  guruh: string;
  umumiyBall: number;
  testlarSoni: number;
  ortachaBall: number;
}

const motivatsionShiorlar: Record<string, string[]> = {
  uz: [
    "⚖️ Bugungi harakatingiz — ertangi muvaffaqiyat poydevori!",
    "🏛️ Bilim — eng qimmatli boylik, uni to'plang!",
    "📜 Har bir test — yangi imkoniyat!",
    "⚖️ Muvaffaqiyat yo'lida birinchi qadam — harakat!",
    "🏆 Eng yaxshi o'quvchi bo'lish — sizning qo'lingizda!",
    "📚 Bilim olish — eng katta g'alaba!",
    "🎓 Kelajak bugun boshlangan harakatlaringizda!",
    "⚖️ Har kuni yangi natijaga erishish mumkin!",
  ],
  ru: [
    "⚖️ Ваши действия сегодня — фундамент завтрашнего успеха!",
    "🏛️ Знание — самое ценное богатство, накапливайте его!",
    "📜 Каждый тест — новая возможность!",
    "⚖️ Первый шаг к успеху — действие!",
    "🏆 Стать лучшим учащимся — в ваших руках!",
    "📚 Получать знания — величайшая победа!",
    "🎓 Будущее начинается с действий, которые вы предпринимаете сегодня!",
    "⚖️ Каждый день можно достичь нового результата!",
  ],
  en: [
    "⚖️ Today's actions are the foundation of tomorrow's success!",
    "🏛️ Knowledge is the most valuable wealth, accumulate it!",
    "📜 Every test is a new opportunity!",
    "⚖️ The first step to success is action!",
    "🏆 Becoming the best student is in your hands!",
    "📚 Gaining knowledge is the greatest victory!",
    "🎓 The future begins with the actions you take today!",
    "⚖️ Every day you can achieve a new result!",
  ],
};

export default function BoshSahifa() {
  const { t, lang } = useLang();
  const [reyting, setReyting] = useState<OquvchiReyting[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [shiori, setShiori] = useState('');
  const [jamiOquvchilar, setJamiOquvchilar] = useState(0);
  const [jamiTestlar, setJamiTestlar] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    reytingniYuklash();
    const shiorlar = motivatsionShiorlar[lang] || motivatsionShiorlar.uz;
    setShiori(shiorlar[Math.floor(Math.random() * shiorlar.length)]);
  }, [lang]);

  const reytingniYuklash = async () => {
    setYuklanyapti(true);
    try {
      const [javoblarResult, talabalarResult] = await Promise.all([
        supabase.from('javoblar').select('oquvchi_ismi, baho, created_at'),
        supabase.from('talabalar').select('ism, familiya, kurs, guruh'),
      ]);
      if (javoblarResult.error) throw javoblarResult.error;
      if (talabalarResult.error) throw talabalarResult.error;

      const javoblar = javoblarResult.data || [];
      const talabalar = talabalarResult.data || [];
      setJamiOquvchilar(talabalar.length);

      const talabalarMap = new Map<string, { kurs: string; guruh: string }>();
      talabalar.forEach((talaba: any) => {
        talabalarMap.set(`${talaba.ism} ${talaba.familiya}`, { kurs: talaba.kurs || '?', guruh: talaba.guruh || '?' });
      });

      if (!javoblar || javoblar.length === 0) { setReyting([]); setJamiTestlar(0); setYuklanyapti(false); return; }

      const oquvchilarMap = new Map<string, { balllar: number[] }>();
      javoblar.forEach((javob: any) => {
        const ismi = javob.oquvchi_ismi;
        const baho = javob.baho as any[];
        if (!baho || baho.length === 0) return;
        const umumiyBall = baho.reduce((sum: number, b: any) => sum + (b.ball || 0), 0);
        if (!oquvchilarMap.has(ismi)) oquvchilarMap.set(ismi, { balllar: [] });
        oquvchilarMap.get(ismi)!.balllar.push(umumiyBall);
      });

      setJamiTestlar(Array.from(oquvchilarMap.values()).reduce((s, d) => s + d.balllar.length, 0));

      const reytingMassiv: OquvchiReyting[] = Array.from(oquvchilarMap.entries()).map(([ismi, data]) => {
        const umumiyBall = data.balllar.reduce((a, b) => a + b, 0);
        const testlarSoni = data.balllar.length;
        const talabaInfo = talabalarMap.get(ismi);
        return { ism_familiya: ismi, kurs: talabaInfo?.kurs || '?', guruh: talabaInfo?.guruh || '?', umumiyBall, testlarSoni, ortachaBall: Math.round(umumiyBall / testlarSoni) };
      });

      reytingMassiv.sort((a, b) => b.umumiyBall - a.umumiyBall);
      setReyting(reytingMassiv);
    } catch (error: any) {
      toast({ title: t('common.error'), description: t('home.loading'), variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-10 w-10 text-amber-500" />;
    if (index === 1) return <Medal className="h-10 w-10 text-slate-400" />;
    if (index === 2) return <Medal className="h-10 w-10 text-amber-700" />;
    return null;
  };

  const getRowClass = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-amber-50/80 via-amber-100/90 to-amber-50/80 border-[3px] border-amber-400/60 shadow-[0_8px_30px_rgba(245,158,11,0.25)]';
    if (index === 1) return 'bg-gradient-to-r from-slate-50/80 via-slate-100/90 to-slate-50/80 border-[3px] border-slate-300/60 shadow-[0_8px_30px_rgba(148,163,184,0.25)]';
    if (index === 2) return 'bg-gradient-to-r from-amber-100/70 via-amber-200/80 to-amber-100/70 border-[3px] border-amber-600/60 shadow-[0_8px_30px_rgba(217,119,6,0.25)]';
    return 'bg-white/90 border-2 border-gray-200/50 hover:border-amber-300/70 transition-all duration-300';
  };

  const getOrinText = (index: number) => {
    if (index === 0) return t('home.place_1');
    if (index === 1) return t('home.place_2');
    if (index === 2) return t('home.place_3');
    return `${index + 1}`;
  };

  if (yuklanyapti) return (
    <div className="max-w-7xl mx-auto">
      <Card>
        <CardContent className="py-20 text-center">
          <div className="animate-spin h-16 w-16 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-500 mt-4 text-lg">{t('home.loading')}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Banner */}
      <Card className="border-0 shadow-[0_20px_60px_rgba(217,119,6,0.3)] overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 text-white p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-20"><Sparkles className="h-48 w-48 text-white" /></div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30">
                <Target className="h-12 w-12 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2 tracking-tight">{t('home.rating_title')}</h1>
                <p className="text-xl text-white/95 font-medium">{shiori}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t('home.total_students'), value: jamiOquvchilar, icon: Users, color: 'emerald' },
          { label: t('home.total_tests'), value: jamiTestlar, icon: TrendingUp, color: 'teal' },
          { label: t('home.top_score'), value: reyting.length > 0 ? reyting[0].umumiyBall : 0, icon: Star, color: 'amber' },
        ].map((s, i) => (
          <Card key={i} className={`border-2 border-${s.color}-200/50 bg-gradient-to-br from-${s.color}-50/80 to-${s.color}-100/90 hover:scale-[1.02] transition-all`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`bg-gradient-to-br from-${s.color}-500 to-${s.color}-600 p-4 rounded-2xl shadow-lg`}>
                  <s.icon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className={`text-sm text-${s.color}-700 font-semibold`}>{s.label}</p>
                  <p className={`text-4xl font-bold text-${s.color}-900 tracking-tight`}>{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-2 border-blue-600 shadow-2xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8" />
            <CardTitle className="text-3xl">{t('home.students_rating')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reyting.length === 0 ? (
            <div className="py-20 text-center text-gray-500">
              <Trophy className="h-20 w-20 mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-medium">{t('home.no_results')}</p>
              <p className="text-sm mt-2">{t('home.no_results_desc')}</p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {reyting.map((oquvchi, index) => (
                <div key={index} className={`${getRowClass(index)} rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02]`}>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg border-2 border-gray-200">
                      {getMedalIcon(index) || <span className="text-3xl font-bold text-gray-700">{index + 1}</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className={`text-2xl font-bold ${index===0?'text-amber-700':index===1?'text-slate-700':index===2?'text-amber-800':'text-gray-900'}`}>
                          {oquvchi.ism_familiya}
                        </h3>
                        {index < 3 && (
                          <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-lg ${index===0?'bg-gradient-to-r from-amber-500 to-yellow-500 text-white':index===1?'bg-gradient-to-r from-slate-400 to-slate-500 text-white':'bg-gradient-to-r from-amber-700 to-amber-800 text-white'}`}>
                            {getOrinText(index)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
                        <span>📚 {oquvchi.kurs}-{t('home.course')}</span>
                        <span>👥 {oquvchi.guruh} {t('home.group')}</span>
                        <span>📝 {oquvchi.testlarSoni} {t('home.test_count')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 font-semibold mb-1">{t('home.total_score')}</p>
                      <p className={`text-5xl font-bold tracking-tight ${index===0?'text-amber-600':index===1?'text-slate-600':index===2?'text-amber-700':'text-emerald-600'}`}>
                        {oquvchi.umumiyBall}
                      </p>
                      <div className="bg-white/80 rounded-xl px-4 py-2 border-2 border-gray-200/50 shadow-md mt-2">
                        <p className="text-xs text-gray-500 font-medium">{t('home.avg_label')}</p>
                        <p className="text-2xl font-bold text-gray-700">{oquvchi.ortachaBall}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-2 border-amber-200/50 bg-gradient-to-r from-amber-50/80 to-yellow-50/80 shadow-sm">
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-3 rounded-full shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 mb-1 text-lg">{t('home.how_calc')}</h3>
              <p className="text-sm text-amber-800/90">{t('home.how_calc_desc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s ease-out; }
      `}</style>
    </div>
  );
}
