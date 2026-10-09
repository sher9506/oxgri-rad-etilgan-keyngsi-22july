// LexionAI — o'ng pastki burchakdagi jonli AI yordamchi ("Adolat Orbi")
// Faqat jamoat sahifalarida render qilinadi (istisno sharti App.tsx da).
import { useCallback, useEffect, useRef } from 'react';
import './lexion.css';
import { LexionOrb } from './LexionOrb';
import { LexionLabel } from './LexionLabel';

interface LexionAIProps {
  onOpen?: () => void;
}

const MAX_TILT = 10; // daraja
const FAR = 380; // px — shundan uzoqda to'liq tilt
const NEAR = 240; // px — shundan yaqinda orbitalar tezlashadi
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function LexionAI({ onOpen }: LexionAIProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<HTMLSpanElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const clickTimerRef = useRef<number>();

  useEffect(() => {
    const root = rootRef.current;
    const btn = btnRef.current;
    const scene = sceneRef.current;
    if (!root || !btn || !scene) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(hover: none)').matches;
    const timers: number[] = [];

    // Tab yashirin bo'lsa animatsiyalar pauza (CSS .tab-hidden)
    const onVis = () => root.classList.toggle('tab-hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    onVis();

    // Har ~7s "o'ylash" harakati
    let thinkId: number | undefined;
    if (!reduced) {
      thinkId = window.setInterval(() => {
        if (document.hidden || busyRef.current) return;
        btn.classList.add('thinking');
        timers.push(window.setTimeout(() => btn.classList.remove('thinking'), 1600));
      }, 7000);
    }

    // Pointer tilt + ichki yorug'lik (faqat desktop)
    let raf = 0;
    let running = false;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.09;
      cur.y += (target.y - cur.y) * 0.09;
      scene.style.setProperty('--rx', (cur.x * MAX_TILT).toFixed(2));
      scene.style.setProperty('--ry', (-cur.y * MAX_TILT).toFixed(2));
      scene.style.setProperty('--lx', (cur.x * 10).toFixed(1) + 'px');
      scene.style.setProperty('--ly', (cur.y * 10).toFixed(1) + 'px');
      const settled =
        Math.abs(target.x - cur.x) < 0.002 && Math.abs(target.y - cur.y) < 0.002;
      if (settled) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: MouseEvent) => {
      if (document.hidden) return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      target.x = clamp(dx / FAR);
      target.y = clamp(dy / FAR);
      btn.classList.toggle('near', Math.hypot(dx, dy) < NEAR);
      start();
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      btn.classList.remove('near');
      start();
    };

    if (!reduced && !touch) {
      window.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseleave', onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (thinkId) window.clearInterval(thinkId);
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  useEffect(() => () => window.clearTimeout(clickTimerRef.current), []);

  const handleClick = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    const btn = btnRef.current;
    const pill = pillRef.current;
    btn?.classList.remove('thinking');
    btn?.classList.add('respond');
    if (pill) {
      pill.classList.remove('pulse');
      void pill.offsetWidth; // animatsiyani qayta ishga tushirish
      pill.classList.add('pulse');
    }
    onOpen?.();
    clickTimerRef.current = window.setTimeout(() => {
      btn?.classList.remove('respond');
      pill?.classList.remove('pulse');
      busyRef.current = false;
    }, 800);
  }, [onOpen]);

  return (
    <div ref={rootRef} className="lex-root">
      <button
        ref={btnRef}
        type="button"
        className="lex-orb-btn"
        onClick={handleClick}
        aria-label="Lexion AI yordamchisi"
      >
        <span className="lex-shadow" aria-hidden="true" />
        <LexionOrb sceneRef={sceneRef} />
      </button>
      <LexionLabel onClick={handleClick} pulseRef={pillRef} />
    </div>
  );
}
