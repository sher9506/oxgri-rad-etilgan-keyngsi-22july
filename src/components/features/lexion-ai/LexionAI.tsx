// LexionAI — o'ng pastki burchakda turadigan jonli AI robotcha
// Faqat jamoat (public) sahifalarda ko'rinadi

import { useState, useRef, useEffect, useCallback } from 'react';
import './lexion.css';
import { LexionRobot } from './LexionRobot';
import { LexionLabel } from './LexionLabel';

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const IS_TOUCH =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: none)').matches;

interface LexionAIProps {
  onOpen?: () => void;
}

export function LexionAI({ onOpen }: LexionAIProps) {
  const [responding, setResponding] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  const sceneRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Pointer target for tilt + eye tracking
  const pointerTarget = useRef({ x: 0, y: 0 });
  const pointerCurrent = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  // ── Tab visibility: pause animations ──
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Pointer tilt + eye tracking (desktop only) ──
  useEffect(() => {
    if (REDUCED_MOTION || IS_TOUCH) return;

    const tick = () => {
      pointerCurrent.current.x += (pointerTarget.current.x - pointerCurrent.current.x) * 0.06;
      pointerCurrent.current.y += (pointerTarget.current.y - pointerCurrent.current.y) * 0.06;

      if (sceneRef.current) {
        const tx = pointerCurrent.current.y * -0.1;
        const ty = pointerCurrent.current.x * 0.1;
        sceneRef.current.style.transform = `rotateX(${tx.toFixed(2)}deg) rotateY(${ty.toFixed(2)}deg)`;
      }

      if (eyesRef.current) {
        const ex = pointerCurrent.current.x * 0.4;
        const ey = pointerCurrent.current.y * 0.35;
        eyesRef.current.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const onMove = (e: MouseEvent) => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      pointerTarget.current.x = Math.max(-10, Math.min(10, dx * 10));
      pointerTarget.current.y = Math.max(-10, Math.min(10, dy * 10));
    };

    const onLeave = () => {
      pointerTarget.current.x = 0;
      pointerTarget.current.y = 0;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // ── Periodic "thinking" gesture (~8s) ──
  useEffect(() => {
    if (REDUCED_MOTION) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      setThinking(true);
      setTimeout(() => setThinking(false), 1300);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── Click handler ──
  const handleClick = useCallback(() => {
    if (responding) return;
    setResponding(true);
    if (pillRef.current) {
      pillRef.current.classList.remove('pulse');
      void pillRef.current.offsetWidth;
      pillRef.current.classList.add('pulse');
    }
    onOpen?.();
    setTimeout(() => setResponding(false), 650);
  }, [responding, onOpen]);

  return (
    <div className={`lex-root${tabHidden ? ' tab-hidden' : ''}`}>
      <LexionLabel onClick={handleClick} pulseRef={pillRef} />
      <button
        ref={btnRef}
        className={`lex-robot-btn${responding ? ' respond' : ''}${thinking ? ' thinking' : ''}`}
        onClick={handleClick}
        aria-label="Lexion AI yordamchisi"
        type="button"
      >
        <div className="lex-glow" />
        <LexionRobot sceneRef={sceneRef} floatRef={floatRef} eyesRef={eyesRef} />
        <div className="lex-shadow" />
      </button>
    </div>
  );
}
