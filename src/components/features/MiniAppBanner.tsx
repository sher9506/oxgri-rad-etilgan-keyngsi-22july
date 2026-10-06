import { useState, useEffect, useRef } from 'react';
import { Monitor, X, ExternalLink, Loader2, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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
        requestContact?: (cb: (status: 'sent' | 'cancelled', authRepeat?: boolean) => void) => void;
        setBackgroundColor?: (color: string) => void;
        setHeaderColor?: (color: string) => void;
      };
    };
  }
}

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

// "Davom etish" login kartochkasi — Mini App ichida login bo'lmaganda chiqadi
function MiniAppLoginCard() {
  const { login } = useAuth();
  const [state, setState] = useState<'checking' | 'idle' | 'phone_sent' | 'phone_cancelled' | 'error'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const retryCountRef = useRef(0);
  const didCheckRef = useRef(false);

  const callAuth = async (initData: string, isPhoneRetry = false) => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/telegram-miniapp-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ initData }),
      });

      const data = await res.json();

      if (res.ok && data?.success && data?.talaba) {
        const t = data.talaba;
        login({
          ism: t.ism,
          familiya: t.familiya,
          rol: 'oquvchi',
          guruh: t.guruh,
          kurs: t.kurs,
          login: t.login,
          talaba_id: t.id,
          tasdiqlangan: t.tasdiqlangan,
          telegram_linked: t.telegram_linked,
          google_linked: t.google_linked,
        });
        try { sessionStorage.setItem('miniapp_autologin_done', '1'); } catch {}
        return;
      }

      if (data?.status === 'need_phone') {
        if (!isPhoneRetry) {
          setState('idle');
        } else {
          // Phone retry — contact kelganidan keyin yana urindik lekin hali topilmadi
          retryCountRef.current++;
          if (retryCountRef.current < 5) {
            setTimeout(() => callAuth(initData, true), 1500);
          } else {
            setState('error');
            setErrorMsg('Profil topilmadi. Iltimos, saytda ro\'yxatdan o\'ting.');
          }
        }
        return;
      }

      if (data?.status === 'not_found') {
        setState('error');
        setErrorMsg('Talaba topilmadi. Saytda ro\'yxatdan o\'ting.');
        return;
      }

      setState('error');
      setErrorCode(data?.error_code || '');
      setErrorMsg(data?.error || 'Noma\'lum xatolik');
    } catch {
      setState('error');
      setErrorMsg('Tarmoq xatosi. Iltimos, qayta urinib ko\'ring.');
    }
  };

  // Checking holatida darhol initData ni yuboramiz — kartochka ko'rinmaydi
  useEffect(() => {
    if (didCheckRef.current) return;
    const initData = safeGetInitData();
    if (initData) {
      didCheckRef.current = true;
      callAuth(initData);
      return;
    }
    const timer = setTimeout(() => {
      const retryData = safeGetInitData();
      didCheckRef.current = true;
      if (retryData) {
        callAuth(retryData);
      } else {
        setState('idle');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const requestPhone = () => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.requestContact) {
      setState('error');
      setErrorMsg('Telegram versiyasi eskiroq. Iltimos, Telegramni yangilang.');
      return;
    }

    // contactRequested event'ini tinglash
    const handleContact = (status: 'sent' | 'cancelled') => {
      if (status === 'sent') {
        setState('phone_sent');
        retryCountRef.current = 0;
        // 1.5s kutib, auth'ni qayta chaqiramiz — contact bot orqali saqlangan bo'lishi kerak
        setTimeout(() => {
          const initData = safeGetInitData();
          if (initData) callAuth(initData, true);
        }, 1500);
      } else {
        setState('phone_cancelled');
      }
      tg.offEvent?.('contactRequested', handleContact as any);
    };

    tg.onEvent?.('contactRequested', handleContact as any);
    tg.requestContact(handleContact);
  };

  const handleContinue = () => {
    const initData = safeGetInitData();
    if (!initData) {
      setState('error');
      setErrorMsg('Telegram ma\'lumotlari topilmadi.');
      return;
    }
    requestPhone();
  };

  const handleRetry = () => {
    setErrorMsg('');
    setErrorCode('');
    setState('checking');
    retryCountRef.current = 0;
    didCheckRef.current = true;
    const initData = safeGetInitData();
    if (initData) {
      callAuth(initData);
    } else {
      setState('idle');
    }
  };

  if (state === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (state === 'phone_sent') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm font-semibold text-gray-600">Telefon tekshirilmoqda...</p>
      </div>
    );
  }

  if (state === 'phone_cancelled') {
    return (
      <div className="px-6 py-8 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-amber-600" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-700">Raqamsiz davom etib bo'lmaydi</p>
        <p className="text-xs text-gray-500">Telefon raqami profilni topish va himoya uchun kerak.</p>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition"
        >
          <RefreshCw className="h-4 w-4" /> Qayta urinish
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="px-6 py-8 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
        </div>
        <p className="text-sm font-bold text-gray-700">{errorMsg}</p>
        {errorCode && <p className="text-xs text-gray-400 font-mono">{errorCode}</p>}
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition"
        >
          <RefreshCw className="h-4 w-4" /> Qayta urinish
        </button>
      </div>
    );
  }

  // idle — need_phone tasdiqlangan, kartochka ko'rsatish
  return (
    <div className="px-6 py-8 space-y-5">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-black text-gray-800">FanFaster'ga xush kelibsiz</h2>
        <p className="text-sm text-gray-500">Bir marta bosing, qolganini o'zimiz qilamiz</p>
      </div>
      <button
        onClick={handleContinue}
        className="w-full h-13 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition shadow-lg shadow-blue-200 active:scale-[0.98]"
        style={{ minHeight: '52px' }}
      >
        Davom etish
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

// Mini app login overlay — login bo'lmagan foydalanuvchiga to'liq ekran ko'rsatadi
export function MiniAppLoginOverlay() {
  if (!isTelegramMiniApp()) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'var(--bg, #f8fafc)' }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-3xl bg-white shadow-2xl overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header banner */}
        <div
          className="px-6 py-5 text-white"
          style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black">FanFaster</span>
          </div>
        </div>
        <MiniAppLoginCard />
      </div>
    </div>
  );
}

export default function MiniAppBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loadingLink, setLoadingLink] = useState(false);

  useEffect(() => {
    try {
      if (!isTelegramMiniApp()) return;

      // Mini App ichida tg.ready() va tg.expand()
      const tg = window.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();

      // Header va background rangini sayt foni bilan moslash
      try {
        tg?.setHeaderColor?.('#f8fafc');
        tg?.setBackgroundColor?.('#f8fafc');
      } catch {}

      // Mini App ichida banner umuman ko'rsatilmaydi (skill talabi)
    } catch {}
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
        paddingTop: 'calc(2.5rem + env(safe-area-inset-top))',
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


