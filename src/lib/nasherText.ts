import { useEffect, useState } from 'react';

// "manba" so'zi foydalanuvchiga tizim tafsilotini eslatadi — o'rniga "qonun hujjati" (qo'shimchalari saqlanadi).
// manbalar|da → qonun hujjatlari|da, manba|ga → qonun hujjati|ga, manbasi|da → qonun hujjati|da
const SOURCE_WORD = /\b(?:[Tt]aqdim etilgan |[Bb]erilgan )?[Mm]anba(lar)?(?:si)?(dagi|da|ga|dan|ni|ning)?\b/g;

export function stripSourceWords(text: string): string {
  return text.replace(SOURCE_WORD, (match: string, plural: string | undefined, suffix: string | undefined) =>
    `${match[0] === match[0].toUpperCase() ? 'Q' : 'q'}onun hujjat${plural ? 'lari' : 'i'}${suffix ?? ''}`);
}

// Javobdagi kirill bo'laklarini lotinga o'giradi (AI lex.uz dagi kirill iboralarni ko'chirib qo'yadi, prompt bilan to'liq to'xtamaydi).
// Matn asosan kirillda bo'lsa (masalan, ataylab ruscha), tegilmaydi.
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: "'", ы: 'i',
  ь: '', э: 'e', ю: 'yu', я: 'ya', ў: "o'", қ: 'q', ғ: "g'", ҳ: 'h',
};
const CYR_RE = /[а-яёўқғҳ]/i;
const VOWELS = 'аеёиоуўэюяaeiou';

function latinWord(word: string): string {
  const allCaps = word.length > 1 && word === word.toUpperCase();
  let out = '';
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const low = ch.toLowerCase();
    let lat: string;
    if (low === 'е') lat = i === 0 || VOWELS.includes(word[i - 1].toLowerCase()) || word[i - 1] === 'ъ' || word[i - 1] === 'ь' ? 'ye' : 'e';
    else lat = CYR[low] ?? ch;
    if (ch !== low) lat = allCaps ? lat.toUpperCase() : lat.charAt(0).toUpperCase() + lat.slice(1);
    out += lat;
  }
  return out;
}

export function latinizeMixed(text: string): string {
  const cyr = (text.match(/[а-яёўқғҳ]/gi) ?? []).length;
  const lat = (text.match(/[a-z]/gi) ?? []).length;
  if (cyr === 0 || cyr > lat) return text;
  return text.replace(/[а-яёўқғҳА-ЯЁЎҚҒҲ'ʼ]+/g, w => (CYR_RE.test(w) ? latinWord(w) : w));
}

/** Ekranda ham, nusxada ham bir xil toza javob: lotin, "manba"siz, tinish belgisi oldida bo'sh joysiz. */
// NotebookLM ba'zan turkcha harf yozadi (parvariş): o'zbek lotin yozuviga o'tkaziladi
const TURKISH: Record<string, string> = { ş: 'sh', Ş: 'Sh', ç: 'ch', Ç: 'Ch', ğ: "g'", Ğ: "G'", ı: 'i', İ: 'I' };
export const fixTurkishLetters = (t: string) => t.replace(/[şŞçÇğĞıİ]/g, (c) => TURKISH[c]);

export function prepareAnswer(raw: string): string {
  return stripSourceWords(latinizeMixed(fixTurkishLetters(raw))).replace(/[ \t]+([.,;:!?])/g, '$1');
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
