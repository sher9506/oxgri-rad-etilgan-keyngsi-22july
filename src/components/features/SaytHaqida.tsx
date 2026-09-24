import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Award, Code2, Library, MessageSquare, BarChart3, ArrowRight,
  BrainCircuit, Zap, Globe, Home, BookOpen, Shield, User,
  Users, FileText,
  ChevronRight, Mail, Phone,
  GraduationCap, Play, TrendingUp, Target, Brain,
  HelpCircle, Lock, Info, ChevronDown } from
'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useLang } from '@/contexts/LangContext';
import { useAuth } from '@/contexts/AuthContext';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } }
};
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } }
};

function AnimatedCounter({ target, suffix = '' }: {target: number;suffix?: string;}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1800;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {setCount(target);clearInterval(timer);} else
      setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const featureColors = {
  blue: { iconBg: 'from-blue-500 to-blue-700', btn: 'from-blue-500 to-blue-700' },
  purple: { iconBg: 'from-violet-500 to-violet-700', btn: 'from-violet-500 to-violet-700' },
  orange: { iconBg: 'from-orange-400 to-orange-600', btn: 'from-orange-400 to-orange-600' },
  emerald: { iconBg: 'from-emerald-500 to-emerald-700', btn: 'from-emerald-500 to-emerald-700' }
};

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
{ q: "Qaysi qurilmalardan foydalanish mumkin?", a: "Internetga ulangan har qanday kompyuter, noutbuk, planshet yoki smartfondan foydalanish mumkin. Chrome, Firefox, Safari yoki Edge brauzerlaridan foydalanish tavsiya etiladi." }];


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

function FormatMatn({ text }: {text: string;}) {
  return (
    <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-bold text-gray-800 mt-3">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.startsWith('•')) {
          return <p key={i} className="pl-3 text-gray-600">{line}</p>;
        }
        return <p key={i}>{line}</p>;
      })}
    </div>);

}

export default function SaytHaqida({ onNavigate }: SaytHaqidaProps) {
  const { t } = useLang();
  const { user, isAuthenticated } = useAuth();
  const [activeBottomTab, setActiveBottomTab] = useState('haqida');
  const [activeLegal, setActiveLegal] = useState<'none' | 'maxfiylik' | 'shartlar'>('none');

  const handleNav = (tab: string) => {
    setActiveBottomTab(tab);
    onNavigate(tab);
  };

  const stats = [
  { icon: Users, value: 1200, suffix: '+', label: 'Faol foydalanuvchilar' },
  { icon: FileText, value: 4500, suffix: '+', label: 'Testlar va savollar' },
  { icon: BrainCircuit, value: 850, suffix: '+', label: 'AI baholangan kazuslar' },
  { icon: BookOpen, value: 98, suffix: '%', label: 'Mamnunlik darajasi' }];


  const steps = [
  { step: '01', icon: User, title: "Ro'yxatdan o'ting", desc: "Telegram bot orqali bir daqiqada hisob yarating.", color: 'bg-blue-600' },
  { step: '02', icon: BookOpen, title: 'Kursni tanlang', desc: "Modulli kurslar va o'quv materiallaridan kerakligini toping.", color: 'bg-violet-600' },
  { step: '03', icon: Brain, title: "O'rganing va yozing", desc: "Sun'iy intellekt javoblaringizni tahlil qilib to'liq baho beradi.", color: 'bg-orange-500' },
  { step: '04', icon: TrendingUp, title: "Natijani ko'ring", desc: "Statistika va zaif tomonlaringizni mustahkamlang.", color: 'bg-emerald-600' }];


  const features = [
  { icon: BookOpen, color: 'blue' as const, badge: 'Modulli ta\'lim', title: 'Kurslar', desc: "Coursera uslubida Kurs → Modul → Dars tuzilmasi. Video, PDF, Audio va test bilan to'liq o'quv jarayoni.", btn: "Kurslarga o'tish", tab: 'kurslar' },
  { icon: Library, color: 'purple' as const, badge: "O'quv markazi", title: "O'quv materiallari", desc: "Sara va miyaga tez muhrlanadigan kontent. Murakkab mavzular oddiy tilda tushuntirilgan.", btn: "Materiallarni ko'rish", tab: 'oqmatlar' },
  { icon: BarChart3, color: 'orange' as const, badge: 'Bilim sinovi', title: 'Mavjud testlar', desc: "Xolis va qat'iy filtrlardan o'tgan testlar. O'z kuchingizni amalda tasdiqlang.", btn: 'Testlarni boshlash', tab: 'mavjud_testlar' },
  { icon: BrainCircuit, color: 'emerald' as const, badge: 'AI tahlil', title: 'Mavjud kazuslar', desc: "Haqiqiy muammolar, murakkab ssenariylar va ularga AI ning xolis bahosi.", btn: 'Kazus yechishni boshlash', tab: 'mavjud_kazuslar' }];


  return (
    <div className="w-full mx-auto font-sans text-slate-900 selection:bg-blue-100">

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white mb-10 px-6 py-14 md:px-16 md:py-20">
        <div aria-hidden="true">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-violet-500/10 blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold uppercase tracking-widest text-cyan-300 mb-6 backdrop-blur-sm">
            <Zap className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>SIZ KUTGAN FORMATDAGI TA'LIM</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.05] mb-5">
            <span className="text-white">Fan</span>
            <span className="faster-gradient-text">Faster</span>
            <style>{`
              @keyframes faster-flow {
                0%   { background-position: 0% 50%; }
                100% { background-position: 300% 50%; }
              }
              .faster-gradient-text {
                font-size: inherit;
                font-weight: inherit;
                letter-spacing: inherit;
                line-height: inherit;
                display: inline-block;
                padding-right: 0.06em;
                background: linear-gradient(
                  90deg,
                  #ffffff 0%,
                  #22D3EE 25%,
                  #7C3AED 55%,
                  #22D3EE 75%,
                  #ffffff 100%
                );
                background-size: 300% 100%;
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                color: transparent;
                animation: faster-flow 6s linear infinite;
              }
              @media (prefers-reduced-motion: reduce) {
                .faster-gradient-text {
                  animation: none;
                  background: none;
                  -webkit-background-clip: unset;
                  background-clip: unset;
                  -webkit-text-fill-color: #22D3EE;
                  color: #22D3EE;
                  padding-right: 0;
                }
              }
            `}</style>
            <div className="relative mt-5 pl-6" style={{ display: 'inline-block', maxWidth: '100%' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: '#FFE600', borderRadius: '4px' }} />
              <span style={{
                display: 'block',
                fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(1.6rem, 3.5vw, 4rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: '#ffffff',
                background: 'rgba(255, 230, 0, 0.12)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: '10px',
                padding: '10px 18px'
              }}>
                Orzuyingizdagi &apos;men&apos; bugun nimani bilishi kerak?
              </span>
            </div>
          </motion.h1>
          {/* Tavsif */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="text-base md:text-lg text-slate-300 leading-relaxed max-w-xl mb-7"
          >
            <span className="text-cyan-300 font-bold">AI+Human metodi</span> yordamida bilimni yodlamang
            — uni chuqur tushunib, amalda qo&apos;llang.{' '}
            <span className="text-white font-bold">FanFaster</span> — ertangi yuristni bugun tayyorlaydi.
          </motion.p>
          





























































          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-wrap gap-3">
            <button onClick={() => handleNav('kurslar')}
            className="flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-black text-sm rounded-2xl shadow-[0_8px_30px_rgba(59,130,246,0.5)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.6)] hover:-translate-y-1 active:scale-[0.98] transition-all border border-white/20"
            style={{ boxShadow: '0 0 20px rgba(99,102,241,0.4), 0 8px 30px rgba(59,130,246,0.35)' }}>
              <Play className="h-4 w-4 fill-white" />O'qishni boshlash
            </button>
            <button onClick={() => handleNav('oqmatlar')}
            className="flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/25 text-white font-bold text-sm rounded-2xl hover:bg-white/20 hover:border-yellow-400/40 active:scale-[0.98] transition-all backdrop-blur-sm"
            style={{ transition: 'all 0.25s ease' }}>
              Materiallar
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══ STATISTIKA ══ */}
      <section className="mb-10">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) =>
          <motion.div key={i} variants={fadeUp}>
              <Card className="border border-white/60 bg-white/80 backdrop-blur-md shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-xs text-slate-500 font-semibold leading-tight">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ══ FOYDALANUVCHI HOLAT ══ */}
      {isAuthenticated && user ?
      <section className="mb-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <Card className="border border-blue-100 bg-gradient-to-r from-blue-50 to-violet-50 rounded-3xl shadow-sm overflow-hidden">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-md">
                      <span className="text-white font-black text-lg uppercase">{user.ism?.[0]}{user.familiya?.[0]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-0.5">Xush kelibsiz!</p>
                      <h2 className="text-xl font-black text-slate-900">{user.ism} {user.familiya}</h2>
                      <p className="text-sm text-slate-500 font-medium capitalize">{user.rol === 'ustoz' ? 'Ustoz' : "O'quvchi"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleNav('kurslar')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
                      <BookOpen className="h-3.5 w-3.5" />Kurslarga o'tish
                    </button>
                    <button onClick={() => handleNav('profil')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98]">
                      <User className="h-3.5 w-3.5" />Profil
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section> :

      <section className="mb-10">
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <Card className="border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl shadow-sm overflow-hidden">
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Bilim darajangizni aniqlang</h2>
                    <p className="text-sm text-slate-500 font-medium">Ro'yxatdan o'tib, shaxsiy o'quv rejangizni yarating</p>
                  </div>
                </div>
                <button onClick={() => window.dispatchEvent(new Event('open-login-modal'))}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-[0.98] whitespace-nowrap">
                  Bepul boshlash<ArrowRight className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      }

      {/* ══ QANDAY ISHLAYDI ══ */}
      <section className="mb-10">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-6">
          <motion.div variants={fadeUp} className="text-center space-y-1.5">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.35em]">Jarayon</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Qanday ishlaydi?</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {steps.map((s, i) =>
            <motion.div key={i} variants={fadeUp}>
                <Card className="border border-white/60 bg-white/80 backdrop-blur-md shadow-sm rounded-2xl h-full hover:shadow-md transition-shadow">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-300 tabular-nums">{s.step}</span>
                      <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center shadow-sm`}>
                        <s.icon className="h-[18px] w-[18px] text-white" />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm mb-1">{s.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ══ FEATURE KARTALAR ══ */}
      <section className="mb-10">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-6">
          <motion.div variants={fadeUp} className="text-center space-y-1.5">
            <p className="text-xs font-black text-violet-600 uppercase tracking-[0.35em]">Imkoniyatlar</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">Nima o'rganishingiz mumkin?</h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f, i) => {
              const colors = featureColors[f.color];
              return (
                <motion.div key={i} variants={fadeUp}>
                  <Card className="border border-white/60 bg-white/80 backdrop-blur-md shadow-sm rounded-3xl overflow-hidden h-full hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    <CardContent className="p-6 md:p-8 flex flex-col gap-5 h-full">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors.iconBg} flex items-center justify-center shadow-md shrink-0`}>
                          <f.icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="inline-block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{f.badge}</span>
                          <h3 className="text-lg font-black text-slate-900 leading-tight">{f.title}</h3>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed flex-1">{f.desc}</p>
                      <button onClick={() => handleNav(f.tab)}
                      className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r ${colors.btn} text-white font-black text-xs rounded-2xl shadow-md hover:opacity-90 active:scale-[0.98] transition-all`}>
                        {f.btn}<ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>);

            })}
          </div>
        </motion.div>
      </section>

      {/* ══ MUALLIFLAR ══ */}
      <section className="mb-10">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-5">
          <motion.div variants={fadeUp} className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.4em]">Jamoa</h2>
            <div className="h-px flex-1 bg-slate-200" />
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
            { icon: Award, color: 'from-blue-500 to-blue-700', role: t('about.author1_role'), name: t('about.author1_name'), desc: t('about.author1_desc') },
            { icon: Code2, color: 'from-slate-700 to-slate-900', role: t('about.author2_role'), name: t('about.author2_name'), desc: t('about.author2_desc') }].
            map((a, i) =>
            <motion.div key={i} variants={fadeUp}>
                <Card className="border border-white/60 bg-white/80 backdrop-blur-md shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-5">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-md shrink-0`}>
                        <a.icon className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{a.role}</p>
                        <h3 className="text-lg font-black text-slate-900">{a.name}</h3>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{a.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ══ CTA BANNER ══ */}
      <section className="mb-10">
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <Card className="border-none bg-slate-950 text-white overflow-hidden rounded-3xl relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_50%)]" />
            <CardContent className="p-8 md:p-14 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4 md:max-w-xl">
                <div className="flex items-center gap-3 text-blue-400 text-[10px] font-black uppercase tracking-[0.5em]">
                  <div className="w-8 h-px bg-blue-400" />Platforma
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
                  <button onClick={() => handleNav('kurslar')}
                  className="flex items-center gap-2 px-7 py-3.5 bg-white text-slate-950 hover:bg-blue-500 hover:text-white font-black text-sm rounded-xl transition-all group active:scale-[0.98]">
                    Boshlash<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <button onClick={() => handleNav('mavjud_testlar')}
                  className="flex items-center gap-2 px-7 py-3.5 bg-white/10 border border-white/20 text-white font-bold text-sm rounded-xl hover:bg-white/20 active:scale-[0.98] transition-all backdrop-blur-sm">
                    Testlarni ko'rish
                  </button>
                </div>
              </div>
              <div className="relative flex-shrink-0 flex items-center justify-center w-48 h-48 md:w-60 md:h-60">
                <div className="absolute inset-0 rounded-full border border-blue-400/20" />
                <div className="absolute inset-6 rounded-full border border-cyan-300/30" />
                <Globe className="relative z-10 h-28 w-28 md:h-36 md:w-36 text-blue-400/70" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="mb-10" id="faq">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-5">
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl">
              <HelpCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Ko'p so'raladigan savollar</h2>
              <p className="text-xs text-slate-500">Eng ko'p beriladigan savollarga javoblar</p>
            </div>
          </motion.div>
          <motion.div variants={fadeUp} className="space-y-2">
            {FAQ_ITEMS.map((item, i) =>
            <details key={i} className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-200 transition-colors">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-bold text-gray-800 pr-4">{item.q}</span>
                  <ChevronDown className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0" />
                </summary>
                <div className="px-5 pb-4 pt-1 border-t border-gray-100">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
                </div>
              </details>
            )}
          </motion.div>
          <motion.div variants={fadeUp} className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
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

      {/* ══ MAXFIYLIK + SHARTLAR ══ */}
      <section className="mb-10">
        <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button onClick={() => setActiveLegal(activeLegal === 'maxfiylik' ? 'none' : 'maxfiylik')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-xl"><Lock className="h-5 w-5 text-slate-600" /></div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">Maxfiylik siyosati</p>
                    <p className="text-xs text-gray-500">Ma'lumotlaringiz qanday saqlanadi</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${activeLegal === 'maxfiylik' ? 'rotate-180' : ''}`} />
              </button>
              {activeLegal === 'maxfiylik' &&
              <div className="px-5 pb-5 pt-2 border-t border-gray-100"><FormatMatn text={MAXFIYLIK_MATN} /></div>
              }
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <button onClick={() => setActiveLegal(activeLegal === 'shartlar' ? 'none' : 'shartlar')}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-xl"><FileText className="h-5 w-5 text-blue-600" /></div>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">Foydalanish shartlari</p>
                    <p className="text-xs text-gray-500">Platformadan foydalanish qoidalari</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${activeLegal === 'shartlar' ? 'rotate-180' : ''}`} />
              </button>
              {activeLegal === 'shartlar' &&
              <div className="px-5 pb-5 pt-2 border-t border-gray-100"><FormatMatn text={SHARTLAR_MATN} /></div>
              }
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="rounded-3xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-28 md:mb-8 overflow-hidden">
        <div className="p-8 md:p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
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
                { label: 'Savol-Javoblar', tab: 'savol_javob' }].
                map((l) =>
                <li key={l.tab}>
                    <button onClick={() => handleNav(l.tab)} className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium text-left">{l.label}</button>
                  </li>
                )}
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
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">v1.0</span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-600">Tizim ishlayapti</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ══ MOBIL NAVIGATSIYA ══ */}
      <nav className="md:hidden fixed inset-x-4 z-50 rounded-[28px] border border-white/50 bg-white/50 px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-around gap-1">
          {[
          { tab: 'haqida', icon: Info, label: 'Asosiy' },
          { tab: 'kurslar', icon: BookOpen, label: 'Kurslar' },
          { tab: 'oqmatlar', icon: Library, label: 'Materiallar' },
          { tab: 'yordam', icon: HelpCircle, label: 'Yordam' },
          { tab: 'profil', icon: User, label: 'Profil' }].
          map((item) => {
            const active = activeBottomTab === item.tab;
            return (
              <button key={item.tab} onClick={() => handleNav(item.tab)}
              className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center rounded-xl px-2 transition-all ${active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] font-bold">{item.label}</span>
              </button>);

          })}
        </div>
      </nav>
    </div>);

}