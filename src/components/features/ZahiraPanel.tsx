import { useState, useRef } from 'react';
import {
  Download, Upload, Database, AlertTriangle, CheckCircle,
  Loader2, FileArchive, RefreshCw, Info, Key,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

// ── ZAHIRA v6.0 ──────────────────────────────────────────────────────────────
// Barcha jadvallar + API kalitlar (settings orqali) + premium tizim + XP tizim

interface ZahiraGroup {
  nom: string;
  icon: string;
  color: string;
  jadvallar: {
    key: string;
    nom: string;
    soni?: number;
    enabled: boolean;
  }[];
}

const GURUHLAR: ZahiraGroup[] = [
  {
    nom: "Foydalanuvchilar",
    icon: "👥",
    color: "blue",
    jadvallar: [
      { key: "talabalar", nom: "Barcha talabalar (Face ID + oddiy + login)", enabled: true },
      { key: "ustoz", nom: "Ustozlar (Face ID, karta, token)", enabled: true },
    ],
  },
  {
    nom: "Sinov tizimi",
    icon: "📝",
    color: "indigo",
    jadvallar: [
      { key: "testlar", nom: "Testlar (savollar, sozlamalar)", enabled: true },
      { key: "test_javoblar", nom: "Test javoblari", enabled: true },
      { key: "test_sessiyalar", nom: "Test sessiyalari", enabled: true },
    ],
  },
  {
    nom: "Kazus tizimi",
    icon: "📋",
    color: "violet",
    jadvallar: [
      { key: "toplamlar", nom: "Kazus toplamlar", enabled: true },
      { key: "javoblar", nom: "Kazus javoblari (AI baho)", enabled: true },
    ],
  },
  {
    nom: "O'quv materiallar",
    icon: "📚",
    color: "teal",
    jadvallar: [
      { key: "om_bolimlar", nom: "OQ.Materiallar bo'limlari", enabled: true },
      { key: "om_boblar", nom: "OQ.Materiallar boblari", enabled: true },
      { key: "om_materiallar", nom: "OQ.Materiallar fayllar (metadata)", enabled: true },
      { key: "om_korishlar", nom: "Ko'rishlar statistikasi", enabled: true },
      { key: "om_chunks", nom: "AI Chunks (Smart Ta'lim indeksi)", enabled: true },
      { key: "ai_cache", nom: "AI Cache (Smart Ta'lim javoblar)", enabled: true },
    ],
  },
  {
    nom: "Savol-Javob",
    icon: "💡",
    color: "purple",
    jadvallar: [
      { key: "sj_bolimlar", nom: "S-J bo'limlari", enabled: true },
      { key: "sj_boblar", nom: "S-J boblari", enabled: true },
      { key: "sj_savollar", nom: "S-J savollar", enabled: true },
      { key: "sj_natijalar", nom: "S-J natijalar", enabled: true },
    ],
  },
  {
    nom: "Premium tizim + XP",
    icon: "⭐",
    color: "amber",
    jadvallar: [
      { key: "premium_bolimlar", nom: "Premium bo'limlar", enabled: true },
      { key: "premium_boblar", nom: "Premium boblar", enabled: true },
      { key: "premium_kontent", nom: "Premium kontent", enabled: true },
      { key: "xp_tarix", nom: "XP tarixi (oylik natijalar)", enabled: true },
    ],
  },
  {
    nom: "Chat tizimi",
    icon: "💬",
    color: "pink",
    jadvallar: [
      { key: "chatlar", nom: "Chatlar", enabled: true },
      { key: "chat_azolar", nom: "Chat a'zolari", enabled: true },
      { key: "chat_habarlar", nom: "Chat xabarlari (oxirgi 5000)", enabled: true },
    ],
  },
  {
    nom: "To'lovlar",
    icon: "💳",
    color: "emerald",
    jadvallar: [
      { key: "payments", nom: "To'lovlar tarixi", enabled: true },
    ],
  },
  {
    nom: "Tizim sozlamalari + API kalitlar",
    icon: "⚙️",
    color: "orange",
    jadvallar: [
      { key: "settings", nom: "Barcha sozlamalar (API kalitlar, bot tokenlar, shablonlar)", enabled: true },
      { key: "yangiliklar", nom: "Yangiliklar", enabled: true },
      { key: "bildirishnomalar", nom: "Bildirishnomalar (oxirgi 1000)", enabled: true },
    ],
  },
  {
    nom: "Yordam va murojaat",
    icon: "🆘",
    color: "sky",
    jadvallar: [
      { key: "yordam_xabarlar", nom: "Yordam so'rovlari", enabled: true },
    ],
  },
  {
    nom: "Xavfsizlik va nazorat",
    icon: "🛡️",
    color: "red",
    jadvallar: [
      { key: "fraud_urinishlar", nom: "Fraud urinishlar", enabled: true },
      { key: "profil_tahrirlashlar", nom: "Profil tahrirlash so'rovlari", enabled: true },
      { key: "auto_start_signals", nom: "Avtomatik boshlash signallari", enabled: true },
      { key: "chaqiruvlar", nom: "Chaqiruvlar", enabled: true },
    ],
  },
];

async function jadvalniYukla(key: string): Promise<any[]> {
  switch (key) {
    case 'talabalar':
      return (await supabase.from('talabalar').select('*').order('created_at')).data || [];
    case 'ustoz':
      return (await supabase.from('ustoz').select('*').order('created_at')).data || [];
    case 'testlar':
      return (await supabase.from('testlar').select('*').order('created_at')).data || [];
    case 'test_javoblar':
      return (await supabase.from('test_javoblar').select('*').order('created_at')).data || [];
    case 'test_sessiyalar':
      return (await supabase.from('test_sessiyalar').select('*').order('created_at')).data || [];
    case 'toplamlar':
      return (await supabase.from('toplamlar').select('*').order('created_at')).data || [];
    case 'javoblar':
      return (await supabase.from('javoblar').select('*').order('created_at')).data || [];
    case 'om_bolimlar':
      return (await supabase.from('om_bolimlar').select('*').order('created_at')).data || [];
    case 'om_boblar':
      return (await supabase.from('om_boblar').select('*').order('created_at')).data || [];
    case 'om_materiallar':
      return (await supabase.from('om_materiallar').select('id, bob_id, bolim_id, nomi, fayl_url, fayl_tur, fayl_hajm, tartib, created_at').order('created_at')).data || [];
    case 'om_korishlar':
      return (await supabase.from('om_korishlar').select('*').order('created_at')).data || [];
    case 'om_chunks':
      return (await supabase.from('om_chunks').select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn,keywords,created_at').order('created_at')).data || [];
    case 'ai_cache':
      return (await supabase.from('ai_cache').select('id,savol_hash,savol_matn,javob_matn,model,ishlatilgan,created_at,updated_at').order('updated_at', { ascending: false }).limit(5000)).data || [];
    case 'sj_bolimlar':
      return (await supabase.from('sj_bolimlar').select('*').order('created_at')).data || [];
    case 'sj_boblar':
      return (await supabase.from('sj_boblar').select('*').order('created_at')).data || [];
    case 'sj_savollar':
      return (await supabase.from('sj_savollar').select('*').order('created_at')).data || [];
    case 'sj_natijalar':
      return (await supabase.from('sj_natijalar').select('*').order('created_at')).data || [];
    // ── Premium + XP ──
    case 'premium_bolimlar':
      return (await supabase.from('premium_bolimlar').select('*').order('created_at')).data || [];
    case 'premium_boblar':
      return (await supabase.from('premium_boblar').select('*').order('created_at')).data || [];
    case 'premium_kontent':
      return (await supabase.from('premium_kontent').select('*').order('created_at')).data || [];
    case 'xp_tarix':
      return (await supabase.from('xp_tarix').select('id, talaba_id, login_id, oquvchi_ismi, xp_miqdor, sabab, manba_tur, manba_id, created_at').order('created_at', { ascending: false }).limit(10000)).data || [];
    // ── Chat ──
    case 'chatlar':
      return (await supabase.from('chatlar').select('*').order('created_at')).data || [];
    case 'chat_azolar':
      return (await supabase.from('chat_azolar').select('*').order('created_at')).data || [];
    case 'chat_habarlar':
      return (await supabase.from('chat_habarlar').select('*').order('created_at', { ascending: false }).limit(5000)).data || [];
    // ── To'lov ──
    case 'payments':
      return (await supabase.from('payments').select('*').order('created_at')).data || [];
    // ── Tizim + API kalitlar ──
    case 'settings':
      // BARCHA sozlamalar — API kalitlar, bot tokenlar, shablonlar
      return (await supabase.from('settings').select('*')).data || [];
    case 'yangiliklar':
      return (await supabase.from('yangiliklar').select('*').order('created_at')).data || [];
    case 'bildirishnomalar':
      return (await supabase.from('bildirishnomalar').select('*').order('created_at', { ascending: false }).limit(1000)).data || [];
    // ── Yordam ──
    case 'yordam_xabarlar':
      return (await supabase.from('yordam_xabarlar').select('*').order('created_at', { ascending: false })).data || [];
    // ── Xavfsizlik ──
    case 'fraud_urinishlar':
      return (await supabase.from('fraud_urinishlar').select('id, ism, familiya, kurs, guruh, mos_talaba_ism, mos_talaba_familiya, mos_talaba_guruh, mos_talaba_kurs, distance, created_at, new_talaba_id, admin_status').order('created_at')).data || [];
    case 'profil_tahrirlashlar':
      return (await supabase.from('profil_tahrirlashlar').select('id, tur, murojaat_id, eski_ism, eski_familiya, yangi_ism, yangi_familiya, holat, created_at, admin_izoh').order('created_at')).data || [];
    case 'auto_start_signals':
      return (await supabase.from('auto_start_signals').select('*').order('created_at')).data || [];
    case 'chaqiruvlar':
      return (await supabase.from('chaqiruvlar').select('*').order('created_at')).data || [];
    default:
      return [];
  }
}

function conflictUstuni(key: string): string {
  if (key === 'settings') return 'key';
  if (key === 'chat_azolar') return 'id';
  return 'id';
}

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-400 bg-blue-50 text-blue-800',
  indigo: 'border-indigo-400 bg-indigo-50 text-indigo-800',
  violet: 'border-violet-400 bg-violet-50 text-violet-800',
  teal: 'border-teal-400 bg-teal-50 text-teal-800',
  purple: 'border-purple-400 bg-purple-50 text-purple-800',
  pink: 'border-pink-400 bg-pink-50 text-pink-800',
  emerald: 'border-emerald-400 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-400 bg-amber-50 text-amber-800',
  orange: 'border-orange-400 bg-orange-50 text-orange-800',
  red: 'border-red-400 bg-red-50 text-red-800',
  sky: 'border-sky-400 bg-sky-50 text-sky-800',
};

// Tiklanish tartibi — jadvallar orasida bog'liqlik bor
const TARTIB = [
  'settings', 'yangiliklar',
  'ustoz', 'talabalar',
  'testlar', 'test_javoblar', 'test_sessiyalar',
  'toplamlar', 'javoblar',
  'om_bolimlar', 'om_boblar', 'om_materiallar', 'om_korishlar', 'om_chunks', 'ai_cache',
  'sj_bolimlar', 'sj_boblar', 'sj_savollar', 'sj_natijalar',
  'premium_bolimlar', 'premium_boblar', 'premium_kontent',
  'xp_tarix',
  'chatlar', 'chat_azolar', 'chat_habarlar',
  'payments',
  'bildirishnomalar', 'fraud_urinishlar', 'profil_tahrirlashlar',
  'auto_start_signals', 'chaqiruvlar',
  'yordam_xabarlar',
];

export default function ZahiraPanel() {
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [tiklanmoqda, setTiklanmoqda] = useState(false);
  const [oxirgiZahira, setOxirgiZahira] = useState<string | null>(null);
  const [jarayonXabari, setJarayonXabari] = useState('');
  const [progress, setProgress] = useState(0);
  const [ochiqGuruhlar, setOchiqGuruhlar] = useState<Set<number>>(new Set([0, 8]));
  const [tiklashNatija, setTiklashNatija] = useState<{
    muvaffaqiyat: boolean;
    xabar: string;
    tafsilotlar: string[];
    statistika?: Record<string, number>;
  } | null>(null);
  const [zahiraStatistika, setZahiraStatistika] = useState<Record<string, number> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const guruhToggle = (idx: number) => {
    setOchiqGuruhlar(prev => {
      const n = new Set(prev);
      n.has(idx) ? n.delete(idx) : n.add(idx);
      return n;
    });
  };

  // ── ZAHIRALASH ─────────────────────────────────────────────────────────────
  const zahiralash = async () => {
    setYuklanmoqda(true);
    setTiklashNatija(null);
    setZahiraStatistika(null);
    setProgress(0);
    setJarayonXabari("Ma'lumotlar yuklanmoqda...");

    const database: Record<string, any[]> = {};
    const statistika: Record<string, number> = {};

    const barchaJadvallar: string[] = [];
    GURUHLAR.forEach(g => g.jadvallar.forEach(j => { if (j.enabled) barchaJadvallar.push(j.key); }));

    try {
      for (let i = 0; i < barchaJadvallar.length; i++) {
        const key = barchaJadvallar[i];
        setJarayonXabari(`${key} yuklanmoqda... (${i + 1}/${barchaJadvallar.length})`);
        setProgress(Math.round(((i + 1) / barchaJadvallar.length) * 80));

        try {
          const data = await jadvalniYukla(key);
          database[key] = data;
          statistika[key] = data.length;
        } catch (e) {
          console.error(`${key} yuklash xatosi:`, e);
          database[key] = [];
          statistika[key] = 0;
        }
      }

      setJarayonXabari('JSON fayl tayyorlanmoqda...');
      setProgress(90);

      // API kalitlarni alohida sana (settings dan)
      const apiKalitlar: Record<string, string> = {};
      const apiKeyNames = ['GROQ_API_KEY', 'TELEGRAM_TOKEN', 'USTOZ_BOT_TOKEN', 'TELEGRAM_CHANNEL_IDS', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_BOT_LINK', 'USTOZ_BOT_LINK', 'BOT_SITE_URL'];
      (database['settings'] || []).forEach((s: any) => {
        if (apiKeyNames.includes(s.key) && s.text_value) {
          apiKalitlar[s.key] = s.text_value;
        }
      });

      const backup = {
        version: '6.0',
        sana: new Date().toISOString(),
        platforma: 'FanFaster',
        // API kalitlar tezkor ko'rish uchun alohida
        apiKalitlar,
        statistika,
        database,
      };

      const jsonStr = JSON.stringify(backup, null, 2);
      const fileSizeKB = Math.round(jsonStr.length / 1024);
      const blob = new Blob([new TextEncoder().encode(jsonStr)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const sana = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `fanfaster_zahira_${sana}.json`;
      document.body.appendChild(a);
      // Brauzer bloklamasligi uchun kichik delay
      await new Promise(r => setTimeout(r, 100));
      a.click();
      await new Promise(r => setTimeout(r, 500));
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      setOxirgiZahira(new Date().toLocaleString('uz-UZ'));
      setZahiraStatistika(statistika);

      const jami = Object.values(statistika).reduce((s, v) => s + v, 0);

      toast({
        title: '✅ Zahira muvaffaqiyatli yaratildi!',
        description: `${jami} ta yozuv, ${fileSizeKB} KB — API kalitlar ham saqlab olindi`,
      });
    } catch (err: any) {
      console.error('Zahira xatosi:', err);
      toast({ title: 'Xato', description: err.message || 'Zahira yaratishda xatolik', variant: 'destructive' });
    } finally {
      setYuklanmoqda(false);
      setJarayonXabari('');
      setTimeout(() => setProgress(0), 2000);
    }
  };

  // ── TIKLASH ────────────────────────────────────────────────────────────────
  const zahiraniYuklash = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fayl = e.target.files?.[0];
    if (!fayl) return;

    if (!fayl.name.endsWith('.json')) {
      toast({ title: 'Xato', description: 'Faqat .json formatidagi zahira fayli qabul qilinadi', variant: 'destructive' });
      return;
    }

    setTiklanmoqda(true);
    setTiklashNatija(null);
    setProgress(0);
    setJarayonXabari("Fayl o'qilmoqda...");

    try {
      const matn = await fayl.text();
      const backup = JSON.parse(matn);

      if (!backup.database) throw new Error("Noto'g'ri zahira fayl formati");

      const tafsilotlar: string[] = [];
      const statistika: Record<string, number> = {};
      const db = backup.database;

      // API kalitlar mavjud bo'lsa ular haqida ma'lumot
      if (backup.apiKalitlar && Object.keys(backup.apiKalitlar).length > 0) {
        tafsilotlar.push(`🔑 API kalitlar settings jadvalida saqlanadi — ${Object.keys(backup.apiKalitlar).length} ta kalit`);
      }

      const barchaJadvallar = Object.keys(db);
      let done = 0;

      const batchUpsert = async (key: string, data: any[], label: string) => {
        if (!data?.length) {
          tafsilotlar.push(`— ${label}: bo'sh`);
          statistika[key] = 0;
          return;
        }
        const BATCH = 50;
        let ok = 0, err = 0;
        for (let i = 0; i < data.length; i += BATCH) {
          const qism = data.slice(i, i + BATCH);
          const { error } = await supabase.from(key).upsert(qism, {
            onConflict: conflictUstuni(key),
            ignoreDuplicates: false,
          });
          if (error) { err += qism.length; console.error(`${key}:`, error.message); }
          else ok += qism.length;
        }
        if (err > 0) tafsilotlar.push(`⚠️ ${label}: ${ok} ta tiklandi, ${err} ta xato`);
        else tafsilotlar.push(`✅ ${ok} ta ${label}`);
        statistika[key] = ok;
      };

      const tartibliJadvallar = [
        ...TARTIB.filter(k => db[k] !== undefined),
        ...barchaJadvallar.filter(k => !TARTIB.includes(k)),
      ];

      for (const key of tartibliJadvallar) {
        const label = GURUHLAR.flatMap(g => g.jadvallar).find(j => j.key === key)?.nom || key;
        setJarayonXabari(`${label} tiklanmoqda...`);
        done++;
        setProgress(Math.round((done / tartibliJadvallar.length) * 90));
        await batchUpsert(key, db[key] || [], label);
      }

      setProgress(100);
      setTiklashNatija({
        muvaffaqiyat: true,
        xabar: 'Baza muvaffaqiyatli yangilandi!',
        tafsilotlar,
        statistika,
      });

      toast({ title: '✅ Tiklash muvaffaqiyatli!', description: 'Sahifa 3 soniyada yangilanadi...' });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err: any) {
      console.error('Tiklash xatosi:', err);
      setTiklashNatija({
        muvaffaqiyat: false,
        xabar: err.message || 'Tiklashda xatolik',
        tafsilotlar: ["❌ Fayl formati noto'g'ri yoki buzilgan"],
      });
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setTiklanmoqda(false);
      setJarayonXabari('');
      setTimeout(() => setProgress(0), 2000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const jami = zahiraStatistika ? Object.values(zahiraStatistika).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── SARLAVHA ── */}
      <Card className="border-2 border-slate-700 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/20">
              <Database className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Ma'lumotlar Zahirasi</h1>
              <p className="text-slate-300 text-sm mt-1">
                v6.0 — Barcha jadvallar + API kalitlar + Premium/XP tizim
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── API KALITLAR ESLATMA ── */}
      <Card className="border-2 border-amber-400 bg-amber-50/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-bold mb-1.5">🔑 API kalitlar va bot tokenlar zahiraga kiradi</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-amber-800">
                {['GROQ_API_KEY', 'TELEGRAM_TOKEN', 'USTOZ_BOT_TOKEN', 'TELEGRAM_CHANNEL_IDS', 'TELEGRAM_BOT_LINK', 'BOT_SITE_URL'].map(k => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <code className="font-mono text-[10px]">{k}</code>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-amber-700">⚠️ Zahira faylini xavfsiz joyda saqlang — API kalitlar unda ochiq ko'rinadi!</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── JADVALLAR RO'YXATI ── */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-slate-500" />
            Zahira tarkibi — barcha jadvallar ({GURUHLAR.reduce((s, g) => s + g.jadvallar.length, 0)} ta)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-2">
          {GURUHLAR.map((guruh, idx) => {
            const ochiq = ochiqGuruhlar.has(idx);
            const colorCls = COLOR_MAP[guruh.color] || 'border-gray-200 bg-gray-50 text-gray-700';
            const statJami = zahiraStatistika
              ? guruh.jadvallar.reduce((s, j) => s + (zahiraStatistika[j.key] || 0), 0)
              : null;

            return (
              <div key={idx} className={`border-2 rounded-xl overflow-hidden ${colorCls.split(' ')[0]}`}>
                <button
                  className={`w-full flex items-center justify-between px-4 py-3 ${colorCls.split(' ').slice(1).join(' ')} font-bold text-sm`}
                  onClick={() => guruhToggle(idx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{guruh.icon}</span>
                    <span>{guruh.nom}</span>
                    <span className="font-normal opacity-60">({guruh.jadvallar.length} ta jadval)</span>
                    {statJami !== null && (
                      <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-black">
                        {statJami} yozuv
                      </span>
                    )}
                  </div>
                  {ochiq ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
                </button>
                {ochiq && (
                  <div className="px-4 py-3 bg-white/60 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {guruh.jadvallar.map(j => (
                      <div key={j.key} className="flex items-center gap-2 text-xs">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="font-semibold text-gray-700">{j.nom}</span>
                        {zahiraStatistika && (
                          <span className="ml-auto text-gray-400 font-mono">{zahiraStatistika[j.key] ?? 0}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="border-2 border-orange-200 rounded-xl p-3 bg-orange-50/50">
            <p className="text-xs font-bold text-orange-700 mb-1">⚠️ Qisman zahiralash:</p>
            <ul className="text-xs text-orange-600 space-y-0.5 list-disc list-inside">
              <li>Chat xabarlari: oxirgi 5000 ta (hajmni tejash)</li>
              <li>Bildirishnomalar: oxirgi 1000 ta</li>
              <li>XP tarixi: oxirgi 10000 ta</li>
              <li>O'quv materiallar fayllari: faqat metadata (fayl o'zi Storage'da)</li>
              <li>AI Chunks: oxirgi chunklangan indeks (Smart Ta'lim uchun)</li>
              <li>AI Cache: oxirgi 5000 ta kesh javob</li>
              <li>Fraud rasmlari va profil rasmlari: maxfiylik uchun chiqarib tashlanadi</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* ── PROGRESS BAR ── */}
      {(yuklanmoqda || tiklanmoqda) && (
        <Card className="border-2 border-blue-300 bg-blue-50">
          <CardContent className="py-5">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <p className="text-sm font-bold text-blue-800">{jarayonXabari || 'Jarayon...'}</p>
            </div>
            <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-blue-600 mt-1.5 text-right font-bold">{progress}%</p>
          </CardContent>
        </Card>
      )}

      {/* ── ZAHIRALASH / TIKLASH ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* ZAHIRALASH */}
        <Card className="border-2 border-green-400 shadow-lg">
          <CardHeader className="bg-gradient-to-br from-green-600 to-emerald-600 text-white rounded-t-[calc(theme(borderRadius.lg)-2px)]">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="bg-white/20 p-2 rounded-xl"><Download className="h-6 w-6" /></div>
              Zahira Yaratish
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm">
              <p className="font-bold text-green-900">Zahira o'z ichiga oladi:</p>
              <div className="grid grid-cols-2 gap-1">
                {GURUHLAR.map((g, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-green-800">
                    <span>{g.icon}</span>
                    <span className="font-medium">{g.nom.split('+')[0].trim()}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <p className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                  <Key className="h-3.5 w-3.5" />API kalitlar va bot tokenlar ham saqlanadi
                </p>
              </div>
            </div>

            {oxirgiZahira && (
              <div className="flex items-center gap-2 bg-green-100 border border-green-300 rounded-lg px-3 py-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <div>
                  <span className="font-bold">Oxirgi zahira: {oxirgiZahira}</span>
                  {zahiraStatistika && (
                    <p className="text-xs text-green-600 mt-0.5">Jami {jami} ta yozuv saqlandi</p>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={zahiralash}
              disabled={yuklanmoqda || tiklanmoqda}
              className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-black text-lg shadow-lg"
              size="lg"
            >
              {yuklanmoqda ? (
                <><Loader2 className="mr-3 h-6 w-6 animate-spin" />Yuklanmoqda...</>
              ) : (
                <><FileArchive className="mr-3 h-6 w-6" />Zahira Yuklab Olish</>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center">
              <code className="bg-gray-100 px-1 rounded">fanfaster_zahira_YYYY-MM-DD.json</code>
            </p>
          </CardContent>
        </Card>

        {/* TIKLASH */}
        <Card className="border-2 border-blue-400 shadow-lg">
          <CardHeader className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-t-[calc(theme(borderRadius.lg)-2px)]">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="bg-white/20 p-2 rounded-xl"><Upload className="h-6 w-6" /></div>
              Zahiradan Tiklash
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900 space-y-1">
              <p className="font-bold mb-2">Tiklash haqida:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Mavjud yozuvlar yangilanadi, yangilari qo'shiladi</li>
                <li>Hech qanday ma'lumot o'chirilmaydi</li>
                <li>v5.0 va v6.0 zahira fayllari qabul qilinadi</li>
                <li>API kalitlar settings jadvalida tiklanadi</li>
                <li>Bog'liq jadvallar to'g'ri tartibda tiklanadi</li>
              </ul>
            </div>

            <div
              className="border-2 border-dashed border-blue-300 rounded-xl p-6 text-center bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileArchive className="h-10 w-10 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-blue-700">JSON zahira faylini tanlang</p>
              <p className="text-xs text-blue-500 mt-1">fanfaster_zahira_*.json (v5.0 va v6.0)</p>
            </div>

            <input ref={fileInputRef} type="file" accept=".json" onChange={zahiraniYuklash} className="hidden" />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={tiklanmoqda || yuklanmoqda}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-lg shadow-lg"
              size="lg"
            >
              {tiklanmoqda ? (
                <><Loader2 className="mr-3 h-6 w-6 animate-spin" />Tiklanmoqda...</>
              ) : (
                <><RefreshCw className="mr-3 h-6 w-6" />Zahiradan Tiklash</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── TIKLASH NATIJASI ── */}
      {tiklashNatija && (
        <Card className={`border-2 shadow-xl ${tiklashNatija.muvaffaqiyat ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              {tiklashNatija.muvaffaqiyat ? (
                <CheckCircle className="h-8 w-8 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0" />
              )}
              <div>
                <h3 className={`text-xl font-black ${tiklashNatija.muvaffaqiyat ? 'text-green-800' : 'text-red-800'}`}>
                  {tiklashNatija.xabar}
                </h3>
                {tiklashNatija.statistika && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    Jami {Object.values(tiklashNatija.statistika).reduce((s, v) => s + v, 0)} ta yozuv tiklandi
                  </p>
                )}
              </div>
            </div>

            {tiklashNatija.statistika && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GURUHLAR.map((g, i) => {
                  const guruhJami = g.jadvallar.reduce((s, j) => s + (tiklashNatija.statistika![j.key] || 0), 0);
                  if (guruhJami === 0) return null;
                  return (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-center shadow-sm">
                      <p className="text-xs text-gray-500">{g.icon} {g.nom.split('+')[0].trim()}</p>
                      <p className="text-xl font-black text-gray-800 mt-0.5">{guruhJami}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <details className="cursor-pointer">
              <summary className="text-sm font-bold text-gray-600 hover:text-gray-900">Batafsil ko'rish ({tiklashNatija.tafsilotlar.length} ta jadval)</summary>
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
                {tiklashNatija.tafsilotlar.map((t, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg text-xs font-medium ${
                    t.startsWith('✅') ? 'bg-green-100 text-green-800' :
                    t.startsWith('⚠️') ? 'bg-yellow-100 text-yellow-800' :
                    t.startsWith('🔑') ? 'bg-amber-100 text-amber-800' :
                    t.startsWith('—') ? 'bg-gray-50 text-gray-500' :
                    'bg-red-100 text-red-800'
                  }`}>{t}</div>
                ))}
              </div>
            </details>

            {tiklashNatija.muvaffaqiyat && (
              <div className="bg-green-100 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full flex-shrink-0" />
                <p className="text-sm text-green-800 font-semibold">Sahifa 3 soniyadan keyin avtomatik yangilanadi...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── OGOHLANTIRISH ── */}
      <Card className="border border-orange-200 bg-orange-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-900">
              <p className="font-bold mb-1.5">⚠️ Muhim eslatmalar:</p>
              <ul className="space-y-1 list-disc list-inside text-xs">
                <li>Zahirani <strong>har hafta kamida 1 marta</strong> yuklab oling</li>
                <li>Tiklash paytida mavjud ma'lumotlar <strong>o'zgarmaydi</strong> — yangilari qo'shiladi</li>
                <li>Zahira faylida <strong>API kalitlar va bot tokenlar</strong> ochiq ko'rinadi — xavfsiz saqlang</li>
                <li>Face ID (face_descriptor) ma'lumotlari ham zahiraga kiradi</li>
                <li>O'quv materiallar fayllari Storage'da — zahira faqat <strong>URL metadata</strong> saqlaydi</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
