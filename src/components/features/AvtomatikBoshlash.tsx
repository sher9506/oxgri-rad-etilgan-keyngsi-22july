import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WifiOff, Play, Loader2, RefreshCw, Filter,
  CheckSquare, Square, Users, Lock, Unlock, Zap,
  AlertCircle, Clock, Shield, ShieldOff,
  ChevronDown, Hash, Search,
  CheckCircle, XCircle, UserCheck,
  Timer, ShieldAlert, Snowflake
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface KutuvchiOquvchi {
  id: string;
  oquvchi_ism: string;
  oquvchi_familiya: string;
  kurs: string;
  guruh: string;
  kutish_kod: string | null;
  kutish_tur: string | null;
  last_seen: string;
  tasdiqlangan: boolean;
}

// Muzlatilgan (Snapshot) holatdan keyin kelgan kechikkan o'quvchi
interface KechikkanOquvchi {
  ism: string;
  familiya: string;
  kurs: string;
  guruh: string;
  last_seen: string;
}

interface AvtomatikBoshlashProps {
  ustozId: string;
  defaultKod?: string;
  tur?: 'test' | 'kazus' | 'ikkalasi';
}

const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];
const GURUHLAR = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3'];
const ONLINE_MUDDAT_MS = 60000; // 60 soniya

function getVaqtFarq(lastSeen: string): string {
  const farq = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  if (farq < 5) return 'Hozirgina';
  if (farq < 60) return `${farq}s`;
  return `${Math.floor(farq / 60)}d`;
}

export default function AvtomatikBoshlash({ ustozId, defaultKod = '', tur = 'ikkalasi' }: AvtomatikBoshlashProps) {
  const { toast } = useToast();

  // ── Kod va tur ──────────────────────────────────────────────────────────
  const [kod, setKod] = useState(defaultKod);
  const [inputKod, setInputKod] = useState(defaultKod);
  const [kodTuri, setKodTuri] = useState<'test' | 'kazus' | null>(null);
  const [kodNomi, setKodNomi] = useState('');
  const [kodIsActive, setKodIsActive] = useState(false);
  const [kodYuklanyapti, setKodYuklanyapti] = useState(false);

  // ── O'quvchilar ─────────────────────────────────────────────────────────
  const [kutuvchilar, setKutuvchilar] = useState<KutuvchiOquvchi[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);

  // ── Tanlash (toggle) ─────────────────────────────────────────────────────
  const [ruxsatlilar, setRuxsatlilar] = useState<Map<string, boolean>>(new Map());

  // ── Filtrlar ─────────────────────────────────────────────────────────────
  const [filterKurs, setFilterKurs] = useState('barchasi');
  const [filterGuruh, setFilterGuruh] = useState('barchasi');
  const [filterTasdiq, setFilterTasdiq] = useState<'barchasi' | 'tasdiqlangan' | 'tasdiqlanmagan'>('barchasi');
  const [qidiruv, setQidiruv] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Boshlash holati ───────────────────────────────────────────────────────
  const [boshlanyapti, setBoshlanyapti] = useState(false);
  const [boshlashNatija, setBoshlashNatija] = useState<'muvaffaqiyat' | 'xato' | null>(null);

  // ── Qat'iy Nazorat (Snapshot + Kechikkanlar) ──────────────────────────────
  const [muzlatilganSessiyaId, setMuzlatilganSessiyaId] = useState<string | null>(null);
  const [kechikkanlar, setKechikkanlar] = useState<KechikkanOquvchi[]>([]);
  const [kechikkanRuxsatYuklanyapti, setKechikkanRuxsatYuklanyapti] = useState<string | null>(null);
  const [activeKanatTab, setActiveKanatTab] = useState<'kutuvchilar' | 'kechikkanlar'>('kutuvchilar');

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const kechikkanPollingRef = useRef<NodeJS.Timeout | null>(null);

  // ── Kodni tasdiqlash ─────────────────────────────────────────────────────
  const kodniTekshirish = useCallback(async (k: string) => {
    if (!k || k.length !== 5) return;
    setKodYuklanyapti(true);
    setKodTuri(null);
    setKodNomi('');
    setKodIsActive(false);
    setKutuvchilar([]);
    setBoshlashNatija(null);
    setMuzlatilganSessiyaId(null);
    setKechikkanlar([]);

    try {
      const [toplamRes, testRes] = await Promise.all([
        supabase.from('toplamlar').select('kod, mavzu, is_active').eq('kod', k).maybeSingle(),
        supabase.from('testlar').select('kod, test_nomi, is_active').eq('kod', k).maybeSingle(),
      ]);

      if (toplamRes.data) {
        setKodTuri('kazus');
        setKodNomi(toplamRes.data.mavzu || 'Kazus toplami');
        setKodIsActive(toplamRes.data.is_active);
        setKod(k);
      } else if (testRes.data) {
        setKodTuri('test');
        setKodNomi(testRes.data.test_nomi || 'Test');
        setKodIsActive(testRes.data.is_active);
        setKod(k);
      } else {
        toast({ title: 'Topilmadi', description: 'Bu kod bilan test yoki kazus topilmadi', variant: 'destructive' });
        setKod('');
      }
    } catch (e) {
      console.error('Kod tekshirishda xato:', e);
    } finally {
      setKodYuklanyapti(false);
    }
  }, [toast]);

  // ── Kutuvchilarni yuklash ─────────────────────────────────────────────────
  const kutuvchilarniYuklash = useCallback(async (silent = false) => {
    if (!kod) return;
    if (!silent) setYuklanyapti(true);

    try {
      const chegaraVaqt = new Date(Date.now() - ONLINE_MUDDAT_MS).toISOString();

      const { data: onlineData, error } = await supabase
        .from('online_presence')
        .select('*')
        .eq('kutish_kod', kod)
        .gt('last_seen', chegaraVaqt)
        .order('last_seen', { ascending: false });

      if (error) throw error;

      const ismlar = (onlineData || []).map((o: any) => o.oquvchi_ism);
      let tasdiqlanganSet = new Set<string>();
      if (ismlar.length > 0) {
        const { data: talabaData } = await supabase
          .from('talabalar')
          .select('ism, familiya, face_descriptor')
          .in('ism', ismlar);

        (talabaData || []).forEach((t: any) => {
          if (t.face_descriptor && Array.isArray(t.face_descriptor) && t.face_descriptor.length > 0) {
            tasdiqlanganSet.add(`${t.ism}|${t.familiya}`);
          }
        });
      }

      const yangilar: KutuvchiOquvchi[] = (onlineData || []).map((o: any) => ({
        ...o,
        tasdiqlangan: tasdiqlanganSet.has(`${o.oquvchi_ism}|${o.oquvchi_familiya}`),
      }));

      setKutuvchilar(yangilar);

      setRuxsatlilar(prev => {
        const yangi = new Map(prev);
        yangilar.forEach(o => {
          const key = `${o.oquvchi_ism}|${o.oquvchi_familiya}`;
          if (!yangi.has(key)) {
            yangi.set(key, true);
          }
        });
        return yangi;
      });
    } catch (e) {
      console.error('Kutuvchilar yuklashda xato:', e);
    } finally {
      if (!silent) setYuklanyapti(false);
    }
  }, [kod]);

  // ── Kechikkanlarni aniqlash ───────────────────────────────────────────────
  const kechikkanlarniYuklash = useCallback(async (sessiyaId: string, ruxsatlilarRoyhat: string[]) => {
    if (!kod) return;
    try {
      const chegaraVaqt = new Date(Date.now() - ONLINE_MUDDAT_MS).toISOString();
      const { data: onlineData } = await supabase
        .from('online_presence')
        .select('*')
        .eq('kutish_kod', kod)
        .gt('last_seen', chegaraVaqt);

      const ruxsatliSet = new Set(ruxsatlilarRoyhat.map(r => r.toLowerCase()));

      const yangiKechikkanlar: KechikkanOquvchi[] = (onlineData || [])
        .filter((o: any) => {
          const nomi = `${o.oquvchi_ism} ${o.oquvchi_familiya}`.toLowerCase();
          return !ruxsatliSet.has(nomi);
        })
        .map((o: any) => ({
          ism: o.oquvchi_ism,
          familiya: o.oquvchi_familiya,
          kurs: o.kurs,
          guruh: o.guruh,
          last_seen: o.last_seen,
        }));

      setKechikkanlar(yangiKechikkanlar);
    } catch (e) {
      console.error('Kechikkanlarni yuklashda xato:', e);
    }
  }, [kod]);

  // ── Mavjud 'auto' sessiyani yuklash ──────────────────────────────────────
  const mavjudSessiyaniYuklash = useCallback(async () => {
    if (!kod) return;
    try {
      const { data: sessiya } = await supabase
        .from('test_sessiyalar')
        .select('*')
        .eq('test_kod', kod)
        .eq('sessiya_turi', 'auto')
        .eq('faol', true)
        .maybeSingle();

      if (sessiya) {
        setMuzlatilganSessiyaId(sessiya.id);
        kechikkanlarniYuklash(sessiya.id, sessiya.ruxsatli_oquvchilar || []);
      }
    } catch (e) {
      console.error('Sessiyani yuklashda xato:', e);
    }
  }, [kod, kechikkanlarniYuklash]);

  // ── Kod o'zgarganda yuklash ───────────────────────────────────────────────
  useEffect(() => {
    if (!kod) return;

    kutuvchilarniYuklash();
    mavjudSessiyaniYuklash();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => kutuvchilarniYuklash(true), 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [kod, kutuvchilarniYuklash, mavjudSessiyaniYuklash]);

  // ── Kechikkanlar polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (!muzlatilganSessiyaId || !kod) {
      if (kechikkanPollingRef.current) clearInterval(kechikkanPollingRef.current);
      return;
    }

    const tekshirish = async () => {
      const { data: sessiya } = await supabase
        .from('test_sessiyalar')
        .select('ruxsatli_oquvchilar')
        .eq('id', muzlatilganSessiyaId)
        .maybeSingle();
      if (sessiya) {
        kechikkanlarniYuklash(muzlatilganSessiyaId, sessiya.ruxsatli_oquvchilar || []);
      }
    };

    tekshirish();
    kechikkanPollingRef.current = setInterval(tekshirish, 3000);
    return () => { if (kechikkanPollingRef.current) clearInterval(kechikkanPollingRef.current); };
  }, [muzlatilganSessiyaId, kod, kechikkanlarniYuklash]);

  // ── Kod holati polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!kod || !kodTuri) return;

    const tekshirish = async () => {
      const jadval = kodTuri === 'test' ? 'testlar' : 'toplamlar';
      const { data } = await supabase.from(jadval).select('is_active').eq('kod', kod).maybeSingle();
      if (data) setKodIsActive(data.is_active);
    };

    pollingRef.current = setInterval(tekshirish, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [kod, kodTuri]);

  // ── Barcha/hech kimni tanlash ─────────────────────────────────────────────
  const barchasiniTanlash = () => {
    const yangi = new Map<string, boolean>();
    filteredKutuvchilar.forEach(o => yangi.set(`${o.oquvchi_ism}|${o.oquvchi_familiya}`, true));
    ruxsatlilar.forEach((v, k) => { if (!yangi.has(k)) yangi.set(k, v); });
    setRuxsatlilar(yangi);
  };

  const hechKimniTanlamaslik = () => {
    const yangi = new Map(ruxsatlilar);
    filteredKutuvchilar.forEach(o => yangi.set(`${o.oquvchi_ism}|${o.oquvchi_familiya}`, false));
    setRuxsatlilar(yangi);
  };

  const toggleRuxsat = (key: string) => {
    setRuxsatlilar(prev => {
      const yangi = new Map(prev);
      yangi.set(key, !yangi.get(key));
      return yangi;
    });
  };

  // ── Filtrlash ──────────────────────────────────────────────────────────────
  const filteredKutuvchilar = kutuvchilar.filter(o => {
    if (filterKurs !== 'barchasi' && o.kurs !== filterKurs) return false;
    if (filterGuruh !== 'barchasi' && o.guruh !== filterGuruh) return false;
    if (filterTasdiq === 'tasdiqlangan' && !o.tasdiqlangan) return false;
    if (filterTasdiq === 'tasdiqlanmagan' && o.tasdiqlangan) return false;
    if (qidiruv) {
      const q = qidiruv.toLowerCase();
      if (!o.oquvchi_ism.toLowerCase().includes(q) && !o.oquvchi_familiya.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const ruxsatliSoni = Array.from(ruxsatlilar.values()).filter(v => v).length;
  const ruxsatsizSoni = kutuvchilar.length - ruxsatliSoni;

  // ── Avtomatik boshlash (QAT'IY NAZORAT bilan) ────────────────────────────
  const avtomatikBoshlash = async () => {
    if (!kod || !kodTuri) return;

    const ruxsatliRoyhat: string[] = [];
    ruxsatlilar.forEach((ruxsat, key) => {
      if (ruxsat) {
        const parts = key.split('|');
        ruxsatliRoyhat.push(`${parts[0]} ${parts[1]}`);
      }
    });

    if (ruxsatliRoyhat.length === 0) {
      toast({ title: 'Ogohlantirish', description: "Hech bir o'quvchiga ruxsat berilmagan!", variant: 'destructive' });
      return;
    }

    setBoshlanyapti(true);
    setBoshlashNatija(null);

    try {
      // 1. SNAPSHOT — ruxsatli o'quvchilar muzlatiladi
      await supabase
        .from('test_sessiyalar')
        .update({ faol: false })
        .eq('test_kod', kod)
        .eq('faol', true);

      // Yangi 'auto' sessiya — MUZLATILGAN RO'YHAT
      const { data: yangiSessiya, error: sessiyaError } = await supabase
        .from('test_sessiyalar')
        .insert({
          test_kod: kod,
          sessiya_turi: 'auto',
          ruxsatli_oquvchilar: ruxsatliRoyhat,
          faol: true,
          expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (sessiyaError) throw sessiyaError;

      setMuzlatilganSessiyaId(yangiSessiya.id);

      // 2. Test/kazus is_active = true
      const jadval = kodTuri === 'test' ? 'testlar' : 'toplamlar';
      const { error: activeError } = await supabase
        .from(jadval)
        .update({ is_active: true })
        .eq('kod', kod);
      if (activeError) throw activeError;

      setKodIsActive(true);
      setBoshlashNatija('muvaffaqiyat');
      setKechikkanlar([]);
      setActiveKanatTab('kutuvchilar');

      toast({
        title: "🔐 Qat'iy Nazorat faollashtirildi!",
        description: `${ruxsatliRoyhat.length} ta o'quvchi muzlatildi. Kechikkanlar alohida ko'rsatiladi.`,
      });
    } catch (e: any) {
      console.error('Boshlash xatosi:', e);
      setBoshlashNatija('xato');
      toast({ title: 'Xato', description: e.message || 'Boshlashda xatolik', variant: 'destructive' });
    } finally {
      setBoshlanyapti(false);
    }
  };

  // ── Testni to'xtatish ─────────────────────────────────────────────────────
  const testniToxtash = async () => {
    if (!kod || !kodTuri) return;
    setBoshlanyapti(true);
    try {
      const jadval = kodTuri === 'test' ? 'testlar' : 'toplamlar';
      await supabase.from(jadval).update({ is_active: false }).eq('kod', kod);
      await supabase.from('test_sessiyalar').update({ faol: false }).eq('test_kod', kod).eq('faol', true);

      setKodIsActive(false);
      setBoshlashNatija(null);
      setMuzlatilganSessiyaId(null);
      setKechikkanlar([]);
      toast({ title: "To'xtatildi", description: `${kodTuri === 'test' ? 'Test' : 'Kazus'} to'xtatildi` });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setBoshlanyapti(false);
    }
  };

  // ── Kechikkan o'quvchiga ruxsat berish ───────────────────────────────────
  const kechikkanRuxsatBerish = async (kechikkan: KechikkanOquvchi) => {
    const key = `${kechikkan.ism}|${kechikkan.familiya}`;
    setKechikkanRuxsatYuklanyapti(key);
    try {
      const { data: sessiya } = await supabase
        .from('test_sessiyalar')
        .select('*')
        .eq('test_kod', kod)
        .eq('sessiya_turi', 'auto')
        .eq('faol', true)
        .maybeSingle();

      if (!sessiya) {
        toast({ title: 'Sessiya topilmadi', description: "Avval 'Avtomatik boshlash' ni bosing", variant: 'destructive' });
        return;
      }

      const yangiRoyhat: string[] = [
        ...(sessiya.ruxsatli_oquvchilar || []),
        `${kechikkan.ism} ${kechikkan.familiya}`,
      ];

      const { error } = await supabase
        .from('test_sessiyalar')
        .update({ ruxsatli_oquvchilar: yangiRoyhat })
        .eq('id', sessiya.id);

      if (error) throw error;

      setKechikkanlar(prev => prev.filter(k => k.ism !== kechikkan.ism || k.familiya !== kechikkan.familiya));

      toast({
        title: '✅ Ruxsat berildi!',
        description: `${kechikkan.familiya} ${kechikkan.ism} sessiyaga qo'shildi`,
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setKechikkanRuxsatYuklanyapti(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── SARLAVHA ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1e1e] via-[#2a2a2a] to-[#1a1a2e] text-white p-5 shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-48 h-48 bg-green-500/5 rounded-full -translate-y-24 translate-x-24" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full translate-y-16 -translate-x-16" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-2.5 bg-green-500/20 border border-green-500/30 rounded-xl">
            <Zap className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Avtomatik boshlash</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Qat'iy Nazorat — kutuvchi o'quvchilarni boshqaring va selektiv boshlang
            </p>
          </div>
        </div>
      </div>

      {/* ── KOD KIRITISH ── */}
      <Card className="border-2 border-gray-200 shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1.5 flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" /> Test yoki kazus kodi (5 raqam)
              </label>
              <Input
                placeholder="12345"
                value={inputKod}
                onChange={e => setInputKod(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                className="text-2xl font-black text-center tracking-widest border-2 h-12 focus:border-[hsl(221,83%,53%)]"
                onKeyDown={e => e.key === 'Enter' && inputKod.length === 5 && kodniTekshirish(inputKod)}
              />
            </div>
            <div className="flex flex-col justify-end">
              <Button
                onClick={() => kodniTekshirish(inputKod)}
                disabled={inputKod.length !== 5 || kodYuklanyapti}
                className="h-12 px-5 bg-[hsl(221,83%,53%)] hover:bg-[hsl(221,83%,43%)]"
              >
                {kodYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {kod && kodTuri && (
            <div className={`mt-3 flex items-center justify-between p-3 rounded-xl border-2 ${
              kodIsActive ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${kodIsActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                <div>
                  <p className="text-sm font-bold text-gray-800">{kodNomi}</p>
                  <p className="text-xs text-gray-500">
                    {kodTuri === 'test' ? '📝 Test' : '📚 Kazus'} • Kod: <span className="font-mono font-black">{kod}</span>
                  </p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${kodIsActive ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'}`}>
                {kodIsActive ? 'FAOL' : 'STOP'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {kod && kodTuri && (
        <>
          {/* ── KANAL TABLAR (Kutuvchilar / Kechikkanlar) ── */}
          {muzlatilganSessiyaId && (
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setActiveKanatTab('kutuvchilar')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-semibold text-sm transition-all ${
                  activeKanatTab === 'kutuvchilar'
                    ? 'bg-white text-[hsl(221,83%,53%)] shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="h-4 w-4" />
                Kutuvchilar ({kutuvchilar.length})
              </button>
              <button
                onClick={() => setActiveKanatTab('kechikkanlar')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-semibold text-sm transition-all ${
                  activeKanatTab === 'kechikkanlar'
                    ? 'bg-white text-amber-600 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Timer className="h-4 w-4" />
                Kechikkanlar
                {kechikkanlar.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-black">
                    {kechikkanlar.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ── KECHIKKANLAR (Kutish zali) ── */}
          {muzlatilganSessiyaId && activeKanatTab === 'kechikkanlar' && (
            <Card className="border-2 border-amber-400 overflow-hidden shadow-xl">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Timer className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-white">Kutish Zali — Kechikkanlar</CardTitle>
                    <p className="text-amber-100 text-xs mt-0.5">
                      Muzlatilgandan keyin kelgan o'quvchilar. Xohlasangiz ruxsat bering.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {kechikkanlar.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-semibold">Hali kechikkan o'quvchi yo'q</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Sessiya boshlanganidan keyin kelganlar bu yerda ko'rinadi
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-amber-100 max-h-[360px] overflow-y-auto">
                    {kechikkanlar.map((k, idx) => {
                      const key = `${k.ism}|${k.familiya}`;
                      const isLoading = kechikkanRuxsatYuklanyapti === key;
                      const farq = getVaqtFarq(k.last_seen);
                      const isOnline = (Date.now() - new Date(k.last_seen).getTime()) < 30000;
                      return (
                        <div key={idx} className="flex items-center gap-3 px-4 py-3.5 bg-amber-50/50 hover:bg-amber-50 transition-all">
                          <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0">{idx + 1}</span>
                          <div className="flex-shrink-0 relative">
                            {isOnline ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                              </>
                            ) : (
                              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-amber-900">{k.familiya} {k.ism}</p>
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              {k.kurs || '—'}{k.guruh ? ` • ${k.guruh.toUpperCase()}` : ''} • {farq}
                            </p>
                          </div>
                          <button
                            onClick={() => kechikkanRuxsatBerish(k)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-all flex-shrink-0 shadow-sm disabled:opacity-60"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><UserCheck className="h-3.5 w-3.5" />Ruxsat</>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── FILTRLAR ── */}
          {(!muzlatilganSessiyaId || activeKanatTab === 'kutuvchilar') && (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="py-3">
                <button
                  className="w-full flex items-center justify-between"
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">Filtrlar</span>
                    {(filterKurs !== 'barchasi' || filterGuruh !== 'barchasi' || filterTasdiq !== 'barchasi' || qidiruv) && (
                      <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-bold">Faol</span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
                </button>

                {filterOpen && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Ism yoki familiya..."
                        value={qidiruv}
                        onChange={e => setQidiruv(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[hsl(221,83%,53%)]"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1.5">Kurs</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setFilterKurs('barchasi')} className={`px-3 py-1 rounded-lg text-xs font-bold border-2 transition-all ${filterKurs === 'barchasi' ? 'bg-[hsl(221,83%,53%)] text-white border-[hsl(221,83%,53%)]' : 'border-gray-200 text-gray-600 hover:border-[hsl(221,83%,53%)]'}`}>Barchasi</button>
                        {KURSLAR.map(k => (
                          <button key={k} onClick={() => setFilterKurs(k)} className={`px-3 py-1 rounded-lg text-xs font-bold border-2 transition-all ${filterKurs === k ? 'bg-[hsl(221,83%,53%)] text-white border-[hsl(221,83%,53%)]' : 'border-gray-200 text-gray-600 hover:border-[hsl(221,83%,53%)]'}`}>{k}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1.5">Guruh</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => setFilterGuruh('barchasi')} className={`px-3 py-1 rounded-lg text-xs font-bold border-2 transition-all ${filterGuruh === 'barchasi' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-purple-400'}`}>Barchasi</button>
                        {GURUHLAR.map(g => (
                          <button key={g} onClick={() => setFilterGuruh(g)} className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${filterGuruh === g ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-purple-400'}`}>{g.toUpperCase()}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 mb-1.5">Face ID holati</p>
                      <div className="flex gap-2">
                        {[
                          { key: 'barchasi', label: 'Barchasi' },
                          { key: 'tasdiqlangan', label: '✅ Tasdiqlangan' },
                          { key: 'tasdiqlanmagan', label: '⚠️ Tasdiqlanmagan' },
                        ].map(t => (
                          <button key={t.key} onClick={() => setFilterTasdiq(t.key as any)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${filterTasdiq === t.key ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>{t.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── O'QUVCHILAR RO'YHATI ── */}
          {(!muzlatilganSessiyaId || activeKanatTab === 'kutuvchilar') && (
            <Card className="border-2 border-[#1e1e1e] overflow-hidden shadow-xl">
              <CardHeader className="bg-[#1e1e1e] text-white py-4 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-green-400" />
                    <CardTitle className="text-base font-black text-white">Kutuvchi o'quvchilar</CardTitle>
                    <div className="relative flex items-center">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-lg text-xs font-bold">✅ {ruxsatliSoni}</span>
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded-lg text-xs font-bold">🚫 {ruxsatsizSoni}</span>
                    <button onClick={() => kutuvchilarniYuklash(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                      <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${yuklanyapti ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>
                {filteredKutuvchilar.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={barchasiniTanlash} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-xs font-bold text-green-400 transition-all">
                      <CheckSquare className="h-3.5 w-3.5" /> Barchasini tanlash
                    </button>
                    <button onClick={hechKimniTanlamaslik} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-xs font-bold text-red-400 transition-all">
                      <Square className="h-3.5 w-3.5" /> Hammasini olib tashlash
                    </button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {filteredKutuvchilar.length === 0 ? (
                  <div className="py-12 text-center">
                    <WifiOff className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-semibold">
                      {kutuvchilar.length === 0 ? "Hozircha kutuvchi o'quvchi yo'q" : "Filtr bo'yicha o'quvchi topilmadi"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {kutuvchilar.length === 0 ? `O'quvchilar "${kod}" kodini kiritib kutganida bu yerda ko'rinadi` : "Filtrni o'zgartirib ko'ring"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                    {filteredKutuvchilar.map((o, idx) => {
                      const key = `${o.oquvchi_ism}|${o.oquvchi_familiya}`;
                      const ruxsat = ruxsatlilar.get(key) ?? true;
                      const farq = getVaqtFarq(o.last_seen);
                      const isOnline = (Date.now() - new Date(o.last_seen).getTime()) < 30000;
                      return (
                        <div key={o.id} className={`flex items-center gap-3 px-4 py-3 transition-all ${ruxsat ? 'bg-white hover:bg-green-50' : 'bg-gray-50 opacity-60 hover:opacity-80'}`}>
                          <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0">{idx + 1}</span>
                          <div className="flex-shrink-0 relative">
                            {isOnline ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                              </>
                            ) : (
                              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={`text-sm font-bold truncate ${ruxsat ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                                {o.oquvchi_familiya} {o.oquvchi_ism}
                              </p>
                              {o.tasdiqlangan ? (
                                <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">
                                  <Shield className="h-2.5 w-2.5" /> Face ID
                                </span>
                              ) : (
                                <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                                  <ShieldOff className="h-2.5 w-2.5" /> Tasdiqsiz
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {o.kurs ? <span className="font-semibold">{o.kurs}</span> : <span className="text-amber-500">Kurs yo'q</span>}
                              {o.guruh && <> • <span className="font-semibold">{o.guruh.toUpperCase()}</span></>}
                              {' '}• {farq}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleRuxsat(key)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none flex-shrink-0 border-2 ${ruxsat ? 'bg-green-500 border-green-500' : 'bg-gray-200 border-gray-300'}`}
                            title={ruxsat ? 'Bloklash' : 'Ruxsat berish'}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${ruxsat ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                          <div className="flex-shrink-0">
                            {ruxsat ? <Unlock className="h-4 w-4 text-green-500" /> : <Lock className="h-4 w-4 text-red-400" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── XULOSA VA BOSHLASH ── */}
          <div className="space-y-3">
            <div className={`rounded-2xl p-4 border-2 ${
              boshlashNatija === 'muvaffaqiyat' ? 'bg-green-50 border-green-400'
              : boshlashNatija === 'xato' ? 'bg-red-50 border-red-400'
              : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-black text-gray-800">{kutuvchilar.length}</p>
                  <p className="text-[10px] text-gray-500 font-semibold mt-0.5">JAMI KUTUVCHI</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-green-600">{ruxsatliSoni}</p>
                  <p className="text-[10px] text-green-600 font-semibold mt-0.5">RUXSATLI</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-red-500">{ruxsatsizSoni}</p>
                  <p className="text-[10px] text-red-500 font-semibold mt-0.5">BLOKLANGAN</p>
                </div>
              </div>

              {boshlashNatija === 'muvaffaqiyat' && (
                <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-100 rounded-xl px-3 py-2">
                  <Snowflake className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-semibold">
                    🔐 <strong>{ruxsatliSoni} ta o'quvchi</strong> muzlatildi (Qat'iy Nazorat faol).
                    Kechikkanlar uchun <strong>"Kechikkanlar"</strong> tabini tekshiring.
                  </p>
                </div>
              )}

              {boshlashNatija === 'xato' && (
                <div className="mt-3 flex items-center gap-2 text-red-700 bg-red-100 rounded-xl px-3 py-2">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs font-semibold">Boshlashda xatolik yuz berdi. Qaytadan urinib ko'ring.</p>
                </div>
              )}
            </div>

            {kodIsActive && (
              <div className="flex items-start gap-2 bg-amber-50 border-2 border-amber-300 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium">
                  {kodTuri === 'test' ? 'Test' : 'Kazus'} hozir <strong>FAOL</strong> holatda.
                  {muzlatilganSessiyaId && ' Qat\'iy Nazorat aktiv — kechikkanlar "Kechikkanlar" tabida.'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {kodIsActive && (
                <Button
                  onClick={testniToxtash}
                  disabled={boshlanyapti}
                  variant="outline"
                  className="flex-1 h-12 border-2 border-red-400 text-red-600 hover:bg-red-50 font-bold"
                >
                  {boshlanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4 mr-2" />STOP</>}
                </Button>
              )}

              <Button
                onClick={avtomatikBoshlash}
                disabled={boshlanyapti || ruxsatliSoni === 0}
                className={`h-12 font-black text-base shadow-xl transition-all active:scale-95 ${kodIsActive ? 'flex-1' : 'w-full'} ${ruxsatliSoni > 0 ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white' : 'bg-gray-300 text-gray-500'}`}
              >
                {boshlanyapti ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Boshlanmoqda...</>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    {muzlatilganSessiyaId ? 'Sessiyani yangilash' : 'Avtomatik boshlash'}
                    {ruxsatliSoni > 0 && (
                      <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm font-black">{ruxsatliSoni} ta</span>
                    )}
                  </>
                )}
              </Button>
            </div>

            {/* Qat'iy Nazorat izohi */}
            <div className="flex items-start gap-2 bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3">
              <ShieldAlert className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-900 space-y-1">
                <p className="font-bold text-indigo-800">🔐 Qat'iy Nazorat (Access Control):</p>
                <p>• <strong>"Avtomatik boshlash"</strong> bosilganda ro'yhat <strong>muzlatiladi</strong> (Snapshot)</p>
                <p>• Muzlatilgandan keyin kelganlar <strong>KIRMAYDI</strong> — ular "Kechikkanlar" tabida ko'rinadi</p>
                <p>• Siz xohlagan kechikkan o'quvchiga <strong>"Ruxsat"</strong> tugmasi bilan kirishga ruxsat bera olasiz</p>
              </div>
            </div>
          </div>
        </>
      )}

      {!kod && (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Clock className="h-14 w-14 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Test yoki kazus kodini kiriting</p>
          <p className="text-xs text-gray-400 mt-1">
            5 xonali kodni kiritib qidiring — kutuvchi o'quvchilar ko'rinadi
          </p>
        </div>
      )}
    </div>
  );
}
