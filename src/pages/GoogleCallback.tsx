/**
 * GoogleCallback — Google OAuth'dan qaytish sahifasi
 *
 * Muvaffaqiyat: darhil profilga redirect (oraliq oyna yo'q).
 * Xato: login sahifaga qaytar + toast.
 * Google ism bermasa: qisqa forma.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2, User } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type GState = 'loading' | 'form' | 'success' | 'linked' | 'error';

export default function GoogleCallback() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<GState>('loading');
  const [googleUserId, setGoogleUserId] = useState<string | null>(null);

  const [ism, setIsm] = useState('');
  const [familiya, setFamiliya] = useState('');
  const [formYuklanyapti, setFormYuklanyapti] = useState(false);

  const linkMode = new URLSearchParams(window.location.search).get('link') === 'true';
  const linkTalabaId = new URLSearchParams(window.location.search).get('talaba_id');
  const linkState = new URLSearchParams(window.location.search).get('state');

  const ranRef = useRef(false);

  const redirectToHome = useCallback(() => {
    window.history.replaceState({}, '', window.location.origin);
    window.location.replace(window.location.origin);
  }, []);

  const redirectToHomeWithError = useCallback((msg: string) => {
    toast({ title: 'Google bilan kirib bo\'lmadi', description: msg, variant: 'destructive' });
    window.history.replaceState({}, '', window.location.origin);
    window.location.replace(window.location.origin);
  }, [toast]);

  const handleGoogleSession = useCallback(async () => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      redirectToHomeWithError('Google kodi olinmadi.');
      return;
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/google-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          code,
          linkTalabaId: linkMode ? linkTalabaId : undefined,
          linkState: linkMode ? linkState : undefined,
          redirectUri: `${window.location.origin}/google-callback`,
        }),
      });
      const result = await response.json();

      if (!response.ok || result.error) {
        redirectToHomeWithError(result.error || 'Google bilan kirishda xatolik.');
        return;
      }

      if (result.mode === 'linked') {
        setState('linked');
        setTimeout(redirectToHome, 1500);
        return;
      }

      if (result.mode === 'login' && result.talaba) {
        login({
          ism: result.talaba.ism || 'Foydalanuvchi',
          familiya: result.talaba.familiya || '',
          rol: 'oquvchi',
          guruh: result.talaba.guruh || '',
          kurs: result.talaba.kurs || '',
          login: result.talaba.login || result.talaba.ism || '',
          tasdiqlangan: result.talaba.tasdiqlangan,
          google_linked: result.talaba.google_linked,
          telegram_linked: result.talaba.telegram_linked,
          talaba_id: result.talaba.id,
        });
        redirectToHome();
        return;
      }

      if (result.mode === 'form' && result.googleUserId) {
        setGoogleUserId(result.googleUserId);
        setFamiliya(result.suggestedFamiliya || '');
        setIsm(result.suggestedIsm || '');
        setState('form');
        return;
      }

      redirectToHomeWithError('Google javobi tushunilmadi.');
    } catch (err: any) {
      redirectToHomeWithError('Server xatosi: ' + (err.message || 'Noma\'lum'));
    }
  }, [linkMode, linkTalabaId, linkState, login, redirectToHome, redirectToHomeWithError]);

  useEffect(() => {
    handleGoogleSession();
  }, [handleGoogleSession]);

  const handleFormSubmit = async () => {
    if (!ism.trim() || !googleUserId) return;

    setFormYuklanyapti(true);
    try {
      const { data: existing } = await supabase
        .from('talabalar')
        .select('id')
        .eq('google_user_id', googleUserId)
        .maybeSingle();

      if (existing) {
        redirectToHomeWithError('Bu Google akkaunt boshqa talabaga bog\'langan.');
        return;
      }

      const { data: newTalaba, error: insertErr } = await supabase
        .from('talabalar')
        .insert({
          ism: ism.trim(),
          familiya: familiya.trim() || null,
          guruh: null,
          kurs: null,
          google_user_id: googleUserId,
        })
        .select('id')
        .single();

      if (insertErr) {
        redirectToHomeWithError('Yaratishda xatolik: ' + insertErr.message);
        return;
      }

      login({
        ism: ism.trim(),
        familiya: familiya.trim(),
        rol: 'oquvchi',
        guruh: '',
        kurs: '',
        login: ism.trim() + (familiya.trim() ? '_' + familiya.trim() : ''),
        talaba_id: newTalaba?.id,
        google_linked: true,
        telegram_linked: false,
        tasdiqlangan: false,
      });
      redirectToHome();
    } catch (err: any) {
      redirectToHomeWithError('Xatolik: ' + (err.message || 'Noma\'lum'));
    }
  };

  // Faqat yuklanish va forma holati ko'rinadi — muvaffaqiyat/xato darhil redirect qiladi
  if (state === 'form') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}
      >
        <div className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500" />
          <div className="px-8 py-10 text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 0 32px rgba(99,102,241,0.4)' }}>
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Profilni to'ldiring</h1>
                <p className="text-xs text-blue-300 font-semibold mt-0.5">FanFaster.uz</p>
              </div>
            </div>
            <div className="space-y-4 text-left">
              <p className="text-sm text-blue-100/80 text-center">Google profilingizda ism topilmadi. Ismingizni kiriting.</p>
              <div className="space-y-3">
                {familiya && (
                  <div>
                    <label className="text-xs text-blue-200/60 mb-1 block">Familiya</label>
                    <Input value={familiya} onChange={e => setFamiliya(e.target.value)} placeholder="Familiya" className="h-10 text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-blue-200/60 mb-1 block">Ism</label>
                  <Input value={ism} onChange={e => setIsm(e.target.value)} placeholder="Ism" className="h-10 text-sm" />
                </div>
              </div>
              <Button onClick={handleFormSubmit} disabled={formYuklanyapti || !ism.trim()} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                {formYuklanyapti ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Yaratilmoqda...</> : 'Hisob yaratish'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading holati — matnsiz spinner
  if (state === 'linked') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
        <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}>
      <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
      <p className="text-sm text-blue-200/70">Kirilmoqda…</p>
    </div>
  );
}
