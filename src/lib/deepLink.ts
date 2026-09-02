/**
 * deepLink.ts — Universal Deep-Linking va PostMessage tizimi
 *
 * YUBORUVCHI: sayt ichida navigatsiya bo'lganda parent oynaga xabar yuboradi
 * QABUL QILUVCHI: tashqaridan ?tab=... yoki postMessage orqali kelib tushgan
 *                 havolani bo'laklarga ajratib, tegishli joyni ochadi
 */

// ── TAB NOMI → CLEAN PATH XARITASI ───────────────────────────────────────────
export const TAB_PATHS: Record<string, string> = {
  haqida: 'haqida',
  sinov: 'sinov',
  natijalar: 'natijalar',
  mavjud_testlar: 'testlar',
  mavjud_kazuslar: 'kazuslar',
  oqmatlar: 'oqmatlar',
  savol_javob: 'savol-javob',
  profil: 'profil',
  reyting: 'reyting',
  ustoz: 'ustoz',
  testlar: 'testlar-kabineti',
  royhat: 'royhat',
  yordam: 'yordam',
};

// TESKARI XARITA: path → activeTab
export const PATH_TO_TAB: Record<string, string> = {
  haqida: 'haqida',
  sinov: 'sinov',
  natijalar: 'natijalar',
  testlar: 'mavjud_testlar',
  test: 'mavjud_testlar',
  kazuslar: 'mavjud_kazuslar',
  keyslar: 'mavjud_kazuslar',
  keys: 'mavjud_kazuslar',
  oqmatlar: 'oqmatlar',
  materiallar: 'oqmatlar',
  'savol-javob': 'savol_javob',
  'savol-javoblar': 'savol_javob',
  sj: 'savol_javob',
  profil: 'profil',
  reyting: 'reyting',
  ustoz: 'ustoz',
  'testlar-kabineti': 'testlar',
  royhat: 'royhat',
  yordam: 'yordam',
};

// ── TOZA PATH OLISH ───────────────────────────────────────────────────────────
/**
 * Joriy URL dan onspace editor parametrlarini tozalab, toza path qaytaradi
 * Masalan: "?_q=abc&tab=oqmatlar" → "oqmatlar"
 */
export function getCurrentCleanPath(activeTab: string, subPath?: string): string {
  const base = TAB_PATHS[activeTab] || activeTab;
  if (subPath) return `${base}/${subPath}`;
  return base;
}

// ── PARENT OYNAGA XABAR YUBORISH ─────────────────────────────────────────────
/**
 * Navigatsiya o'zgarganda tashqi Netlify/iframe oynasiga xabar yuboradi.
 * window.parent === window bo'lsa (iframe ichida emas), xabar yuborilmaydi.
 */
export function postRouteChange(path: string): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: 'route-change', tab: path }, '*');
  }
  // Brauzer URL ni ham yangilaymiz (iframe ichida bo'lmasa)
  if (window.parent === window) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', path);
      window.history.replaceState({}, '', url.toString());
    } catch {}
  }
}

// ── URL DAN DEEP-LINK O'QISH ─────────────────────────────────────────────────
/**
 * URL dagi ?tab=... parametrini o'qib, { activeTab, subPath } qaytaradi
 *
 * Misollar:
 *   ?tab=oqmatlar                 → { activeTab: 'oqmatlar', subPath: null }
 *   ?tab=oqmatlar/bolim-id/fayl-id → { activeTab: 'oqmatlar', subPath: 'bolim-id/fayl-id' }
 *   ?tab=testlar/test-kodi        → { activeTab: 'mavjud_testlar', subPath: 'test-kodi' }
 *   ?tab=keyslar/keys-kodi        → { activeTab: 'mavjud_kazuslar', subPath: 'keys-kodi' }
 */
export interface DeepLinkResult {
  activeTab: string;
  subPath: string | null;
  parts: string[];
}

export function parseDeepLink(): DeepLinkResult | null {
  try {
    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get('tab');
    if (!tabParam) return null;

    const parts = tabParam.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    const rootPath = parts[0];
    const subParts = parts.slice(1);
    const subPath = subParts.length > 0 ? subParts.join('/') : null;

    // Path → activeTab xaritasidan topish
    const activeTab = PATH_TO_TAB[rootPath] || rootPath;

    return { activeTab, subPath, parts };
  } catch {
    return null;
  }
}

// ── POSTMESSAGE LISTENER SETUP ────────────────────────────────────────────────
/**
 * Tashqi oynadan (Netlify parent) kelgan navigate xabarlarini tinglaydi.
 * callback(activeTab, subPath) — navigatsiya qilish uchun chaqiriladi
 */
export function setupPostMessageListener(
  callback: (activeTab: string, subPath: string | null) => void
): () => void {
  const handler = (event: MessageEvent) => {
    if (!event.data || typeof event.data !== 'object') return;

    // navigate: oddiy sahifa o'tish
    if (event.data.type === 'navigate') {
      const tabParam: string = event.data.tab || '';
      if (!tabParam) return;

      const parts = tabParam.split('/').filter(Boolean);
      if (parts.length === 0) return;

      const rootPath = parts[0];
      const subParts = parts.slice(1);
      const subPath = subParts.length > 0 ? subParts.join('/') : null;
      const activeTab = PATH_TO_TAB[rootPath] || rootPath;

      callback(activeTab, subPath);
      return;
    }

    // auto-start: test/kazus 5 xonali kod avtomatik boshlash
    if (event.data.type === 'auto-start') {
      const { kod, tur } = event.data;
      if (!kod) return;
      const tab = tur === 'kazus' ? 'mavjud_kazuslar' : 'mavjud_testlar';
      callback(tab, kod);
      // Avtomatik boshlash eventini dispatch qilamiz
      setTimeout(() => {
        if (tur === 'kazus') {
          window.dispatchEvent(new CustomEvent('deeplink-keys', { detail: { kod } }));
        } else {
          window.dispatchEvent(new CustomEvent('deeplink-test', { detail: { kod } }));
        }
        // SinovBoshlash da ham ishlashi uchun
        window.dispatchEvent(new CustomEvent('auto-start-kod', { detail: { kod } }));
      }, 400);
      return;
    }

    // deeplink-sj: savol-javob bo'lim/bob ochish
    if (event.data.type === 'deeplink-sj') {
      callback('savol_javob', event.data.bolimId || null);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('deeplink-sj', {
          detail: { bolimId: event.data.bolimId, bobId: event.data.bobId }
        }));
      }, 400);
      return;
    }
  };

  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

// ── O'QUV MATERIALLARI UCHUN YORDAMCHI ────────────────────────────────────────
/**
 * subPath = "bolim-id" yoki "bolim-id/bob-id" yoki "bolim-id/bob-id/material-id"
 * Parchalangan qismlarni qaytaradi
 */
export function parseOqMatSubPath(subPath: string): {
  bolimId: string | null;
  bobId: string | null;
  materialId: string | null;
} {
  const parts = subPath.split('/').filter(Boolean);
  return {
    bolimId: parts[0] || null,
    bobId: parts[1] || null,
    materialId: parts[2] || null,
  };
}

// ── TEST / KAZUS UCHUN YORDAMCHI ─────────────────────────────────────────────
/**
 * subPath = "test-kodi" → { kod: "test-kodi" }
 */
export function parseTestSubPath(subPath: string): { kod: string | null } {
  const parts = subPath.split('/').filter(Boolean);
  return { kod: parts[0] || null };
}
