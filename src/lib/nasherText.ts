import { useEffect, useState } from 'react';

// "manba" so'zi foydalanuvchiga tizim tafsilotini eslatadi — o'rniga "qonun hujjati" (qo'shimchalari saqlanadi).
// manbalar|da → qonun hujjatlari|da, manba|ga → qonun hujjati|ga, manbasi|da → qonun hujjati|da
const SOURCE_WORD = /\b(?:[Tt]aqdim etilgan |[Bb]erilgan )?[Mm]anba(lar)?(?:si)?(dagi|da|ga|dan|ni|ning)?\b/g;

export function stripSourceWords(text: string): string {
  return text.replace(SOURCE_WORD, (match: string, plural: string | undefined, suffix: string | undefined) =>
    `${match[0] === match[0].toUpperCase() ? 'Q' : 'q'}onun hujjat${plural ? 'lari' : 'i'}${suffix ?? ''}`);
}

// Lexion katalogidagi lex.uz hujjat nomlari (public/lex-names.json, ~3000 ta). Bir marta yuklanadi, keyin keshda.
let namesPromise: Promise<Record<string, string>> | null = null;

function loadLexNames(): Promise<Record<string, string>> {
  namesPromise ??= fetch('/lex-names.json')
    .then(r => (r.ok ? r.json() : {}))
    .catch((e) => {
      console.warn('[nasher] qonun nomlari yuklanmadi:', e);
      namesPromise = null;   // keyingi safar qayta urinadi
      return {};
    });
  return namesPromise;
}

export function useLexNames(enabled: boolean): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadLexNames().then(n => { if (alive) setNames(n); });
    return () => { alive = false; };
  }, [enabled]);
  return names;
}

export function lexDocName(url: string, names: Record<string, string>): string {
  const id = url.match(/\/docs\/(-?\d+)/)?.[1];
  return (id && names[id]) || (id ? `Qonun hujjati №${id.replace('-', '')}` : url);
}

// Javob matnini Claude kabi silliq "yozib" chiqaradi: ~2,5 s, so'z o'rtasida kesmaydi.
const typedIds = new Set<string>();   // chatlar orasida o'tganda qayta yozilmasin

export function useTypewriter(id: string, text: string, enabled: boolean): { shown: string; typing: boolean } {
  const active = enabled && !typedIds.has(id);
  const [count, setCount] = useState(active ? 0 : text.length);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!active || reduced) { setCount(text.length); typedIds.add(id); return; }
    const step = Math.max(6, Math.ceil(text.length / 150));
    let i = 0;
    let raf = 0;
    const tick = () => {
      i = Math.min(text.length, i + step);
      setCount(i);
      if (i < text.length) raf = requestAnimationFrame(tick);
      else typedIds.add(id);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, text, active]);

  if (count >= text.length) return { shown: text, typing: false };
  const space = text.lastIndexOf(' ', count);
  return { shown: text.slice(0, space > 0 ? space : count), typing: true };
}
