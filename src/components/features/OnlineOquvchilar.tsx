import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff, RefreshCw, Zap, Loader2, UserX, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface OnlineOquvchi {
  id: string;
  oquvchi_ism: string;
  oquvchi_familiya: string;
  kurs: string;
  guruh: string;
  kutish_kod: string | null;
  kutish_tur: string | null;
  last_seen: string;
}

interface OnlineOquvchilarProps {
  filterKod?: string;
  onTanlash?: (tanlangan: OnlineOquvchi[]) => void;
  autoRefresh?: boolean;
  // Chiqarilgan o'quvchilarni boshqarish (tashqi state)
  chiqarilganlar?: Set<string>;
  onChiqarish?: (key: string) => void;
}

export default function OnlineOquvchilar({
  filterKod,
  onTanlash,
  autoRefresh = true,
  chiqarilganlar: tashqiChiqarilganlar,
  onChiqarish,
}: OnlineOquvchilarProps) {
  const [activeTab, setActiveTab] = useState<'tasdiqlangan' | 'tasdiqlanmagan'>('tasdiqlangan');
  const [oquvchilar, setOquvchilar] = useState<OnlineOquvchi[]>([]);
  const [tasdiqlanmaganlar, setTasdiqlanmaganlar] = useState<OnlineOquvchi[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  // Ichki chiqarilganlar (tashqi prop yo'q bo'lsa)
  const [ichkiChiqarilganlar, setIchkiChiqarilganlar] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const ONLINE_MUDDAT_MS = 60000;

  // Chiqarilganlar — tashqi yoki ichki
  const chiqarilganlar = tashqiChiqarilganlar ?? ichkiChiqarilganlar;

  const yuklash = async () => {
    try {
      const chegaraVaqt = new Date(Date.now() - ONLINE_MUDDAT_MS).toISOString();
      let query = supabase
        .from('online_presence')
        .select('*')
        .gt('last_seen', chegaraVaqt)
        .order('last_seen', { ascending: false });

      if (filterKod) {
        query = query.eq('kutish_kod', filterKod);
      }

      const { data, error } = await query;
      if (error) throw error;

      const barchasi = data || [];
      const tasdiqlangan = barchasi.filter(o => o.kurs && o.guruh);
      const tasdiqlanmagan = barchasi.filter(o => !o.kurs || !o.guruh);

      setOquvchilar(tasdiqlangan);
      setTasdiqlanmaganlar(tasdiqlanmagan);
    } catch (e) {
      console.error('Online o\'quvchilar yuklashda xato:', e);
    } finally {
      setYuklanyapti(false);
    }
  };

  useEffect(() => {
    yuklash();
    if (autoRefresh) {
      intervalRef.current = setInterval(yuklash, 2000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [filterKod]);

  // Tanlangan (chiqarilmaganlar) ni parentga yuborish
  useEffect(() => {
    if (onTanlash) {
      const tanlanganRoyhat = oquvchilar.filter(o => {
        const key = `${o.oquvchi_ism}|${o.oquvchi_familiya}`;
        return !chiqarilganlar.has(key);
      });
      onTanlash(tanlanganRoyhat);
    }
  }, [oquvchilar, chiqarilganlar]);

  const chiqarish = (oquvchi: OnlineOquvchi) => {
    const key = `${oquvchi.oquvchi_ism}|${oquvchi.oquvchi_familiya}`;
    if (onChiqarish) {
      onChiqarish(key);
    } else {
      setIchkiChiqarilganlar(prev => {
        const yangi = new Set(prev);
        yangi.add(key);
        return yangi;
      });
    }
  };

  const qaytarish = (oquvchi: OnlineOquvchi) => {
    const key = `${oquvchi.oquvchi_ism}|${oquvchi.oquvchi_familiya}`;
    if (onChiqarish) {
      // Tashqi — qaytarish uchun delete
      // Parent buni boshqaradi
    } else {
      setIchkiChiqarilganlar(prev => {
        const yangi = new Set(prev);
        yangi.delete(key);
        return yangi;
      });
    }
  };

  const barchasiniQaytarish = () => {
    if (!onChiqarish) {
      setIchkiChiqarilganlar(new Set());
    }
  };

  // Chiqarilmaganlar (aktiv)
  const faolOquvchilar = oquvchilar.filter(o => !chiqarilganlar.has(`${o.oquvchi_ism}|${o.oquvchi_familiya}`));
  // Chiqarilganlar ro'yhati
  const chiqarilganRoyhat = oquvchilar.filter(o => chiqarilganlar.has(`${o.oquvchi_ism}|${o.oquvchi_familiya}`));

  const jami = oquvchilar.length;

  const getVaqtFarq = (lastSeen: string) => {
    const farq = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
    if (farq < 10) return 'Hozirgina';
    if (farq < 60) return `${farq}s oldin`;
    return `${Math.floor(farq / 60)}m oldin`;
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('tasdiqlangan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
            activeTab === 'tasdiqlangan'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
          }`}
        >
          <Wifi className="h-3.5 w-3.5" />
          Tasdiqlangan
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'tasdiqlangan' ? 'bg-white/30 text-white' : 'bg-green-100 text-green-700'
          }`}>{jami}</span>
        </button>
        <button
          onClick={() => setActiveTab('tasdiqlanmagan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
            activeTab === 'tasdiqlanmagan'
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-amber-400'
          }`}
        >
          <UserX className="h-3.5 w-3.5" />
          Tasdiqlanmaganlar
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'tasdiqlanmagan' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'
          }`}>{tasdiqlanmaganlar.length}</span>
        </button>
        {yuklanyapti && <Loader2 className="h-4 w-4 text-gray-400 animate-spin self-center ml-auto" />}
        <button
          onClick={yuklash}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
          title="Yangilash"
        >
          <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* ══ TASDIQLANGAN TAB ══ */}
      {activeTab === 'tasdiqlangan' && (
        <>
          {/* Boshqaruv */}
          {jami > 0 && (
            <div className="flex items-center justify-between">
              <div className={`text-xs px-3 py-2 rounded-xl font-semibold flex items-center gap-2 flex-1 mr-2 ${
                faolOquvchilar.length === jami
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : faolOquvchilar.length === 0
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <Zap className="h-3.5 w-3.5" />
                START: <strong>{faolOquvchilar.length}</strong> ta uchun
                {chiqarilganlar.size > 0 && (
                  <span className="opacity-75">({chiqarilganlar.size} ta chiqarilgan)</span>
                )}
              </div>
              {chiqarilganlar.size > 0 && !onChiqarish && (
                <button
                  onClick={barchasiniQaytarish}
                  className="text-xs text-green-600 font-semibold px-2 py-1 hover:bg-green-50 rounded-lg border border-green-200"
                >
                  Barchasini ✅
                </button>
              )}
            </div>
          )}

          {jami === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <WifiOff className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">
                {filterKod ? 'Bu kod bilan tasdiqlangan kimsa kutmayapti' : 'Hozircha online tasdiqlangan o\'quvchi yo\'q'}
              </p>
              <p className="text-xs text-gray-400 mt-1">O'quvchi kodni kiritib kutganda ko'rinadi</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
              {/* Faol o'quvchilar */}
              {faolOquvchilar.map((oquvchi) => (
                <div
                  key={oquvchi.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 border-green-300 bg-green-50"
                >
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {oquvchi.oquvchi_familiya} {oquvchi.oquvchi_ism}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {oquvchi.kurs} {oquvchi.guruh && `• ${oquvchi.guruh.toUpperCase()}`}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{getVaqtFarq(oquvchi.last_seen)}</span>
                  {/* Chiqarish tugmasi */}
                  <button
                    onClick={() => chiqarish(oquvchi)}
                    className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 border border-red-300 flex items-center justify-center transition-all"
                    title="Ro'yhatdan chiqarish"
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </button>
                </div>
              ))}

              {/* Chiqarilganlar (kulrang) */}
              {chiqarilganRoyhat.length > 0 && (
                <>
                  <div className="text-[10px] text-gray-400 font-semibold px-1 pt-1">
                    Chiqarilganlar ({chiqarilganRoyhat.length} ta) — START bosganingizda ular kiritmaydi:
                  </div>
                  {chiqarilganRoyhat.map((oquvchi) => (
                    <div
                      key={oquvchi.id}
                      className="flex items-center gap-3 px-3.5 py-2 rounded-xl border-2 border-gray-200 bg-gray-50 opacity-50"
                    >
                      <span className="relative flex h-2 w-2 flex-shrink-0">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-500 truncate line-through">
                          {oquvchi.oquvchi_familiya} {oquvchi.oquvchi_ism}
                        </p>
                      </div>
                      {/* Qaytarish — faqat ichki state bo'lsa */}
                      {!onChiqarish && (
                        <button
                          onClick={() => qaytarish(oquvchi)}
                          className="flex-shrink-0 text-[10px] text-green-600 font-semibold px-2 py-0.5 rounded hover:bg-green-50 border border-green-200"
                        >
                          + Qaytarish
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ══ TASDIQLANMAGANLAR TAB ══ */}
      {activeTab === 'tasdiqlanmagan' && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
            <UserX className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Bu o'quvchilar <strong>faqat ism/familiya kiritgan</strong> va siz belgilagan kodni kutmoqda,
              lekin Face ID bilan tasdiqlanmagan. Ular START bosilganda <strong>avtomatik kiritilmaydi</strong>.
            </p>
          </div>

          {tasdiqlanmaganlar.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <UserX className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Tasdiqlanmagan kutuvchi yo'q</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {tasdiqlanmaganlar.map((oquvchi) => (
                <div
                  key={oquvchi.id}
                  className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border-2 border-amber-200 bg-amber-50"
                >
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-900 truncate">{oquvchi.oquvchi_familiya} {oquvchi.oquvchi_ism}</p>
                    <p className="text-[10px] text-amber-600">Tasdiqlanmagan • {oquvchi.kutish_tur === 'test' ? 'Test' : 'Kazus'}: {oquvchi.kutish_kod}</p>
                  </div>
                  <span className="text-[10px] text-amber-500 flex-shrink-0">{getVaqtFarq(oquvchi.last_seen)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
