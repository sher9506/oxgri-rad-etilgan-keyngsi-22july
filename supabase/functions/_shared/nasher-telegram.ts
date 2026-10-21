// NaSher AI Telegram boti uchun umumiy yordamchilar (nasher-bot va nasher-bot-dispatch ishlatadi).
// Deno API'siz yozilgan — node bilan ham sinab bo'ladi.

export const TG_ID_PREFIX = "tg_";

/** Bot foydalanuvchisi uchun taxmin qilib bo'lmaydigan ID: tg_ + HMAC(server kaliti, telegram id).
 *  Oddiy telegram id ishlatilsa, birov boshqaning id'sini yozib uning suhbat tarixini o'qiy olardi. */
export async function tgUserKey(secret: string, telegramId: number | string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`nasher-tg:${telegramId}`)));
  return TG_ID_PREFIX + [...sig.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Telegram Mini App initData imzosini tekshiradi (rasmiy algoritm). To'g'ri bo'lsa foydalanuvchi id'sini qaytaradi. */
export async function verifyInitData(initData: string, botToken: string, maxAgeSec = 86400): Promise<number | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const enc = new TextEncoder();
  const hmac = async (key: Uint8Array, msg: string) => {
    const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
  };
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const calc = [...(await hmac(secret, dataCheck))].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (calc !== hash) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) return null;
  try {
    const user = JSON.parse(params.get("user") || "{}");
    return typeof user.id === "number" ? user.id : null;
  } catch {
    return null;
  }
}

// ── Javob matnini tozalash (saytdagi src/lib/nasherText.ts bilan bir xil qoidalar) ──

const LINK_URL = /(\]\(https:\/\/lex\.uz\/[^)\s]+\))/;
const SOURCE_WORD = /\b(?:[Tt]aqdim etilgan |[Bb]erilgan )?[Mm]anba(lar)?(?:si)?(dagi|da|ga|dan|ni|ning)?\b/g;
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "'", ы: "i",
  ь: "", э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h",
};
const VOWELS = "аеёиоуўэюяaeiou";

function latinWord(word: string): string {
  const allCaps = word.length > 1 && word === word.toUpperCase();
  let out = "";
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const low = ch.toLowerCase();
    let lat: string;
    if (low === "е") lat = i === 0 || VOWELS.includes(word[i - 1].toLowerCase()) || word[i - 1] === "ъ" || word[i - 1] === "ь" ? "ye" : "e";
    else lat = CYR[low] ?? ch;
    if (ch !== low) lat = allCaps ? lat.toUpperCase() : lat.charAt(0).toUpperCase() + lat.slice(1);
    out += lat;
  }
  return out;
}

// NotebookLM ba'zan turkcha harf yozadi (parvariş): o'zbek lotin yozuviga o'tkaziladi (saytdagi nasherText.ts bilan bir xil)
const TURKISH: Record<string, string> = { ş: "sh", Ş: "Sh", ç: "ch", Ç: "Ch", ğ: "g'", Ğ: "G'", ı: "i", İ: "I" };

export function prepareAnswer(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n").replace(/[şŞçÇğĞıİ]/g, (c) => TURKISH[c]);
  const cyr = (t.match(/[а-яёўқғҳ]/gi) ?? []).length;
  const lat = (t.match(/[a-z]/gi) ?? []).length;
  if (cyr > 0 && cyr <= lat) t = t.replace(/[а-яёўқғҳА-ЯЁЎҚҒҲ'ʼ]+/g, (w) => (/[а-яёўқғҳ]/i.test(w) ? latinWord(w) : w));
  // AI so'z boshidagi "ye" ni "e" deb yozadi (echim, etarli, engil, etkaz-): imlo qoidasi — so'z boshida е → ye (saytdagi fixYe bilan bir xil)
  t = t.replace(/\b([Ee])(chim|tarli|ngil|tkaz)/g, (_m, e: string, rest: string) => (e === "E" ? "Ye" : "ye") + rest);
  // havola manzili ("#:~:text=…manba…") buzilmasin: "manba" faqat matnda almashtiriladi
  t = t.split(LINK_URL).map((p, i) => (i % 2 ? p : p.replace(SOURCE_WORD, (m: string, plural?: string, suffix?: string) =>
    `${m[0] === m[0].toUpperCase() ? "Q" : "q"}onun hujjat${plural ? "lari" : "i"}${suffix ?? ""}`))).join("");
  return t.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Telegram HTML ──

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Saytdagi AnswerText.dedupeLinks bilan bir xil qoida (havolalar ko'payib ketmasin):
// bir xil havola faqat birinchi marta; ko'rsatilgan moddaning tugmasi yo'q; Plenum/hujjat tugmasi abzatsda bir marta.
const CITE_CHIP = /^(\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*-modda|Plenum №\d+|[A-Z][A-Z']{0,4}-\d[\w/-]*|№[\w/-]+|lex\.uz)$/;

export function dedupeLinks(text: string): string {
  const seen = new Set<string>();
  return text.split(/(\n\s*\n)/).map((para) => {
    const docChips = new Set<string>();
    return para.replace(/(, )?\[([^\]\n]{1,40})\]\((https:\/\/lex\.uz\/[^)\s]+)\)/g, (m, sep: string | undefined, label: string, href: string) => {
      const chip = CITE_CHIP.test(label);
      if (chip && !/^\d/.test(label)) {
        const doc = href.split("#")[0];
        if (docChips.has(doc)) return "";
        docChips.add(doc);
        return m;
      }
      if (seen.has(href)) return chip ? "" : (sep ?? "") + label;
      seen.add(href);
      return m;
    }).replace(/(\s), (?=\[)/g, "$1").replace(/[ \t]+([.,;:!?])/g, "$1");
  }).join("");
}

/** Javob matnini Telegram HTML'ga o'tkazadi: sarlavhalar va **qalin** -> <b>, ro'yxat belgilari -> •. */
export function toTelegramHtml(text: string): string {
  return dedupeLinks(text).split("\n").map((line) => {
    const t = line.trim();
    if (!t) return "";
    const heading = t.match(/^#{1,6}\s*(.+)$/);
    if (heading) return `<b>${esc(heading[1].replace(/\*\*/g, ""))}</b>`;
    let s = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^[-*•]\s+/, "• ")
      .replace(/\[([^\]\n]{1,40})\]\((https:\/\/lex\.uz\/[^)\s"]+)\)/g, '<a href="$2">$1</a>');   // modda havolalari
    // "ISSUE (Huquqiy masala)" kabi qisqa, nuqtasiz yakka qator — sarlavha
    if (t.length <= 70 && !/[.,;:!?]$/.test(t) && !/^[-*•\d]/.test(t) && !s.includes("<b>")) s = `<b>${s}</b>`;
    return s;
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}

/** HTML yuborilmasa — oddiy matn: havola "yorliq (manzil)" bo'lib qoladi. */
export const htmlToPlain = (html: string) => html.replace(/<a href="([^"]+)">([^<]*)<\/a>/g, "$2 ($1)")
  .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** Telegram 4096 belgi chegarasi: bo'limlar (bo'sh qator) bo'yicha bo'ladi, teglar uzilmaydi. */
export function splitMessage(html: string, limit = 3900): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const block of html.split("\n\n")) {
    const pieces = block.length > limit ? block.split("\n") : [block];
    for (const p of pieces) {
      const sep = cur ? (pieces.length > 1 ? "\n" : "\n\n") : "";
      if ((cur + sep + p).length > limit && cur) {
        parts.push(cur);
        cur = p;
      } else {
        cur += sep + p;
      }
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

export function lawLinks(urls: string[], names: Record<string, string>): string {
  const items = urls.slice(0, 15).map((u) => {
    const id = u.match(/\/docs\/(-?\d+)/)?.[1];
    const name = (id && names[id]) || (id ? `Qonun hujjati №${id.replace("-", "")}` : u);
    const href = id ? `https://lex.uz/docs/${id}` : u;
    return `• <a href="${esc(href)}">${esc(name.length > 90 ? name.slice(0, 88) + "…" : name)}</a>`;
  });
  return items.length ? `📚 <b>Qonun hujjatlari</b>\n${items.join("\n")}` : "";
}

// ── Yangi alifbo (O'RQ-1184, 21.10.2026): oʻ→ö, gʻ→ğ, sh→ş, ch→ç, tutuq belgisi → ’ (saytdagi nasherText.toNewAlphabet bilan bir xil) ──
// Faqat ko'rinadigan matn: havolalar (yorlig'i bilan — lex.uz hali eski alifboda), URL'lar, hujjat raqamlari (O'RQ-…) eski holicha qoladi.
const KEEP_RE = /(\[[^\]\n]{1,80}\]\(https?:\/\/[^)\s]+\)|<a href="[^"]*">[^<]*<\/a>|https?:\/\/\S+|\bO['ʻʼ‘’]RQ-[\w/-]+|NaSher|@\w+)/;
const APOS = "['ʻʼ‘’`´]";
const OG_RE = new RegExp(`([OoGg])${APOS}`, "g");
const OG: Record<string, string> = { O: "Ö", o: "ö", G: "Ğ", g: "ğ" };
const SH_CH: Record<string, string> = { sh: "ş", Sh: "Ş", SH: "Ş", ch: "ç", Ch: "Ç", CH: "Ç" };

export function toNewAlphabet(text: string): string {
  return text.split(KEEP_RE).map((p, i) => i % 2 ? p : p
    .replace(OG_RE, (_m, l: string) => OG[l])
    .replace(/sh|Sh|SH|ch|Ch|CH/g, (m) => SH_CH[m])
    .replace(new RegExp(`(?<=\\p{L})${APOS}(?=\\p{L})`, "gu"), "’")).join("");
}

/** Bot yozadigan har bir matn (xabar, tugma, callback) yangi alifboda chiqadi. */
function newAlphabetBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  if (typeof out.text === "string") out.text = toNewAlphabet(out.text);
  const rm = out.reply_markup as { inline_keyboard?: { text: string }[][] } | undefined;
  if (rm?.inline_keyboard) {
    out.reply_markup = { ...rm, inline_keyboard: rm.inline_keyboard.map((row) => row.map((b) => ({ ...b, text: toNewAlphabet(b.text) }))) };
  }
  return out;
}

export async function tg(token: string, method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: any; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newAlphabetBody(body)),
    signal: AbortSignal.timeout(20_000),
  });
  return await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
}


// ── Kutish xabari: har 8 s da yangilanadi (o'tgan vaqt, progress, bosqichlar, maslahat) ──
const WAIT_TIPS = [
  "💡 Kutib o'tirmang — javob tayyor bo'lganda o'zim yozaman.",
  "💡 Keyingi savolingizda oldingilarini eslayman (suhbat 5 soat).",
  "💡 Javobdagi qonun nomini bossangiz, lex.uz da o'sha hujjat ochiladi.",
  "💡 Qisqa yoki tezkor javob kerak bo'lsa — «NaSher AI» ilovasini oching.",
  "💡 Vaziyatni aniqroq yozsangiz (kim, qachon, nima bo'ldi), javob ham aniqroq bo'ladi.",
];
const EXPECTED_SEC = 180;

export function progressText(elapsedSec: number, phase: "searching" | "reading", found = 0): string {
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-elapsedSec / (EXPECTED_SEC / 2.2)))));
  const filled = Math.round(pct / 10);
  const mm = Math.floor(elapsedSec / 60), ss = String(elapsedSec % 60).padStart(2, "0");
  const writing = phase === "reading" && elapsedSec > 0;
  const steps = [
    "✅ Savol qabul qilindi",
    phase === "reading" ? `✅ Qonun hujjatlari topildi${found ? ` (${found} ta)` : ""}` : "🔎 Kerakli qonun hujjatlari izlanmoqda…",
    writing ? "✍️ Hujjatlar o'qilmoqda, javob yozilmoqda…" : "▫️ Javob yoziladi",
  ];
  return `⏳ <b>Javob tayyorlanmoqda</b> · ${mm}:${ss}\n\n${"▰".repeat(filled)}${"▱".repeat(10 - filled)}  ${pct}%\n\n` +
    steps.join("\n") + `\n\n<i>${WAIT_TIPS[Math.floor(elapsedSec / 20) % WAIT_TIPS.length]}</i>`;
}

/** Mini App manzili + aniq suhbat (?nasher_app=1&chat=...) */
export function chatAppUrl(miniUrl: string, chatId?: string | null): string {
  if (!miniUrl || !chatId) return miniUrl;
  return miniUrl + (miniUrl.includes("?") ? "&" : "?") + "chat=" + encodeURIComponent(chatId);
}
