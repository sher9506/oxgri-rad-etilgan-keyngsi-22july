import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import type { User } from '@/types/index';

const ALLOWED_REDIRECTS = ['/', '/profil', '/reyting', '/blog', '/qonunlar', '/moot-court', '/testlar', '/smart-talim', '/mentor', '/kurslar'];

export default function HandoffPage() {
  const { login } = useAuth();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const didConsumeRef = useRef(false);

  useEffect(() => {
    if (didConsumeRef.current) return;
    didConsumeRef.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const token = params.get('t');

    // DARHOL URL'dan olib tashlash
    window.history.replaceState({}, '', window.location.pathname);

    if (!token) {
      setState('error');
      setErrorMsg('Havola noto\'g\'ri. Token topilmadi.');
      return;
    }

    const consumeToken = async () => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/handoff-consume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();

        if (res.ok && data?.talaba) {
          const t = data.talaba;
          login({
            ism: t.ism,
            familiya: t.familiya,
            rol: 'oquvchi',
            guruh: t.guruh || '',
            kurs: t.kurs || '',
            login: t.login || t.ism,
            talaba_id: t.id,
            tasdiqlangan: !!t.tasdiqlangan,
            google_linked: !!t.google_linked,
            telegram_linked: !!t.telegram_linked,
          } as User);
          setState('success');
          // Profil sahifasiga yo'naltirish
          setTimeout(() => {
            window.location.replace('/profil');
          }, 800);
        } else {
          setState('error');
          setErrorMsg(data?.error || 'Kirish amalga oshmadi.');
        }
      } catch {
        setState('error');
        setErrorMsg('Tarmoq xatosi. Qaytadan urinib ko\'ring.');
      }
    };

    consumeToken();
  }, [login]);

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
          <span className="text-white font-black text-lg" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>F</span>
        </div>
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <p className="text-sm text-gray-500 font-medium">Saytga kirilmoqda…</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
          <ArrowRight className="h-7 w-7 text-emerald-600" />
        </div>
        <p className="text-sm font-bold text-gray-700">Muvaffaqiyatli! Profilga yo'naltirilmoqda…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 max-w-sm mx-auto">
      <div className="w-full rounded-2xl border-2 border-gray-200 shadow-sm bg-white p-6 space-y-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Kirish amalga oshmadi</h2>
        <p className="text-sm text-gray-500">{errorMsg}</p>
        <p className="text-xs text-gray-400">Mini App\'dan qayta \"Saytda ochish\" tugmasini bosing.</p>
        <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition">
          <LogIn className="h-4 w-4" />
          Telegram bilan kirish
        </a>
      </div>
    </div>
  );
}
