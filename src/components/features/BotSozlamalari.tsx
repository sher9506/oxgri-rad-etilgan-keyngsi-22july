import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Save, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Webhook, Play, Plus, X, Key, Hash, Globe,
  Trash2, MessageSquare, ChevronDown, ChevronUp, Edit3, RotateCcw,
  ArrowRightLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ── Xabar shablonlari ──
const MSG_KEYS = [
  { key: 'BOT_MSG_WELCOME', label: "Xush kelibsiz (/start)", icon: '🚀', hint: "{KANALLAR} — kanallar ro'yxati" },
  { key: 'BOT_MSG_PHONE_NO_CHANNEL', label: "Telefon olgach (kanal yo'q)", icon: '📱', hint: '' },
  { key: 'BOT_MSG_PHONE_WITH_CHANNEL', label: "Telefon olgach (kanal bor, a'zo)", icon: '✅', hint: '' },
  { key: 'BOT_MSG_CHANNEL_REQUIRED', label: "Kanal tekshirish (a'zo emas)", icon: '📢', hint: "{KANALLAR} — a'zo bo'lmagan kanallar" },
  { key: 'BOT_MSG_CHANNEL_WAIT', label: 'Kanal kutilmoqda (matn yozsa)', icon: '⏳', hint: '' },
  { key: 'BOT_MSG_NAME_PROMPT', label: 'Kanal tasdiq → Ism-familiya', icon: '👤', hint: '' },
  { key: 'BOT_MSG_LOGIN_PROMPT', label: 'Ism kiritildi → Login', icon: '🔑', hint: "{ISM}, {FAMILIYA} — foydalanuvchi ma'lumoti" },
  { key: 'BOT_MSG_LOGIN_TAKEN', label: 'Login band', icon: '❌', hint: '{LOGIN} — kiritilgan login' },
  { key: 'BOT_MSG_PASSWORD_PROMPT', label: 'Login OK → Parol', icon: '🔒', hint: '{LOGIN} — qabul qilingan login' },
  { key: 'BOT_MSG_SUCCESS', label: 'Muvaffaqiyatli yakunlandi 🎉', icon: '🎉', hint: '{ISM}, {FAMILIYA}, {LOGIN}, {PAROL}' },
];

const SETTING_KEYS = [
  'TELEGRAM_TOKEN', 'TELEGRAM_CHANNEL_IDS', 'TELEGRAM_WEBHOOK_URL',
  'BOT_SITE_URL', 'BOT_SITE_BUTTON_TEXT', 'TELEGRAM_BOT_LINK',
  ...MSG_KEYS.map(m => m.key),
];

interface SettingRow { key: string; text_value: string; tavsif: string; }

export default function BotSozlamalari() {
  const [token, setToken] = useState('');
  const [channels, setChannels] = useState<string[]>(['']);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('https://fanfaster.uz');
  const [siteBtnText, setSiteBtnText] = useState('🌐 FanFaster.uz saytiga kirish');
  const [botLink, setBotLink] = useState('');
  const [botLinkSaqlanyapti, setBotLinkSaqlanyapti] = useState(false);
  const [tokenKo, setTokenKo] = useState(false);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [saqlanyapti, setSaqlanyapti] = useState(false);
  const [webhookSaqlanyapti, setWebhookSaqlanyapti] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'success' | 'error' | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<string>('');
  const [botInfo, setBotInfo] = useState<{ username?: string; first_name?: string } | null>(null);
  const [botInfoYuklanyapti, setBotInfoYuklanyapti] = useState(false);

  // Xabar shablonlari
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [msgsOriginal, setMsgsOriginal] = useState<Record<string, string>>({});
  const [msgSaqlanyapti, setMsgSaqlanyapti] = useState<Record<string, boolean>>({});
  const [ochiqMsg, setOchiqMsg] = useState<string | null>(null);

  const { toast } = useToast();

  // Webhook URL: VITE_SUPABASE_URL dan avtomatik olinadi
  const autoWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`;

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, text_value, tavsif')
        .in('key', SETTING_KEYS);

      const map: Record<string, string> = {};
      (data || []).forEach((r: SettingRow) => { map[r.key] = r.text_value || ''; });

      setToken(map['TELEGRAM_TOKEN'] || '');
      const list = (map['TELEGRAM_CHANNEL_IDS'] || '').split(',').map(c => c.trim()).filter(Boolean);
      setChannels(list.length > 0 ? list : ['']);
      setWebhookUrl(map['TELEGRAM_WEBHOOK_URL'] || autoWebhookUrl);
      setSiteUrl(map['BOT_SITE_URL'] || 'https://fanfaster.uz');
      setSiteBtnText(map['BOT_SITE_BUTTON_TEXT'] || '🌐 FanFaster.uz saytiga kirish');
      setBotLink(map['TELEGRAM_BOT_LINK'] || '');

      const msgMap: Record<string, string> = {};
      MSG_KEYS.forEach(m => { msgMap[m.key] = map[m.key] || ''; });
      setMsgs(msgMap);
      setMsgsOriginal(msgMap);

      // Bot ma'lumotlarini yuklab ko'rsatish
      if (map['TELEGRAM_TOKEN']) {
        botMalumotOlish(map['TELEGRAM_TOKEN']);
      }
    } finally {
      setYuklanyapti(false);
    }
  }, []);

  useEffect(() => { yuklash(); }, [yuklash]);

  // ── Bot link saqlash ──
  const botLinkSaqla = async () => {
    setBotLinkSaqlanyapti(true);
    try {
      await supabase.from('settings').upsert(
        { key: 'TELEGRAM_BOT_LINK', text_value: botLink.trim(), value: true, tavsif: "O'quvchilar ro'yxatdan o'tish uchun Telegram bot havolasi" },
        { onConflict: 'key' }
      );
      toast({ title: '✅ Bot havola saqlandi!', description: "O'quvchilar endi bu linkga yo'naltiriladi" });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setBotLinkSaqlanyapti(false);
    }
  };

  // ── Eski webhookni o'chirib, yangi tokenda o'rnatish ──
  const webhookAlmashtir = async (eskiToken: string, yangiToken: string): Promise<boolean> => {
    const targetUrl = autoWebhookUrl;

    // 1. Eski tokendan webhookni o'chir (agar token o'zgangan bo'lsa)
    if (eskiToken.trim() && eskiToken.trim() !== yangiToken.trim()) {
      try {
        const eskiRes = await fetch(`https://api.telegram.org/bot${eskiToken.trim()}/deleteWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drop_pending_updates: true }),
        });
        const eskiResult = await eskiRes.json();
        console.log('Eski webhook o\'chirish natijasi:', eskiResult.ok ? '✅' : '⚠️', eskiResult.description || '');
      } catch (e) {
        console.warn("Eski webhook o'chirishda xato (davom etamiz):", e);
      }
    }

    // 2. Yangi tokenda webhook o'rnat
    try {
      const res = await fetch(`https://api.telegram.org/bot${yangiToken.trim()}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: true,
        }),
      });
      const result = await res.json();

      if (result.ok) {
        await supabase.from('settings').upsert(
          { key: 'TELEGRAM_WEBHOOK_URL', text_value: targetUrl, value: true, tavsif: 'Bot Webhook URL' },
          { onConflict: 'key' }
        );
        setWebhookUrl(targetUrl);
        setWebhookInfo(targetUrl);
        setWebhookStatus('success');
        return true;
      } else {
        console.error('Webhook xato:', result.description);
        setWebhookStatus('error');
        setWebhookInfo(result.description || 'Noma\'lum xato');
        return false;
      }
    } catch (e: any) {
      setWebhookStatus('error');
      setWebhookInfo(e.message);
      return false;
    }
  };

  // ── Token va kanallar saqlash ──
  const saqlash = async () => {
    if (!token.trim()) {
      toast({ title: 'Xato', description: 'Bot token kiritilmagan', variant: 'destructive' });
      return;
    }
    setSaqlanyapti(true);
    try {
      const channelsStr = channels.map(c => c.trim()).filter(Boolean).join(',');

      // Avvalgi tokenni olish
      const { data: eskiRow } = await supabase
        .from('settings')
        .select('text_value')
        .eq('key', 'TELEGRAM_TOKEN')
        .maybeSingle();
      const eskiToken = eskiRow?.text_value || '';

      // Sozlamalarni saqlash
      await Promise.all([
        supabase.from('settings').upsert({ key: 'TELEGRAM_TOKEN', text_value: token.trim(), value: true, tavsif: 'Telegram Bot Token' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'TELEGRAM_CHANNEL_IDS', text_value: channelsStr, value: true, tavsif: 'Telegram Kanal IDlar' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'BOT_SITE_URL', text_value: siteUrl.trim(), value: true, tavsif: 'Sayt URL' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'BOT_SITE_BUTTON_TEXT', text_value: siteBtnText.trim(), value: true, tavsif: 'Sayt tugmasi matni' }, { onConflict: 'key' }),
      ]);

      // Webhook: eski tokenni o'chirib yangi tokenda o'rnatish
      const webhookOk = await webhookAlmashtir(eskiToken, token.trim());

      // Bot ma'lumotlarini olish
      await botMalumotOlish(token.trim());

      if (webhookOk) {
        toast({ title: '✅ Saqlandi va webhook ulandi!', description: 'Bot faol — /start yuboring' });
      } else {
        toast({
          title: '⚠️ Saqlandi, lekin webhook xato',
          description: "Token to'g'ri bo'lsa, Webhook bo'limidan qayta 'O'rnatish' ni bosing.",
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setSaqlanyapti(false);
    }
  };

  // ── Bitta xabarni saqlash ──
  const msgSaqlash = async (key: string) => {
    setMsgSaqlanyapti(p => ({ ...p, [key]: true }));
    try {
      await supabase.from('settings').upsert(
        { key, text_value: msgs[key], value: true },
        { onConflict: 'key' }
      );
      setMsgsOriginal(p => ({ ...p, [key]: msgs[key] }));
      toast({ title: '✅ Xabar saqlandi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setMsgSaqlanyapti(p => ({ ...p, [key]: false }));
    }
  };

  const msgTiklash = (key: string) => {
    setMsgs(p => ({ ...p, [key]: msgsOriginal[key] }));
  };

  // ── Webhook amallar ──
  const webhookOrnatish = async () => {
    if (!token.trim()) {
      toast({ title: 'Xato', description: 'Avval tokenni saqlang', variant: 'destructive' });
      return;
    }
    setWebhookSaqlanyapti(true);
    setWebhookStatus(null);
    setWebhookInfo('');
    try {
      const wUrl = webhookUrl.trim() || autoWebhookUrl;
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: wUrl, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true }),
      });
      const result = await res.json();
      if (result.ok) {
        await supabase.from('settings').upsert(
          { key: 'TELEGRAM_WEBHOOK_URL', text_value: wUrl, value: true, tavsif: 'Bot Webhook URL' },
          { onConflict: 'key' }
        );
        setWebhookUrl(wUrl);
        setWebhookStatus('success');
        setWebhookInfo(wUrl);
        toast({ title: '✅ Webhook o\'rnatildi!', description: 'Bot faol — /start yuboring' });
      } else {
        setWebhookStatus('error');
        setWebhookInfo(result.description || "Webhook o'rnatilmadi");
        toast({ title: '❌ Xato', description: result.description || "Webhook o'rnatilmadi", variant: 'destructive' });
      }
    } catch (e: any) {
      setWebhookStatus('error');
      setWebhookInfo(e.message);
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setWebhookSaqlanyapti(false);
    }
  };

  const webhookHolat = async () => {
    if (!token.trim()) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/getWebhookInfo`);
      const result = await res.json();
      if (result.ok && result.result.url) {
        const info = result.result;
        const msg = `✅ FAOL\nURL: ${info.url}\nPending: ${info.pending_update_count || 0}${info.last_error_message ? '\n❌ Oxirgi xato: ' + info.last_error_message : ''}`;
        setWebhookStatus('success');
        setWebhookInfo(info.url);
        toast({ title: '✅ Webhook faol', description: `Pending: ${info.pending_update_count || 0}${info.last_error_message ? ' | Xato: ' + info.last_error_message : ''}` });
      } else {
        setWebhookStatus(null);
        setWebhookInfo("Webhook o'rnatilmagan");
        toast({ title: "⚠️ Webhook o'rnatilmagan", description: "Webhook bo'limidan 'O'rnatish' ni bosing" });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const webhookOchirish = async () => {
    if (!token.trim()) return;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token.trim()}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: true }),
      });
      const result = await res.json();
      if (result.ok) {
        setWebhookStatus(null);
        setWebhookInfo("O'chirildi");
        toast({ title: "Webhook o'chirildi" });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const botMalumotOlish = async (t?: string): Promise<boolean> => {
    const tok = (t || token).trim();
    if (!tok) return false;
    setBotInfoYuklanyapti(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tok}/getMe`);
      const result = await res.json();
      if (result.ok) {
        setBotInfo(result.result);
        return true;
      } else {
        setBotInfo(null);
        toast({ title: "❌ Token noto'g'ri", description: result.description, variant: 'destructive' });
        return false;
      }
    } catch {
      setBotInfo(null);
      return false;
    } finally {
      setBotInfoYuklanyapti(false);
    }
  };

  if (yuklanyapti) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  const inputCls = 'w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500 bg-gray-50';

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Bot className="h-8 w-8" /></div>
            <div>
              <h1 className="text-2xl font-black">Telegram Bot Sozlamalari</h1>
              <p className="text-blue-200 text-sm mt-1">Token, kanallar va bot xabarlarini boshqaring</p>
            </div>
          </div>
          {botInfo && (
            <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">🤖</div>
              <div>
                <p className="font-bold">{botInfo.first_name}</p>
                <p className="text-blue-200 text-sm">@{botInfo.username}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-500/30 border border-green-400/50 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs font-bold">FAOL</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── RO'YXATDAN O'TISH BOT LINKI ── */}
      <Card className="border-2 border-cyan-400 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#229ED9]">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Ro'yxatdan o'tish — Bot Havolasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 text-sm text-cyan-900">
            <p className="font-bold mb-1">📌 Bu havola nima uchun?</p>
            <p className="text-cyan-800 text-xs leading-relaxed">
              O'quvchi kirish sahifasida <b>"Telegram Bot orqali ro'yxatdan o'tish"</b> tugmasini bosganida
              shu havolaga yo'naltiriladi. Odatda: <code className="bg-cyan-100 px-1 rounded">https://t.me/BOT_USERNAME</code>
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Bot havolasi (URL)
              <span className="ml-2 text-xs text-gray-400 font-normal">Masalan: https://t.me/fanfaster_bot</span>
            </label>
            <input
              type="url"
              value={botLink}
              onChange={e => setBotLink(e.target.value)}
              placeholder="https://t.me/sizning_botingiz"
              className={inputCls}
            />
          </div>
          {botLink && (
            <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 flex-shrink-0">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">Ko'rinishi:</p>
                <a href={botLink} target="_blank" rel="noopener noreferrer"
                  className="text-cyan-300 text-sm font-mono hover:underline truncate block">
                  {botLink}
                </a>
              </div>
            </div>
          )}
          <Button onClick={botLinkSaqla} disabled={botLinkSaqlanyapti}
            className="w-full h-10 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl">
            {botLinkSaqlanyapti
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</>
              : <><Save className="mr-2 h-4 w-4" />Bot havolasini saqlash</>}
          </Button>
        </CardContent>
      </Card>

      {/* Token & Kanallar */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-blue-600" />Bot Token va Kanallar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Token almashtirish haqida ogohlantirish */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold mb-0.5">Token almashtirishda nima bo'ladi?</p>
              <p>"Saqlash" tugmasini bosganda: <b>eski botdan webhook o'chiriladi</b> → <b>yangi botga webhook ulanadi</b>. Hech narsa qo'shimcha qilish shart emas.</p>
            </div>
          </div>

          {/* Token */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Bot Token <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">@BotFather dan</span>
            </label>
            <div className="relative">
              <input
                type={tokenKo ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="1234567890:AABBCCDDxx..."
                className={`${inputCls} pr-24`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button onClick={() => setTokenKo(p => !p)} className="p-2 text-gray-400 hover:text-gray-600">
                  {tokenKo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => botMalumotOlish()}
                  disabled={botInfoYuklanyapti || !token.trim()}
                  className="p-2 text-blue-500 hover:text-blue-700 disabled:opacity-40"
                  title="Token tekshirish"
                >
                  {botInfoYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Kanallar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <Hash className="h-4 w-4 text-blue-500" />Majburiy Kanallar
                <span className="text-xs text-gray-400 font-normal">({channels.filter(Boolean).length} ta)</span>
              </label>
              <button
                onClick={() => { if (channels.length < 10) setChannels([...channels, '']); }}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />Qo'shish
              </button>
            </div>
            <div className="space-y-2">
              {channels.map((ch, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-black flex items-center justify-center flex-shrink-0">{idx + 1}</div>
                  <input
                    type="text"
                    value={ch}
                    onChange={e => { const n = [...channels]; n[idx] = e.target.value; setChannels(n); }}
                    placeholder="@kanalingiz yoki -1001234567890"
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500 bg-gray-50"
                  />
                  {channels.length > 1 && (
                    <button
                      onClick={() => { const n = channels.filter((_, i) => i !== idx); setChannels(n.length ? n : ['']); }}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Kanal yo'q bo'lsa — ro'yxatdan o'tish kanalsiz amalga oshiriladi.
            </p>
          </div>

          {/* Sayt sozlamalari */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-emerald-500" />Sayt URL
              </label>
              <input type="text" value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                placeholder="https://fanfaster.uz" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Tugma matni</label>
              <input type="text" value={siteBtnText} onChange={e => setSiteBtnText(e.target.value)}
                placeholder="🌐 Saytga kirish" className={inputCls} />
            </div>
          </div>

          <Button
            onClick={saqlash}
            disabled={saqlanyapti || !token.trim()}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl"
          >
            {saqlanyapti
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda va webhook ulanmoqda...</>
              : <><Save className="mr-2 h-4 w-4" />Saqlash (webhook avtomatik ulanadi)</>}
          </Button>
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card className="border-2 border-indigo-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-5 w-5 text-indigo-600" />Webhook Boshqaruv
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Webhook URL</label>
            <input
              type="text"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder={autoWebhookUrl}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:border-indigo-500 bg-gray-50"
            />
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => setWebhookUrl(autoWebhookUrl)} className="text-xs text-indigo-600 hover:underline">
                Avtomatik URL ga qaytarish
              </button>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-400 font-mono truncate">{autoWebhookUrl.slice(0, 55)}...</span>
            </div>
          </div>

          {/* Holat ko'rsatgich */}
          {webhookStatus === 'success' && (
            <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border-2 border-green-300 rounded-2xl">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-800 font-semibold">Webhook faol! Bot ishlayapti.</p>
                {webhookInfo && <p className="text-xs text-green-600 mt-0.5 font-mono break-all">{webhookInfo}</p>}
              </div>
            </div>
          )}
          {webhookStatus === 'error' && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border-2 border-red-300 rounded-2xl">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800 font-semibold">Webhook xatoligi!</p>
                {webhookInfo && <p className="text-xs text-red-600 mt-0.5">{webhookInfo}</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={webhookOrnatish}
              disabled={webhookSaqlanyapti || !token.trim()}
              className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl h-10 text-sm"
            >
              {webhookSaqlanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" />O'rnatish</>}
            </Button>
            <Button
              onClick={webhookHolat}
              disabled={!token.trim()}
              variant="outline"
              className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-bold rounded-xl h-10 text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-1" />Holat
            </Button>
            <Button
              onClick={webhookOchirish}
              disabled={!token.trim()}
              variant="outline"
              className="border-2 border-red-300 text-red-600 hover:bg-red-50 font-bold rounded-xl h-10 text-sm"
            >
              <Trash2 className="h-4 w-4 mr-1" />O'chirish
            </Button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-700">Webhook nima qiladi?</p>
            <p>• <b>O'rnatish</b> — Telegramga bu URL ga xabarlarni yuboradi deydi</p>
            <p>• <b>Holat</b> — Hozirgi webhook URL va oxirgi xatoni ko'rsatadi</p>
            <p>• <b>O'chirish</b> — Webhook ni o'chirib, bot yangi tokenga bog'lanishdan oldin kerak bo'ladi</p>
          </div>
        </CardContent>
      </Card>

      {/* Bot Xabarlari */}
      <Card className="border-2 border-emerald-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 text-emerald-600" />
            Bot Xabarlari
            <span className="ml-auto text-xs text-gray-400 font-normal">Har bir xabarni alohida tahrirlang</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {MSG_KEYS.map(({ key, label, icon, hint }) => {
            const isOpen = ochiqMsg === key;
            const isDirty = msgs[key] !== msgsOriginal[key];
            return (
              <div
                key={key}
                className={`border-2 rounded-xl transition-all ${isOpen ? 'border-emerald-400 shadow-sm' : 'border-gray-200 hover:border-emerald-200'}`}
              >
                <button
                  onClick={() => setOchiqMsg(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{label}</p>
                    {hint && <p className="text-xs text-gray-400 mt-0.5">📌 {hint}</p>}
                  </div>
                  {isDirty && (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                      O'zgartirildi
                    </span>
                  )}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <textarea
                      value={msgs[key] || ''}
                      onChange={e => setMsgs(p => ({ ...p, [key]: e.target.value }))}
                      rows={8}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:border-emerald-500 bg-gray-50 resize-y leading-relaxed"
                      placeholder="Xabar matni..."
                    />
                    {hint && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800">
                        <span className="font-bold">O'zgaruvchilar:</span> {hint}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => msgSaqlash(key)}
                        disabled={msgSaqlanyapti[key]}
                        className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm"
                      >
                        {msgSaqlanyapti[key]
                          ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saqlanmoqda...</>
                          : <><Save className="h-3.5 w-3.5 mr-1.5" />Saqlash</>}
                      </Button>
                      {isDirty && (
                        <Button
                          onClick={() => msgTiklash(key)}
                          variant="outline"
                          className="h-9 px-3 border-2 border-gray-300 text-gray-600 hover:bg-gray-50 rounded-xl text-sm"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />Tiklash
                        </Button>
                      )}
                    </div>
                    {msgs[key] && (
                      <div className="bg-gray-900 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                          <Eye className="h-3 w-3" />Ko'rinishi (HTML teglarsiz):
                        </p>
                        <p
                          className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{
                            __html: (msgs[key] || '')
                              .replace(/<b>/g, '').replace(/<\/b>/g, '')
                              .replace(/<i>/g, '').replace(/<\/i>/g, '')
                              .replace(/<code>/g, '`').replace(/<\/code>/g, '`')
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="mt-4 bg-amber-50 border-2 border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-800 font-semibold">
              📌 <b>HTML teglari:</b> Telegram HTML formatini qo'llab-quvvatlaydi:
              <code className="bg-amber-100 px-1 rounded mx-1">&lt;b&gt;</code> qalin,
              <code className="bg-amber-100 px-1 rounded mx-1">&lt;i&gt;</code> kursiv,
              <code className="bg-amber-100 px-1 rounded mx-1">&lt;code&gt;</code> kod formatida
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Qo'llanma */}
      <Card className="border border-amber-200 bg-amber-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3 text-sm text-amber-900">
            <Edit3 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-2">Sozlash tartibi:</p>
              <ol className="space-y-1 list-decimal list-inside text-xs">
                <li>Token va kanallarni kiriting → <b>"Saqlash"</b> — webhook avtomatik ulanadi</li>
                <li>Token almashtirganda: yangi tokenni kiritib → <b>"Saqlash"</b> — eski webhook o'chiriladi, yangi ulanadi</li>
                <li>Agar hato bo'lsa: Webhook bo'limidan <b>"Holat"</b> ni bosib xatoni ko'ring</li>
                <li>Bot xabarlarini tahrirlang → har birini "Saqlash" qiling</li>
                <li>Botga /start yuboring — sinab ko'ring</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
