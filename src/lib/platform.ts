export type PlatformType = 'mobile' | 'desktop' | 'webview';

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent || '';
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const isWebView = /Telegram|Instagram|FBAN|FBAV/i.test(ua);

  // Telegram.WebApp initData bo'sh emas — ichki brauzer
  const tgWebApp = (window as any).Telegram?.WebApp;
  const hasTgInitData = tgWebApp?.initData && tgWebApp.initData.length > 0;

  if (isWebView || hasTgInitData) return 'webview';
  if (isMobileUA) return 'mobile';
  return 'desktop';
}
