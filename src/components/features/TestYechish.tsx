import { useState, useEffect, useRef } from 'react';
import { Loader2, Clock, Award, Check, Link2, MessageSquare, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { createPortal } from 'react-dom';

export default function TestYechish({ startKod, oquvchiIsmi, isUstoz, onOrqaga }: any) {
  const [bosqich, setBosqich] = useState<'javob' | 'natija'>('javob');
  const [test, setTest] = useState<any>(null);
  const [randomizedSavollar, setRandomizedSavollar] = useState<any[]>([]);
  const [javoblar, setJavoblar] = useState<number[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [qolganVaqt, setQolganVaqt] = useState<number>(0);
  const [currentQ, setCurrentQ] = useState(0); 
  const { toast } = useToast();
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const { data, error } = await supabase.from('testlar').select('*').eq('kod', startKod).single();
        if (data) {
          // Qayta yechishga ruxsat tekshiruvi
          if (!isUstoz && !data.allow_retake) {
            const { data: avvalgiJavob } = await supabase
              .from('test_javoblar')
              .select('id')
              .eq('test_kod', startKod)
              .eq('oquvchi_ismi', oquvchiIsmi)
              .maybeSingle();
            if (avvalgiJavob) {
              toast({
                title: "Qayta yechishga ruxsat yo'q",
                description: "Siz bu testni allaqachon yechgansiz. Ustoz qayta yechishga ruxsat bermagan.",
                variant: 'destructive'
              });
              onOrqaga();
              return;
            }
          }
          const originalSavollar = data.savollar || [];
          const shuffledSavollar = [...originalSavollar].sort(() => Math.random() - 0.5).map((savol: any) => {
            const correctVariantText = savol.variantlar[savol.togriJavob];
            const shuffledVariants = [...savol.variantlar].sort(() => Math.random() - 0.5);
            return { ...savol, variantlar: shuffledVariants, togriJavob: shuffledVariants.indexOf(correctVariantText) };
          });
          setTest(data); setRandomizedSavollar(shuffledSavollar); setJavoblar(new Array(shuffledSavollar.length).fill(-1));
          setQolganVaqt(data.timer_turi === 'individual' ? (shuffledSavollar[0]?.vaqt_sekund || 30) : ((data.vaqt_daqiqa || 30) * 60));
        }
      } catch (e) { toast({ title: "Xato", description: "Test yuklanmadi", variant: "destructive" }); }
      finally { setYuklanyapti(false); }
    };
    fetchTest();
  }, [startKod]);

  useEffect(() => {
    if (!test || bosqich !== 'javob') return;
    if (qolganVaqt > 0) {
      const timer = setInterval(() => setQolganVaqt(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (qolganVaqt === 0) {
      test.timer_turi === 'individual' ? handleNextQuestion() : yakunlash();
    }
  }, [qolganVaqt, bosqich, test]);

  const handleNextQuestion = () => {
    if (currentQ < randomizedSavollar.length - 1) {
      const nextIdx = currentQ + 1;
      setCurrentQ(nextIdx); setQolganVaqt(randomizedSavollar[nextIdx]?.vaqt_sekund || 30);
    } else { yakunlash(); }
  };

  const yakunlash = async () => {
    if (!test) return;
    setYuklanyapti(true);
    let t = 0;
    javoblar.forEach((j, i) => { if (j !== -1 && j === randomizedSavollar[i].togriJavob) t++; });
    const foiz = Math.round((t / randomizedSavollar.length) * 100);
    // Har bir savol uchun tanlangan javob indeksini saqlash
    const javoblarData = javoblar.map((j, i) => ({ savol_index: i, javob: j }));
    if (!isUstoz) {
      try {
        const { error } = await supabase.from('test_javoblar').insert({
          test_id: test.id,
          test_kod: startKod,
          oquvchi_ismi: oquvchiIsmi,
          javoblar: javoblarData,
          togri_soni: t,
          xato_soni: randomizedSavollar.length - t - javoblar.filter(j => j === -1).length,
          javob_berilmagan: javoblar.filter(j => j === -1).length,
          foiz,
          sarflangan_vaqt: Math.round((Date.now() - startTime.current) / 1000)
        });
        if (error) console.error('Natijani saqlashda xato:', error);
        else console.log('✅ Test natijasi saqlandi:', { togri: t, foiz });
      } catch (e) { console.error('Natijani saqlashda xato:', e); }
    }
    setBosqich('natija'); setYuklanyapti(false);
  };

  const timerElement = test ? (
    <div className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded-lg shadow-lg">
      <Clock className={`h-4 w-4 ${qolganVaqt < 60 ? 'animate-pulse' : ''}`} />
      <span className="font-mono text-lg font-black tracking-tighter">
        {test.timer_turi === 'individual' ? qolganVaqt : `${Math.floor(qolganVaqt/60)}:${String(qolganVaqt%60).padStart(2,'0')}`}
      </span>
    </div>
  ) : null;

  const portalTarget = document.getElementById('wrapper-timer-portal');

  if (yuklanyapti && !test) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 h-10 w-10" /></div>;
  if (!test) return null;

  if (bosqich === 'natija') {
    let togri = 0;
    javoblar.forEach((j, i) => { if (j !== -1 && j === randomizedSavollar[i].togriJavob) togri++; });
    const xato = javoblar.filter((j, i) => j !== -1 && j !== randomizedSavollar[i].togriJavob).length;
    const javobsiz = javoblar.filter(j => j === -1).length;
    const f = Math.round((togri / randomizedSavollar.length) * 100);
    return (
      <div className="min-h-screen bg-slate-100 pb-20 font-serif p-4">
        <div className="max-w-[860px] mx-auto space-y-5 animate-fade-in">
          {/* Natija xulosa */}
          <Card className="rounded-[2rem] shadow-2xl overflow-hidden bg-white">
            <div className={`p-8 text-white text-center ${f >= 70 ? 'bg-gradient-to-r from-green-600 to-emerald-600' : f >= 40 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
              <Award className="h-10 w-10 mx-auto mb-3 opacity-70" />
              <h2 className="text-7xl font-black">{f}%</h2>
              <p className="text-sm uppercase font-bold tracking-widest mt-2 opacity-80">{test.test_nomi}</p>
              <p className="text-xs opacity-60 mt-1">{oquvchiIsmi}</p>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-2xl text-center">
                  <p className="text-3xl font-black text-green-600">{togri}</p>
                  <p className="text-[10px] font-bold text-green-500 uppercase mt-1">✓ To'g'ri</p>
                </div>
                <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl text-center">
                  <p className="text-3xl font-black text-red-600">{xato}</p>
                  <p className="text-[10px] font-bold text-red-500 uppercase mt-1">✗ Xato</p>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 p-4 rounded-2xl text-center">
                  <p className="text-3xl font-black text-gray-500">{javobsiz}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">— Javobsiz</p>
                </div>
              </div>
              <Button onClick={onOrqaga} className="w-full h-12 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest">CHIQISH</Button>
            </CardContent>
          </Card>

          {/* Imtihon varog'i — har bir savol tahlili */}
          {test.show_correct_answers !== false && (
            <Card className="rounded-[2rem] shadow-xl overflow-hidden bg-white">
              <div className="bg-slate-800 text-white px-6 py-4">
                <h3 className="font-black text-lg tracking-tight">Imtihon Varog'i</h3>
                <p className="text-slate-400 text-xs mt-0.5">Har bir savol bo'yicha to'g'ri va xato javoblar</p>
              </div>
              <CardContent className="p-5 space-y-4">
                {randomizedSavollar.map((savol: any, i: number) => {
                  const berilganJavob = javoblar[i];
                  const togriJavob = savol.togriJavob;
                  const togriMi = berilganJavob !== -1 && berilganJavob === togriJavob;
                  const javobBerilganMi = berilganJavob !== -1;
                  return (
                    <div
                      key={i}
                      className={`rounded-2xl border-2 overflow-hidden ${
                        !javobBerilganMi
                          ? 'border-gray-200 bg-gray-50'
                          : togriMi
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                      }`}
                    >
                      {/* Savol */}
                      <div className={`flex items-start gap-3 px-5 py-3 border-b ${
                        !javobBerilganMi ? 'border-gray-200' : togriMi ? 'border-green-200' : 'border-red-200'
                      }`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 mt-0.5 ${
                          !javobBerilganMi ? 'bg-gray-400' : togriMi ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {!javobBerilganMi ? '—' : togriMi ? '✓' : '✗'}
                        </div>
                        <div className="flex-1 font-semibold text-slate-800 text-sm pt-0.5" dangerouslySetInnerHTML={{ __html: `${i + 1}. ${savol.savol}` }} />
                      </div>

                      {/* Variantlar */}
                      <div className="px-5 py-3 space-y-2">
                        {savol.variantlar.map((variant: string, vi: number) => {
                          const tanlangan = berilganJavob === vi;
                          const togriVariant = togriJavob === vi;
                          let variantClass = 'bg-white border-gray-200 text-gray-600';
                          if (togriVariant) variantClass = 'bg-green-100 border-green-400 text-green-800 font-bold';
                          else if (tanlangan && !togriVariant) variantClass = 'bg-red-100 border-red-400 text-red-800 font-bold line-through';
                          return (
                            <div
                              key={vi}
                              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 text-xs transition-all ${variantClass}`}
                            >
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] flex-shrink-0 ${
                                togriVariant ? 'bg-green-500 text-white' : tanlangan ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {String.fromCharCode(65 + vi)}
                              </span>
                              <div dangerouslySetInnerHTML={{ __html: variant }} />
                              {tanlangan && !togriVariant && <span className="ml-auto text-[9px] font-black text-red-600 uppercase">Sizning javob</span>}
                              {togriVariant && <span className="ml-auto text-[9px] font-black text-green-600 uppercase">To'g'ri</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Izoh va Link — savol tugagach ko'rinadi */}
                      {(savol.izoh || savol.link) && (
                        <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2">
                          {savol.izoh && (
                            <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 text-xs text-violet-700 font-medium max-w-full">
                              <MessageSquare className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                              <span><span className="font-black">Izoh:</span> {savol.izoh}</span>
                            </div>
                          )}
                          {savol.link && (
                            <a href={savol.link} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors rounded-xl px-3 py-2 text-xs font-black">
                              <Link2 className="h-3.5 w-3.5" />
                              Manba: {savol.link.replace(/^https?:\/\//, '').split('/')[0]}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-serif">
      {portalTarget && timerElement ? createPortal(timerElement, portalTarget) : (
        <div className="fixed top-2 right-4 z-[120]">{timerElement}</div>
      )}
      <main className="mt-4 w-full max-w-[900px] mx-auto bg-white shadow-xl p-5 md:p-10 border border-slate-100 relative rounded-2xl min-h-[500px]">
        <div className="border-b-2 border-slate-100 pb-6 mb-8 text-center">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Talaba: {oquvchiIsmi} | Rejim: {test.timer_turi}</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{test.test_nomi}</h1>
        </div>

        {test.timer_turi === 'individual' ? (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
             <div className="flex gap-4">
                <span className="text-xl font-black text-blue-600">#{currentQ + 1}</span>
                <div className="text-lg font-bold text-slate-800 leading-snug" dangerouslySetInnerHTML={{ __html: randomizedSavollar[currentQ].savol }} />
             </div>
             <div className="grid grid-cols-1 gap-3 ml-2 md:ml-8">
                {randomizedSavollar[currentQ].variantlar.map((v: string, vi: number) => (
                  <button key={vi} onClick={() => { const nj = [...javoblar]; nj[currentQ] = vi; setJavoblar(nj); setTimeout(handleNextQuestion, 250); }}
                    className={`p-4 md:p-5 rounded-2xl border-2 text-left transition-all font-bold text-base flex items-center gap-4 ${javoblar[currentQ] === vi ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-300'}`}>
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${javoblar[currentQ] === vi ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-500'}`}>{String.fromCharCode(65+vi)}</span>
                    <div dangerouslySetInnerHTML={{ __html: v }} />
                  </button>
                ))}
             </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {randomizedSavollar.map((s: any, i: number) => (
              <div key={i} className="space-y-3">
                <div className="flex gap-2 text-sm">
                  <span className="font-black text-blue-600">{i + 1}.</span>
                  <div className="font-bold text-slate-800 leading-tight" dangerouslySetInnerHTML={{ __html: s.savol }} />
                </div>
                <div className="space-y-2 ml-5">
                  {s.variantlar.map((v: string, vi: number) => (
                    <button key={vi} onClick={() => { const nj = [...javoblar]; nj[i] = vi; setJavoblar(nj); }}
                      className={`w-full p-2.5 text-left text-[11px] rounded-xl border transition-all flex items-center gap-2 ${javoblar[i] === vi ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-white border-slate-200 hover:border-blue-400'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${javoblar[i] === vi ? 'bg-white text-blue-600' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+vi)}</span>
                      <div dangerouslySetInnerHTML={{ __html: v }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="md:col-span-2 pt-8 border-t border-slate-100 mt-8">
               <Button onClick={yakunlash} className="w-full h-14 bg-blue-600 text-white font-black rounded-xl text-sm shadow-xl tracking-widest uppercase">YAKUNLASH ({javoblar.filter(j => j !== -1).length}/{randomizedSavollar.length})</Button>
            </div>
          </div>
        )}
      </main>
      <style>{`.test-html-content table { border-collapse: collapse; width: 100%; border: 1px solid #ddd; } .test-html-content td, .test-html-content th { border: 1px solid #ddd; padding: 4px; }`}</style>
    </div>
  );
}