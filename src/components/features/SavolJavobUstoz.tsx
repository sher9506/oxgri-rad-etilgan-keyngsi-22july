import { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Trash2, Edit, Play, Square, ChevronDown, ChevronRight,
  Copy, Check, Users, BarChart3, Clipboard, Eye,
  Save, Link2, FileText, Layers, AlertCircle, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface Bolim {
  id: string; ustoz_id: string; ustoz_ismi: string; nomi: string;
  faol: boolean; tartib: number; created_at: string;
  _boblar?: Bob[]; _savollar_soni?: number; _yechganlar?: string[]; _koruvchilar?: string[];
}

interface Bob {
  id: string; bolim_id: string; parent_bob_id?: string | null;
  nomi: string; tartib: number; created_at: string;
  _savollar?: Savol[]; _child_boblar?: Bob[];
}

interface Savol {
  id: string; bob_id: string; bolim_id: string;
  savol: string; javob: string; link?: string; tartib: number;
}

interface ParsedSavol { savol: string; javob: string; link?: string }

function parseSavolJavob(matn: string): ParsedSavol[] {
  const natija: ParsedSavol[] = [];
  if (!matn.trim()) return natija;
  const lines = matn.split('\n').map(l => l.trim());
  const savolRegex = /^(\d+)[.)\-]\s+(.*)/;
  const javobRegex = /^(javob|Javob|жavob|Жavob|жавоб|Жавоб|j|answer)\s*[:\:]\s*/i;
  const linkRegex = /^https?:\/\//i;
  let joriy: Partial<ParsedSavol> | null = null;
  let holat: 'savol' | 'javob' = 'savol';
  for (const line of lines) {
    if (!line) continue;
    const savolMatch = line.match(savolRegex);
    const isJavobBoshi = javobRegex.test(line);
    const isLink = linkRegex.test(line);
    if (savolMatch) {
      if (joriy?.savol && joriy?.javob) natija.push(joriy as ParsedSavol);
      joriy = { savol: savolMatch[2].trim() }; holat = 'savol';
    } else if (isJavobBoshi) {
      if (joriy) { joriy.javob = line.replace(javobRegex, '').trim(); holat = 'javob'; }
    } else if (isLink) {
      if (joriy) joriy.link = line;
    } else if (joriy) {
      if (holat === 'javob') joriy.javob = (joriy.javob || '') + '\n' + line;
      else { joriy.javob = line; holat = 'javob'; }
    }
  }
  if (joriy?.savol && joriy?.javob) natija.push(joriy as ParsedSavol);
  return natija;
}

const NAMUNA = `1. Huquq nima?\nJavob: Huquq — davlat tomonidan belgilangan va himoya qilinadigan xulq-atvor qoidalari majmui.\nhttps://lex.uz/docs\n2. Konstitutsiya qachon qabul qilingan?\nJavob: 1992-yil 8-dekabrda qabul qilingan.`;

interface YangiBob { tempId: string; nomi: string; pasteMatn: string; parsedSavollar: ParsedSavol[]; ochiq: boolean; }

// ── Bob item (rekursiv) ──────────────────────────────────────────────────────
function BobItem({
  bob, bolim, depth,
  ochiqBoblar, toggleBob, bobOchir,
  setPasteModal, setPasteMatn, setParsedSavollar,
  setSavolTahrirlay, savolOchir, onReload, idx
}: {
  bob: Bob; bolim: Bolim; depth: number; idx: number;
  ochiqBoblar: Set<string>; toggleBob: (id: string) => void;
  bobOchir: (id: string) => void;
  setPasteModal: any; setPasteMatn: any; setParsedSavollar: any;
  setSavolTahrirlay: any; savolOchir: (id: string) => void;
  onReload: () => void;
}) {
  const { toast } = useToast();
  const [ichkiBobNomi, setIchkiBobNomi] = useState('');
  const [ichkiBobForma, setIchkiBobForma] = useState(false);
  const [ichkiBobYuklanyapti, setIchkiBobYuklanyapti] = useState(false);
  const bobOchiq = ochiqBoblar.has(bob.id);

  const depthBg = ['bg-indigo-50/30 border-indigo-200', 'bg-violet-50/30 border-violet-200', 'bg-blue-50/30 border-blue-200', 'bg-teal-50/30 border-teal-200'];
  const depthText = ['text-indigo-700', 'text-violet-700', 'text-blue-700', 'text-teal-700'];
  const depthAccent = ['bg-indigo-100 border-indigo-300', 'bg-violet-100 border-violet-300', 'bg-blue-100 border-blue-300', 'bg-teal-100 border-teal-300'];
  const ml = ['', 'ml-4', 'ml-8', 'ml-12'];
  const d = Math.min(depth, depthBg.length - 1);

  const ichkiBobQosh = async () => {
    if (!ichkiBobNomi.trim()) return;
    setIchkiBobYuklanyapti(true);
    try {
      const { data: mavjud } = await supabase.from('sj_boblar').select('id').eq('parent_bob_id', bob.id);
      const { error } = await supabase.from('sj_boblar').insert({
        bolim_id: bolim.id, parent_bob_id: bob.id, nomi: ichkiBobNomi.trim(), tartib: (mavjud || []).length
      });
      if (error) throw error;
      setIchkiBobNomi(''); setIchkiBobForma(false);
      toast({ title: "Ichki bob qo'shildi" }); onReload();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setIchkiBobYuklanyapti(false); }
  };

  return (
    <div className={`border-2 rounded-xl transition-all ${depthBg[d]} ${ml[d]}`}>
      {/* Bob header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleBob(bob.id)}>
        <div className={`w-7 h-7 rounded-full ${depthAccent[d]} border-2 flex items-center justify-center text-xs font-black ${depthText[d]} flex-shrink-0`}>{idx + 1}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 truncate">{bob.nomi}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {bob._savollar?.length || 0} savol
            {(bob._child_boblar?.length || 0) > 0 && ` • ${bob._child_boblar?.length} ichki bob`}
            {depth > 0 && <span className={`ml-1.5 text-[9px] font-black px-1 py-0.5 rounded ${depthAccent[d]} ${depthText[d]}`}>ichki</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); setPasteModal({ bob_id: bob.id, bolim_id: bolim.id, bob_nomi: bob.nomi }); setPasteMatn(''); setParsedSavollar([]); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-xs font-bold transition-colors">
            <Clipboard className="h-3 w-3" />Paste
          </button>
          <button onClick={e => { e.stopPropagation(); bobOchir(bob.id); }}
            className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {bobOchiq ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </div>

      {/* Bob content */}
      {bobOchiq && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
          {/* Savollar */}
          {(bob._savollar?.length || 0) === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Hali savol yo'q. "Paste" tugmasidan savollar qo'shing.</p>
          ) : (
            bob._savollar?.map((s, si) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-3 text-sm hover:border-indigo-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className={`text-xs font-black flex-shrink-0 mt-0.5 ${depthText[d]}`}>{si + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 leading-snug">{s.savol}</p>
                        <p className="text-gray-600 mt-1 text-xs leading-relaxed line-clamp-3">{s.javob}</p>
                        {s.link && (
                          <a href={s.link} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 text-xs flex items-center gap-1 mt-1 hover:underline truncate"
                            onClick={e => e.stopPropagation()}>
                            <Link2 className="h-3 w-3 flex-shrink-0" /><span className="truncate">{s.link}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setSavolTahrirlay(s)} className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-500 transition-colors"><Edit className="h-3.5 w-3.5" /></button>
                    <button onClick={() => savolOchir(s.id)} className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Ichki boblar (rekursiv) */}
          {(bob._child_boblar || []).length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ichki boblar</p>
              {bob._child_boblar!.map((child, ci) => (
                <BobItem key={child.id} bob={child} bolim={bolim} depth={depth + 1} idx={ci}
                  ochiqBoblar={ochiqBoblar} toggleBob={toggleBob} bobOchir={bobOchir}
                  setPasteModal={setPasteModal} setPasteMatn={setPasteMatn} setParsedSavollar={setParsedSavollar}
                  setSavolTahrirlay={setSavolTahrirlay} savolOchir={savolOchir} onReload={onReload} />
              ))}
            </div>
          )}

          {/* Ichki bob qo'shish */}
          {!ichkiBobForma ? (
            <button onClick={() => setIchkiBobForma(true)}
              className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-violet-300 hover:border-violet-500 hover:bg-violet-50/50 text-violet-500 rounded-lg text-xs font-bold transition-all mt-2">
              <Plus className="h-3.5 w-3.5" />Ichki bob qo'shish
            </button>
          ) : (
            <div className="flex gap-2 mt-2">
              <input value={ichkiBobNomi} onChange={e => setIchkiBobNomi(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ichkiBobQosh(); if (e.key === 'Escape') { setIchkiBobForma(false); setIchkiBobNomi(''); } }}
                placeholder="Ichki bob nomi..." autoFocus
                className="flex-1 px-3 py-2 border-2 border-violet-300 rounded-xl text-xs focus:outline-none focus:border-violet-500" />
              <button onClick={ichkiBobQosh} disabled={ichkiBobYuklanyapti || !ichkiBobNomi.trim()}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold">
                {ichkiBobYuklanyapti ? '...' : <Check className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => { setIchkiBobForma(false); setIchkiBobNomi(''); }}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl text-xs">Bekor</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Asosiy komponent ──────────────────────────────────────────────────────────
export default function SavolJavobUstoz() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'bolimlar' | 'qosh'>('bolimlar');
  const [bolimlar, setBolimlar] = useState<Bolim[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [namunaCopied, setNamunaCopied] = useState(false);
  const [ochiqBolimlar, setOchiqBolimlar] = useState<Set<string>>(new Set());
  const [ochiqBoblar, setOchiqBoblar] = useState<Set<string>>(new Set());
  const [pasteModal, setPasteModal] = useState<{ bob_id: string; bolim_id: string; bob_nomi: string } | null>(null);
  const [pasteMatn, setPasteMatn] = useState('');
  const [parsedSavollar, setParsedSavollar] = useState<ParsedSavol[]>([]);
  const [pasteYuklanyapti, setPasteYuklanyapti] = useState(false);
  const [natijalarModal, setNatijalarModal] = useState<Bolim | null>(null);
  const [natijalar, setNatijalar] = useState<any[]>([]);
  const [savol_tahrirlay, setSavolTahrirlay] = useState<Savol | null>(null);
  const [yangi_bolim_nomi, setYangiBolimNomi] = useState('');
  const [yangiBoblar, setYangiBoblar] = useState<YangiBob[]>([]);
  const [bolimSaqlanmoqda, setBolimSaqlanmoqda] = useState(false);

  useEffect(() => { yuklash(); }, [user]);

  const buildBobTree = async (bobs: any[]): Promise<Bob[]> => {
    return Promise.all(bobs.map(async (bob: any) => {
      const { data: sqData } = await supabase.from('sj_savollar').select('*').eq('bob_id', bob.id).order('tartib', { ascending: true });
      const { data: childBobs } = await supabase.from('sj_boblar').select('*').eq('parent_bob_id', bob.id).order('tartib', { ascending: true });
      const childWithSavollar = await buildBobTree((childBobs || []) as Bob[]);
      return { ...bob, _savollar: sqData || [], _child_boblar: childWithSavollar };
    }));
  };

  const yuklash = async () => {
    if (!user?.ustoz_id) return;
    setYuklanmoqda(true);
    try {
      const { data: bData } = await supabase.from('sj_bolimlar').select('*').eq('ustoz_id', user.ustoz_id).order('tartib', { ascending: true });
      if (!bData) { setBolimlar([]); return; }
      const enriched = await Promise.all(bData.map(async (b: Bolim) => {
        const { data: bobData } = await supabase.from('sj_boblar').select('*').eq('bolim_id', b.id).is('parent_bob_id', null).order('tartib', { ascending: true });
        const boblar = await buildBobTree((bobData || []) as Bob[]);
        const { data: natData } = await supabase.from('sj_natijalar').select('oquvchi_ismi,natija').eq('bolim_id', b.id);
        const koruvchilar = [...new Set((natData || []).map((n: any) => n.oquvchi_ismi))];
        const yechganlar = [...new Set((natData || []).filter((n: any) => Array.isArray(n.natija) && n.natija.length > 0).map((n: any) => n.oquvchi_ismi))];
        const countSavollar = (bobs: Bob[]): number => bobs.reduce((s, b) => s + (b._savollar?.length || 0) + countSavollar(b._child_boblar || []), 0);
        return { ...b, _boblar: boblar, _savollar_soni: countSavollar(boblar), _yechganlar: yechganlar, _koruvchilar: koruvchilar };
      }));
      setBolimlar(enriched);
    } finally { setYuklanmoqda(false); }
  };

  const toggleBolim = (id: string) => setOchiqBolimlar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBob = (id: string) => setOchiqBoblar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const startStop = async (b: Bolim) => {
    const yangi = !b.faol;
    await supabase.from('sj_bolimlar').update({ faol: yangi }).eq('id', b.id);
    setBolimlar(prev => prev.map(x => x.id === b.id ? { ...x, faol: yangi } : x));
    toast({ title: yangi ? "▶ Bo'lim ochildi!" : "⏹ Bo'lim yopildi" });
  };

  const bolimOchir = async (id: string) => {
    if (!confirm("Rostdan ham bu bo'limni o'chirasizmi?")) return;
    await supabase.from('sj_bolimlar').delete().eq('id', id);
    toast({ title: "O'chirildi!" }); await yuklash();
  };

  const bobOchir = async (id: string) => {
    if (!confirm("Bu bobni o'chirasizmi?")) return;
    await supabase.from('sj_boblar').delete().eq('id', id); await yuklash();
  };

  const savolOchir = async (id: string) => {
    await supabase.from('sj_savollar').delete().eq('id', id); await yuklash();
  };

  const savolSaqla = async () => {
    if (!savol_tahrirlay) return;
    await supabase.from('sj_savollar').update({ savol: savol_tahrirlay.savol, javob: savol_tahrirlay.javob, link: savol_tahrirlay.link || null }).eq('id', savol_tahrirlay.id);
    toast({ title: 'Saqlandi!' }); setSavolTahrirlay(null); await yuklash();
  };

  const pasteModalSaqla = async () => {
    if (!pasteModal || parsedSavollar.length === 0) return;
    setPasteYuklanyapti(true);
    try {
      const rows = parsedSavollar.map((s, i) => ({ bob_id: pasteModal.bob_id, bolim_id: pasteModal.bolim_id, savol: s.savol, javob: s.javob, link: s.link || null, tartib: i }));
      const { error } = await supabase.from('sj_savollar').insert(rows);
      if (error) throw error;
      toast({ title: `${rows.length} ta savol saqlandi!` });
      setPasteModal(null); setPasteMatn(''); setParsedSavollar([]); await yuklash();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setPasteYuklanyapti(false); }
  };

  const natijalarKor = async (b: Bolim) => {
    const { data } = await supabase.from('sj_natijalar').select('*').eq('bolim_id', b.id).order('updated_at', { ascending: false });
    setNatijalar(data || []); setNatijalarModal(b);
  };

  const yangiBobQosh = () => setYangiBoblar(prev => [...prev, { tempId: `bob_${Date.now()}`, nomi: '', pasteMatn: '', parsedSavollar: [], ochiq: true }]);
  const yangiBobOchir = (tempId: string) => setYangiBoblar(prev => prev.filter(b => b.tempId !== tempId));
  const yangiBobUpdate = (tempId: string, field: keyof YangiBob, value: any) => setYangiBoblar(prev => prev.map(b => b.tempId === tempId ? { ...b, [field]: value } : b));

  const yangibolimSaqla = async () => {
    if (!yangi_bolim_nomi.trim() || !user?.ustoz_id) { toast({ title: "Bo'lim nomini kiriting", variant: 'destructive' }); return; }
    setBolimSaqlanmoqda(true);
    try {
      const { data: bolimData, error: bolimErr } = await supabase.from('sj_bolimlar').insert({ ustoz_id: user.ustoz_id, ustoz_ismi: `${user.ism} ${user.familiya}`, nomi: yangi_bolim_nomi.trim(), tartib: bolimlar.length, faol: false }).select('id').single();
      if (bolimErr || !bolimData) throw bolimErr || new Error("Bo'lim yaratilmadi");
      const bolimId = bolimData.id;
      for (let bi = 0; bi < yangiBoblar.length; bi++) {
        const yb = yangiBoblar[bi];
        if (!yb.nomi.trim()) continue;
        const { data: bobData } = await supabase.from('sj_boblar').insert({ bolim_id: bolimId, nomi: yb.nomi.trim(), tartib: bi }).select('id').single();
        if (!bobData) continue;
        const savollar = yb.parsedSavollar.length > 0 ? yb.parsedSavollar : parseSavolJavob(yb.pasteMatn);
        if (savollar.length > 0) await supabase.from('sj_savollar').insert(savollar.map((s, si) => ({ bob_id: bobData.id, bolim_id: bolimId, savol: s.savol, javob: s.javob, link: s.link || null, tartib: si })));
      }
      toast({ title: "Bo'lim yaratildi!" });
      setYangiBolimNomi(''); setYangiBoblar([]); setTab('bolimlar'); await yuklash();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setBolimSaqlanmoqda(false); }
  };

  const namunaCopy = () => { navigator.clipboard.writeText(NAMUNA); setNamunaCopied(true); setTimeout(() => setNamunaCopied(false), 2000); };

  if (!user || user.rol !== 'ustoz') return <Card className="max-w-md mx-auto mt-12"><CardContent className="py-12 text-center text-gray-500">Ushbu bo'lim faqat ustozlar uchun</CardContent></Card>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-2 border-violet-500 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {tab === 'qosh' && (
                <button onClick={() => setTab('bolimlar')} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="bg-white/20 p-2.5 rounded-xl"><Layers className="h-6 w-6" /></div>
              <div>
                <h1 className="text-xl font-black">Savol–Javob Paneli</h1>
                <p className="text-violet-200 text-xs mt-0.5">Bo'limlar → Boblar → Ichki boblar → Savollar</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setTab('bolimlar')} size="sm"
                className={tab === 'bolimlar' ? 'bg-white text-violet-700 font-bold' : 'bg-white/20 text-white border-white/30'}
                variant={tab === 'bolimlar' ? 'default' : 'outline'}>
                <BookOpen className="h-4 w-4 mr-1" />Bo'limlar
              </Button>
              <Button onClick={() => { setTab('qosh'); if (yangiBoblar.length === 0) yangiBobQosh(); }} size="sm"
                className={tab === 'qosh' ? 'bg-white text-violet-700 font-bold' : 'bg-white/20 text-white border-white/30'}
                variant={tab === 'qosh' ? 'default' : 'outline'}>
                <Plus className="h-4 w-4 mr-1" />Yangi bo'lim
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Yangi bo'lim yaratish */}
      {tab === 'qosh' && (
        <div className="space-y-4">
          <Card className="border-2 border-violet-300">
            <CardContent className="py-5">
              <label className="text-sm font-black text-violet-700 mb-2 block">Bo'lim nomi</label>
              <input value={yangi_bolim_nomi} onChange={e => setYangiBolimNomi(e.target.value)}
                placeholder="Masalan: Fuqarolik huquqi asoslari"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-base font-semibold" autoFocus />
            </CardContent>
          </Card>
          <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-violet-800 text-sm">📋 Format:</p>
              <button onClick={namunaCopy} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold">
                {namunaCopied ? <><Check className="h-3 w-3" />Nusxalandi!</> : <><Copy className="h-3 w-3" />Nusxa</>}
              </button>
            </div>
            <pre className="text-xs text-gray-700 bg-white rounded-lg p-3 border border-violet-200 whitespace-pre-wrap">{NAMUNA}</pre>
          </div>
          <div className="space-y-3">
            {yangiBoblar.map((yb, bi) => (
              <Card key={yb.tempId} className="border-2 border-indigo-200">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer bg-indigo-50 rounded-t-xl" onClick={() => yangiBobUpdate(yb.tempId, 'ochiq', !yb.ochiq)}>
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black">{bi + 1}</div>
                  <div className="flex-1 text-sm font-bold text-indigo-800 truncate">{yb.nomi || `Bob ${bi + 1}`}</div>
                  <div className="flex items-center gap-1.5">
                    {yb.parsedSavollar.length > 0 && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-300">{yb.parsedSavollar.length} savol</span>}
                    <button onClick={e => { e.stopPropagation(); yangiBobOchir(yb.tempId); }} className="p-1 hover:bg-red-100 rounded-lg text-red-400"><Trash2 className="h-4 w-4" /></button>
                    {yb.ochiq ? <ChevronDown className="h-4 w-4 text-indigo-500" /> : <ChevronRight className="h-4 w-4 text-indigo-400" />}
                  </div>
                </div>
                {yb.ochiq && (
                  <CardContent className="pt-4 pb-5 space-y-4">
                    <input value={yb.nomi} onChange={e => yangiBobUpdate(yb.tempId, 'nomi', e.target.value)} placeholder="Bob nomi..." className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-sm" />
                    <textarea value={yb.pasteMatn} onChange={e => yangiBobUpdate(yb.tempId, 'pasteMatn', e.target.value)} placeholder={`1. Savol\nJavob: Javob matni`} rows={5} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-sm font-mono resize-y" />
                    <button onClick={() => { const p = parseSavolJavob(yb.pasteMatn); yangiBobUpdate(yb.tempId, 'parsedSavollar', p); }} disabled={!yb.pasteMatn.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-40 text-indigo-700 rounded-xl text-xs font-bold border-2 border-indigo-200">
                      <Eye className="h-3.5 w-3.5" />Ko'rib chiqish ({parseSavolJavob(yb.pasteMatn).length} ta)
                    </button>
                    {yb.parsedSavollar.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border-2 border-green-200 bg-green-50 p-3 space-y-1">
                        {yb.parsedSavollar.map((s, si) => (
                          <div key={si} className="bg-white border border-green-200 rounded-lg p-2 text-xs">
                            <p className="font-bold text-green-800">{si + 1}. {s.savol}</p>
                            <p className="text-green-700 line-clamp-1">{s.javob}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={yangiBobQosh} className="flex items-center gap-2 px-5 py-3 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold transition-all">
              <Plus className="h-4 w-4" />Bob qo'shish
            </button>
            <Button onClick={yangibolimSaqla} disabled={bolimSaqlanmoqda || !yangi_bolim_nomi.trim()} className="bg-violet-600 hover:bg-violet-700 text-white font-black px-6 flex-1 sm:flex-none min-w-[160px]">
              {bolimSaqlanmoqda ? 'Saqlanmoqda...' : <><Save className="h-4 w-4 mr-2" />Bo'limni saqlash</>}
            </Button>
          </div>
          {yangiBoblar.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />Bob qo'shmasangiz ham bo'lim yaratiladi.
            </div>
          )}
        </div>
      )}

      {/* Bo'limlar listi */}
      {tab === 'bolimlar' && (
        <div className="space-y-4">
          {yuklanmoqda ? (
            <Card><CardContent className="py-16 text-center"><div className="animate-spin h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full mx-auto" /></CardContent></Card>
          ) : bolimlar.length === 0 ? (
            <Card><CardContent className="py-20 text-center">
              <Layers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-500">Hali bo'lim yaratilmagan</p>
              <Button onClick={() => { setTab('qosh'); if (yangiBoblar.length === 0) yangiBobQosh(); }} className="mt-5 bg-violet-600 hover:bg-violet-700 text-white">
                <Plus className="h-4 w-4 mr-1" />Yangi bo'lim
              </Button>
            </CardContent></Card>
          ) : (
            bolimlar.map((b) => {
              const bolimOchiq = ochiqBolimlar.has(b.id);
              return (
                <Card key={b.id} className={`border-2 transition-all ${b.faol ? 'border-green-400 shadow-green-100 shadow-md' : 'border-gray-200 hover:border-violet-300'}`}>
                  <CardContent className="py-0">
                    <div className="flex items-center gap-3 py-4">
                      <button onClick={() => toggleBolim(b.id)} className="text-gray-400 hover:text-violet-600 transition-colors flex-shrink-0">
                        {bolimOchiq ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      </button>
                      <div className="flex-1 cursor-pointer min-w-0" onClick={() => toggleBolim(b.id)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-lg text-gray-900 truncate">{b.nomi}</h3>
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border-2 flex-shrink-0 ${b.faol ? 'bg-green-100 border-green-400 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${b.faol ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            {b.faol ? 'FAOL' : "TO'XTATILGAN"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                          <span><FileText className="h-3.5 w-3.5 inline mr-1" />{b._boblar?.length || 0} bob</span>
                          <span><BookOpen className="h-3.5 w-3.5 inline mr-1" />{b._savollar_soni || 0} savol</span>
                          <span className="text-violet-600 font-semibold">👁 {b._koruvchilar?.length || 0} ko'rdi</span>
                          <span className="text-green-600 font-semibold">✅ {b._yechganlar?.length || 0} yechdi</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <Button onClick={() => startStop(b)} size="sm" className={`font-bold h-8 px-3 ${b.faol ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                          {b.faol ? <><Square className="h-3 w-3 mr-1" />STOP</> : <><Play className="h-3 w-3 mr-1" />START</>}
                        </Button>
                        <button onClick={() => natijalarKor(b)} className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"><BarChart3 className="h-4 w-4" /></button>
                        <button onClick={() => bolimOchir(b.id)} className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    {bolimOchiq && (
                      <div className="border-t border-gray-100 pb-3 pt-2 pl-6 space-y-2">
                        <AddBobInline bolimId={b.id} onAdded={yuklash} />
                        {(!b._boblar || b._boblar.length === 0) ? (
                          <div className="py-5 text-center text-gray-400 text-sm">Hali bob yo'q.</div>
                        ) : (
                          b._boblar.map((bob, bobIdx) => (
                            <BobItem key={bob.id} bob={bob} bolim={b} depth={0} idx={bobIdx}
                              ochiqBoblar={ochiqBoblar} toggleBob={toggleBob} bobOchir={bobOchir}
                              setPasteModal={setPasteModal} setPasteMatn={setPasteMatn} setParsedSavollar={setParsedSavollar}
                              setSavolTahrirlay={setSavolTahrirlay} savolOchir={savolOchir} onReload={yuklash} />
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Paste modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!pasteYuklanyapti) { setPasteModal(null); setPasteMatn(''); setParsedSavollar([]); } }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3"><Clipboard className="h-5 w-5" /><div><p className="font-black text-lg">Savollar qo'shish</p><p className="text-violet-200 text-xs">Bob: {pasteModal.bob_nomi}</p></div></div>
              <button onClick={() => { setPasteModal(null); setPasteMatn(''); setParsedSavollar([]); }} className="hover:bg-white/20 p-2 rounded-xl">&times;</button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1.5 block">Savollarni paste qiling:</label>
                <textarea value={pasteMatn} onChange={e => { setPasteMatn(e.target.value); setParsedSavollar([]); }} placeholder="1. Savol\nJavob: Javob matni" rows={10} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 text-sm font-mono resize-y" />
              </div>
              <Button onClick={() => { const p = parseSavolJavob(pasteMatn); setParsedSavollar(p); if (p.length === 0) toast({ title: 'Savol topilmadi', variant: 'destructive' }); }}
                disabled={!pasteMatn.trim()} variant="outline" className="border-2 border-violet-400 text-violet-700 hover:bg-violet-50 font-bold">
                <Eye className="h-4 w-4 mr-2" />Ko'rib chiqish ({parseSavolJavob(pasteMatn).length} ta)
              </Button>
              {parsedSavollar.length > 0 && (
                <div className="space-y-3">
                  <p className="font-bold text-green-700">{parsedSavollar.length} ta savol aniqlandi</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {parsedSavollar.map((s, i) => (
                      <div key={i} className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                        <p className="font-bold text-green-800">{i + 1}. {s.savol}</p>
                        <p className="text-green-700 text-xs mt-1 line-clamp-2">{s.javob}</p>
                      </div>
                    ))}
                  </div>
                  <Button onClick={pasteModalSaqla} disabled={pasteYuklanyapti} className="w-full bg-green-600 hover:bg-green-700 text-white font-black h-12">
                    {pasteYuklanyapti ? 'Saqlanmoqda...' : `${parsedSavollar.length} ta savolni saqlash`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Savol tahrirlash */}
      {savol_tahrirlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSavolTahrirlay(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-black text-amber-700 flex items-center gap-2"><Edit className="h-5 w-5" />Savol tahrirlash</h3>
            <div><label className="text-sm font-bold text-gray-700 mb-1 block">Savol:</label><textarea value={savol_tahrirlay.savol} onChange={e => setSavolTahrirlay({ ...savol_tahrirlay, savol: e.target.value })} rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 text-sm resize-none" /></div>
            <div><label className="text-sm font-bold text-gray-700 mb-1 block">Javob:</label><textarea value={savol_tahrirlay.javob} onChange={e => setSavolTahrirlay({ ...savol_tahrirlay, javob: e.target.value })} rows={5} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 text-sm resize-none" /></div>
            <div><label className="text-sm font-bold text-gray-700 mb-1 block">Link:</label><input value={savol_tahrirlay.link || ''} onChange={e => setSavolTahrirlay({ ...savol_tahrirlay, link: e.target.value })} placeholder="https://..." className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500 text-sm" /></div>
            <div className="flex gap-2">
              <Button onClick={savolSaqla} className="bg-amber-600 hover:bg-amber-700 text-white font-bold flex-1"><Save className="h-4 w-4 mr-1" />Saqlash</Button>
              <Button onClick={() => setSavolTahrirlay(null)} variant="outline">Bekor</Button>
            </div>
          </div>
        </div>
      )}

      {/* Natijalar modal */}
      {natijalarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setNatijalarModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div><p className="font-black text-lg">Natijalar</p><p className="text-blue-200 text-xs">{natijalarModal.nomi}</p></div>
              <button onClick={() => setNatijalarModal(null)} className="hover:bg-white/20 p-2 rounded-xl">&times;</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-3 text-center"><p className="text-2xl font-black text-violet-700">{natijalarModal._koruvchilar?.length || 0}</p><p className="text-xs text-violet-600 font-semibold mt-1">👁 Ko'rdi</p></div>
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center"><p className="text-2xl font-black text-green-700">{natijalarModal._yechganlar?.length || 0}</p><p className="text-xs text-green-600 font-semibold mt-1">✅ Yechdi</p></div>
              </div>
              {natijalar.length === 0 ? (
                <div className="py-12 text-center text-gray-400"><Users className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>Hali hech kim yechmagan</p></div>
              ) : (
                natijalar.map((n: any) => {
                  const topdi = (n.natija || []).filter((x: any) => x.holat === 'topdi').length;
                  const bilmadi = (n.natija || []).filter((x: any) => x.holat === 'bilmadi').length;
                  const foiz = (topdi + bilmadi) > 0 ? Math.round((topdi / (topdi + bilmadi)) * 100) : 0;
                  return (
                    <div key={n.id} className="border-2 border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-800">{n.oquvchi_ismi}</p>
                        <div className="flex gap-3 text-sm items-center">
                          <span className="text-green-600 font-bold">✓ {topdi}</span>
                          <span className="text-red-500 font-bold">✗ {bilmadi}</span>
                          <span className={`font-black px-2 py-0.5 rounded-full text-xs ${foiz >= 70 ? 'bg-green-100 text-green-700' : foiz >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{foiz}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddBobInline({ bolimId, onAdded }: { bolimId: string; onAdded: () => void }) {
  const [nomi, setNomi] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [ochiq, setOchiq] = useState(false);
  const { toast } = useToast();

  const qosh = async () => {
    if (!nomi.trim()) return;
    setYuklanyapti(true);
    try {
      const { data: mavjud } = await supabase.from('sj_boblar').select('id').eq('bolim_id', bolimId).is('parent_bob_id', null);
      const { error } = await supabase.from('sj_boblar').insert({ bolim_id: bolimId, parent_bob_id: null, nomi: nomi.trim(), tartib: (mavjud || []).length });
      if (error) throw error;
      setNomi(''); setOchiq(false);
      toast({ title: "Bob qo'shildi!" }); onAdded();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setYuklanyapti(false); }
  };

  if (!ochiq) return (
    <button onClick={() => setOchiq(true)}
      className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/50 text-indigo-500 hover:text-indigo-700 rounded-lg text-xs font-bold transition-all mb-1">
      <Plus className="h-3.5 w-3.5" />Bob qo'shish
    </button>
  );

  return (
    <div className="flex gap-2 mb-2">
      <input value={nomi} onChange={e => setNomi(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') qosh(); if (e.key === 'Escape') setOchiq(false); }}
        placeholder="Bob nomi..." className="flex-1 px-3 py-2 border-2 border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-500 text-sm" autoFocus />
      <button onClick={qosh} disabled={yuklanyapti || !nomi.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold">
        {yuklanyapti ? '...' : "Qo'sh"}
      </button>
      <button onClick={() => { setOchiq(false); setNomi(''); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs">Bekor</button>
    </div>
  );
}
