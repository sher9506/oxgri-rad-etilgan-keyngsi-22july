import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useInView, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Award, Code2, Library, MessageSquare, BarChart3, ArrowRight,
  BrainCircuit, Zap, BookOpen, Shield, User,
  Users, FileText, Sparkles, Trophy, Rocket,
  ChevronRight, Mail, Phone,
  GraduationCap, Play, TrendingUp, Target, Brain,
  HelpCircle, Lock, Info, ChevronDown,
  CheckCircle2, Quote, Star, Compass, Eye, Lightbulb, Heart
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

/* ═══ Floating Particles Background ═══ */
function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 8 + 6,
    delay: Math.random() * 5,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-white/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ═══ Animated Gradient Mesh Background ═══ */
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)' }}
        animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)' }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/3 left-1/2 w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)' }}
        animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
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
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SaytHaqida({ onNavigate }: SaytHaqidaProps) {
  const { t } = useLang();
  const { user, isAuthenticated } = useAuth();
  const [activeBottomTab, setActiveBottomTab] = useState('haqida');
  const [activeLegal, setActiveLegal] = useState<'none' | 'maxfiylik' | 'shartlar'>('none');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });

  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.3]);

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

  const steps = [
    { step: '01', icon: User, title: "Ro'yxatdan o'ting", desc: "Telegram bot orqali bir daqiqada hisob yarating.", color: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-500/30' },
    { step: '02', icon: BookOpen, title: 'Kursni tanlang', desc: "Modulli kurslar va o'quv materiallaridan kerakligini toping.", color: 'from-cyan-500 to-teal-500', glow: 'shadow-cyan-500/30' },
    { step: '03', icon: Brain, title: "O'rganing va yozing", desc: "Sun'iy intellekt javoblaringizni tahlil qilib to'liq baho beradi.", color: 'from-sky-500 to-blue-500', glow: 'shadow-sky-500/30' },
    { step: '04', icon: TrendingUp, title: "Natijani ko'ring", desc: "Statistika va zaif tomonlaringizni mustahkamlang.", color: 'from-emerald-500 to-teal-500', glow: 'shadow-emerald-500/30' }
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
          HERO SECTION — Premium animated hero
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative overflow-hidden rounded-[2rem] mb-10 px-6 py-16 md:px-16 md:py-24"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0c4a6e 70%, #082f49 100%)',
        }}
      >
        <GradientMesh />
        <FloatingParticles />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
          aria-hidden="true"
        />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative z-10 max-w-3xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300 mb-7 backdrop-blur-md"
          >
            <motion.span
              animate={{ rotate: [0, 14, -8, 14, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
            >
              <Zap className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            </motion.span>
            <span>SIZ KUTGAN FORMATDAGI TA'LIM</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.05] mb-5"
          >
            <span className="text-white">Fan</span>
            <span className="ff-gradient-text">Faster</span>
            <style>{`
              @keyframes ff-flow {
                0%   { background-position: 0% 50%; }
                100% { background-position: 300% 50%; }
              }
              .ff-gradient-text {
                font-size: inherit;
                font-weight: inherit;
                letter-spacing: inherit;
                line-height: inherit;
                display: inline-block;
                background: linear-gradient(90deg, #ffffff 0%, #22D3EE 25%, #38BDF8 50%, #22D3EE 75%, #ffffff 100%);
                background-size: 300% 100%;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                color: transparent;
                animation: ff-flow 5s linear infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .ff-gradient-text { animation: none; -webkit-text-fill-color: #22D3EE; color: #22D3EE; }
              }
            `}</style>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative mt-5 inline-block"
            >
              <span
                className="block font-black leading-[1.1] tracking-tight"
                style={{
                  fontSize: 'clamp(1.4rem, 3.2vw, 3.5rem)',
                  color: '#ffffff',
                }}
              >
                Orzuyingizdagi &apos;men&apos; bugun nimani bilishi kerak?
              </span>
              <motion.div
                className="absolute -left-3 top-0 bottom-0 w-1.5 rounded-full"
                style={{ background: 'linear-gradient(180deg, #38BDF8, #0EA5E9)' }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              />
            </motion.div>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-base md:text-lg text-slate-300 leading-relaxed max-w-xl mb-8"
          >
            <span className="text-cyan-300 font-bold">AI+Human metodi</span> yordamida bilimni yodlamang
            — uni chuqur tushunib, amalda qo&apos;llang.{' '}
            <span className="text-white font-bold">FanFaster</span> — ertangi yuristni bugun tayyorlaydi.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-wrap gap-4"
          >
            <MagneticButton
              onClick={() => handleNav('kurslar')}
              className="group relative flex items-center gap-2 px-7 py-3.5 font-black text-sm rounded-2xl text-white overflow-hidden border border-white/20 active:scale-[0.98]"
              primary
            >
              <span className="absolute inset-0 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 bg-[length:200%_100%] group-hover:bg-[position:100%_0] transition-all duration-500" />
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: '0 0 30px rgba(56,189,248,0.6)' }} />
              <Play className="h-4 w-4 fill-white relative z-10" />
              <span className="relative z-10">O'qishni boshlash</span>
            </MagneticButton>

            <MagneticButton
              onClick={() => handleNav('oqmatlar')}
              className="flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/25 text-white font-bold text-sm rounded-2xl hover:bg-white/20 hover:border-cyan-400/50 active:scale-[0.98] transition-all backdrop-blur-md"
            >
              <BookOpen className="h-4 w-4" />
              Materiallar
            </MagneticButton>
          </motion.div>

          {/* Hero stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 pt-6 border-t border-white/10"
          >
            {[
              { icon: Sparkles, label: 'AI + Human', val: 'metodi' },
              { icon: Trophy, label: '98%', val: 'mamnunlik' },
              { icon: Rocket, label: '4500+', val: 'testlar' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-cyan-400" />
                <span className="text-xs font-black text-white">{item.label}</span>
                <span className="text-xs text-slate-400">— {item.val}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1.5"
        >
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Pastga</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-5 h-8 rounded-full border-2 border-white/20 flex items-start justify-center pt-1.5"
          >
            <div className="w-1 h-2 rounded-full bg-cyan-400" />
          </motion.div>
        </motion.div>
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
          HOW IT WORKS — Steps with connecting line
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="space-y-8">
          <motion.div variants={fadeUp} className="text-center space-y-2">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.35em]">Jarayon</p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900">Qanday ishlaydi?</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">To'rt qadamda bilim olishga to'liq yo'l</p>
          </motion.div>

          <div className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[40px] left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-blue-200 via-cyan-200 to-emerald-200" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {steps.map((s, i) => (
                <motion.div key={i} variants={fadeUp} className="relative">
                  <TiltCard intensity={5} className="h-full">
                    <Card className="group border border-white/60 bg-white/80 backdrop-blur-xl shadow-sm rounded-2xl h-full hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.color}`} />
                      <CardContent className="p-5 flex flex-col gap-3 pt-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-black text-slate-300 tabular-nums">{s.step}</span>
                          <motion.div
                            whileHover={{ scale: 1.15, rotate: 5 }}
                            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg ${s.glow}`}
                          >
                            <s.icon className="h-5 w-5 text-white" />
                          </motion.div>
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900 text-sm mb-1">{s.title}</h3>
                          <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </TiltCard>
                  {/* Step number badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 200, delay: 0.3 + i * 0.1 }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center shadow-md z-10"
                  >
                    <span className="text-[9px] font-black text-blue-600">{i + 1}</span>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

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
