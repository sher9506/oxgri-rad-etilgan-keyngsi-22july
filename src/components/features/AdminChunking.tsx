import { useState, useEffect } from 'react';
import {
  Database, RefreshCw, Play, Trash2,
  Loader2, FileText, Layers, Search, X, ChevronDown,
  ChevronUp, Zap, BookOpen, Eye, AlignLeft, Server, Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface Bolim {
  id: string;
  nomi: string;
  ustoz_ismi: string;
  faol: boolean;
}

interface Bob {
  id: string;
  bolim_id: string;
  nomi: string;
  _materiallar?: Material[];
}

interface Material {
  id: string;
  bob_id: string;
  bolim_id: string;
  nomi: string;
  fayl_url: string;
  fayl_tur: string;
  fayl_hajm?: number;
  _chunk_soni?: number;
}

interface ChunkStat {
  bolim_id: string;
  bolim_nomi: string;
  material_id: string;
  material_nomi: string;
  chunk_soni: number;
}

interface ChunkDetail {
  id: string;
  chunk_index: number;
  matn: string;
  keywords: string[];
  bob_nomi: string;
  bolim_nomi: string;
}

type HolatTuri = 'idle' | 'yuklanyapti' | 'muvaffaqiyat' | 'xato';

interface ChunklashHolat {
  [materialId: string]: {
    holat: HolatTuri;
    chunk_soni?: number;
    xato?: string;
  };
}

// ── Matn ajratuvchi — Overlap 15% bilan ────────────────────────────────────
function textToChunks(text: string, chunkSize = 450, overlapRatio = 0.15): string[] {
  // Paragraflarni ajratish
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 40);

  const chunks: string[] = [];
  let current = '';
  const currentWords: string[] = [];

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/);
    const combined = currentWords.length
      ? [...currentWords, ...paraWords]
      : paraWords;

    if (combined.length <= chunkSize) {
      currentWords.push(...paraWords);
      current = currentWords.join(' ');
    } else {
      if (current) chunks.push(current);

      if (paraWords.length > chunkSize) {
        // Uzun paragrafni gaplarga bo'lish
        const sentences = para.match(/[^.!?…]+[.!?…]+/g) || [para];
        let sentWords: string[] = [];
        for (const s of sentences) {
          const sw = s.split(/\s+/);
          if (sentWords.length + sw.length <= chunkSize) {
            sentWords.push(...sw);
          } else {
            if (sentWords.length) chunks.push(sentWords.join(' '));
            sentWords = sw;
          }
        }
        // 15% overlap: oldingi chunkdan so'nggi N ta so'zni olish
        const overlapWords = Math.round(chunkSize * overlapRatio);
        const prevChunkWords = chunks.length
          ? chunks[chunks.length - 1].split(/\s+/).slice(-overlapWords)
          : [];
        currentWords.length = 0;
        currentWords.push(...prevChunkWords, ...sentWords);
        current = currentWords.join(' ');
      } else {
        // 15% overlap: oldingi chunkdan so'nggi N ta so'zni olish
        const overlapWords = Math.round(chunkSize * overlapRatio);
        const prevChunkWords = chunks.length
          ? chunks[chunks.length - 1].split(/\s+/).slice(-overlapWords)
          : [];
        currentWords.length = 0;
        currentWords.push(...prevChunkWords, ...paraWords);
        current = currentWords.join(' ');
      }
    }
  }
  if (current && current.split(/\s+/).length > 10) chunks.push(current);
  return chunks;
}

// ── Keywords ajratish ─────────────────────────────────────────────────────────
function extractKeywords(text: string): string[] {
  const stop = new Set(['va', 'yoki', 'bu', 'u', 'men', 'sen', 'biz', 'siz', 'nima', 'qanday',
    'qaysi', 'kim', 'haqida', 'uchun', 'bilan', 'ning', 'ga', 'da', 'dan', 'ni', 'ham', 'ammo',
    'lekin', 'chunki', 'agar', 'bir', 'o\'z', 'ko\'p', 'yangi', 'qilish', 'bo\'lib', 'bo\'ladi',
    'mumkin', 'kerak', 'degan', 'olish', 'berish', 'emas', 'yo\'q', 'bor', 'kabi', 'sifatida']);

  const words = text.toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stop.has(w) && isNaN(Number(w)));

  // Chastotani hisoblash
  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([w]) => w);
}

// ── HTML ni matnга aylantirish ─────────────────────────────────────────────────
function htmlToText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ── PDF / DOCX matnni ajratish ────────────────────────────────────────────────
async function extractTextFromUrl(url: string, tur: string): Promise<string> {
  try {
    const res = await fetch(url);

    if (tur === 'html') {
      const html = await res.text();
      return htmlToText(html);
    }

    if (tur === 'pdf') {
      const arrayBuffer = await res.arrayBuffer();
      // PDF.js orqali
      if (!(window as any).pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          s.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          };
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    }

    if (tur === 'docx' || tur.includes('doc')) {
      if (!(window as any).mammoth) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
          s.onload = () => resolve();
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const arrayBuffer2 = await res.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer: arrayBuffer2 });
      return result.value || '';
    }

    // Fallback: matn sifatida o'qish
    return await res.text();
  } catch (e: any) {
    throw new Error(`Matnni o'qib bo'lmadi: ${e.message}`);
  }
}

export default function AdminChunking() {
  const { toast } = useToast();
  const [bolimlar, setBolimlar] = useState<Bolim[]>([]);
  const [materiallar, setMateriallar] = useState<Material[]>([]);
  const [chunkStatlar, setChunkStatlar] = useState<ChunkStat[]>([]);
  const [chunklashHolat, setChunklashHolat] = useState<ChunklashHolat>({});
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [tanlananBolim, setTanlananBolim] = useState<string>('barchasi');
  const [qidiruv, setQidiruv] = useState('');
  const [ochiqBolimlar, setOchiqBolimlar] = useState<Set<string>>(new Set());
  const [umumiyChunklash, setUmumiyChunklash] = useState(false);
  const [progress, setProgress] = useState({ jami: 0, bajarilgan: 0 });
  const [viewModal, setViewModal] = useState<{ material: Material; chunks: ChunkDetail[] } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [serverIndexing, setServerIndexing] = useState(false);
  const [serverStats, setServerStats] = useState<{ total_chunks: number; unique_bolimlar: number; bolimlar: string[] } | null>(null);

  useEffect(() => { yuklash(); loadServerStats(); }, []);

  const loadServerStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('chunk-material', {
        body: { action: 'stats' }
      });
      if (!error && data) setServerStats(data);
    } catch {}
  };

  const serverIndexAll = async () => {
    if (!confirm('Server orqali barcha HTML materiallarni qayta indekslash (AI keyword enrichment bilan)?')) return;
    setServerIndexing(true);
    try {
      const { data, error } = await supabase.functions.invoke('chunk-material', {
        body: { action: 'index_all', use_ai_keywords: false }
      });
      if (error) throw error;
      toast({
        title: `Server indekslash tugadi`,
        description: `${data.indexed} ta material | ${data.totalChunks} ta chunk`,
      });
      await yuklash();
      await loadServerStats();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setServerIndexing(false); }
  };

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const [bolimRes, matRes, chunkRes] = await Promise.all([
        supabase.from('om_bolimlar').select('id, nomi, ustoz_ismi, faol').eq('faol', true).order('tartib', { ascending: true }),
        supabase.from('om_materiallar').select('id, bob_id, bolim_id, nomi, fayl_url, fayl_tur, fayl_hajm').order('tartib', { ascending: true }),
        supabase.from('om_chunks').select('material_id, bolim_id, bolim_nomi, material_nomi'),
      ]);

      setBolimlar(bolimRes.data || []);
      setMateriallar(matRes.data || []);

      // Chunk statistikasi
      const statMap: Record<string, ChunkStat> = {};
      (chunkRes.data || []).forEach((c: any) => {
        const key = c.material_id;
        if (!statMap[key]) {
          statMap[key] = {
            bolim_id: c.bolim_id,
            bolim_nomi: c.bolim_nomi,
            material_id: c.material_id,
            material_nomi: c.material_nomi,
            chunk_soni: 0,
          };
        }
        statMap[key].chunk_soni++;
      });
      setChunkStatlar(Object.values(statMap));
    } finally {
      setYuklanyapti(false);
    }
  };

  const materialChunkSoni = (materialId: string) => {
    return chunkStatlar.find(s => s.material_id === materialId)?.chunk_soni || 0;
  };

  // ── Bitta material chunklash ────────────────────────────────────────────────
  const materialChunklash = async (material: Material) => {
    setChunklashHolat(prev => ({ ...prev, [material.id]: { holat: 'yuklanyapti' } }));

    try {
      // 1. Avval eski chunklarni o'chirish
      await supabase.from('om_chunks').delete().eq('material_id', material.id);

      // 2. Material matnini olish
      const matn = await extractTextFromUrl(material.fayl_url, material.fayl_tur);
      if (!matn || matn.trim().length < 50) {
        throw new Error('Materialda yetarli matn yo\'q');
      }

      // 3. Chunklash
      const chunks = textToChunks(matn.trim(), 400, 80);
      if (!chunks.length) {
        throw new Error('Chunklash natija bermadi');
      }

      // 4. Bob va bo'lim ma'lumotlarini olish
      const { data: bobData } = await supabase.from('om_boblar').select('nomi, bolim_id').eq('id', material.bob_id).maybeSingle();
      const { data: bolimData } = await supabase.from('om_bolimlar').select('nomi').eq('id', material.bolim_id).maybeSingle();

      // 5. DB ga saqlash
      const chunkRows = chunks.map((chunk, idx) => ({
        material_id: material.id,
        bolim_id: material.bolim_id,
        bob_id: material.bob_id,
        bolim_nomi: bolimData?.nomi || 'Noma\'lum',
        bob_nomi: bobData?.nomi || 'Noma\'lum',
        material_nomi: material.nomi,
        chunk_index: idx,
        matn: chunk,
        keywords: extractKeywords(chunk),
      }));

      // Batch insert (50 tadan)
      for (let i = 0; i < chunkRows.length; i += 50) {
        const batch = chunkRows.slice(i, i + 50);
        const { error } = await supabase.from('om_chunks').insert(batch);
        if (error) throw error;
      }

      setChunklashHolat(prev => ({ ...prev, [material.id]: { holat: 'muvaffaqiyat', chunk_soni: chunks.length } }));
      setChunkStatlar(prev => {
        const filtered = prev.filter(s => s.material_id !== material.id);
        return [...filtered, {
          bolim_id: material.bolim_id,
          bolim_nomi: bolimData?.nomi || '',
          material_id: material.id,
          material_nomi: material.nomi,
          chunk_soni: chunks.length,
        }];
      });

      return chunks.length;
    } catch (e: any) {
      setChunklashHolat(prev => ({ ...prev, [material.id]: { holat: 'xato', xato: e.message } }));
      throw e;
    }
  };

  // ── Barcha materiallarni chunklash ────────────────────────────────────────
  const barchasiChunklash = async () => {
    const faolMateriallar = materiallar.filter(m => {
      // Faqat faol bo'limlardagi materiallar
      const bolim = bolimlar.find(b => b.id === m.bolim_id);
      return bolim?.faol;
    });

    if (!faolMateriallar.length) {
      toast({ title: 'Xato', description: 'Faol materiallar topilmadi', variant: 'destructive' });
      return;
    }

    setUmumiyChunklash(true);
    setProgress({ jami: faolMateriallar.length, bajarilgan: 0 });

    let muvaffaqiyat = 0, xato = 0;

    for (const mat of faolMateriallar) {
      try {
        await materialChunklash(mat);
        muvaffaqiyat++;
      } catch {
        xato++;
      }
      setProgress(prev => ({ ...prev, bajarilgan: prev.bajarilgan + 1 }));
    }

    setUmumiyChunklash(false);
    toast({
      title: `Chunklash tugadi`,
      description: `${muvaffaqiyat} ta muvaffaqiyatli, ${xato} ta xato`,
    });
  };

  // ── Bitta materialning chunklarini o'chirish ─────────────────────────────
  const chunklarniOchirish = async (materialId: string) => {
    if (!confirm('Bu materialning barcha chunklarini o\'chirasizmi?')) return;
    const { error } = await supabase.from('om_chunks').delete().eq('material_id', materialId);
    if (error) {
      toast({ title: 'Xato', description: error.message, variant: 'destructive' });
      return;
    }
    setChunkStatlar(prev => prev.filter(s => s.material_id !== materialId));
    setChunklashHolat(prev => {
      const n = { ...prev };
      delete n[materialId];
      return n;
    });
    toast({ title: "O'chirildi", description: 'Chunklist o\'chirildi' });
  };

  // Filtrlangan materiallar
  const filteredMateriallar = materiallar.filter(m => {
    const bolim = bolimlar.find(b => b.id === m.bolim_id);
    if (!bolim) return false;
    const bolimOk = tanlananBolim === 'barchasi' || m.bolim_id === tanlananBolim;
    const qidiruvOk = !qidiruv || m.nomi.toLowerCase().includes(qidiruv.toLowerCase());
    return bolimOk && qidiruvOk;
  });

  // ── Chunk matnlarini ko'rish ──────────────────────────────────────────────
  const chunklaKorish = async (mat: Material) => {
    setViewLoading(true);
    const { data } = await supabase
      .from('om_chunks')
      .select('id, chunk_index, matn, keywords, bob_nomi, bolim_nomi')
      .eq('material_id', mat.id)
      .order('chunk_index', { ascending: true });
    setViewModal({ material: mat, chunks: (data || []) as ChunkDetail[] });
    setViewLoading(false);
  };

  // Guruhlash bo'lim bo'yicha
  const bolimlarMap: Record<string, { bolim: Bolim; materiallar: Material[] }> = {};
  filteredMateriallar.forEach(m => {
    const bolim = bolimlar.find(b => b.id === m.bolim_id);
    if (!bolim) return;
    if (!bolimlarMap[bolim.id]) bolimlarMap[bolim.id] = { bolim, materiallar: [] };
    bolimlarMap[bolim.id].materiallar.push(m);
  });

  // Umumiy statistika
  const jami_material = materiallar.length;
  const chunklangan = materiallar.filter(m => materialChunkSoni(m.id) > 0).length;
  const jami_chunk = chunkStatlar.reduce((s, c) => s + c.chunk_soni, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-purple-700 text-white p-6 rounded-3xl shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <Database className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black">Chunking Paneli</h1>
              <p className="text-purple-200 text-sm mt-0.5">O'quv materialllarni AI uchun indekslash</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={serverIndexAll} disabled={serverIndexing || umumiyChunklash}
              className="bg-emerald-500/80 hover:bg-emerald-500 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50">
              {serverIndexing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Server className="h-4 w-4" />}
              Server indekslash
            </button>
            <button onClick={yuklash} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${yuklanyapti ? 'animate-spin' : ''}`} /> Yangilash
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Jami material', value: jami_material, icon: FileText },
            { label: 'Chunklangan', value: `${chunklangan}/${jami_material}`, icon: CheckCircle },
            { label: 'Jami chunk', value: jami_chunk, icon: Layers },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-2xl px-4 py-3">
              <s.icon className="h-5 w-5 text-white/70 mb-1" />
              <p className="text-xl font-black">{s.value}</p>
              <p className="text-purple-200 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Server Stats */}
      {serverStats && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-black text-emerald-700 mb-1">Server indeksi holati</p>
            <div className="flex flex-wrap gap-3 text-xs text-emerald-700">
              <span><strong>{serverStats.total_chunks}</strong> ta chunk</span>
              <span><strong>{serverStats.unique_bolimlar}</strong> ta bo'lim</span>
            </div>
          </div>
        </div>
      )}

      {/* Amallar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={barchasiChunklash}
            disabled={umumiyChunklash || yuklanyapti}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
          >
            {umumiyChunklash
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress.bajarilgan}/{progress.jami}</>
              : <><Zap className="h-4 w-4" /> Barchasini chunklash</>}
          </button>

          {umumiyChunklash && (
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${progress.jami ? (progress.bajarilgan / progress.jami) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold text-slate-500">{Math.round(progress.jami ? (progress.bajarilgan / progress.jami) * 100 : 0)}%</span>
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Qidirish..."
              value={qidiruv}
              onChange={e => setQidiruv(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-violet-400 w-48"
            />
          </div>
          <select
            value={tanlananBolim}
            onChange={e => setTanlananBolim(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-violet-400 bg-white"
          >
            <option value="barchasi">Barcha bo'limlar</option>
            {bolimlar.map(b => (
              <option key={b.id} value={b.id}>{b.nomi}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Materiallar ro'yxati */}
      {yuklanyapti ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <Loader2 className="h-10 w-10 animate-spin text-violet-500 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Yuklanmoqda...</p>
        </div>
      ) : Object.keys(bolimlarMap).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <Database className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Material topilmadi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.values(bolimlarMap).map(({ bolim, materiallar: mats }) => {
            const isOchiq = ochiqBolimlar.has(bolim.id);
            const bolimChunkSoni = mats.reduce((s, m) => s + materialChunkSoni(m.id), 0);
            const chunklangan_mat = mats.filter(m => materialChunkSoni(m.id) > 0).length;

            return (
              <div key={bolim.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Bo'lim header */}
                <button
                  onClick={() => setOchiqBolimlar(prev => {
                    const n = new Set(prev);
                    n.has(bolim.id) ? n.delete(bolim.id) : n.add(bolim.id);
                    return n;
                  })}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-slate-900 text-sm">{bolim.nomi}</p>
                      <p className="text-xs text-slate-400 font-medium">{bolim.ustoz_ismi} • {mats.length} material</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg">
                      {chunklangan_mat}/{mats.length} chunklangan
                    </span>
                    {bolimChunkSoni > 0 && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        {bolimChunkSoni} chunk
                      </span>
                    )}
                    {isOchiq ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {/* Materiallar */}
                {isOchiq && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {mats.map(mat => {
                      const chunkSoni = materialChunkSoni(mat.id);
                      const holat = chunklashHolat[mat.id];

                      return (
                        <div key={mat.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            chunkSoni > 0 ? 'bg-emerald-100' : 'bg-slate-100'
                          }`}>
                            <FileText className={`h-4 w-4 ${chunkSoni > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{mat.nomi}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{mat.fayl_tur}</span>
                              {chunkSoni > 0 && (
                                <span className="text-[10px] font-black text-emerald-600">{chunkSoni} chunk</span>
                              )}
                              {holat?.holat === 'xato' && (
                                <span className="text-[10px] font-bold text-red-500 truncate max-w-[150px]" title={holat.xato}>
                                  ❌ {holat.xato?.slice(0, 40)}
                                </span>
                              )}
                              {holat?.holat === 'muvaffaqiyat' && (
                                <span className="text-[10px] font-black text-emerald-600">
                                  ✅ {holat.chunk_soni} chunk saqlandi
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Amallar */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {holat?.holat === 'yuklanyapti' ? (
                              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                            ) : (
                              <>
                                <button
                                  onClick={() => materialChunklash(mat)}
                                  disabled={umumiyChunklash}
                                  className="p-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 transition-all disabled:opacity-40"
                                  title={chunkSoni > 0 ? 'Qayta chunklash' : 'Chunklash'}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </button>
                                {chunkSoni > 0 && (
                                  <>
                                    <button
                                      onClick={() => chunklaKorish(mat)}
                                      disabled={umumiyChunklash || viewLoading}
                                      className="p-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 transition-all disabled:opacity-40"
                                      title="Chunk matnlarini ko'rish"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => chunklarniOchirish(mat.id)}
                                      disabled={umumiyChunklash}
                                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-all disabled:opacity-40"
                                      title="Chunklarni o'chirish"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </>
                            )}

                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              holat?.holat === 'muvaffaqiyat' || chunkSoni > 0 ? 'bg-emerald-400' :
                              holat?.holat === 'xato' ? 'bg-red-400' :
                              holat?.holat === 'yuklanyapti' ? 'bg-amber-400 animate-pulse' :
                              'bg-slate-200'
                            }`} />
                          </div>
                        </div>
                      );
                    })}

                    {/* Bo'limni chunklash */}
                    <div className="px-5 py-3 bg-slate-50/50">
                      <button
                        onClick={async () => {
                          for (const mat of mats) {
                            try { await materialChunklash(mat); } catch {}
                          }
                          toast({ title: `${bolim.nomi} chunklandi`, description: `${mats.length} ta material qayta ishlandi` });
                        }}
                        disabled={umumiyChunklash}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 rounded-lg transition-all disabled:opacity-40"
                      >
                        <Zap className="h-3.5 w-3.5" /> Ushbu bo'limni chunklash
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Chunk Ko'rish Modali */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-700 to-purple-700 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <AlignLeft className="h-5 w-5" />
                <div>
                  <p className="font-black text-sm">{viewModal.material.nomi}</p>
                  <p className="text-violet-200 text-xs">{viewModal.chunks.length} ta chunk</p>
                </div>
              </div>
              <button onClick={() => setViewModal(null)} className="p-2 hover:bg-white/20 rounded-xl transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chunks */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {viewModal.chunks.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Chunklalar topilmadi</p>
                </div>
              ) : viewModal.chunks.map((chunk, idx) => (
                <div key={chunk.id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                  {/* Chunk header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-violet-50 border-b border-violet-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-violet-600 text-white rounded-lg text-[10px] font-black flex items-center justify-center">
                        {chunk.chunk_index + 1}
                      </span>
                      <span className="text-[10px] font-bold text-violet-700">{chunk.bob_nomi}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {chunk.matn.split(/\s+/).length} so'z
                    </span>
                  </div>

                  {/* Matn */}
                  <div className="px-4 py-3">
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{chunk.matn}</p>
                  </div>

                  {/* Keywords */}
                  {chunk.keywords?.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1">
                      {chunk.keywords.slice(0, 8).map((kw, ki) => (
                        <span key={ki} className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Haqida */}
      <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4">
        <h3 className="text-xs font-black text-violet-700 uppercase tracking-widest mb-2">Chunking haqida</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-violet-800">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 bg-violet-200 text-violet-700 rounded-full flex items-center justify-center font-black flex-shrink-0 text-[10px]">1</span>
            <p>PDF, Word va HTML fayllardan matn avtomatik ajratiladi</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 bg-violet-200 text-violet-700 rounded-full flex items-center justify-center font-black flex-shrink-0 text-[10px]">2</span>
            <p>Matn ~400 so'zlik chunklarga bo'linadi va kalit so'zlar ajratiladi</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 bg-violet-200 text-violet-700 rounded-full flex items-center justify-center font-black flex-shrink-0 text-[10px]">3</span>
            <p>Smart Ta'lim AI faqat chunklangan materiallardan javob beradi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
