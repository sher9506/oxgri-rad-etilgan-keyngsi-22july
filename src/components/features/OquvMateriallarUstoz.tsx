import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  BookOpen, Plus, Trash2, Edit3, ChevronDown, ChevronUp,
  Upload, FileText, Loader2, Layers, Check,
  RefreshCw, Eye, EyeOff, GripVertical, X, Save,
  FileCode, Bold, Italic, List, Type, Palette, Code2, Monitor,
  AlignLeft, Eye as EyeIcon, Music, Video, Film,
  ArrowUp, ArrowDown, EyeOff as EyeOffIcon, ChevronRight, ArrowLeft
} from 'lucide-react';
import { sendMaterialBotXabar } from '@/lib/botNotification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Bolim {
  id: string; ustoz_id: string; ustoz_ismi: string; nomi: string;
  tavsif?: string | null; faol: boolean; tartib: number;
  admin_bloklangan?: boolean; _boblar?: Bob[]; _korishlar_soni?: number;
}

interface Bob {
  id: string; bolim_id: string; parent_bob_id?: string | null; nomi: string; tartib: number;
  created_at: string; yashirin?: boolean; _materiallar?: Material[]; _child_boblar?: Bob[];
}

interface Material {
  id: string; bob_id: string; bolim_id: string; nomi: string;
  fayl_url: string; fayl_tur: string; fayl_hajm?: number; tartib: number;
}

// Kengaytirilgan fayl turlari
const QABUL_FAYLLAR = '.html,.htm,.pdf,.doc,.docx,.mp3,.wav,.ogg,.m4a,.mp4,.webm,.ogv,.mov';

function faylTurAniqlash(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['html','htm'].includes(ext!)) return 'html';
  if (ext === 'pdf') return 'pdf';
  if (['doc','docx'].includes(ext!)) return 'docx';
  if (['mp3','wav','ogg','m4a'].includes(ext!)) return 'audio';
  if (['mp4','webm','ogv','mov'].includes(ext!)) return 'video';
  return null;
}

function hajmFormat(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TUR_BADGE: Record<string, string> = {
  html: 'bg-orange-100 text-orange-700 border-orange-300',
  pdf: 'bg-red-100 text-red-700 border-red-300',
  docx: 'bg-blue-100 text-blue-700 border-blue-300',
  audio: 'bg-purple-100 text-purple-700 border-purple-300',
  video: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

function FaylIcon({ tur }: { tur: string }) {
  if (tur === 'audio') return <Music className="h-4 w-4 text-purple-500" />;
  if (tur === 'video') return <Film className="h-4 w-4 text-emerald-500" />;
  return <FileText className="h-4 w-4 text-gray-400" />;
}

// ── XAVFSIZ MEDIA PLEYER (yuklab bo'lmaydi) ──────────────────────────────
function MediaPlayer({ url, tur, nomi, onClose }: { url: string; tur: string; nomi: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {tur === 'audio' ? <Music className="h-5 w-5 text-purple-400" /> : <Film className="h-5 w-5 text-emerald-400" />}
            <div>
              <p className="text-white font-bold text-sm truncate max-w-xs">{nomi}</p>
              <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">
                {tur === 'audio' ? 'Audio Material' : 'Video Material'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Player body */}
        <div className="p-8 flex items-center justify-center">
          {tur === 'audio' ? (
            <div className="w-full space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-pulse">
                  <Music className="h-16 w-16 text-white" />
                </div>
              </div>
              <p className="text-center text-white font-bold text-lg">{nomi}</p>
              {/* Native audio with controls, no download */}
              <audio
                src={url}
                controls
                controlsList="nodownload"
                className="w-full"
                style={{ outline: 'none' }}
                onContextMenu={e => e.preventDefault()}
              />
            </div>
          ) : (
            <video
              src={url}
              controls
              controlsList="nodownload nofullscreen"
              className="w-full rounded-2xl max-h-[60vh]"
              style={{ outline: 'none' }}
              onContextMenu={e => e.preventDefault()}
            />
          )}
        </div>

        {/* Warning */}
        <div className="px-6 py-3 bg-amber-500/10 border-t border-amber-500/20 text-center">
          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">
            🔒 Faqat tinglash/ko'rish — yuklab olish taqiqlangan
          </p>
        </div>
      </div>
    </div>
  );
}

// ── VIZUAL MATN MUHARRIRI MODALI ───────────────────────────────────────────
function MaterialEditorModal({ material, onClose, onSaved }: { material: Material; onClose: () => void; onSaved: () => void }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<'visual' | 'code'>('visual');
  const editorRef = useRef<HTMLDivElement>(null);
  const isContentLoaded = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchContent = async () => {
      try {
        let text = '';
        if (material.fayl_tur === 'html') {
          const res = await fetch(material.fayl_url + (material.fayl_url.includes('?') ? '&' : '?') + 'v=' + Date.now());
          text = await res.text();
        } else if (material.fayl_tur === 'docx') {
          if (!(window as any).mammoth) {
            await new Promise((resolve) => {
              const script = document.createElement('script');
              script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
              script.onload = resolve;
              document.head.appendChild(script);
            });
          }
          const res = await fetch(material.fayl_url);
          const arrayBuffer = await res.arrayBuffer();
          const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
          text = result.value;
        }
        setContent(text);
        setLoading(false);
      } catch (e) {
        toast({ title: "Xato", description: "Faylni o'qib bo'lmadi", variant: "destructive" });
        onClose();
      }
    };
    fetchContent();
  }, [material]);

  useLayoutEffect(() => {
    if (!loading && editMode === 'visual' && editorRef.current && !isContentLoaded.current) {
      editorRef.current.innerHTML = content;
      isContentLoaded.current = true;
    }
  }, [editMode, loading, content]);

  const handleInput = () => {
    if (editorRef.current && editMode === 'visual') setContent(editorRef.current.innerHTML);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalContent = editMode === 'visual' && editorRef.current ? editorRef.current.innerHTML : content;
      const blob = new Blob([finalContent], { type: 'text/html' });
      const cleanName = material.nomi.replace(/\.[^.]+$/, '');
      const file = new File([blob], `${cleanName}.html`, { type: 'text/html' });
      const urlBase = '/storage/v1/object/public/oq-materiallar/';
      const urlParts = material.fayl_url.split(urlBase);
      let filePath = urlParts[1].split('?')[0];
      if (material.fayl_tur === 'docx') filePath = filePath.replace(/\.docx$/i, '.html');
      const { error: uploadErr } = await supabase.storage.from('oq-materiallar').upload(filePath, file, { upsert: true, cacheControl: '0' });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('oq-materiallar').getPublicUrl(filePath);
      await supabase.from('om_materiallar').update({ fayl_tur: 'html', fayl_url: urlData.publicUrl, fayl_hajm: file.size }).eq('id', material.id);
      toast({ title: "Muvaffaqiyatli saqlandi!" });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: "Xatolik", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-0 md:p-4">
      <Card className="w-full max-w-7xl h-full md:h-[95vh] flex flex-col shadow-2xl border-none md:border-2 md:border-blue-500 bg-white overflow-hidden rounded-none md:rounded-3xl">
        <CardHeader className="bg-slate-900 text-white p-0 flex-shrink-0">
          <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center"><FileCode className="h-6 w-6 text-white" /></div>
              <div className="min-w-0">
                <CardTitle className="text-lg leading-none truncate max-w-xs">{material.nomi}</CardTitle>
                <p className="text-[10px] text-slate-500 mt-1 uppercase font-black tracking-widest">
                  {material.fayl_tur === 'docx' ? "Wordni tahrirlash (HTMLga o'girildi)" : 'HTML Tahriri'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button onClick={() => { setEditMode('visual'); isContentLoaded.current = false; }} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${editMode === 'visual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>VIZUAL</button>
                <button onClick={() => setEditMode('code')} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${editMode === 'code' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>KOD</button>
              </div>
              <Button onClick={handleSave} disabled={saving || loading} className="bg-green-600 hover:bg-green-700 text-white font-black h-10 px-6 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} SAQLASH
              </Button>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="h-6 w-6 text-slate-400" /></button>
            </div>
          </div>
          {editMode === 'visual' && !loading && (
            <div className="px-6 py-2 bg-slate-800/50 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-white/5">
              <button onClick={() => execCommand('bold')} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-300"><Bold className="h-4 w-4" /></button>
              <button onClick={() => execCommand('italic')} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-300"><Italic className="h-4 w-4" /></button>
              <div className="w-px h-5 bg-white/10 mx-2" />
              <button onClick={() => execCommand('insertUnorderedList')} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-300"><List className="h-4 w-4" /></button>
              <button onClick={() => execCommand('formatBlock', 'h2')} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-300 text-xs font-black">H2</button>
              <button onClick={() => execCommand('formatBlock', 'p')} className="p-2.5 hover:bg-white/10 rounded-xl text-slate-300"><Type className="h-4 w-4" /></button>
              <div className="w-px h-5 bg-white/10 mx-2" />
              <button onClick={() => execCommand('foreColor', '#e11d48')} className="p-2.5 hover:bg-white/10 rounded-xl text-rose-500"><Palette className="h-4 w-4" /></button>
              <button onClick={() => execCommand('foreColor', '#2563eb')} className="p-2.5 hover:bg-white/10 rounded-xl text-blue-500"><Palette className="h-4 w-4" /></button>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden bg-slate-50 flex justify-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-2" /><p className="text-sm font-bold text-slate-500">YUKLANMOQDA...</p></div>
          ) : (
            <div className="w-full h-full overflow-y-auto p-4 md:p-12 flex flex-col items-center custom-scrollbar">
              <div className={`w-full max-w-[210mm] min-h-full bg-white shadow-2xl p-[15mm] md:p-[20mm] outline-none prose prose-slate max-w-none border border-slate-200 ${editMode !== 'visual' ? 'hidden' : 'block'}`}
                ref={editorRef} contentEditable onInput={handleInput}
                style={{ fontFamily: 'Times New Roman, serif', minHeight: '1000px' }} />
              {editMode === 'code' && (
                <textarea value={content} onChange={(e) => setContent(e.target.value)}
                  className="w-full h-full p-8 font-mono text-sm border-none outline-none resize-none bg-[#1e1e1e] text-emerald-400 min-h-full rounded-2xl" spellCheck={false} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <style>{`.prose h2 { border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-top: 2rem; color: #0f172a; } .prose p { margin-bottom: 1.2rem; line-height: 1.7; font-size: 11pt; } .custom-scrollbar::-webkit-scrollbar { width: 8px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }`}</style>
    </div>
  );
}

// ── BOB KOMPONENTI (rekursiv) ──────────────────────────────────────────────
function BobCard({
  bob, bolimId, onYangilandi,
  canMoveUp, canMoveDown, onMoveUp, onMoveDown, depth,
  bolimNomi, ustozIsmi, bolimTavsif
}: {
  bob: Bob; bolimId: string; onYangilandi: () => void;
  canMoveUp: boolean; canMoveDown: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  depth?: number;
  bolimNomi?: string; ustozIsmi?: string; bolimTavsif?: string;
}) {
  const level = depth || 0;
  const [ochiq, setOchiq] = useState(false);
  const [yangiNom, setYangiNom] = useState('');
  const [tahrirlash, setTahrirlash] = useState(false);
  const [faylYuklanyapti, setFaylYuklanyapti] = useState(false);
  const [ochirYuklanyapti, setOchirYuklanyapti] = useState<string | null>(null);
  const [tahrirMaterial, setTahrirMaterial] = useState<Material | null>(null);
  const [mediaPlayer, setMediaPlayer] = useState<Material | null>(null);
  const [yashirishYuklanyapti, setYashirishYuklanyapti] = useState(false);
  const [ichkiBobNomi, setIchkiBobNomi] = useState('');
  const [ichkiBobQoshYuklanyapti, setIchkiBobQoshYuklanyapti] = useState(false);
  const [ichkiBobForma, setIchkiBobForma] = useState(false);
  const faylInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const materialQoshish = async (file: File, bolimNomi?: string, ustozIsmi?: string, tavsif?: string) => {
    const tur = faylTurAniqlash(file);
    if (!tur) {
      toast({ title: "Noto'g'ri fayl turi", description: "Word, HTML, PDF, Audio yoki Video fayllarni yuklang", variant: 'destructive' });
      return;
    }
    setFaylYuklanyapti(true);
    try {
      const path = `${bolimId}/${bob.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from('oq-materiallar').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('oq-materiallar').getPublicUrl(path);
      const materialNomi = file.name.replace(/\.[^.]+$/, '');
      await supabase.from('om_materiallar').insert({
        bob_id: bob.id, bolim_id: bolimId,
        nomi: materialNomi,
        fayl_url: urlData.publicUrl, fayl_tur: tur,
        fayl_hajm: file.size, tartib: (bob._materiallar?.length || 0),
      });
      toast({ title: `✅ ${tur === 'audio' ? 'Audio' : tur === 'video' ? 'Video' : 'Fayl'} saqlandi` });
      onYangilandi();

      // Bot xabari yuborish (fon rejimida, xato bo'lsa ham davom etadi)
      sendMaterialBotXabar({
        bolimNomi: bolimNomi || 'Noma\'lum bo\'lim',
        bobNomi: bob.nomi,
        materialNomi,
        faylTur: tur,
        faylHajm: file.size,
        ustozIsmi: ustozIsmi || 'Ustoz',
        tavsif,
      }).catch((e) => console.warn('Bot xabar yuborishda xato:', e));
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setFaylYuklanyapti(false); }
  };

  const materialOchir = async (mat: Material) => {
    if (!confirm(`"${mat.nomi}" o'chirilsinmi?`)) return;
    setOchirYuklanyapti(mat.id);
    try {
      await supabase.from('om_materiallar').delete().eq('id', mat.id);
      onYangilandi();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setOchirYuklanyapti(null); }
  };

  const handleBobOchir = async () => {
    if (!confirm(`"${bob.nomi}" bobini o'chirmoqchimisiz?`)) return;
    try {
      await supabase.from('om_boblar').delete().eq('id', bob.id);
      onYangilandi();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
  };

  const ichkiBobQosh = async () => {
    if (!ichkiBobNomi.trim()) return;
    setIchkiBobQoshYuklanyapti(true);
    try {
      // om_boblar jadvaliga parent_bob_id ustunini qo'shish kerak
      await supabase.from('om_boblar').insert({
        bolim_id: bolimId,
        parent_bob_id: bob.id,
        nomi: ichkiBobNomi.trim(),
        tartib: (bob._child_boblar?.length || 0),
      });
      setIchkiBobNomi('');
      setIchkiBobForma(false);
      onYangilandi();
      toast({ title: "Ichki bob qo'shildi" });
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setIchkiBobQoshYuklanyapti(false); }
  };

  const bobNomSaqla = async () => {
    if (!yangiNom.trim()) return;
    await supabase.from('om_boblar').update({ nomi: yangiNom.trim() }).eq('id', bob.id);
    setTahrirlash(false);
    onYangilandi();
  };

  const bobYashirishToggle = async () => {
    setYashirishYuklanyapti(true);
    try {
      await supabase.from('om_boblar').update({ yashirin: !bob.yashirin }).eq('id', bob.id);
      onYangilandi();
      toast({
        title: bob.yashirin ? '✅ Bob ko\'rinishi tiklandi' : '🙈 Bob yashirildi',
        description: bob.yashirin ? 'O\'quvchilar ushbu bobni ko\'ra oladi' : 'O\'quvchilar ushbu bobni ko\'rmaydi'
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setYashirishYuklanyapti(false); }
  };

  const depthColors = [
    { bg: 'bg-indigo-50/50', border: 'border-indigo-100', hover: 'hover:border-indigo-300', text: 'text-indigo-900', accent: 'bg-indigo-600', badge: 'bg-indigo-100 text-indigo-700', ml: '' },
    { bg: 'bg-violet-50/50', border: 'border-violet-100', hover: 'hover:border-violet-300', text: 'text-violet-900', accent: 'bg-violet-600', badge: 'bg-violet-100 text-violet-700', ml: 'ml-4' },
    { bg: 'bg-blue-50/50', border: 'border-blue-100', hover: 'hover:border-blue-300', text: 'text-blue-900', accent: 'bg-blue-600', badge: 'bg-blue-100 text-blue-700', ml: 'ml-8' },
    { bg: 'bg-teal-50/50', border: 'border-teal-100', hover: 'hover:border-teal-300', text: 'text-teal-900', accent: 'bg-teal-600', badge: 'bg-teal-100 text-teal-700', ml: 'ml-12' },
  ];
  const dc = depthColors[Math.min(level, depthColors.length - 1)];

  return (
    <div className={`border-2 ${dc.border} ${dc.hover} rounded-2xl overflow-hidden bg-white mb-2 shadow-sm transition-all ${dc.ml}`}>
      <div className={`flex items-center gap-3 px-4 py-3 ${dc.bg}`}>
        {/* Tartib almashish tugmalari */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onMoveUp(); }}
            disabled={!canMoveUp}
            className="p-0.5 rounded hover:bg-indigo-200 disabled:opacity-20 transition-colors text-indigo-500"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMoveDown(); }}
            disabled={!canMoveDown}
            className="p-0.5 rounded hover:bg-indigo-200 disabled:opacity-20 transition-colors text-indigo-500"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
        <GripVertical className="h-4 w-4 text-indigo-300 flex-shrink-0" />
        {level > 0 && <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dc.accent}`} />}
        {tahrirlash ? (
          <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
            <Input value={yangiNom || bob.nomi} onChange={e => setYangiNom(e.target.value)} className="h-8 text-sm" autoFocus />
            <button onClick={bobNomSaqla} className="p-1.5 bg-green-500 text-white rounded-lg"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setTahrirlash(false)} className="p-1.5 bg-gray-300 rounded-lg"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <p className={`flex-1 font-bold text-sm cursor-pointer ${bob.yashirin ? 'text-gray-400 line-through' : dc.text}`} 
             onClick={() => setOchiq(!ochiq)}>
            {bob.nomi}
            {level > 0 && <span className={`ml-1.5 text-[8px] font-black px-1 py-0.5 rounded ${dc.badge}`}>ichki bob</span>}
            {bob.yashirin && <span className="ml-2 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full normal-case no-underline" style={{textDecoration:'none'}}>YASHIRIN</span>}
          </p>
        )}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {/* Yashirish/Ko'rsatish tugmasi */}
          <button
            onClick={bobYashirishToggle}
            disabled={yashirishYuklanyapti}
            className={`p-1.5 rounded-lg transition-all ${
              bob.yashirin
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-600'
                : 'hover:bg-indigo-200 text-indigo-400'
            }`}
            title={bob.yashirin ? 'Ko\'rinishini tiklash' : 'Yashirish'}
          >
            {yashirishYuklanyapti
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : bob.yashirin
                ? <Eye className="h-3.5 w-3.5" />
                : <EyeOff className="h-3.5 w-3.5" />
            }
          </button>
          <button onClick={() => { setTahrirlash(true); setYangiNom(bob.nomi); }} className="p-1.5 hover:bg-indigo-200 rounded-lg text-indigo-500"><Edit3 className="h-3.5 w-3.5" /></button>
          <button onClick={handleBobOchir} className="p-1.5 hover:bg-red-100 rounded-lg text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        <div className="cursor-pointer" onClick={() => setOchiq(!ochiq)}>
          {ochiq ? <ChevronUp className="h-4 w-4 text-indigo-400" /> : <ChevronDown className="h-4 w-4 text-indigo-400" />}
        </div>
      </div>

      {ochiq && (
        <div className="p-3 space-y-2">
          {/* Ichki boblar (rekursiv) */}
          {(bob._child_boblar || []).length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Ichki boblar</p>
              {(bob._child_boblar || []).map((child, ci) => (
                <BobCard
                  key={child.id}
                  bob={child}
                  bolimId={bolimId}
                  onYangilandi={onYangilandi}
                  canMoveUp={ci > 0}
                  canMoveDown={ci < (bob._child_boblar?.length || 1) - 1}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  depth={level + 1}
                  bolimNomi={bolimNomi}
                  ustozIsmi={ustozIsmi}
                  bolimTavsif={bolimTavsif}
                />
              ))}
            </div>
          )}
          {bob._materiallar?.map(mat => (
            <div key={mat.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 transition-all group">
              <FaylIcon tur={mat.fayl_tur} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{mat.nomi}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${TUR_BADGE[mat.fayl_tur] || 'bg-gray-100'}`}>{mat.fayl_tur}</span>
                  {mat.fayl_hajm && <span className="text-[9px] text-gray-400">{hajmFormat(mat.fayl_hajm)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {(mat.fayl_tur === 'html' || mat.fayl_tur === 'docx') && (
                  <button onClick={() => setTahrirMaterial(mat)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"><Edit3 className="h-4 w-4" /></button>
                )}
                {(mat.fayl_tur === 'audio' || mat.fayl_tur === 'video') && (
                  <button onClick={() => setMediaPlayer(mat)} className={`p-1.5 text-white rounded-lg transition-all ${mat.fayl_tur === 'audio' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                    {mat.fayl_tur === 'audio' ? <Music className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                  </button>
                )}
                {(mat.fayl_tur === 'html' || mat.fayl_tur === 'pdf') && (
                  <a href={mat.fayl_url} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"><Eye className="h-4 w-4" /></a>
                )}
                <button onClick={() => materialOchir(mat)} disabled={ochirYuklanyapti === mat.id} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all">
                  {ochirYuklanyapti === mat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <input
            ref={faylInputRef}
            type="file"
            accept={QABUL_FAYLLAR}
            className="hidden"
            multiple
            onChange={async e => {
              const files = Array.from(e.target.files || []);
              for (const file of files) await materialQoshish(file, bolimNomi, ustozIsmi, bolimTavsif);
              e.target.value = '';
            }}
          />
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => faylInputRef.current?.click()}
              disabled={faylYuklanyapti}
              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-400 transition-all text-xs font-black uppercase tracking-widest bg-slate-50/50 flex items-center justify-center gap-2"
            >
              {faylYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              FAYL YUKLASH (WORD · HTML · PDF · AUDIO · VIDEO)
            </button>
            {/* Ichki bob qo'shish */}
            {!ichkiBobForma ? (
              <button onClick={() => setIchkiBobForma(true)}
                className="w-full py-2.5 border-2 border-dashed border-violet-200 rounded-xl text-violet-400 hover:text-violet-600 hover:border-violet-400 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                <Plus className="h-3.5 w-3.5" /> ICHKI BOB QO'SHISH
              </button>
            ) : (
              <div className="flex gap-2">
                <input value={ichkiBobNomi} onChange={e => setIchkiBobNomi(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') ichkiBobQosh(); if (e.key === 'Escape') { setIchkiBobForma(false); setIchkiBobNomi(''); } }}
                  placeholder="Ichki bob nomi..." autoFocus
                  className="flex-1 px-3 py-2 border-2 border-violet-300 rounded-xl text-sm focus:outline-none focus:border-violet-500" />
                <button onClick={ichkiBobQosh} disabled={ichkiBobQoshYuklanyapti || !ichkiBobNomi.trim()}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold">
                  {ichkiBobQoshYuklanyapti ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => { setIchkiBobForma(false); setIchkiBobNomi(''); }}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl text-xs">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tahrirMaterial && (
        <MaterialEditorModal
          material={tahrirMaterial}
          onClose={() => setTahrirMaterial(null)}
          onSaved={() => { onYangilandi(); setTahrirMaterial(null); }}
        />
      )}

      {mediaPlayer && (
        <MediaPlayer
          url={mediaPlayer.fayl_url}
          tur={mediaPlayer.fayl_tur}
          nomi={mediaPlayer.nomi}
          onClose={() => setMediaPlayer(null)}
        />
      )}
    </div>
  );
}

// ── BO'LIM KOMPONENTI ──────────────────────────────────────────────────────
function BolimCard({ bolim, onYangilandi }: { bolim: Bolim; onYangilandi: () => void }) {
  const [ochiq, setOchiq] = useState(false);
  const [yangiNom, setYangiNom] = useState('');
  const [yangiNomInput, setYangiNomInput] = useState(false);
  const [tavsifInput, setTavsifInput] = useState(false);
  const [yangiTavsif, setYangiTavsif] = useState(bolim.tavsif || '');
  const [bobNomi, setBobNomi] = useState('');
  const [bobQoshYuklanyapti, setBobQoshYuklanyapti] = useState(false);
  const [faolToggleYuklanyapti, setFaolToggleYuklanyapti] = useState(false);
  const [boblar, setBoblar] = useState<Bob[]>(bolim._boblar || []);
  const { toast } = useToast();

  useEffect(() => { setBoblar(bolim._boblar || []); }, [bolim._boblar]);

  const sozlarSoni = yangiTavsif.trim().split(/\s+/).filter(Boolean).length;
  const MAX_SOZ = 30;
  const adminBloklangan = bolim.admin_bloklangan;

  const faollashtir = async () => {
    if (adminBloklangan) {
      toast({ title: 'Bloklangan', description: "Admin bu bo'limni bloklagan.", variant: 'destructive' });
      return;
    }
    setFaolToggleYuklanyapti(true);
    try {
      await supabase.from('om_bolimlar').update({ faol: !bolim.faol }).eq('id', bolim.id);
      onYangilandi();
    } finally { setFaolToggleYuklanyapti(false); }
  };

  const bolimOchir = async () => {
    if (!confirm(`"${bolim.nomi}" bo'limini o'chirmoqchimisiz?`)) return;
    try {
      await supabase.from('om_bolimlar').delete().eq('id', bolim.id);
      onYangilandi();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
  };

  const nomSaqla = async () => {
    if (!yangiNom.trim()) return;
    await supabase.from('om_bolimlar').update({ nomi: yangiNom.trim() }).eq('id', bolim.id);
    setYangiNomInput(false);
    onYangilandi();
  };

  const tavsifSaqla = async () => {
    if (sozlarSoni > MAX_SOZ) {
      toast({ title: 'Xato', description: `Tavsif ${MAX_SOZ} ta so'zdan oshmasligi kerak`, variant: 'destructive' });
      return;
    }
    await supabase.from('om_bolimlar').update({ tavsif: yangiTavsif.trim() || null }).eq('id', bolim.id);
    setTavsifInput(false);
    onYangilandi();
    toast({ title: 'Tavsif saqlandi' });
  };

  const bobQosh = async () => {
    if (!bobNomi.trim()) return;
    setBobQoshYuklanyapti(true);
    try {
      await supabase.from('om_boblar').insert({
        bolim_id: bolim.id, nomi: bobNomi.trim(), tartib: boblar.length,
      });
      setBobNomi('');
      onYangilandi();
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setBobQoshYuklanyapti(false); }
  };

  // Bob tartibini almashtirish
  const boblarniAlmashtirish = async (idx: number, yo: 'up' | 'down') => {
    const yangi = [...boblar];
    const swapWith = yo === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= yangi.length) return;

    // Swap locally for instant UI feedback
    [yangi[idx], yangi[swapWith]] = [yangi[swapWith], yangi[idx]];
    setBoblar(yangi);

    // Persist to DB
    const updates = yangi.map((b, i) => supabase.from('om_boblar').update({ tartib: i }).eq('id', b.id));
    await Promise.all(updates);
    onYangilandi();
  };

  return (
    <Card className={`border-2 transition-all overflow-hidden mb-5 rounded-[2rem] ${
      adminBloklangan ? 'border-red-400 opacity-80' : bolim.faol ? 'border-blue-400 shadow-xl shadow-blue-50' : 'border-slate-200 shadow-sm'
    }`}>
      <div className={`flex items-center gap-3 px-6 py-5 ${
        adminBloklangan ? 'bg-red-500 text-white' : bolim.faol ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
      }`}>
        {yangiNomInput ? (
          <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
            <Input value={yangiNom || bolim.nomi} onChange={e => setYangiNom(e.target.value)} className="h-10 text-sm bg-white text-gray-900 font-bold rounded-xl" autoFocus />
            <button onClick={nomSaqla} className="p-2 bg-green-500 text-white rounded-xl"><Check className="h-4 w-4" /></button>
            <button onClick={() => setYangiNomInput(false)} className="p-2 bg-white/20 rounded-xl"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex-1 cursor-pointer" onClick={() => setOchiq(!ochiq)}>
            <h3 className="font-black text-lg uppercase tracking-tight leading-tight">{bolim.nomi}</h3>
            <div className="flex items-center gap-3 mt-1 opacity-70">
              <p className="text-[10px] font-black tracking-widest">{boblar.length} TA BOB</p>
              {bolim._korishlar_soni !== undefined && (
                <p className="text-[10px] font-black tracking-widest flex items-center gap-1">
                  <EyeIcon className="h-3 w-3" /> {bolim._korishlar_soni} ko'rish
                </p>
              )}
              {adminBloklangan && <span className="text-[10px] font-black tracking-widest bg-white/20 px-2 py-0.5 rounded">🔒 ADMIN BLOKLAGAN</span>}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setTavsifInput(!tavsifInput); setYangiTavsif(bolim.tavsif || ''); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black bg-white/20 hover:bg-white/30 transition-all"
          >
            <AlignLeft className="h-3.5 w-3.5" />
            {bolim.tavsif ? 'TAVSIF' : "TAVSIF QO'SH"}
          </button>

          {!adminBloklangan ? (
            <button onClick={faollashtir} disabled={faolToggleYuklanyapti}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black transition-all ${bolim.faol ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white text-slate-700'}`}>
              {faolToggleYuklanyapti ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : bolim.faol ? <><Eye className="h-3.5 w-3.5" /> FAOL</> : <><EyeOff className="h-3.5 w-3.5" /> NOFAOL</>}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black bg-white/10 text-white/60">🔒 BLOKLANGAN</div>
          )}

          <button onClick={() => { setYangiNomInput(true); setYangiNom(bolim.nomi); }} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"><Edit3 className="h-4 w-4" /></button>
          <button onClick={bolimOchir} className="p-2.5 hover:bg-red-500/20 rounded-xl transition-colors"><Trash2 className="h-4 w-4" /></button>
          <button onClick={() => setOchiq(!ochiq)} className="p-2.5 hover:bg-white/10 rounded-xl transition-all">
            {ochiq ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {tavsifInput && (
        <div className="px-6 py-4 bg-amber-50 border-b border-amber-200">
          <label className="text-xs font-bold text-amber-800 mb-1.5 flex items-center justify-between">
            <span>Bo'lim tavsifi (o'quvchilarga ko'rinadi)</span>
            <span className={`font-black ${sozlarSoni > MAX_SOZ ? 'text-red-600' : 'text-amber-600'}`}>{sozlarSoni}/{MAX_SOZ} so'z</span>
          </label>
          <div className="flex gap-2">
            <textarea value={yangiTavsif} onChange={e => setYangiTavsif(e.target.value)}
              placeholder="Bu bo'lim haqida qisqacha tavsif (max 30 so'z)..."
              className="flex-1 px-4 py-2.5 border-2 border-amber-300 rounded-xl text-sm resize-none focus:outline-none focus:border-amber-500 bg-white" rows={2} />
            <div className="flex flex-col gap-1.5">
              <button onClick={tavsifSaqla} disabled={sozlarSoni > MAX_SOZ} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black disabled:opacity-50"><Check className="h-4 w-4" /></button>
              <button onClick={() => setTavsifInput(false)} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-white rounded-xl text-xs font-black"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {ochiq && !adminBloklangan && (
        <CardContent className="pt-6 pb-6 space-y-5 bg-slate-50/30 px-6">
          <div className="flex gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
            <Input placeholder="Yangi bob nomi (masalan: 1-mavzu. Kirish)..." value={bobNomi} onChange={e => setBobNomi(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && bobQosh()} className="border-none shadow-none focus-visible:ring-0 font-bold text-sm" />
            <Button onClick={bobQosh} disabled={!bobNomi.trim() || bobQoshYuklanyapti}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl px-6 h-10">
              {bobQoshYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} YARATISH
            </Button>
          </div>
          <div className="space-y-1">
            {boblar.map((bob, idx) => (
              <BobCard
                key={bob.id}
                bob={bob}
                bolimId={bolim.id}
                onYangilandi={onYangilandi}
                canMoveUp={idx > 0}
                canMoveDown={idx < boblar.length - 1}
                onMoveUp={() => boblarniAlmashtirish(idx, 'up')}
                onMoveDown={() => boblarniAlmashtirish(idx, 'down')}
                bolimNomi={bolim.nomi}
                ustozIsmi={bolim.ustoz_ismi}
                bolimTavsif={bolim.tavsif || ''}
              />
            ))}
          </div>
        </CardContent>
      )}

      {ochiq && adminBloklangan && (
        <CardContent className="pt-6 pb-6 px-6">
          <div className="text-center py-8 text-red-400">
            <div className="text-4xl mb-3">🔒</div>
            <p className="font-bold text-sm">Bu bo'lim admin tomonidan bloklangan</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── ASOSIY USTOZ KOMPONENTI ────────────────────────────────────────────────
export default function OquvMateriallarUstoz() {
  const { user } = useAuth();
  const [bolimlar, setBolimlar] = useState<Bolim[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [yangiNom, setYangiNom] = useState('');
  const [qoshYuklanyapti, setQoshYuklanyapti] = useState(false);
  const { toast } = useToast();

  useEffect(() => { yuklash(); }, [user]);

  const yuklash = async () => {
    if (!user?.ustoz_id) return;
    setYuklanmoqda(true);
    try {
      const { data: bData } = await supabase.from('om_bolimlar').select('*').eq('ustoz_id', user.ustoz_id).order('tartib', { ascending: true });
      if (!bData) { setBolimlar([]); return; }

      const { data: allBobs } = await supabase.from('om_boblar').select('*').order('tartib', { ascending: true });
      const { data: allMats } = await supabase.from('om_materiallar').select('*').order('tartib', { ascending: true });

      const bolimIds = bData.map((b: any) => b.id);
      const { data: korishlarData } = await supabase.from('om_korishlar').select('bolim_id').in('bolim_id', bolimIds);

      const korishlarMap: Record<string, number> = {};
      (korishlarData || []).forEach((k: any) => {
        korishlarMap[k.bolim_id] = (korishlarMap[k.bolim_id] || 0) + 1;
      });

      // Rekursiv bob qurilmasi
      const buildBobTree = (parentId: string | null, bolimId: string): Bob[] => {
        const bobs = (allBobs || []).filter((b: any) => 
          b.bolim_id === bolimId && 
          (parentId === null ? (!b.parent_bob_id) : b.parent_bob_id === parentId)
        );
        return bobs.map((bob: any) => ({
          ...bob,
          _materiallar: (allMats || []).filter((m: any) => m.bob_id === bob.id),
          _child_boblar: buildBobTree(bob.id, bolimId)
        }));
      };

      const enriched = bData.map((b: Bolim) => {
        const bobs = buildBobTree(null, b.id);
        return { ...b, _boblar: bobs, _korishlar_soni: korishlarMap[b.id] || 0 };
      });
      setBolimlar(enriched);
    } finally { setYuklanmoqda(false); }
  };

  const bolimQosh = async () => {
    if (!yangiNom.trim() || !user?.ustoz_id) return;
    setQoshYuklanyapti(true);
    try {
      await supabase.from('om_bolimlar').insert({
        ustoz_id: user.ustoz_id,
        ustoz_ismi: `${user.ism} ${user.familiya}`,
        nomi: yangiNom.trim(), faol: false,
        tartib: bolimlar.length, admin_bloklangan: false,
      });
      setYangiNom('');
      await yuklash();
      toast({ title: "Bo'lim muvaffaqiyatli yaratildi" });
    } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
    finally { setQoshYuklanyapti(false); }
  };

  if (!user || user.rol !== 'ustoz') return (
    <div className="flex items-center justify-center h-[60vh] px-6 text-center">
      <div className="bg-white p-10 rounded-3xl border border-slate-100 shadow-xl">
        <p className="font-black text-slate-400 uppercase tracking-widest text-lg">Iltimos, Ustoz hisobi bilan kiring</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="bg-white rounded-[2rem] p-7 shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-xl shadow-blue-200">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">O'quv Materiallari</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
              Materiallar Boshqaruvi · Word · HTML · PDF · Audio · Video
            </p>
          </div>
        </div>
        <button onClick={yuklash} className="p-3.5 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-2xl transition-all border border-slate-100">
          <RefreshCw className={`h-5 w-5 ${yuklanmoqda ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Media format qo'llab-quvvatlash haqida eslatma */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 flex items-start gap-3">
        <Music className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-purple-800">Qo'llab-quvvatlanadigan fayl turlari:</p>
          <p className="text-xs text-purple-600 mt-0.5 leading-relaxed">
            📄 <b>Matn:</b> Word (.docx), HTML, PDF &nbsp;|&nbsp; 🎵 <b>Audio:</b> MP3, WAV, OGG, M4A &nbsp;|&nbsp; 🎬 <b>Video:</b> MP4, WebM, MOV
            <br />O'quvchilar audio/videoni faqat tinglaydi/ko'radi — yuklab ola olmaydi.
          </p>
        </div>
      </div>

      <Card className="border-2 border-blue-500 rounded-[2rem] shadow-xl shadow-blue-50 overflow-hidden bg-slate-900">
        <div className="p-4 bg-gradient-to-r from-blue-600/10 to-indigo-700/10 flex gap-3 items-center">
          <Layers className="h-6 w-6 text-blue-400 ml-2" />
          <Input
            placeholder="BO'LIM NOMI (MASALAN: 1-BO'LIM. KIRISH)..."
            value={yangiNom} onChange={e => setYangiNom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && bolimQosh()}
            className="bg-white/10 border-white/20 h-12 font-bold text-white placeholder:text-white/30 rounded-xl px-5"
          />
          <Button onClick={bolimQosh} disabled={!yangiNom.trim() || qoshYuklanyapti} className="bg-white text-blue-600 hover:bg-slate-100 font-black rounded-xl h-12 px-8">
            {qoshYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : 'YARATISH'}
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {bolimlar.length === 0 && !yuklanmoqda ? (
          <div className="py-20 text-center opacity-20">
            <BookOpen className="h-16 w-16 mx-auto mb-4" />
            <p className="font-black text-sm uppercase tracking-widest text-slate-500">Hozircha bo'limlar yo'q</p>
          </div>
        ) : (
          bolimlar.map(b => <BolimCard key={b.id} bolim={b} onYangilandi={yuklash} />)
        )}
      </div>
    </div>
  );
}
