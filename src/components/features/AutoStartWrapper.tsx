import { useEffect, useRef } from 'react';
import SinovBoshlash from './SinovBoshlash';
import { ArrowLeft } from 'lucide-react';

interface AutoStartWrapperProps {
  kod: string;
  tur: 'test' | 'kazus';
  onOrqaga: () => void;
}

export default function AutoStartWrapper({ kod, tur, onOrqaga }: AutoStartWrapperProps) {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    
    // Brauzer tarixiga sinov boshlanganini bildirish uchun holat qo'shamiz
    window.history.pushState({ action: 'solving' }, '', '');

    const handlePopState = (e: PopStateEvent) => {
      // Agar foydalanuvchi brauzer orqali orqaga qaytsa, sinovni yopish
      onOrqaga();
    };

    window.addEventListener('popstate', handlePopState);

    // SinovBoshlash komponentiga kodni yuborish
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod } }));
    }, 100);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearTimeout(timer);
    };
  }, [kod, onOrqaga]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col h-screen w-screen overflow-hidden">
      {/* Yuqori navigatsiya paneli */}
      <div className="sticky top-0 z-[110] bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={onOrqaga}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-blue-200"
        >
          <ArrowLeft className="h-5 w-5" />
          RO'YXATGA QAYTISH
        </button>
        
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
            tur === 'test' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
          }`}>
            {tur === 'test' ? '📝 TEST REJIMI' : '📚 KAZUS REJIMI'}
          </span>
          <div className="h-6 w-px bg-gray-200 hidden sm:block" />
          <span className="font-mono font-black text-blue-600 text-sm hidden sm:block">KOD: {kod}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-4 pb-20">
        <div className="max-w-5xl mx-auto px-4">
          <SinovBoshlash autoStartKod={kod} />
        </div>
      </div>
    </div>
  );
}