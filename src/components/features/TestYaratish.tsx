import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, Trash2, CheckCircle, Wand2, 
  Clock, ClipboardPaste, Save, 
  Loader2, Settings2, FileUp, 
  Layout, Check, Link2, MessageSquare, ChevronDown, ChevronUp, Info, Eye, RotateCcw, X, Edit3,
  BookCopy, Search, Shuffle, ListChecks, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TestSavol {
  savol: string; 
  variantlar: string[];
  togriJavob: number;
  vaqt_sekund: number;
  izoh?: string;   
  link?: string;   
}

interface TestYaratishProps {
  tahrirlashUchunTest?: any;
  onTahrirlashTugadi?: () => void;
}

// [izoh-...] va [link-...] formatini parse qilish (lotin va krill alifbosi qo'llab-quvvatlanadi)
// Qabul qilinadigan formatlar:
// [izoh-...] | [изоҳ-...] | [изох-...]
// [link-https://...] | [линк-https://...]
function parseIzohLink(text: string): { cleanText: string; izoh?: string; link?: string } {
  let izoh: string | undefined;
  let link: string | undefined;
  let cleanText = text;

  // Izoh: lotin "izoh" yoki krill "изоҳ" / "изох"
  const izohMatch = text.match(/\[(?:izoh|изоҳ|изох)-([^\]]+)\]/i);
  if (izohMatch) {
    izoh = izohMatch[1].trim();
    cleanText = cleanText.replace(izohMatch[0], '').trim();
  }

  // Link: lotin "link" yoki krill "линк"
  const linkMatch = text.match(/\[(?:link|линк)-(https?:\/\/[^\]]+)\]/i);
  if (linkMatch) {
    link = linkMatch[1].trim();
    cleanText = cleanText.replace(linkMatch[0], '').trim();
  }

  return { cleanText, izoh, link };
}

export default function TestYaratish({ tahrirlashUchunTest, onTahrirlashTugadi }: TestYaratishProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const tahrirlashRejimi = !!tahrirlashUchunTest;

  const [testNomi, setTestNomi] = useState('');
  const [timerTuri, setTimerTuri] = useState<'individual' | 'umumiy'>('umumiy');
  const [vaqtDaqiqa, setVaqtDaqiqa] = useState(30);
  const [savolSoniya, setSavolSoniya] = useState(30);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [allowRetake, setAllowRetake] = useState(false);
  const [savollar, setSavollar] = useState<TestSavol[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [natija, setNatija] = useState<{ kod: string } | null>(null);
  const [togriJavoblarMatni, setTogriJavoblarMatni] = useState('');
  const [tahrirlashSavolIdx, setTahrirlashSavolIdx] = useState<number | null>(null);
  const [tahrirlashVariantIdx, setTahrirlashVariantIdx] = useState<number | null>(null);
  const [tahrirlashMatn, setTahrirlashMatn] = useState('');
  const [instruksiyaOchiq, setInstruksiyaOchiq] = useState(false);
  
  // Mavjud testlardan olish
  const [mavjudTestlarModal, setMavjudTestlarModal] = useState(false);
  const [mavjudTestlar, setMavjudTestlar] = useState<any[]>([]);
  const [mavjudTestlarYuklanyapti, setMavjudTestlarYuklanyapti] = useState(false);
  const [tanlanganMavjudTest, setTanlanganMavjudTest] = useState<any | null>(null);
  const [olishSoni, setOlishSoni] = useState(10);
  const [testQidiruv, setTestQidiruv] = useState('');
  const [tanlanganSavollar, setTanlanganSavollar] = useState<Set<number>>(new Set());
  const [olishRejimi, setOlishRejimi] = useState<'random' | 'tanlash'>('random');
  const pasteZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tahrirlash rejimida ma'lumotlarni yuklash
  useEffect(() => {
    if (tahrirlashUchunTest) {
      setTestNomi(tahrirlashUchunTest.test_nomi || '');
      setTimerTuri(tahrirlashUchunTest.timer_turi || 'umumiy');
      setVaqtDaqiqa(tahrirlashUchunTest.vaqt_daqiqa || 30);
      setShowCorrectAnswers(tahrirlashUchunTest.show_correct_answers !== false);
      setAllowRetake(tahrirlashUchunTest.allow_retake || false);
      setSavollar(tahrirlashUchunTest.savollar || []);
    }
  }, [tahrirlashUchunTest]);

  useEffect(() => {
    if (!(window as any).mammoth) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
      document.head.appendChild(script);
    }
  }, []);

  // ── [izoh-...] va [link-...] ni savollardan aniqlash ──
  const extractIzohLinkFromVariants = (variantsHtml: string[]): { cleanVariants: string[]; izoh?: string; link?: string } => {
    let izoh: string | undefined;
    let link: string | undefined;
    const cleanVariants = variantsHtml.map(v => {
      const plain = v.replace(/<[^>]+>/g, '');
      const parsed = parseIzohLink(plain);
      if (parsed.izoh) izoh = parsed.izoh;
      if (parsed.link) link = parsed.link;
      // HTML dan ham tozalash
      const htmlCleaned = v
        .replace(/\[(?:izoh|изоҳ|изох)-[^\]]+\]/gi, '')
        .replace(/\[(?:link|линк)-https?:\/\/[^\]]+\]/gi, '')
        .trim();
      return htmlCleaned;
    });
    return { cleanVariants, izoh, link };
  };

  const extractVariantsFromText = (text: string) => {
    const splitRegex = /\s*(?:^|\s)(\*?[A-D\u0410-\u0413][\.\)\-]\s+)/; 
    const parts = text.split(splitRegex).filter(p => p.trim().length > 0);
    
    let variants: string[] = [];
    let correctIdx = 0;

    for (let i = 0; i < parts.length; i++) {
      if (parts[i].match(/^\*?[A-D\u0410-\u0413][\.\)\-]\s+$/)) {
        if (parts[i].includes('*')) correctIdx = variants.length;
        const content = parts[i+1] || "";
        variants.push(content.trim());
        i++;
      }
    }
    return { variants, correctIdx };
  };

  const parseUniversalContent = (htmlContent: string) => {
    if (!htmlContent.trim()) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const elements = Array.from(doc.body.children);

    const qRegex = /^\s*\d+\.\s+/; 
    const vRegex = /^\s*\*?[A-D\u0410-\u0413][\.\)\-]\s+/; 

    let tempResults: TestSavol[] = [];
    let currentSavolHtml = "";
    let currentVariantsHtml: string[] = [];
    let detectedCorrect = 0;
    let startFound = false;

    const savePrevious = () => {
      if (!currentSavolHtml) return;

      // [izoh-...] va [link-...] ni savoldan ham qidirish
      const savolPlain = currentSavolHtml.replace(/<[^>]+>/g, '');
      const savolParsed = parseIzohLink(savolPlain);

      const extracted = extractVariantsFromText(currentSavolHtml);
      if (extracted.variants.length >= 2) {
        const rawTextOnly = currentSavolHtml.split(/\s*(?:^|\s)(\*?[A-D\u0410-\u0413][\.\)\-]\s+)/)[0];
        const { cleanVariants, izoh: vIzoh, link: vLink } = extractIzohLinkFromVariants(extracted.variants.slice(0, 4));
        tempResults.push({
          savol: rawTextOnly,
          variantlar: cleanVariants,
          togriJavob: extracted.correctIdx,
          vaqt_sekund: savolSoniya,
          izoh: savolParsed.izoh || vIzoh,
          link: savolParsed.link || vLink,
        });
      } else if (currentVariantsHtml.length >= 2) {
        const { cleanVariants, izoh: vIzoh, link: vLink } = extractIzohLinkFromVariants(currentVariantsHtml.slice(0, 4));
        tempResults.push({
          savol: currentSavolHtml,
          variantlar: cleanVariants,
          togriJavob: detectedCorrect,
          vaqt_sekund: savolSoniya,
          izoh: savolParsed.izoh || vIzoh,
          link: savolParsed.link || vLink,
        });
      }
    };

    elements.forEach((el) => {
      const text = el.textContent || "";
      const outerHtml = el.outerHTML;

      if (!startFound) {
        if (text.trim().match(qRegex)) startFound = true;
        else return;
      }

      if (qRegex.test(text)) {
        savePrevious();
        currentSavolHtml = outerHtml.replace(/>\s*\d+\.\s+/i, '>');
        currentVariantsHtml = [];
        detectedCorrect = 0;
      } 
      else if (vRegex.test(text)) {
        if (text.trim().startsWith('*')) detectedCorrect = currentVariantsHtml.length;
        const cleanVariantHtml = outerHtml.replace(/>\s*(\*?)([A-D\u0410-\u0413])[\.\)\-]\s+/i, '>');
        currentVariantsHtml.push(cleanVariantHtml);
      } 
      else {
        if (currentSavolHtml && currentVariantsHtml.length === 0) {
          currentSavolHtml += outerHtml;
        } else if (currentVariantsHtml.length > 0) {
          currentVariantsHtml[currentVariantsHtml.length - 1] += outerHtml;
        }
      }
    });

    savePrevious();

    if (tempResults.length > 0) {
      setSavollar(tempResults);
      if (togriJavoblarMatni.trim()) applyKeys(tempResults);
      toast({ title: "Muvaffaqiyatli", description: `${tempResults.length} ta test aniqlandi.` });
    } else {
      toast({ title: "Xato", description: "Test formatini tekshiring (1. Savol... A) Variant...)", variant: "destructive" });
    }
  };

  const handleWordProcess = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setYuklanyapti(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
        parseUniversalContent(result.value);
        if (pasteZoneRef.current) pasteZoneRef.current.innerHTML = result.value;
      } catch (err: any) {
        toast({ title: "Xatolik", description: err.message, variant: "destructive" });
      } finally {
        setYuklanyapti(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; 
  };

  const applyKeys = (list: TestSavol[]) => {
    const keyMap: Record<number, number> = {};
    const matches = Array.from(togriJavoblarMatni.matchAll(/(\d+)\s*([A-D\u0410-\u0413])/gi));
    matches.forEach(m => {
      const q = parseInt(m[1]);
      const char = m[2].toUpperCase();
      let idx = 0;
      if (['A', 'А'].includes(char)) idx = 0;
      else if (['B', 'Б'].includes(char)) idx = 1;
      else if (['C', 'В', 'V'].includes(char)) idx = 2;
      else if (['D', 'Г', 'G'].includes(char)) idx = 3;
      keyMap[q] = idx;
    });
    setSavollar(list.map((s, i) => ({ ...s, togriJavob: keyMap[i + 1] ?? s.togriJavob })));
  };

  // ── SAVOLNI YANGILASH (TAHRIRLASH) ──
  const savolniYangilash = (idx: number, yangiSavol: Partial<TestSavol>) => {
    setSavollar(prev => prev.map((s, i) => i === idx ? { ...s, ...yangiSavol } : s));
  };

  const variantniYangilash = (savolIdx: number, variantIdx: number, yangiMatn: string) => {
    setSavollar(prev => prev.map((s, i) => {
      if (i !== savolIdx) return s;
      const yangiVariantlar = [...s.variantlar];
      yangiVariantlar[variantIdx] = yangiMatn;
      return { ...s, variantlar: yangiVariantlar };
    }));
  };

  const handleSaveTest = async () => {
    if (!testNomi.trim() || savollar.length === 0) {
      toast({ title: 'Xato', description: "Test nomi va savollar kiritilishi shart", variant: 'destructive' });
      return;
    }
    setYuklanyapti(true);
    try {
      if (tahrirlashRejimi && tahrirlashUchunTest) {
        // TAHRIRLASH
        const { error } = await supabase.from('testlar').update({
          test_nomi: testNomi.trim(),
          savollar: savollar,
          vaqt_daqiqa: vaqtDaqiqa,
          timer_turi: timerTuri,
          show_correct_answers: showCorrectAnswers,
          allow_retake: allowRetake,
        }).eq('id', tahrirlashUchunTest.id);
        if (error) throw error;
        toast({ title: "Yangilandi!", description: "Test muvaffaqiyatli yangilandi" });
        onTahrirlashTugadi?.();
      } else {
        // YANGI TEST
        const kod = Math.floor(10000 + Math.random() * 90000).toString();
        const { error } = await supabase.from('testlar').insert({
          kod, test_nomi: testNomi.trim(),
          ustoz_id: user?.ustoz_id,
          ustoz_ismi: `${user?.ism} ${user?.familiya}`,
          savollar: savollar,
          vaqt_daqiqa: vaqtDaqiqa,
          timer_turi: timerTuri,
          show_correct_answers: showCorrectAnswers,
          allow_retake: allowRetake,
          is_active: false, ommaviy: true
        });
        if (error) throw error;
        setNatija({ kod });
      }
    } catch (e: any) {
      toast({ title: "Xato", description: e.message, variant: "destructive" });
    } finally { setYuklanyapti(false); }
  };

  const mavjudTestlarniYuklash = async () => {
    if (!user?.ustoz_id) return;
    setMavjudTestlarYuklanyapti(true);
    try {
      const { data } = await supabase.from('testlar').select('id, kod, test_nomi, savollar, vaqt_daqiqa, ustoz_ismi, created_at').eq('ustoz_id', user.ustoz_id).order('created_at', { ascending: false });
      setMavjudTestlar(data || []);
    } finally {
      setMavjudTestlarYuklanyapti(false);
    }
  };

  const mavjudTestdanSavollarOlish = () => {
    if (!tanlanganMavjudTest) return;
    const barchaS = tanlanganMavjudTest.savollar || [];
    let olinganlar: any[];
    if (olishRejimi === 'random') {
      const shuffled = [...barchaS].sort(() => Math.random() - 0.5);
      olinganlar = shuffled.slice(0, Math.min(olishSoni, barchaS.length));
    } else {
      olinganlar = barchaS.filter((_: any, i: number) => tanlanganSavollar.has(i));
    }
    if (olinganlar.length === 0) {
      toast({ title: 'Xato', description: 'Kamida 1 ta savol tanlang', variant: 'destructive' }); return;
    }
    setSavollar(prev => [...prev, ...olinganlar.map(s => ({ ...s, vaqt_sekund: s.vaqt_sekund || 30 }))]);
    toast({ title: `✅ ${olinganlar.length} ta savol qo'shildi`, description: tanlanganMavjudTest.test_nomi });
    setMavjudTestlarModal(false);
    setTanlanganMavjudTest(null);
    setTanlanganSavollar(new Set());
    setTestQidiruv('');
  };

  const handleCleanPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    selection.getRangeAt(0).deleteContents();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
  };

  if (natija) return (
    <div className="max-w-md mx-auto pt-20 text-center animate-in zoom-in duration-300">
      <Card className="rounded-[3rem] p-10 shadow-2xl border-none bg-white">
        <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
        <h2 className="text-3xl font-black text-slate-800 uppercase">Saqlandi!</h2>
        <div className="bg-blue-50 p-8 rounded-[2.5rem] border-2 border-dashed border-blue-200 mt-6">
           <p className="text-7xl font-black text-blue-600 tracking-tighter">{natija.kod}</p>
        </div>
        <Button onClick={() => window.location.reload()} className="w-full h-16 rounded-2xl bg-slate-900 font-bold mt-8 text-white">YANGI TEST</Button>
      </Card>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32 animate-fade-in">
      {/* HEADER */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl text-white shadow-lg ${tahrirlashRejimi ? 'bg-amber-500' : 'bg-blue-600'}`}>
            {tahrirlashRejimi ? <Edit3 className="h-7 w-7" /> : <Layout className="h-7 w-7" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {tahrirlashRejimi ? 'Test ' : 'Test '}<span className={tahrirlashRejimi ? 'text-amber-500' : 'text-blue-600'}>{tahrirlashRejimi ? 'Tahrirlash' : 'Yaratish'}</span>
            </h1>
            {tahrirlashRejimi && <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Kod: {tahrirlashUchunTest?.kod}</p>}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          {tahrirlashRejimi && (
            <Button onClick={onTahrirlashTugadi} variant="outline" className="h-12 px-6 rounded-2xl font-black">
              <X className="h-4 w-4 mr-2" /> Bekor qilish
            </Button>
          )}
          {!tahrirlashRejimi && (
            <>
              <input type="file" ref={fileInputRef} className="hidden" accept=".docx" onChange={handleWordProcess} />
              <Button onClick={() => fileInputRef.current?.click()} disabled={yuklanyapti} className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black shadow-lg">
                {yuklanyapti ? <Loader2 className="animate-spin h-5 w-5" /> : <FileUp className="h-5 w-5 mr-2" />} WORD YUKLASH
              </Button>
              <Button onClick={() => { setMavjudTestlarModal(true); mavjudTestlarniYuklash(); }} className="h-12 px-6 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black shadow-lg">
                <BookCopy className="h-5 w-5 mr-2" /> TESTDAN OLISH
              </Button>
            </>
          )}
        </div>
      </div>

      {/* FORMAT INSTRUKSIYASI — faqat yangi test yaratishda */}
      {!tahrirlashRejimi && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden">
          <button onClick={() => setInstruksiyaOchiq(!instruksiyaOchiq)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-blue-100/50 transition-colors">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-500" />
              <span className="font-black text-blue-700 text-sm">Format ko'rsatmasi — Izoh va link qo'shish</span>
            </div>
            {instruksiyaOchiq ? <ChevronUp className="h-4 w-4 text-blue-500" /> : <ChevronDown className="h-4 w-4 text-blue-500" />}
          </button>
          {instruksiyaOchiq && (
            <div className="px-6 pb-5 space-y-4 border-t border-blue-100">
              <p className="text-sm text-blue-700 font-medium pt-4">Word yoki matn maydoniga quyidagi formatda yozing:</p>
              <div className="bg-white rounded-xl p-4 border border-blue-200 font-mono text-sm space-y-1 text-slate-700">
                <p className="text-slate-400 text-xs mb-2">// Standart format:</p>
                <p>1. Savol matni bu yerda yoziladi</p>
                <p>A) Birinchi variant</p>
                <p>B) Ikkinchi variant</p>
                <p>C) Uchinchi variant</p>
                <p className="text-green-600">*D) To'g'ri javob — * bilan belgilang</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-blue-200 font-mono text-sm space-y-1 text-slate-700">
                <p className="text-slate-400 text-xs mb-2">// Izoh va link qo'shish (ixtiyoriy) — variantdan keyin yozing:</p>
                <p>1. Savol matni</p>
                <p>A) Birinchi variant</p>
                <p>B) Ikkinchi variant</p>
                <p className="text-green-600">*C) To'g'ri javob</p>
                <p className="text-violet-600">D) Oxirgi variant <span className="bg-violet-50 px-1 rounded">[izoh-Bu 1-moddaga ko'ra shunday bo'ladi]</span></p>
                <p className="text-amber-600 pl-3"><span className="bg-amber-50 px-1 rounded">[link-https://lex.uz/uz/]</span></p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-violet-700">Izoh formati</p>
                    <p className="text-xs text-violet-600 font-mono mt-1">[izoh-Qonun 1-moddasi bo'yicha]</p>
                    <p className="text-[10px] text-violet-500 mt-1">O'quvchi test tugagach izoh matn sifatida ko'radi</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                  <Link2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-amber-700">Link formati</p>
                    <p className="text-xs text-amber-600 font-mono mt-1">[link-https://lex.uz/uz/]</p>
                    <p className="text-[10px] text-amber-500 mt-1">O'quvchiga tugma sifatida ko'rinadi (bosib o'tadi)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* MATN MAYDONI — faqat yangi test yaratishda */}
          {!tahrirlashRejimi && (
            <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="text-base flex items-center gap-3"><ClipboardPaste className="text-blue-400" /> Matn maydoni</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div 
                  ref={pasteZoneRef} 
                  contentEditable 
                  onPaste={handleCleanPaste}
                  className="min-h-[250px] bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] p-6 text-base focus:border-blue-500 focus:bg-white transition-all shadow-inner overflow-y-auto outline-none" 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input placeholder="Kalitlar (1A 2B 3C...)" value={togriJavoblarMatni} onChange={e => setTogriJavoblarMatni(e.target.value)} className="h-14 rounded-2xl border-2 font-bold px-5 bg-slate-50" />
                  <Button onClick={() => parseUniversalContent(pasteZoneRef.current?.innerHTML || "")} className="h-14 bg-blue-600 hover:bg-slate-900 text-white rounded-2xl font-black shadow-xl">
                    <Wand2 className="mr-2 h-5 w-5" /> ANALIZ QILISH
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SAVOLLAR RO'YHATI */}
          {savollar.length === 0 && tahrirlashRejimi && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400">
              <p className="font-bold">Savollar yuklanmoqda...</p>
            </div>
          )}

          {savollar.map((s, idx) => (
            <Card key={idx} className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0">{idx + 1}</div>
                  <div className="flex-1 space-y-4">
                    {/* Savol matni — tahrirlash */}
                    <div>
                      {tahrirlashSavolIdx === idx && tahrirlashVariantIdx === null ? (
                        <div className="space-y-2">
                          <textarea
                            value={tahrirlashMatn}
                            onChange={e => setTahrirlashMatn(e.target.value)}
                            rows={3}
                            className="w-full p-3 border-2 border-blue-400 rounded-xl text-base font-bold text-slate-800 focus:outline-none resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => { savolniYangilash(idx, { savol: tahrirlashMatn }); setTahrirlashSavolIdx(null); }} className="bg-green-600 text-white rounded-xl">
                              <Check className="h-3 w-3 mr-1" /> Saqlash
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTahrirlashSavolIdx(null)} className="rounded-xl">Bekor</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <div className="text-base font-bold text-slate-800 test-content pr-8" dangerouslySetInnerHTML={{ __html: s.savol }} />
                          <button onClick={() => { setTahrirlashSavolIdx(idx); setTahrirlashVariantIdx(null); setTahrirlashMatn(s.savol.replace(/<[^>]+>/g, '')); }}
                            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded-lg transition-all text-blue-500">
                            <Edit3 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Variantlar */}
                    <div className="grid grid-cols-1 gap-2">
                      {s.variantlar.map((v, vi) => (
                        <div key={vi} className={`group relative p-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${s.togriJavob === vi ? 'border-green-500 bg-green-50' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}>
                          <span onClick={() => { const n = [...savollar]; n[idx].togriJavob = vi; setSavollar(n); }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black cursor-pointer transition-all shrink-0 ${s.togriJavob === vi ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-green-200'}`}>
                            {String.fromCharCode(65+vi)}
                          </span>
                          {tahrirlashSavolIdx === idx && tahrirlashVariantIdx === vi ? (
                            <div className="flex-1 flex gap-2">
                              <input
                                value={tahrirlashMatn}
                                onChange={e => setTahrirlashMatn(e.target.value)}
                                className="flex-1 p-2 border-2 border-blue-400 rounded-xl text-sm font-semibold focus:outline-none"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => { variantniYangilash(idx, vi, tahrirlashMatn); setTahrirlashSavolIdx(null); setTahrirlashVariantIdx(null); }} className="bg-green-600 text-white rounded-xl px-2">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => { setTahrirlashSavolIdx(null); setTahrirlashVariantIdx(null); }} className="rounded-xl px-2">
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-semibold text-slate-700 flex-1 test-content" dangerouslySetInnerHTML={{ __html: v }} />
                              <button onClick={() => { setTahrirlashSavolIdx(idx); setTahrirlashVariantIdx(vi); setTahrirlashMatn(v.replace(/<[^>]+>/g, '')); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 rounded-lg transition-all text-blue-500 shrink-0">
                                <Edit3 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Izoh va Link tahrirlash */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                        <MessageSquare className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <input
                          placeholder="Izoh (ixtiyoriy)..."
                          value={s.izoh || ''}
                          onChange={e => savolniYangilash(idx, { izoh: e.target.value || undefined })}
                          className="flex-1 bg-transparent text-xs text-violet-700 font-medium outline-none placeholder:text-violet-300"
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <Link2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <input
                          placeholder="https://lex.uz/uz/ (ixtiyoriy)"
                          value={s.link || ''}
                          onChange={e => savolniYangilash(idx, { link: e.target.value || undefined })}
                          className="flex-1 bg-transparent text-xs text-amber-700 font-medium outline-none placeholder:text-amber-300"
                        />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSavollar(savollar.filter((_, i) => i !== idx))} className="p-2 text-slate-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 size={18} />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* YANGI SAVOL QO'SHISH */}
          {tahrirlashRejimi && (
            <button
              onClick={() => setSavollar(prev => [...prev, { savol: 'Yangi savol', variantlar: ['Variant A', 'Variant B', 'Variant C', 'Variant D'], togriJavob: 0, vaqt_sekund: 30 }])}
              className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-blue-300 rounded-[2rem] text-blue-500 font-black hover:bg-blue-50 transition-all"
            >
              <Plus className="h-5 w-5" /> Yangi savol qo'shish
            </button>
          )}
        </div>

        {/* PARAMETRLAR PANELI */}
        <div className="space-y-6">
           <Card className={`rounded-[2rem] shadow-2xl border-none bg-white overflow-hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto`}>
              <div className={`p-6 text-white ${tahrirlashRejimi ? 'bg-amber-500' : 'bg-blue-600'}`}>
                <Settings2 size={20} className="mb-2"/>
                <h3 className="font-black text-lg uppercase tracking-tighter">Parametrlar</h3>
                {savollar.length > 0 && <p className="text-white/70 text-xs mt-1">{savollar.length} ta savol</p>}
              </div>
              <CardContent className="p-6 space-y-5">
                <Input value={testNomi} onChange={e => setTestNomi(e.target.value)} placeholder="Test nomi..." className="h-12 rounded-2xl font-bold border-2 focus:border-blue-500" />
                
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setTimerTuri('individual')} className={`py-3 rounded-xl text-[10px] font-black border-2 transition-all ${timerTuri === 'individual' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'text-slate-400 border-slate-200 hover:border-blue-300'}`}>INDIVIDUAL</button>
                  <button onClick={() => setTimerTuri('umumiy')} className={`py-3 rounded-xl text-[10px] font-black border-2 transition-all ${timerTuri === 'umumiy' ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'text-slate-400 border-slate-200 hover:border-blue-300'}`}>UMUMIY</button>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center gap-4 text-2xl font-black text-blue-600">
                  <Clock className="h-6 w-6 shrink-0" />
                  <input type="number" value={timerTuri === 'umumiy' ? vaqtDaqiqa : savolSoniya} 
                    onChange={e => timerTuri === 'umumiy' ? setVaqtDaqiqa(Number(e.target.value)) : setSavolSoniya(Number(e.target.value))} 
                    className="bg-transparent w-full outline-none" />
                  <span className="text-xs text-slate-400 font-normal">{timerTuri === 'umumiy' ? 'daq.' : 'sek.'}</span>
                </div>

                {/* ── JAVOBLARNI KO'RSATISH ── */}
                <div className="space-y-3 border-t-2 border-slate-100 pt-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Test sozlamalari</p>
                  
                  <button onClick={() => setShowCorrectAnswers(!showCorrectAnswers)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${showCorrectAnswers ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <Eye className={`h-5 w-5 ${showCorrectAnswers ? 'text-green-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className={`text-xs font-black ${showCorrectAnswers ? 'text-green-700' : 'text-slate-600'}`}>To'g'ri javobni ko'rsatish</p>
                        <p className="text-[9px] text-slate-400">Test tugagach o'quvchiga</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all ${showCorrectAnswers ? 'bg-green-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${showCorrectAnswers ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  <button onClick={() => setAllowRetake(!allowRetake)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${allowRetake ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <RotateCcw className={`h-5 w-5 ${allowRetake ? 'text-blue-600' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className={`text-xs font-black ${allowRetake ? 'text-blue-700' : 'text-slate-600'}`}>Qayta ishlashga ruxsat</p>
                        <p className="text-[9px] text-slate-400">O'quvchi qayta kirishi mumkin</p>
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-all ${allowRetake ? 'bg-blue-500' : 'bg-slate-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${allowRetake ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                </div>

                <Button onClick={handleSaveTest} disabled={yuklanyapti || savollar.length === 0} 
                  className={`w-full h-16 rounded-[1.5rem] text-white font-black text-base shadow-xl transition-all ${tahrirlashRejimi ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-blue-600'}`}>
                  {yuklanyapti ? <Loader2 className="animate-spin h-5 w-5" /> : tahrirlashRejimi ? <><Save className="mr-2 h-5 w-5" />SAQLASH</> : 'JOYLASHTIRISH'}
                </Button>

                {tahrirlashRejimi && (
                  <Button onClick={onTahrirlashTugadi} variant="outline" className="w-full h-12 rounded-[1.5rem] font-black border-2">
                    Bekor qilish
                  </Button>
                )}
              </CardContent>
           </Card>
        </div>
      </div>

      {/* MAVJUD TESTLARDAN SAVOL OLISH MODALI */}
      {mavjudTestlarModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                {tanlanganMavjudTest ? (
                  <button onClick={() => { setTanlanganMavjudTest(null); setTanlanganSavollar(new Set()); }} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                    <ChevronRight className="h-5 w-5 rotate-180" />
                  </button>
                ) : null}
                <BookCopy className="h-6 w-6" />
                <div>
                  <p className="font-black text-lg">{tanlanganMavjudTest ? tanlanganMavjudTest.test_nomi : 'Mavjud testdan savol olish'}</p>
                  <p className="text-violet-200 text-xs">{tanlanganMavjudTest ? `${tanlanganMavjudTest.savollar?.length || 0} ta savol` : `${mavjudTestlar.length} ta test`}</p>
                </div>
              </div>
              <button onClick={() => { setMavjudTestlarModal(false); setTanlanganMavjudTest(null); setTanlanganSavollar(new Set()); setTestQidiruv(''); }} className="p-2 hover:bg-white/20 rounded-xl">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5">
              {!tanlanganMavjudTest ? (
                // TESTLAR RO'YHATI
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input placeholder="Test nomi bo'yicha qidirish..." value={testQidiruv} onChange={e => setTestQidiruv(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-violet-400 text-sm" />
                  </div>
                  {mavjudTestlarYuklanyapti ? (
                    <div className="py-12 text-center"><Loader2 className="animate-spin h-8 w-8 text-violet-500 mx-auto" /></div>
                  ) : mavjudTestlar.filter(t => t.test_nomi.toLowerCase().includes(testQidiruv.toLowerCase())).length === 0 ? (
                    <div className="py-12 text-center text-gray-400"><BookCopy className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Testlar topilmadi</p></div>
                  ) : (
                    mavjudTestlar.filter(t => t.test_nomi.toLowerCase().includes(testQidiruv.toLowerCase())).map((t: any) => (
                      <div key={t.id} onClick={() => { setTanlanganMavjudTest(t); setOlishSoni(Math.min(10, t.savollar?.length || 10)); setOlishRejimi('random'); setTanlanganSavollar(new Set()); }}
                        className="flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-violet-400 rounded-2xl cursor-pointer transition-all hover:bg-violet-50 group">
                        <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center font-black text-violet-600 text-sm flex-shrink-0">{t.savollar?.length || 0}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 truncate">{t.test_nomi}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Kod: {t.kod} · {t.vaqt_daqiqa} daqiqa · {new Date(t.created_at).toLocaleDateString('uz-UZ')}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-violet-500" />
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // SAVOL TANLASH REJIMI
                <div className="space-y-4">
                  {/* Rejim tanlash */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setOlishRejimi('random')} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${olishRejimi === 'random' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300'}`}>
                      <div className={`p-2 rounded-xl ${olishRejimi === 'random' ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'}`}><Shuffle className="h-5 w-5" /></div>
                      <div><p className="font-black text-sm">Random tanlash</p><p className="text-xs text-gray-400 mt-0.5">Avtomatik aralashtirish</p></div>
                    </button>
                    <button onClick={() => setOlishRejimi('tanlash')} className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${olishRejimi === 'tanlash' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                      <div className={`p-2 rounded-xl ${olishRejimi === 'tanlash' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}><ListChecks className="h-5 w-5" /></div>
                      <div><p className="font-black text-sm">Qo'lda tanlash</p><p className="text-xs text-gray-400 mt-0.5">O'zingiz belgilang</p></div>
                    </button>
                  </div>

                  {olishRejimi === 'random' && (
                    <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4">
                      <p className="text-sm font-bold text-violet-800 mb-3">Nechta savol olish kerak?</p>
                      <div className="flex items-center gap-4">
                        <input type="number" min={1} max={tanlanganMavjudTest.savollar?.length || 100} value={olishSoni}
                          onChange={e => setOlishSoni(Math.max(1, Math.min(tanlanganMavjudTest.savollar?.length || 100, Number(e.target.value))))}
                          className="w-24 px-4 py-3 border-2 border-violet-300 rounded-xl text-center text-2xl font-black text-violet-700 focus:outline-none focus:border-violet-500" />
                        <div className="flex-1">
                          <input type="range" min={1} max={tanlanganMavjudTest.savollar?.length || 100} value={olishSoni}
                            onChange={e => setOlishSoni(Number(e.target.value))}
                            className="w-full accent-violet-600" />
                          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>{tanlanganMavjudTest.savollar?.length || 0} (barchasi)</span></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Savollar ro'yhati */}
                  <div className="space-y-2">
                    {olishRejimi === 'tanlash' && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-gray-600">{tanlanganSavollar.size} ta tanlandi</p>
                        <div className="flex gap-2">
                          <button onClick={() => setTanlanganSavollar(new Set(tanlanganMavjudTest.savollar.map((_: any, i: number) => i)))}
                            className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-bold">Barchasini tanlash</button>
                          <button onClick={() => setTanlanganSavollar(new Set())}
                            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold">Tozalash</button>
                        </div>
                      </div>
                    )}
                    {(tanlanganMavjudTest.savollar || []).map((s: any, i: number) => {
                      const tanlangan = olishRejimi === 'tanlash' && tanlanganSavollar.has(i);
                      return (
                        <div key={i}
                          onClick={() => {
                            if (olishRejimi !== 'tanlash') return;
                            setTanlanganSavollar(prev => {
                              const n = new Set(prev);
                              n.has(i) ? n.delete(i) : n.add(i);
                              return n;
                            });
                          }}
                          className={`flex items-start gap-3 p-4 rounded-2xl border-2 transition-all ${
                            olishRejimi === 'tanlash' ? 'cursor-pointer ' : ''
                          }${tanlangan ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                          {olishRejimi === 'tanlash' && (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              tanlangan ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                            }`}>
                              {tanlangan && <Check className="h-3 w-3 text-white" />}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-800">{i + 1}. <span dangerouslySetInnerHTML={{ __html: s.savol }} /></p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {(s.variantlar || []).map((v: string, vi: number) => (
                                <span key={vi} className={`text-xs px-2 py-1 rounded-lg ${
                                  s.togriJavob === vi ? 'bg-green-100 text-green-700 font-bold border border-green-300' : 'bg-gray-100 text-gray-500'
                                }`}>{String.fromCharCode(65 + vi)}) <span dangerouslySetInnerHTML={{ __html: v }} /></span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {tanlanganMavjudTest && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 flex-shrink-0 flex gap-3">
                <Button onClick={() => { setTanlanganMavjudTest(null); setTanlanganSavollar(new Set()); }} variant="outline" className="h-12 px-6 rounded-2xl font-black">
                  <ChevronRight className="h-4 w-4 mr-2 rotate-180" /> Orqaga
                </Button>
                <Button onClick={mavjudTestdanSavollarOlish}
                  disabled={olishRejimi === 'tanlash' && tanlanganSavollar.size === 0}
                  className="flex-1 h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black">
                  {olishRejimi === 'random'
                    ? <><Shuffle className="h-4 w-4 mr-2" />{olishSoni} ta random savol qo'shish</>
                    : <><ListChecks className="h-4 w-4 mr-2" />{tanlanganSavollar.size} ta tanlangan savolni qo'shish</>}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .test-content table { border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd; }
        .test-content td, .test-content th { border: 1px solid #ddd; padding: 8px; }
      `}</style>
    </div>
  );
}
