import { useState, useEffect } from 'react';
import { Send, Loader2, Bot, Users, CheckCircle, Megaphone, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface BotXabarnomasiProps {
  onlyView?: boolean; // ustoz rejimi — faqat oddiy xabar
}

export default function BotXabarnomasi({ onlyView = false }: BotXabarnomasiProps) {
  const [xabar, setXabar] = useState('');
  const [tugmaMatn, setTugmaMatn] = useState('');
  const [tugmaUrl, setTugmaUrl] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [token, setToken] = useState('');
  const [siteUrl, setSiteUrl] = useState('https://fanfaster.uz');
  const [siteBtnText, setSiteBtnText] = useState('🌐 FanFaster.uz');
  const [yuborilganlar, setYuborilganlar] = useState<{ ism: string; familiya: string; chat_id: number }[]>([]);
  const [yuborish_rejimi, setYuborishRejimi] = useState<'hammaga' | 'faqat_yangi'>('hammaga');
  const [natija, setNatija] = useState<{ ok: number; xato: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const yuklash = async () => {
      const { data } = await supabase
        .from('settings')
        .select('key, text_value')
        .in('key', ['TELEGRAM_TOKEN', 'BOT_SITE_URL', 'BOT_SITE_BUTTON_TEXT']);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });
      setToken(map['TELEGRAM_TOKEN'] || '');
      setSiteUrl(map['BOT_SITE_URL'] || 'https://fanfaster.uz');
      setSiteBtnText(map['BOT_SITE_BUTTON_TEXT'] || '🌐 FanFaster.uz saytiga kirish');
    };
    yuklash();
    talabalarniYuklash();
  }, []);

  const talabalarniYuklash = async () => {
    const { data } = await supabase
      .from('talabalar')
      .select('ism, familiya, telegram_chat_id')
      .not('telegram_chat_id', 'is', null);
    setYuborilganlar(
      (data || []).map((t: any) => ({ ism: t.ism, familiya: t.familiya, chat_id: t.telegram_chat_id }))
    );
  };

  const xabarYuborish = async () => {
    if (!xabar.trim()) {
      toast({ title: 'Xato', description: 'Xabar matni kiritilmagan', variant: 'destructive' });
      return;
    }
    if (!token) {
      toast({ title: 'Xato', description: 'Bot token sozlanmagan. Bot Sozlamalarini tekshiring.', variant: 'destructive' });
      return;
    }

    setYuklanyapti(true);
    setNatija(null);

    const inline_keyboard = [];
    if (tugmaMatn && tugmaUrl) {
      inline_keyboard.push([{ text: tugmaMatn, url: tugmaUrl }]);
    }
    inline_keyboard.push([{ text: siteBtnText, url: siteUrl }]);

    let ok = 0;
    let xato = 0;
    const batchSize = 5;

    for (let i = 0; i < yuborilganlar.length; i += batchSize) {
      const batch = yuborilganlar.slice(i, i + batchSize);
      await Promise.all(batch.map(async (talaba) => {
        try {
          const { data: result, error: fnErr } = await supabase.functions.invoke('telegram-api', {
            body: {
              token,
              method: 'sendMessage',
              body: {
                chat_id: talaba.chat_id,
                text: xabar,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard },
              },
            },
          });
          if (fnErr || !result?.ok) xato++;
          else ok++;
        } catch {
          xato++;
        }
      }));
      // Telegram rate limit oldini olish
      if (i + batchSize < yuborilganlar.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setNatija({ ok, xato });
    setYuklanyapti(false);
    toast({
      title: `✅ Yuborildi: ${ok} ta / ❌ Xato: ${xato} ta`,
      description: `${yuborilganlar.length} ta foydalanuvchiga yuborildi`,
    });
  };

  const inputCls = 'w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 bg-gray-50';

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Megaphone className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Bot orqali Xabarnoma</h1>
              <p className="text-blue-200 text-sm mt-1">
                {yuborilganlar.length} ta foydalanuvchiga Telegram xabar yuboring
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Foydalanuvchilar soni */}
      <Card className="border border-gray-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{yuborilganlar.length} ta foydalanuvchi</p>
                <p className="text-xs text-gray-500">Telegram orqali ro'yxatdan o'tgan</p>
              </div>
            </div>
            <button
              onClick={talabalarniYuklash}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Xabar yozish */}
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-blue-600" />
            Xabar matni
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Xabar */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Xabar matni <span className="text-red-500">*</span>
            </label>
            <textarea
              value={xabar}
              onChange={e => setXabar(e.target.value)}
              rows={6}
              className={`${inputCls} resize-y leading-relaxed font-mono`}
              placeholder="Xabar matni... (HTML teglari ishlatiladi: <b>qalin</b>, <i>kursiv</i>)"
            />
            <p className="text-xs text-gray-400 mt-1">
              HTML: <code className="bg-gray-100 px-1 rounded">&lt;b&gt;</code> qalin,
              <code className="bg-gray-100 px-1 rounded mx-1">&lt;i&gt;</code> kursiv,
              <code className="bg-gray-100 px-1 rounded">&lt;code&gt;</code> kod
            </p>
          </div>

          {/* Qo'shimcha tugma (ixtiyoriy) */}
          {!onlyView && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Qo'shimcha tugma matni (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={tugmaMatn}
                  onChange={e => setTugmaMatn(e.target.value)}
                  className={inputCls}
                  placeholder="📣 Batafsil ma'lumot"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Tugma URL</label>
                <input
                  type="text"
                  value={tugmaUrl}
                  onChange={e => setTugmaUrl(e.target.value)}
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}

          {/* Sayt tugmasi har doim ko'rinadi */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
            <span className="font-bold">Avtomatik tugma:</span> "{siteBtnText}" — har bir xabarga qo'shiladi
          </div>

          {/* Natija */}
          {natija && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
              natija.xato === 0
                ? 'bg-green-50 border-green-300'
                : natija.ok === 0
                ? 'bg-red-50 border-red-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
              <CheckCircle className={`h-5 w-5 flex-shrink-0 ${natija.ok > 0 ? 'text-green-600' : 'text-red-600'}`} />
              <div>
                <p className="text-sm font-bold">
                  ✅ {natija.ok} ta muvaffaqiyatli
                  {natija.xato > 0 && <span className="ml-2 text-red-600">❌ {natija.xato} ta xato</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Xato foydalanuvchilar botni bloklagan yoki o'chirib tashlagan bo'lishi mumkin
                </p>
              </div>
            </div>
          )}

          {/* Yuborish */}
          <Button
            onClick={xabarYuborish}
            disabled={yuklanyapti || !xabar.trim() || yuborilganlar.length === 0}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl"
          >
            {yuklanyapti ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Yuborilmoqda ({yuborilganlar.length} ta)...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" />{yuborilganlar.length} ta foydalanuvchiga yuborish</>
            )}
          </Button>

          {yuborilganlar.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Hali Telegram bot orqali ro'yxatdan o'tgan foydalanuvchilar yo'q
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
