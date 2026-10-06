import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Check, X, AlertCircle, ShieldCheck, Users, RefreshCw, ChevronRight, Link2 } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        platform?: string;
        ready?: () => void;
        expand?: () => void;
        openLink?: (url: string) => void;
        openTelegramLink?: (url: string) => void;
        close?: () => void;
        setBackgroundColor?: (color: string) => void;
        setHeaderColor?: (color: string) => void;
      };
    };
  }
}

type ConfirmState = 'loading' | 'need_channel' | 'confirm' | 'success' | 'rejected' | 'error_expired' | 'error_used' | 'error_generic' | 'error_not_found';

interface ConflictData {
  asosiy: { id: string; ism: string; familiya: string; google_email_masked: string; telegram_username: string; telegram_ism: string; created_at: string } | null;
  birlashgan: { id: string; ism: string; familiya: string; google_email_masked: string; telegram_username: string; telegram_ism: string; created_at: string } | null;
}

export default function MiniAppLinkConfirm() {
  const { login } = useAuth();
  const [state, setState] = useState<ConfirmState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [conflict, setConflict] = useState<ConflictData | null>(null);
  const [channel, setChannel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultTalaba, setResultTalaba] = useState<{ ism: string; familiya: string } | null>(null);
  const initDataRef = useRef<string>('');
  const tokenHashRef = useRef<string>('');
  const didInitRef = useRef(false);

  const getInitData = useCallback(() => {
    try { return window.Telegram?.WebApp?.initData || ''; } catch { return ''; }
  }, []);

  const getTokenHash = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || params.get('startapp') || '';
  }, []);

  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.('#0f172a');
      tg?.setBackgroundColor?.('#0f172a');
    } catch {}
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const initData = getInitData();
    const tokenHash = getTokenHash();

    initDataRef.current = initData;
    tokenHashRef.current = tokenHash;

    if (!initData) {
      setState('error_generic');
      setErrorMsg('Bu sahifa Telegram ichida ochiladi.');
      return;
    }

    if (!tokenHash) {
      setState('error_generic');
      setErrorMsg('Havola noto\'g\'ri.');
      return;
    }

    // Preview — stsenariyni aniqlash (action yo'q)
    doConfirm('preview');
  }, []);

  const doConfirm = async (action: 'confirm' | 'reject' | 'preview') => {
    const initData = initDataRef.current;
    const tokenHash = tokenHashRef.current;

    if (!initData || !tokenHash) return;

    if (action !== 'preview') setSubmitting(true);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/link-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ initData, tokenHash, action }),
      });
      const data = await res.json();

      if (data.status === 'need_channel') {
        setChannel(data.channel || '');
        setState('need_channel');
        return;
      }

      if (data.status === 'linked' && data.talaba) {
        setResultTalaba({ ism: data.talaba.ism, familiya: data.talaba.familiya });
        login({
          ism: data.talaba.ism,
          familiya: data.talaba.familiya,
          rol: 'oquvchi',
          guruh: data.talaba.guruh || '',
          kurs: data.talaba.kurs || '',
          login: data.talaba.ism,
          talaba_id: data.talaba.id,
          tasdiqlangan: data.talaba.tasdiqlangan,
          google_linked: true,
          telegram_linked: true,
        });
        setState('success');
        return;
      }

      if (data.status === 'merged' && data.talaba) {
        setResultTalaba({ ism: data.talaba.ism, familiya: data.talaba.familiya });
        login({
          ism: data.talaba.ism,
          familiya: data.talaba.familiya,
          rol: 'oquvchi',
          guruh: data.talaba.guruh || '',
          kurs: data.talaba.kurs || '',
          login: data.talaba.ism,
          talaba_id: data.talaba.id,
          tasdiqlangan: data.talaba.tasdiqlangan,
          google_linked: true,
          telegram_linked: true,
        });
        setState('success');
        return;
      }

      if (data.status === 'already_linked' && data.talaba) {
        setResultTalaba({ ism: data.talaba.ism, familiya: data.talaba.familiya });
        setState('success');
        return;
      }

      if (data.status === 'conflict' && data.asosiy && data.birlashgan) {
        setConflict({ asosiy: data.asosiy, birlashgan: data.birlashgan });
        setState('confirm');
        return;
      }

      if (data.status === 'rejected') {
        setErrorMsg(data.message || 'Birlashtirish rad etildi');
        setState('rejected');
        return;
      }

      if (data.status === 'expired') {
        setState('error_expired');
        return;
      }

      if (data.status === 'used') {
        setState('error_used');
        return;
      }

      if (data.status === 'not_found') {
        setState('error_not_found');
        return;
      }

      if (data.status === 'rate_limited') {
        setState('error_generic');
        setErrorMsg('Soatiga 5 martadan ko\'p urinish mumkin emas.');
        return;
      }

      if (data.error) {
        setState('error_generic');
        setErrorMsg(data.error);
        return;
      }

      // Preview bo'yicha hech narsa aniqlanmagan — kutish
      if (action === 'preview' && !data.status) {
        setState('error_generic');
        setErrorMsg('Noma\'lum javob.');
      }
    } catch {
      setState('error_generic');
      setErrorMsg('Tarmoq xatosi. Qaytadan urinib ko\'ring.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = () => doConfirm('confirm');
  const handleReject = () => doConfirm('reject');

  const handleRetryChannel = () => {
    setState('loading');
    doConfirm('preview');
  };

  const openChannel = () => {
    const link = channel.startsWith('@') ? `https://t.me/${channel.slice(1)}` : `https://t.me/${channel}`;
    try {
      window.Telegram?.WebApp?.openTelegramLink?.(link);
    } catch {
      window.open(link, '_blank');
    }
  };

  // --- Render ---

  const darkBg: React.CSSProperties = {
    background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)',
    minHeight: '100vh',
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.12)',
  };

  if (state === 'loading') {
    return (
      <div style={darkBg} className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d4a017, #f59e0b)' }}>
          <span className="text-slate-900 font-black text-xl" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>F</span>
        </div>
        <Loader2 className="h-7 w-7 animate-spin text-amber-400" />
        <p className="text-sm text-blue-200/70">Tekshirilmoqda…</p>
      </div>
    );
  }

  if (state === 'need_channel') {
    return (
      <div style={darkBg} className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={cardStyle}>
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
          <div className="px-6 py-8 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-7 w-7 text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Kanalga a'zo bo'ling</h2>
              <p className="text-sm text-blue-200/60">Davom etish uchun quyidagi kanalga a'zo bo'ling:</p>
            </div>

            <div className="rounded-xl px-4 py-3 bg-white/5 border border-white/10 text-center">
              <p className="text-sm font-bold text-amber-300">{channel}</p>
            </div>

            <button onClick={openChannel} className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]">
              Kanalga a'zo bo'lish
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={handleRetryChannel} className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]">
              <RefreshCw className="h-4 w-4" />
              A'zolikni tekshirish
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'confirm' && conflict) {
    const ProfileCard = ({ title, data, highlight }: { title: string; data: ConflictData['asosiy']; highlight?: boolean }) => (
      <div className={`rounded-xl px-4 py-3 border ${highlight ? 'border-amber-400/30 bg-amber-400/5' : 'border-white/10 bg-white/5'}`}>
        <p className="text-[10px] uppercase tracking-wide text-blue-200/40 font-bold mb-1">{title}</p>
        <p className="text-sm font-bold text-white">{data?.ism} {data?.familiya}</p>
        <div className="mt-1 space-y-0.5">
          {data?.google_email_masked && <p className="text-xs text-blue-200/50">Google: {data.google_email_masked}</p>}
          {(data?.telegram_username || data?.telegram_ism) && <p className="text-xs text-blue-200/50">Telegram: {data.telegram_username || data.telegram_ism}</p>}
        </div>
        <p className="text-[10px] text-blue-200/30 mt-1">{new Date(data?.created_at || '').toLocaleDateString('uz')}</p>
      </div>
    );

    return (
      <div style={darkBg} className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={cardStyle}>
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-amber-500 to-blue-500" />
          <div className="px-6 py-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Akkaunt birlashtirish</h2>
                <p className="text-xs text-blue-200/50">Ikkala akkaunt bitta bo'ladi</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <ProfileCard title="Asosiy akkaunt" data={conflict.asosiy} highlight />
              <ProfileCard title="Birlashtiriladigan" data={conflict.birlashgan} />
            </div>

            <div className="rounded-xl px-3 py-2.5 bg-white/5 border border-white/10">
              <p className="text-[11px] text-blue-200/50 leading-relaxed">
                Natijalar, XP va nishonlar asosiy akkauntga ko'chadi. Ikkinchi akkaunt o'chirilmaydi.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button onClick={handleReject} disabled={submitting}
                className="flex-1 h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50">
                <X className="h-4 w-4" />
                Rad etish
              </button>
              <button onClick={handleConfirm} disabled={submitting}
                className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="h-4 w-4" /> Birlashtirish</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div style={darkBg} className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={cardStyle}>
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
          <div className="px-6 py-10 space-y-5 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Akkaunt ulandi!</h2>
                {resultTalaba && <p className="text-sm text-blue-200/60 mt-1">{resultTalaba.ism} {resultTalaba.familiya}</p>}
              </div>
            </div>
            <button onClick={() => { window.history.replaceState({}, '', window.location.origin); window.location.replace(window.location.origin); }}
              className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]">
              Kabinetga o'tish
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div style={darkBg} className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
        <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={cardStyle}>
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-red-600" />
          <div className="px-6 py-10 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <X className="h-7 w-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Rad etildi</h2>
            {errorMsg
              ? <p className="text-sm text-blue-200/60">{errorMsg}</p>
              : <p className="text-sm text-blue-200/50">Birlashtirish rad etildi.</p>
            }
            <p className="text-xs text-blue-200/30">Hech narsa o'zgarmadi.</p>
            <button onClick={() => { window.Telegram?.WebApp?.close?.(); }}
              className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition active:scale-[0.98]">
              Yopish
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error states
  const errorTitle = state === 'error_expired' ? 'Havola muddati o\'tdi'
    : state === 'error_used' ? 'Havola allaqachon ishlatilgan'
    : state === 'error_not_found' ? 'Havola topilmadi'
    : 'Xatolik';

  return (
    <div style={darkBg} className="flex flex-col items-center justify-center min-h-screen px-6 py-8">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={cardStyle}>
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 to-red-600" />
        <div className="px-6 py-10 space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white">{errorTitle}</h2>
          {errorMsg && <p className="text-sm text-blue-200/50">{errorMsg}</p>}
          <p className="text-xs text-blue-200/30">Saytdan yangi havola oling.</p>
          <button onClick={() => { window.Telegram?.WebApp?.close?.(); }}
            className="w-full h-12 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition active:scale-[0.98]">
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}
