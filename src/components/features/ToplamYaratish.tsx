import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, AlertCircle, ChevronDown, ChevronUp, Sparkles, PlusCircle, X, Copy, ToggleLeft, ToggleRight, Settings, RotateCcw, RefreshCw, FileText, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RichTextEditor, { htmlToPlainText } from './RichTextEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Kazus, QoshimchaMezon, StandartMezonSozlama } from '@/types';

// ─── STANDART MEZONLAR KONSTANTASI ─────────────────────────────────────────
const STANDART_MEZONLAR_ASL: Omit<StandartMezonSozlama, 'faol'>[] = [
  { id: 'mazmun', nom: 'Mazmuniy moslik (ustoz javobiga)', ball: 25, asl_ball: 25 },
  { id: 'tizimli', nom: 'Tizimli va chuqur bilim, dalillar bilan asoslash', ball: 1, asl_ball: 1 },
  { id: 'terminologiya', nom: "Terminologiyadan (xorijiy) to'g'ri foydalanish", ball: 1, asl_ball: 1 },
  { id: 'muammo', nom: "Muammoli savollarni aniqlash va huquqiy pozitsiyani asoslash", ball: 1, asl_ball: 1 },
  { id: 'tayanch', nom: "Tayanch tushunchalarni yechimda qo'llay olish", ball: 1, asl_ball: 1 },
  { id: 'mantiq', nom: "Argumentlarning bir-biriga zid emasligi", ball: 1, asl_ball: 1 },
];

function mezonlarYaratish(): StandartMezonSozlama[] {
  return STANDART_MEZONLAR_ASL.map(m => ({ ...m, faol: true }));
}

const BOSHLANGICH_QOSHIMCHA: QoshimchaMezon[] = [{ shart: '', ball: 2 }];

interface ToplamYaratishProps {
  ustozId: string;
  tahrirlashToplam?: { id: string; kod: string; mavzu: string; kazuslar: Kazus[] } | null;
  onTahrirlashTugadi?: () => void;
}

export default function ToplamYaratish({ ustozId, tahrirlashToplam, onTahrirlashTugadi }: ToplamYaratishProps) {
  const [mavzu, setMavzu] = useState('');
  const [vaqtDaqiqa, setVaqtDaqiqa] = useState(30);
  const [copyPasteRuxsat, setCopyPasteRuxsat] = useState(true);
  const [allowRetake, setAllowRetake] = useState(false);
  const [modelTur, setModelTur] = useState<'oddiy' | 'protsessual'>('oddiy');
  const [kazuslar, setKazuslar] = useState<Kazus[]>([{
    kazus: '',
    javob: '',
    mezon_sozlamalar: mezonlarYaratish(),
    qoshimcha_mezonlar: [...BOSHLANGICH_QOSHIMCHA],
  }]);
  const [ochiqMezonlar, setOchiqMezonlar] = useState<Record<number, boolean>>({});
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [natija, setNatija] = useState<{ kod: string } | null>(null);
  const [tahrirlashRejimi, setTahrirlashRejimi] = useState(false);
  const { toast } = useToast();

  // Tahrirlash ma'lumotlarini yuklash
  useEffect(() => {
    if (tahrirlashToplam) {
      setMavzu(tahrirlashToplam.mavzu || '');
      const kazuslarBilan = tahrirlashToplam.kazuslar.map(k => {
        const qm = k.qoshimcha_mezonlar && k.qoshimcha_mezonlar.length > 0
          ? k.qoshimcha_mezonlar
          : [...BOSHLANGICH_QOSHIMCHA];
        return {
          ...k,
          mezon_sozlamalar: k.mezon_sozlamalar && k.mezon_sozlamalar.length > 0
            ? k.mezon_sozlamalar
            : mezonlarYaratish(),
          qoshimcha_mezonlar: qm,
        };
      });
      setKazuslar(kazuslarBilan);
      setVaqtDaqiqa((tahrirlashToplam as any).vaqt_daqiqa || 30);
      setCopyPasteRuxsat((tahrirlashToplam as any).copy_paste_ruxsat ?? true);
      setAllowRetake((tahrirlashToplam as any).allow_retake ?? false);
      // eski "protsesual" ham qabul qilinadi
      const mt = (tahrirlashToplam as any).model_tur ?? 'oddiy';
      setModelTur(mt === 'protsesual' ? 'protsessual' : mt);
      setTahrirlashRejimi(true);
    }
  }, [tahrirlashToplam]);

  // ── MEZON SOZLAMA FUNKSIYALARI ──────────────────────────────────────────

  const mezonFaollikToggle = (kazusIndex: number, mezonId: string) => {
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      return {
        ...k,
        mezon_sozlamalar: (k.mezon_sozlamalar || mezonlarYaratish()).map(m =>
          m.id === mezonId ? { ...m, faol: !m.faol } : m
        )
      };
    }));
  };

  const mezonBallOzgartirish = (kazusIndex: number, mezonId: string, yangi_ball: number) => {
    if (yangi_ball < 0 || yangi_ball > 50) return;
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      return {
        ...k,
        mezon_sozlamalar: (k.mezon_sozlamalar || mezonlarYaratish()).map(m =>
          m.id === mezonId ? { ...m, ball: yangi_ball } : m
        )
      };
    }));
  };

  const mezonBalliReset = (kazusIndex: number, mezonId: string) => {
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      return {
        ...k,
        mezon_sozlamalar: (k.mezon_sozlamalar || mezonlarYaratish()).map(m =>
          m.id === mezonId ? { ...m, ball: m.asl_ball } : m
        )
      };
    }));
  };

  const barcha_mezonlarReset = (kazusIndex: number) => {
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      return { ...k, mezon_sozlamalar: mezonlarYaratish() };
    }));
    toast({ title: "Qayta tiklandi", description: "Barcha mezonlar standart holatga qaytarildi" });
  };

  // ── QOSHIMCHA MEZON FUNKSIYALARI ────────────────────────────────────────

  const mezonBolimToggle = (index: number) => {
    setOchiqMezonlar(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Plus bosilganda yangi bo'sh qator qo'shiladi
  const qoshimchaMezonQoshish = (kazusIndex: number) => {
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      const mezonlar = k.qoshimcha_mezonlar || [];
      if (mezonlar.length >= 5) {
        toast({ title: 'Cheklov', description: "Maksimal 5 ta ixtiyoriy mezon qo'shish mumkin", variant: 'destructive' });
        return k;
      }
      return { ...k, qoshimcha_mezonlar: [...mezonlar, { shart: '', ball: 2 }] };
    }));
  };

  // O'chirishda: agar oxirgisi bo'lsa, bo'sh qatorni qoldiradi
  const qoshimchaMezonOchirish = (kazusIndex: number, mezonIndex: number) => {
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      const filtered = (k.qoshimcha_mezonlar || []).filter((_, mi) => mi !== mezonIndex);
      return {
        ...k,
        qoshimcha_mezonlar: filtered.length > 0 ? filtered : [...BOSHLANGICH_QOSHIMCHA],
      };
    }));
  };

  const qoshimchaMezonOzgartirish = (kazusIndex: number, mezonIndex: number, field: 'shart' | 'ball', value: string | number) => {
    setKazuslar(prev => prev.map((k, i) => {
      if (i !== kazusIndex) return k;
      const mezonlar = [...(k.qoshimcha_mezonlar || [])];
      mezonlar[mezonIndex] = { ...mezonlar[mezonIndex], [field]: field === 'ball' ? Number(value) : value };
      return { ...k, qoshimcha_mezonlar: mezonlar };
    }));
  };

  // ── KAZUS FUNKSIYALARI ──────────────────────────────────────────────────

  const kazusQoshish = () => {
    if (kazuslar.length < 30) {
      setKazuslar([...kazuslar, {
        kazus: '',
        javob: '',
        mezon_sozlamalar: mezonlarYaratish(),
        qoshimcha_mezonlar: [...BOSHLANGICH_QOSHIMCHA],
      }]);
    } else {
      toast({ title: 'Ogohlantirish', description: "Maksimal 30 ta kazus qo'shish mumkin", variant: 'destructive' });
    }
  };

  const kazusOchirish = (index: number) => {
    if (kazuslar.length > 1) {
      setKazuslar(kazuslar.filter((_, i) => i !== index));
    }
  };

  const kazusOzgartirish = (index: number, field: 'kazus' | 'javob', value: string) => {
    const yangi = [...kazuslar];
    yangi[index][field] = value;
    setKazuslar(yangi);
  };

  // ── YORDAMCHI FUNKSIYALAR ────────────────────────────────────────────────

  const noyobKodTopish = async (): Promise<string> => {
    let kod = Math.floor(10000 + Math.random() * 90000).toString();
    let urinishlar = 0;
    while (urinishlar < 20) {
      const [toplamRes, testRes] = await Promise.all([
        supabase.from('toplamlar').select('kod').eq('kod', kod).maybeSingle(),
        supabase.from('testlar').select('kod').eq('kod', kod).maybeSingle(),
      ]);
      if (!toplamRes.data && !testRes.data) break;
      kod = Math.floor(10000 + Math.random() * 90000).toString();
      urinishlar++;
    }
    return kod;
  };

  const validatsiya = () => {
    if (!mavzu.trim()) {
      toast({ title: 'Xato', description: 'Kazus mavzusini kiriting', variant: 'destructive' });
      return false;
    }
    const toliqlari = kazuslar.filter(k => htmlToPlainText(k.kazus).trim() && htmlToPlainText(k.javob).trim());
    if (toliqlari.length === 0) {
      toast({ title: 'Xato', description: 'Kamida bitta kazus va javob kiriting', variant: 'destructive' });
      return false;
    }
    return true;
  };

  // Bo'sh qoshimcha mezonlarni tozalash (saqlanmaydi)
  const mezonlarniTozalash = (kList: Kazus[]) =>
    kList.map(k => ({
      ...k,
      qoshimcha_mezonlar: (k.qoshimcha_mezonlar || []).filter(m => m.shart.trim() !== ''),
    }));

  // ── SAQLASH FUNKSIYALARI ─────────────────────────────────────────────────

  const toplamYaratish = async () => {
    if (!validatsiya()) return;
    setYuklanyapti(true);
    try {
      const kod = await noyobKodTopish();
      const { data: ustozData } = await supabase.from('ustoz').select('full_name').eq('id', ustozId).single();
      const toliqlari = mezonlarniTozalash(
        kazuslar.filter(k => htmlToPlainText(k.kazus).trim() && htmlToPlainText(k.javob).trim())
      );
      const { error } = await supabase.from('toplamlar').insert({
        kod,
        ustoz_id: ustozId,
        ustoz_ismi: ustozData?.full_name || 'Ustoz',
        mavzu: mavzu.trim(),
        kazuslar: toliqlari,
        vaqt_daqiqa: vaqtDaqiqa,
        copy_paste_ruxsat: copyPasteRuxsat,
        allow_retake: allowRetake,
        model_tur: modelTur,
      });
      if (error) throw error;
      setNatija({ kod });
      setMavzu('');
      setVaqtDaqiqa(30);
      setKazuslar([{ kazus: '', javob: '', mezon_sozlamalar: mezonlarYaratish(), qoshimcha_mezonlar: [...BOSHLANGICH_QOSHIMCHA] }]);
      toast({ title: 'Muvaffaqiyatli!', description: `Kazus yaratildi. Kod: ${kod}` });
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || 'Kazusni yaratishda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const toplamYangilash = async () => {
    if (!tahrirlashToplam || !validatsiya()) return;
    setYuklanyapti(true);
    try {
      const toliqlari = mezonlarniTozalash(
        kazuslar.filter(k => htmlToPlainText(k.kazus).trim() && htmlToPlainText(k.javob).trim())
      );
      const { error } = await supabase.from('toplamlar').update({
        mavzu: mavzu.trim(),
        kazuslar: toliqlari,
        vaqt_daqiqa: vaqtDaqiqa,
        copy_paste_ruxsat: copyPasteRuxsat,
        allow_retake: allowRetake,
        model_tur: modelTur,
      }).eq('id', tahrirlashToplam.id);
      if (error) throw error;
      toast({ title: 'Muvaffaqiyatli!', description: `Kazus yangilandi. Kod: ${tahrirlashToplam.kod}` });
      onTahrirlashTugadi?.();
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || 'Kazusni yangilashda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────

  if (natija) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-2 border-green-500 bg-green-50 shadow-xl animate-scale-in">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-green-500 p-2 rounded-full animate-bounce">
                <Check className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-green-700">Kazus muvaffaqiyatli yaratildi!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-6 rounded-lg border-2 border-green-300">
              <p className="text-sm text-gray-600 mb-2">Kazus kodi:</p>
              <p className="text-5xl font-bold text-[hsl(221,83%,53%)] text-center tracking-wider">{natija.kod}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold mb-1">Muhim:</p>
                <p>Bu kodni o'quvchilarga yuboring. Ular bu kod orqali kazusni yechadilar.</p>
              </div>
            </div>
            <Button onClick={() => { setNatija(null); onTahrirlashTugadi?.(); }} className="w-full" size="lg">
              {tahrirlashRejimi ? 'Orqaga qaytish' : 'Yangi kazus yaratish'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Kazus ma'lumotlari */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {tahrirlashRejimi ? `Kazusni tahrirlash (Kod: ${tahrirlashToplam?.kod})` : "Kazus ma'lumotlari"}
            </CardTitle>
            {tahrirlashRejimi && onTahrirlashTugadi && (
              <Button onClick={onTahrirlashTugadi} variant="outline" size="sm">Bekor qilish</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Kazus mavzusi: <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Masalan: Jinoyat huquqi asoslari, Fuqarolik huquqi, va boshqalar..."
              value={mavzu}
              onChange={(e) => setMavzu(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[hsl(221,83%,53%)] text-lg"
            />
          </div>

          {/* Kazus modeli */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Kazus modeli:</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModelTur('oddiy')}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                  modelTur === 'oddiy' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-400'
                }`}
              >
                <Scale className="h-5 w-5" />
                <span>Oddiy kazus</span>
                <span className={`text-[10px] font-normal ${modelTur === 'oddiy' ? 'text-blue-100' : 'text-gray-400'}`}>Matn + alohida javob</span>
              </button>
              <button
                type="button"
                onClick={() => setModelTur('protsessual')}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3.5 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                  modelTur === 'protsessual' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-400'
                }`}
              >
                <FileText className="h-5 w-5" />
                <span>Protsessual hujjat</span>
                <span className={`text-[10px] font-normal ${modelTur === 'protsessual' ? 'text-indigo-100' : 'text-gray-400'}`}>Javob hujjat ichiga yoziladi</span>
              </button>
            </div>
            {modelTur === 'protsessual' && (
              <p className="mt-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                📄 Protsessual hujjatda o'quvchi kazus matni ustiga to'g'ridan-to'g'ri yozadi — hujjat to'ldirgandek.
              </p>
            )}
          </div>

          {/* Copy-paste va Qayta yechish togglelar */}
          <div className="grid grid-cols-2 gap-3">
            {/* Copy-paste */}
            <div
              onClick={() => setCopyPasteRuxsat(p => !p)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                copyPasteRuxsat
                  ? 'bg-green-50 border-green-400 hover:bg-green-100'
                  : 'bg-red-50 border-red-300 hover:bg-red-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Copy className={`h-4 w-4 flex-shrink-0 ${copyPasteRuxsat ? 'text-green-600' : 'text-red-500'}`} />
                <div>
                  <p className="text-xs font-bold text-gray-700">Copy-paste</p>
                  <p className={`text-[10px] font-semibold ${copyPasteRuxsat ? 'text-green-600' : 'text-red-500'}`}>
                    {copyPasteRuxsat ? '✅ Ruxsat berilgan' : '🚫 Taqiqlangan'}
                  </p>
                </div>
              </div>
              <div style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: copyPasteRuxsat ? '#22c55e' : '#d1d5db', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: copyPasteRuxsat ? 22 : 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
              </div>
            </div>

            {/* Qayta yechish */}
            <div
              onClick={() => setAllowRetake(p => !p)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 cursor-pointer transition-all select-none ${
                allowRetake
                  ? 'bg-green-50 border-green-400 hover:bg-green-100'
                  : 'bg-orange-50 border-orange-300 hover:bg-orange-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 flex-shrink-0 ${allowRetake ? 'text-green-600' : 'text-orange-500'}`} />
                <div>
                  <p className="text-xs font-bold text-gray-700">Qayta yechish</p>
                  <p className={`text-[10px] font-semibold ${allowRetake ? 'text-green-600' : 'text-orange-500'}`}>
                    {allowRetake ? '✅ Ruxsat berilgan' : '⚠️ Bir martalik'}
                  </p>
                </div>
              </div>
              <div style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: allowRetake ? '#22c55e' : '#d1d5db', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: allowRetake ? 22 : 2, width: 20, height: 20, borderRadius: '50%', backgroundColor: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Yechish uchun berilgan vaqt: <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1" max="180"
                value={vaqtDaqiqa}
                onChange={(e) => setVaqtDaqiqa(Math.min(180, Math.max(1, parseInt(e.target.value) || 30)))}
                className="w-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[hsl(221,83%,53%)] text-lg font-bold text-center"
              />
              <span className="text-lg text-gray-600">daqiqa</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kazuslar */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kazuslar ({kazuslar.length}/30 ta)</CardTitle>
          <Button onClick={kazusQoshish} disabled={kazuslar.length >= 30} size="sm">
            <Plus className="h-4 w-4 mr-2" />Kazus qo'shish
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          {kazuslar.map((kazus, index) => (
            <KazusBlok
              key={index}
              kazus={kazus}
              index={index}
              jami={kazuslar.length}
              ochiqMezon={ochiqMezonlar[index] || false}
              onKazusOzgartirish={kazusOzgartirish}
              onKazusOchirish={kazusOchirish}
              onMezonFaollik={mezonFaollikToggle}
              onMezonBall={mezonBallOzgartirish}
              onMezonReset={mezonBalliReset}
              onBarchaMezonReset={barcha_mezonlarReset}
              onMezonBolimToggle={mezonBolimToggle}
              onQoshimchaMezonQoshish={qoshimchaMezonQoshish}
              onQoshimchaMezonOchirish={qoshimchaMezonOchirish}
              onQoshimchaMezonOzgartirish={qoshimchaMezonOzgartirish}
            />
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={tahrirlashRejimi ? toplamYangilash : toplamYaratish}
        disabled={yuklanyapti}
        className="w-full"
        size="lg"
      >
        {yuklanyapti
          ? (tahrirlashRejimi ? 'Saqlanmoqda...' : 'Yaratilmoqda...')
          : (tahrirlashRejimi ? 'Kazusni yangilash' : 'Kazusni saqlash va kod olish')
        }
      </Button>

      <style>{`
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// ─── KAZUS BLOKI ─────────────────────────────────────────────────────────────

interface KazusBlokProps {
  kazus: Kazus;
  index: number;
  jami: number;
  ochiqMezon: boolean;
  onKazusOzgartirish: (i: number, f: 'kazus' | 'javob', v: string) => void;
  onKazusOchirish: (i: number) => void;
  onMezonFaollik: (ki: number, mid: string) => void;
  onMezonBall: (ki: number, mid: string, ball: number) => void;
  onMezonReset: (ki: number, mid: string) => void;
  onBarchaMezonReset: (ki: number) => void;
  onMezonBolimToggle: (i: number) => void;
  onQoshimchaMezonQoshish: (ki: number) => void;
  onQoshimchaMezonOchirish: (ki: number, mi: number) => void;
  onQoshimchaMezonOzgartirish: (ki: number, mi: number, f: 'shart' | 'ball', v: string | number) => void;
}

function KazusBlok({
  kazus, index, jami, ochiqMezon,
  onKazusOzgartirish, onKazusOchirish,
  onMezonFaollik, onMezonBall, onMezonReset, onBarchaMezonReset,
  onMezonBolimToggle,
  onQoshimchaMezonQoshish, onQoshimchaMezonOchirish, onQoshimchaMezonOzgartirish
}: KazusBlokProps) {
  const mezonlar = kazus.mezon_sozlamalar || mezonlarYaratish();
  const qoshimchaMezonlar = kazus.qoshimcha_mezonlar && kazus.qoshimcha_mezonlar.length > 0
    ? kazus.qoshimcha_mezonlar
    : [{ shart: '', ball: 2 }];
  const faolMezonlar = mezonlar.filter(m => m.faol);
  const jami_ball = faolMezonlar.reduce((s, m) => s + m.ball, 0);

  return (
    <div className="border-2 border-gray-200 rounded-xl p-5 space-y-5 hover:border-[hsl(221,83%,53%)] transition-colors">
      {/* Sarlavha */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-[hsl(221,83%,53%)] text-base">Kazus {index + 1}</span>
        {jami > 1 && (
          <Button onClick={() => onKazusOchirish(index)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Kazus matni */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
          Kazus matni:
          <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
            📄 Word-dan paste qilish qo'llab-quvvatlanadi
          </span>
        </label>
        <RichTextEditor
          value={kazus.kazus}
          onChange={(html) => onKazusOzgartirish(index, 'kazus', html)}
          placeholder="Huquqiy vaziyatni batafsil yozing... (Word hujjatidan ko'chirib joylashtirishingiz mumkin)"
          minHeight={160}
        />
      </div>

      {/* Javob */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-2">
          To'g'ri javob:
          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
            📄 Word-dan paste qilish qo'llab-quvvatlanadi
          </span>
        </label>
        <RichTextEditor
          value={kazus.javob}
          onChange={(html) => onKazusOzgartirish(index, 'javob', html)}
          placeholder="To'g'ri javobni yozing... (Word hujjatidan ko'chirib joylashtirishingiz mumkin)"
          minHeight={160}
        />
      </div>

      {/* ─── MEZONLAR BO'LIMI ─── */}
      <div className="border-2 border-blue-200 rounded-xl overflow-hidden">
        {/* Header */}
        <button
          type="button"
          onClick={() => onMezonBolimToggle(index)}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-800">Baholash mezonlari</span>
            <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              {faolMezonlar.length}/{mezonlar.length} faol • {jami_ball} ball
            </span>
          </div>
          {ochiqMezon ? <ChevronUp className="h-4 w-4 text-blue-600" /> : <ChevronDown className="h-4 w-4 text-blue-600" />}
        </button>

        {ochiqMezon && (
          <div className="p-4 space-y-3 bg-white">
            {/* Reset tugmasi */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onBarchaMezonReset(index)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all"
              >
                <RotateCcw className="h-3 w-3" />
                Standartga qaytarish
              </button>
            </div>

            {/* Mezonlar ro'yxati */}
            {mezonlar.map((mezon) => (
              <StandartMezonQator
                key={mezon.id}
                mezon={mezon}
                onFaollik={() => onMezonFaollik(index, mezon.id)}
                onBallOzgartirish={(ball) => onMezonBall(index, mezon.id, ball)}
                onReset={() => onMezonReset(index, mezon.id)}
              />
            ))}

            {/* Jami ball */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 flex items-center justify-between mt-2">
              <span className="text-sm font-bold text-blue-800">Jami maksimal ball:</span>
              <span className="text-2xl font-black text-blue-600">{jami_ball} ball</span>
            </div>

            {/* ─── IXTIYORIY QO'SHIMCHA MEZONLAR ─── */}
            <div className="border-t-2 border-purple-200 pt-3 mt-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-bold text-purple-700">Ixtiyoriy qo'shimcha mezonlar</span>
                <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {qoshimchaMezonlar.filter(m => m.shart.trim()).length} ta faol
                </span>
              </div>

              {/* Tushuntirish */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 text-xs text-purple-800 space-y-1">
                <p className="font-bold">Qanday ishlaydi?</p>
                <p>✅ Shart bajarilsa → <strong>+ball qo'shiladi</strong></p>
                <p>❌ Shart bajarilmasa → <strong>-ball ayiriladi</strong></p>
                <p className="italic text-purple-600">Misol: "aniq modda raqami ko'rsatilgan" → +3 yoki -3</p>
                <p className="text-[10px] text-purple-400">Bo'sh qoldirilgan satrlar saqlanmaydi</p>
              </div>

              {/* Mezonlar — har doim kamida 1 ta qator ko'rinadi */}
              {qoshimchaMezonlar.map((mezon, mi) => (
                <QoshimchaMezonQator
                  key={mi}
                  mezon={mezon}
                  index={mi}
                  total={qoshimchaMezonlar.length}
                  onOzgartirish={(f, v) => onQoshimchaMezonOzgartirish(index, mi, f, v)}
                  onOchirish={() => onQoshimchaMezonOchirish(index, mi)}
                />
              ))}

              {/* Yangi qator qo'shish — faqat oxirgi qator to'ldirilgan bo'lsa yoki tugmani bossalar */}
              {qoshimchaMezonlar.length < 5 && (
                <button
                  type="button"
                  onClick={() => onQoshimchaMezonQoshish(index)}
                  className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-purple-300 text-purple-500 rounded-xl hover:bg-purple-50 hover:border-purple-400 hover:text-purple-700 transition-all text-xs font-semibold mt-1"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Yana bir mezon qo'shish
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STANDART MEZON QATORI ───────────────────────────────────────────────────

interface StandartMezonQatorProps {
  mezon: StandartMezonSozlama;
  onFaollik: () => void;
  onBallOzgartirish: (ball: number) => void;
  onReset: () => void;
}

function StandartMezonQator({ mezon, onFaollik, onBallOzgartirish, onReset }: StandartMezonQatorProps) {
  const ballOzgardi = mezon.ball !== mezon.asl_ball;

  return (
    <div className={`rounded-xl border-2 p-3 transition-all ${mezon.faol ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onFaollik}
          className="flex-shrink-0 transition-transform active:scale-90"
          title={mezon.faol ? "O'chirish" : "Yoqish"}
        >
          {mezon.faol
            ? <ToggleRight className="h-7 w-7 text-blue-600" />
            : <ToggleLeft className="h-7 w-7 text-gray-400" />
          }
        </button>

        <span className={`flex-1 text-xs font-semibold leading-snug ${mezon.faol ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
          {mezon.nom}
        </span>

        {mezon.faol && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button type="button" onClick={() => onBallOzgartirish(Math.max(0, mezon.ball - 1))} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-blue-200 text-gray-700 font-bold text-sm flex items-center justify-center transition-colors">−</button>
            <span className={`w-8 text-center text-sm font-black ${ballOzgardi ? 'text-orange-600' : 'text-blue-700'}`}>{mezon.ball}</span>
            <button type="button" onClick={() => onBallOzgartirish(Math.min(50, mezon.ball + 1))} className="w-6 h-6 rounded-full bg-gray-200 hover:bg-blue-200 text-gray-700 font-bold text-sm flex items-center justify-center transition-colors">+</button>
            {ballOzgardi && (
              <button type="button" onClick={onReset} title="Asl ballga qaytarish" className="p-1 hover:bg-orange-100 rounded-lg transition-colors text-orange-500">
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {!mezon.faol && (
          <span className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
            O'chirilgan
          </span>
        )}
      </div>
    </div>
  );
}

// ─── QO'SHIMCHA MEZON QATORI ─────────────────────────────────────────────────

interface QoshimchaMezonQatorProps {
  mezon: QoshimchaMezon;
  index: number;
  total: number;
  onOzgartirish: (field: 'shart' | 'ball', value: string | number) => void;
  onOchirish: () => void;
}

function QoshimchaMezonQator({ mezon, index, total, onOzgartirish, onOchirish }: QoshimchaMezonQatorProps) {
  const isEmpty = !mezon.shart.trim();
  // Faqat bitta bo'sh qator qolganda o'chirib bo'lmaydi
  const canDelete = !(total === 1 && isEmpty);

  return (
    <div className={`border-2 rounded-xl p-3 space-y-2 mb-2 transition-colors ${isEmpty ? 'bg-gray-50/60 border-purple-100' : 'bg-white border-purple-200'}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
          {isEmpty ? `${index + 1}-mezon (to'ldiring)` : `${index + 1}-ixtiyoriy mezon`}
        </span>
        {canDelete && (
          <button type="button" onClick={onOchirish} className="p-1 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Input
        placeholder="Shart yozing: 'aniq modda raqami ko'rsatilgan'..."
        value={mezon.shart}
        onChange={(e) => onOzgartirish('shart', e.target.value)}
        className={`border-2 text-sm transition-colors ${isEmpty ? 'border-purple-100 focus:border-purple-400' : 'border-purple-200 focus:border-purple-500'}`}
      />

      {!isEmpty && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-semibold">Ball:</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onOzgartirish('ball', Math.max(1, mezon.ball - 1))} className="w-6 h-6 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold flex items-center justify-center">−</button>
            <span className="w-8 text-center font-black text-purple-700">{mezon.ball}</span>
            <button type="button" onClick={() => onOzgartirish('ball', Math.min(20, mezon.ball + 1))} className="w-6 h-6 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold flex items-center justify-center">+</button>
          </div>
          <div className="flex gap-2 ml-2">
            <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">+{mezon.ball} bajarilsa</span>
            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">-{mezon.ball} bajarilmasa</span>
          </div>
        </div>
      )}
    </div>
  );
}
