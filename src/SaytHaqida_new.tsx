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
  Send, Link2, LogOut
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLang } from '@/contexts/LangContext';
import { useAuth } from '@/contexts/AuthContext';

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

function MootCourtScoreRing() {
  const ringRef = useRef<SVGCircleElement>(null);
  const [score, setScore] = useState(0);
  const inView = useInView(ringRef, { once: true });

  useEffect(() => {
    if (!inView) return;
    const target = 92;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setScore(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView]);

  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (score / 100) * CIRC;

  return (
    <div className="relative w-[88px] h-[88px] flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          ref={ringRef}
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-black text-white leading-none">{score}</span>
        <span className="text-[8px] text-slate-400 font-bold">/100</span>
      </div>
    </div>
  );
}

function HeroGlassCard({
  children, rotate, delay, duration, className = '',
}: {
  children: React.ReactNode; rotate: number; delay: number; duration: number; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40, filter: 'blur(8px)' }}
      animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
      transition={{ type: 'spring', stiffness: 80, damping: 18, delay }}
      className={className}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
        className="bg-white/[0.06] border border-white/15 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_8px_32px_rgba(56,189,248,0.12)]"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATISTICS — "Raqamning o'zi qahramon"
   Sub-components: DotMatrixCrowd, LayeredSheets, NetworkGraph,
   SatisfactionRing, StatCard, StatsGrid
   Each visual occupies 40%+ of card area and is integrated with the number.
   Main visuals opacity 0.6–1, background layers 0.15–0.3.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as [number, number, number, number];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduce(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduce;
}

function useIsTouch() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const handler = () => setIsTouch(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTouch;
}

function useInViewOnce(margin = '-60px') {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin });
  return { ref, inView };
}

function useCountUp(target: number, start: boolean, reduce: boolean, duration = 1600) {
  const [value, setValue] = useState(reduce ? target : 0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!start) return;
    if (reduce) { setValue(target); return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(Math.round(eased * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [start, target, reduce, duration]);
  return value;
}

/* ── 3D Tilt hook: pointer on desktop, auto-sway on touch, none on reduced-motion ── */
function use3DTilt(reduce: boolean, isTouch: boolean, index: number, intensity = 8) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spotX, setSpotX] = useState(50);
  const [spotY, setSpotY] = useState(50);
  const [autoTilt, setAutoTilt] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (reduce || !isTouch) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setAutoTilt({ x: Math.sin(t * 0.7 + index) * 3, y: Math.cos(t * 0.5 + index) * 3 });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, isTouch, index]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || reduce || isTouch) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width;
    const dy = (e.clientY - rect.top) / rect.height;
    setTilt({ x: -(dy - 0.5) * intensity, y: (dx - 0.5) * intensity });
    setSpotX(dx * 100);
    setSpotY(dy * 100);
    setHovered(true);
  }, [reduce, isTouch, intensity]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
    setSpotX(50);
    setSpotY(50);
    setHovered(false);
  }, []);

  return { ref, effectiveTilt: isTouch ? autoTilt : tilt, spotX, spotY, hovered, handleMouseMove, handleMouseLeave };
}

type StatItem = {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  suffix: string;
  label: string;
  color: string;
  accent: string;
  microType: string;
};

/* ═══ Visual 1: Dot Matrix "Crowd" — bottom strip, wave lights left→right (~4s cycle) ═══ */
function DotMatrixCrowd({ accent, reduce }: { accent: string; reduce: boolean }) {
  const cols = 14;
  const rows = 3;
  const [wavePos, setWavePos] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setWavePos(p => (p + 0.5) % (cols + 4)), 200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      className="w-full"
      aria-hidden="true"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '4px', justifyItems: 'center' }}
    >
      {Array.from({ length: cols * rows }).map((_, i) => {
        const col = i % cols;
        const dist = wavePos - col;
        const lit = dist >= 0 && dist <= 4;
        const intensity = lit ? Math.max(0, 1 - dist / 4) : 0;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: '5px',
              height: '5px',
              background: accent,
              opacity: reduce ? 0.55 : 0.2 + intensity * 0.7,
              transform: reduce ? 'scale(1)' : `scale(${1 + intensity * 0.4})`,
              boxShadow: lit && !reduce ? `0 0 6px ${accent}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/* ═══ Visual 2: Layered Glass Sheets — isometric 3D document stack, breathing ±3px
   Pointer hover: fan out. Touch: slight default fan. Looks like real document pages. ═══ */
function LayeredSheets({ accent, reduce, isTouch, hovered }: { accent: string; reduce: boolean; isTouch: boolean; hovered: boolean }) {
  const sheetCount = 4;
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true" style={{ perspective: '700px', transformStyle: 'preserve-3d' }}>
      {Array.from({ length: sheetCount }).map((_, i) => {
        const baseZ = (i - (sheetCount - 1) / 2) * 10;
        const fanOffset = hovered ? (i - (sheetCount - 1) / 2) * 20 : isTouch ? (i - (sheetCount - 1) / 2) * 8 : 0;
        return (
          <motion.div
            key={i}
            className="absolute rounded-lg border bg-white/85 shadow-sm overflow-hidden"
            style={{ borderColor: `${accent}30`, width: '62%', height: '72%', transformStyle: 'preserve-3d' }}
            animate={reduce ? {} : { translateZ: [baseZ - 1.5, baseZ + 1.5, baseZ - 1.5] }}
            transition={{ duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
          >
            <motion.div
              animate={{ x: fanOffset, rotateY: hovered ? fanOffset * 0.4 : 0, opacity: hovered ? 1 : 0.85 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Document content lines */}
              <div className="p-2.5 space-y-1.5">
                <div className="h-1.5 w-1/3 rounded-full" style={{ background: `${accent}50` }} />
                <div className="h-1 w-full rounded-full bg-slate-200" />
                <div className="h-1 w-5/6 rounded-full bg-slate-200" />
                <div className="h-1 w-4/5 rounded-full bg-slate-200" />
                <div className="h-1 w-3/4 rounded-full bg-slate-200" />
                {i === 0 && (
                  <>
                    <div className="h-1 w-2/3 rounded-full bg-slate-200 mt-2" />
                    <div className="h-1 w-1/2 rounded-full bg-slate-200" />
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ═══ Visual 3: Network Graph — card background, 12 nodes, pulse travels along edges ═══ */
function NetworkGraph({ accent, reduce }: { accent: string; reduce: boolean }) {
  const nodes = useMemo(() => [
    { x: 15, y: 20 }, { x: 45, y: 12 }, { x: 78, y: 18 }, { x: 25, y: 45 },
    { x: 55, y: 38 }, { x: 85, y: 42 }, { x: 12, y: 68 }, { x: 40, y: 62 },
    { x: 68, y: 55 }, { x: 90, y: 72 }, { x: 30, y: 82 }, { x: 60, y: 85 },
  ], []);

  const edges = useMemo(() => [
    [0, 1], [1, 2], [0, 3], [1, 4], [2, 5], [3, 4], [4, 5],
    [3, 6], [4, 7], [5, 8], [6, 7], [7, 8], [6, 9], [8, 9],
    [7, 10], [8, 11], [10, 11], [0, 4], [2, 4],
  ], []);

  const [activeEdge, setActiveEdge] = useState(0);
  const [litNode, setLitNode] = useState(-1);

  useEffect(() => {
    if (reduce) return;
    const edgeId = setInterval(() => setActiveEdge(p => (p + 1) % edges.length), 1200);
    const nodeId = setInterval(() => setLitNode(Math.floor(Math.random() * nodes.length)), 2200);
    return () => { clearInterval(edgeId); clearInterval(nodeId); };
  }, [reduce, edges.length, nodes.length]);

  const edge = edges[activeEdge];

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke={accent}
          strokeWidth={i === activeEdge && !reduce ? 0.8 : 0.4}
          strokeOpacity={i === activeEdge && !reduce ? 0.7 : 0.2}
          style={{ transition: 'stroke-width 0.4s ease, stroke-opacity 0.4s ease' }}
        />
      ))}
      {!reduce && edge && (
        <motion.circle
          key={`pulse-${activeEdge}`}
          r="1.5"
          fill={accent}
          initial={{ cx: nodes[edge[0]].x, cy: nodes[edge[0]].y, opacity: 0 }}
          animate={{ cx: nodes[edge[1]].x, cy: nodes[edge[1]].y, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.2, ease: 'linear', opacity: { duration: 1.2, times: [0, 0.15, 0.85, 1] } }}
        />
      )}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x} cy={n.y}
          r={i === litNode && !reduce ? 2 : 1.2}
          fill={accent}
          opacity={i === litNode && !reduce ? 1 : 0.55}
          style={{ transition: 'r 0.3s ease, opacity 0.3s ease' }}
        />
      ))}
    </svg>
  );
}

/* ═══ Visual 4: Satisfaction Ring — wraps around the number itself, draws 0→98% ═══ */
function SatisfactionRing({ accent, reduce, inView }: { accent: string; reduce: boolean; inView: boolean }) {
  const R = 44;
  const CIRC = 2 * Math.PI * R;
  const [dash, setDash] = useState(reduce ? 0.02 : 1);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setDash(0.02); return; }
    const startTime = performance.now();
    const duration = 1600;
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDash(1 - eased * 0.98);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, reduce]);

  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r={R} fill="none" stroke={accent} strokeOpacity="0.12" strokeWidth="4" />
      <circle
        cx="50" cy="50" r={R}
        fill="none" stroke={accent} strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={dash * CIRC}
        style={{
          filter: dash < 0.05 ? `drop-shadow(0 0 6px ${accent})` : 'none',
          transition: 'filter 0.6s ease',
        }}
      />
    </svg>
  );
}

/* ═══ StatCard: number is the hero, visual lives around/behind/within it ═══ */
function StatCard({ stat, index, reduce, isTouch }: { stat: StatItem; index: number; reduce: boolean; isTouch: boolean }) {
  const { ref: inViewRef, inView } = useInViewOnce('-30px');
  const tilt = use3DTilt(reduce, isTouch, index, 8);
  const count = useCountUp(stat.value, inView, reduce);
  const Icon = stat.icon;

  return (
    <motion.div
      ref={inViewRef}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: EASE_OUT_EXPO }}
    >
      <div
        ref={tilt.ref}
        onMouseMove={tilt.handleMouseMove}
        onMouseLeave={tilt.handleMouseLeave}
        className="relative h-full min-h-[210px] rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm overflow-hidden transition-shadow duration-500 hover:shadow-xl"
        style={{
          transform: `perspective(900px) rotateX(${tilt.effectiveTilt.x}deg) rotateY(${tilt.effectiveTilt.y}deg)`,
          transition: isTouch ? 'none' : 'transform 0.2s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Pointer-following radial highlight */}
        {!isTouch && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(220px circle at ${tilt.spotX}% ${tilt.spotY}%, ${stat.accent}15, transparent 60%)` }}
          />
        )}

        {/* Background visual — network graph behind kazuslar card */}
        {stat.microType === 'kazuslar' && (
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.28 }}>
            <NetworkGraph accent={stat.accent} reduce={reduce} />
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 p-5 flex flex-col items-center justify-center gap-3 h-full" style={{ transformStyle: 'preserve-3d' }}>
          {/* 3D Icon plate — 3 layers: shadow, main plate, top highlight */}
          <div style={{ transform: 'translateZ(12px)', transformStyle: 'preserve-3d' }}>
            <div
              className={`absolute inset-0 rounded-xl bg-gradient-to-br ${stat.color} blur-md`}
              style={{ transform: 'translateZ(-4px) scale(1.05)', opacity: 0.35 }}
            />
            <div
              className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <Icon className="h-5 w-5 text-white" style={{ transform: 'translateZ(4px)' }} />
              <div className="absolute inset-x-0 top-0 h-1/3 rounded-t-xl bg-white/25" style={{ transform: 'translateZ(2px)' }} />
            </div>
          </div>

          {/* Number + integrated visual */}
          <div className="relative flex items-center justify-center" style={{ minHeight: '70px' }}>
            {stat.microType === 'satisfaction' ? (
              <div className="relative w-[115px] h-[115px] flex items-center justify-center">
                <SatisfactionRing accent={stat.accent} reduce={reduce} inView={inView} />
                <p
                  className="relative z-10 text-3xl font-black text-slate-900 tabular-nums leading-none text-center"
                  aria-label={`${stat.value.toLocaleString()}${stat.suffix}`}
                >
                  {count.toLocaleString()}{stat.suffix}
                </p>
              </div>
            ) : stat.microType === 'tests' ? (
              <div className="relative w-full h-[80px] flex items-center justify-center">
                <LayeredSheets accent={stat.accent} reduce={reduce} isTouch={isTouch} hovered={tilt.hovered} />
                <p
                  className="relative z-10 text-3xl font-black text-slate-900 tabular-nums leading-none bg-white/50 backdrop-blur-sm px-2 rounded"
                  aria-label={`${stat.value.toLocaleString()}${stat.suffix}`}
                >
                  {count.toLocaleString()}{stat.suffix}
                </p>
              </div>
            ) : (
              <p
                className="text-3xl md:text-4xl font-black text-slate-900 tabular-nums leading-none"
                aria-label={`${stat.value.toLocaleString()}${stat.suffix}`}
              >
                {count.toLocaleString()}{stat.suffix}
              </p>
            )}
          </div>

          {/* Label */}
          <p className="text-xs text-slate-500 font-semibold leading-tight text-center">{stat.label}</p>

          {/* Bottom visual — dot matrix crowd for users card */}
          {stat.microType === 'users' && (
            <div className="w-full mt-1" style={{ opacity: 0.9 }}>
              <DotMatrixCrowd accent={stat.accent} reduce={reduce} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══ StatsGrid: 4 cards with shared pointer spotlight ═══ */
function StatsGrid({ stats, reduce, isTouch }: { stats: StatItem[]; reduce: boolean; isTouch: boolean }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [spotX, setSpotX] = useState(50);
  const [spotY, setSpotY] = useState(50);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current || reduce || isTouch) return;
    const rect = gridRef.current.getBoundingClientRect();
    setSpotX(((e.clientX - rect.left) / rect.width) * 100);
    setSpotY(((e.clientY - rect.top) / rect.height) * 100);
  }, [reduce, isTouch]);

  return (
    <div ref={gridRef} onMouseMove={handleMouseMove} className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
      {!isTouch && (
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl transition-all duration-300"
          style={{ background: `radial-gradient(400px circle at ${spotX}% ${spotY}%, rgba(56,189,248,0.10), transparent 50%)` }}
        />
      )}
      {stats.map((s, i) => (
        <StatCard key={i} stat={s} index={i} reduce={reduce} isTouch={isTouch} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CTA BANNER — "Raised plate" + concentric target
   Sub-components: ConcentricTarget, CtaBanner
   No background shapes over text/button. Wave lines emanate from target only.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── ConcentricTarget: 4 disks at different Z layers, pointer tilt,
   arrow flies in on load and on button hover. Wave lines from center only. ── */
function ConcentricTarget({ reduce, isTouch, active }: { reduce: boolean; isTouch: boolean; active: boolean }) {
  const { ref, inView } = useInViewOnce('-40px');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [arrowIn, setArrowIn] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setArrowIn(true); return; }
    const id = setTimeout(() => setArrowIn(true), 300);
    return () => clearTimeout(id);
  }, [inView, reduce]);

  useEffect(() => {
    if (!active || reduce) return;
    setArrowIn(false);
    const id = setTimeout(() => setArrowIn(true), 100);
    return () => clearTimeout(id);
  }, [active, reduce]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || reduce || isTouch) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -dy * 12, y: dx * 12 });
  }, [ref, reduce, isTouch]);

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const [autoTilt, setAutoTilt] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (reduce || !isTouch) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      setAutoTilt({ x: Math.sin(t * 0.5) * 4, y: Math.cos(t * 0.4) * 4 });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, isTouch]);

  const effTilt = isTouch ? autoTilt : tilt;
  const disks = [
    { size: 124, z: 0, opacity: 0.2, duration: 6 },
    { size: 92, z: 14, opacity: 0.45, duration: 4.5 },
    { size: 60, z: 28, opacity: 0.75, duration: 3 },
    { size: 36, z: 42, opacity: 1, duration: 2 },
  ];

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-28 h-28 md:w-32 md:h-32 flex items-center justify-center shrink-0"
      style={{ perspective: '500px', transformStyle: 'preserve-3d' }}
      aria-hidden="true"
    >
      {/* Concentric wave lines — emanate from center, never cross text/button */}
      {!reduce && [0, 1, 2].map(i => (
        <motion.div
          key={`wave-${i}`}
          className="absolute rounded-full border pointer-events-none"
          style={{ borderColor: '#f59e0b' }}
          initial={{ width: 40, height: 40, opacity: 0.3 }}
          animate={{ width: [40, 150], height: [40, 150], opacity: [0.3, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut' }}
        />
      ))}

      {/* Concentric disks at different Z layers */}
      <div
        style={{
          transform: `rotateX(${effTilt.x}deg) rotateY(${effTilt.y}deg)`,
          transition: isTouch ? 'none' : 'transform 0.2s ease-out',
          transformStyle: 'preserve-3d',
        }}
        className="relative w-full h-full flex items-center justify-center"
      >
        {disks.map((d, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              borderColor: '#f59e0b',
              width: d.size,
              height: d.size,
              opacity: d.opacity,
              transform: `translateZ(${d.z}px)`,
              boxShadow: i === 3 ? '0 4px 20px rgba(245,158,11,0.3)' : 'none',
            }}
            animate={reduce ? {} : { scale: [1, 1.04, 1] }}
            transition={{ duration: d.duration, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
          />
        ))}

        {/* Center plate */}
        <div
          className="absolute rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
          style={{ width: 28, height: 28, transform: 'translateZ(48px)' }}
        >
          <Target className="h-4 w-4 text-white" />
        </div>

        {/* Arrow that flies in on load and on button hover */}
        <motion.div
          className="absolute"
          style={{ transform: 'translateZ(55px)' }}
          initial={reduce ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -60, scale: 1.5 }}
          animate={arrowIn ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -60, scale: 1.5 }}
          transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
        >
          <div className="w-7 h-7 rounded-full bg-white shadow-lg flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── CtaBanner: raised 3D plate, sheen, target + magnetic button ── */
function CtaBanner({ reduce, isTouch, onCta }: { reduce: boolean; isTouch: boolean; onCta: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pressed, setPressed] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!btnRef.current || reduce || isTouch) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setOffset({ x: x * 0.1, y: y * 0.1 });
  };

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
    >
      <div
        className="relative rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 overflow-hidden"
        style={{
          boxShadow: '0 8px 32px rgba(245,158,11,0.15), 0 2px 8px rgba(245,158,11,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {/* Diagonal sheen every ~6s */}
        {!reduce && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.4) 50%, transparent 65%)' }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 4.2, ease: 'easeInOut' }}
          />
        )}

        {/* Inner light edge */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }} />

        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 relative z-10">
          {/* Left: target + text */}
          <div className="flex items-center gap-5">
            <ConcentricTarget reduce={reduce} isTouch={isTouch} active={btnHovered} />
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900">Bilim darajangizni aniqlang</h2>
              <p className="text-sm text-slate-600 font-medium mt-0.5">Ro'yxatdan o'tib, shaxsiy o'quv rejangizni yarating</p>
            </div>
          </div>

          {/* Right: magnetic button */}
          <button
            ref={btnRef}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => { setOffset({ x: 0, y: 0 }); setPressed(false); setBtnHovered(false); }}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onClick={onCta}
            className="group flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 transition-colors w-full md:w-auto justify-center"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${pressed ? 0.98 : 1})`,
              boxShadow: pressed ? '0 2px 8px rgba(245,158,11,0.3)' : '0 6px 20px rgba(245,158,11,0.35)',
              transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
            }}
          >
            Bepul boshlash
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function SaytHaqida({ onNavigate }: SaytHaqidaProps) {
  const { t } = useLang();
  const { user, isAuthenticated } = useAuth();
  const [activeBottomTab, setActiveBottomTab] = useState('haqida');
  const [activeLegal, setActiveLegal] = useState<'none' | 'maxfiylik' | 'shartlar'>('none');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const isTouch = useIsTouch();

  const { scrollYProgress } = useScroll();

  const handleNav = (tab: string) => {
    setActiveBottomTab(tab);
    onNavigate(tab);
  };

  const stats: StatItem[] = [
    { icon: Users, value: 1200, suffix: '+', label: 'Faol foydalanuvchilar', color: 'from-blue-500 to-cyan-500', accent: '#3b82f6', microType: 'users' },
    { icon: FileText, value: 4500, suffix: '+', label: 'Testlar va savollar', color: 'from-cyan-500 to-teal-500', accent: '#06b6d4', microType: 'tests' },
    { icon: BrainCircuit, value: 850, suffix: '+', label: 'AI baholangan kazuslar', color: 'from-sky-500 to-blue-500', accent: '#0ea5e9', microType: 'kazuslar' },
    { icon: BookOpen, value: 98, suffix: '%', label: 'Mamnunlik darajasi', color: 'from-emerald-500 to-teal-500', accent: '#10b981', microType: 'satisfaction' }
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
        className="relative isolate overflow-hidden rounded-3xl mb-10 px-6 py-10 md:px-14 md:py-14 lg:py-16 bg-gradient-to-br from-[#040814] via-[#0a1a4d] to-[#050b1f]"
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

        {/* Content */}
        <div className="relative z-10 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
          {/* Left column */}
          <div>
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="inline-flex mb-6"
            >
              <div className="p-px rounded-full" style={{ background: 'linear-gradient(90deg, rgba(56,189,248,0.5), rgba(167,139,250,0.4))' }}>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-md text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">
                  <Zap className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span>SIZ KUTGAN FORMATDAGI TA'LIM</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
              className="font-black tracking-tighter leading-[1.02] mb-4"
              style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)' }}
            >
              <span className="text-white">Fan</span>
              <span className="ff-title-gradient inline-block pr-[0.06em]">Faster</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
              className="mb-5"
            >
              <span
                className="inline-block rounded-xl px-[18px] py-[10px] font-extrabold text-white relative"
                style={{
                  fontSize: 'clamp(1.3rem, 2.4vw, 2.4rem)',
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <span
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{
                    background: 'linear-gradient(180deg, #38bdf8, #8b5cf6)',
                    boxShadow: '0 0 12px rgba(56,189,248,0.5)',
                  }}
                />
                Orzuyingizdagi &apos;men&apos; bugun nimani bilishi kerak?
              </span>
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
              className="text-base md:text-lg text-slate-300 leading-relaxed max-w-xl mb-8"
            >
              <span className="text-sky-300 font-bold">AI+Human metodi</span> yordamida bilimni yodlamang
              — uni chuqur tushunib, amalda qo&apos;llang.{' '}
              <span className="text-white font-bold">FanFaster</span> — ertangi yuristni bugun tayyorlaydi.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, delay: 0.4, ease: 'easeOut' }}
              className="flex flex-wrap gap-4"
            >
              <button
                onClick={() => handleNav('kurslar')}
                className="ff-shimmer group relative flex items-center gap-2 px-7 py-3.5 font-black text-sm rounded-2xl text-white overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-600 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300"
                style={{ boxShadow: '0 8px 30px rgba(99,102,241,0.45)' }}
              >
                <Play className="h-4 w-4 fill-white relative z-10" />
                <span className="relative z-10">O'qishni boshlash</span>
              </button>

              <button
                onClick={() => handleNav('oqmatlar')}
                className="flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/25 text-white font-bold text-sm rounded-2xl hover:bg-white/20 hover:border-sky-400/50 active:scale-[0.98] transition-all backdrop-blur-md"
              >
                <BookOpen className="h-4 w-4" />
                Materiallar
              </button>
            </motion.div>
          </div>

          {/* Right column — floating glass cards (lg+ only) */}
          <div className="hidden lg:flex relative items-center justify-center min-h-[360px]">
            {/* Soft radial glow behind cards */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 55% 45%, rgba(56,189,248,0.12), rgba(139,92,246,0.08) 40%, transparent 65%)' }}
            />

            {/* Card 1: Moot Court */}
            <HeroGlassCard rotate={-4} delay={0.45} duration={5} className="absolute top-[8%] left-[2%] w-[230px] z-20">
              <div className="p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Scale className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">Moot Court</p>
                    <p className="text-[10px] text-slate-400">AI sudya bilan jonli bahs</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${65 + i * 7}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.6 + i * 0.1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </HeroGlassCard>

            {/* Card 2: Kazus tahlili */}
            <HeroGlassCard rotate={3} delay={0.6} duration={6} className="absolute top-[28%] right-[0%] w-[210px] z-30">
              <div className="p-5 flex items-center gap-4">
                <MootCourtScoreRing />
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BrainCircuit className="h-4 w-4 text-violet-400" />
                    <p className="text-xs font-black text-white">Kazus tahlili</p>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">AI xolis bahosi</p>
                </div>
              </div>
            </HeroGlassCard>

            {/* Card 3: XP chip */}
            <HeroGlassCard rotate={-2} delay={0.75} duration={7} className="absolute bottom-[6%] left-[18%] z-10">
              <div className="px-4 py-3 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                  <Trophy className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-white">+120 XP</p>
                  <p className="text-[9px] text-slate-400">Yangi daraja ochildi</p>
                </div>
              </div>
            </HeroGlassCard>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATISTICS — Animated counters with glass cards
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <StatsGrid stats={stats} reduce={reduce} isTouch={isTouch} />
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
          <CtaBanner reduce={reduce} isTouch={isTouch} onCta={() => window.dispatchEvent(new Event('open-login-modal'))} />
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
