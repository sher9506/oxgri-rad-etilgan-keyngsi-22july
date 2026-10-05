import { useState, useEffect, useRef } from 'react';
import { Monitor, X, ExternalLink } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

// Telegram WebApp global type
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: any;
        platform?: string;
        ready?: () => void;
        expand?: () => void;
        openLink?: (url: string) => void;
        close?: () => void;
        onEvent?: (event: string, cb: () => void) => void;
        offEvent?: (event: string, cb: () => void) => void;
      };
    };
  }
}

// Desktop platformlar — mini app ichida banner ko'rsatamiz
const DESKTOP_PLATFORMS = ['tdesktop', 'macos', 'weba', 'webk', 'webz', 'web'];

function safeGetInitData(): string {
  try {
    return window.Telegram?.WebApp?.initData || '';
  } catch {
    return '';
  }
}

function safeGetPlatform(): string {
  try {
    return window.Telegram?.WebApp?.platform || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function isTelegramMiniApp(): boolean {
  try {
    return !!safeGetInitData();
  } catch {
    return false;
  }
}

export function isDesktopPlatform(): boolean {
  try {
    const platform = safeGetPlatform();
    return DESKTOP_PLATFORMS.includes(platform);
  } catch {
    return false;
  }
}

export default function MiniAppBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    try {
      if (!isTelegramMiniApp()) return;

      if (isDesktopPlatform()) {
        setShowBanner(true);
      }

      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
    } catch {
      // Telegram obyekti yo'q yoki xato bo'lsa — jim o'tamiz
    }
  }, []);

  const handleOpenSite = () => {
    setLoadingLink(true);
    try {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink('https://fanfaster.uz');
      } else {
        window.open('https://fanfaster.uz', '_blank');
      }
    } catch {
      window.open('https://fanfaster.uz', '_blank');
    } finally {
      setLoadingLink(false);
    }
  };

  if (!showBanner || dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3 px-4 py-2.5"
      style={{
        background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
        color: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      }}
    >
      <Monitor className="h-5 w-5 flex-shrink-0 text-white/90" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">Kompyuterda sayt qulayroq</p>
      </div>
      <button
        onClick={handleOpenSite}
        disabled={loadingLink}
        className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Saytda ochish
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-white/60 hover:text-white transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Mini app avtomatik kirish hook
export function useMiniAppAutoLogin(login: (user: any) => void) {
  const loginRef = useRef(login);
  loginRef.current = login;
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    let initData = '';
    try {
      initData = window.Telegram?.WebApp?.initData || '';
    } catch {
      return;
    }

    if (!initData) return;

    const sessionKey = 'miniapp_autologin_done';
    try {
      if (sessionStorage.getItem(sessionKey)) return;
    } catch {
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/telegram-miniapp-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ initData }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.talaba) {
            const t = data.talaba;
            loginRef.current({
              ism: t.ism,
              familiya: t.familiya,
              rol: 'oquvchi',
              guruh: t.guruh,
              kurs: t.kurs,
              login: t.login,
              talaba_id: t.id,
              tasdiqlangan: t.tasdiqlangan,
            });
            try {
              sessionStorage.setItem(sessionKey, '1');
            } catch {
              // storage yo'q bo'lsa — e'tibor bermaymiz
            }
          }
        }
      } catch {
        // Tarmoq xatosi — jim o'tamiz
      }
    })();
  }, []);
}
