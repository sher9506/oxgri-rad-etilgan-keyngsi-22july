import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, AlertCircle, Loader2, CheckCircle, Clock, 
  ArrowLeft, Sparkles, CopyX, ShieldCheck, 
  ChevronRight, BookOpen, BrainCircuit, FileSearch, 
  ShieldQuestion, BarChart4, ClipboardCheck, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Toplam, BahoNatija } from '@/types';
import JavobTahlil from './JavobTahlil';
import RichTextEditor, { htmlToPlainText } from './RichTextEditor';

interface ToplamYechishProps {
  startKod?: string;
  oquvchiIsmi: string;
  isUstoz: boolean;
  onOrqaga?: () => void;
}

export default function ToplamYechish({ startKod, oquvchiIsmi, isUstoz, onOrqaga }: ToplamYechishProps) {
  const [bosqich, setBosqich] = useState<'javob' | 'natija'>('javob');
  const [toplam, setToplam] = useState<Toplam | null>(null);
  const [javoblar, setJavoblar] = useState<string[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [natija, setNatija] = useState<BahoNatija[] | null>(null);
  const [qolganSoniya, setQolganSoniya] = useState<number | null>(null);
  const [tanlanganTahlil, setTanlanganTahlil] = useState<{ tahlil: any; ball: number; maksimalBall: number } | null>(null);
  const [toplamYuklanyapti, setToplamYuklanyapti] = useState(true);
  const [copyPasteRuxsat, setCopyPasteRuxsat] = useState(true);
  const [allowRetake, setAllowRetake] = useState(false);
  const [modelTur, setModelTur] = useState<'oddiy' | 'protsesual'>('oddiy');
  const { toast } = useToast();

  useEffect(() => {
    if (!startKod) return;
    const yuklash = async () => {
      setToplamYuklanyapti(true);
      try {
        const { data: toplamCheck } = await supabase.from('toplamlar').select('allow_retake').eq('kod', startKod).maybeSingle();
        const retakeAllowed = toplamCheck?.allow_retake ?? false;

        if (!isUstoz && !retakeAllowed) {
          const { data: mavjudArr } = await supabase.from('javoblar').select('id').eq('toplam_kod', startKod).eq('oquvchi_ismi', oquvchiIsmi).limit(1);
          const mavjud = mavjudArr?.[0] || null;
          if (mavjud) {
            toast({ title: 'Allaqachon topshirilgan', description: 'Siz bu toplamni oldin yechgansiz', variant: 'destructive' });
            onOrqaga?.(); return;
          }
        }
        const { data, error } = await supabase.from('toplamlar').select('*').eq('kod', startKod).single();
        if (error || !data) throw new Error("Toplam topilmadi");
        setToplam(data as Toplam);
        const tur = (data as any).model_tur ?? 'oddiy';
        // 'protsessual' (ikki s) ham, 'protsesual' (bir s) ham qabul qilinadi
        const isProtsesual = tur === 'protsesual' || tur === 'protsessual';
        setJavoblar(
          isProtsesual
            ? (data as any).kazuslar.map((k: any) => k.kazus) // HTML saqlangan
            : new Array((data as any).kazuslar.length).fill('')
        );
        setQolganSoniya(((data as any).vaqt_daqiqa || 30) * 60);
        setCopyPasteRuxsat((data as any).copy_paste_ruxsat ?? true);
        setAllowRetake((data as any).allow_retake ?? false);
        setModelTur(isProtsesual ? 'protsesual' : 'oddiy');
      } catch (e: any) {
        toast({ title: 'Xato', description: e.message, variant: 'destructive' });
        onOrqaga?.();
      } finally { setToplamYuklanyapti(false); }
    };
    yuklash();
  }, [startKod, oquvchiIsmi, isUstoz, toast, onOrqaga]);

  useEffect(() => {
    if (bosqich === 'javob' && qolganSoniya !== null && qolganSoniya > 0) {
      const timer = setInterval(() => setQolganSoniya(prev => (prev && prev > 0 ? prev - 1 : 0)), 1000);
      return () => clearInterval(timer);
    } else if (qolganSoniya === 0 && bosqich === 'javob') {
      handleJavobYuborish();
    }
  }, [qolganSoniya, bosqich]);

  const handleJavobYuborish = async () => {
    if (!toplam) return;
    // Plain text olish — AI ga HTML emas, sof matn yuboriladi
    const plainJavoblar = javoblar.map(j => htmlToPlainText(j).trim());
    const toliqlari = plainJavoblar.filter(j => j);
    if (toliqlari.length === 0) {
      toast({ title: 'Xato', description: 'Kamida bitta javob yozing', variant: 'destructive' });
      return;
    }

    setYuklanyapti(true);
    try {
      const { data, error } = await supabase.functions.invoke('baholash', {
        body: {
          toplam_kod: startKod,
          oquvchi_ismi: oquvchiIsmi,
          // AI ga faqat plain text yuboriladi — formatlash AI mantig'iga ta'sir qilmaydi
          javoblar: plainJavoblar.map((j, i) => ({ 
            kazus_index: i, 
            javob: j, 
            aflotun_guruh: j.toLowerCase().includes('aflotun guruhi') 
          })),
          save_to_db: !isUstoz
        }
      });

      if (error) throw error;
      if (data?.success) {
        setNatija(data.baho);
        setBosqich('natija');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'AI tahlilida xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  if (toplamYuklanyapti) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="relative">
        <Loader2 className="animate-spin h-12 w-12 text-blue-600" />
        <div className="absolute inset-0 blur-xl bg-blue-400/20 animate-pulse" />
      </div>
      <p className="text-slate-500 font-bold tracking-widest text-xs uppercase">Sizning kazusingiz tayyorlanmoqda...</p>
    </div>
  );

  if (!toplam) return null;

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4 md:px-0">
      
      {/* ── AI TAHLIL ANIMATSIYASI ── */}
      <AnimatePresence>
        {yuklanyapti && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-[32px] p-12 overflow-hidden shadow-2xl">
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.8)] z-10"
              />
              <div className="relative z-20 space-y-8">
                <div className="flex justify-center">
                  <div className="p-5 rounded-3xl bg-blue-500/20 border border-blue-500/30">
                    <BrainCircuit className="h-16 w-16 text-blue-400 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tight">AI TAHLIL QILMOQDA</h2>
                  <div className="flex flex-col gap-2">
                    <p className="text-blue-200/70 text-sm font-medium">Javoblardagi huquqiy normalar va mantiqiy bog'liqliklar tekshirilmoqda...</p>
                    <div className="flex justify-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                   {['Normalar tahlili', 'Mantiqiy tekshiruv', 'Ballarni hisoblash'].map((text, i) => (
                     <motion.div 
                       key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: i * 0.8 }}
                       className="flex items-center gap-3 text-left bg-white/5 p-3 rounded-xl border border-white/5"
                     >
                       <div className="h-5 w-5 rounded-full border border-blue-500/50 flex items-center justify-center">
                         <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                       </div>
                       <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">{text}</span>
                     </motion.div>
                   ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── JAVOB BERISH BOSQICHI ── */}
      {bosqich === 'javob' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <div className="bg-[#1e293b] p-8 text-white relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-[10px] font-black tracking-widest text-blue-300 uppercase">Huquqiy Kazus</span>
                  </div>
                  <h1 className="text-3xl font-black tracking-tight">{toplam.mavzu}</h1>
                  <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> {oquvchiIsmi}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-[2rem] flex items-center gap-3 shadow-xl">
                    <div className={`p-2 rounded-full ${qolganSoniya && qolganSoniya < 60 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}>
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-mono font-black text-2xl tracking-tighter">
                      {Math.floor((qolganSoniya || 0) / 60)}:{(qolganSoniya || 0) % 60 < 10 ? '0' : ''}{(qolganSoniya || 0) % 60}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <CardContent className="p-8 space-y-12">
              {toplam.kazuslar.map((k, i) => (
                <div key={i} className="space-y-6">
                  {modelTur === 'oddiy' ? (
                    /* ── ODDIY KAZUS ── */
                    <>
                      <div className="relative group">
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-blue-600 rounded-full" />
                        <div className="space-y-3">
                          <h4 className="font-black text-slate-400 text-[10px] tracking-[0.3em] uppercase">Vaziyat #{i+1}</h4>
                          {/* HTML formatini saqlagan holda ko'rsatish (Word dan paste qilingan bo'lsa) */}
                          <div
                            className="text-slate-700 leading-relaxed font-semibold text-xl rich-content"
                            style={!copyPasteRuxsat ? { userSelect: 'none' } : {}}
                            dangerouslySetInnerHTML={{ __html: k.kazus }}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          Sizning huquqiy tahlilingiz
                        </label>
                        <RichTextEditor
                          value={javoblar[i]}
                          onChange={html => {
                            const y = [...javoblar]; y[i] = html; setJavoblar(y);
                          }}
                          placeholder="Javobingizni asosli va moddalarga tayanib yozing... (Word dan paste qilish mumkin)"
                          minHeight={160}
                          disablePaste={!copyPasteRuxsat}
                          className="text-lg"
                        />
                        {!copyPasteRuxsat && (
                          <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest ml-4">
                            <CopyX size={14} /> Ko'chirish taqiqlangan
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* ── PROTSESUAL HUJJAT ── */
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">{i+1}</div>
                        <h4 className="font-black text-slate-400 text-[10px] tracking-[0.3em] uppercase">Protsesual hujjat #{i+1}</h4>
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Matnni to'ldiring / tahrirlang</span>
                      </div>
                      <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl px-4 py-2.5 flex items-start gap-2">
                        <span className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-0.5">💡 Ko'rsatma:</span>
                        <span className="text-indigo-600 text-[11px] font-medium leading-relaxed">
                          Quyidagi matn sizning javob qog'ozingiz. Kerakli joylarni to'ldiring, noto'g'ri qismlarni o'chiring yoki o'zgartiring.
                          Word formatidagi matn ham to'liq saqlanadi.
                        </span>
                      </div>
                      {/* Protsesual: HTML saqlanadi, tahrirlash mumkin */}
                      <RichTextEditor
                        value={javoblar[i]}
                        onChange={html => {
                          const y = [...javoblar]; y[i] = html; setJavoblar(y);
                        }}
                        placeholder="Hujjat matni..."
                        minHeight={260}
                        disablePaste={!copyPasteRuxsat}
                        className="border-2 border-indigo-200"
                      />
                      {!copyPasteRuxsat && (
                        <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest ml-4">
                          <CopyX size={14} /> Ko'chirish taqiqlangan
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <Button 
                onClick={handleJavobYuborish} 
                disabled={yuklanyapti}
                className="w-full h-20 bg-blue-600 hover:bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-500/20 group transition-all"
              >
                SINOVNI YAKUNLASH VA AI TAHLILI
                <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── NATIJA BOSQICHI ── */}
      {bosqich === 'natija' && natija && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 animate-fade-in">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-30 bg-slate-50/80 backdrop-blur-md p-4 rounded-[2rem] border border-slate-200 shadow-lg">
            <button onClick={onOrqaga} className="flex items-center gap-2 text-slate-500 font-bold hover:text-blue-600 transition-all text-xs uppercase tracking-widest px-4 py-2 hover:bg-white rounded-xl">
              <ArrowLeft size={16} /> Chiqish
            </button>
            <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500 text-white rounded-[1.5rem] shadow-lg shadow-emerald-500/20">
              <ShieldCheck size={20} />
              <span className="text-xs font-black uppercase tracking-widest">Tahlil yakunlandi</span>
            </div>
          </div>

          <div className="grid gap-8">
            {natija.map((n, i) => {
              // Har bir kazus uchun maksimal ballni mezon sozlamalaridan hisoblash
              const kazusData = toplam?.kazuslar?.[n.kazus_index];
              const mezonlar = kazusData?.mezon_sozlamalar || [];
              const maks = mezonlar.length > 0
                ? mezonlar.filter((m: any) => m.faol).reduce((s: number, m: any) => s + (m.ball || 0), 0)
                : 30;
              const foiz = maks > 0 ? Math.round((n.ball / maks) * 100) : 0;
              return (
              <Card key={i} className="border-none shadow-xl rounded-[3rem] overflow-hidden bg-white hover:shadow-2xl transition-all duration-500">
                <div className="p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-gradient-to-br from-slate-50 to-white">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-xl shadow-lg">#{i+1}</div>
                      <h3 className="font-black text-slate-800 text-2xl tracking-tight uppercase">Kazus natijasi</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-blue-500" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Indeks bo'yicha baholash</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">To'plangan ball</p>
                      <div className="flex items-baseline justify-end gap-1">
                        <span className={`text-6xl font-black ${foiz >= 70 ? 'text-emerald-500' : foiz >= 50 ? 'text-blue-500' : 'text-rose-500'}`}>
                          {n.ball}
                        </span>
                        <span className="text-2xl font-bold text-slate-300">/ {maks}</span>
                      </div>
                      <p className={`text-sm font-black mt-1 ${foiz >= 70 ? 'text-emerald-500' : foiz >= 50 ? 'text-blue-500' : 'text-rose-500'}`}>
                        {foiz}%
                      </p>
                    </div>
                    
                    <Button
                      onClick={() => {
                        // Maksimal ballni mezon sozlamalaridan hisoblash
                        const kazus = toplam?.kazuslar?.[n.kazus_index];
                        const mezonlar = kazus?.mezon_sozlamalar || [];
                        const maks = mezonlar.length > 0
                          ? mezonlar.filter((m: any) => m.faol).reduce((s: number, m: any) => s + (m.ball || 0), 0)
                          : 30;
                        setTanlanganTahlil({ tahlil: n.batafsil_tahlil, ball: n.ball, maksimalBall: maks });
                      }}
                      className="h-16 px-8 bg-slate-900 hover:bg-blue-600 text-white rounded-[1.5rem] font-bold text-sm shadow-xl transition-all active:scale-95 group"
                    >
                      <BarChart4 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                      BATAFSIL TAHLILNI KO'RISH
                    </Button>
                  </div>
                </div>
                
                <CardContent className="px-10 pb-10">
                  <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 relative group overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles size={14} /> AI Xulosasi
                    </h4>
                    <p className="text-slate-700 font-semibold leading-relaxed text-xl italic">
                      "{n.izoh}"
                    </p>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>

          {tanlanganTahlil && (
            <JavobTahlil
              tahlil={tanlanganTahlil.tahlil}
              ball={tanlanganTahlil.ball}
              maksimalBall={tanlanganTahlil.maksimalBall}
              onClose={() => setTanlanganTahlil(null)}
            />
          )}
        </motion.div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        /* Rich content (Word dan paste qilingan) uchun uslublar */
        .rich-content p { margin-bottom: 0.5rem; }
        .rich-content b, .rich-content strong { font-weight: 700; }
        .rich-content i, .rich-content em { font-style: italic; }
        .rich-content ul { list-style: disc; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .rich-content ol { list-style: decimal; padding-left: 1.25rem; margin-bottom: 0.5rem; }
        .rich-content li { margin-bottom: 0.25rem; }
        .rich-content table { border-collapse: collapse; width: 100%; margin-bottom: 0.75rem; }
        .rich-content td, .rich-content th { border: 1px solid #d1d5db; padding: 0.375rem 0.5rem; font-size: 0.9em; }
        .rich-content th { background: #f9fafb; font-weight: 600; }
        .rich-content h1, .rich-content h2, .rich-content h3 { font-weight: 700; margin-bottom: 0.5rem; }
      `}</style>
    </div>
  );
}
