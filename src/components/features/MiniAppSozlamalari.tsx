import { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, Save, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Webhook, Play, Key, Globe, MessageSquare, Hash, Link2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/miniapp-bot`;

const SETTING_KEYS = [
  'MINIAPP_BOT_TOKEN',
  'MINIAPP_BOT_USERNAME',
  'MINIAPP_URL',
  'MINIAPP_WELCOME_TEXT',
  'MINIAPP_BUTTON_TEXT',
  'MINIAPP_WEBHOOK_SECRET',
  'MINIAPP_LINK_CHANNEL',
];

const DEFAULT_WELCOME = "FanFaster botiga xush kelibsiz!\n\nPastdagi «Kirish» tugmasini bosing — kabinetingiz shu yerning o'zida, Telegram ichida ochiladi.";
const DEFAULT_BUTTON = 'Kirish';
const DEFAULT_URL = 'https://fanfaster.uz';

export default function MiniAppSozlamalari() {
  const [token, setToken] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [miniAppUrl, setMiniAppUrl] = useState(DEFAULT_URL);
  const [welcomeText, setWelcomeText] = useState(DEFAULT_WELCOME);
  const [buttonText, setButtonText] = useState(DEFAULT_BUTTON);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [linkChannel, setLinkChannel] = useState('');
  const [channelError, setChannelError] = useState('');

  const [tokenKo, setTokenKo] = useState(false);
  const [secretKo, setSecretKo] = useState(false);
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

      setToken(map['MINIAPP_BOT_TOKEN'] || '');
      setBotUsername(map['MINIAPP_BOT_USERNAME'] || '');
      setMiniAppUrl(map['MINIAPP_URL'] || DEFAULT_URL);
      setWelcomeText(map['MINIAPP_WELCOME_TEXT'] || DEFAULT_WELCOME);
      setButtonText(map['MINIAPP_BUTTON_TEXT'] || DEFAULT_BUTTON);
      setWebhookSecret(map['MINIAPP_WEBHOOK_SECRET'] || '');
      setLinkChannel(map['MINIAPP_LINK_CHANNEL'] || '');

      if (map['MINIAPP_BOT_TOKEN']) {
        botMalumotOlish(map['MINIAPP_BOT_TOKEN']);
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
      if (data.ok) {
        setBotInfo(data.result);
        return true;
      }
      setBotInfo(null);
      toast({ title: "Token noto'g'ri", description: data.description, variant: 'destructive' });
      return false;
    } catch {
      setBotInfo(null);
      return false;
    } finally {
      setBotInfoYuklanyapti(false);
    }
  };

  // Token o'zgarganda: getMe + setWebhook (secret_token bilan) + setChatMenuButton + deleteWebhook(eski)
  const saqlash = async () => {
    if (!token.trim()) {
      toast({ title: 'Xato', description: 'Bot token kiritilmagan', variant: 'destructive' });
      return;
    }
    setSaqlanyapti(true);
    setWebhookStatus(null);
    try {
      // Eski tokenni olib, agar o'zgargan bo'lsa deleteWebhook qilamiz
      const { data: eskiRow } = await supabase
        .from('settings')
        .select('text_value')
        .eq('key', 'MINIAPP_BOT_TOKEN')
        .maybeSingle();
      const eskiToken = eskiRow?.text_value || '';

      // (a) Token getMe bilan tekshirish
      const valid = await botMalumotOlish(token.trim());
      if (!valid) {
        toast({ title: 'Xato', description: "Token noto'g'ri, saqlanmadi", variant: 'destructive' });
        return;
      }

      // (d) Eski tokenga deleteWebhook
      if (eskiToken.trim() && eskiToken.trim() !== token.trim()) {
        try {
          await supabase.functions.invoke('telegram-api', {
            body: { token: eskiToken.trim(), method: 'deleteWebhook', body: { drop_pending_updates: true } },
          });
        } catch {}
      }

      // (b) Yangi tokenga setWebhook (secret_token bilan)
      const secret = webhookSecret.trim() || generateSecret();
      const { data: whResult, error: whErr } = await supabase.functions.invoke('telegram-api', {
        body: {
          token: token.trim(),
          method: 'setWebhook',
          body: {
            url: WEBHOOK_URL,
            allowed_updates: ['message'],
            drop_pending_updates: true,
            secret_token: secret,
          },
        },
      });
      if (whErr) throw whErr;
      if (!whResult.ok) {
        setWebhookStatus('error');
        setWebhookInfo(whResult.description || "Webhook o'rnatilmadi");
        toast({ title: 'Webhook xatosi', description: whResult.description, variant: 'destructive' });
        return;
      }

      // (c) setChatMenuButton — menyu tugmasini Web App qilamiz
      try {
        await supabase.functions.invoke('telegram-api', {
          body: {
            token: token.trim(),
            method: 'setChatMenuButton',
            body: {
              menu_button: {
                type: 'web_app',
                text: buttonText.trim() || DEFAULT_BUTTON,
                web_app: { url: miniAppUrl.trim() || DEFAULT_URL },
              },
            },
          },
        });
      } catch (e) {
        console.warn('[miniapp-sozlamalari] setChatMenuButton xato:', e);
      }

      // Bot username ni avtomatik olish
      const autoUsername = botInfo?.username ? '@' + botInfo.username : botUsername.trim();

      // Hamma settings'larni saqlash
      await Promise.all([
        supabase.from('settings').upsert({ key: 'MINIAPP_BOT_TOKEN', text_value: token.trim(), value: true, tavsif: 'Mini App Bot Token' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'MINIAPP_BOT_USERNAME', text_value: autoUsername, value: true, tavsif: 'Mini App Bot Username' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'MINIAPP_URL', text_value: miniAppUrl.trim(), value: true, tavsif: 'Mini App URL' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'MINIAPP_WELCOME_TEXT', text_value: welcomeText, value: true, tavsif: 'Mini App Salomlashuv matni' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'MINIAPP_BUTTON_TEXT', text_value: buttonText.trim(), value: true, tavsif: 'Mini App Tugma matni' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'MINIAPP_WEBHOOK_SECRET', text_value: secret, value: true, tavsif: 'Mini App Webhook Secret' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'MINIAPP_LINK_CHANNEL', text_value: linkChannel.trim(), value: true, tavsif: 'Mini App birlashtirish kanali' }, { onConflict: 'key' }),
      ]);

      // Kanal adminligini tekshirish (agar kanal kiritilgan bo'lsa)
      if (linkChannel.trim()) {
        try {
          const { data: chatResult, error: chatErr } = await supabase.functions.invoke('telegram-api', {
            body: { token: token.trim(), method: 'getChat', body: { chat_id: linkChannel.trim() } },
          });
          if (chatErr || !chatResult?.ok) {
            setChannelError(chatResult?.description || 'Kanal topilmadi yoki bot admin emas');
          } else {
            setChannelError('');
          }
        } catch (e: any) {
          setChannelError(e.message || 'Kanal tekshirilmadi');
        }
      } else {
        setChannelError('');
      }

      setWebhookSecret(secret);
      setBotUsername(autoUsername);
      setWebhookStatus('success');
      setWebhookInfo(WEBHOOK_URL);
      toast({ title: 'Saqlandi va webhook ulandi!', description: 'Mini App bot faol' });
    } catch (e: any) {
      setWebhookStatus('error');
      setWebhookInfo(e.message);
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setSaqlanyapti(false);
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
      setWebhookStatus('success');
      setWebhookInfo(result.result.url);
      toast({ title: 'Webhook faol', description: `Pending: ${result.result.pending_update_count || 0}` });
    } else {
      setWebhookStatus(null);
      setWebhookInfo("Webhook o'rnatilmagan");
      toast({ title: "Webhook o'rnatilmagan" });
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500 bg-gray-50';

  const maskedToken = (t: string) => {
    if (!t) return '';
    if (t.length <= 8) return '••••';
    return t.slice(0, 4) + '••••••••' + t.slice(-4);
  };

  if (yuklanyapti) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Smartphone className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Telegram Mini App Boti</h1>
              <p className="text-blue-200 text-sm mt-1">Telegram ichida sayt kabineti — bir tugma bilan kirish</p>
            </div>
          </div>
          {botInfo && (
            <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">🤖</div>
              <div>
                <p className="font-bold">{botInfo.first_name}</p>
                <p className="text-blue-200 text-sm">@{botInfo.username}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/30 border border-blue-400/50 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-xs font-bold">FAOL</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Qanday ishlaydi */}
      <Card className="border-2 border-cyan-200 bg-cyan-50">
        <CardContent className="py-4 px-5">
          <p className="font-bold text-cyan-900 mb-2">Bu bot qanday ishlaydi?</p>
          <ol className="space-y-1.5 text-xs text-cyan-800">
            <li>1. Foydalanuvchi botga /start yuboradi yoki istalgan xabar yozadi</li>
            <li>2. Bot salomlashuv matni va «Kirish» tugmasini yuboradi</li>
            <li>3. Tugma bosilganda sayt Telegram ichida ochiladi (Mini App)</li>
            <li>4. Foydalanuvchi «Davom etish» tugmasini bosadi — avtomatik kiradi yoki ro'yxatdan o'tadi</li>
            <li>5. Ism-familiya Telegramdan olinadi, foydalanuvchi hech narsa yozmaydi</li>
          </ol>
        </CardContent>
      </Card>

      {/* Token */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-blue-600" />Bot Tokeni
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <Link2 className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900">
              <b>Muhim:</b> Bu bot login botidan <b>alohida</b> yangi bot bo'lishi kerak.
              @BotFather orqali yangi bot yarating va Mini App URL'ini sozlang.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Mini App Bot Token <span className="text-red-500">*</span>
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
                  className="p-2 text-blue-500 hover:text-blue-700 disabled:opacity-40"
                  title="Token tekshirish"
                >
                  {botInfoYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {token && !tokenKo && (
              <p className="text-xs text-gray-400 mt-1 font-mono">{maskedToken(token)}</p>
            )}
          </div>

          {/* Bot username */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-blue-500" />Bot Username (avtomatik)
            </label>
            <input
              type="text"
              value={botUsername}
              onChange={(e) => setBotUsername(e.target.value)}
              placeholder="@sizning_miniapp_botingiz"
              className={inputCls}
            />
          </div>

          {/* Mini App URL */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-cyan-500" />Mini App URL
            </label>
            <input
              type="url"
              value={miniAppUrl}
              onChange={(e) => setMiniAppUrl(e.target.value)}
              placeholder="https://fanfaster.uz"
              className={inputCls}
            />
          </div>
        </CardContent>
      </Card>

      {/* Salomlashuv va tugma */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 text-blue-600" />Salomlashuv va Tugma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Salomlashuv matni
            </label>
            <textarea
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              rows={3}
              placeholder={DEFAULT_WELCOME}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-gray-50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Tugma matni
            </label>
            <input
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              placeholder={DEFAULT_BUTTON}
              className={inputCls}
            />
          </div>
        </CardContent>
      </Card>

      {/* Birlashtirish kanali */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-5 w-5 text-amber-600" />Birlashtirish kanali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Akkaunt birlashtirishdan oldin foydalanuvchi shu kanalga a'zo bo'lishi shart. Bo'sh = tekshiruv o'chiq.
          </p>
          <input
            type="text"
            value={linkChannel}
            onChange={(e) => setLinkChannel(e.target.value)}
            placeholder="@kanal_username yoki -1001234567890"
            className={inputCls}
          />
          {channelError && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{channelError}</p>
            </div>
          )}
          {linkChannel && !channelError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <p className="text-xs text-green-700">Kanal faol</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook secret */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-5 w-5 text-indigo-600" />Webhook Secret
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-gray-500">
            Webhook so'rovlarini tasdiqlash uchun maxfiy kalit. Saqlashda avtomatik generatsiya qilinadi.
          </p>
          <div className="relative">
            <input
              type={secretKo ? 'text' : 'password'}
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Avtomatik generatsiya qilinadi"
              className={`${inputCls} pr-12`}
            />
            <button onClick={() => setSecretKo((p) => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600">
              {secretKo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook status */}
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

      {/* Saqlash va webhook holati */}
      <div className="flex gap-3">
        <Button
          onClick={saqlash}
          disabled={saqlanyapti || !token.trim()}
          className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl"
        >
          {saqlanyapti
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</>
            : <><Save className="mr-2 h-4 w-4" />Saqlash va ulash</>}
        </Button>
        <Button
          onClick={webhookHolat}
          disabled={!token.trim()}
          variant="outline"
          className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-bold rounded-2xl h-12"
        >
          <RefreshCw className="h-4 w-4 mr-1" />Holat
        </Button>
      </div>

      {/* Qo'llanma */}
      <Card className="border border-blue-200 bg-blue-50">
        <CardContent className="py-4 px-5">
          <p className="font-bold text-blue-900 mb-2">Sozlash tartibi:</p>
          <ol className="space-y-1 list-decimal list-inside text-xs text-blue-800">
            <li>@BotFather orqali <b>yangi bot</b> yarating</li>
            <li>Botga Mini App URL'ini sozlang (BotFather → Bot Settings → Menu Button → Web App)</li>
            <li>Tokenni kiriting → <b>Saqlash va ulash</b></li>
            <li>Webhook avtomatik ulanadi, menyu tugmasi Web App bo'ladi</li>
            <li>Bot almashtirmoqchi bo'lsangiz — faqat yangi token va username kiriting</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
