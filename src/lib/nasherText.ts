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

// Ruscha javob: havolalardan tashqari matnda kirill ko'p va ы/щ bor — lotinga o'girilmaydi (botdagi nasher-telegram.ts bilan bir xil)
export function isRussianAnswer(t: string): boolean {
  const plain = t.replace(/\[[^\]\n]*\]\([^)\s]*\)|https?:\/\/\S+/g, ' ');
  return /[ыщ]/i.test(plain) && (plain.match(/[а-яё]/gi) ?? []).length > (plain.match(/[a-z]/gi) ?? []).length;
}

export function latinizeMixed(text: string): string {
  if (isRussianAnswer(text)) return text;
  const cyr = (text.match(/[а-яёўқғҳ]/gi) ?? []).length;
  const lat = (text.match(/[a-z]/gi) ?? []).length;
  if (cyr === 0 || cyr > lat) return text;
  return text.replace(/[а-яёўқғҳА-ЯЁЎҚҒҲ'ʼ]+/g, w => (CYR_RE.test(w) ? latinWord(w) : w));
}

/** Ekranda ham, nusxada ham bir xil toza javob: lotin, "manba"siz, tinish belgisi oldida bo'sh joysiz. */
// NotebookLM ba'zan turkcha harf yozadi (parvariş): o'zbek lotin yozuviga o'tkaziladi
const TURKISH: Record<string, string> = { ş: 'sh', Ş: 'Sh', ç: 'ch', Ç: 'Ch', ğ: "g'", Ğ: "G'", ı: 'i', İ: 'I' };
export const fixTurkishLetters = (t: string) => t.replace(/[şŞçÇğĞıİ]/g, (c) => TURKISH[c]);
// AI so'z boshidagi "ye" ni "e" deb yozadi (echim, etarli, engil, etkaz-): 1995-yil imlo qoidasi — so'z boshida е → ye
export const fixYe = (t: string) => t.replace(/\b([Ee])(chim|tarli|ngil|tkaz)/g, (_m, e: string, rest: string) => (e === 'E' ? 'Ye' : 'ye') + rest);

// havola manzili ("#:~:text=…manba…") buzilmasin: "manba" faqat matnda almashtiriladi
const LINK_URL = /(\]\(https:\/\/lex\.uz\/[^)\s]+\))/;

// ── Yangi alifbo (O'RQ-1184, 21.10.2026): oʻ→ö, gʻ→ğ, sh→ş, ch→ç, tutuq belgisi → ’ (botdagi nasher-telegram.ts bilan bir xil) ──
// Faqat ko'rinadigan matn: havolalar (yorlig'i bilan — lex.uz hali eski alifboda), URL'lar, hujjat raqamlari (O'RQ-…) eski holicha qoladi.
const KEEP_RE = /(\[[^\]\n]{1,80}\]\(https?:\/\/[^)\s]+\)|<a href="[^"]*">[^<]*<\/a>|https?:\/\/\S+|\bO['ʻʼ‘’]RQ-[\w/-]+|NaSher|@\w+)/;
const APOS = "['ʻʼ‘’`´]";
const OG_RE = new RegExp(`([OoGg])${APOS}`, 'g');
const OG: Record<string, string> = { O: 'Ö', o: 'ö', G: 'Ğ', g: 'ğ' };
const SH_CH: Record<string, string> = { sh: 'ş', Sh: 'Ş', SH: 'Ş', ch: 'ç', Ch: 'Ç', CH: 'Ç' };

export function toNewAlphabet(text: string): string {
  return text.split(KEEP_RE).map((p, i) => i % 2 ? p : p
    .replace(OG_RE, (_m, l: string) => OG[l])
    .replace(/sh|Sh|SH|ch|Ch|CH/g, (m) => SH_CH[m])
    .replace(new RegExp(`(?<=\\p{L})${APOS}(?=\\p{L})`, 'gu'), '’')).join('');
}

export function prepareAnswer(raw: string): string {
  return toNewAlphabet(fixYe(latinizeMixed(fixTurkishLetters(raw))).split(LINK_URL)
    .map((p, i) => (i % 2 ? p : stripSourceWords(p).replace(/[ \t]+([.,;:!?])/g, '$1'))).join(''));
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
  return (id && names[id]) || (id ? `Qonun hujjati №${id.replace('-', '')}` : url);   // lex.uz nomlari eski alifboda qoladi
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
