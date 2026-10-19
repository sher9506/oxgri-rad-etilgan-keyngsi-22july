import { useEffect, useMemo, useState } from 'react';

interface RevealState {
  id: string;
  text: string;
  count: number;
}

interface TypewriterResult {
  shown: string;
  typing: boolean;
}

const completedAnswers = new Map<string, string>();

/** Animate only fresh answers; history, hidden tabs and reduced motion render immediately. */
export function useTypewriter(id: string, text: string, enabled: boolean): TypewriterResult {
  const characters = useMemo(() => Array.from(text), [text]);
  const completed = completedAnswers.get(id) === text;
  const [reveal, setReveal] = useState<RevealState>({ id, text, count: 0 });

  useEffect(() => {
    let frame = 0;
    const finish = () => {
      completedAnswers.set(id, text);
      if (completedAnswers.size > 100) {
        const oldest = completedAnswers.keys().next().value;
        if (oldest !== undefined) completedAnswers.delete(oldest);
      }
      setReveal({ id, text, count: characters.length });
    };
    if (!enabled || !text) {
      setReveal({ id, text, count: characters.length });
      return;
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (completedAnswers.get(id) === text || motion.matches || document.hidden) {
      finish();
      return;
    }
    setReveal({ id, text, count: 0 });
    const duration = Math.min(2400, Math.max(200, characters.length * 2));
    const start = performance.now();
    let lastCount = 0;
    const tick = (now: number) => {
      const count = Math.min(characters.length, Math.floor((now - start) / duration * characters.length));
      if (count >= characters.length) { finish(); return; }
      if (count !== lastCount) {
        lastCount = count;
        setReveal({ id, text, count });
      }
      frame = requestAnimationFrame(tick);
    };
    const skipAnimation = () => {
      if (document.hidden || motion.matches) { cancelAnimationFrame(frame); finish(); }
    };
    document.addEventListener('visibilitychange', skipAnimation);
    motion.addEventListener('change', skipAnimation);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', skipAnimation);
      motion.removeEventListener('change', skipAnimation);
    };
  }, [id, text, enabled, characters]);

  const count = reveal.id === id && reveal.text === text ? reveal.count : 0;
  const typing = enabled && !completed && count < characters.length;
  return { shown: typing ? characters.slice(0, count).join('') : text, typing };
}
