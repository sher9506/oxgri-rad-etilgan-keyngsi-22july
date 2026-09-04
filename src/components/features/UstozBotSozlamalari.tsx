import { useState, useEffect, useCallback } from 'react';
import {
  Bot, Save, Loader2, CheckCircle, AlertCircle,
  Eye, EyeOff, Webhook, Play, Trash2, Key, Globe,
  ArrowRightLeft, RefreshCw, Link2, Users, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface SettingRow { key: string; text_value: string; tavsif: string; }

const SETTING_KEYS = [
  'USTOZ_BOT_TOKEN', 'USTOZ_BOT_WEBHOOK_URL',
  'USTOZ_BOT_SITE_URL', 'USTOZ_BOT_SITE_BUTTON_TEXT',
  'USTOZ_BOT_LINK',
];

export default function UstozBotSozlamalari() {
  const [token, setToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [siteUrl, setSiteUrl] = useState('https://fanfaster.uz');
  const [siteBtnText, setSiteBtnText] = useState('🌐 Saytga kirish');
  const [botLink, setBotLink] = useState('');
  const [tokenKo, setTokenKo] = useState(false);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [saqlanyapti, setSaqlanyapti] = useState(false);
  const [botLinkSaqlanyapti, setBotLinkSaqlanyapti] = useState(false);
  const [webhookSaqlanyapti, setWebhookSaqlanyapti] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'success' | 'error' | null>(null);
  const [webhookInfo, setWebhookInfo] = useState('');
  const [botInfo, setBotInfo] = useState<{ username?: string; first_name?: string } | null>(null);
  const [botInfoYuklanyapti, setBotInfoYuklanyapti] = useState(false);
  const [kutayotganUstozlar, setKutayotganUstozlar] = useState<any[]>([]);
  const [ustozlarYuklanyapti, setUstozlarYuklanyapti] = useState(false);
  const { toast } = useToast();

  const autoWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ustoz-bot`;

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data } = await supabase.from('settings').select('key, text_value, tavsif').in('key', SETTING_KEYS);
      const map: Record<string, string> = {};
      (data || []).forEach((r: SettingRow) => { map[r.key] = r.text_value || ''; });
      setToken(map['USTOZ_BOT_TOKEN'] || '');
      setWebhookUrl(map['USTOZ_BOT_WEBHOOK_URL'] || autoWebhookUrl);
      setSiteUrl(map['USTOZ_BOT_SITE_URL'] || 'https://fanfaster.uz');
      setSiteBtnText(map['USTOZ_BOT_SITE_BUTTON_TEXT'] || '🌐 Saytga kirish');
      setBotLink(map['USTOZ_BOT_LINK'] || '');
      if (map['USTOZ_BOT_TOKEN']) botMalumotOlish(map['USTOZ_BOT_TOKEN']);
    } finally {
      setYuklanyapti(false);
    }
  }, []);

  useEffect(() => { yuklash(); kutayotganUstozlarniYuklash(); }, [yuklash]);

  const kutayotganUstozlarniYuklash = async () => {
    setUstozlarYuklanyapti(true);
    try {
      const { data } = await supabase.from('ustoz').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      setKutayotganUstozlar(data || []);
    } finally {
      setUstozlarYuklanyapti(false);
    }
  };

  const botMalumotOlish = async (t?: string): Promise<boolean> => {
    const tok = (t || token).trim();
    if (!tok) return false;
    setBotInfoYuklanyapti(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('telegram-api', {
        body: { token: tok, method: 'getMe' },
      });
      if (error) throw error;
      if (result?.ok) {
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

  const webhookAlmashtir = async (eskiToken: string, yangiToken: string): Promise<boolean> => {
    const targetUrl = autoWebhookUrl;
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
      if (result?.ok) {
        await supabase.from('settings').upsert({ key: 'USTOZ_BOT_WEBHOOK_URL', text_value: targetUrl, value: true, tavsif: 'Ustoz Bot Webhook URL' }, { onConflict: 'key' });
        setWebhookUrl(targetUrl);
        setWebhookInfo(targetUrl);
        setWebhookStatus('success');
        return true;
      } else {
        setWebhookStatus('error');
        setWebhookInfo(result.description || "Webhook o'rnatilmadi");
        return false;
      }
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
      const { data: eskiRow } = await supabase.from('settings').select('text_value').eq('key', 'USTOZ_BOT_TOKEN').maybeSingle();
      const eskiToken = eskiRow?.text_value || '';
      await Promise.all([
        supabase.from('settings').upsert({ key: 'USTOZ_BOT_TOKEN', text_value: token.trim(), value: true, tavsif: 'Ustoz Bot Token' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'USTOZ_BOT_SITE_URL', text_value: siteUrl.trim(), value: true, tavsif: 'Ustoz Sayt URL' }, { onConflict: 'key' }),
        supabase.from('settings').upsert({ key: 'USTOZ_BOT_SITE_BUTTON_TEXT', text_value: siteBtnText.trim(), value: true, tavsif: 'Ustoz Sayt tugmasi matni' }, { onConflict: 'key' }),
      ]);
      const webhookOk = await webhookAlmashtir(eskiToken, token.trim());
      await botMalumotOlish(token.trim());
      if (webhookOk) {
        toast({ title: '✅ Saqlandi va webhook ulandi!', description: 'Ustoz boti faol — /start yuboring' });
      } else {
        toast({ title: '⚠️ Saqlandi, lekin webhook xato', description: "Token to'g'ri bo'lsa, Webhook bo'limidan qayta o'rnatish ni bosing.", variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setSaqlanyapti(false);
    }
  };

  const botLinkSaqla = async () => {
    setBotLinkSaqlanyapti(true);
    try {
      await supabase.from('settings').upsert({ key: 'USTOZ_BOT_LINK', text_value: botLink.trim(), value: true, tavsif: 'Ustozlar ro\'yxatdan o\'tish uchun bot havolasi' }, { onConflict: 'key' });
      toast({ title: '✅ Bot havola saqlandi!' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setBotLinkSaqlanyapti(false);
    }
  };

  const webhookOrnatish = async () => {
    if (!token.trim()) { toast({ title: 'Xato', description: 'Avval tokenni saqlang', variant: 'destructive' }); return; }
    setWebhookSaqlanyapti(true);
    setWebhookStatus(null);
    setWebhookInfo('');
    try {
      const wUrl = webhookUrl.trim() || autoWebhookUrl;
      const { data: result, error } = await supabase.functions.invoke('telegram-api', {
        body: {
          token: token.trim(),
          method: 'setWebhook',
          body: { url: wUrl, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true },
        },
      });
      if (error) throw error;
      if (result?.ok) {
        await supabase.from('settings').upsert({ key: 'USTOZ_BOT_WEBHOOK_URL', text_value: wUrl, value: true, tavsif: 'Ustoz Bot Webhook URL' }, { onConflict: 'key' });
        setWebhookUrl(wUrl);
        setWebhookStatus('success');
        setWebhookInfo(wUrl);
        toast({ title: '✅ Webhook o\'rnatildi!' });
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
    try {
      const { data: result, error } = await supabase.functions.invoke('telegram-api', {
        body: { token: token.trim(), method: 'getWebhookInfo' },
      });
      if (error) throw error;
      if (result?.ok && result.result.url) {
        setWebhookStatus('success');
        setWebhookInfo(result.result.url);
        toast({ title: '✅ Webhook faol', description: `Pending: ${result.result.pending_update_count || 0}` });
      } else {
        setWebhookStatus(null);
        setWebhookInfo("Webhook o'rnatilmagan");
        toast({ title: "⚠️ Webhook o'rnatilmagan" });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const webhookOchirish = async () => {
    if (!token.trim()) return;
    try {
      await supabase.functions.invoke('telegram-api', {
        body: { token: token.trim(), method: 'deleteWebhook', body: { drop_pending_updates: true } },
      });
      setWebhookStatus(null);
      setWebhookInfo("O'chirildi");
      toast({ title: "Webhook o'chirildi" });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const inputCls = 'w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-sm focus:outline-none focus:border-blue-500 bg-gray-50';

  if (yuklanyapti) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <Card className="border-2 border-indigo-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Bot className="h-8 w-8" /></div>
            <div>
              <h1 className="text-2xl font-black">Ustoz Boti Sozlamalari</h1>
              <p className="text-indigo-200 text-sm mt-1">Ustozlar ro'yxatdan o'tish boti</p>
            </div>
          </div>
          {botInfo && (
            <div className="mt-4 bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-lg">🤖</div>
              <div>
                <p className="font-bold">{botInfo.first_name}</p>
                <p className="text-indigo-200 text-sm">@{botInfo.username}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-green-500/30 border border-green-400/50 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-300 text-xs font-bold">FAOL</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Botga o'tish havolasi */}
      <Card className="border-2 border-violet-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-5 w-5 text-violet-600" />
            Ustoz ro'yxatdan o'tish havolasi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-sm text-violet-900">
            <p className="font-bold mb-1">📌 Bu havola nima uchun?</p>
            <p className="text-violet-800 text-xs leading-relaxed">
              Ustoz kirish sahifasida yoki admin panelidagi "Ustoz boti" tugmasini bosganida
              shu havolaga yo'naltiriladi. Odatda: <code className="bg-violet-100 px-1 rounded">https://t.me/BOT_USERNAME</code>
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Bot havolasi</label>
            <input type="url" value={botLink} onChange={e => setBotLink(e.target.value)} placeholder="https://t.me/ustoz_bot" className={inputCls} />
          </div>
          <Button onClick={botLinkSaqla} disabled={botLinkSaqlanyapti} className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl">
            {botLinkSaqlanyapti ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</> : <><Save className="mr-2 h-4 w-4" />Bot havolasini saqlash</>}
          </Button>
        </CardContent>
      </Card>

      {/* Token & Sozlamalar */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-5 w-5 text-indigo-600" />Bot Token va Sozlamalar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold mb-0.5">Token almashtirishda nima bo'ladi?</p>
              <p>"Saqlash" tugmasini bosganda: <b>eski botdan webhook o'chiriladi</b> → <b>yangi botga webhook ulanadi</b>. Barcha so'rovlar yangi botga yo'naltiriladi.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Bot Token <span className="text-red-500">*</span>
              <span className="ml-2 text-xs text-gray-400 font-normal">@BotFather dan</span>
            </label>
            <div className="relative">
              <input type={tokenKo ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)} placeholder="1234567890:AABBCCDDxx..." className={`${inputCls} pr-24`} />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button onClick={() => setTokenKo(p => !p)} className="p-2 text-gray-400 hover:text-gray-600">
                  {tokenKo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button onClick={() => botMalumotOlish()} disabled={botInfoYuklanyapti || !token.trim()} className="p-2 text-indigo-500 hover:text-indigo-700 disabled:opacity-40">
                  {botInfoYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-emerald-500" />Sayt URL
              </label>
              <input type="text" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://fanfaster.uz" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1.5">Tugma matni</label>
              <input type="text" value={siteBtnText} onChange={e => setSiteBtnText(e.target.value)} placeholder="🌐 Saytga kirish" className={inputCls} />
            </div>
          </div>

          <Button onClick={saqlash} disabled={saqlanyapti || !token.trim()} className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl">
            {saqlanyapti ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saqlanmoqda...</> : <><Save className="mr-2 h-4 w-4" />Saqlash (webhook avtomatik ulanadi)</>}
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
            <label className="block text-xs font-bold text-gray-600 mb-1.5">Webhook URL (avtomatik)</label>
            <input type="text" value={webhookUrl || autoWebhookUrl} onChange={e => setWebhookUrl(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:border-indigo-500 bg-gray-50" />
            <button onClick={() => setWebhookUrl(autoWebhookUrl)} className="text-xs text-indigo-600 hover:underline mt-1">
              Avtomatik URL ga qaytarish
            </button>
          </div>

          {webhookStatus === 'success' && (
            <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border-2 border-green-300 rounded-2xl">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-800 font-semibold">Webhook faol! Ustoz boti ishlayapti.</p>
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
            <Button onClick={webhookOrnatish} disabled={webhookSaqlanyapti || !token.trim()} className="bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl h-10 text-sm">
              {webhookSaqlanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Play className="h-4 w-4 mr-1" />O'rnatish</>}
            </Button>
            <Button onClick={webhookHolat} disabled={!token.trim()} variant="outline" className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 font-bold rounded-xl h-10 text-sm">
              <RefreshCw className="h-4 w-4 mr-1" />Holat
            </Button>
            <Button onClick={webhookOchirish} disabled={!token.trim()} variant="outline" className="border-2 border-red-300 text-red-600 hover:bg-red-50 font-bold rounded-xl h-10 text-sm">
              <Trash2 className="h-4 w-4 mr-1" />O'chirish
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kutayotgan ustozlar */}
      <Card className="border-2 border-amber-300 shadow-md">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-amber-600" />
            Bot orqali ariza topshirganlar
            {kutayotganUstozlar.filter(u => u.status === 'pending').length > 0 && (
              <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {kutayotganUstozlar.filter(u => u.status === 'pending').length}
              </span>
            )}
          </CardTitle>
          <button onClick={kutayotganUstozlarniYuklash} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all">
            <RefreshCw className={`h-4 w-4 ${ustozlarYuklanyapti ? 'animate-spin' : ''}`} />
          </button>
        </CardHeader>
        <CardContent>
          {ustozlarYuklanyapti ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-amber-500 mx-auto" /></div>
          ) : kutayotganUstozlar.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Kutayotgan ariza yo'q</p>
            </div>
          ) : (
            <div className="space-y-3">
              {kutayotganUstozlar.map(ustoz => (
                <div key={ustoz.id} className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                  ustoz.status === 'pending' ? 'border-amber-300 bg-amber-50/50' : ustoz.status === 'approved' ? 'border-green-300 bg-green-50/30' : 'border-red-200 bg-red-50/20'
                }`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    {ustoz.full_name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{ustoz.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <p className="text-xs text-gray-500">📱 {ustoz.phone || ustoz.username}</p>
                      {ustoz.telegram_username && <p className="text-xs text-blue-500">✈️ {ustoz.telegram_username}</p>}
                    </div>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(ustoz.created_at).toLocaleString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full border flex-shrink-0 ${
                    ustoz.status === 'pending' ? 'bg-amber-100 border-amber-400 text-amber-700' :
                    ustoz.status === 'approved' ? 'bg-green-100 border-green-400 text-green-700' :
                    'bg-red-100 border-red-400 text-red-700'
                  }`}>
                    {ustoz.status === 'pending' ? '⏳ Kutilmoqda' : ustoz.status === 'approved' ? '✅ Tasdiqlangan' : '❌ Rad etilgan'}
                  </span>
                </div>
              ))}
              <p className="text-xs text-gray-400 text-center pt-2">
                Tasdiqlash/rad etish uchun "Ustozlar" bo'limiga o'ting
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Qo'llanma */}
      <Card className="border border-indigo-200 bg-indigo-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3 text-sm text-indigo-900">
            <Bot className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-2">Ustoz boti sozlash tartibi:</p>
              <ol className="space-y-1 list-decimal list-inside text-xs text-indigo-800">
                <li>@BotFather da yangi bot yarating → token oling</li>
                <li>Tokenni kiriting → <b>"Saqlash"</b> — webhook avtomatik ulanadi</li>
                <li>Bot havolasini (<code>https://t.me/bot_username</code>) kiriting va saqlang</li>
                <li>Ustoz botga /start yuboring va sinab ko'ring</li>
                <li>Ariza kelganda bu sahifada ko'rinadi, "Ustozlar" bo'limida tasdiqlang</li>
                <li>Tasdiqlanganda ustoz botga avtomatik xabar yuboriladi va saytga kira oladi</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
