import { useState, useEffect, useRef, useCallback } from 'react';
import { Monitor, X, ExternalLink, Loader2, ChevronRight, AlertCircle, RefreshCw, Check, Phone, ShieldCheck, UserCheck } from 'lucide-react';
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
        isVersionAtLeast?: (ver: string) => boolean;
        setBackgroundColor?: (color: string) => void;
        setHeaderColor?: (color: string) => void;
        CloudStorage?: {
          setItem?: (key: string, value: string, cb: (success: boolean, error?: string) => void) => void;
          getItem?: (key: string, cb: (success: boolean, value: string | null, error?: string) => void) => void;
          removeItem?: (key: string, cb: (success: boolean, error?: string) => void) => void;
        };
      };
    };
  }
}

const LINKED_KEY = 'ff_miniapp_linked';

const MOBILE_PLATFORMS = ['ios', 'android', 'android_x'];
const DESKTOP_PLATFORMS = ['tdesktop', 'macos', 'weba', 'webk', 'unigram', 'web', 'unknown'];

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

export function isMobilePlatform(): boolean {
  try {
    const platform = safeGetPlatform();
    return MOBILE_PLATFORMS.includes(platform);
  } catch {
    return false;
  }
}

function isDesktopPlatform(): boolean {
  try {
    const platform = safeGetPlatform();
    return DESKTOP_PLATFORMS.includes(platform);
  } catch {
    return false;
  }
}

// --- Eslab qolish flag'lari ---
function setLinkedFlag() {
  try { localStorage.setItem(LINKED_KEY, '1'); } catch {}
  try {
    window.Telegram?.WebApp?.CloudStorage?.setItem?.(LINKED_KEY, '1', () => {});
  } catch {}
}

function clearLinkedFlag() {
  try { localStorage.removeItem(LINKED_KEY); } catch {}
  try {
    window.Telegram?.WebApp?.CloudStorage?.removeItem?.(LINKED_KEY, () => {});
  } catch {}
}

function getLinkedFlag(): boolean {
  try { return localStorage.getItem(LINKED_KEY) === '1'; } catch { return false; }
}

// --- "Kompyuterda sayt qulayroq" banneri ---
export function MiniAppDesktopBanner() {
  const [show, setShow] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState('');

  useEffect(() => {
    if (!isTelegramMiniApp()) return;
    if (isMobilePlatform()) return;
    if (!isDesktopPlatform()) return;
    setShow(true);
  }, []);

  const handleDismiss = () => {
    setShow(false);
  };

  const handleOpenSite = async () => {
    setHandoffLoading(true);
    setHandoffError('');
    try {
      const initData = safeGetInitData();
      if (!initData) {
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink('https://fanfaster.uz');
        } else {
          window.open('https://fanfaster.uz', '_blank');
        }
        return;
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/miniapp-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ initData }),
      });
      const data = await res.json();
      if (data?.handoffUrl) {
        if (window.Telegram?.WebApp?.openLink) {
          window.Telegram.WebApp.openLink(data.handoffUrl);
        } else {
          window.open(data.handoffUrl, '_blank');
        }
      } else {
        setHandoffError(data?.error || 'Xatolik yuz berdi');
      }
    } catch {
      setHandoffError('Tarmoq xatosi');
    } finally {
      setHandoffLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center gap-3 px-4 py-2.5 transition-transform duration-300"
      style={{
        background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
        color: 'white',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        paddingTop: 'calc(0.625rem + env(safe-area-inset-top))',
      }}
    >
      <Monitor className="h-5 w-5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.9)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">Kompyuterda sayt qulayroq</p>
      </div>
      <button
        onClick={handleOpenSite}
        disabled={handoffLoading}
        className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
        style={{ minHeight: '44px' }}
      >
        {handoffLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        {handoffLoading ? 'Yuklanmoqda...' : 'Saytda ochish'}
      </button>
      {handoffError && <span className="text-xs mr-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{handoffError}</span>}
      <button
        onClick={handleDismiss}
        className="text-white opacity-60 hover:opacity-100 hover:text-white transition"
        aria-label="Bannerni yopish"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// --- Welcome Sheet (faqat yangi foydalanuvchi) ---
function WelcomeSheet({ onContinue, state }: {
  onContinue: () => void;
  state: 'idle' | 'phone_sent' | 'phone_cancelled' | 'error' | 'success';
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const prefersReduced = useRef(false);

  useEffect(() => {
    try {
      prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handlePointer = useCallback((e: React.PointerEvent) => {
    if (prefersReduced.current) return;
    const x = (e.clientX / window.innerWidth - 0.5) * 8;
    const y = (e.clientY / window.innerHeight - 0.5) * 8;
    setParallax({ x, y });
  }, []);

  const handleSuccess = () => {
    setDismissed(true);
  };

  useEffect(() => {
    if (state === 'success') {
      const t = setTimeout(handleSuccess, 500);
      return () => clearTimeout(t);
    }
    if (state === 'error') {
      setErrorMsg('Bir narsa noto\'g\'ri ketdi. Iltimos, qayta urinib ko\'ring.');
    }
  }, [state]);

  if (dismissed) return null;

  const sheetStyle: React.CSSProperties = {
    transform: mounted ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  const logoStyle: React.CSSProperties = prefersReduced.current
    ? {}
    : {
        transform: `translate(${parallax.x}px, ${parallax.y}px)`,
        transition: 'transform 200ms ease-out',
      };

  const stagger = (i: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 400ms ease ${i * 60}ms, transform 400ms ease ${i * 60}ms`,
  });

  const phaseText = state === 'phone_sent'
    ? 'Profilingizni topish uchun Telegram\'dagi raqamingizni tasdiqlang'
    : state === 'error'
    ? errorMsg
    : 'Bir marta bosing, qolganini o\'zimiz qilamiz.';

  return (
    <div
      className="fixed inset-0 z-[210] overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 40%, #93c5fd 100%)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
      onPointerMove={handlePointer}
    >
      {/* Fon logotip — adolat tarozisi belgisi (ko'k kvadrat) */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          top: '12%',
          left: '50%',
          width: '40vw',
          maxWidth: '200px',
          aspectRatio: '1',
          transform: `translateX(-50%) translateY(${mounted ? '0' : '20px'})`,
          opacity: mounted ? 0.07 : 0,
          filter: 'blur(2px)',
          transition: 'opacity 800ms ease, transform 800ms ease',
          ...logoStyle,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-1/2 h-1/2" style={{ color: '#dbeafe' }}>
            <path d="M12 3v18M5 21h14M7 21V10M17 21V10M7 10a3 3 0 1 0-3-3M17 10a3 3 0 1 1 3-3"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-[2rem] overflow-hidden"
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 -8px 40px rgba(30, 58, 138, 0.15)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
          ...sheetStyle,
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1.5 rounded-full" style={{ background: '#cbd5e1' }} />
        </div>

        <div className="px-6 pb-2 space-y-5 max-w-sm mx-auto">
          {/* Chip */}
          <div style={stagger(1)} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide"
              style={{ background: 'rgba(30, 58, 138, 0.08)', color: '#1e3a8a' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4a017' }} />
              SIZ KUTGAN FORMATDAGI TA'LIM
            </span>
          </div>

          {/* Sarlavha */}
          <div style={stagger(2)}>
            <h2 className="text-2xl font-black leading-tight" style={{ fontFamily: 'Source Serif 4, Georgia, serif', color: '#1e293b' }}>
              FanFaster'ga{' '}
              <span style={{ fontStyle: 'italic', color: '#2563eb' }}>xush kelibsiz</span>
            </h2>
            <div className="mt-1 h-0.5 w-20 rounded-full" style={{ background: '#d4a017' }} />
          </div>

          {/* Matn */}
          <p style={stagger(3)} className="text-sm font-medium" >
            {phaseText}
          </p>

          {/* Ishonch qatorlari (faqat idle holatda) */}
          {state === 'idle' && (
            <div style={stagger(4)} className="space-y-2.5">
              {[
                { icon: UserCheck, text: 'Ism-familiya Telegramdan olinadi' },
                { icon: ShieldCheck, text: 'Parol va uzun forma yo\'q' },
                { icon: Phone, text: 'Profilingiz bor bo\'lsa, o\'sha ochiladi' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(37, 99, 235, 0.08)' }}>
                    <item.icon className="h-4 w-4" style={{ color: '#2563eb' }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: '#475569' }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tugma yoki holat */}
          <div style={stagger(5)}>
            {state === 'phone_sent' && (
              <div className="flex items-center justify-center gap-3 py-3">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#2563eb' }} />
                <span className="text-sm font-semibold" style={{ color: '#475569' }}>Kutilmoqda...</span>
              </div>
            )}

            {state === 'success' && (
              <div className="flex items-center justify-center gap-3 py-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
                  <Check className="h-5 w-5" style={{ color: '#22c55e' }} />
                </div>
                <span className="text-sm font-bold" style={{ color: '#1e293b' }}>Muvaffaqiyatli!</span>
              </div>
            )}

            {state === 'phone_cancelled' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-center" style={{ color: '#92400e' }}>
                  Raqamsiz davom etib bo'lmaydi
                </p>
                <button
                  onClick={onContinue}
                  className="w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition active:scale-[0.98]"
                  style={{ background: '#2563eb', color: '#fff', minHeight: '52px' }}
                >
                  Qayta urinish
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-center" style={{ color: '#475569' }}>
                  {errorMsg}
                </p>
                <button
                  onClick={onContinue}
                  className="w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition active:scale-[0.98]"
                  style={{ background: '#2563eb', color: '#fff', minHeight: '52px' }}
                >
                  Qayta urinish
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
            )}

            {state === 'idle' && (
              <button
                onClick={onContinue}
                className="w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                  color: '#fff',
                  minHeight: '52px',
                  boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)',
                }}
              >
                Davom etish
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Mayda matn */}
          <p style={stagger(6)} className="text-center text-xs" >
            <span style={{ color: '#94a3b8' }}>Telefon raqamingiz faqat profilingizni bog'lash uchun ishlatiladi.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Mini App Login Card (eski oddiy kartochka — endi faqat fallback) ---
function MiniAppLoginCard() {
  const { login } = useAuth();
  const [state, setState] = useState<'checking' | 'idle' | 'phone_sent' | 'phone_cancelled' | 'error' | 'success'>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const retryCountRef = useRef(0);
  const didCheckRef = useRef(false);
  const linkedFlag = useRef(getLinkedFlag());

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
        setLinkedFlag();
        try { sessionStorage.setItem('miniapp_autologin_done', '1'); } catch {}
        setState('success');
        return;
      }

      if (data?.status === 'need_phone') {
        if (!isPhoneRetry) {
          setState('idle');
        } else {
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

  // Checking holatida darhol initData ni yuboramiz
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

    const handleContact = (status: 'sent' | 'cancelled') => {
      if (status === 'sent') {
        setState('phone_sent');
        retryCountRef.current = 0;
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
    setState('idle');
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

  // checking — brend yuklanish ekrani (faqat spinner, kartochka yo'q)
  if (state === 'checking') {
    // Agar linked flag bor — brend yuklanish ekrani
    if (linkedFlag.current) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}
          >
            <span className="text-white font-black text-lg" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>F</span>
          </div>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#2563eb' }} />
        </div>
      );
    }
    // Linked flag yo'q — oddiy spinner
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // success — check animatsiyasi
  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-10">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
          <Check className="h-7 w-7" style={{ color: '#22c55e' }} />
        </div>
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
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertCircle className="h-7 w-7" style={{ color: '#92400e' }} />
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

  // idle — yangi foydalanuvchi: Welcome Sheet ko'rsatish
  return <WelcomeSheet onContinue={handleContinue} state={state} />;
}

// Mini app login overlay
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
  useEffect(() => {
    try {
      if (!isTelegramMiniApp()) return;
      const tg = window.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      try {
        tg?.setHeaderColor?.('#f8fafc');
        tg?.setBackgroundColor?.('#f8fafc');
      } catch {}
    } catch {}
  }, []);

  // Mini App ichida "Kompyuterda sayt qulayroq" banneri faqat telefon platformalarida
  return <MiniAppDesktopBanner />;
}

// Logout'da linked flag'ni tozalash uchun eksport
export { clearLinkedFlag, setLinkedFlag, getLinkedFlag };
