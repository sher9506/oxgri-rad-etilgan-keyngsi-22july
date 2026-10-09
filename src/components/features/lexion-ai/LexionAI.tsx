// LexionAI — "Adolat Orbi" — shishasomon shar ichida tarozi
// O'ng pastki burchakda turadigan jonli AI yordamchisi
// Faqat jamoat (public) sahifalarda ko'rinadi

import { useState, useRef, useEffect, useCallback } from 'react';
import './lexion.css';
import { LexionOrb } from './LexionOrb';
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
  const [tiltActive, setTiltActive] = useState(false);

  const sceneRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);
  const innerLightRef = useRef<SVGCircleElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const pointerTarget = useRef({ x: 0, y: 0 });
  const pointerCurrent = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  // ── Tab visibility: pause animations ──
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ── Pointer tilt + inner light tracking (desktop only) ──
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

      if (innerLightRef.current) {
        const lx = pointerCurrent.current.x * 0.35;
        const ly = pointerCurrent.current.y * 0.35;
        innerLightRef.current.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
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
      setTiltActive(true);
    };

    const onLeave = () => {
      pointerTarget.current.x = 0;
      pointerTarget.current.y = 0;
      setTiltActive(false);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // ── Periodic "thinking" gesture (~7s) ──
  useEffect(() => {
    if (REDUCED_MOTION) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      setThinking(true);
      setTimeout(() => setThinking(false), 1400);
    }, 7000);
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
    setTimeout(() => setResponding(false), 700);
  }, [responding, onOpen]);

  return (
    <div className={`lex-root${tabHidden ? ' tab-hidden' : ''}`}>
      <LexionLabel onClick={handleClick} pulseRef={pillRef} />
      <button
        ref={btnRef}
        className={`lex-orb-btn${responding ? ' respond' : ''}${thinking ? ' thinking' : ''}${tiltActive ? ' tilt-active' : ''}`}
        onClick={handleClick}
        aria-label="Lexion AI yordamchisi"
        type="button"
      >
        <div className="lex-glow" />
        <LexionOrb sceneRef={sceneRef} floatRef={floatRef} innerLightRef={innerLightRef} />
        <div className="lex-shadow" />
      </button>
    </div>
  );
}
