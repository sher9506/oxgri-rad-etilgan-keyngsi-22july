import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, CheckCircle, Clock, XCircle, AlertCircle, ChevronDown, ChevronUp, FileText, Cpu, Zap, RotateCw, ExternalLink, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface JurnalEntry {
  id: string;
  case_id: string;
  case_sarlavha: string | null;
  holat: string;
  nomzodlar: any[];
  tasdiqlangan_moddalar: any[];
  namunaviy_javob: string | null;
  ai1_model: string | null;
  ai1_tokens: any;
  ai2_model: string | null;
  ai2_tokens: any;
  hukm_tarqatish: any;
  jami_token: number;
  created_at: string;
  updated_at: string;
}

const holatConfig: Record<string, { color: string; icon: any; label: string }> = {
  tayyor: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, label: 'Tayyor' },
  jarayonda: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2, label: 'Jarayonda' },
  qisman: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Qisman' },
  xato: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Xato' },
  kutmoqda: { color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock, label: 'Kutmoqda' },
};

const hukmLabels: Record<string, string> = {
  tolliq_mos: "To'liq mos",
  faqat_matn_mos: 'Faqat matn',
  faqat_raqam_mos: 'Faqat raqam',
  topilmadi: 'Topilmadi',
  qonun_kiritilmagan: "Qonun yo'q",
};

export default function QidiruvJurnali() {
  const [entries, setEntries] = useState<JurnalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [holatFilter, setHolatFilter] = useState<string[]>([]);
  const [faqatMuammoli, setFaqatMuammoli] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [rerunning, setRerunning] = useState<string | null>(null);

  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('qidiruv_jurnali')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Jurnal yuklash xatosi:', error);
    }
    setEntries((data || []) as JurnalEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isMuammoli = (e: JurnalEntry): boolean => {
    const hukm = e.hukm_tarqatish || {};
    return (hukm.faqat_raqam_mos || 0) > 0 || (hukm.topilmadi || 0) > 0 || (hukm.qonun_kiritilmagan || 0) > 0 || e.holat === 'xato' || e.holat === 'qisman';
  };

  const filtered = entries.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.case_sarlavha?.toLowerCase().includes(q) && !e.case_id.toLowerCase().includes(q)) return false;
    }
    if (holatFilter.length > 0 && !holatFilter.includes(e.holat)) return false;
    if (faqatMuammoli && !isMuammoli(e)) return false;
    return true;
  });

  const toggleHolat = (h: string) => {
    setHolatFilter(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);
  };

  // Statistics
  const totalNomzodlar = entries.reduce((sum, e) => sum + (e.nomzodlar?.length || 0), 0);
  const totalHukmlar = entries.reduce((sum, e) => {
    const h = e.hukm_tarqatish || {};
    return sum + Object.values(h).reduce((a: number, b: any) => a + (b as number), 0);
  }, 0);
  const totalTolliqMos = entries.reduce((sum, e) => sum + (e.hukm_tarqatish?.tolliq_mos || 0), 0);
  const totalTopilmadi = entries.reduce((sum, e) => sum + (e.hukm_tarqatish?.topilmadi || 0), 0);
  const tolliqFoiz = totalHukmlar > 0 ? Math.round((totalTolliqMos / totalHukmlar) * 100) : 0;
  const topilmadiFoiz = totalHukmlar > 0 ? Math.round((totalTopilmadi / totalHukmlar) * 100) : 0;
  const ortachaToken = entries.length > 0 ? Math.round(entries.reduce((sum, e) => sum + (e.jami_token || 0), 0) / entries.length) : 0;

  const rerun = async (caseId: string, caseSarlavha: string) => {
    setRerunning(caseId);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/case-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ caseId, action: 'run' }),
      });
      const data = await res.json();
      if (data?.success) {
        const holat = data.holat || 'tayyor';
        const tasdiqSoni = data.step2?.tasdiqlanganlar?.length || 0;
        toast({
          title: holat === 'tayyor' ? 'Tadqiqot tayyor' : holat === 'qisman' ? 'Tadqiqot qisman' : 'Tadqiqot xatosi',
          description: holat === 'tayyor' ? `${tasdiqSoni} ta qonun moddasi tasdiqlandi` : holat === 'qisman' ? 'AI modda topa olmadi yoki bazada qonunlar yetarli emas' : data.error || 'Xatolik yuz berdi',
        });
        load();
      } else if (data?.error) {
        toast({ title: 'Tadqiqot xatosi', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'Tadqiqot amalga oshmadi', variant: 'destructive' });
    } finally {
      setRerunning(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 shadow-lg">
        <div className="flex items-center gap-3">
          <Search className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-bold">Qidiruv jurnali</h1>
            <p className="text-blue-100 text-sm mt-0.5">
              Moot Court kazuslari uchun AI tadqiqot pipeline'ining natijalari
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-2.5">
            <p className="text-[10px] text-blue-100 font-bold uppercase">Jami</p>
            <p className="text-lg font-black">{entries.length}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <p className="text-[10px] text-blue-100 font-bold uppercase">To'liq mos</p>
            <p className="text-lg font-black text-emerald-300">{tolliqFoiz}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <p className="text-[10px] text-blue-100 font-bold uppercase">Topilmadi</p>
            <p className="text-lg font-black text-red-300">{topilmadiFoiz}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <p className="text-[10px] text-blue-100 font-bold uppercase">Moddalar</p>
            <p className="text-lg font-black">{entries.reduce((s, e) => s + (e.tasdiqlangan_moddalar?.length || 0), 0)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5">
            <p className="text-[10px] text-blue-100 font-bold uppercase">O'rtacha token</p>
            <p className="text-lg font-black">{ortachaToken.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Kazus sarlavhasi bo'yicha qidirish..."
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <button
            onClick={() => setFaqatMuammoli(!faqatMuammoli)}
            className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
              faqatMuammoli ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Filter className="h-3 w-3" /> Faqat muammoli
          </button>
          {Object.entries(holatConfig).map(([key, cfg]) => {
            const active = holatFilter.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleHolat(key)}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                  active ? cfg.color : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Hozircha jurnal yozuvlari yo'q</p>
          <p className="text-xs text-gray-400 mt-1">Moot Court kazuslari yaratilganda bu yerda paydo bo'ladi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, visibleCount).map(e => {
            const cfg = holatConfig[e.holat] || holatConfig.kutmoqda;
            const Icon = cfg.icon;
            const expanded = expandedId === e.id;
            const muammoli = isMuammoli(e);
            return (
              <div key={e.id} className={`rounded-2xl bg-white border shadow-sm overflow-hidden ${muammoli ? 'border-orange-200' : 'border-gray-100'}`}>
                <button
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                  className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                      <Icon className={`h-4 w-4 ${e.holat === 'jarayonda' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {e.case_sarlavha || 'Sarlavhasiz kazus'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">
                          {new Date(e.created_at).toLocaleString('uz-UZ')}
                        </span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-[10px] font-bold text-blue-600">
                          {e.tasdiqlangan_moddalar?.length || 0} modda
                        </span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5" /> {e.jami_token || 0} token
                        </span>
                        {muammoli && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                            Muammoli
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); rerun(e.case_id, e.case_sarlavha || ''); }}
                      disabled={rerunning === e.case_id}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {rerunning === e.case_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                      Qayta ishga tushirish
                    </button>
                    {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/30">
                    {/* AI info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Cpu className="h-3.5 w-3.5 text-blue-500" />
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Step 1 — AI nomzod</p>
                        </div>
                        <p className="text-xs font-bold text-gray-700">{e.ai1_model || 'Noma\'lum'}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {e.nomzodlar?.length || 0} nomzod • {e.ai1_tokens?.input || 0}+{e.ai1_tokens?.output || 0} token
                        </p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Step 3 — Namunaviy javob</p>
                        </div>
                        <p className="text-xs font-bold text-gray-700">{e.ai2_model || 'Noma\'lum'}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {e.namunaviy_javob ? `${e.namunaviy_javob.length} belgi` : 'Yo\'q'} • {e.ai2_tokens?.input || 0}+{e.ai2_tokens?.output || 0} token
                        </p>
                      </div>
                    </div>

                    {/* Hukm tarqatish */}
                    {e.hukm_tarqatish && Object.keys(e.hukm_tarqatish).length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Hukm tarqatish</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {Object.entries(e.hukm_tarqatish).map(([hukm, count]) => (
                            <Badge key={hukm} variant="outline" className="text-[10px]">
                              {hukmLabels[hukm] || hukm}: {count as number}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasdiqlangan moddalar */}
                    {e.tasdiqlangan_moddalar && e.tasdiqlangan_moddalar.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Tasdiqlangan moddalar</p>
                        <div className="space-y-1.5">
                          {e.tasdiqlangan_moddalar.map((m: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg p-2.5 border border-gray-100">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-bold text-blue-700">{m.qonun_kodi}</span>
                                <span className="text-[10px] font-bold text-gray-700">{m.modda_raqami}-modda</span>
                                {m.hukm === 'tolliq_mos' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">To'liq mos</span>
                                )}
                                {m.hukm === 'faqat_matn_mos' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Matn bo'yicha</span>
                                )}
                                {m.hukm === 'faqat_raqam_mos' && (
                                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Raqam bo'yicha</span>
                                )}
                                {m.lex_element_id && (
                                  <a
                                    href={`https://lex.uz/uz/docs/-${m.qonun_kodi === 'JK' ? '111453' : ''}#${m.lex_element_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-400 hover:text-blue-500"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-500 leading-relaxed">{m.sarlavha || m.matn?.slice(0, 120) + '...'}</p>
                              {m.kalit_sozlar && (
                                <p className="text-[10px] text-gray-400 mt-0.5 italic">Kalit so'zlar: {m.kalit_sozlar?.join(', ')}</p>
                              )}
                              {m.nega_kerak && (
                                <p className="text-[10px] text-gray-400 mt-0.5 italic">Nega kerak: {m.nega_kerak}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Namunaviy javob */}
                    {e.namunaviy_javob && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Namunaviy javob</p>
                        <div className="bg-white rounded-xl p-3 border border-gray-100 max-h-60 overflow-y-auto">
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{e.namunaviy_javob}</p>
                        </div>
                      </div>
                    )}

                    {/* AI nomzodlari (raw) */}
                    {e.nomzodlar && e.nomzodlar.length > 0 && (
                      <details>
                        <summary className="text-[10px] font-bold text-gray-400 uppercase cursor-pointer hover:text-gray-600">
                          AI nomzodlari ({e.nomzodlar.length})
                        </summary>
                        <div className="mt-2 space-y-1">
                          {e.nomzodlar.map((n: any, i: number) => (
                            <div key={i} className="text-[10px] text-gray-500 bg-white rounded-lg p-2 border border-gray-100">
                              <span className="font-bold text-blue-600">{n.qonun_kodi} {n.modda_raqami}-modda</span>
                              {n.tushuncha && <span className="ml-2">— {n.tushuncha}</span>}
                              {n.nega_kerak && <span className="block text-gray-400 mt-0.5 italic">{n.nega_kerak}</span>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(p => p + 20)} className="rounded-xl text-xs">
                Ko'proq ko'rsatish ({filtered.length - visibleCount} ta qoldi)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
