import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle2, Link2, Camera, Trash2, Lock, Sparkles, Award, Image as ImageIcon, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { detectPlatform } from '@/lib/platform';
import { startGoogleLink } from '@/lib/googleAuth';
import TasdiqlanganBelgi from './TasdiqlanganBelgi';
import Avatar from '@/components/ui/avatar-profile';

export default function BirlashtirishKartasi() {
  const { user, login } = useAuth();
  const { toast } = useToast();

  const [talabaId, setTalabaId] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleEmailMasked, setGoogleEmailMasked] = useState('');
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramDisplay, setTelegramDisplay] = useState('');
  const [tasdiqlangan, setTasdiqlangan] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bonusUrinish, setBonusUrinish] = useState(0);
  const [bonusCount, setBonusCount] = useState(3);
  const [loading, setLoading] = useState(true);

  // Telegram ulash
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkTokenHash, setLinkTokenHash] = useState<string | null>(null);
  const linkTokenHashRef = useRef<string | null>(null);
  const [linkPolling, setLinkPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);

  // Birlashtirish mojarosi
  const [mergeConflict, setMergeConflict] = useState<{ conflictTalabaId: string; conflictIsm: string; conflictFamiliya: string; conflictCreated: string } | null>(null);

  // Talaba ma'lumotlarini yuklash
  useEffect(() => {
    if (!user || user.rol !== 'oquvchi') return;
    const loadTalaba = async () => {
      setLoading(true);
      try {
        // Talabani topish — avval talaba_id bo'yicha, bo'lmasa ism/familiya bo'yicha
        let talaba = null;
        if (user.talaba_id) {
          const { data: byId } = await supabase
            .from('talabalar')
            .select('id, google_user_id, google_email_masked, telegram_chat_id, telegram_username, telegram_ism, avatar_url, bonus_urinish, birlashtirish_bonus_berildi')
            .eq('id', user.talaba_id)
            .maybeSingle();
          talaba = byId;
        }
        if (!talaba) {
          const { data: byName } = await supabase
            .from('talabalar')
            .select('id, google_user_id, google_email_masked, telegram_chat_id, telegram_username, telegram_ism, avatar_url, bonus_urinish, birlashtirish_bonus_berildi')
            .eq('ism', user.ism)
            .eq('familiya', user.familiya)
            .is('merged_into', null)
            .maybeSingle();
          talaba = byName;
        }

        if (talaba) {
          setTalabaId(talaba.id);
          setGoogleLinked(!!talaba.google_user_id);
          setGoogleEmailMasked(talaba.google_email_masked || '');
          setTelegramLinked(!!talaba.telegram_chat_id);
          setTelegramDisplay(talaba.telegram_username || talaba.telegram_ism || '');
          setTasdiqlangan(!!talaba.google_user_id && !!talaba.telegram_chat_id);
          setAvatarUrl(talaba.avatar_url);
          setBonusUrinish(talaba.bonus_urinish || 0);
        }

        // Bonus miqdori
        const { data: bonusData } = await supabase
          .from('settings')
          .select('text_value')
          .eq('key', 'LINK_BONUS_ATTEMPTS')
          .maybeSingle();
        if (bonusData?.text_value) setBonusCount(parseInt(bonusData.text_value) || 3);
      } finally {
        setLoading(false);
      }
    };
    loadTalaba();
  }, [user]);

  const stopLinkPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setLinkPolling(false);
  }, []);

  // Telegramni ulash
  const handleLinkTelegram = async () => {
    if (!talabaId) return;
    setLinkLoading(true);
    try {
      const platform = detectPlatform();
      const res = await fetch(`${supabaseUrl}/functions/v1/link-telegram-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ talaba_id: talabaId, platform }),
      });
      const data = await res.json();
      if (data?.error) {
        toast({ title: 'Xato', description: data.error, variant: 'destructive' });
        return;
      }
      if (data?.deepLink) {
        const tokenHash = data.tokenHash as string;
        setLinkTokenHash(tokenHash);
        linkTokenHashRef.current = tokenHash;
        window.open(data.deepLink, '_blank');
        setLinkPolling(true);
        const startTime = Date.now();
        pollingRef.current = setInterval(async () => {
          // 15 daqiqa timeout
          if (Date.now() - startTime > 15 * 60 * 1000) {
            stopLinkPolling();
            toast({ title: 'Vaqt tugadi', description: 'Telegram ulash amalga oshmadi', variant: 'destructive' });
            return;
          }
          const currentHash = linkTokenHashRef.current;
          if (!currentHash) { stopLinkPolling(); return; }

          try {
            const statusRes = await fetch(`${supabaseUrl}/functions/v1/link-telegram-status`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({ tokenHash: currentHash }),
            });
            const statusData = await statusRes.json();

            if (statusData?.status === 'linked' && statusData?.talaba) {
              stopLinkPolling();
              setTelegramLinked(true);
              setTasdiqlangan(googleLinked && !!statusData.talaba.tasdiqlangan);
              if (statusData.talaba.id && statusData.talaba.id !== talabaId) {
                setTalabaId(statusData.talaba.id);
              }
              // Yangi talaba ma'lumotlarini o'qib telegram display ni yangilash
              const { data: freshTalaba } = await supabase
                .from('talabalar')
                .select('telegram_username, telegram_ism, google_email_masked')
                .eq('id', statusData.talaba.id)
                .maybeSingle();
              if (freshTalaba) {
                setTelegramDisplay(freshTalaba.telegram_username || freshTalaba.telegram_ism || '');
                setGoogleEmailMasked(freshTalaba.google_email_masked || '');
              }
              if (googleLinked && !tasdiqlangan) {
                toast({ title: 'Tabriklaymiz!', description: `Telegram ulandi. +${bonusCount} Moot Court urinishi berildi!` });
              } else {
                toast({ title: 'Telegram ulandi!', description: 'Endi profil rasmi ham qo\'yishingiz mumkin' });
              }
              return;
            }

            if (statusData?.status === 'merged' && statusData?.talaba) {
              stopLinkPolling();
              // Sessiya asosiy talabaga o'tsin
              if (statusData.talaba.id && statusData.talaba.id !== talabaId) {
                setTalabaId(statusData.talaba.id);
              }
              setTelegramLinked(true);
              setGoogleLinked(true);
              setTasdiqlangan(true);
              // Yangi talaba ma'lumotlarini o'qib display larni yangilash
              const { data: freshTalaba } = await supabase
                .from('talabalar')
                .select('telegram_username, telegram_ism, google_email_masked')
                .eq('id', statusData.talaba.id)
                .maybeSingle();
              if (freshTalaba) {
                setTelegramDisplay(freshTalaba.telegram_username || freshTalaba.telegram_ism || '');
                setGoogleEmailMasked(freshTalaba.google_email_masked || '');
              }
              // Auth sessiyani yangilash
              login({
                ...user!,
                talaba_id: statusData.talaba.id,
                ism: statusData.talaba.ism,
                familiya: statusData.talaba.familiya,
                guruh: statusData.talaba.guruh,
                kurs: statusData.talaba.kurs,
                tasdiqlangan: true,
                google_linked: true,
                telegram_linked: true,
              });
              setMergeConflict(null);
              toast({ title: 'Birlashtirildi!', description: 'Akkauntlar muvaffaqiyatli birlashtirildi' });
              return;
            }

            if (statusData?.status === 'conflict') {
              setMergeConflict({
                conflictTalabaId: '',
                conflictIsm: '',
                conflictFamiliya: '',
                conflictCreated: '',
              });
              return;
            }

            if (statusData?.status === 'rejected') {
              stopLinkPolling();
              toast({ title: 'Rad etildi', description: 'Birlashtirish rad etildi', variant: 'destructive' });
              setMergeConflict(null);
              return;
            }

            if (statusData?.status === 'cancelled') {
              stopLinkPolling();
              toast({ title: 'Bekor qilindi', description: 'Telegram botda birlashtirish bekor qilindi', variant: 'destructive' });
              setMergeConflict(null);
              return;
            }

            if (statusData?.status === 'expired') {
              stopLinkPolling();
              toast({ title: 'Vaqt tugadi', description: 'Havola muddati o\'tdi. Qaytadan urinib ko\'ring.', variant: 'destructive' });
              return;
            }
          } catch {
            // network error — davom etamiz
          }
        }, 2000);
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setLinkLoading(false);
    }
  };

  // Googleni ulash
  const handleLinkGoogle = async () => {
    if (!talabaId) return;
    const { error } = await startGoogleLink(talabaId);
    if (error) {
      toast({ title: 'Google xatosi', description: error, variant: 'destructive' });
    }
  };

  // Avatar yuklash — crop + resize + upload
  const handleAvatarChange = async (file: File) => {
    if (!talabaId || !tasdiqlangan) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Rasm emas', description: 'Iltimos, rasm faylini tanlang', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Rasm katta', description: 'Maksimal hajm 10MB', variant: 'destructive' });
      return;
    }

    setAvatarUploading(true);
    try {
      // Canvas orqali kvadratga kesish va 512x512 ga kichraytirish
      const img = await loadImage(file);
      const canvas = cropCanvasRef.current || document.createElement('canvas');
      const size = 512;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas yaratilmadi');

      // Kvadratga kesish (markaziy qism)
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      // WebP formatida chiqarish (yoki JPEG fallback)
      const mimeType = canvas.toDataURL('image/webp') ? 'image/webp' : 'image/jpeg';
      const blob: Blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b!), mimeType, 0.85);
      });

      // Edge function orqali yuklash
      const formData = new FormData();
      formData.append('talaba_id', talabaId);
      formData.append('file', new File([blob], 'avatar.webp', { type: mimeType }));

      const res = await fetch(`${supabaseUrl}/functions/v1/upload-avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (data?.error) {
        toast({ title: 'Xato', description: data.error, variant: 'destructive' });
        return;
      }
      if (data?.avatarUrl) {
        const cacheBustUrl = `${data.avatarUrl}?v=${Date.now()}`;
        setAvatarUrl(cacheBustUrl);
        window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatarUrl: cacheBustUrl } }));
        toast({ title: 'Rasm yangilandi', description: 'Profil rasmingiz saqlandi' });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Rasm yuklanmadi', variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    if (!talabaId) return;
    setAvatarUploading(true);
    try {
      // Edge function orqali o'chirish uchun avatar_url ni null qilamiz
      const { error } = await supabase
        .from('talabalar')
        .update({ avatar_url: null })
        .eq('id', talabaId);
      if (error) throw error;

      // Storage'dan ham o'chirish (service role kerak, lekin anon storage policy bo'lsa)
      const paths = ['jpg', 'png', 'webp'].map(ext => `${talabaId}/avatar.${ext}`);
      await supabase.storage.from('avatars').remove(paths);

      setAvatarUrl(null);
      window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatarUrl: null } }));
      toast({ title: 'Rasm o\'chirildi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user || user.rol !== 'oquvchi') return null;

  const avatarInitials = `${(user.familiya?.[0] || '')}${(user.ism?.[0] || '')}`.toUpperCase();

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
      <canvas ref={cropCanvasRef} className="hidden" width={512} height={512} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAvatarChange(f);
          e.target.value = '';
        }}
      />

      {/* Sarlavha */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <span className="font-bold text-sm text-gray-700">Akkauntni birlashtirish</span>
        {tasdiqlangan && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ulangan
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Mukofotlar ro'yxati */}
        {!tasdiqlangan && (
          <div className="space-y-2.5">
            <p className="text-xs text-gray-500 font-medium">Uchta mukofot oling:</p>
            <div className="grid grid-cols-3 gap-2">
              {/* Bonus urinish */}
              <div className="rounded-xl p-3 text-center border border-amber-200 bg-amber-50">
                <Award className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-black text-amber-600">+{bonusCount}</p>
                <p className="text-[10px] text-amber-700 font-medium leading-tight">Moot Court urinish</p>
              </div>
              {/* Tasdiq belgisi */}
              <div className="rounded-xl p-3 text-center border border-gray-200 bg-gray-50">
                <TasdiqlanganBelgi size={20} className="mx-auto mb-1" />
                <p className="text-[10px] text-gray-600 font-medium leading-tight mt-1">Tasdiqlangan belgi</p>
              </div>
              {/* Profil rasmi */}
              <div className="rounded-xl p-3 text-center border border-blue-200 bg-blue-50">
                <ImageIcon className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <p className="text-[10px] text-blue-700 font-medium leading-tight mt-1">Profil rasmi</p>
              </div>
            </div>
          </div>
        )}

        {/* Bog'langan holatlar */}
        <div className="space-y-2">
          {/* Google holati */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-700">Google</span>
            </div>
            {googleLinked ? (
              <div className="flex items-center gap-2">
                {googleEmailMasked && (
                  <span className="text-xs text-gray-500 font-medium">{googleEmailMasked}</span>
                )}
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ulangan
                </span>
              </div>
            ) : (
              <button onClick={handleLinkGoogle} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Link2 className="h-3 w-3" /> Ulash
              </button>
            )}
          </div>

          {/* Telegram holati */}
          <div className="flex items-center justify-between rounded-xl px-3 py-2.5 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #229ED9, #24A1DE)' }}>
                <svg viewBox="0 0 24 24" fill="white" width="14" height="14">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </div>
              <span className="text-sm font-semibold text-gray-700">Telegram</span>
            </div>
            {telegramLinked ? (
              <div className="flex items-center gap-2">
                {telegramDisplay && (
                  <span className="text-xs text-gray-500 font-medium">{telegramDisplay}</span>
                )}
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ulangan
                </span>
              </div>
            ) : linkPolling ? (
              <span className="flex items-center gap-1 text-xs font-bold text-blue-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kutmoqda...
              </span>
            ) : (
              <button onClick={handleLinkTelegram} disabled={linkLoading} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50">
                {linkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />} Ulash
              </button>
            )}
          </div>
        </div>

        {/* Bonus urinish ko'rsatkichi */}
        {tasdiqlangan && bonusUrinish > 0 && (
          <div className="rounded-xl px-3 py-2.5 bg-amber-50 border border-amber-200 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-amber-700">Qo'shimcha urinishlar: {bonusUrinish}</span>
          </div>
        )}

        {/* Avatar qismi */}
        <div className="pt-3 border-t border-gray-100">
          {tasdiqlangan ? (
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <Avatar
                  src={avatarUrl}
                  alt="Profil rasmi"
                  initials={avatarInitials}
                  shape="square"
                  size={64}
                  borderClasses="border-2 border-gray-200 shadow-sm"
                  fallbackGradient="from-blue-500 to-indigo-600"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md border-2 border-white transition disabled:opacity-50"
                  title="Profil rasmini yuklash"
                >
                  {avatarUploading ? <Loader2 className="h-3 w-3 text-white animate-spin" /> : <Camera className="h-3 w-3 text-white" />}
                </button>
                {avatarUrl && (
                  <button
                    onClick={handleAvatarDelete}
                    disabled={avatarUploading}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center shadow-md border-2 border-white transition disabled:opacity-50"
                    title="Profil rasmini o'chirish"
                  >
                    <Trash2 className="h-2.5 w-2.5 text-white" />
                  </button>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700">Profil rasmi</p>
                <p className="text-xs text-gray-400">512x512 px, WebP/JPEG</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 opacity-60">
              <div className="relative w-16 h-16 flex-shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center text-gray-400">
                  <Lock className="h-6 w-6" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">Profil rasmi qulflangan</p>
                <p className="text-xs text-gray-400">Rasm qo'yish uchun Google va Telegramni ulang</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Birlashtirish tasdiq oynasi — endi bot ichida */}
      {mergeConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-amber-50 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="font-bold text-sm text-gray-800">Akkaunt birlashtirish</span>
              <button
                onClick={() => setMergeConflict(null)}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">
                Bu Telegram akkaunt boshqa akkauntga bog'langan.
              </p>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-center">
                <p className="text-sm font-bold text-blue-700">
                  Telegram botda tasdiqlang
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Bot yuborgan xabardagi tugmalardan birini bosing
                </p>
              </div>
              <button
                onClick={() => setMergeConflict(null)}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: File → Image element
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasm yuklanmadi')); };
    img.src = url;
  });
}
