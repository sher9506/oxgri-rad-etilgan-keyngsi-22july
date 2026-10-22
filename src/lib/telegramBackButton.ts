// Telegram Mini App'ning o'z "Orqaga" tugmasi (to'liq ekranda chap yuqoridagi "Yopish" o'rnida chiqadi).
// onBack berilsa — tugma ko'rinadi va shu ishni bajaradi; null — bu komponent tugmaga tegmaydi
// (boshqa komponent uni ishlatayotgan bo'lishi mumkin). Telegram'dan tashqarida (saytda) hech narsa qilmaydi.
import { useEffect, useRef } from 'react';

interface TgBackButton { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void }

const backButton = (): TgBackButton | undefined =>
  (window as unknown as { Telegram?: { WebApp?: { initData?: string; BackButton?: TgBackButton } } }).Telegram?.WebApp?.initData
    ? (window as unknown as { Telegram: { WebApp: { BackButton?: TgBackButton } } }).Telegram.WebApp.BackButton
    : undefined;

export function useTelegramBackButton(onBack: (() => void) | null) {
  const ref = useRef(onBack);
  ref.current = onBack;
  const active = !!onBack;
  useEffect(() => {
    const bb = backButton();
    if (!bb || !active) return;
    const handler = () => ref.current?.();
    bb.onClick(handler);
    bb.show();
    return () => { bb.offClick(handler); bb.hide(); };
  }, [active]);
}
