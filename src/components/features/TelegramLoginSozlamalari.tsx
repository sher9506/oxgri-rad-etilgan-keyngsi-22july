import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Save, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Webhook, Play, Plus, X, Key, Hash, Globe,
  Trash2, ArrowRightLeft, LogIn
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const AUTO_WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-login`;

const SETTING_KEYS = [
  'TELEGRAM_LOGIN_BOT_TOKEN',
  'TELEGRAM_LOGIN_CHANNEL_IDS',
  'TELEGRAM_LOGIN_BOT_WEBHOOK_URL',
  'TELEGRAM_LOGIN_BOT_LINK',
  'TELEGRAM_LOGIN_SITE_URL',
];

export default function TelegramLoginSozlamalari() {
  const [token, setToken] = useState('');
  const [channels, setChannels] = useState<string[]>(['']);
  const [botLink, setBotLink] = useState('');
  const [siteUrl, setSiteUrl] = useState('https://fanfaster.uz');
  const [webhookUrl, setWebhookUrl] = useState(AUTO_WEBHOOK_URL);

  const [tokenKo, setTokenKo] = useState(false);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [saqlanyapti, setSaqlanyapti] = useState(false);
  const [webhookSaqlanyapti, setWebhookSaqlanyapti] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'success' | 'error' | null>(null);
  const [webhookInfo, setWebhookInfo] = useState('');
  const [botInfo, setBotInfo] = useState<{ username?: string; first_name?: string } | null>(null);
  const [botInfoYuklanyapti, setBotInfoYuklanyapti] = useState(false);

  const { toast } = useToast();

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, text_value')
        .in('key', SETTING_KEYS);

      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });

      setToken(map['TELEGRAM_LOGIN_BOT_TOKEN'] || '');
      const list = (map['TELEGRAM_LOGIN_CHANNEL_IDS'] || '').split(',').map((c: string) => c.trim()).filter(Boolean);
      setChannels(list.length > 0 ? list : ['']);
      setBotLink(map['TELEGRAM_LOGIN_BOT_LINK'] || '');
      setSiteUrl(map['TELEGRAM_LOGIN_SITE_URL'] || 'https://fanfaster.uz');
      setWebhookUrl(map['TELEGRAM_LOGIN_BOT_WEBHOOK_URL'] || AUTO_WEBHOOK_URL);

      if (map['TELEGRAM_LOGIN_BOT_TOKEN']) {
        botMalumotOlish(map['TELEGRAM_LOGIN_BOT_TOKEN']);
      }
    } finally {
      setYuklanyapti(false);
    }
  }, []);

  useEffect(() => { yuklash(); }, [yuklash]);

  const botMalumotOlish = async (tok?: string): Promise<boolean> => {
    const t = (tok || token).trim();
    if (!t) return false;
    setBotInfoYuklanyapti(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-api', {
        body: { token: t, method: 'getMe' },
      });
      if (error) throw error;
      const result = data;
      if (result.ok) {
        setBotInfo(result.result);
        return true;
      }
      setBotInfo(null);
      toast({ title: "❌ Token noto'g'ri", description: result.description, variant: 'destructive' });
      return false;
    } catch {
      setBotInfo(null);
      return false;
    } finally {
      setBotInfoYuklanyapti(false);
    }
  };

  const webhookAlmashtir = async (eskiToken: string, yangiToken: string): Promise<boolean> => {
    const targetUrl = AUTO_WEBHOOK_URL;

    if (eskiToken.trim() && eskiToken.trim() !== yangiToken.trim()) {
      try {
        await supabase.functions.invoke('telegram-api', {
          body: { token: eskiToken.trim(), method: 'deleteWebhook', body: { drop_pending_updates: true } },
        });
      } catch {}
    }

    try {
      const { data: result, error } = await supabase.functions.invoke('telegram-api', {
        body: {
          token: yangiToken.trim(),
          method: 'setWebhook',
          body: { url: targetUrl, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true },
        },
      });
      if (error) throw error;
      if (result.ok) {
        await supabase.from('settings').upsert(
          { key: 'TELEGRAM_LOGIN_BOT_WEBHOOK_URL', text_value: targetUrl, value: true, tavsif: 'Login Bot Webhook URL' },
          { onConflict: 'key' }
        );
        setWebhookUrl(targetUrl);
        setWebhookInfo(targetUrl);
        setWebhookStatus('success');
        return true;
      }
      setWebhookStatus('error');
      setWebhookInfo(result.description || "Webhook o'rnatilmadi");
      return false;
    } catch (e: any) {
      setWebhookStatus('error');
      setWebhookInfo(e.message);
      return false;
    }
  };

  const saqlash = async () => {
    if (!token.trim()) {
      toast({ title: 'Xato', description: 'Bot token kiritilmagan', variant: 'destructive' });
      return;
    }
    setSaqlanyapti(true);
    try {
      const channelsStr = channels.map((c) => c.trim()).filter(Boolean).join(',');

      const { data: eskiRow } = await supabase
        .from('settings')
        .select('text_value')
        .eq('key', 'TELEGRAM_LOGIN_BOT_TOKEN')
        .maybeSingle();
      const eskiToken = eskiRow?.text_value || '';

      await Promise.all([
        supabase.from('settings').upsert({ key: 'TELEGRAM_LOGIN_BOT_TOKEN', text_value: token.trim(), value: true, tavsif: 'Login Bot Token' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'TELEGRAM_LOGIN_CHANNEL_IDS', text_value: channelsStr, value: true, tavsif: 'Login Bot Kanallar' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'TELEGRAM_LOGIN_BOT_LINK', text_value: botLink.trim(), value: true, tavsif: 'Login Bot Havolasi' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'TELEGRAM_LOGIN_SITE_URL', text_value: siteUrl.trim(), value: true, tavsif: 'Login Bot Sayt URL' }, { onConflict: 'key' }),
      ]);

      const webhookOk = await webhookAlmashtir(eskiToken, token.trim());
      await botMalumotOlish(token.trim());

      if (webhookOk) {
        toast({ title: '✅ Saqlandi va webhook ulandi!', description: 'Login bot faol' });
      } else {
        toast({ title: '⚠️ Saqlandi, lekin webhook xato', description: "Webhook bo'limidan qayta o'rnating", variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setSaqlanyapti(false);
    }
  };

  const webhookOrnatish = async () => {
    if (!token.trim()) {
      toast({ title: 'Xato', description: 'Avval tokenni saqlang', variant: 'destructive' });
      return;
    }
    setWebhookSaqlanyapti(true);
    setWebhookStatus(null);
    try {
      const wUrl = AUTO_WEBHOOK_URL;
      const { data: result, error } = await supabase.functions.invoke('telegram-api', {
        body: {
          token: token.trim(),
          method: 'setWebhook',
          body: { url: wUrl, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true },
        },
      });
      if (error) throw error;
      if (result.ok) {
        await supabase.from('settings').upsert(
          { key: 'TELEGRAM_LOGIN_BOT_WEBHOOK_URL', text_value: wUrl, value: true },
          { onConflict: 'key' }
        );
        setWebhookUrl(wUrl);
        setWebhookStatus('success');
        setWebhookInfo(wUrl);
        toast({ title: "✅ Webhook o'rnatildi!" });
      } else {
        setWebhookStatus('error');
        setWebhookInfo(result.description || "O'rnatilmadi");
        toast({ title: '❌ Xato', description: result.description, variant: 'destructive' });
      }
    } catch (e: any) {
      setWebhookStatus('error');
      setWebhookInfo(e.message);
    } finally {
      setWebhookSaqlanyapti(false);
    }
  };

  const webhookHolat = async () => {
    if (!token.trim()) return;
    const { data: result, error } = await supabase.functions.invoke('telegram-api', {
      body: { token: token.trim(), method: 'getWebhookInfo' },
    });
    if (error) {
      setWebhookStatus('error');
      setWebhookInfo(error.message);
      return;
    }
    if (result.ok && result.result.url) {
      const info = result.result;
      setWebhookStatus('success');
      setWebhookInfo(info.url);
      toast({ title: '✅ Webhook faol', description: `Pending: ${info.pending_update_count || 0}${info.last_error_message ? ' | Xato: ' + info.last_error_message : ''}` });
    } else {
      setWebhookStatus(null);
      setWebhookInfo("Webhook o'rnatilmagan");
      toast({ title: "⚠️ Webhook o'rnatilmagan" });
    }
  };

  const webhookOchirish = async () => {
    if (!token.trim()) return;
    const { data: result, error } = await supabase.functions.invoke('telegram-api', {
      body: { token: token.trim(), method: 'deleteWebhook', body: { drop_pending_updates: true } },
    });
    if (error) return;
    if (result.ok) {
      setWebhookStatus(null);
      setWebhookInfo("O'chirildi");
      toast({ title: "Webhook o'chirildi" });
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500 bg-gray-50';

  if (yuklanyapti) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <Card className="border-2 border-green-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <LogIn className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Telegram Login Bot</h1>
              <p className="text-green-200 text-sm mt-1">Login-parolsiz Telegram orqali kirish</p>
            </div>
          </div>
          {botInfo && (
            <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">🤖</div>
              <div>
                <p className="font-bold">{botInfo.first_name}</p>
                <p className="text-green-200 text-sm">@{botInfo.username}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-500/30 border border-green-400/50 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs font-bold">FAOL</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Qanday ishlaydi */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="py-4 px-5">
          <p className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <span className="text-lg">ℹ️</span> Bu bot qanday ishlaydi?
          </p>
          <ol className="space-y-1.5 text-xs text-blue-800">
            <li className="flex items-start gap-2"><span className="font-black text-blue-600 flex-shrink-0">1.</span> Foydalanuvchi saytda <b>"Telegram orqali kirish"</b> tugmasini bosadi</li>
            <li className="flex items-start gap-2"><span className="font-black text-blue-600 flex-shrink-0">2.</span> Telegram botga maxsus havola bilan yo'naltiriladi (<code className="bg-blue-100 px-1 rounded">?start=TOKEN</code>)</li>
            <li className="flex items-start gap-2"><span className="font-black text-blue-600 flex-shrink-0">3.</span> Bot telefon raqamini so'raydi va kanal a'zoligini tekshiradi</li>
            <li className="flex items-start gap-2"><span className="font-black text-blue-600 flex-shrink-0">4.</span> Foydalanuvchi topiladi yoki yangi profil yaratiladi</li>
            <li className="flex items-start gap-2"><span className="font-black text-blue-600 flex-shrink-0">5.</span> Sayt avtomatik ravishda foydalanuvchini tizimga kiritadi — <b>login-parol kerak emas!</b></li>
          </ol>
        </CardContent>
      </Card>

      {/* Bot havolasi */}
      <Card className="border-2 border-cyan-400 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-cyan-600" />Bot Havolasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Login bot URL
              <span className="ml-2 text-xs text-gray-400 font-normal">Masalan: https://t.me/fanfaster_login_bot</span>
            </label>
            <input
              type="url"
              value={botLink}
              onChange={(e) => setBotLink(e.target.value)}
              placeholder="https://t.me/sizning_login_botingiz"
              className={inputCls}
            />
          </div>
        </CardContent>
      </Card>

      {/* Token va Kanallar */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-green-600" />Token va Kanallar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              <b>Muhim:</b> Bu bot ro'yxatdan o'tish botlaridan <b>alohida</b> bot bo'lishi kerak.
              Har bir botning o'z tokeni bo'ladi.
            </p>
          </div>

          {/* Token */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Login Bot Token <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">@BotFather dan</span>
            </label>
            <div className="relative">
              <input
                type={tokenKo ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="1234567890:AABBCCDDxx..."
                className={`${inputCls} pr-24`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button onClick={() => setTokenKo((p) => !p)} className="p-2 text-gray-400 hover:text-gray-600">
                  {tokenKo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => botMalumotOlish()}
                  disabled={botInfoYuklanyapti || !token.trim()}
                  className="p-2 text-green-500 hover:text-green-700 disabled:opacity-40"
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
                <Hash className="h-4 w-4 text-green-500" />Majburiy Kanallar
                <span className="text-xs text-gray-400 font-normal">({channels.filter(Boolean).length} ta)</span>
              </label>
              <button
                onClick={() => { if (channels.length < 10) setChannels([...channels, '']); }}
                className="flex items-center gap-1 px-3 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-bold border border-green-200 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />Qo'shish
              </button>
            </div>
            <div className="space-y-2">
              {channels.map((ch, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-black flex items-center justify-center flex-shrink-0">{idx + 1}</div>
                  <input
                    type="text"
                    value={ch}
                    onChange={(e) => { const n = [...channels]; n[idx] = e.target.value; setChannels(n); }}
                    placeholder="@kanal yoki -1001234567890"
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-green-500 bg-gray-50"
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
            <p className="text-xs text-gray-400 mt-1.5">Bo'sh qoldiring — kanalsiz kirish ishlaydi.</p>
          </div>

          {/* Sayt URL */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-500" />Sayt URL (bot xabarida havolasi bo'ladi)
            </label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="https://fanfaster.uz"
              className={inputCls}
            />
          </div>

          <Button
            onClick={saqlash}
            disabled={saqlanyapti || !token.trim()}
            className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl"
          >
            {saqlanyapti
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</>
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
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs font-mono text-gray-500 break-all border border-gray-200">
            {AUTO_WEBHOOK_URL}
          </div>

          {webhookStatus === 'success' && (
            <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border-2 border-green-300 rounded-2xl">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-800 font-semibold">Webhook faol!</p>
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
        </CardContent>
      </Card>

      {/* Qo'llanma */}
      <Card className="border border-green-200 bg-green-50">
        <CardContent className="py-4 px-5">
          <p className="font-bold text-green-900 mb-2">📋 Sozlash tartibi:</p>
          <ol className="space-y-1 list-decimal list-inside text-xs text-green-800">
            <li>@BotFather orqali <b>yangi bot</b> yarating (login botidan alohida)</li>
            <li>Tokenni kiriting → <b>Saqlash</b> (webhook avtomatik ulanadi)</li>
            <li>Bot havolasini kiriting (https://t.me/bot_username)</li>
            <li>Ixtiyoriy: majburiy kanallarni kiriting</li>
            <li>Saytda <b>Telegram orqali kirish</b> tugmasi faol bo'ladi</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
