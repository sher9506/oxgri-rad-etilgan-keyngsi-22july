import React, { useState, useEffect, useRef } from 'react';
import { useLang } from '@/contexts/LangContext';
import { KeyRound, Play, Loader2, ArrowLeft, Clock, ShieldCheck, Sparkles, ArrowRight, BrainCircuit, Scale, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import ToplamYechish from './ToplamYechish';
import TestYechish from './TestYechish';
import LoginModal from './LoginModal';

type Bosqich = 'kirish' | 'kod' | 'kutish' | 'toplam' | 'test';

// Test/toplam yakunlangandan keyin sessionStorage kalitini tozalash
const clearTestSession = () => {
  // TestYechish va ToplamYechish da ishlatilgan storage kalitlarini tozalash
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && (k.startsWith('test_session_') || k.startsWith('toplam_session_') || k.startsWith('sinov_'))) {
      keys.push(k);
    }
  }
  keys.forEach(k => sessionStorage.removeItem(k));
};

export default function SinovBoshlash({ autoStartKod }: {autoStartKod?: string;}) {
  const { user } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();

  const [bosqich, setBosqich] = useState<Bosqich>('kirish');
  const [loginModalOchiq, setLoginModalOchiq] = useState(false);
  const [otp, setOtp] = useState<string[]>(new Array(5).fill(""));
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [boshlashKod, setBoshlashKod] = useState('');
  const [kutishInfo, setKutishInfo] = useState<{kod: string;tur: 'toplam' | 'test';nomi: string;} | null>(null);
  // Test/toplam yechilgan keyin qayta boshlanishini oldini olish
  const yechilganKodlar = useRef<Set<string>>(new Set());

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return false;
    const newOtp = [...otp];
    newOtp[index] = element.value.substring(element.value.length - 1);
    setOtp(newOtp);
    if (element.value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleKodYuklash = async (forcedKod?: string) => {
    const ishlatilganKod = forcedKod || otp.join("");
    if (ishlatilganKod.length !== 5) return;

    setYuklanyapti(true);
    try {
      const [toplamRes, testRes] = await Promise.all([
        supabase.from('toplamlar').select('kod, is_active, mavzu').eq('kod', ishlatilganKod).maybeSingle(),
        supabase.from('testlar').select('kod, is_active, test_nomi').eq('kod', ishlatilganKod).maybeSingle()
      ]);

      if (toplamRes.data) {
        if (user?.rol !== 'ustoz' && !toplamRes.data.is_active) {
          setKutishInfo({ kod: ishlatilganKod, tur: 'toplam', nomi: toplamRes.data.mavzu || 'Kazus toplami' });
          setBosqich('kutish');
        } else {
          setBoshlashKod(ishlatilganKod);
          setBosqich('toplam');
        }
      } else if (testRes.data) {
        if (user?.rol !== 'ustoz' && !testRes.data.is_active) {
          setKutishInfo({ kod: ishlatilganKod, tur: 'test', nomi: testRes.data.test_nomi || 'Test' });
          setBosqich('kutish');
        } else {
          setBoshlashKod(ishlatilganKod);
          setBosqich('test');
        }
      } else {
        toast({ title: 'Topilmadi', description: 'Bu kodga mos sinov topilmadi', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Xato', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  useEffect(() => {
    const runAutoStart = (k: string) => {
      // Yechilgan kodlarni qayta boshlamaslik
      if (yechilganKodlar.current.has(k)) return;
      if (k && k.length === 5) {
        setOtp(k.split(""));
        setTimeout(() => handleKodYuklash(k), 200);
      }
    };

    if (user && autoStartKod) {
      runAutoStart(autoStartKod);
    }

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.kod) runAutoStart(detail.kod);
    };

    window.addEventListener('auto-start-kod', handler);
    return () => window.removeEventListener('auto-start-kod', handler);
  }, [user, autoStartKod]);

  useEffect(() => {
    if (user && bosqich === 'kirish') setBosqich('kod');
  }, [user]);

  const handleOrqaga = () => {
    clearTestSession();
    // Yakunlangan kodlar ro'yxatiga qo'shing (agar boshlashKod mavjud bo'lsa)
    if (boshlashKod) yechilganKodlar.current.add(boshlashKod);
    setBosqich('kod');
    setBoshlashKod('');
    setOtp(new Array(5).fill(""));
    setKutishInfo(null);
  };

  if (!user && bosqich === 'kirish') {
    return (
      <div className="h-full w-full flex items-center justify-center p-6 md:p-12 bg-white rounded-3xl animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-500/5 -skew-x-12 translate-x-20 pointer-events-none" />
        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-10 text-left max-w-xl">
            <div className="space-y-6">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-bold animate-bounce-slow">
                 <Sparkles className="h-4 w-4" />
                 <span>{t('sinov.badge')}</span>
               </div>
               <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-[1.2]">
                 {t('sinov.title1')} <br />
                 <span className="text-blue-600 relative">
                   {t('sinov.title2')}
                   <svg className="absolute -bottom-2 left-0 w-full h-2 text-blue-300/60" viewBox="0 0 100 10" preserveAspectRatio="none">
                     <path d="M0 5 Q 50 0 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
                   </svg>
                 </span> <br />
                 {t('sinov.title3')}
               </h1>
               <p className="text-lg text-gray-500 font-medium leading-relaxed">
                 {t('sinov.desc')}
               </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={() => setLoginModalOchiq(true)} className="h-16 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xl font-bold shadow-xl shadow-blue-200 transition-all hover:scale-105 active:scale-95 group">
                {t('sinov.start_btn')} <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
          <div className="relative hidden lg:block text-center">
               <div className="bg-[#1e3a8a] p-10 rounded-[40px] shadow-2xl inline-block transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <Scale className="w-48 h-48 text-slate-100" />
               </div>
          </div>
        </div>
        <LoginModal isOpen={loginModalOchiq} onClose={() => setLoginModalOchiq(false)} />
      </div>);
  }

  if (bosqich === 'kod') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-[2rem] shadow-xl border border-gray-100 text-center animate-fade-in">
          <div className="bg-blue-50 p-4 rounded-3xl inline-block mb-6">
            <KeyRound className="h-10 w-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">{t('sinov.kod_title')}</h1>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            {t('sinov.kod_desc')}
          </p>

          <div className="flex gap-3 md:gap-4 justify-center mb-8">
            {otp.map((data, index) =>
              <input
                key={index}
                type="text"
                maxLength={1}
                ref={(el) => inputRefs.current[index] = el}
                value={data}
                onChange={(e) => handleOtpChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-12 h-12 md:w-14 md:h-14 border-2 border-gray-200 rounded-xl text-center text-2xl font-black text-gray-800 transition-all focus:border-blue-600 focus:ring-4 focus:ring-blue-50 outline-none bg-gray-50 focus:bg-white" />
            )}
          </div>

          <Button
            onClick={() => handleKodYuklash()}
            disabled={yuklanyapti || otp.join("").length !== 5}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all">
            {yuklanyapti ? <Loader2 className="h-5 w-5 animate-spin" /> : t('sinov.start')}
          </Button>

          <button onClick={() => window.location.reload()} className="mt-6 text-gray-400 text-sm font-bold hover:text-blue-600 transition-colors">
            {t('sinov.home')}
          </button>
        </div>
      </div>);
  }

  if (bosqich === 'kutish' && kutishInfo) {
    return (
      <div className="h-full w-full flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-10 rounded-[2rem] shadow-xl border border-gray-100 text-center animate-fade-in">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25" />
            <div className="relative bg-blue-600 w-24 h-24 rounded-full flex items-center justify-center shadow-xl shadow-blue-200">
              <Clock className="h-10 w-10 text-white animate-pulse" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">{t('sinov.waiting_title')}</h2>
          <p className="text-gray-500 text-sm mb-8">
            {t('sinov.waiting_name')} <span className="font-bold text-gray-800">{kutishInfo.nomi}</span><br />
            {t('sinov.waiting_code')} <span className="font-mono font-black text-blue-600">{kutishInfo.kod}</span>
          </p>
          <Button variant="ghost" onClick={handleOrqaga} className="text-gray-400 font-bold hover:text-red-500 rounded-xl px-8 h-12">
            {t('sinov.cancel')}
          </Button>
        </div>
      </div>);
  }

  if (bosqich === 'toplam' && user) return <ToplamYechish startKod={boshlashKod} oquvchiIsmi={`${user.ism} ${user.familiya}`} isUstoz={user.rol === 'ustoz'} onOrqaga={() => { clearTestSession(); handleOrqaga(); }} />;
  if (bosqich === 'test' && user) return <TestYechish startKod={boshlashKod} oquvchiIsmi={`${user.ism} ${user.familiya}`} isUstoz={user.rol === 'ustoz'} onOrqaga={() => { clearTestSession(); handleOrqaga(); }} />;

  return null;
}