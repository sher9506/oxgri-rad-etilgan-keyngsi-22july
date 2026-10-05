/**
 * GoogleCallback — Google OAuth'dan qaytish sahifasi
 *
 * Flow:
 *  1. Supabase Auth sessiyani oladi (getSession)
 *  2. Google user_id olinadi
 *  3. talabalar jadvalida google_user_id bo'yicha qidiriladi
 *     a) Topilsa: login() orqali kirish
 *     b) Bog'lash rejimi (linkMode=true): hozirgi talabaga google_user_id ni bog'lash
 *     c) Topilmasa: "Profilni to'ldirish" formasi
 */

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Loader2, XCircle, ArrowLeft, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type GState = 'loading' | 'form' | 'success' | 'linked' | 'error' | 'exists';

export default function GoogleCallback() {
  const { login } = useAuth();
  const [state, setState] = useState<GState>('loading');
  const [message, setMessage] = useState('Google akkaunt tekshirilmoqda...');
  const [googleUserId, setGoogleUserId] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);

  // Forma maydonlari
  const [ism, setIsm] = useState('');
  const [familiya, setFamiliya] = useState('');
  const [guruh, setGuruh] = useState('');
  const [kurs, setKurs] = useState('');
  const [formYuklanyapti, setFormYuklanyapti] = useState(false);

  // Bog'lash rejimi
  const linkMode = new URLSearchParams(window.location.search).get('link') === 'true';
  const linkTalabaId = new URLSearchParams(window.location.search).get('talaba_id');

  const KURS_OPTIONS = ['1-kurs', '2-kurs', '3-kurs', '4-kurs', 'Boshqa'];
  const GURUH_OPTIONS = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3', 'Boshqa'];

  const handleGoogleSession = useCallback(async () => {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData?.session) {
        setState('error');
        setMessage('Google akkaunt ma\'lumotlari topilmadi. Qaytadan urinib ko\'ring.');
        return;
      }

      const googleId = sessionData.session.user?.app_metadata?.provider_id
        || sessionData.session.user?.user_metadata?.provider_id
        || sessionData.session.user?.id;
      const email = sessionData.session.user?.email || '';

      if (!googleId) {
        setState('error');
        setMessage('Google ID olinmadi.');
        return;
      }

      setGoogleUserId(googleId);
      setGoogleEmail(email);

      // Bog'lash rejimi
      if (linkMode && linkTalabaId) {
        // Boshqa talabaga bog'langanmi?
        const { data: existing } = await supabase
          .from('talabalar')
          .select('id')
          .eq('google_user_id', googleId)
          .neq('id', linkTalabaId)
          .maybeSingle();

        if (existing) {
          setState('exists');
          setMessage('Bu Google akkaunt boshqa talabaga bog\'langan.');
          return;
        }

        // Bog'lash
        const { error: linkErr } = await supabase
          .from('talabalar')
          .update({ google_user_id: googleId })
          .eq('id', linkTalabaId);

        if (linkErr) {
          setState('error');
          setMessage('Bog\'lashda xatolik: ' + linkErr.message);
          return;
        }

        // Bonus berish
        const { data: talaba } = await supabase
          .from('talabalar')
          .select('google_user_id, telegram_chat_id')
          .eq('id', linkTalabaId)
          .maybeSingle();

        if (talaba?.google_user_id && talaba?.telegram_chat_id) {
          await supabase.rpc('berilish_birlashtirish_bonusi', { p_talaba_id: linkTalabaId });
        }

        setState('linked');
        setMessage('Google akkaunt muvaffaqiyatli ulandi!');
        return;
      }

      // Oddiy kirish: google_user_id bo'yicha talabani topish
      const { data: talaba, error: talabaErr } = await supabase
        .from('talabalar')
        .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
        .eq('google_user_id', googleId)
        .maybeSingle();

      if (talabaErr) {
        setState('error');
        setMessage('Ma\'lumotlar bazasida xatolik.');
        return;
      }

      if (talaba) {
        // Mavjud talaba sifatida kirish
        login({
          ism: talaba.ism || 'Foydalanuvchi',
          familiya: talaba.familiya || '',
          rol: 'oquvchi',
          guruh: talaba.guruh || '',
          kurs: talaba.kurs || '',
          login: talaba.login_id || talaba.ism || '',
        });
        setState('success');
        setMessage('Muvaffaqiyatli kirdingiz!');
        setTimeout(() => {
          window.location.replace(window.location.origin);
        }, 2000);
        return;
      }

      // Yangi talaba — forma ko'rsatish
      // Google'dan ism/familiya olishga harakat
      const fullName = sessionData.session.user?.user_metadata?.full_name || '';
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        setFamiliya(parts[0]);
        setIsm(parts.slice(1).join(' '));
      } else if (parts.length === 1) {
        setIsm(parts[0]);
      }
      setState('form');
    } catch (err: any) {
      console.error('[GoogleCallback] xato:', err);
      setState('error');
      setMessage('Server xatosi: ' + (err.message || 'Noma\'lum'));
    }
  }, [linkMode, linkTalabaId, login]);

  useEffect(() => {
    handleGoogleSession();
  }, [handleGoogleSession]);

  // Forma yuborish
  const handleFormSubmit = async () => {
    if (!ism.trim() || !familiya.trim()) return;
    if (!googleUserId) return;

    setFormYuklanyapti(true);
    try {
      // Boshqa talabaga bog'langanmi?
      const { data: existing } = await supabase
        .from('talabalar')
        .select('id')
        .eq('google_user_id', googleUserId)
        .maybeSingle();

      if (existing) {
        setState('exists');
        setMessage('Bu Google akkaunt boshqa talabaga bog\'langan.');
        setFormYuklanyapti(false);
        return;
      }

      // Yangi talaba yaratish
      const { data: newTalaba, error: insertErr } = await supabase
        .from('talabalar')
        .insert({
          ism: ism.trim(),
          familiya: familiya.trim(),
          guruh: guruh || '',
          kurs: kurs || '',
          google_user_id: googleUserId,
        })
        .select('id')
        .single();

      if (insertErr) {
        setMessage('Yaratishda xatolik: ' + insertErr.message);
        setFormYuklanyapti(false);
        return;
      }

      login({
        ism: ism.trim(),
        familiya: familiya.trim(),
        rol: 'oquvchi',
        guruh: guruh || '',
        kurs: kurs || '',
        login: ism.trim() + '_' + familiya.trim(),
      });

      setState('success');
      setMessage('Hisob yaratildi! Muvaffaqiyatli kirdingiz.');
      setTimeout(() => {
        window.location.replace(window.location.origin);
      }, 2000);
    } catch (err: any) {
      setMessage('Xatolik: ' + (err.message || 'Noma\'lum'));
      setFormYuklanyapti(false);
    }
  };

  const goBack = () => {
    window.location.replace(window.location.origin);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)' }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div
        className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-emerald-500 to-blue-500" />

        <div className="px-8 py-10 text-center space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)', boxShadow: '0 0 32px rgba(99,102,241,0.4)' }}
            >
              {state === 'loading' ? (
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              ) : state === 'success' || state === 'linked' ? (
                <CheckCircle className="h-8 w-8 text-white" />
              ) : state === 'form' ? (
                <User className="h-8 w-8 text-white" />
              ) : (
                <XCircle className="h-8 w-8 text-white" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">
                {state === 'form' ? 'Profilni to\'ldiring' : state === 'success' ? 'Kirish muvaffaqiyatli!' : state === 'linked' ? 'Google ulandi!' : 'Google bilan kirish'}
              </h1>
              <p className="text-xs text-blue-300 font-semibold mt-0.5">FanFaster.uz</p>
            </div>
          </div>

          {/* Loading */}
          {state === 'loading' && (
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-4">
              <p className="text-sm text-blue-100 font-medium leading-relaxed">{message}</p>
            </div>
          )}

          {/* Success */}
          {(state === 'success' || state === 'linked') && (
            <div className="space-y-4">
              <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl px-4 py-4 space-y-1">
                <p className="text-sm text-emerald-200/80">{message}</p>
                {state === 'success' && <p className="text-sm text-emerald-200/60">Bosh sahifaga yo'naltirilmoqda...</p>}
              </div>
              {state === 'linked' && (
                <button onClick={goBack} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                  <ArrowLeft className="h-4 w-4" /> Profilga qaytish
                </button>
              )}
            </div>
          )}

          {/* Form */}
          {state === 'form' && (
            <div className="space-y-4 text-left">
              <p className="text-sm text-blue-100/80 text-center">Yangi hisob uchun ism va familiyangizni kiriting.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-blue-200/60 mb-1 block">Familiya</label>
                  <Input value={familiya} onChange={e => setFamiliya(e.target.value)} placeholder="Familiya" className="h-10 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-blue-200/60 mb-1 block">Ism</label>
                  <Input value={ism} onChange={e => setIsm(e.target.value)} placeholder="Ism" className="h-10 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-blue-200/60 mb-1 block">Kurs (ixtiyoriy)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {KURS_OPTIONS.map(k => (
                      <button key={k} onClick={() => setKurs(k)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${kurs === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-blue-200/70 border-white/10'}`}>{k}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-blue-200/60 mb-1 block">Guruh (ixtiyoriy)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {GURUH_OPTIONS.map(g => (
                      <button key={g} onClick={() => setGuruh(g)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${guruh === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/5 text-blue-200/70 border-white/10'}`}>{g}</button>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={handleFormSubmit} disabled={formYuklanyapti || !ism.trim() || !familiya.trim()} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                {formYuklanyapti ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Yaratilmoqda...</> : 'Hisob yaratish'}
              </Button>
            </div>
          )}

          {/* Error / Exists */}
          {(state === 'error' || state === 'exists') && (
            <div className="space-y-4">
              <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-4">
                <p className="text-sm text-red-200 leading-relaxed">{message}</p>
              </div>
              <button onClick={goBack} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
                <ArrowLeft className="h-4 w-4" /> Saytga qaytish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
