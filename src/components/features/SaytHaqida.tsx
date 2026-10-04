import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Award, Code2, Library, MessageSquare, BarChart3, ArrowRight,
  BrainCircuit, Zap, BookOpen, Shield, User,
  Users, FileText, Sparkles, Trophy, Rocket, Scale,
  ChevronRight, Mail, Phone,
  GraduationCap, Play, TrendingUp, Target, Brain,
  HelpCircle, Lock, Info, ChevronDown,
  CheckCircle2, Quote, Star, Compass, Eye, Lightbulb, Heart,
  Send, Link2, LogOut, Newspaper
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLang } from '@/contexts/LangContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/* ═══════════════════════════════════════════════════════════════════════════
   ANIMATION VARIANTS & HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } }
};

const staggerContainerFast = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } }
};

/* ═══ Animated Counter with easing ═══ */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * target);
      setCount(current);
      if (progress < 1) requestAnimationFrame(animate);
      else setCount(target);
    };
    requestAnimationFrame(animate);
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ═══ 3D Tilt Card Wrapper ═══ */
function TiltCard({ children, className = '', intensity = 8 }: { children: React.ReactNode; className?: string; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: -dy * intensity, y: dx * intensity });
  }, [intensity]);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: 'transform 0.2s ease-out',
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  );
}

/* ═══ Scroll Progress Bar ═══ */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] origin-left z-[60]"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #3b82f6, #06b6d4, #0ea5e9)',
      }}
    />
  );
}

/* ═══ Magnetic Button ═══ */
function MagneticButton({ children, onClick, primary = false, className = '' }: { children: React.ReactNode; onClick: () => void; primary?: boolean; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setOffset({ x: x * 0.25, y: y * 0.25 });
  };

  return (
    <button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      onClick={onClick}
      className={className}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: 'transform 0.2s ease-out',
      }}
    >
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════════════ */

interface SaytHaqidaProps {
  onNavigate: (tab: string) => void;
}

const FAQ_ITEMS = [
  { q: "FanFaster.uz nima?", a: "FanFaster.uz — o'quvchilar uchun mo'ljallangan intellektual ta'lim platformasi. Sun'iy intellekt va inson tafakkurini birlashtirgan holda o'quv materiallari, testlar va shaxsiylashtirilgan ta'lim tajribasini taqdim etadi." },
  { q: "Platformaga qanday ro'yxatdan o'tish mumkin?", a: "Ro'yxatdan o'tish Telegram bot orqali amalga oshiriladi. Kirish sahifasidagi bot havolasini bosing, telefon raqamingizni yuboring, ism-familiyangizni va parolni kiriting — tayyor." },
  { q: "Parolimni unutib qo'ysam nima qilaman?", a: "Kirish sahifasida \"Parolni unutdim\" tugmasini bosing. Bot orqali Telegramingizga tasdiqlash kodi yuboriladi. Kodni kiritib yangi parol o'rnating." },
  { q: "Bir odam ham o'quvchi, ham ustoz bo'la oladimi?", a: "Ha. Ustoz sifatida ro'yxatdan o'tib admin tasdiqlashini olsangiz, kirish sahifasida \"Ustoz\" tabini tanlang. O'quvchi sifatida kirish uchun esa \"O'quvchi\" tabini tanlang." },
  { q: "Test boshlashda xato chiqyapti — nima qilaman?", a: "Ustozdan testga START berishini so'rang. Kod to'g'ri 5 raqamdan iborat ekanligini tekshiring. Muammo davom etsa, Yordam bo'limiga yozing yoki +998 90 268-63-63 ga qo'ng'iroq qiling." },
  { q: "Ustoz sifatida qanday ro'yxatdan o'tiladi?", a: "Kirish sahifasida \"Ustoz\" tabini oching, \"Ro'yxatdan o'tish\" bo'limiga o'ting va bot havolasiga bosing. Bot orqali ariza topshiring — admin ko'rib chiqib, tasdiqlash to'g'risida Telegram xabar yuboradi." },
  { q: "Testlar va kazuslar bepulmi?", a: "Ko'pchilik test va kazuslar bepul. Ba'zi ustoz materiallari pullik bo'lishi mumkin — narx test/kazus sahifasida ko'rsatiladi." },
  { q: "Qaysi qurilmalardan foydalanish mumkin?", a: "Internetga ulangan har qanday kompyuter, noutbuk, planshet yoki smartfondan foydalanish mumkin. Chrome, Firefox, Safari yoki Edge brauzerlaridan foydalanish tavsiya etiladi." }
];

const MAXFIYLIK_MATN = `FanFaster.uz (keyingi o'rinlarda "Biz", "Platforma" yoki "FanFaster") o'quvchilar uchun mo'ljallangan intellektual ta'lim platformasi bo'lib, sun'iy intellekt va inson tafakkuri sintezidan foydalanadi.

**Oxirgi yangilanish:** 2026-yil 4-iyun

**1. Biz To'playdigan Ma'lumotlar**

• Ro'yxatdan o'tish ma'lumotlari: Ism, familiya, telefon raqami va boshqa aloqa ma'lumotlari.
• Profil ma'lumotlari: Ta'lim darajasi, qiziqishlar, o'quv maqsadlari.
• Foydalanish ma'lumotlari: Ko'rilgan sahifalar, test natijalari, sarflangan vaqt.
• Texnik ma'lumotlar: IP manzili, brauzer turi, qurilma turi.

**2. Ma'lumotlardan Foydalanish Maqsadlari**

• Platformaga kirishni ta'minlash va xizmatlarni taqdim etish
• O'quv materiallarini shaxsiylashtirish
• Platformani yaxshilash va xatolarni tuzatish
• Xavfsizlikni ta'minlash va firibgarlikni oldini olish

**3. Foydalanuvchi Huquqlari**

Siz o'z ma'lumotlaringizga kirish, tuzatish va o'chirishga huquqiga egasiz. Murojaat: info@fanfaster.uz`;

const SHARTLAR_MATN = `FanFaster.uz platformasiga xush kelibsiz!

**Oxirgi yangilanish:** 2026-yil 4-iyun

**1. Foydalanuvchi Majburiyatlari**

• Ro'yxatdan o'tishda to'g'ri va aniq ma'lumotlar kiritish
• Login va parolni maxfiy saqlash
• Platformadan faqat qonuniy maqsadlarda foydalanish
• Boshqa foydalanuvchilarga nisbatan bezorilik qilmaslik

**2. Intellektual Mulk**

Platformadagi barcha kontent FanFaster.uz ning mulki bo'lib, mualliflik huquqi qonunlari bilan himoyalangan.

**3. Aloqa**

• Email: info@fanfaster.uz
• Telefon: +998-90-268-63-63`;

function FormatMatn({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold text-slate-800 mt-3">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.startsWith('•')) {
          return <p key={i} className="pl-3 text-slate-600">{line}</p>;
        }
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   "QANDAY ISHLAYDI?" — Redesigned section
   Sub-components: ConnectingLine, PhoneMockup, HowItWorksSection
   ═══════════════════════════════════════════════════════════════════════════ */

type HowItWorksStep = {
  num: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  glow: string;
  accent: string;
};

const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    num: '01',
    title: 'Telegram botni oching',
    desc: "Botni oching va «Start» tugmasini bosing.",
    icon: Send,
    color: 'from-blue-500 to-cyan-500',
    glow: 'shadow-blue-500/25',
    accent: '#3b82f6',
  },
  {
    num: '02',
    title: 'Havolani bosing',
    desc: "Bot sizga profilingizga kirish havolasini yuboradi. Havolani bosasiz va profilingiz ochiladi.",
    icon: Link2,
    color: 'from-cyan-500 to-teal-500',
    glow: 'shadow-cyan-500/25',
    accent: '#06b6d4',
  },
  {
    num: '03',
    title: 'Bir marta kirasiz',
    desc: "Bu ishni har safar qilish shart emas. Profilingiz qurilmangizda saqlanib qoladi. O'zingiz «Chiqish»ni bosmaguningizcha qayta kirmaysiz.",
    icon: Lock,
    color: 'from-sky-500 to-blue-500',
    glow: 'shadow-sky-500/25',
    accent: '#0ea5e9',
  },
  {
    num: '04',
    title: "O'rganing va natijani ko'ring",
    desc: "Kursni tanlang, savollarga javob yozing. Sun'iy intellekt javobingizni tahlil qilib baho beradi, statistikangiz esa zaif tomonlaringizni ko'rsatadi.",
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    glow: 'shadow-emerald-500/25',
    accent: '#10b981',
  },
];

/* ── ConnectingLine: SVG stroke that draws itself when in view ── */
function ConnectingLine({ activeStep, isMobile }: { activeStep: number; isMobile: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isMobile) {
    return (
      <svg ref={ref} className="absolute left-[27px] top-0 bottom-0 w-2 pointer-events-none" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 2 100">
        <line x1="1" y1="0" x2="1" y2="100" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
        <line
          x1="1" y1="0" x2="1" y2="100"
          stroke="url(#vline-grad)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={reduce ? 0 : inView ? 1 - (activeStep + 1) / 4 : 1}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <defs>
          <linearGradient id="vline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg ref={ref} className="absolute top-[44px] left-0 right-0 h-2 pointer-events-none" aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 2">
      <line x1="0" y1="1" x2="100" y2="1" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
      <line
        x1="0" y1="1" x2="100" y2="1"
        stroke="url(#hline-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={reduce ? 0 : inView ? 1 - (activeStep + 1) / 4 : 1}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)' }}
      />
      <defs>
        <linearGradient id="hline-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="33%" stopColor="#06b6d4" />
          <stop offset="66%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── PhoneMockup: CSS 3D phone with animated scenes synced to activeStep ── */
function PhoneMockup({ activeStep }: { activeStep: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: -8, y: 12 });
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: -8 + -dy * 6, y: 12 + dx * 8 });
  }, []);

  const handleMouseLeave = useCallback(() => setTilt({ x: -8, y: 12 }), []);

  const scene = (idx: number) => (
    <motion.div
      key={idx}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="absolute inset-0 flex flex-col"
    >
      {idx === 0 && (
        <div className="flex flex-col h-full p-3 gap-2">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Send className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="text-[8px] font-bold text-slate-700">FanFaster Bot</span>
          </div>
          <div className="flex-1 flex flex-col justify-end gap-1.5">
            <div className="self-end max-w-[70%] bg-blue-500 text-white text-[7px] rounded-xl rounded-tr-sm px-2 py-1.5 font-medium">
              /start
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="self-start max-w-[80%] bg-slate-100 text-slate-700 text-[7px] rounded-xl rounded-tl-sm px-2 py-1.5"
            >
              Assalomu alaykum! Profilingizga kirish uchun tugmani bosing.
            </motion.div>
            <motion.button
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="self-start max-w-[80%] bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[7px] font-bold rounded-lg px-2.5 py-1.5 shadow-sm flex items-center gap-1"
            >
              <Link2 className="w-2.5 h-2.5" /> Profilga kirish
            </motion.button>
          </div>
        </div>
      )}
      {idx === 1 && (
        <div className="flex flex-col h-full p-3 gap-1.5">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
            <div>
              <div className="text-[7px] font-bold text-slate-800 leading-tight">FanFaster</div>
              <div className="text-[6px] text-emerald-500 font-medium">online</div>
            </div>
          </div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col items-center justify-center gap-1"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div className="text-[8px] font-black text-slate-800">Xush kelibsiz!</div>
            <div className="text-[6px] text-slate-400">O'quvchi kabineti</div>
          </motion.div>
        </div>
      )}
      {idx === 2 && (
        <div className="flex flex-col h-full p-3 gap-1.5">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
            <div className="text-[7px] font-bold text-slate-800">FanFaster</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <motion.div
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="w-12 h-12 rounded-full border-2 border-emerald-400 flex items-center justify-center bg-emerald-50">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <motion.div
                animate={reduce ? {} : { scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full border-2 border-emerald-400"
              />
            </motion.div>
            <div className="text-[7px] font-bold text-slate-600 text-center leading-tight">
              Profil saqlandi<br />
              <span className="text-[6px] text-slate-400 font-normal">Chiqishni bosmaguningizcha qoladi</span>
            </div>
            <div className="flex items-center gap-1 text-[6px] text-slate-300 mt-0.5">
              <LogOut className="w-2.5 h-2.5" />
              <span>Chiqish</span>
            </div>
          </div>
        </div>
      )}
      {idx === 3 && (
        <div className="flex flex-col h-full p-3 gap-1.5">
          <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500" />
            <div className="text-[7px] font-bold text-slate-800">Kurs · Modul 1</div>
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100">
              <div className="text-[6px] text-slate-400 mb-0.5">Savol</div>
              <div className="text-[7px] text-slate-700 leading-tight">Huquqning asosiy tushunchasi nima?</div>
              <div className="text-[6px] text-slate-400 mt-1 mb-0.5">Javob</div>
              <div className="text-[6px] text-slate-600 leading-tight">Huquq — bu davlat tomonidan...</div>
            </div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-1.5 border border-emerald-100 flex items-center gap-1.5"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                <Brain className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-[6px] font-bold text-emerald-700">AI bahosi: 92/100</div>
                <div className="h-1 bg-emerald-100 rounded-full mt-0.5 overflow-hidden">
                  <motion.div
                    initial={reduce ? { width: '92%' } : { width: '0%' }}
                    animate={{ width: '92%' }}
                    transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                  />
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="flex items-end gap-[2px] h-5 px-0.5"
            >
              {[40, 55, 48, 70, 62, 85, 92].map((h, i) => (
                <motion.div
                  key={i}
                  initial={reduce ? { height: `${h}%` } : { height: '0%' }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.7 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex-1 rounded-sm ${i >= 5 ? 'bg-gradient-to-t from-emerald-500 to-teal-400' : 'bg-slate-200'}`}
                />
              ))}
            </motion.div>
          </div>
        </div>
      )}
    </motion.div>
  );

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative"
      style={{ perspective: '900px' }}
    >
      <div
        className="relative mx-auto"
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Phone frame */}
        <div className="relative w-[180px] h-[360px] rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl p-2">
          {/* Screen */}
          <div className="relative w-full h-full rounded-[1.5rem] bg-white overflow-hidden" style={{ transform: 'translateZ(1px)' }}>
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-3 bg-slate-800 rounded-b-xl z-10" />

            <AnimatePresence mode="wait">
              {scene(activeStep)}
            </AnimatePresence>

            {/* Home indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-slate-300 rounded-full" />
          </div>
        </div>

        {/* Reflection shadow */}
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[140px] h-8 rounded-full blur-xl"
          style={{ background: 'radial-gradient(ellipse, rgba(56,189,248,0.15), transparent 70%)' }}
        />
      </div>
    </div>
  );
}

/* ── FloatingBackgroundShapes: very subtle 3D wire shapes ── */
function FloatingBackgroundShapes() {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        animate={reduce ? {} : { y: [0, -20, 0], rotate: [0, 6, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[10%] left-[8%] w-20 h-20 opacity-[0.07]"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="w-full h-full border-2 border-blue-400 rounded-lg" style={{ transform: 'rotateY(35deg) rotateX(15deg)' }} />
      </motion.div>
      <motion.div
        animate={reduce ? {} : { y: [0, 15, 0], rotate: [0, -8, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute top-[60%] right-[10%] w-16 h-16 opacity-[0.08]"
      >
        <div className="w-full h-full border-2 border-cyan-400 rounded-lg" style={{ transform: 'rotateY(-30deg) rotateZ(10deg)' }} />
      </motion.div>
      <motion.div
        animate={reduce ? {} : { y: [0, -12, 0], rotate: [0, 4, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute top-[30%] right-[20%] w-12 h-12 opacity-[0.06]"
      >
        <div className="w-full h-full border-2 border-emerald-400 rounded-lg" style={{ transform: 'rotateX(25deg) rotateY(20deg)' }} />
      </motion.div>
    </div>
  );
}

/* ── HowItWorksSection: main composed section ── */
function HowItWorksSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const inView = useInView(sectionRef, { margin: '-80px' });
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-advance the active step when in view (unless reduced motion)
  useEffect(() => {
    if (!inView || reduce) return;
    if (isMobile && window.matchMedia('(hover: none)').matches) {
      // On touch mobile, auto-advance too
    }
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(interval);
  }, [inView, reduce, isMobile]);

  return (
    <section className="mb-12" ref={sectionRef}>
      <div className="relative">
        <FloatingBackgroundShapes />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="relative z-10 space-y-10"
        >
          {/* Heading */}
          <motion.div variants={fadeUp} className="text-center space-y-2">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.35em]">Jarayon</p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">Qanday ishlaydi?</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Bir marta kirasiz — qolganini FanFaster o'zi eslab qoladi.
            </p>
          </motion.div>

          {/* Desktop: phone left, steps right | Mobile: phone top, steps below */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-start justify-center">
            {/* Phone mockup */}
            <motion.div
              variants={fadeUp}
              className="shrink-0 md:sticky md:top-8"
            >
              <PhoneMockup activeStep={activeStep} />
            </motion.div>

            {/* Steps */}
            <motion.div variants={fadeUp} className="flex-1 max-w-2xl w-full">
              <div className="relative">
                <ConnectingLine activeStep={activeStep} isMobile={isMobile} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {HOW_IT_WORKS_STEPS.map((s, i) => {
                    const isActive = i === activeStep;
                    const Icon = s.icon;
                    return (
                      <motion.div
                        key={i}
                        variants={fadeUp}
                        onMouseEnter={() => setActiveStep(i)}
                        onClick={() => setActiveStep(i)}
                        className="relative cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveStep(i);
                          }
                        }}
                        aria-label={`${s.num}-qadam: ${s.title}`}
                      >
                        <div
                          className={`relative rounded-2xl border bg-white/80 backdrop-blur-xl overflow-hidden transition-all duration-500`}
                          style={{
                            borderColor: isActive ? s.accent + '40' : 'rgba(255,255,255,0.6)',
                            boxShadow: isActive ? `0 8px 30px ${s.accent}15` : '0 1px 3px rgba(0,0,0,0.04)',
                            transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                          }}
                        >
                          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.color} transition-opacity duration-500`} style={{ opacity: isActive ? 1 : 0.3 }} />

                          <div className="p-5 flex flex-col gap-3 pt-6" style={{ transformStyle: 'preserve-3d' }}>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-black tabular-nums" style={{ color: isActive ? s.accent : '#cbd5e1' }}>
                                {s.num}
                              </span>
                              <div
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg ${s.glow} transition-transform duration-500`}
                                style={{
                                  transform: isActive ? 'translateZ(12px) scale(1.05)' : 'translateZ(4px) scale(1)',
                                }}
                              >
                                <Icon className="h-5 w-5 text-white" />
                              </div>
                              {/* Node dot */}
                              <div className="ml-auto flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full transition-all duration-500"
                                  style={{
                                    background: isActive ? s.accent : '#e2e8f0',
                                    boxShadow: isActive ? `0 0 8px ${s.accent}80` : 'none',
                                  }}
                                />
                              </div>
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 text-sm mb-1.5">{s.title}</h3>
                              <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function ShootingStars() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !parent || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ANGLE = (32 * Math.PI) / 180;
    const dx = Math.cos(ANGLE);
    const dy = Math.sin(ANGLE);
    let w = 0, h = 0, raf = 0, visible = true;
    let last = performance.now();

    type Star = { x: number; y: number; len: number; speed: number; alpha: number; size: number; wait: number };
    type Dot = { x: number; y: number; r: number; phase: number; rate: number };
    let stars: Star[] = [];
    let dots: Dot[] = [];

    const spawn = (initial: boolean): Star => {
      const fromTop = Math.random() < 0.7;
      return {
        x: initial ? Math.random() * w : fromTop ? Math.random() * w * 1.1 - w * 0.1 : -40,
        y: initial ? Math.random() * h : fromTop ? -40 : Math.random() * h * 0.5,
        len: 80 + Math.random() * 140,
        speed: 260 + Math.random() * 380,
        alpha: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 1.2,
        wait: initial ? 0 : Math.random() * 3,
      };
    };

    const resize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(26, Math.max(10, w / 70)));
      stars = Array.from({ length: n }, () => spawn(true));
      dots = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.15 ? 2 : 1,
        phase: Math.random() * Math.PI * 2,
        rate: 0.6 + Math.random() * 1.6,
      }));
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (const d of dots) {
        const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin((now / 1000) * d.rate + d.phase));
        ctx.fillStyle = `rgba(186,230,253,${a * 0.6})`;
        ctx.fillRect(d.x, d.y, d.r, d.r);
      }

      if (!reduce) {
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          if (s.wait > 0) { s.wait -= dt; continue; }
          s.x += dx * s.speed * dt;
          s.y += dy * s.speed * dt;
          const tx = s.x - dx * s.len;
          const ty = s.y - dy * s.len;
          const g = ctx.createLinearGradient(tx, ty, s.x, s.y);
          g.addColorStop(0, 'rgba(125,211,252,0)');
          g.addColorStop(1, `rgba(186,230,253,${s.alpha})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = s.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 0.9, 0, Math.PI * 2);
          ctx.fill();
          if (tx > w || ty > h) stars[i] = spawn(false);
        }
      }

      if (!reduce && visible) raf = requestAnimationFrame(frame);
      else raf = 0;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(parent);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 h-full w-full" />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   "TIRIK ISH STOLI" — Living Work Desk hero sub-components
   HeroText, LiveScene, TestCard, CasusCard, MootCard, BlogCard, XpBadge
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE_OUT = [0.22, 1, 0.36, 1] as [number, number, number, number];

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return reduce;
}

/* ── GlassyCard: single shishasimon card wrapper with 3D translateZ + hover ── */
interface GlassyCardProps {
  children: React.ReactNode;
  depth: number; // translateZ in px
  delay: number;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}

function GlassyCard({ children, depth, delay, onClick, ariaLabel, className = '', style }: GlassyCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={false}
      animate={{ z: depth }}
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      style={{
        transformStyle: 'preserve-3d',
        ...style,
      }}
      className={className}
    >
      <button
        onClick={onClick}
        aria-label={ariaLabel}
        className="group relative w-full text-left rounded-2xl bg-white/[0.07] border border-white/[0.12] backdrop-blur-2xl overflow-hidden transition-all duration-500 hover:bg-white/[0.10] hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        style={{
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 40px rgba(8,16,40,0.45)',
        }}
      >
        {/* Soft inner glow */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(circle at 30% 0%, rgba(56,189,248,0.10), transparent 60%)' }} />
        <div className="relative z-10">{children}</div>
      </button>
    </motion.div>
  );
}

/* ── HeroText: left column (badge, title, tagline, description, buttons) ── */
function HeroText({ onNav }: { onNav: (tab: string) => void }) {
  const reduce = useReducedMotion();
  const items = [
    { el: 'badge', delay: 0 },
    { el: 'title', delay: 0.08 },
    { el: 'tagline', delay: 0.16 },
    { el: 'desc', delay: 0.24 },
    { el: 'buttons', delay: 0.32 },
  ];

  const renderEl = (key: string) => {
    switch (key) {
      case 'badge':
        return (
          <div className="inline-flex mb-5">
            <div className="p-px rounded-full" style={{ background: 'linear-gradient(90deg, rgba(56,189,248,0.5), rgba(167,139,250,0.4))' }}>
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
                <Zap className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>SIZ KUTGAN FORMATDAGI TA'LIM</span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              </div>
            </div>
          </div>
        );
      case 'title':
        return (
          <h1 className="font-black tracking-tighter leading-[1.05] mb-3" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}>
            <span className="text-white">Fan</span>
            <span className="ff-title-gradient inline-block pr-[0.06em]">Faster</span>
          </h1>
        );
      case 'tagline':
        return (
          <p className="mb-4">
            <span
              className="inline-block rounded-xl px-4 py-2.5 font-extrabold text-white relative"
              style={{ fontSize: 'clamp(1.1rem, 1.8vw, 1.7rem)', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                style={{ background: 'linear-gradient(180deg, #38bdf8, #8b5cf6)', boxShadow: '0 0 12px rgba(56,189,248,0.5)' }}
              />
              Orzuyingizdagi &apos;men&apos; bugun nimani bilishi kerak?
            </span>
          </p>
        );
      case 'desc':
        return (
          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg mb-6">
            <span className="text-sky-300 font-bold">AI+Human metodi</span> yordamida bilimni yodlamang
            — uni chuqur tushunib, amalda qo&apos;llang.{' '}
            <span className="text-white font-bold">FanFaster</span> — ertangi yuristni bugun tayyorlaydi.
          </p>
        );
      case 'buttons':
        return (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNav('sinov')}
              className="ff-shimmer group relative flex items-center gap-2 px-6 py-3 font-black text-sm rounded-2xl text-white overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
              style={{ boxShadow: '0 8px 30px rgba(99,102,241,0.45)' }}
            >
              <Play className="h-4 w-4 fill-white relative z-10" />
              <span className="relative z-10">O'qishni boshlash</span>
            </button>
            <button
              onClick={() => onNav('oqmatlar')}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/25 text-white font-bold text-sm rounded-2xl hover:bg-white/20 hover:border-sky-400/50 active:scale-[0.98] transition-all backdrop-blur-md"
            >
              <BookOpen className="h-4 w-4" />
              Materiallar
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {items.map((item) => (
        <motion.div
          key={item.el}
          initial={reduce ? false : { opacity: 0, y: 28, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: item.delay }}
        >
          {renderEl(item.el)}
        </motion.div>
      ))}
    </div>
  );
}

/* ── TestCard: auto-cycling quiz with green highlight on correct answer ── */
function TestCard({ reduce }: { reduce: boolean }) {
  const [selected, setSelected] = useState(-1);
  const [correctIdx] = useState(() => Math.floor(Math.random() * 4));
  const cycleRef = useRef(0);

  useEffect(() => {
    if (reduce) return;
    const interval = setInterval(() => {
      cycleRef.current = (cycleRef.current + 1) % 4;
      const idx = cycleRef.current;
      setSelected(idx);
    }, 4000);
    return () => clearInterval(interval);
  }, [reduce]);

  const options = ['A variant', 'B variant', 'C variant', 'D variant'];

  return (
    <div className="p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg" style={{ transform: 'translateZ(20px)' }}>
          <HelpCircle className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-white">Mavjud testlar</p>
          <p className="text-[10px] text-slate-400">Bilim sinovi</p>
        </div>
      </div>
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5 mb-3">
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Quyidagi savollardan to'g'ri javobni belgilang:
        </p>
      </div>
      <div className="space-y-2">
        {options.map((opt, i) => {
          const isCorrect = i === correctIdx;
          const isSelected = i === selected;
          const showCorrect = isCorrect && selected === correctIdx;
          return (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-all duration-500"
              style={{
                background: showCorrect ? 'rgba(16,185,129,0.15)' : isSelected ? 'rgba(56,189,248,0.10)' : 'rgba(255,255,255,0.03)',
                borderColor: showCorrect ? 'rgba(16,185,129,0.4)' : isSelected ? 'rgba(56,189,248,0.3)' : 'rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all"
                style={{
                  borderColor: showCorrect ? '#10b981' : isSelected ? '#38bdf8' : 'rgba(255,255,255,0.2)',
                  background: showCorrect ? '#10b981' : isSelected ? '#38bdf8' : 'transparent',
                }}
              >
                {showCorrect && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
              </div>
              <span
                className="text-[11px] font-semibold transition-colors"
                style={{ color: showCorrect ? '#6ee7b7' : isSelected ? '#bae6fd' : '#94a3b8' }}
              >
                {opt}
              </span>
              {showCorrect && (
                <motion.span
                  initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-auto text-[9px] font-black uppercase text-emerald-400"
                >
                  To'g'ri
                </motion.span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── CasusCard: 92/100 ring + 5 animated criteria bars ── */
function CasusCard({ reduce }: { reduce: boolean }) {
  const [score, setScore] = useState(0);
  const [bars, setBars] = useState<number[]>([0, 0, 0, 0, 0]);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  useEffect(() => {
    if (!inView) return;
    const targets = [78, 85, 72, 90, 88];
    const totalDuration = 2000;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / totalDuration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setScore(Math.round(eased * 92));
      setBars(targets.map(t => Math.round(eased * t)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, reduce]);

  // Idle breathing animation for bars after initial fill
  useEffect(() => {
    if (reduce || !inView) return;
    const targets = [78, 85, 72, 90, 88];
    const interval = setInterval(() => {
      setBars(targets.map(t => t + Math.floor(Math.random() * 6 - 3)));
    }, 3000);
    return () => clearInterval(interval);
  }, [inView, reduce]);

  const R = 28;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (score / 100) * CIRC;

  return (
    <div ref={ref} className="p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg" style={{ transform: 'translateZ(20px)' }}>
          <BrainCircuit className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-white">Mavjud kazuslar</p>
          <p className="text-[10px] text-slate-400">AI xolis bahosi</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-[72px] h-[72px] flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
            <circle
              cx="35" cy="35" r={R} fill="none"
              stroke="url(#casus-grad)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
            <defs>
              <linearGradient id="casus-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-black text-white leading-none">{score}</span>
            <span className="text-[7px] text-slate-400 font-bold">/100</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {['Mantiq', 'Dalil', 'Tahlil', 'Xulosa', 'Uslub'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[8px] text-slate-400 w-10 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400"
                  style={{ width: `${bars[i]}%`, transition: 'width 1.5s cubic-bezier(0.22,1,0.36,1)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── MootCard: two-bubble dialog with typing animation ── */
function MootCard({ reduce }: { reduce: boolean }) {
  const [typedText, setTypedText] = useState('');
  const [showUserReply, setShowUserReply] = useState(false);
  const fullText = "Ishda huquqbuzarlik sodir bo'lganda, sudga taqdim etiladigan asosiy dalillar qanday tartibda baholanadi?";
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  useEffect(() => {
    if (!inView || reduce) {
      if (inView) setTypedText(fullText);
      return;
    }
    let charIdx = 0;
    let replyTimer: ReturnType<typeof setTimeout>;
    const typeInterval = setInterval(() => {
      charIdx++;
      setTypedText(fullText.slice(0, charIdx));
      if (charIdx >= fullText.length) {
        clearInterval(typeInterval);
        replyTimer = setTimeout(() => setShowUserReply(true), 800);
      }
    }, 35);
    return () => { clearInterval(typeInterval); clearTimeout(replyTimer); };
  }, [inView, reduce]);

  // Loop the animation
  useEffect(() => {
    if (reduce || !inView) return;
    const loop = setInterval(() => {
      setTypedText('');
      setShowUserReply(false);
      let charIdx = 0;
      const typeInterval = setInterval(() => {
        charIdx++;
        setTypedText(fullText.slice(0, charIdx));
        if (charIdx >= fullText.length) {
          clearInterval(typeInterval);
          setTimeout(() => setShowUserReply(true), 800);
        }
      }, 35);
    }, 12000);
    return () => clearInterval(loop);
  }, [inView, reduce]);

  return (
    <div ref={ref} className="p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg" style={{ transform: 'translateZ(20px)' }}>
          <Scale className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-white">Moot Court</p>
          <p className="text-[10px] text-slate-400">AI sudya bilan jonli bahs</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {/* AI judge bubble */}
        <div className="flex gap-2 items-start">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
            <Scale className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1 rounded-xl rounded-tl-sm bg-white/[0.06] border border-white/[0.08] px-3 py-2 min-h-[44px]">
            <p className="text-[10px] text-slate-200 leading-relaxed">
              {typedText}
              {typedText.length < fullText.length && !reduce && (
                <span className="inline-block w-[2px] h-3 bg-sky-400 ml-0.5 animate-pulse" />
              )}
            </p>
          </div>
        </div>
        {/* User reply bubble */}
        <AnimatePresence>
          {showUserReply && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex gap-2 items-start justify-end"
            >
              <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/20 px-3 py-2">
                <p className="text-[10px] text-sky-100 leading-relaxed">
                  Dalillar aniqlik, ishonchlilik va qonun bilan bog'liqligi bo'yicha...
                </p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3 w-3 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── BlogCard: latest blog post from Supabase or elegant empty state ── */
function BlogCard({ reduce }: { reduce: boolean }) {
  interface BlogPostLite { sarlavha: string; ustoz_ismi: string; slug: string; }
  const [post, setPost] = useState<BlogPostLite | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  useEffect(() => {
    if (!inView) return;
    supabase
      .from('blog_posts')
      .select('sarlavha, ustoz_ismi, slug')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setPost(data && data.length > 0 ? data[0] : null);
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
  }, [inView]);

  return (
    <div ref={ref} className="p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg" style={{ transform: 'translateZ(20px)' }}>
          <Newspaper className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-black text-white">Blog</p>
          <p className="text-[10px] text-slate-400">So'nggi maqolalar</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-white/10 animate-pulse" />
          <div className="h-3 w-3/4 rounded-full bg-white/8 animate-pulse" />
          <div className="flex items-center gap-2 mt-3">
            <div className="w-6 h-6 rounded-full bg-white/10 animate-pulse" />
            <div className="h-2 w-20 rounded-full bg-white/8 animate-pulse" />
          </div>
        </div>
      ) : post ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5 mb-2">
            <p className="text-[12px] font-bold text-white leading-snug line-clamp-2">{post.sarlavha}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
              <User className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{post.ustoz_ismi}</span>
          </div>
        </motion.div>
      ) : (
        <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3.5 text-center">
          <Newspaper className="h-6 w-6 text-slate-500 mx-auto mb-2" />
          <p className="text-[10px] text-slate-400">Tez orada yangi maqolalar</p>
        </div>
      )}
    </div>
  );
}

/* ── XpBadge: small "+120 XP" living element at scene edge ── */
function XpBadge({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay: 1.0 }}
      className="absolute z-40 pointer-events-none"
      style={{ top: '-8px', left: '-8px' }}
    >
      <motion.div
        animate={reduce ? {} : { y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 backdrop-blur-xl"
        style={{ boxShadow: '0 4px 20px rgba(245,158,11,0.15)' }}
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
          <Trophy className="h-3 w-3 text-white" />
        </div>
        <div>
          <p className="text-[11px] font-black text-amber-200">+120 XP</p>
          <p className="text-[8px] text-amber-300/70">Yangi daraja ochildi</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── LiveScene: right column — 2x2 grid of glassy cards with pointer parallax ── */
function LiveScene({ onNav }: { onNav: (tab: string) => void }) {
  const reduce = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!sceneRef.current || reduce) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: -dy * 5, y: dx * 7 });
  }, [reduce]);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const cards = [
    { comp: TestCard, tab: 'mavjud_testlar', depth: 30, delay: 0.4, z: 30, label: 'Mavjud testlar sahifasiga o\'tish', staggerDown: false },
    { comp: CasusCard, tab: 'mavjud_kazuslar', depth: 50, delay: 0.55, z: 35, label: 'Mavjud kazuslar sahifasiga o\'tish', staggerDown: true },
    { comp: MootCard, tab: 'moot_court', depth: 40, delay: 0.7, z: 25, label: 'Moot Court sahifasiga o\'tish', staggerDown: true },
    { comp: BlogCard, tab: 'blog', depth: 20, delay: 0.85, z: 20, label: 'Blog sahifasiga o\'tish', staggerDown: false },
  ];

  return (
    <div
      ref={sceneRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full"
      style={{ perspective: '1400px', transformStyle: 'preserve-3d' }}
    >
      {/* Soft radial glow behind cards */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.12), rgba(139,92,246,0.08) 45%, transparent 70%)' }}
      />

      {/* Subtle grid lines for depth */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse 65% 65% at 50% 50%, black 35%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 65% at 50% 50%, black 35%, transparent 100%)',
        }}
      />

      <motion.div
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        className="relative h-full"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* 2x2 grid with staggered second column */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 h-full items-stretch">
          {/* Column 1: Test (top) + Moot Court (bottom) */}
          {/* Column 2: Kazus (top, shifted down) + Blog (bottom, shifted down) */}
          {cards.map((card, i) => {
            const CardComp = card.comp;
            const isHovered = hoveredIdx === i;
            const isOtherHovered = hoveredIdx !== null && hoveredIdx !== i;
            const colIdx = i % 2; // 0 = left col, 1 = right col
            const isRightCol = colIdx === 1;
            return (
              <div
                key={i}
                className="relative"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 40, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: card.delay }}
                  style={{
                    transformStyle: 'preserve-3d',
                    marginTop: isRightCol ? '32px' : '0px',
                    zIndex: isHovered ? 50 : card.z,
                  }}
                  className="h-full"
                >
                  <motion.div
                    animate={{
                      scale: isHovered ? 1.03 : isOtherHovered ? 0.98 : 1,
                      z: isHovered ? card.depth + 25 : card.depth,
                    }}
                    transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                    style={{ transformStyle: 'preserve-3d', height: '100%' }}
                  >
                    <GlassyCard
                      depth={card.depth}
                      delay={0}
                      onClick={() => onNav(card.tab)}
                      ariaLabel={card.label}
                      className="h-full"
                    >
                      <div
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        className="h-full"
                      >
                        <CardComp reduce={reduce} />
                      </div>
                    </GlassyCard>
                  </motion.div>
                </motion.div>
              </div>
            );
          })}
        </div>

        <XpBadge reduce={reduce} />
      </motion.div>
    </div>
  );
}

/* ── Mobile wrapper components (static, no auto-animation) ── */
function TestCardReduceless() { return <TestCard reduce={true} />; }
function CasusCardReduceless() { return <CasusCard reduce={true} />; }
function MootCardReduceless() { return <MootCard reduce={true} />; }
function BlogCardReduceless() { return <BlogCard reduce={true} />; }

export default function SaytHaqida({ onNavigate }: SaytHaqidaProps) {
  const { t } = useLang();
  const { user, isAuthenticated } = useAuth();
  const [activeBottomTab, setActiveBottomTab] = useState('haqida');
  const [activeLegal, setActiveLegal] = useState<'none' | 'maxfiylik' | 'shartlar'>('none');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();

  const handleNav = (tab: string) => {
    setActiveBottomTab(tab);
    onNavigate(tab);
  };

  const stats = [
    { icon: Users, value: 1200, suffix: '+', label: 'Faol foydalanuvchilar', color: 'from-blue-500 to-cyan-500' },
    { icon: FileText, value: 4500, suffix: '+', label: 'Testlar va savollar', color: 'from-cyan-500 to-teal-500' },
    { icon: BrainCircuit, value: 850, suffix: '+', label: 'AI baholangan kazuslar', color: 'from-sky-500 to-blue-500' },
    { icon: BookOpen, value: 98, suffix: '%', label: 'Mamnunlik darajasi', color: 'from-emerald-500 to-teal-500' }
  ];



  const features = [
    { icon: BookOpen, color: 'from-blue-500 to-cyan-500', glow: 'group-hover:shadow-blue-500/25', badge: "Modulli ta'lim", title: 'Kurslar', desc: "Coursera uslubida Kurs → Modul → Dars tuzilmasi. Video, PDF, Audio va test bilan to'liq o'quv jarayoni.", btn: "Kurslarga o'tish", tab: 'kurslar' },
    { icon: Library, color: 'from-cyan-500 to-teal-500', glow: 'group-hover:shadow-cyan-500/25', badge: "O'quv markazi", title: "O'quv materiallari", desc: "Sara va miyaga tez muhrlanadigan kontent. Murakkab mavzular oddiy tilda tushuntirilgan.", btn: "Materiallarni ko'rish", tab: 'oqmatlar' },
    { icon: BarChart3, color: 'from-sky-500 to-blue-500', glow: 'group-hover:shadow-sky-500/25', badge: 'Bilim sinovi', title: 'Mavjud testlar', desc: "Xolis va qat'iy filtrlardan o'tgan testlar. O'z kuchingizni amalda tasdiqlang.", btn: 'Testlarni boshlash', tab: 'mavjud_testlar' },
    { icon: BrainCircuit, color: 'from-emerald-500 to-teal-500', glow: 'group-hover:shadow-emerald-500/25', badge: 'AI tahlil', title: 'Mavjud kazuslar', desc: "Haqiqiy muammolar, murakkab ssenariylar va ularga AI ning xolis bahosi.", btn: 'Kazus yechishni boshlash', tab: 'mavjud_kazuslar' }
  ];

  const values = [
    { icon: Eye, title: 'Vizyon', desc: "Har bir o'quvchi o'z salohiyatini to'liq ro'yoobga chiqarishi uchun zamonaviy vositalar yaratish." },
    { icon: Lightbulb, title: 'Innovatsiya', desc: "Sun'iy intellekt va pedagogik tajribani birlashtirib, ta'limda yangi standartlar o'rnatish." },
    { icon: Heart, title: "G'amxo'rlik", desc: "Har bir o'quvchiga shaxsiylashtirilgan yondashuv — sizning muvaffaqiyatingiz bizning maqsadimiz." },
    { icon: Shield, title: 'Sifat', desc: "Faqat eng sara, tekshirilgan va tizimlashtirilgan bilim. Hech qanday shovqin, faqat foyda." }
  ];

  return (
    <div className="w-full mx-auto font-sans text-slate-900 selection:bg-blue-200 selection:text-blue-900">

      <ScrollProgress />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION — Premium cinematic hero
          ═══════════════════════════════════════════════════════════════════ */}
      <style>{`
        @keyframes ff-flow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        .ff-title-gradient {
          background: linear-gradient(100deg, #ffffff 0%, #7dd3fc 20%, #38bdf8 38%, #818cf8 58%, #c4b5fd 74%, #ffffff 100%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: ff-flow 8s ease-in-out infinite alternate;
          filter: drop-shadow(0 0 28px rgba(56,189,248,0.35));
        }
        @media (prefers-reduced-motion: reduce) {
          .ff-title-gradient { animation: none; -webkit-text-fill-color: #7dd3fc; color: #7dd3fc; filter: none; }
        }
        .ff-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
          pointer-events: none;
        }
        .ff-shimmer:hover::after { transform: translateX(100%); }
        @media (hover: none) {
          .ff-spotlight { display: none; }
        }
      `}</style>
      <section
        ref={heroRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * 100;
          const my = ((e.clientY - rect.top) / rect.height) * 100;
          e.currentTarget.style.setProperty('--mx', `${mx}%`);
          e.currentTarget.style.setProperty('--my', `${my}%`);
        }}
        className="relative isolate overflow-hidden rounded-3xl mb-10 px-6 py-8 md:px-10 md:py-10 lg:py-12 bg-gradient-to-br from-[#040814] via-[#0a1a4d] to-[#050b1f]"
      >
        {/* Glows */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full bg-blue-500/25 blur-3xl -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl translate-y-1/3 -translate-x-1/4" />
          <div className="absolute top-1/2 left-1/3 w-72 h-72 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        {/* Grid overlay with radial mask */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)',
          }}
        />

        {/* Mouse spotlight */}
        <div
          aria-hidden="true"
          className="ff-spotlight pointer-events-none absolute inset-0 z-0"
          style={{
            background: 'radial-gradient(520px circle at var(--mx, 30%) var(--my, 20%), rgba(56,189,248,0.10), transparent 60%)',
          }}
        />

        {/* Shooting stars */}
        <ShootingStars />

        {/* Content — "Tirik ish stoli" (Living Work Desk) */}
        <div className="relative z-10 grid lg:grid-cols-[0.38fr_0.62fr] gap-6 lg:gap-8 items-center">
          {/* Left column — text */}
          <HeroText onNav={handleNav} />

          {/* Right column — live scene (desktop) */}
          <div className="hidden lg:block relative h-[440px]">
            <LiveScene onNav={handleNav} />
          </div>

          {/* Mobile fallback — stacked cards (no parallax, lighter animation) */}
          <div className="lg:hidden space-y-3">
            <GlassyCard depth={0} delay={0.3} onClick={() => handleNav('mavjud_testlar')} ariaLabel="Mavjud testlar sahifasiga o'tish">
              <TestCardReduceless />
            </GlassyCard>
            <GlassyCard depth={0} delay={0.4} onClick={() => handleNav('mavjud_kazuslar')} ariaLabel="Mavjud kazuslar sahifasiga o'tish">
              <CasusCardReduceless />
            </GlassyCard>
            <GlassyCard depth={0} delay={0.5} onClick={() => handleNav('moot_court')} ariaLabel="Moot Court sahifasiga o'tish">
              <MootCardReduceless />
            </GlassyCard>
            <GlassyCard depth={0} delay={0.6} onClick={() => handleNav('blog')} ariaLabel="Blog sahifasiga o'tish">
              <BlogCardReduceless />
            </GlassyCard>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATISTICS — Animated counters with glass cards
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {stats.map((s, i) => (
            <motion.div key={i} variants={scaleIn}>
              <TiltCard intensity={6} className="h-full">
                <Card className="group relative border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl hover:shadow-xl transition-all duration-300 overflow-hidden h-full">
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${s.color} pointer-events-none`} style={{ mixBlendMode: 'overlay' }} />
                  <CardContent className="p-5 flex flex-col items-center text-center gap-2 relative z-10">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg`}>
                      <s.icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums">
                      <AnimatedCounter target={s.value} suffix={s.suffix} />
                    </p>
                    <p className="text-xs text-slate-500 font-semibold leading-tight">{s.label}</p>
                  </CardContent>
                </Card>
              </TiltCard>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          USER STATE — Welcome or CTA
          ═══════════════════════════════════════════════════════════════════ */}
      {isAuthenticated && user ? (
        <section className="mb-12">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <Card className="border border-blue-100/80 bg-gradient-to-r from-blue-50 via-cyan-50 to-sky-50 rounded-3xl shadow-md overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-blue-200/20 blur-3xl translate-x-1/3 -translate-y-1/3" />
              <CardContent className="p-6 md:p-8 relative z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      whileInView={{ scale: 1, rotate: 0 }}
                      viewport={{ once: true }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg"
                    >
                      <span className="text-white font-black text-lg uppercase">{user.ism?.[0]}{user.familiya?.[0]}</span>
                    </motion.div>
                    <div>
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-0.5">Xush kelibsiz!</p>
                      <h2 className="text-xl font-black text-slate-900">{user.ism} {user.familiya}</h2>
                      <p className="text-sm text-slate-500 font-medium capitalize">{user.rol === 'ustoz' ? 'Ustoz' : "O'quvchi"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleNav('kurslar')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] shadow-md">
                      <BookOpen className="h-3.5 w-3.5" />Kurslarga o'tish
                    </button>
                    <button onClick={() => handleNav('profil')} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98]">
                      <User className="h-3.5 w-3.5" />Profil
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      ) : (
        <section className="mb-12">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <Card className="border border-amber-100/80 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-3xl shadow-md overflow-hidden relative">
              <motion.div
                className="absolute top-0 right-0 w-64 h-64 rounded-full bg-orange-200/20 blur-3xl translate-x-1/3 -translate-y-1/3"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
                  >
                    <Target className="h-6 w-6 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Bilim darajangizni aniqlang</h2>
                    <p className="text-sm text-slate-500 font-medium">Ro'yxatdan o'tib, shaxsiy o'quv rejangizni yarating</p>
                  </div>
                </div>
                <MagneticButton
                  onClick={() => window.dispatchEvent(new Event('open-login-modal'))}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] whitespace-nowrap"
                >
                  Bepul boshlash<ArrowRight className="h-4 w-4" />
                </MagneticButton>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          HOW IT WORKS — Redesigned with 3D phone mockup & animated connecting line
          ═══════════════════════════════════════════════════════════════════ */}
      <HowItWorksSection />

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURE CARDS — Premium hover with glow
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="space-y-8">
          <motion.div variants={fadeUp} className="text-center space-y-2">
            <p className="text-xs font-black text-cyan-600 uppercase tracking-[0.35em]">Imkoniyatlar</p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">Nima o'rganishingiz mumkin?</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">FanFaster sizga to'liq ta'lim ekotizimini taqdim etadi</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp} className="group">
                <Card className={`relative border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm rounded-3xl overflow-hidden h-full hover:shadow-2xl hover:-translate-y-1 ${f.glow} transition-all duration-500`}>
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500`} />

                  <CardContent className="p-6 md:p-8 flex flex-col gap-5 h-full relative z-10">
                    <div className="flex items-start gap-4">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-lg shrink-0`}
                      >
                        <f.icon className="h-6 w-6 text-white" />
                      </motion.div>
                      <div className="flex-1 min-w-0">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                          <Sparkles className="h-3 w-3" />
                          {f.badge}
                        </span>
                        <h3 className="text-lg font-black text-slate-900 leading-tight">{f.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1">{f.desc}</p>
                    <button
                      onClick={() => handleNav(f.tab)}
                      className={`group/btn relative w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r ${f.color} text-white font-black text-xs rounded-2xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all overflow-hidden`}
                    >
                      <span className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                      {f.btn}
                      <ArrowRight className="h-3.5 w-3.5 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          VALUES — Mission & Vision cards
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="space-y-6"
        >
          <motion.div variants={fadeUp} className="text-center space-y-2">
            <p className="text-xs font-black text-sky-600 uppercase tracking-[0.35em]">Qadriyatlar</p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">Bizga nima yoqadi?</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {values.map((v, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="group border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl h-full hover:shadow-lg transition-all duration-300 overflow-hidden">
                  <CardContent className="p-6 flex flex-col gap-3 items-start">
                    <motion.div
                      whileHover={{ scale: 1.15, y: -2 }}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 flex items-center justify-center"
                    >
                      <v.icon className="h-5 w-5 text-blue-600" />
                    </motion.div>
                    <h3 className="font-black text-slate-900 text-sm">{v.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{v.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          QUOTE BANNER
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          <Card className="relative border-none bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden rounded-3xl">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(56,189,248,0.3), transparent 50%), radial-gradient(circle at 80% 50%, rgba(14,165,233,0.3), transparent 50%)' }} />
            <CardContent className="p-8 md:p-12 relative z-10 text-center max-w-2xl mx-auto">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 150, damping: 12 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg mx-auto mb-6"
              >
                <Quote className="h-7 w-7 text-white" />
              </motion.div>
              <p className="text-lg md:text-2xl font-bold leading-relaxed mb-4">
                "Bilim — bu qudrat. Lekin <span className="text-cyan-400">qo'llash</span> — bu haqiqiy kuch."
              </p>
              <p className="text-sm text-slate-400">
                FanFaster sizga bilim beradi, qo'llashni esa o'zingiz o'rganasiz
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          AUTHORS — Team cards with animated avatars
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="space-y-6">
          <motion.div variants={fadeUp} className="flex items-center gap-4">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">Jamoa</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { icon: Award, color: 'from-blue-500 to-cyan-500', role: t('about.author1_role'), name: t('about.author1_name'), desc: t('about.author1_desc') },
              { icon: Code2, color: 'from-slate-700 to-slate-900', role: t('about.author2_role'), name: t('about.author2_name'), desc: t('about.author2_desc') }
            ].map((a, i) => (
              <motion.div key={i} variants={i === 0 ? slideInLeft : slideInRight}>
                <TiltCard intensity={4} className="h-full">
                  <Card className="group border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm rounded-3xl hover:shadow-xl transition-all duration-300 overflow-hidden h-full">
                    <div className={`h-1.5 bg-gradient-to-r ${a.color}`} />
                    <CardContent className="p-6 md:p-8">
                      <div className="flex items-center gap-5">
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 3 }}
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-lg shrink-0`}
                        >
                          <a.icon className="h-8 w-8 text-white" />
                        </motion.div>
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{a.role}</p>
                          <h3 className="text-lg font-black text-slate-900 leading-tight">{a.name}</h3>
                          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{a.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA BANNER — Dark with animated globe
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
          <Card className="border-none bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white overflow-hidden rounded-3xl relative">
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.15),transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.1),transparent_50%)]" />
            </div>
            <CardContent className="p-8 md:p-14 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-5 md:max-w-xl">
                <div className="flex items-center gap-3 text-cyan-400 text-[10px] font-black uppercase tracking-[0.5em]">
                  <div className="w-8 h-px bg-cyan-400" />Platforma
                </div>
                <h2 className="text-3xl md:text-4xl font-black leading-tight tracking-tighter">
                  Bilim{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">ummoni</span>
                  {' '}sizni kutmoqda
                </h2>
                <p className="text-slate-400 text-base leading-relaxed">
                  Hozir qo'shiling — bepul. Modulli kurslar, AI-baholash, testlar va kazuslar siz uchun tayyor.
                </p>
                <div className="flex flex-wrap gap-3">
                  <MagneticButton
                    onClick={() => handleNav('kurslar')}
                    className="group flex items-center gap-2 px-7 py-3.5 bg-white text-slate-950 hover:bg-cyan-400 hover:text-white font-black text-sm rounded-xl transition-all active:scale-[0.98] shadow-lg"
                  >
                    Boshlash<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </MagneticButton>
                  <MagneticButton
                    onClick={() => handleNav('mavjud_testlar')}
                    className="flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/20 text-white font-bold text-sm rounded-xl hover:bg-white/20 active:scale-[0.98] transition-all backdrop-blur-sm"
                  >
                    Testlarni ko'rish
                  </MagneticButton>
                </div>
              </div>

              {/* Animated Globe */}
              <div className="relative flex-shrink-0 flex items-center justify-center w-48 h-48 md:w-60 md:h-60">
                <motion.div
                  className="absolute inset-0 rounded-full border border-cyan-400/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                </motion.div>
                <motion.div
                  className="absolute inset-6 rounded-full border border-blue-400/30"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                </motion.div>
                <motion.div
                  className="absolute inset-12 rounded-full border border-cyan-300/20"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Compass className="relative z-10 h-20 w-20 md:h-28 md:w-28 text-cyan-400/70" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FAQ — Animated accordion
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12" id="faq">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="space-y-5">
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2.5 rounded-xl shadow-lg"
            >
              <HelpCircle className="h-5 w-5 text-white" />
            </motion.div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Ko'p so'raladigan savollar</h2>
              <p className="text-xs text-slate-500">Eng ko'p beriladigan savollarga javoblar</p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="space-y-2.5">
            {FAQ_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <div
                  className={`group bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                    openFaqIndex === i ? 'border-blue-300 shadow-md' : 'border-slate-200 hover:border-blue-200'
                  }`}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className="text-sm font-bold text-slate-800 pr-4 flex items-center gap-3">
                      <span className={`text-[10px] font-black tabular-nums transition-colors ${openFaqIndex === i ? 'text-blue-500' : 'text-slate-300'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {item.q}
                    </span>
                    <motion.div
                      animate={{ rotate: openFaqIndex === i ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex-shrink-0"
                    >
                      <ChevronDown className={`h-4 w-4 transition-colors ${openFaqIndex === i ? 'text-blue-500' : 'text-slate-400'}`} />
                    </motion.div>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaqIndex === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 pt-1 border-t border-slate-100">
                          <p className="text-sm text-slate-600 leading-relaxed pl-6">{item.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-blue-900">Savolingiz topilmadimi?</p>
              <p className="text-xs text-blue-700">
                Yordam bo'limiga yozing yoki qo'ng'iroq qiling:{' '}
                <a href="tel:+998902686363" className="font-black underline hover:no-underline">+998 90 268-63-63</a>
              </p>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PRIVACY + TERMS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
          <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <button
                onClick={() => setActiveLegal(activeLegal === 'maxfiylik' ? 'none' : 'maxfiylik')}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-xl"><Lock className="h-5 w-5 text-slate-600" /></div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 text-sm">Maxfiylik siyosati</p>
                    <p className="text-xs text-slate-500">Ma'lumotlaringiz qanday saqlanadi</p>
                  </div>
                </div>
                <motion.div animate={{ rotate: activeLegal === 'maxfiylik' ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {activeLegal === 'maxfiylik' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100"><FormatMatn text={MAXFIYLIK_MATN} /></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
              <button
                onClick={() => setActiveLegal(activeLegal === 'shartlar' ? 'none' : 'shartlar')}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-xl"><FileText className="h-5 w-5 text-blue-600" /></div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900 text-sm">Foydalanish shartlari</p>
                    <p className="text-xs text-slate-500">Platformadan foydalanish qoidalari</p>
                  </div>
                </div>
                <motion.div animate={{ rotate: activeLegal === 'shartlar' ? 180 : 0 }} transition={{ duration: 0.3 }}>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {activeLegal === 'shartlar' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 border-t border-slate-100"><FormatMatn text={SHARTLAR_MATN} /></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-sm mb-28 md:mb-8 overflow-hidden">
        <div className="p-8 md:p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4 text-white" />
                </div>
                <span className="font-black text-lg text-slate-900">FanFaster</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">O'zbekistondagi o'quvchilar uchun AI-yordamida o'qish platformasi.</p>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <a href="mailto:info@fanfaster.uz" className="text-xs text-slate-500 hover:text-blue-600 transition-colors">info@fanfaster.uz</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <a href="tel:+998902686363" className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-semibold">+998 90 268-63-63</a>
              </div>
            </div>
            <nav>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3">Platforma</h3>
              <ul className="space-y-2">
                {[
                  { label: 'Kurslar', tab: 'kurslar' },
                  { label: 'Testlar', tab: 'mavjud_testlar' },
                  { label: 'Kazuslar', tab: 'mavjud_kazuslar' },
                  { label: "O'quv materiallari", tab: 'oqmatlar' },
                  { label: 'Savol-Javoblar', tab: 'savol_javob' }
                ].map(l => (
                  <li key={l.tab}>
                    <button onClick={() => handleNav(l.tab)} className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium text-left">{l.label}</button>
                  </li>
                ))}
              </ul>
            </nav>
            <nav>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3">Yordam</h3>
              <ul className="space-y-2">
                <li><button onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })} className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium text-left">Ko'p so'raladigan savollar</button></li>
                <li><button onClick={() => handleNav('yordam')} className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium text-left">Yordam markazi</button></li>
                <li><button onClick={() => setActiveLegal('maxfiylik')} className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium text-left">Maxfiylik siyosati</button></li>
                <li><button onClick={() => setActiveLegal('shartlar')} className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium text-left">Foydalanish shartlari</button></li>
              </ul>
            </nav>
            <nav>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3">Aloqa</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <a href="tel:+998902686363" className="text-xs text-slate-700 font-bold hover:text-blue-600 transition-colors">+998 90 268-63-63</a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <a href="mailto:info@fanfaster.uz" className="text-xs text-slate-500 hover:text-blue-600 transition-colors">info@fanfaster.uz</a>
                </li>
                <li className="pt-2">
                  <button onClick={() => handleNav('yordam')} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">Yordam so'rash</button>
                </li>
              </ul>
            </nav>
          </div>
          <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} FanFaster.uz — Barcha huquqlar himoyalangan</p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v2.0</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600">Tizim ishlayapti</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE NAVIGATION
          ═══════════════════════════════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed inset-x-4 z-50 rounded-[28px] border border-white/50 bg-white/70 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-around gap-1">
          {[
            { tab: 'haqida', icon: Info, label: 'Asosiy' },
            { tab: 'kurslar', icon: BookOpen, label: 'Kurslar' },
            { tab: 'oqmatlar', icon: Library, label: 'Materiallar' },
            { tab: 'yordam', icon: HelpCircle, label: 'Yordam' },
            { tab: 'profil', icon: User, label: 'Profil' }
          ].map(item => {
            const active = activeBottomTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => handleNav(item.tab)}
                className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center rounded-xl px-2 transition-all relative ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {active && (
                  <motion.div
                    layoutId="mobileNavHighlight"
                    className="absolute inset-0 bg-blue-50 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                )}
                <item.icon className="h-5 w-5 relative z-10" />
                <span className="text-[9px] font-bold relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
