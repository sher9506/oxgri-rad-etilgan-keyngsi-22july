// LexionAI — o'ng pastki burchakdagi jonli robotcha yordamchi
// Faqat jamoat sahifalarida render qilinadi (istisno sharti App.tsx da).
import { useCallback, useEffect, useRef } from 'react';
import './lexion.css';
import { LexionRobot } from './LexionRobot';
import { LexionLabel } from './LexionLabel';

interface LexionAIProps {
  onOpen?: () => void;
}

const FAR = 380; // px — shundan uzoqda to'liq burilish
const NEAR = 260; // px — shundan yaqinda "hayajon" (quloqchalar tez qimirlaydi)
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

    const onVis = () => root.classList.toggle('tab-hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    onVis();

    // Salomlashish: kirishdan keyin bir marta, so'ng har ~9s
    const wave = () => {
      if (document.hidden || busyRef.current) return;
      btn.classList.add('waving');
      timers.push(window.setTimeout(() => btn.classList.remove('waving'), 2100));
    };
    let waveId: number | undefined;
    if (!reduced) {
      timers.push(window.setTimeout(wave, 2000));
      waveId = window.setInterval(wave, 9000);
    }

    // Pointer: bosh kursor tomonga buriladi
    let raf = 0;
    let running = false;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.1;
      cur.y += (target.y - cur.y) * 0.1;
      // Faqat bosh bo'yin nuqtasi atrofida buriladi; tana deyarli qimirlamaydi — qismlar ajralmaydi
      scene.style.setProperty('--hx', (cur.x * 14).toFixed(2));
      scene.style.setProperty('--hy', (-cur.y * 8).toFixed(2));
      scene.style.setProperty('--hz', (cur.x * 2.5).toFixed(2));
      scene.style.setProperty('--hdx', (cur.x * 2.5).toFixed(2));
      scene.style.setProperty('--bx', (cur.x * 4).toFixed(2));
      const settled = Math.abs(target.x - cur.x) < 0.002 && Math.abs(target.y - cur.y) < 0.002;
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
      const dy = e.clientY - (r.top + r.height * 0.4); // bosh sathidan qaraydi
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
      if (waveId) window.clearInterval(waveId);
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
    btn?.classList.remove('waving');
    btn?.classList.add('respond');
    if (pill) {
      pill.classList.remove('pulse');
      void pill.offsetWidth;
      pill.classList.add('pulse');
    }
    onOpen?.();
    clickTimerRef.current = window.setTimeout(() => {
      btn?.classList.remove('respond');
      pill?.classList.remove('pulse');
      busyRef.current = false;
    }, 900);
  }, [onOpen]);

  return (
    <div ref={rootRef} className="lex-root">
      <button
        ref={btnRef}
        type="button"
        className="lex-btn"
        onClick={handleClick}
        aria-label="Lexion AI yordamchisi"
      >
        <span className="lex-shadow" aria-hidden="true" />
        <LexionRobot sceneRef={sceneRef} />
      </button>
      <LexionLabel onClick={handleClick} pulseRef={pillRef} />
    </div>
  );
}
