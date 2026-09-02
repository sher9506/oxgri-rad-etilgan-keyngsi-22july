import { CheckCircle2, XCircle, AlertTriangle, Lightbulb, Award, BookOpen, X, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MaxsusMezonTahlil {
  nom: string;
  ball: number;
  maksimal: number;
  sabab: string;
}

interface ImloXato {
  xato: string;
  togri: string;
  tur: 'imlo';
}

interface QoshimchaMezonNatija {
  index: number;
  shart: string;
  bajarildi: boolean;
  delta_ball: number;
  sabab: string;
}

interface BatafilTahlil {
  mazmun_moslik_foiz: number;
  mazmun_ball: number;
  mazmun_izoh: string;
  maxsus_mezonlar: MaxsusMezonTahlil[];
  imlo_xatolar: ImloXato[];
  yetishmayotganlar: string[];
  umumiy_xulosa: string;
  qoshimcha_mezonlar_natija?: QoshimchaMezonNatija[];
  qoshimcha_delta_ball?: number;
}

interface JavobTahlilProps {
  tahlil: BatafilTahlil;
  ball: number;
  maksimalBall: number;
  onClose: () => void;
}

export default function JavobTahlil({ tahlil, ball, maksimalBall, onClose }: JavobTahlilProps) {
  const getMoslikRangi = (foiz: number) => {
    if (foiz >= 90) return 'bg-green-500';
    if (foiz >= 70) return 'bg-blue-500';
    if (foiz >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMoslikMatn = (foiz: number) => {
    if (foiz === 100) return 'A\'lo! 🏆';
    if (foiz >= 90) return 'Juda yaxshi';
    if (foiz >= 70) return 'Yaxshi';
    if (foiz >= 50) return 'O\'rtacha';
    return 'Yaxshilanishi kerak';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 border-[hsl(221,83%,53%)] animate-scale-in">
        <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl">Batafsil tahlil</CardTitle>
                <p className="text-sm text-blue-100 mt-1">
                  Umumiy ball: <span className="font-bold text-[hsl(43,96%,56%)]">{ball}</span> / {maksimalBall}
                </p>
              </div>
            </div>
            <Button onClick={onClose} variant="secondary" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* 1. MAZMUNIY MOSLIK */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500 p-2 rounded-lg">
                <Award className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-blue-900">1. Mazmuniy moslik</h3>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Ustoz javobiga moslik:</span>
                <span className="text-2xl font-bold text-blue-700">{tahlil.mazmun_moslik_foiz}%</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getMoslikRangi(tahlil.mazmun_moslik_foiz)} transition-all duration-500 rounded-full flex items-center justify-end px-2`}
                  style={{ width: `${tahlil.mazmun_moslik_foiz}%` }}
                >
                  <span className="text-xs font-bold text-white">{getMoslikMatn(tahlil.mazmun_moslik_foiz)}</span>
                </div>
              </div>
            </div>

            {/* Ball */}
            <div className="bg-white rounded-lg p-4 mb-4 border-2 border-blue-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Mazmun uchun ball:</span>
                <span className="text-3xl font-bold text-blue-600">
                  {tahlil.mazmun_ball} <span className="text-lg text-gray-500">ball</span>
                </span>
              </div>
            </div>

            {/* Batafsil izoh */}
            <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
              <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Batafsil tahlil:
              </h4>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{tahlil.mazmun_izoh}</p>
            </div>
          </div>

          {/* 2. MAXSUS MEZONLAR */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-500 p-2 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-purple-900">2. Maxsus mezonlar</h3>
            </div>

            <div className="space-y-3">
              {tahlil.maxsus_mezonlar.map((mezon, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border-2 border-purple-200">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded min-w-[24px] text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">{mezon.nom}</h4>
                        <p className="text-sm text-gray-600 leading-relaxed">{mezon.sabab}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-purple-100 px-3 py-1 rounded-lg">
                      {mezon.ball === mezon.maksimal ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-bold text-purple-700">
                        {mezon.ball}/{mezon.maksimal}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Jami ball */}
            <div className="bg-white rounded-lg p-4 mt-4 border-2 border-purple-300">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Maxsus mezonlar jami:</span>
                <span className="text-2xl font-bold text-purple-600">
                  {tahlil.maxsus_mezonlar.reduce((sum, m) => sum + m.ball, 0)} / {tahlil.maxsus_mezonlar.length}
                  <span className="text-lg text-gray-500"> ball</span>
                </span>
              </div>
            </div>
          </div>

          {/* 3. IMLO XATOLAR */}
          {tahlil.imlo_xatolar.length > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-red-500 p-2 rounded-lg">
                  <XCircle className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-red-900">
                  3. Imlo xatolar ({tahlil.imlo_xatolar.length} ta) • -2 ball
                </h3>
              </div>

              <div className="space-y-3">
                {tahlil.imlo_xatolar.map((xato, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border-l-4 border-red-400">
                    <div className="flex items-start gap-3">
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded min-w-[24px] text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">❌ Siz yozgan:</p>
                          <p className="text-sm bg-red-100 text-red-800 px-3 py-2 rounded font-mono">
                            {xato.xato}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-1">✅ To'g'ri yozilishi:</p>
                          <p className="text-sm bg-green-100 text-green-800 px-3 py-2 rounded font-mono">
                            {xato.togri}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. YETISHMAYOTGAN MA'LUMOTLAR */}
          {tahlil.yetishmayotganlar.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-yellow-500 p-2 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-yellow-900">
                  4. Javobda yozilmay qolgan ({tahlil.yetishmayotganlar.length} ta)
                </h3>
              </div>

              <ul className="space-y-2">
                {tahlil.yetishmayotganlar.map((element, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-white p-4 rounded-lg border-l-4 border-yellow-400">
                    <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded min-w-[24px] text-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-gray-700 leading-relaxed flex-1">{element}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* QO'SHIMCHA MEZONLAR NATIJASI */}
          {tahlil.qoshimcha_mezonlar_natija && tahlil.qoshimcha_mezonlar_natija.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-300 rounded-xl p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-purple-500 p-2 rounded-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-purple-900">
                  {tahlil.imlo_xatolar.length > 0 ? String(Number(Object.keys(tahlil).indexOf('qoshimcha_mezonlar_natija')) + 3) : '3'}. Ustoz qo'shimcha mezonlari
                  {(tahlil.qoshimcha_delta_ball ?? 0) > 0 && (
                    <span className="ml-2 text-green-600 font-bold">+{tahlil.qoshimcha_delta_ball} ball</span>
                  )}
                  {(tahlil.qoshimcha_delta_ball ?? 0) < 0 && (
                    <span className="ml-2 text-red-600 font-bold">{tahlil.qoshimcha_delta_ball} ball</span>
                  )}
                </h3>
              </div>

              <div className="space-y-3">
                {tahlil.qoshimcha_mezonlar_natija.map((mezon, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 border-2 ${
                      mezon.bajarildi
                        ? 'bg-green-50 border-green-300'
                        : 'bg-red-50 border-red-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`p-1.5 rounded-full flex-shrink-0 ${
                            mezon.bajarildi ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        >
                          {mezon.bajarildi ? (
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          ) : (
                            <XCircle className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 mb-1">{mezon.shart}</p>
                          <p className="text-sm text-gray-600">{mezon.sabab}</p>
                        </div>
                      </div>
                      <div
                        className={`text-2xl font-bold flex-shrink-0 ${
                          mezon.bajarildi ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {mezon.delta_ball > 0 ? '+' : ''}{mezon.delta_ball}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`mt-4 rounded-lg p-3 flex items-center justify-between border-2 ${
                (tahlil.qoshimcha_delta_ball ?? 0) >= 0
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}>
                <span className="font-semibold text-gray-700">Qo'shimcha mezonlar ta'siri:</span>
                <span className={`text-2xl font-bold ${
                  (tahlil.qoshimcha_delta_ball ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(tahlil.qoshimcha_delta_ball ?? 0) > 0 ? '+' : ''}{tahlil.qoshimcha_delta_ball ?? 0} ball
                </span>
              </div>
            </div>
          )}

          {/* UMUMIY XULOSA */}
          <div className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <Lightbulb className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Umumiy xulosa</h3>
            </div>
            <p className="text-blue-50 leading-relaxed text-lg">{tahlil.umumiy_xulosa}</p>
          </div>
        </CardContent>
      </Card>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
