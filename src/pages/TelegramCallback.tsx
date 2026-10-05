/**
 * TelegramCallback — /telegram-callback?token=XXX
 *
 * Token POST bilan edge function'ga yuboriladi (GET emas — Telegram link preview
 * havolani o'zi ochib yeb qo'yishi mumkin). Edge function atomik ravishda
 * used_at o'rnatib, talaba ma'lumotlarini qaytaradi.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { CheckCircle, Loader2, XCircle, RefreshCw, MessageCircle, ArrowLeft } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type TgCallbackState = 'loading' | 'polling' | 'success' | 'expired' | 'used' | 'error';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 3000;

export default function TelegramCallback() {
  const { login } = useAuth();
  const [state, setState] = useState<TgCallbackState>('loading');
  const [message, setMessage] = useState('Token tekshirilmoqda...');
  const [pollCount, setPollCount] = useState(0);
  const [userName, setUserName] = useState('');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triedRef = useRef(false);
  const consumedRef = useRef(false);

  const token = new URLSearchParams(window.location.search).get('token') || '';

  const clearTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const doLogin = useCallback(
    (sessionData: { ism: string; familiya: string; guruh: string; kurs: string; login_id: string }) => {
      clearTimer();
      const user = {
        ism: sessionData.ism || 'Foydalanuvchi',
        familiya: sessionData.familiya || '',
        rol: 'oquvchi' as const,
        guruh: sessionData.guruh || '',
        kurs: sessionData.kurs || '',
        login: sessionData.login_id || sessionData.ism,
      };
      login(user);
      setUserName(`${user.familiya} ${user.ism}`.trim());
      setState('success');
      setMessage('Muvaffaqiyatli kirdingiz!');
      setTimeout(() => {
        window.location.replace('https://fanfaster.uz');
      }, 2200);
    },
    [login, clearTimer]
  );

  const consumeToken = useCallback(
    async (attempt: number) => {
      if (!token) {
        setState('error');
        setMessage("URL da token topilmadi. Saytdan qaytadan urinib ko'ring.");
        return;
      }

      // Birinchi urinishda POST bilan token sarflash
      if (attempt === 0 && !consumedRef.current) {
        consumedRef.current = true;
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/telegram-login-callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({ token }),
          });

          if (res.status === 410) {
            const data = await res.json();
            if (data?.error?.includes('ishlatilgan')) {
              setState('used');
              setMessage('Bu havola allaqachon ishlatilgan. Yangi kirish uchun saytga boring.');
            } else {
              setState('expired');
              setMessage('Havola muddati tugagan. Iltimos saytda qaytadan urinib ko\'ring.');
            }
            return;
          }

          if (res.status === 404) {
            setState('expired');
            setMessage('Token topilmadi. Saytdan qaytadan urinib ko\'ring.');
            return;
          }

          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.session) {
              doLogin(data.session);
              return;
            }
            if (data?.status === 'pending') {
              // Hali bot tasdiqlamagan — polling ga o'tamiz
            }
          }
        } catch {
          // Tarmoq xatosi — polling ga o'tamiz
        }
      }

      // Polling: token hali pending bo'lsa qayta urinamiz
      if (attempt >= MAX_POLLS) {
        setState('error');
        setMessage('Telegram botdan tasdiqlash kelmadi. Botga o\'ting va telefon raqamingizni ulashing.');
        return;
      }

      setState('polling');
      setMessage(`Bot javobi kutilmoqda... (${attempt + 1}/${MAX_POLLS})`);
      setPollCount(attempt + 1);

      pollTimerRef.current = setTimeout(() => {
        // Qayta POST qilamiz — edge function used_at ni tekshiradi
        fetch(`${supabaseUrl}/functions/v1/telegram-login-callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ token }),
        })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              if (data?.success && data?.session) {
                doLogin(data.session);
                return;
              }
            }
            consumeToken(attempt + 1);
          })
          .catch(() => consumeToken(attempt + 1));
      }, POLL_INTERVAL_MS);
    },
    [token, doLogin]
  );

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    consumeToken(0);
    return () => clearTimer();
  }, [consumeToken, clearTimer]);

  const goBack = () => {
    window.location.replace('https://fanfaster.uz');
  };

  const progressPct = state === 'polling' ? Math.round((pollCount / MAX_POLLS) * 100) : 0;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div
        className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

        <div className="px-8 py-10 text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                boxShadow: '0 0 32px rgba(99,102,241,0.4)',
              }}
            >
              {state === 'loading' || state === 'polling' ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : state === 'success' ? (
                <CheckCircle className="h-8 w-8 text-white" />
              ) : (
                <XCircle className="h-8 w-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                {state === 'success' ? 'Kirish muvaffaqiyatli!' : 'Telegram orqali kirish'}
              </h1>
              <p className="text-xs text-blue-300 font-semibold mt-0.5">FanFaster.uz</p>
            </div>
          </div>

          {(state === 'loading' || state === 'polling') && (
            <div className="space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
                <p className="text-sm text-blue-100 font-medium leading-relaxed">{message}</p>
              </div>
              {state === 'polling' && (
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 text-right font-mono">{pollCount}/{MAX_POLLS}</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-blue-300/70 text-xs justify-center">
                <MessageCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Telegram botga o'tib telefon raqamingizni ulashing</span>
              </div>
            </div>
          )}

          {state === 'success' && (
            <div className="space-y-4">
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-4 space-y-1">
                {userName && <p className="text-base font-black text-emerald-300">{userName}</p>}
                <p className="text-sm text-emerald-200/80">Bosh sahifaga yo'naltirilmoqda...</p>
              </div>
              <div className="flex justify-center">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {(state === 'expired' || state === 'used' || state === 'error') && (
            <div className="space-y-4">
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-4">
                <p className="text-sm text-red-200 leading-relaxed">{message}</p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={goBack}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Saytga qaytish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
