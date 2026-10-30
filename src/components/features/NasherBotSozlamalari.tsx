import { useEffect, useState } from 'react';
import { Scale, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Play, Key, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { adminSettings } from '@/lib/adminSettings';
import { useToast } from '@/hooks/use-toast';

// Mini App faqat NaSher AI ni to'liq ekranda ochadi (src/main.tsx da ?nasher_app=1 tekshiriladi)
const DEFAULT_MINIAPP_URL = `${window.location.origin}/?nasher_app=1`;

export default function NasherBotSozlamalari() {
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [tokenBor, setTokenBor] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [miniAppUrl, setMiniAppUrl] = useState(DEFAULT_MINIAPP_URL);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [ishlayapti, setIshlayapti] = useState(false);
  const [natija, setNatija] = useState<{ ok: boolean; text: string; username?: string } | null>(null);

  useEffect(() => {
    adminSettings().select('key, text_value').in('key', ['NASHER_BOT_TOKEN', 'NASHER_MINIAPP_URL'])
      .then(({ data, error }) => {
        if (error) console.error('[NasherBot] sozlamalar o\'qilmadi:', error.message);
        const m = Object.fromEntries((data ?? []).map(r => [r.key, r.text_value ?? '']));
        setTokenBor(!!m.NASHER_BOT_TOKEN);
        if (m.NASHER_MINIAPP_URL) setMiniAppUrl(m.NASHER_MINIAPP_URL);
        setYuklanyapti(false);
      });
  }, []);

  const faollashtir = async () => {
    const t = token.trim();
    if (!t && !tokenBor) {
      toast({ title: 'Token kiriting', description: "BotFather bergan tokenni joylang", variant: 'destructive' });
      return;
    }
    if (t && !/^\d+:[\w-]{30,}$/.test(t)) {
      toast({ title: "Token noto'g'ri ko'rinishda", description: '123456789:AA... shaklida bo\'lishi kerak', variant: 'destructive' });
      return;
    }
    setIshlayapti(true);
    setNatija(null);
    try {
      const rows = [{ key: 'NASHER_MINIAPP_URL', text_value: miniAppUrl.trim(), value: true, tavsif: 'NaSher AI Mini App manzili' }];
      if (t) rows.push({ key: 'NASHER_BOT_TOKEN', text_value: t, value: true, tavsif: 'NaSher AI Telegram bot tokeni' });
      const { error } = await adminSettings().upsert(rows, { onConflict: 'key' });
      if (error) throw new Error(error.message);
      const { data, error: fnErr } = await supabase.functions.invoke('nasher-bot', { body: { action: 'activate' } });
      if (fnErr) throw new Error(fnErr.message);
      if (!data?.ok) throw new Error(data?.description || 'Faollashtirib bo\'lmadi');
      setTokenBor(true);
      setToken('');
      setNatija({ ok: true, text: 'Bot faol: webhook, menyu tugmasi va buyruqlar o\'rnatildi.', username: data.username });
      toast({ title: '✅ NaSher bot faol', description: data.username ? `@${data.username}` : undefined });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNatija({ ok: false, text: msg });
      toast({ title: 'Xatolik', description: msg, variant: 'destructive' });
    } finally {
      setIshlayapti(false);
    }
  };

  if (yuklanyapti) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Scale className="h-8 w-8" /></div>
            <div>
              <h1 className="text-2xl font-black">NaSher AI boti</h1>
              <p className="text-blue-200 text-sm mt-1">Telegram'da huquqiy savollarga javob (Chuqur rejim) + Mini App (3 rejim)</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Key className="h-4 w-4" /> Bot tokeni</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            @BotFather → /newbot → bergan tokenni shu yerga joylang. {tokenBor && <b>Token saqlangan — yangilash uchungina kiriting.</b>}
          </p>
          <div className="flex gap-2">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={tokenBor ? '•••••••• (saqlangan)' : '123456789:AA...'}
              className="flex-1 rounded-lg border px-3 py-2 text-sm font-mono"
              autoComplete="off"
            />
            <Button type="button" variant="outline" onClick={() => setShowToken(v => !v)} aria-label="Tokenni ko'rsatish">
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <label className="block text-sm font-medium pt-2"><Globe className="inline h-4 w-4 mr-1" />Mini App manzili</label>
          <input
            value={miniAppUrl}
            onChange={e => setMiniAppUrl(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">Mini App faqat NaSher AI ni to'liq ekranda ochadi. Manzil oxirida <code>?nasher_app=1</code> bo'lishi shart.</p>
          <Button onClick={faollashtir} disabled={ishlayapti} className="w-full">
            {ishlayapti ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Saqlash va botni faollashtirish
          </Button>
          {natija && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${natija.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {natija.ok ? <CheckCircle className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
              <div>
                {natija.text}
                {natija.username && (
                  <> <a className="underline font-semibold" href={`https://t.me/${natija.username}`} target="_blank" rel="noopener noreferrer">@{natija.username}</a></>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
