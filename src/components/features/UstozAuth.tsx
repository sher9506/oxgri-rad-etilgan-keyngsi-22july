
import { useState, useEffect } from 'react';
import { LogIn, UserPlus, Loader2, Phone, KeyRound, User, Eye, EyeOff, MessageCircle, ArrowLeft, CheckCircle, Bot, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { sendUstozOtp, registerUstozWithOtp, loginUstoz, Ustoz } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// ─── Telefon formatlash ───────────────────────────────────────────────────────
function formatPhone(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 12);
  if (digits.startsWith('998')) {
    const d = digits.slice(3);
    if (d.length === 0) return '+998';
    if (d.length <= 2) return `+998 ${d}`;
    if (d.length <= 5) return `+998 ${d.slice(0, 2)} ${d.slice(2)}`;
    if (d.length <= 7) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
    return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  }
  if (val.startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

function cleanPhone(val: string): string {
  return val.replace(/\s/g, '').replace(/[^+\d]/g, '');
}

// ─── Bosqichlar ───────────────────────────────────────────────────────────────
type RegisterStep = 'phone' | 'otp' | 'details';

interface UstozAuthProps {
  onLogin: (ustoz: Ustoz) => void;
}

export default function UstozAuth({ onLogin }: UstozAuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [ustozBotLink, setUstozBotLink] = useState('');

  useEffect(() => {
    supabase.from('settings').select('text_value').eq('key', 'USTOZ_BOT_LINK').maybeSingle().then(({ data }) => {
      if (data?.text_value) setUstozBotLink(data.text_value);
    });
  }, []);

  // Login state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regStep, setRegStep] = useState<RegisterStep>('phone');
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordVisible, setRegPasswordVisible] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState<Date | null>(null);

  const { toast } = useToast();

  // ─── LOGIN ───────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!loginPhone.trim() || !loginPassword.trim()) {
      toast({ title: 'Xato', description: 'Barcha maydonlarni to\'ldiring', variant: 'destructive' });
      return;
    }
    setLoginLoading(true);
    try {
      const ustoz = await loginUstoz(loginPhone.trim(), loginPassword);
      toast({ title: 'Xush kelibsiz!', description: `${ustoz.full_name}, tizimga kirdingiz` });
      onLogin(ustoz);
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || 'Kirish xatosi', variant: 'destructive' });
    } finally {
      setLoginLoading(false);
    }
  };

  // ─── REGISTER: OTP YUBORISH ───────────────────────────────────────────────
  const handleSendOtp = async () => {
    const phone = cleanPhone(regPhone);
    if (phone.length < 9) {
      toast({ title: 'Xato', description: 'Telefon raqamni to\'liq kiriting', variant: 'destructive' });
      return;
    }
    setRegLoading(true);
    try {
      await sendUstozOtp(phone);
      setRegStep('otp');
      setOtpSentAt(new Date());
      toast({
        title: '✅ Kod yuborildi',
        description: 'Telegram botiga tashrif buyuring va kodni kiriting',
      });
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message, variant: 'destructive' });
    } finally {
      setRegLoading(false);
    }
  };

  // ─── REGISTER: OTP TASDIQLASH + MA'LUMOT ─────────────────────────────────
  const handleRegister = async () => {
    if (regOtp.length < 4) {
      toast({ title: 'Xato', description: 'Kodni to\'liq kiriting', variant: 'destructive' });
      return;
    }
    if (!regFullName.trim() || regFullName.trim().split(/\s+/).length < 2) {
      toast({ title: 'Xato', description: 'Ism va familiyangizni kiriting (masalan: Abdullayev Jasur)', variant: 'destructive' });
      return;
    }
    if (regPassword.length < 6) {
      toast({ title: 'Xato', description: 'Parol kamida 6 belgidan iborat bo\'lishi kerak', variant: 'destructive' });
      return;
    }
    setRegLoading(true);
    try {
      await registerUstozWithOtp({
        phone: cleanPhone(regPhone),
        otp: regOtp.trim(),
        fullName: regFullName.trim(),
        password: regPassword,
      });
      toast({
        title: "Ro'yxatdan o'tdingiz!",
        description: 'Admin tasdiqlashini kuting. Tasdiqlangandan keyin kirish imkoniyati ochiladi.',
      });
      // Formni tozalash va login rejimiga o'tish
      setMode('login');
      setRegStep('phone');
      setRegPhone('');
      setRegOtp('');
      setRegFullName('');
      setRegPassword('');
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message, variant: 'destructive' });
    } finally {
      setRegLoading(false);
    }
  };

  const resetRegister = () => {
    setRegStep('phone');
    setRegOtp('');
    setRegFullName('');
    setRegPassword('');
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl border-2 animate-slide-up">
        {/* Header */}
        <CardHeader className="space-y-1 bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white rounded-t-lg">
          <CardTitle className="text-2xl flex items-center gap-2">
            {mode === 'login' ? (
              <><LogIn className="h-6 w-6" />Ustoz tizimiga kirish</>
            ) : (
              <><UserPlus className="h-6 w-6" />Ustoz ro'yxatdan o'tish</>
            )}
          </CardTitle>
          <CardDescription className="text-blue-100">
            {mode === 'login'
              ? 'Telefon raqam va parol bilan kiring'
              : regStep === 'phone'
                ? 'Telefon raqamingizni kiriting'
                : regStep === 'otp'
                  ? 'Telegram botdagi kodni kiriting'
                  : 'Ism va parolni belgilang'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              <div className="space-y-2">
                <label htmlFor="login-phone" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-gray-400" /> Telefon raqam
                </label>
                <Input
                  id="login-phone"
                  placeholder="+998 90 123 45 67"
                  value={loginPhone}
                  onChange={e => setLoginPhone(formatPhone(e.target.value))}
                  disabled={loginLoading}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Parol
                </label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={loginPasswordVisible ? 'text' : 'password'}
                    placeholder="••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    disabled={loginLoading}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => setLoginPasswordVisible(v => !v)}
                    aria-label={loginPasswordVisible ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                  >
                    {loginPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button onClick={handleLogin} disabled={loginLoading} className="w-full" size="lg">
                {loginLoading
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Yuklanmoqda...</>
                  : <><LogIn className="mr-2 h-5 w-5" />Kirish</>}
              </Button>
            </>
          )}

          {/* ── REGISTER: PHONE ── */}
          {mode === 'register' && regStep === 'phone' && (
            <>
              {/* Bot haqida eslatma */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <MessageCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-semibold mb-1">Qanday ishlaydi?</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                    <li>Telegram botga <strong>/start</strong> yuboring va telefon raqamingizni ulashing</li>
                    <li>Saytda telefon raqam kiriting — bot kod yuboradi</li>
                    <li>Kodni saytga kiriting, ism va parolni belgilang</li>
                    <li>Admin tasdiqlashini kuting</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-phone" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-gray-400" /> Telefon raqam
                </label>
                <Input
                  id="reg-phone"
                  placeholder="+998 90 123 45 67"
                  value={regPhone}
                  onChange={e => setRegPhone(formatPhone(e.target.value))}
                  disabled={regLoading}
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="text-xs text-gray-500">
                  Bot orqali ro'yxatdan o'tgan telefon raqamingizni kiriting
                </p>
              </div>

              <Button onClick={handleSendOtp} disabled={regLoading} className="w-full" size="lg">
                {regLoading
                  ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Kod yuborilmoqda...</>
                  : <><MessageCircle className="mr-2 h-5 w-5" />Botga kod yuborish</>}
              </Button>
            </>
          )}

          {/* ── REGISTER: OTP + DETAILS ── */}
          {mode === 'register' && regStep === 'otp' && (
            <>
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="text-xs text-green-800">
                  <p className="font-semibold">Kod yuborildi!</p>
                  <p>Telegram botini oching va 6 raqamli kodni oling</p>
                  {otpSentAt && (
                    <p className="text-green-600 mt-0.5">
                      {otpSentAt.toLocaleTimeString('uz-UZ')} da yuborildi • 10 daqiqa amal qiladi
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-otp" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Tasdiqlash kodi (OTP)
                </label>
                <Input
                  id="reg-otp"
                  placeholder="123456"
                  value={regOtp}
                  onChange={e => setRegOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={regLoading}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="text-center text-2xl font-bold tracking-[0.5em] py-3"
                  maxLength={6}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-fullname" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <User className="h-4 w-4 text-gray-400" /> To'liq ism-familiya
                </label>
                <Input
                  id="reg-fullname"
                  placeholder="Abdullayev Jasur"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  disabled={regLoading}
                  autoComplete="name"
                />
                <p className="text-xs text-gray-500">Familiya va ism, bo'sh joy bilan ajratib</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="reg-password" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <KeyRound className="h-4 w-4 text-gray-400" /> Parol o'rnatish
                </label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={regPasswordVisible ? 'text' : 'password'}
                    placeholder="Kamida 6 belgi"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    disabled={regLoading}
                    className="pr-10"
                    autoComplete="new-password"
                    onKeyDown={e => e.key === 'Enter' && handleRegister()}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    onClick={() => setRegPasswordVisible(v => !v)}
                    aria-label={regPasswordVisible ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                  >
                    {regPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={resetRegister}
                  disabled={regLoading}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />Orqaga
                </Button>
                <Button onClick={handleRegister} disabled={regLoading} className="flex-1" size="lg">
                  {regLoading
                    ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Ro'yxatdan o'tilmoqda...</>
                    : <><UserPlus className="mr-2 h-5 w-5" />Ro'yxatdan o'tish</>}
                </Button>
              </div>

              {/* Yangi kod so'rash */}
              <button
                type="button"
                className="w-full text-center text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
                onClick={() => { resetRegister(); }}
              >
                Kod kelmadimi? → Orqaga qaytib qayta yuboring
              </button>
            </>
          )}

          {/* Bot orqali ro'yxatdan o'tish */}
          {ustozBotLink && mode === 'login' && (
            <a
              href={ustozBotLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-200 text-sm"
            >
              <Bot className="h-4 w-4" />
              Telegram bot orqali ro'yxatdan o'tish
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          )}

          {/* ── SEPARATOR ── */}
          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400">yoki</span>
            </div>
          </div>

          {/* ── MODE TOGGLE ── */}
          <Button
            variant="outline"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setRegStep('phone');
              setRegPhone('');
              setRegOtp('');
              setRegFullName('');
              setRegPassword('');
              setLoginPhone('');
              setLoginPassword('');
            }}
            disabled={loginLoading || regLoading}
            className="w-full"
          >
            {mode === 'login'
              ? <><UserPlus className="mr-2 h-4 w-4" />Ro'yxatdan o'tish</>
              : <><LogIn className="mr-2 h-4 w-4" />Kirish sahifasiga qaytish</>}
          </Button>
        </CardContent>
      </Card>

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
      `}</style>
    </div>
  );
}
