import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Scale, Play, FileText, GraduationCap, Library, Newspaper,
  Layers, ArrowRight, BookOpen, Rocket,
  CheckCircle2, Brain, ChevronDown, Trophy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SaytHaqidaProps {
  onNavigate: (tab: string) => void;
}

const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

const SERIF = "'Source Serif 4 Variable', 'Source Serif 4', 'Iowan Old Style', Georgia, serif";
const SANS = "'Inter Variable', Inter, system-ui, sans-serif";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ═══ Spotlight card — cursor-following glow ═══ */
function SpotlightCard({ children, className = '', onClick, style }: { children: React.ReactNode; className?: string; onClick?: () => void; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current || reduceMotion) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    ref.current.style.setProperty('--sx', `${x}%`);
    ref.current.style.setProperty('--sy', `${y}%`);
  }, []);
  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onClick={onClick}
      className={`ff-spotlight relative overflow-hidden ${className}`}
      style={{ ['--sx' as any]: '50%', ['--sy' as any]: '50%', ...style }}
    >
      {children}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Hero color tokens
   ═════════════════════════════════════════════════════════════════ */
const C = {
  bg: '#F3F8FF',
  bg2: '#E8F1FE',
  ink: '#0B1530',
  secondary: '#44526E',
  muted: '#5B6A87',
  cobalt1: '#2F68E8',
  cobalt2: '#1D4ED8',
  cobaltLight: '#3B8BFF',
  cobaltTint: '#EAF2FF',
  cobaltLine: '#CFE0FB',
  gold: '#C99A3B',
  goldTint: '#FBF1D9',
  goldInk: '#8A5F0A',
  success: '#0F6E4F',
  successTint: '#E3F6EE',
  line: '#D3E2F8',
  card: '#FFFFFF',
  ffCard: '#FFFFFF',
  goldDeep: '#B8862E',
  successOnNavy: '#9BE7C4',
  panel1: '#FBFDFF',
  panel2: '#E6F0FD',
  // Moot Court card
  navy1: '#0D1B42',
  navy2: '#17306E',
  navy3: '#1E3F8F',
  onNavy: '#EAF1FF',
  onNavyMuted: 'rgba(234,241,255,.72)',
  skyOnNavy: '#8DB7FF',
  rimLight: 'rgba(141,183,255,.28)',
  shadow: 'rgba(13,27,66,.55)',
  cardShadow: 'rgba(13,27,66,.28)',
};

const STORY_Q = "Da'vogar, dalilingizni qaysi norma bilan asoslaysiz?";
const STORY_A = "Fuqarolik kodeksining mulk huquqi bo'yicha normalari bilan\u2026";
const CRITERIA = ['Mantiq', 'Dalil', 'Tahlil', 'Xulosa', 'Uslub'];

/* ═════════════════════════════════════════════════════════════════
   useTiltParallax — lerp-based 3D tilt + idle float + aurora drift
   ═════════════════════════════════════════════════════════════════ */
function useTiltParallax(
  stageRef: React.RefObject<HTMLDivElement>,
  cardRef: React.RefObject<HTMLDivElement>,
  shadowRef: React.RefObject<HTMLDivElement>,
  frontRef: React.RefObject<HTMLDivElement>,
  auroraRef: React.RefObject<HTMLDivElement>,
) {
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const mouseActive = useRef(false);
  const glarePos = useRef({ x: 50, y: 50 });

  useEffect(() => {
    if (reduceMotion || isTouch) return;
    let raf = 0;
    const baseRX = 4, baseRY = -9;

    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.08;
      current.current.y += (target.current.y - current.current.y) * 0.08;

      const t = performance.now() / 1000;
      const idleX = Math.sin(t * 0.65) * 5;
      const idleY = Math.cos(t * 0.5 + 1.2) * 5;
      const floatX = mouseActive.current ? 0 : idleX;
      const floatY = mouseActive.current ? 0 : idleY;

      if (cardRef.current) {
        const rx = baseRX + current.current.y * -0.6 + floatY * 0.3;
        const ry = baseRY + current.current.x * 0.6 + floatX * 0.3;
        cardRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      }
      if (shadowRef.current) {
        shadowRef.current.style.transform = `translateX(${(baseRY + current.current.x * 0.6) * 1.5}px) scaleX(0.85)`;
      }
      if (frontRef.current) {
        const fx = current.current.x * -1.4 + Math.sin(t * 0.9 + 2.4) * (mouseActive.current ? 0 : 4);
        const fy = current.current.y * -1.4 + Math.cos(t * 0.7 + 1.6) * (mouseActive.current ? 0 : 4);
        frontRef.current.style.transform = `translate3d(${fx}px, ${fy}px, 70px)`;
      }
      if (auroraRef.current) {
        const ax = current.current.x * 0.3 + Math.sin(t * 0.08) * 30;
        const ay = current.current.y * 0.3 + Math.cos(t * 0.06) * 20;
        auroraRef.current.style.transform = `translate3d(${ax}px, ${ay}px, 0)`;
      }

      const stage = stageRef.current;
      if (stage && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        const gx = ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 100;
        const gy = ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 100;
        glarePos.current.x += (gx - glarePos.current.x) * 0.1;
        glarePos.current.y += (gy - glarePos.current.y) * 0.1;
        cardRef.current.style.setProperty('--glare-x', `${glarePos.current.x}%`);
        cardRef.current.style.setProperty('--glare-y', `${glarePos.current.y}%`);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stageRef, cardRef, shadowRef, frontRef, auroraRef]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!stageRef.current || reduceMotion || isTouch) return;
    mouseActive.current = true;
    const rect = stageRef.current.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    target.current = { x: Math.max(-8, Math.min(8, dx * 8)), y: Math.max(-8, Math.min(8, dy * 8)) };
  }, [stageRef]);

  const onMouseLeave = useCallback(() => {
    mouseActive.current = false;
    target.current = { x: 0, y: 0 };
  }, []);

  return { onMouseMove, onMouseLeave };
}

/* ═════════════════════════════════════════════════════════════════
   useStoryLoop — 9s cycle: question → answer → evaluating → result → fade
   ═════════════════════════════════════════════════════════════════ */
function useStoryLoop() {
  const [cycleKey, setCycleKey] = useState(0);
  const [phase, setPhase] = useState(reduceMotion ? 3 : 0);
  const [qText, setQText] = useState(reduceMotion ? STORY_Q : '');
  const [aText, setAText] = useState(reduceMotion ? STORY_A : '');
  const [score, setScore] = useState(reduceMotion ? 92 : 0);
  const [filledCr, setFilledCr] = useState(reduceMotion ? 5 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    setPhase(0); setQText(''); setAText(''); setScore(0); setFilledCr(0);
    const timers = [
      setTimeout(() => setPhase(1), 1600),
      setTimeout(() => setPhase(2), 4000),
      setTimeout(() => setPhase(3), 5000),
      setTimeout(() => setPhase(4), 8000),
      setTimeout(() => setCycleKey(k => k + 1), 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycleKey]);

  useEffect(() => {
    if (reduceMotion) return;
    setQText(''); setAText('');
    let qi = 0, ai = 0;
    const qTimer = setTimeout(() => {
      const qInt = setInterval(() => {
        qi++; setQText(STORY_Q.slice(0, qi));
        if (qi >= STORY_Q.length) clearInterval(qInt);
      }, 30);
    }, 300);
    const aTimer = setTimeout(() => {
      const aInt = setInterval(() => {
        ai++; setAText(STORY_A.slice(0, ai));
        if (ai >= STORY_A.length) clearInterval(aInt);
      }, 26);
    }, 1900);
    return () => { clearTimeout(qTimer); clearTimeout(aTimer); };
  }, [cycleKey]);

  useEffect(() => {
    if (phase < 3) { setScore(0); setFilledCr(0); return; }
    if (reduceMotion) { setScore(92); setFilledCr(5); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1500, 1);
      setScore(Math.round((1 - Math.pow(1 - p, 3)) * 92));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const crInt = setInterval(() => setFilledCr(c => c >= 5 ? (clearInterval(crInt), 5) : c + 1), 250);
    return () => clearInterval(crInt);
  }, [phase]);

  return { cycleKey, phase, qText, aText, score, filledCr };
}

/* ═════════════════════════════════════════════════════════════════
   HeroBackdrop — aurora blobs + grain + dot grid + cursor glow
   ═════════════════════════════════════════════════════════════════ */
function HeroBackdrop({ auroraRef, bgRef }: { auroraRef: React.RefObject<HTMLDivElement>; bgRef: React.RefObject<HTMLDivElement> }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(13,27,66,1) 35%, rgba(13,27,66,0) 100%)',
        maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(13,27,66,1) 35%, rgba(13,27,66,0) 100%)',
      }}
    >
      <div ref={auroraRef} className="absolute inset-0 pointer-events-none" style={{ willChange: 'transform' }}>
        <div className="absolute rounded-full" style={{ width: 500, height: 500, left: '5%', top: '10%', background: 'radial-gradient(circle, rgba(47,104,232,0.15), transparent 70%)', filter: 'blur(60px)', animation: reduceMotion ? 'none' : 'ff-aurora1 35s ease-in-out infinite' }} />
        <div className="absolute rounded-full" style={{ width: 420, height: 420, left: '40%', top: '5%', background: 'radial-gradient(circle, rgba(59,139,255,0.12), transparent 70%)', filter: 'blur(55px)', animation: reduceMotion ? 'none' : 'ff-aurora2 40s ease-in-out infinite' }} />
        <div className="absolute rounded-full" style={{ width: 380, height: 380, left: '60%', top: '30%', background: 'radial-gradient(circle, rgba(201,154,59,0.10), transparent 70%)', filter: 'blur(50px)', animation: reduceMotion ? 'none' : 'ff-aurora3 38s ease-in-out infinite' }} />
      </div>

      {/* Cursor-following soft white glow */}
      <div
        ref={bgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(400px circle at var(--bg-x, 50%) var(--bg-y, 50%), rgba(255,255,255,0.5), transparent 60%)', ['--bg-x' as any]: '50%', ['--bg-y' as any]: '30%' }}
      />

      {/* Static grid — fades toward edges */}
      <div className="absolute inset-0 pointer-events-none ff-grid-bg" />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   HeroCopy — label, title, description, buttons, trust badges
   ═════════════════════════════════════════════════════════════════ */
function HeroCopy({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const titleParts = ["Orzuyingizdagi ", "'men' ", "bugun "];

  return (
    <div className="relative ff-glass ff-hero-panel flex flex-col justify-center">
      {/* Eyebrow pill */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="ff-hero-eyebrow"
      >
        <span className="ff-eyebrow">
          <span className="ff-eyebrow-dot" style={{ animation: reduceMotion ? 'none' : 'ff-pulse 2s ease-in-out infinite' }} />
          SIZ KUTGAN FORMATDAGI TA'LIM
        </span>
      </motion.div>

      {/* Title — serif H1 */}
      <h1 className="ff-h1 ff-serif ff-hero-title" style={{ color: 'var(--ink)' }}>
        {titleParts.map((word, i) => (
          <span key={i}>
            <span className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: '0.08em' }}>
              <motion.span
                className="inline-block"
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
              >
                {word}
              </motion.span>
            </span>
            {' '}
          </span>
        ))}
        <span className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: '0.08em', whiteSpace: 'nowrap' }}>
          <motion.span
            className="inline-block ff-hero-italic"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          >
            nimani bilishi kerak?
          </motion.span>
        </span>
        {/* Gold underline SVG */}
        <svg className="block mt-1" width="280" height="10" viewBox="0 0 280 10" fill="none" style={{ overflow: 'visible' }}>
          <motion.path
            d="M2 6 Q 70 2, 140 5 T 278 4"
            stroke={C.gold}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </h1>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="ff-hero-lead ff-hero-description"
      >
        Qonunlarni shunchaki yodlamang — ularning <span style={{ color: 'var(--cobalt-2)', fontWeight: 600 }}>mantiqiy kuchini his qiling</span>. <span style={{ color: 'var(--ink)', fontWeight: 600 }}>FanFaster</span> bilan real keyslarni tahlil qiling va har qanday vaziyatda professional yechim topishni o'rganing.
      </motion.p>

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap gap-3 ff-hero-actions"
      >
        <button
          onClick={() => onNavigate('sinov')}
          className="ff-magnet-btn group flex items-center gap-2 px-6 h-11 font-semibold text-[15px] transition-all hover:-translate-y-0.5 active:scale-95 ff-focus"
          style={{
            background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))',
            color: '#fff',
            borderRadius: 16,
            boxShadow: '0 16px 32px -14px rgba(29,78,216,.55)',
          }}
        >
          <Play className="h-4 w-4 fill-white" />
          O&rsquo;qishni boshlash
        </button>
        <button
          onClick={() => onNavigate('oqmatlar')}
          className="flex items-center gap-2 px-5 h-11 font-semibold text-[15px] transition-all active:scale-95 ff-focus"
          style={{
            background: 'var(--ff-card)',
            border: '1px solid var(--cobalt-line)',
            color: 'var(--ink)',
            borderRadius: 16,
          }}
        >
          <BookOpen className="h-4 w-4" />
          Materiallarni ko&rsquo;rish
          <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--cobalt-2)' }} />
        </button>
      </motion.div>

      {/* Segmented chips row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.65 }}
        className="ff-seg"
      >
        {[
          { label: "24/7 AI simulyatsiya", tile: 'var(--cobalt-tint)', color: 'var(--cobalt-2)' },
          { label: "Tajribali ustozlar", tile: 'var(--gold-tint)', color: 'var(--gold-ink)' },
          { label: "Hoziroq sinab ko'ring", tile: 'var(--success-tint)', color: 'var(--success)' },
        ].map((badge) => (
          <div key={badge.label} className="ff-seg-cell">
            <div className="ff-seg-icon-tile" style={{ background: badge.tile }}>
              <Rocket className="h-[15px] w-[15px]" style={{ color: badge.color }} />
            </div>
            <span>{badge.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   StoryDialog — chat bubbles + evaluating indicator
   ═════════════════════════════════════════════════════════════════ */
function StoryDialog({ phase, cycleKey, qText, aText }: {
  phase: number; cycleKey: number; qText: string; aText: string;
}) {
  const fading = phase === 4;
  const dialogVisible = phase <= 3;

  return (
    <div className="flex flex-col gap-2" style={{ height: 190 }}>
      <AnimatePresence>
        {dialogVisible && (
          <motion.div
            key={`q-${cycleKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: fading ? 0 : 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="self-start max-w-[90%]"
          >
            <div className="rounded-2xl rounded-tl-md px-3 py-2 leading-relaxed" style={{ background: 'rgba(234,241,255,.07)', border: '1px solid rgba(234,241,255,.14)' }}>
              <span className="text-[10px] font-bold block mb-0.5" style={{ color: C.skyOnNavy, fontFamily: SERIF }}>AI Sudya</span>
              <span className="text-[14.5px]" style={{ color: C.onNavy, fontFamily: SERIF }}>
                {qText}
                {!reduceMotion && qText.length < STORY_Q.length && qText.length > 0 && <span className="animate-pulse">|</span>}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase >= 1 && dialogVisible && (
          <motion.div
            key={`a-${cycleKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: fading ? 0 : 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="self-end max-w-[90%]"
          >
            <div className="rounded-2xl rounded-tr-md px-3 py-2 leading-relaxed" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
              <span className="text-[10px] font-bold block mb-0.5" style={{ color: 'rgba(234,241,255,.85)' }}>Siz</span>
              <span className="text-[14.5px] text-white" style={{ fontFamily: SANS }}>
                {aText}
                {!reduceMotion && phase === 1 && aText.length < STORY_A.length && aText.length > 0 && <span className="animate-pulse">|</span>}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="self-start">
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-2" style={{ background: 'rgba(234,241,255,.05)' }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: C.skyOnNavy, animation: `ff-typing 1.2s ${i * 0.15}s infinite ease-in-out` }} />
            ))}
            <span className="text-[11px] ml-1" style={{ color: C.onNavyMuted }}>AI baholamoqda</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ResultPanel — skeleton during evaluation, real result after
   ═════════════════════════════════════════════════════════════════ */
function ResultPanel({ phase, cycleKey, score, filledCr }: {
  phase: number; cycleKey: number; score: number; filledCr: number;
}) {
  const showResult = phase >= 3;
  const fading = phase === 4;
  const R = 20, CIRC = 2 * Math.PI * R;
  const offset = CIRC - (score / 100) * CIRC;
  const showSkeleton = phase === 2;
  const showReal = phase >= 3;

  return (
    <div style={{ height: 130 }} className="relative">
      {/* Skeleton during evaluation */}
      <AnimatePresence>
        {showSkeleton && (
          <motion.div key={`sk-${cycleKey}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full shrink-0 ff-skeleton" />
            <div className="flex flex-wrap gap-1.5 flex-1">
              {CRITERIA.map(c => (
                <div key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full ff-skeleton" style={{ width: 52, height: 18 }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real result */}
      <AnimatePresence>
        {showReal && (
          <motion.div
            key={`r-${cycleKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: fading ? 0 : 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            className="absolute inset-0 flex flex-col gap-2 justify-center"
          >
            <div className="flex items-center gap-3.5">
              {/* Score ring */}
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 50 50">
                  <circle cx="25" cy="25" r={R} fill="none" stroke="rgba(234,241,255,.12)" strokeWidth="3" />
                  <circle cx="25" cy="25" r={R} fill="none" stroke="url(#ff-ring-grad)" strokeWidth="3" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
                  <defs>
                    <linearGradient id="ff-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={C.successOnNavy} />
                      <stop offset="100%" stopColor={C.skyOnNavy} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[12px] font-bold" style={{ color: C.onNavy }}>{score}<span className="text-[7px] opacity-50">/100</span></span>
                </div>
              </div>
              {/* Criteria */}
              <div className="flex flex-wrap gap-1.5 flex-1">
                {CRITERIA.map((c, i) => (
                  <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300" style={i < filledCr ? { background: 'rgba(155,231,196,.14)', border: '1px solid rgba(155,231,196,.34)', color: C.successOnNavy } : { background: 'rgba(234,241,255,.04)', border: '1px solid rgba(234,241,255,.10)', color: 'rgba(234,241,255,.5)' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
            {/* XP badge — inside card, right side, full text */}
            {score >= 90 && (
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: fading ? 0 : 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.4 }} className="self-end">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-deep))', boxShadow: '0 4px 16px rgba(201,154,59,.3)' }}>
                  <Trophy className="h-3.5 w-3.5" style={{ color: C.ink }} />
                  <div className="leading-none">
                    <p className="text-[11px] font-bold whitespace-nowrap" style={{ color: C.ink }}>+120 XP</p>
                    <p className="text-[8px] whitespace-nowrap mt-0.5" style={{ color: 'rgba(11,21,48,.7)' }}>Yangi daraja ochildi</p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   CourtCard — Moot Court card with dialog + result + CTA
   ═════════════════════════════════════════════════════════════════ */
function CourtCard({ onNavigate, story }: { onNavigate: (tab: string) => void; story: ReturnType<typeof useStoryLoop> }) {
  return (
    <div
      className="rounded-[24px] flex flex-col"
      style={{
        width: 'min(480px, 100%)',
        height: 510,
        background: `linear-gradient(160deg, ${C.navy1} 0%, ${C.navy2} 70%, ${C.navy3} 100%)`,
        boxShadow: `0 50px 90px -35px ${C.shadow}, inset 0 1px 0 ${C.rimLight}`,
        border: '1px solid rgba(141,183,255,.28)',
        position: 'relative',
        ['--glare-x' as any]: '50%',
        ['--glare-y' as any]: '50%',
      }}
    >
      {/* Glare overlay on card surface */}
      {!reduceMotion && !isTouch && (
        <div className="absolute inset-0 rounded-[24px] pointer-events-none" style={{
          background: 'radial-gradient(200px circle at var(--glare-x, 50%) var(--glare-y, 50%), rgba(255,255,255,0.10), transparent 70%)',
        }} />
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: 'rgba(141,183,255,.15)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
          <Scale className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: C.onNavy, fontFamily: SERIF }}>Moot Court</p>
          <p className="text-[10px]" style={{ color: C.onNavyMuted }}>AI sudya bilan jonli bahs</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-4 py-3 gap-2 overflow-hidden">
        <StoryDialog phase={story.phase} cycleKey={story.cycleKey} qText={story.qText} aText={story.aText} />
        <ResultPanel phase={story.phase} cycleKey={story.cycleKey} score={story.score} filledCr={story.filledCr} />
      </div>

      {/* Footer — CTA */}
      <div className="px-4 pb-4 pt-1">
        <button
          onClick={() => onNavigate('moot_court')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 font-semibold text-sm rounded-xl transition-all ff-focus"
          style={{ background: 'var(--ff-card)', color: 'var(--cobalt-2)' }}
        >
          <Scale className="h-3.5 w-3.5" />
          Bahsni boshlash
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   FloatChips — glassmorphic chips in front layer
   ═════════════════════════════════════════════════════════════════ */
function FloatChips({ onNavigate, blogTitle }: { onNavigate: (tab: string) => void; blogTitle: string | null }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Test chip — bottom-left of card, extends below-left */}
      <motion.div
        initial={{ opacity: 0, x: -16, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute"
        style={{ left: -16, bottom: 52 }}
      >
        <button
          onClick={() => onNavigate('mavjud_testlar')}
          className="pointer-events-auto flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all text-left ff-focus"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', borderRadius: 24, boxShadow: '0 18px 40px -18px rgba(13,27,66,.28)' }}
          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 22px 44px -16px rgba(13,27,66,.38)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 18px 40px -18px rgba(13,27,66,.28)'}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
            <FileText className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="leading-none text-left">
            <p className="text-[11px] font-bold" style={{ color: 'var(--ink)' }}>Mavjud testlar</p>
            <p className="text-[9px] mt-1" style={{ color: 'var(--ink-body)' }}>Bilim sinovi</p>
          </div>
          <div className="flex items-center gap-1 ml-1">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>A</span>
            {!reduceMotion && (
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}
                className="text-[8px] font-bold whitespace-nowrap"
                style={{ color: 'var(--success)' }}
              >
                TO'G'RI
              </motion.span>
            )}
          </div>
        </button>
      </motion.div>

      {/* Blog chip — top-right of card, extends above-right */}
      <motion.div
        initial={{ opacity: 0, x: 16, y: -12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="absolute"
        style={{ right: -12, top: 48 }}
      >
        <button
          onClick={() => onNavigate('blog')}
          className="pointer-events-auto flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all text-left max-w-[200px] ff-focus"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', borderRadius: 24, boxShadow: '0 18px 40px -18px rgba(13,27,66,.28)' }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 22px 44px -16px rgba(13,27,66,.38)'; e.currentTarget.style.borderColor = 'var(--cobalt-line)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 18px 40px -18px rgba(13,27,66,.28)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--gold-tint)' }}>
            <Newspaper className="h-3.5 w-3.5" style={{ color: 'var(--gold-ink)' }} />
          </div>
          <div className="leading-none text-left min-w-0">
            <p className="text-[11px] font-bold" style={{ color: 'var(--ink)' }}>Blog</p>
            <p className="text-[9px] mt-1 truncate" style={{ color: 'var(--ink-body)' }}>{blogTitle || 'So\'nggi maqolalar'}</p>
          </div>
        </button>
      </motion.div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   StageScene — 3D perspective container wrapping card + chips + shadow
   ═════════════════════════════════════════════════════════════════ */
function StageScene({ onNavigate, blogTitle }: { onNavigate: (tab: string) => void; blogTitle: string | null }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const auroraRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const { onMouseMove, onMouseLeave } = useTiltParallax(stageRef, cardRef, shadowRef, frontRef, auroraRef);
  const story = useStoryLoop();

  return (
    <div className="relative w-full h-full">
      {/* Backdrop layer — outside 3D context, first layer */}
      <HeroBackdrop auroraRef={auroraRef} bgRef={bgRef} />

      {/* Static decor: halo + dashed ring — outside 3D context */}
      <div className="absolute pointer-events-none" style={{ width: 440, height: 440, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 0 }}>
        <div className="ff-halo" style={{ width: 440, height: 440, left: 0, top: 0 }} />
        <div className="ff-ring" style={{ width: 380, height: 380, left: 30, top: 30 }} />
        {/* Two small dots on the ring */}
        <div style={{ position: 'absolute', width: 8, height: 8, borderRadius: '50%', background: 'var(--cobalt-1)', left: 190, top: 20, boxShadow: '0 0 12px rgba(47,104,232,.4)' }} />
        <div style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)', left: 340, top: 190, boxShadow: '0 0 10px rgba(201,154,59,.4)' }} />
      </div>

      {/* 3D perspective container — only card wrapper inside */}
      <div
        ref={stageRef}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '1400px', transformStyle: 'preserve-3d' }}
      >
        {/* Card wrapper — positioned in center */}
        <motion.div
          initial={{ opacity: 0, z: -220, scale: 0.9 }}
          animate={{ opacity: 1, z: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
          style={{ transformStyle: 'preserve-3d', width: 'min(480px, 100%)', height: 510 }}
        >
          {/* Floor shadow */}
          <div
            ref={shadowRef}
            className="absolute rounded-[50%]"
            style={{
              width: '80%', height: 30, bottom: -20, left: '10%',
              background: `radial-gradient(ellipse, ${C.shadow}, transparent 70%)`,
              filter: 'blur(12px)',
              willChange: 'transform',
            }}
          />
          {/* The card itself */}
          <div ref={cardRef} style={{ willChange: 'transform', transformStyle: 'preserve-3d' }}>
            <CourtCard onNavigate={onNavigate} story={story} />
          </div>
          {/* Front chips layer */}
          <div ref={frontRef} className="absolute inset-0 pointer-events-none" style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
            <FloatChips onNavigate={onNavigate} blogTitle={blogTitle} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   1. HERO — bright stage, 9s story loop, 3D parallax
   ═════════════════════════════════════════════════════════════════ */
function HeroSection({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [blogTitle, setBlogTitle] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('title')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.title) setBlogTitle(data.title); });
  }, []);

  return (
    <>
      <style>{`
        .ff-hero-italic {
          background: linear-gradient(120deg, var(--cobalt-2) 0%, var(--cobalt-light) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          font-style: italic;
          font-family: 'Source Serif 4 Variable', 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
          padding-right: 0.08em;
        }
        .ff-skeleton {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: ff-shimmer 1.5s ease-in-out infinite;
          border-radius: 9999px;
        }
        @keyframes ff-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes ff-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes ff-typing {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes ff-aurora1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 30px) scale(0.95); }
        }
        @keyframes ff-aurora2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(0.9); }
          66% { transform: translate(30px, -15px) scale(1.08); }
        }
        @keyframes ff-aurora3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, -20px) scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ff-skeleton, .ff-pulse, .ff-typing { animation: none !important; }
        }
      `}</style>

      <section className="ff-hero-sec">
        <div className="mx-auto lg:h-full" style={{ maxWidth: 1280, padding: '0 40px' }}>
          <div className="grid lg:grid-cols-[48fr_52fr] lg:h-full gap-6 items-center">
            {/* LEFT — Copy */}
            <div className="relative z-10">
              <HeroCopy onNavigate={onNavigate} />
              {/* sr-only static equivalent for accessibility */}
              <span className="sr-only">
                Moot Court demo: AI Sudya so&rsquo;raydi &ldquo;{STORY_Q}&rdquo;. Siz javob berasiz &ldquo;{STORY_A}&rdquo;. Natija: 92/100. Mezonlar: {CRITERIA.join(', ')}. +120 XP Yangi daraja ochildi.
              </span>
            </div>

            {/* RIGHT — Stage (desktop) */}
            <div className="relative hidden lg:block lg:h-full">
              <StageScene onNavigate={onNavigate} blogTitle={blogTitle} />
            </div>

            {/* Mobile — simplified stage */}
            <div className="lg:hidden relative z-10 pb-6">
              <CourtCard onNavigate={onNavigate} story={useStoryLoop()} />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => onNavigate('mavjud_testlar')}
                  className="flex items-center gap-2 px-3 py-2 text-left"
                  style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', borderRadius: 16 }}
                >
                  <FileText className="h-4 w-4" style={{ color: 'var(--cobalt-2)' }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Mavjud testlar</p>
                    <p className="text-[10px]" style={{ color: 'var(--ink-body)' }}>Bilim sinovi</p>
                  </div>
                </button>
                <button
                  onClick={() => onNavigate('blog')}
                  className="flex items-center gap-2 px-3 py-2 text-left"
                  style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', borderRadius: 16 }}
                >
                  <Newspaper className="h-4 w-4" style={{ color: 'var(--gold-ink)' }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Blog</p>
                    <p className="text-[10px]" style={{ color: 'var(--ink-body)' }}>{blogTitle || 'So\'nggi maqolalar'}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ═══ 2. STATS STRIP ═══ */
function StatsStrip() {
  const [stats, setStats] = useState<{ label: string; value: number }[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [testRes, kazusRes, blogRes] = await Promise.allSettled([
          supabase.from('testlar').select('*', { count: 'exact', head: true }).eq('ommaviy', true),
          supabase.from('toplamlar').select('*', { count: 'exact', head: true }).eq('ommaviy', true),
          supabase.from('blog_posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        ]);

        const items: { label: string; value: number }[] = [];
        if (testRes.status === 'fulfilled' && testRes.value.count !== null && testRes.value.count > 0)
          items.push({ label: 'Mavjud testlar', value: testRes.value.count });
        if (kazusRes.status === 'fulfilled' && kazusRes.value.count !== null && kazusRes.value.count > 0)
          items.push({ label: 'Mavjud kazuslar', value: kazusRes.value.count });
        if (blogRes.status === 'fulfilled' && blogRes.value.count !== null && blogRes.value.count > 0)
          items.push({ label: 'Maqolalar', value: blogRes.value.count });

        setStats(items.length > 0 ? items : null);
      } catch {
        setStats(null);
      }
    };
    fetchStats();
  }, []);

  if (!stats) return null;

  return (
    <section className="px-4 md:px-6 py-6">
      <div className="mx-auto" style={{ maxWidth: 1360 }} ref={ref}>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-8 md:gap-16 py-6 px-8 rounded-2xl backdrop-blur-sm"
          style={{ background: 'rgba(255,255,255,.6)', border: '1px solid var(--line)' }}
        >
          {stats.map((s, i) => (
            <motion.div key={i} variants={fadeUp} className="text-center">
              <p className="text-3xl md:text-4xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                <AnimatedNumber target={s.value} start={inView} />
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: 'var(--ink-muted)' }}>{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AnimatedNumber({ target, start }: { target: number; start: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start || reduceMotion) { if (start) setCount(target); return; }
    const duration = 1500;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(tick);
      else setCount(target);
    };
    requestAnimationFrame(tick);
  }, [start, target]);
  return <>{count.toLocaleString()}</>;
}

/* ═══ 3. FEATURE GRID ═══ */
function FeatureGrid({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [latestBlogTitle, setLatestBlogTitle] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('blog_posts')
      .select('title')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data?.title) setLatestBlogTitle(data.title); });
  }, []);

  const features = [
    { icon: FileText, color: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))', title: 'Mavjud testlar', desc: "Ommaviy testlar bilan bilimingizni xolis filtrdan o'tkazing.", tab: 'mavjud_testlar', demo: 'test' as const },
    { icon: Brain, color: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-light))', title: 'Mavjud kazuslar', desc: 'Haqiqiy huquqiy vaziyatlar va AI ning xolis bahosi.', tab: 'mavjud_kazuslar', demo: 'kazus' as const },
    { icon: Scale, color: 'linear-gradient(135deg, var(--navy-1), var(--navy-3))', title: 'Moot Court', desc: 'AI sudya bilan jonli bahs. Ustoz bahoni tasdiqlaydi.', tab: 'moot_court', demo: 'moot' as const },
    { icon: Library, color: 'linear-gradient(135deg, var(--cobalt-2), var(--cobalt-light))', title: "O'quv materiallari", desc: "Sara va tizimlashtirilgan kontent — murakkab mavzular oddiy tilda.", tab: 'oqmatlar', demo: null },
    { icon: Layers, color: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-light))', title: 'Savol–javoblar', desc: "Savollarga javoblar kutubxonasi — bilimni mustahkamlang.", tab: 'savol_javob', demo: null },
    { icon: Newspaper, color: 'linear-gradient(135deg, var(--gold), var(--gold-ink))', title: 'Blog', desc: latestBlogTitle || 'Yuridik mavzularda maqolalar va tahlillar.', tab: 'blog', demo: null },
  ];

  return (
    <section className="px-4 md:px-6 py-12">
      <div className="mx-auto" style={{ maxWidth: 1360 }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] mb-2" style={{ color: 'var(--cobalt-2)' }}>Biz taqdim etamiz</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight ff-serif" style={{ color: 'var(--ink)' }}>Funksiyalar</h2>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div key={i} variants={fadeUp}>
                <SpotlightCard
                  onClick={() => onNavigate(f.tab)}
                  className="group h-full rounded-3xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer"
                  style={{ border: '1px solid var(--line)' }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500 rounded-3xl" style={{ background: f.color }} />
                  <div className="p-6 flex flex-col gap-4 relative z-10 h-full">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ background: f.color }}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold leading-tight" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                        <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--ink-body)' }}>{f.desc}</p>
                      </div>
                    </div>

                    {/* Mini demos */}
                    {f.demo === 'test' && <MiniTestDemo />}
                    {f.demo === 'kazus' && <MiniKazusDemo />}
                    {f.demo === 'moot' && <MiniMootDemo />}

                    <div className="flex items-center gap-1.5 text-sm font-semibold group-hover:gap-3 transition-all mt-auto" style={{ color: 'var(--cobalt-2)' }}>
                      Batafsil <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </SpotlightCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ── Mini demos for feature cards ── */
function MiniTestDemo() {
  const [selected, setSelected] = useState(-1);
  useEffect(() => {
    if (reduceMotion) { setSelected(1); return; }
    const interval = setInterval(() => {
      setSelected(prev => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      {['A variant', 'B variant', 'C variant', 'D variant'].map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${selected === i ? '' : ''}`} style={selected === i ? { background: 'var(--success)', borderColor: 'var(--success)' } : { borderColor: 'var(--line)' }} />
          <span className="text-xs" style={{ color: 'var(--ink-body)' }}>{v}</span>
          {selected === i && (
            <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] font-bold ml-auto" style={{ color: 'var(--success)' }}>
              TO'G'RI
            </motion.span>
          )}
        </div>
      ))}
    </div>
  );
}

function MiniKazusDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [score, setScore] = useState(0);
  const [filledCriteria, setFilledCriteria] = useState(0);
  const criteria = ['Mantiq', 'Dalil', 'Tahlil', 'Xulosa', 'Uslub'];

  useEffect(() => {
    if (!inView || reduceMotion) { if (inView) { setScore(92); setFilledCriteria(5); } return; }
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setScore(Math.round((1 - Math.pow(1 - p, 3)) * 92));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const crInterval = setInterval(() => setFilledCriteria(c => c >= 5 ? (clearInterval(crInterval), 5) : c + 1), 300);
    return () => clearInterval(crInterval);
  }, [inView]);

  const R = 28;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (score / 100) * CIRC;

  return (
    <div ref={ref} className="flex items-center gap-4 mt-1">
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 70 70">
          <circle cx="35" cy="35" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle cx="35" cy="35" r={R} fill="none" stroke="url(#kz-grad)" strokeWidth="4" strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
          <defs><linearGradient id="kz-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--cobalt-1)" /><stop offset="100%" stopColor="var(--cobalt-light)" /></linearGradient></defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color: 'var(--cobalt-2)' }}>{score}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {criteria.map((c, i) => (
          <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all duration-300" style={i < filledCriteria ? { background: 'var(--cobalt-tint)', color: 'var(--cobalt-2)' } : { background: 'var(--bg-2)', color: 'var(--ink-muted)' }}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniMootDemo() {
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: 'var(--cobalt-tint)' }}>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cobalt-1)', animation: `mc-typing-bounce 1.2s ${i * 0.15}s infinite ease-in-out` }} />
          ))}
        </div>
        <span className="text-[10px] font-bold" style={{ color: 'var(--cobalt-2)' }}>AI sudya yozmoqda...</span>
      </div>
    </div>
  );
}

/* ═══ 4. PROCESS STEPS ═══ */
function ProcessSteps() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-60px' });
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { num: '01', title: "O'rganing", desc: "O'quv materiallari orqali nazariy bilim oling.", icon: Library, color: 'var(--cobalt-1)' },
    { num: '02', title: 'Sinang', desc: 'Test va kazuslar bilan bilimingizni tekshiring.', icon: FileText, color: 'var(--cobalt-2)' },
    { num: '03', title: 'AI baholaydi', desc: 'Mezonlar bo\u2018yicha xolis baho oling.', icon: Brain, color: 'var(--cobalt-light)' },
    { num: '04', title: 'Ustoz tasdiqlaydi', desc: 'Moot Court natijangiz ustoz tomonidan tasdiqlanadi.', icon: CheckCircle2, color: 'var(--success)' },
  ];

  useEffect(() => {
    if (!inView || reduceMotion) return;
    const interval = setInterval(() => setActiveStep(s => (s + 1) % 4), 3000);
    return () => clearInterval(interval);
  }, [inView]);

  return (
    <section className="px-4 md:px-6 py-12" ref={sectionRef}>
      <div className="mx-auto" style={{ maxWidth: 1360 }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] mb-2" style={{ color: 'var(--cobalt-2)' }}>Jarayon</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight ff-serif" style={{ color: 'var(--ink)' }}>Qanday ishlaydi?</h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute top-[36px] left-0 right-0 h-0.5 rounded-full hidden md:block" style={{ background: 'var(--line)' }} />
          <div
            className="absolute top-[36px] left-0 h-0.5 rounded-full hidden md:block transition-all duration-700"
            style={{ width: `${(activeStep + 1) / 4 * 100}%`, background: 'linear-gradient(90deg, var(--cobalt-1), var(--cobalt-2), var(--cobalt-light), var(--success))' }}
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === activeStep;
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div
                    className="relative w-14 h-14 rounded-2xl mx-auto flex items-center justify-center transition-all duration-500"
                    style={{
                      background: isActive ? s.color : 'var(--bg-2)',
                      boxShadow: isActive ? `0 8px 24px rgba(13,27,66,.15)` : 'none',
                      transform: isActive ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
                    }}
                  >
                    <Icon className="h-6 w-6" style={{ color: isActive ? 'white' : 'var(--ink-muted)' }} />
                  </div>
                  <p className="text-[10px] font-bold tabular-nums mt-3" style={{ color: isActive ? s.color : 'var(--ink-muted)' }}>{s.num}</p>
                  <h3 className="text-sm font-bold mt-1" style={{ color: 'var(--ink)' }}>{s.title}</h3>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--ink-body)' }}>{s.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ 5. CTA BAND ═══ */
function CtaBand({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return (
    <section className="px-4 md:px-6 py-12">
      <div className="mx-auto" style={{ maxWidth: 1360 }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }}>
          <SpotlightCard className="rounded-3xl overflow-hidden" >
            <div className="relative px-6 py-12 md:px-14 md:py-14 text-center" style={{ background: 'linear-gradient(135deg, var(--navy-1), var(--navy-2), var(--navy-3))' }}>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3" style={{ background: 'rgba(47,104,232,.15)' }} />
                <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full blur-3xl -translate-x-1/4 translate-y-1/3" style={{ background: 'rgba(141,183,255,.10)' }} />
              </div>
              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3 ff-serif" style={{ color: 'var(--on-navy)' }}>Bilimingizni bugun sinab ko&rsquo;ring</h2>
                <p className="text-sm max-w-md mx-auto mb-8" style={{ color: 'var(--on-navy-muted)' }}>AI+Human metodi yordamida bilimni chuqur tushuning va amalda qo&rsquo;llang.</p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <button
                    onClick={() => onNavigate('sinov')}
                    className="flex items-center gap-2 px-7 py-3.5 text-white font-semibold text-sm rounded-2xl transition-all active:scale-95 hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))', boxShadow: '0 8px 24px rgba(29,78,216,.35)' }}
                  >
                    <Play className="h-4 w-4 fill-white" />
                    O&rsquo;qishni boshlash
                  </button>
                  <button
                    onClick={() => onNavigate('mavjud_kazuslar')}
                    className="flex items-center gap-2 px-6 py-3.5 text-white font-semibold text-sm rounded-2xl active:scale-95 transition-all backdrop-blur-md"
                    style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(141,183,255,.2)' }}
                  >
                    <GraduationCap className="h-4 w-4" />
                    Mavjud kazuslarni ko&rsquo;rish
                  </button>
                </div>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══ 6. FAQ ═══ */
const FAQ_ITEMS = [
  {
    q: "FanFaster nima va kimlar uchun?",
    a: "FanFaster — o'zbek tilidagi huquq ta'limi platformasi. Bu yerda o'quv materiallarini o'rganish, test va kazuslar bilan bilimni sinash hamda AI sudya bilan jonli bahs qilish bir joyga jamlangan. Platforma huquq yo'nalishida o'qiyotgan talabalar, imtihonga tayyorlanayotganlar va ustozlar uchun mo'ljallangan.",
  },
  {
    q: "Moot Court qanday ishlaydi?",
    a: "Ustoz kazus tayyorlaydi: vaziyat, tegishli qonun moddalari va AI qaysi rolni (sudya yoki qarshi tomon) o'ynashi belgilanadi. Siz o'z tomoningizni tanlab, AI bilan bahslashasiz. Bahs qiyinligi uch darajada bo'ladi: Yengil, O'rta va Qattiq. Belgilangan almashinuvlar soniga yetganda AI yakuniy nutq so'zlab, sessiyani tugatadi.",
  },
  {
    q: "Bahoni kim qo'yadi?",
    a: "AI bahsingizni besh mezon bo'yicha xolis baholaydi: Mantiq, Dalil, Tahlil, Xulosa va Uslub. Keyin ustoz natijani ko'rib chiqadi va bahoni tasdiqlaydi yoki o'zgartiradi, ya'ni yakuniy baho ustozniki.",
  },
  {
    q: "Ro'yxatdan o'tmasdan sinab ko'rsam bo'ladimi?",
    a: "Ha. Mehmon sifatida kirib, Moot Court'ni cheklangan miqdordagi bepul almashinuv bilan sinab ko'rishingiz mumkin. To'liq foydalanish uchun tizimga kirish kerak bo'ladi.",
  },
  {
    q: "Qayerdan boshlash kerak?",
    a: "Yo'l oddiy: avval O'quv materiallari bilan nazariyani o'rganing, so'ng Mavjud testlar va kazuslarda bilimingizni tekshiring, tayyor bo'lganda Moot Court'da AI sudya bilan bahslashing. Savol–javoblar bo'limi mavzularni mustahkamlashga yordam beradi.",
  },
  {
    q: "Ustozlar platformadan qanday foydalanadi?",
    a: "Ustoz Moot Court uchun kazus yaratadi, talabalar natijalarini ko'radi va AI bergan bahoni tasdiqlaydi yoki tuzatadi. Talabaga qayta urinishga ruxsat berish ham ustozning qo'lida.",
  },
];

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="px-4 md:px-6 py-12">
      <div className="mx-auto" style={{ maxWidth: 900 }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] mb-2" style={{ color: 'var(--cobalt-2)' }}>Savol–javoblar</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight ff-serif" style={{ color: 'var(--ink)' }}>Ko'p so'raladigan savollar</h2>
        </motion.div>

        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <motion.div key={i} variants={fadeUp}>
              <div className="bg-white rounded-2xl overflow-hidden transition-all duration-300" style={openIndex === i ? { border: '1px solid var(--cobalt-line)', boxShadow: '0 4px 12px rgba(13,27,66,.08)' } : { border: '1px solid var(--line)' }}>
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  aria-expanded={openIndex === i}
                  aria-controls={`faq-panel-${i}`}
                  className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left ff-focus"
                  style={{ }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span className="text-[15px] font-semibold pr-4" style={{ color: 'var(--ink)' }}>{item.q}</span>
                  <motion.div animate={{ rotate: openIndex === i ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
                    <ChevronDown className="h-4 w-4" style={{ color: openIndex === i ? 'var(--cobalt-2)' : 'var(--ink-muted)' }} />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {openIndex === i && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 pt-1 border-t" style={{ borderColor: 'var(--line)' }}>
                        <p className="text-[15px] leading-[1.7]" style={{ color: 'var(--ink-body)' }}>{item.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══ 8. FOOTER ═══ */
function SiteFooter({ onNavigate }: { onNavigate: (tab: string) => void }) {
  return (
    <footer className="px-4 md:px-6 pt-12 pb-8 mt-8" style={{ background: 'linear-gradient(135deg, var(--navy-1), var(--navy-2), var(--navy-3))' }}>
      <div className="mx-auto" style={{ maxWidth: 1360 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Col 1 — Logo + desc */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
                <Scale className="text-white" style={{ width: 18, height: 18 }} />
              </div>
              <span className="text-base font-bold" style={{ color: 'var(--on-navy)', fontFamily: SERIF }}>FanFaster</span>
            </div>
            <p className="text-xs leading-relaxed max-w-[240px]" style={{ color: 'var(--on-navy-muted)' }}>
              O&rsquo;zbek tilidagi yuridik ta&rsquo;lim platformasi. AI+Human metodi yordamida bilimni chuqur tushuning va amalda qo&rsquo;llang.
            </p>
          </div>

          {/* Col 2 — Platforma */}
          <nav>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--on-navy)' }}>Platforma</h3>
            <ul className="space-y-2">
              {[
                { label: 'Dastur haqida', tab: 'haqida' },
                { label: 'Kurslar', tab: 'kurslar' },
                { label: "O'quv materiallari", tab: 'oqmatlar' },
                { label: 'Blog', tab: 'blog' },
                { label: 'Reyting', tab: 'reyting' },
              ].map(l => (
                <li key={l.tab}>
                  <button onClick={() => onNavigate(l.tab)} className="text-xs transition-colors font-medium text-left" style={{ color: 'var(--on-navy-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sky-on-navy)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--on-navy-muted)'}>{l.label}</button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Col 3 — Funksiyalar */}
          <nav>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--on-navy)' }}>Funksiyalar</h3>
            <ul className="space-y-2">
              {[
                { label: 'Mavjud testlar', tab: 'mavjud_testlar' },
                { label: 'Mavjud kazuslar', tab: 'mavjud_kazuslar' },
                { label: 'Moot Court', tab: 'moot_court' },
                { label: 'Savol–javoblar', tab: 'savol_javob' },
                { label: 'Yordam', tab: 'yordam' },
              ].map(l => (
                <li key={l.tab}>
                  <button onClick={() => onNavigate(l.tab)} className="text-xs transition-colors font-medium text-left" style={{ color: 'var(--on-navy-muted)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--sky-on-navy)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--on-navy-muted)'}>{l.label}</button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="pt-6 border-t" style={{ borderColor: 'rgba(141,183,255,.15)' }}>
          <p className="text-xs font-medium text-center" style={{ color: 'var(--on-navy-muted)' }}>&copy; 2026 FanFaster. Barcha huquqlar himoyalangan.</p>
        </div>
      </div>
    </footer>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════════ */
export default function SaytHaqida({ onNavigate }: SaytHaqidaProps) {
  const handleNav = (tab: string) => onNavigate(tab);

  return (
    <div className="w-full" style={{ minHeight: '100%', color: 'var(--ink)' }}>
      <style>{`
        .ff-spotlight::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(300px circle at var(--sx, 50%) var(--sy, 50%), rgba(47,104,232,0.06), transparent 60%);
          opacity: 0;
          transition: opacity 0.4s;
          pointer-events: none;
          z-index: 0;
        }
        .ff-spotlight:hover::before { opacity: 1; }
        @media (hover: none) { .ff-spotlight::before { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .ff-spotlight::before { display: none; }
        }
      `}</style>

      <HeroSection onNavigate={handleNav} />
      <StatsStrip />
      <FeatureGrid onNavigate={handleNav} />
      <ProcessSteps />
      <CtaBand onNavigate={handleNav} />
      <FaqSection />
      <SiteFooter onNavigate={handleNav} />
    </div>
  );
}
