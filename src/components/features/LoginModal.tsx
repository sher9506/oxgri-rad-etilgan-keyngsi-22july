import { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, GraduationCap, Briefcase,
  Eye, EyeOff, Lock, Phone, LogIn,
  ArrowLeft, Send, KeyRound, RefreshCw, ExternalLink, Bot, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/contexts/LangContext';
import { supabase } from '@/lib/supabase';
import FaceCapture from './FaceCapture';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

async function parolHashla(parol: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(parol + 'juris_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function faceDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 1;
  const faceapi = (window as any).faceapi;
  if (faceapi?.euclideanDistance) return faceapi.euclideanDistance(new Float32Array(a), new Float32Array(b));
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  let d = digits;
  if (!d.startsWith('998')) {
    if (d.startsWith('0')) d = '998' + d.slice(1);
    else if (d.startsWith('9') && d.length <= 9) d = '998' + d;
    else if (!d.startsWith('998')) d = '998' + d;
  }
  d = d.slice(0, 12);
  let result = '+';
  if (d.length > 0) result += d.slice(0, 3);
  if (d.length > 3) result += ' ' + d.slice(3, 5);
  if (d.length > 5) result += ' ' + d.slice(5, 8);
  if (d.length > 8) result += ' ' + d.slice(8, 10);
  if (d.length > 10) result += ' ' + d.slice(10, 12);
  return result;
}

// Telegram SVG icon
const TelegramIcon = ({ size = 20, color = 'white' }: { size?: number; color?: string }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

// Ustoz ro'yxatdan o'tish modal
function UstozRoyhatModal({ onClose, ustozBotUrl }: { onClose: () => void; ustozBotUrl: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white overflow-hidden"
        style={{ borderRadius: 24, boxShadow: '0 32px 80px rgba(0,136,204,0.18), 0 8px 32px rgba(0,0,0,0.12)', animation: 'lm-fade-in 0.25s cubic-bezier(0.22,1,0.36,1)' }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-black/6 hover:bg-black/10 text-gray-500 transition-all">
          <X className="h-4 w-4" />
        </button>
        <div style={{ background: 'linear-gradient(135deg, #0088CC, #24A1DE)' }} className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
              <TelegramIcon size={20} />
            </div>
            <div>
              <h2 className="text-white font-black text-base">Ustoz bo'lib ro'yxatdan o'ting</h2>
              <p className="text-blue-100 text-xs mt-0.5">Telegram bot orqali — tez va oson</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            {[
              { n: 1, text: 'Quyidagi tugmani bosib botni oching', color: '#0088CC' },
              { n: 2, text: 'Telefon raqamingizni yuboring', color: '#0088CC' },
              { n: 3, text: 'Ism-familiyangizni kiriting', color: '#0088CC' },
              { n: 4, text: "Parolingizni o'rnating", color: '#0088CC' },
              { n: 5, text: 'Admin tasdiqlashini kuting', color: '#F59E0B' },
              { n: 6, text: 'Telefon + parol bilan saytga kiring', color: '#22C55E' },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5" style={{ background: s.color }}>{s.n}</span>
                <p className="text-xs text-gray-700 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          {ustozBotUrl ? (
            <a href={ustozBotUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 text-white font-black text-sm transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0088CC, #24A1DE)', borderRadius: 14, boxShadow: '0 4px 16px rgba(0,136,204,0.3)' }}>
              <TelegramIcon size={16} />
              Botga o'tish
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <div className="text-center py-3 bg-gray-50 rounded-2xl">
              <p className="text-xs text-gray-400 font-semibold">Bot havolasi admin tomonidan sozlanmagan</p>
            </div>
          )}
          <button onClick={onClose} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors">Yopish</button>
        </div>
      </div>
    </div>
  );
}

type ModalTab = 'oquvchi' | 'ustoz';
type TgLoginStatus = 'idle' | 'waiting' | 'success' | 'expired';
type UstozLoginBosqich = 'kirish' | 'parol_unutildi' | 'otp_kiriting' | 'yangi_parol';

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { t } = useLang();
  const [tab, setTab] = useState<ModalTab>('oquvchi');
  const [ustozRoyhatModal, setUstozRoyhatModal] = useState(false);

  // Telegram Login state
  const [tgLoginBotUrl, setTgLoginBotUrl] = useState('');
  const [tgLoginLoading, setTgLoginLoading] = useState(false);
  const [tgLoginStatus, setTgLoginStatus] = useState<TgLoginStatus>('idle');
  const [tgLoginSessionToken, setTgLoginSessionToken] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ustoz state
  const [ustozBotUrl, setUstozBotUrl] = useState('');
  const [ustozLoginBosqich, setUstozLoginBosqich] = useState<UstozLoginBosqich>('kirish');
  const [ustozKirishLogin, setUstozKirishLogin] = useState('');
  const [ustozKirishParol, setUstozKirishParol] = useState('');
  const [ustozKirishParolKor, setUstozKirishParolKor] = useState(false);
  const [ustozResetPhone, setUstozResetPhone] = useState('');
  const [ustozResetOtp, setUstozResetOtp] = useState('');
  const [ustozResetYangiParol, setUstozResetYangiParol] = useState('');
  const [ustozResetParolKor, setUstozResetParolKor] = useState(false);
  const [ustozResetObj, setUstozResetObj] = useState<any>(null);
  const [ustozDescriptorlar, setUstozDescriptorlar] = useState<{id: string; descriptor: number[]; ustoz: any}[]>([]);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [ustozFaceMode] = useState<'login'>('login');

  const [yuklanyapti, setYuklanyapti] = useState(false);

  const { login: authLogin } = useAuth();
  const { toast } = useToast();

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  };

  useEffect(() => {
    if (!isOpen) {
      setTab('oquvchi');
      setUstozLoginBosqich('kirish');
      setUstozKirishLogin(''); setUstozKirishParol('');
      setUstozResetPhone(''); setUstozResetOtp(''); setUstozResetYangiParol(''); setUstozResetObj(null);
      setShowFaceCapture(false); setYuklanyapti(false);
      setUstozRoyhatModal(false);
      stopPolling();
      setTgLoginStatus('idle');
      setTgLoginSessionToken('');
    } else {
      supabase.from('settings').select('key, text_value')
        .in('key', ['USTOZ_BOT_LINK', 'TELEGRAM_LOGIN_BOT_LINK'])
        .then(({ data }) => {
          const map: Record<string, string> = {};
          (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });
          setUstozBotUrl(map['USTOZ_BOT_LINK'] || '');
          setTgLoginBotUrl(map['TELEGRAM_LOGIN_BOT_LINK'] || '');
        });
    }
  }, [isOpen]);

  // Telegram Login
  const startTgLogin = async () => {
    if (!tgLoginBotUrl) {
      toast({ title: 'Bot sozlanmagan', description: 'Admin Telegram Login Botni sozlamagan', variant: 'destructive' });
      return;
    }
    setTgLoginLoading(true);
    try {
      const tokenArray = new Uint8Array(16);
      crypto.getRandomValues(tokenArray);
      const token = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase.from('telegram_login_sessions').insert({ session_token: token, status: 'pending' });
      if (error) throw error;
      setTgLoginSessionToken(token);
      setTgLoginStatus('waiting');
      const botLink = tgLoginBotUrl.endsWith('/') ? tgLoginBotUrl.slice(0, -1) : tgLoginBotUrl;
      window.open(`${botLink}?start=${token}`, '_blank');
      pollingRef.current = setInterval(async () => {
        const { data } = await supabase
          .from('telegram_login_sessions')
          .select('status, ism, familiya, guruh, kurs, login_id')
          .eq('session_token', token)
          .maybeSingle();
        // confirmed yoki used — ikkalasida ham kirish mumkin
        if (data?.status === 'confirmed' || data?.status === 'used') {
          stopPolling();
          // Agar foydalanuvchi ma'lumotlari mavjud bo'lsa login qilamiz
          if (data.ism) {
            setTgLoginStatus('success');
            authLogin({
              ism: data.ism || 'Foydalanuvchi',
              familiya: data.familiya || '',
              rol: 'oquvchi',
              guruh: data.guruh || '',
              kurs: data.kurs || '',
              login: data.login_id || '',
            });
            toast({ title: '✅ Muvaffaqiyatli kirdiniz!', description: `${data.ism} ${data.familiya}` });
            setTimeout(() => onClose(), 1200);
          } else {
            // Ma'lumotlar hali to'ldirilmagan — kutib turish
          }
        } else if (data?.status === 'expired' || !data) {
          stopPolling();
          setTgLoginStatus('expired');
        }
      }, 2000);
      setTimeout(() => {
        stopPolling();
        setTgLoginStatus(prev => prev === 'waiting' ? 'expired' : prev);
      }, 5 * 60 * 1000);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setTgLoginLoading(false);
    }
  };

  // Ustoz kirish
  const getUstozLoginId = () => ustozKirishLogin.replace(/\D/g, '');
  const getUstozResetLoginId = () => ustozResetPhone.replace(/\D/g, '');
  const isUstozPhoneValid = () => { const d = getUstozLoginId(); return d.length === 12 && d.startsWith('998'); };
  const isUstozResetPhoneValid = () => { const d = getUstozResetLoginId(); return d.length === 12 && d.startsWith('998'); };

  const handleUstozPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw || raw === '+') { setUstozKirishLogin(''); return; }
    setUstozKirishLogin(formatPhone(raw));
  };
  const handleUstozResetPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw || raw === '+') { setUstozResetPhone(''); return; }
    setUstozResetPhone(formatPhone(raw));
  };

  const handleUstozKirish = async () => {
    const loginId = getUstozLoginId();
    if (!isUstozPhoneValid() || !ustozKirishParol.trim()) {
      toast({ title: 'Xato', description: 'Telefon raqam va parolni kiriting', variant: 'destructive' }); return;
    }
    setYuklanyapti(true);
    try {
      const hash = await parolHashla(ustozKirishParol);
      const loginVariants = [loginId, '+' + loginId];
      const { data: ustozData } = await supabase
        .from('ustoz')
        .select('id, full_name, username, phone, status, parol_hash')
        .or(`phone.in.(${loginVariants.map(v => `"${v}"`).join(',')}),username.in.(${loginVariants.map(v => `"${v}"`).join(',')})`)
        .maybeSingle();
      if (ustozData) {
        if (ustozData.status !== 'approved') {
          const msg = ustozData.status === 'pending' ? 'Hisobingiz hali admin tomonidan tasdiqlanmagan.' : "Hisobingiz rad etilgan.";
          toast({ title: 'Kirish taqiqlangan', description: msg, variant: 'destructive' });
          setYuklanyapti(false); return;
        }
        if (!ustozData.parol_hash || ustozData.parol_hash !== hash) {
          toast({ title: 'Xato', description: "Telefon raqam yoki parol noto'g'ri", variant: 'destructive' });
          setYuklanyapti(false); return;
        }
        const parts = (ustozData.full_name || '').split(' ');
        authLogin({ ism: parts[0] || 'Ustoz', familiya: parts.slice(1).join(' ') || '', rol: 'ustoz', login: ustozData.phone || ustozData.username, ustoz_id: ustozData.id });
        toast({ title: 'Xush kelibsiz!', description: `${ustozData.full_name} — Ustoz` });
        onClose(); return;
      }
      toast({ title: 'Xato', description: "Telefon raqam yoki parol noto'g'ri.", variant: 'destructive' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const handleUstozParolUnutildiOtp = async () => {
    const loginId = getUstozResetLoginId();
    if (!isUstozResetPhoneValid()) {
      toast({ title: 'Xato', description: "To'liq telefon raqam kiriting", variant: 'destructive' }); return;
    }
    setYuklanyapti(true);
    try {
      const loginVariants = [loginId, '+' + loginId];
      const { data: ustoz } = await supabase.from('ustoz').select('id, full_name, phone, telegram_chat_id, username')
        .or(`phone.in.(${loginVariants.map(v => `"${v}"`).join(',')}),username.in.(${loginVariants.map(v => `"${v}"`).join(',')})`)
        .maybeSingle();
      if (!ustoz) { toast({ title: 'Topilmadi', description: 'Bu telefon raqam bilan ustoz topilmadi', variant: 'destructive' }); setYuklanyapti(false); return; }
      if (!ustoz.telegram_chat_id) { toast({ title: 'Telegram ulanmagan', variant: 'destructive' }); setYuklanyapti(false); return; }
      const otpKod = Math.floor(10000 + Math.random() * 90000).toString();
      await supabase.from('parol_reset_kodlar').insert({ login_id: loginId, kod: otpKod, faol: true });
      const { data: tokenData } = await supabase.from('settings').select('text_value').eq('key', 'TELEGRAM_TOKEN').maybeSingle();
      if (!tokenData?.text_value) { toast({ title: 'Bot sozlanmagan', variant: 'destructive' }); setYuklanyapti(false); return; }
      await supabase.functions.invoke('telegram-api', {
        body: {
          token: tokenData.text_value,
          method: 'sendMessage',
          body: { chat_id: ustoz.telegram_chat_id, text: `🔐 <b>Parolni tiklash kodi (Ustoz)</b>\n\nKodingiz: <code>${otpKod}</code>\n\n⚠️ 10 daqiqa amal qiladi.`, parse_mode: 'HTML' },
        },
      });
      setUstozResetObj(ustoz);
      setUstozLoginBosqich('otp_kiriting');
      toast({ title: '✅ Kod yuborildi!' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const handleUstozOtpTasdiqlash = async () => {
    if (!ustozResetOtp || ustozResetOtp.length !== 5) { toast({ title: 'Xato', description: '5 xonali kodni kiriting', variant: 'destructive' }); return; }
    setYuklanyapti(true);
    try {
      const loginId = getUstozResetLoginId();
      const { data: kod } = await supabase.from('parol_reset_kodlar').select('*')
        .eq('login_id', loginId).eq('kod', ustozResetOtp).eq('faol', true).gte('expires_at', new Date().toISOString()).maybeSingle();
      if (!kod) { toast({ title: "Kod noto'g'ri yoki muddati o'tgan", variant: 'destructive' }); setYuklanyapti(false); return; }
      setUstozLoginBosqich('yangi_parol');
      toast({ title: '✅ Tasdiqlandi!' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const handleUstozYangiParolSaqlash = async () => {
    if (!ustozResetYangiParol || ustozResetYangiParol.length < 8) { toast({ title: 'Xato', description: 'Kamida 8 ta belgi', variant: 'destructive' }); return; }
    if (!/[A-Z]/.test(ustozResetYangiParol) || !/[0-9]/.test(ustozResetYangiParol)) { toast({ title: 'Zaif parol', variant: 'destructive' }); return; }
    setYuklanyapti(true);
    try {
      const hash = await parolHashla(ustozResetYangiParol);
      await supabase.from('ustoz').update({ parol_hash: hash }).eq('id', ustozResetObj.id);
      await supabase.from('parol_reset_kodlar').update({ faol: false }).eq('login_id', getUstozResetLoginId()).eq('faol', true);
      toast({ title: '✅ Parol yangilandi!' });
      setUstozLoginBosqich('kirish');
      setUstozResetPhone(''); setUstozResetOtp(''); setUstozResetYangiParol(''); setUstozResetObj(null);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const handleFaceCaptureComplete = async (descriptor: number[]) => {
    setShowFaceCapture(false); setYuklanyapti(true);
    try {
      const THRESHOLD = 0.55;
      const mos = ustozDescriptorlar.map(u => ({ ...u, distance: faceDistance(descriptor, u.descriptor) })).filter(u => u.distance < THRESHOLD).sort((a, b) => a.distance - b.distance);
      if (mos.length === 0) { toast({ title: 'Yuz tanilmadi', variant: 'destructive' }); setYuklanyapti(false); return; }
      const ustoz = mos[0].ustoz;
      const parts = (ustoz.full_name || '').split(' ');
      authLogin({ ism: parts[0] || 'Ustoz', familiya: parts.slice(1).join(' ') || '', rol: 'ustoz', login: ustoz.username, ustoz_id: ustoz.id });
      toast({ title: 'Xush kelibsiz!', description: `${ustoz.full_name} — Face ID` });
      onClose();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  if (!isOpen) return null;

  if (showFaceCapture) {
    return (
      <FaceCapture
        mode="login"
        onCaptureComplete={handleFaceCaptureComplete}
        onCancel={() => { setShowFaceCapture(false); setYuklanyapti(false); }}
        allDescriptors={ustozDescriptorlar}
      />
    );
  }

  const inputBase = 'w-full h-12 px-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-[#24A1DE] focus:bg-white focus:ring-4 focus:ring-[#24A1DE]/10';
  const inputWithIcon = `${inputBase} pl-11`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <div
          className="relative w-full max-w-md bg-white overflow-hidden"
          style={{
            borderRadius: 24,
            boxShadow: '0 40px 100px rgba(0,0,0,0.18), 0 16px 48px rgba(36,161,222,0.12), 0 4px 16px rgba(0,0,0,0.08)',
            animation: 'lm-fade-in 0.28s cubic-bezier(0.22,1,0.36,1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* X tugmasi */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: 'rgba(0,0,0,0.05)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>

          {/* Header: Brand + Tabs */}
          <div className="pt-8 pb-5 px-8 text-center border-b border-gray-100">
            {/* Logo + Name */}
            <div className="flex items-center justify-center gap-2.5 mb-5">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, #1a73e8, #24A1DE)' }}
              >
                <span className="text-white font-black text-base">F</span>
              </div>
              <span className="text-xl font-black text-gray-900 tracking-tight">FanFaster</span>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
              <button
                onClick={() => setTab('oquvchi')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'oquvchi' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <GraduationCap className="h-4 w-4" /> O'quvchi
              </button>
              <button
                onClick={() => { setTab('ustoz'); setUstozLoginBosqich('kirish'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === 'ustoz' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Briefcase className="h-4 w-4" /> Ustoz
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-7 max-h-[68vh] overflow-y-auto">

            {/* ─── O'QUVCHI TAB ─── */}
            {tab === 'oquvchi' && (
              <div className="space-y-6">
                {/* Sarlavha */}
                <div className="text-center space-y-1.5">
                  <h2 className="text-xl font-black text-gray-900">Telegram orqali tezkor kirish</h2>
                  <p className="text-sm text-gray-400">Tizimga kirish uchun quyidagi tugmani bosing.</p>
                </div>

                {/* Idle holat */}
                {tgLoginStatus === 'idle' && (
                  <button
                    onClick={startTgLogin}
                    disabled={tgLoginLoading}
                    className="group relative w-full flex items-center justify-center gap-3 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-60"
                    style={{
                      height: 56,
                      borderRadius: 16,
                      background: 'linear-gradient(135deg, #229ED9, #24A1DE)',
                      boxShadow: '0 4px 20px rgba(36,161,222,0.35)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.025)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(36,161,222,0.45)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                      (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(36,161,222,0.35)';
                    }}
                  >
                    {tgLoginLoading ? (
                      <><Loader2 className="h-5 w-5 animate-spin" />Tayyorlanmoqda...</>
                    ) : (
                      <><TelegramIcon size={22} />Telegram orqali kirish</>
                    )}
                  </button>
                )}

                {/* Waiting holat */}
                {tgLoginStatus === 'waiting' && (
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ border: '1.5px solid rgba(36,161,222,0.25)', background: '#f0f9ff' }}
                  >
                    <div className="p-6 flex flex-col items-center gap-4 text-center">
                      <div className="relative w-14 h-14">
                        <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#24A1DE' }} />
                        <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #229ED9, #24A1DE)' }}>
                          <Loader2 className="h-7 w-7 text-white animate-spin" />
                        </div>
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-sm">Telegram botda tasdiqlang</p>
                        <p className="text-xs text-gray-500 mt-1">Bot yangi oynada ochildi. Tasdiqlang.</p>
                      </div>
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => {
                            const botLink = tgLoginBotUrl.endsWith('/') ? tgLoginBotUrl.slice(0, -1) : tgLoginBotUrl;
                            window.open(`${botLink}?start=${tgLoginSessionToken}`, '_blank');
                          }}
                          className="flex-1 py-2.5 text-xs font-bold rounded-xl transition-all"
                          style={{ background: '#e0f2fe', color: '#0369a1' }}
                        >
                          Botni qayta ochish
                        </button>
                        <button
                          onClick={() => { stopPolling(); setTgLoginStatus('idle'); setTgLoginSessionToken(''); }}
                          className="py-2.5 px-4 text-xs font-bold rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
                        >
                          Bekor
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success holat */}
                {tgLoginStatus === 'success' && (
                  <div className="rounded-2xl p-6 text-center" style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#22c55e' }}>
                      <CheckCircle2 className="h-7 w-7 text-white" />
                    </div>
                    <p className="font-black text-gray-900 text-sm">Muvaffaqiyatli kirdiniz!</p>
                  </div>
                )}

                {/* Expired holat */}
                {tgLoginStatus === 'expired' && (
                  <div className="rounded-2xl p-5 text-center space-y-3" style={{ background: '#fef2f2', border: '1.5px solid #fecaca' }}>
                    <p className="font-bold text-red-700 text-sm">Vaqt tugadi yoki xatolik</p>
                    <button
                      onClick={() => { setTgLoginStatus('idle'); setTgLoginSessionToken(''); }}
                      className="text-sm font-bold text-white px-5 py-2.5 rounded-xl transition-all"
                      style={{ background: '#ef4444' }}
                    >
                      Qaytadan urinish
                    </button>
                  </div>
                )}

                {/* Bot sozlanmagan xabari */}
                {!tgLoginBotUrl && tgLoginStatus === 'idle' && (
                  <div className="rounded-2xl p-4 text-center" style={{ background: '#fafafa', border: '1.5px dashed #e5e7eb' }}>
                    <p className="text-xs text-gray-400 font-medium">Telegram Login Bot admin tomonidan sozlanmagan</p>
                    <p className="text-[10px] text-gray-300 mt-1">Admin → Bot Sozlamalari → TELEGRAM_LOGIN_BOT_LINK</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── USTOZ TAB ─── */}
            {tab === 'ustoz' && (
              <div>
                {/* USTOZ KIRISH */}
                {ustozLoginBosqich === 'kirish' && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900">Ustoz <span style={{ color: '#24A1DE' }}>kirish</span></h2>
                    <div className="space-y-3">
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                          className={`${inputWithIcon} ${ustozKirishLogin && !isUstozPhoneValid() ? 'border-red-300' : ''}`}
                          placeholder="+998 90 123 45 67"
                          value={ustozKirishLogin}
                          onChange={handleUstozPhoneChange}
                          onKeyDown={e => e.key === 'Enter' && handleUstozKirish()}
                          type="tel" inputMode="tel"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input
                          className={`${inputWithIcon} pr-11`}
                          type={ustozKirishParolKor ? 'text' : 'password'}
                          placeholder="Parol"
                          value={ustozKirishParol}
                          onChange={e => setUstozKirishParol(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUstozKirish()}
                        />
                        <button type="button" onClick={() => setUstozKirishParolKor(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {ustozKirishParolKor ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        onClick={handleUstozKirish}
                        disabled={yuklanyapti || !isUstozPhoneValid() || !ustozKirishParol}
                        className="w-full h-12 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #1a73e8, #24A1DE)', boxShadow: '0 4px 16px rgba(36,161,222,0.3)' }}
                      >
                        {yuklanyapti ? <><Loader2 className="h-4 w-4 animate-spin" />Kirish...</> : <><LogIn className="h-4 w-4" />Kirish</>}
                      </button>
                      <button onClick={() => { setUstozLoginBosqich('parol_unutildi'); setUstozResetPhone(ustozKirishLogin); }}
                        className="w-full text-sm py-1 flex items-center justify-center gap-1.5 transition-colors"
                        style={{ color: '#24A1DE' }}>
                        <KeyRound className="h-3.5 w-3.5" /> Parolni unutdim
                      </button>
                    </div>
                    <button
                      onClick={() => setUstozRoyhatModal(true)}
                      className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                      style={{ border: '1.5px solid rgba(36,161,222,0.35)', background: 'rgba(36,161,222,0.05)', color: '#24A1DE' }}
                    >
                      <Bot className="h-4 w-4" />
                      Ro'yxatdan o'tish
                    </button>
                  </div>
                )}

                {/* USTOZ PAROL UNUTILDI */}
                {ustozLoginBosqich === 'parol_unutildi' && (
                  <div className="space-y-4">
                    <button onClick={() => setUstozLoginBosqich('kirish')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-2">
                      <ArrowLeft className="h-3.5 w-3.5" /> Orqaga
                    </button>
                    <h2 className="text-xl font-bold text-gray-900">Parolni <span style={{ color: '#24A1DE' }}>tiklash</span></h2>
                    <div className="rounded-2xl p-3 text-xs" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                      Telegramga bog'liq botga 5 xonali tasdiqlash kodi yuboriladi.
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input className={inputWithIcon} placeholder="+998 90 123 45 67" value={ustozResetPhone} onChange={handleUstozResetPhoneChange} type="tel" inputMode="tel" />
                      </div>
                      <button onClick={handleUstozParolUnutildiOtp} disabled={yuklanyapti || !isUstozResetPhoneValid()}
                        className="w-full h-12 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #1a73e8, #24A1DE)' }}>
                        {yuklanyapti ? <><Loader2 className="h-4 w-4 animate-spin" />Yuborilmoqda...</> : <><Send className="h-4 w-4" />Telegram botga kod yuborish</>}
                      </button>
                    </div>
                  </div>
                )}

                {/* USTOZ OTP */}
                {ustozLoginBosqich === 'otp_kiriting' && (
                  <div className="space-y-4">
                    <button onClick={() => setUstozLoginBosqich('parol_unutildi')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-2">
                      <ArrowLeft className="h-3.5 w-3.5" /> Orqaga
                    </button>
                    <h2 className="text-xl font-bold text-gray-900">Kodni <span style={{ color: '#24A1DE' }}>kiriting</span></h2>
                    <div className="space-y-3">
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input className={`${inputWithIcon} text-center text-2xl font-bold tracking-[0.5em]`} placeholder="_ _ _ _ _" value={ustozResetOtp} onChange={e => setUstozResetOtp(e.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} inputMode="numeric" />
                      </div>
                      <button onClick={handleUstozOtpTasdiqlash} disabled={yuklanyapti || ustozResetOtp.length !== 5}
                        className="w-full h-12 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #1a73e8, #24A1DE)' }}>
                        {yuklanyapti ? <><Loader2 className="h-4 w-4 animate-spin" />Tekshirilmoqda...</> : <><KeyRound className="h-4 w-4" />Kodni tasdiqlash</>}
                      </button>
                      <button onClick={handleUstozParolUnutildiOtp} disabled={yuklanyapti} className="w-full text-sm text-gray-500 hover:text-blue-600 py-1 flex items-center justify-center gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" /> Qayta yuborish
                      </button>
                    </div>
                  </div>
                )}

                {/* USTOZ YANGI PAROL */}
                {ustozLoginBosqich === 'yangi_parol' && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-bold text-gray-900">Yangi <span style={{ color: '#24A1DE' }}>parol</span></h2>
                    <div className="rounded-2xl p-3 text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
                      Kamida 8 belgi · Katta harf (A-Z) · Raqam (0-9)
                    </div>
                    <div className="space-y-3">
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        <input className={`${inputWithIcon} pr-11`} type={ustozResetParolKor ? 'text' : 'password'} placeholder="Yangi parol" value={ustozResetYangiParol} onChange={e => setUstozResetYangiParol(e.target.value)} />
                        <button type="button" onClick={() => setUstozResetParolKor(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {ustozResetParolKor ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button onClick={handleUstozYangiParolSaqlash} disabled={yuklanyapti || !ustozResetYangiParol || ustozResetYangiParol.length < 8}
                        className="w-full h-12 rounded-2xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                        {yuklanyapti ? <><Loader2 className="h-4 w-4 animate-spin" />Saqlanmoqda...</> : <>✅ Parolni saqlash</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer — faqat ustoz uchun */}
          {tab === 'ustoz' && (
            <div className="px-8 pb-6 pt-3 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Ustoz — <span style={{ color: '#24A1DE', fontWeight: 600 }}>Telefon + parol</span> bilan kirish
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes lm-fade-in {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {ustozRoyhatModal && (
        <UstozRoyhatModal onClose={() => setUstozRoyhatModal(false)} ustozBotUrl={ustozBotUrl} />
      )}
    </>
  );
}
