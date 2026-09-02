import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, User, FileText, BarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Toplam, Javob } from '@/types';

interface UstozStatistikaProps {
  ustozId: string;
}

interface OquvchiStatistika {
  oquvchi_ismi: string;
  testlar_soni: number;
  ortacha_ball: number;
  natijalar: {
    toplam_kod: string;
    ball: number;
    sana: string;
  }[];
}

export default function UstozStatistika({ ustozId }: UstozStatistikaProps) {
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [statistika, setStatistika] = useState<OquvchiStatistika[]>([]);
  const [tanlanganOquvchi, setTanlanganOquvchi] = useState<OquvchiStatistika | null>(null);
  const { toast } = useToast();

  const ortachaBallHisoblash = (baho: any[]) => {
    if (!baho || baho.length === 0) return 0;
    return Math.round(baho.reduce((sum: number, b: any) => sum + b.ball, 0) / baho.length);
  };

  useEffect(() => {
    statistikaniYuklash();
  }, []);

  const statistikaniYuklash = async () => {
    setYuklanyapti(true);
    try {
      // 1. Ustoz toplamlarini olish
      const { data: toplamlar, error: toplamlarError } = await supabase
        .from('toplamlar')
        .select('kod')
        .eq('ustoz_id', ustozId);

      if (toplamlarError) throw toplamlarError;

      if (!toplamlar || toplamlar.length === 0) {
        setStatistika([]);
        setYuklanyapti(false);
        return;
      }

      const toplamKodlari = toplamlar.map(t => t.kod);

      // 2. Ushbu toplamlar uchun barcha javoblarni olish
      const { data: javoblar, error: javoblarError } = await supabase
        .from('javoblar')
        .select('*')
        .in('toplam_kod', toplamKodlari);

      if (javoblarError) throw javoblarError;

      if (!javoblar || javoblar.length === 0) {
        setStatistika([]);
        setYuklanyapti(false);
        return;
      }

      // 3. O'quvchilar bo'yicha guruhlash
      const oquvchilarMap = new Map<string, OquvchiStatistika>();

      (javoblar as Javob[]).forEach(javob => {
        const ortachaBall = ortachaBallHisoblash(javob.baho);
        
        if (!oquvchilarMap.has(javob.oquvchi_ismi)) {
          oquvchilarMap.set(javob.oquvchi_ismi, {
            oquvchi_ismi: javob.oquvchi_ismi,
            testlar_soni: 0,
            ortacha_ball: 0,
            natijalar: [],
          });
        }

        const oquvchi = oquvchilarMap.get(javob.oquvchi_ismi)!;
        oquvchi.testlar_soni++;
        oquvchi.natijalar.push({
          toplam_kod: javob.toplam_kod,
          ball: ortachaBall,
          sana: javob.created_at,
        });
      });

      // 4. O'rtacha ballni hisoblash va saralash
      const statistikaArray = Array.from(oquvchilarMap.values()).map(oq => ({
        ...oq,
        ortacha_ball: Math.round(
          oq.natijalar.reduce((sum, n) => sum + n.ball, 0) / oq.natijalar.length
        ),
      }));

      // Reytingi bo'yicha saralash (yuqoridan pastga)
      statistikaArray.sort((a, b) => b.ortacha_ball - a.ortacha_ball);

      setStatistika(statistikaArray);
    } catch (error: any) {
      console.error('Xato:', error);
      toast({
        title: 'Xato',
        description: 'Statistikani yuklashda xatolik',
        variant: 'destructive',
      });
    } finally {
      setYuklanyapti(false);
    }
  };

  const getReyting = (index: number) => {
    if (index === 0) return { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-300', label: '🥇 1-o\'rin' };
    if (index === 1) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-300', label: '🥈 2-o\'rin' };
    if (index === 2) return { icon: Award, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300', label: '🥉 3-o\'rin' };
    return { icon: User, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: `${index + 1}-o\'rin` };
  };

  const getBallColor = (ball: number) => {
    if (ball >= 21) return 'text-green-600';
    if (ball >= 15) return 'text-blue-600';
    if (ball >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (yuklanyapti) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-20 text-center">
            <div className="animate-spin h-16 w-16 border-4 border-[hsl(221,83%,53%)] border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4 text-lg">Statistika yuklanmoqda...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (statistika.length === 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-20 text-center text-gray-500">
            <BarChart className="h-20 w-20 mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-medium">Hali statistika yo'q</p>
            <p className="text-sm mt-2">O'quvchilar test yechganda statistika paydo bo'ladi</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Batafsil ko'rinish
  if (tanlanganOquvchi) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <Card className="border-2 border-[hsl(221,83%,53%)]">
          <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{tanlanganOquvchi.oquvchi_ismi}</CardTitle>
                <div className="flex items-center gap-6 text-sm text-blue-100">
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {tanlanganOquvchi.testlar_soni} ta test
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    O'rtacha: {tanlanganOquvchi.ortacha_ball} ball
                  </span>
                </div>
              </div>
              <button
                onClick={() => setTanlanganOquvchi(null)}
                className="text-white hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
              >
                Orqaga
              </button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4">
          {tanlanganOquvchi.natijalar.map((natija, idx) => (
            <Card key={idx} className="hover:shadow-lg transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-lg text-[hsl(221,83%,53%)]">
                      Toplam: {natija.toplam_kod}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(natija.sana).toLocaleString('uz-UZ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-4xl font-bold ${getBallColor(natija.ball)}`}>
                      {natija.ball}
                    </p>
                    <p className="text-sm text-gray-500">/ 30 ball</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Reytingli ro'yxat
  const top3 = statistika.slice(0, 3);
  
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="border-2 border-[hsl(221,83%,53%)] shadow-xl">
        <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[hsl(43,96%,56%)] p-3 rounded-xl">
                <Trophy className="h-8 w-8 text-[hsl(221,83%,53%)]" />
              </div>
              <div>
                <CardTitle className="text-2xl">O'quvchilar Reytingi</CardTitle>
                <p className="text-blue-100 text-sm mt-1">
                  Jami {statistika.length} o'quvchi
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* TOP 3 Podium */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* 2-o'rin */}
          <Card className="hover:shadow-xl transition-all cursor-pointer border-2 border-gray-300 mt-8 animate-scale-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="bg-gradient-to-br from-gray-100 to-gray-50 text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="bg-gray-200 p-4 rounded-full">
                  <Medal className="h-12 w-12 text-gray-500" />
                </div>
              </div>
              <div className="text-4xl font-bold mb-1">🥈</div>
              <CardTitle className="text-lg">{top3[1].oquvchi_ismi}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">O'rtacha ball</p>
                <p className="text-4xl font-bold text-gray-400">{top3[1].ortacha_ball}</p>
                <p className="text-sm text-gray-500">/ 30 ball</p>
              </div>
            </CardContent>
          </Card>

          {/* 1-o'rin */}
          <Card 
            className="hover:shadow-2xl transition-all cursor-pointer border-4 border-yellow-400 animate-scale-in"
            onClick={() => setTanlanganOquvchi(top3[0])}
          >
            <CardHeader className="bg-gradient-to-br from-yellow-100 to-yellow-50 text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="bg-yellow-200 p-4 rounded-full animate-pulse-slow">
                  <Trophy className="h-16 w-16 text-yellow-600" />
                </div>
              </div>
              <div className="text-5xl font-bold mb-1">🥇</div>
              <CardTitle className="text-xl">{top3[0].oquvchi_ismi}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">O'rtacha ball</p>
                <p className="text-5xl font-bold text-yellow-600">{top3[0].ortacha_ball}</p>
                <p className="text-sm text-gray-500">/ 30 ball</p>
              </div>
            </CardContent>
          </Card>

          {/* 3-o'rin */}
          <Card className="hover:shadow-xl transition-all cursor-pointer border-2 border-orange-300 mt-8 animate-scale-in" style={{ animationDelay: '0.2s' }}>
            <CardHeader className="bg-gradient-to-br from-orange-100 to-orange-50 text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className="bg-orange-200 p-4 rounded-full">
                  <Award className="h-12 w-12 text-orange-700" />
                </div>
              </div>
              <div className="text-4xl font-bold mb-1">🥉</div>
              <CardTitle className="text-lg">{top3[2].oquvchi_ismi}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">O'rtacha ball</p>
                <p className="text-3xl font-bold text-orange-600">{top3[2].ortacha_ball}</p>
                <p className="text-sm text-gray-500">/ 30 ball</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Qolgan o'quvchilar ro'yxati */}
      <div className="space-y-3">
        {statistika.map((oquvchi, index) => {
          const reyting = getReyting(index);
          const Icon = reyting.icon;
          
          return (
            <Card
              key={index}
              className={`hover:shadow-lg transition-all cursor-pointer border-2 ${reyting.border} animate-slide-in`}
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => setTanlanganOquvchi(oquvchi)}
            >
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Reyting */}
                  <div className={`${reyting.bg} ${reyting.color} p-3 rounded-lg min-w-[60px] text-center`}>
                    <Icon className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-xs font-bold">{index + 1}</p>
                  </div>

                  {/* O'quvchi ma'lumotlari */}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{oquvchi.oquvchi_ismi}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {oquvchi.testlar_soni} ta test
                      </span>
                    </div>
                  </div>

                  {/* Ball */}
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">O'rtacha ball</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-lg font-bold ${getBallColor(oquvchi.ortacha_ball)}`}>
                        {oquvchi.ortacha_ball}
                      </span>
                      <span className="text-sm text-gray-500">/ 30</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-slide-in {
          animation: slide-in 0.4s ease-out backwards;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out backwards;
        }

        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
