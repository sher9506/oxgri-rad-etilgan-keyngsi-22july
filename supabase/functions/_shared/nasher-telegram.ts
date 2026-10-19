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

export function prepareAnswer(raw: string): string {
  let t = raw.replace(/\r\n/g, "\n");
  const cyr = (t.match(/[а-яёўқғҳ]/gi) ?? []).length;
  const lat = (t.match(/[a-z]/gi) ?? []).length;
  if (cyr > 0 && cyr <= lat) t = t.replace(/[а-яёўқғҳА-ЯЁЎҚҒҲ'ʼ]+/g, (w) => (/[а-яёўқғҳ]/i.test(w) ? latinWord(w) : w));
  t = t.replace(SOURCE_WORD, (m: string, plural?: string, suffix?: string) =>
    `${m[0] === m[0].toUpperCase() ? "Q" : "q"}onun hujjat${plural ? "lari" : "i"}${suffix ?? ""}`);
  return t.replace(/[ \t]+([.,;:!?])/g, "$1").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Telegram HTML ──

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Javob matnini Telegram HTML'ga o'tkazadi: sarlavhalar va **qalin** -> <b>, ro'yxat belgilari -> •. */
export function toTelegramHtml(text: string): string {
  return text.split("\n").map((line) => {
    const t = line.trim();
    if (!t) return "";
    const heading = t.match(/^#{1,6}\s*(.+)$/);
    if (heading) return `<b>${esc(heading[1].replace(/\*\*/g, ""))}</b>`;
    let s = esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^[-*•]\s+/, "• ");
    // "ISSUE (Huquqiy masala)" kabi qisqa, nuqtasiz yakka qator — sarlavha
    if (t.length <= 70 && !/[.,;:!?]$/.test(t) && !/^[-*•\d]/.test(t) && !s.includes("<b>")) s = `<b>${s}</b>`;
    return s;
  }).join("\n").replace(/\n{3,}/g, "\n\n");
}

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

export async function tg(token: string, method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: any; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  return await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
}

