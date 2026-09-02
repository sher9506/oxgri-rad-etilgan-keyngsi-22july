/**
 * KurslarUstoz — Ustoz uchun kurs boshqaruv paneli
 * Yangilangan: fayl yuklash tuzatildi + chiroyli ta'lim dizayni
 */

import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, Plus, Trash2, Edit3, ChevronRight, ChevronDown,
  X, Loader2, Youtube, FileText, Headphones, Globe,
  Eye, EyeOff, Upload, CheckCircle, Play, Layers,
  GraduationCap, Sparkles, BookMarked, Video, Music,
  FolderOpen, Zap, Star, Award, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Kurs { id: string; nomi: string; tavsif: string | null; rasm_url: string | null; ustoz_id: string; ustoz_ismi: string; faol: boolean; tartib: number; created_at: string; }
interface Modul { id: string; kurs_id: string; nomi: string; tavsif: string | null; tartib: number; faol: boolean; }
interface Dars { id: string; modul_id: string; kurs_id: string; nomi: string; tavsif: string | null; tartib: number; }
interface Kontent { id: string; dars_id: string; tur: string; nomi: string; kontent_url: string | null; youtube_id: string | null; matn_kontent: string | null; tartib: number; fayl_hajm: number | null; }
interface Aktivlik { id: string; dars_id: string; tur: string; nomi: string; ref_kod: string | null; tartib: number; }

// ── HELPERS ─────────────────────────────────────────────────────────────────
function youtubeIdParse(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : (url.length === 11 ? url : null);
}

function faylHajmFormat(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Gradient ranglar ro'yxati
const KURS_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-violet-600 to-purple-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
];

function gradientIndex(str: string): string {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  return KURS_GRADIENTS[sum % KURS_GRADIENTS.length];
}

// ── KONTENT IKONA ───────────────────────────────────────────────────────────
function KontentIkon({ tur }: { tur: string }) {
  switch (tur) {
    case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />;
    case 'audio': return <Music className="h-4 w-4 text-purple-500" />;
    case 'pdf': return <FileText className="h-4 w-4 text-red-600" />;
    case 'docx': return <FileText className="h-4 w-4 text-blue-600" />;
    case 'html': return <Globe className="h-4 w-4 text-green-600" />;
    default: return <FileText className="h-4 w-4 text-gray-500" />;
  }
}

// ── KONTENT QO'SHISH MODAL ────────────────────────────────────────────────
function KontentQoshModal({
  darsId, kursId, modulId, ustozId,
  onClose, onQoshildi
}: {
  darsId: string; kursId: string; modulId: string; ustozId: string;
  onClose: () => void; onQoshildi: () => void;
}) {
  const [tur, setTur] = useState<'youtube' | 'audio' | 'pdf' | 'docx' | 'html'>('youtube');
  const [nomi, setNomi] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [fayl, setFayl] = useState<File | null>(null);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [yuklanishFoiz, setYuklanishFoiz] = useState(0);
  const { toast } = useToast();
  const faylRef = useRef<HTMLInputElement>(null);

  const TUR_OPTIONS = [
    { id: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
    { id: 'audio', label: 'Audio', icon: Music, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    { id: 'docx', label: 'Word', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'html', label: 'HTML', icon: Globe, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  ];

  const ruxsatExt: Record<string, string> = {
    audio: '.mp3,.wav,.ogg,.m4a',
    pdf: '.pdf',
    docx: '.docx,.doc',
    html: '.html,.htm',
  };

  const saqlash = async () => {
    if (!nomi.trim()) {
      toast({ title: 'Xato', description: 'Kontent nomini kiriting', variant: 'destructive' });
      return;
    }
    if (!ustozId) {
      toast({ title: 'Xato', description: 'Ustoz ID topilmadi. Iltimos qayta login qiling.', variant: 'destructive' });
      return;
    }
    if (!darsId || !modulId || !kursId) {
      toast({ title: 'Xato', description: 'Dars, modul yoki kurs ID topilmadi.', variant: 'destructive' });
      return;
    }
    setYuklanyapti(true);
    setYuklanishFoiz(0);

    try {
      console.log('[Kontent] Saqlanmoqda:', { darsId, modulId, kursId, ustozId, tur, nomi });
      if (tur === 'youtube') {
        const ytId = youtubeIdParse(youtubeUrl.trim());
        if (!ytId) throw new Error("YouTube URL noto'g'ri yoki 11 belgili ID kiriting");
        const ytPayload = {
          dars_id: darsId, modul_id: modulId, kurs_id: kursId, ustoz_id: ustozId,
          tur: 'youtube', nomi: nomi.trim(), youtube_id: ytId, tartib: Math.floor(Date.now() / 1000000),
        };
        console.log('[YouTube] insert payload:', ytPayload);
        const { error: ytErr } = await supabase.from('kurs_kontent').insert(ytPayload);
        if (ytErr) throw new Error(`YouTube saqlashda xato: ${ytErr.message} | code: ${ytErr.code} | details: ${ytErr.details}`);
      } else {
        if (!fayl) throw new Error('Fayl tanlang');

        // Fayl hajmi tekshirish (50MB limit)
        if (fayl.size > 50 * 1024 * 1024) {
          throw new Error("Fayl hajmi 50 MB dan oshmasin");
        }

        setYuklanishFoiz(10);
        const safeName = fayl.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${ustozId}/${kursId}/${darsId}/${Date.now()}_${safeName}`;

        // Fetch+blob usuli bilan yuklash
        setYuklanishFoiz(30);
        const arrayBuffer = await fayl.arrayBuffer();
        setYuklanishFoiz(60);

        const { error: upErr } = await supabase.storage
          .from('kurs-fayllar')
          .upload(path, arrayBuffer, {
            contentType: fayl.type || 'application/octet-stream',
            upsert: false,
          });

        if (upErr) {
          console.error('Upload xatosi:', upErr);
          throw new Error(`Yuklash xatosi: ${upErr.message}`);
        }

        setYuklanishFoiz(85);
        const { data: urlData } = supabase.storage.from('kurs-fayllar').getPublicUrl(path);

        // DB constraint: pdf, docx, html, audio barchasi qabul qilinadi
        const filePayload = {
          dars_id: darsId, modul_id: modulId, kurs_id: kursId, ustoz_id: ustozId,
          tur: tur, nomi: nomi.trim(), kontent_url: urlData.publicUrl,
          fayl_hajm: fayl.size, tartib: Math.floor(Date.now() / 1000000),
        };
        console.log('[Fayl] insert payload:', filePayload);
        const { error: insertErr } = await supabase.from('kurs_kontent').insert(filePayload);

        if (insertErr) throw new Error(`DB saqlashda xato: ${insertErr.message} | code: ${insertErr.code} | details: ${JSON.stringify(insertErr.details)}`);
        setYuklanishFoiz(100);
      }
      toast({ title: '✅ Kontent qo\'shildi!', description: nomi });
      onQoshildi();
    } catch (e: any) {
      console.error('Kontent qo\'shish xatosi:', e);
      toast({ title: 'Xato', description: e.message || 'Kontent qo\'shishda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
      setYuklanishFoiz(0);
    }
  };

  const selectedTur = TUR_OPTIONS.find(t => t.id === tur)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-lg">Kontent qo'shish</h3>
              <p className="text-blue-200 text-xs">Dars materialini yuklang</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tur tanlash */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Kontent turi</p>
            <div className="grid grid-cols-5 gap-2">
              {TUR_OPTIONS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTur(t.id as any); setFayl(null); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-[10px] font-black transition-all ${
                    tur === t.id
                      ? `${t.border} ${t.bg} shadow-md scale-[1.03]`
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  }`}
                >
                  <t.icon className={`h-5 w-5 ${t.color}`} />
                  <span className="text-gray-700">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nomi */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">Kontent nomi *</label>
            <input
              value={nomi}
              onChange={e => setNomi(e.target.value)}
              placeholder="Masalan: 1-ma'ruza — Kirish..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-indigo-400 outline-none transition-all placeholder-gray-400"
            />
          </div>

          {/* YouTube URL */}
          {tur === 'youtube' && (
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">YouTube URL yoki Video ID *</label>
              <input
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... yoki xxxxxxxxxxx"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-red-400 outline-none transition-all"
              />
              {youtubeUrl && (
                <div className={`flex items-center gap-2 mt-2 text-xs font-bold px-3 py-2 rounded-xl ${
                  youtubeIdParse(youtubeUrl)
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-600 border border-red-200'
                }`}>
                  {youtubeIdParse(youtubeUrl)
                    ? <><CheckCircle className="h-3.5 w-3.5" /> ID: {youtubeIdParse(youtubeUrl)}</>
                    : <><X className="h-3.5 w-3.5" /> Noto'g'ri URL</>
                  }
                </div>
              )}
            </div>
          )}

          {/* Fayl yuklash */}
          {tur !== 'youtube' && (
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">
                {tur.toUpperCase()} fayl yuklash *
                <span className="ml-2 font-normal text-gray-400">max 50 MB</span>
              </label>
              <input
                ref={faylRef}
                type="file"
                accept={ruxsatExt[tur]}
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 50 * 1024 * 1024) {
                      alert("Fayl hajmi 50 MB dan oshmasin");
                      e.target.value = '';
                      return;
                    }
                    setFayl(f);
                  }
                }}
              />
              <button
                onClick={() => faylRef.current?.click()}
                className={`w-full flex items-center gap-3 px-4 py-4 border-2 border-dashed rounded-2xl text-sm transition-all ${
                  fayl
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-gray-500'
                }`}
              >
                {fayl ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-bold truncate">{fayl.name}</p>
                      <p className="text-xs text-green-600">{faylHajmFormat(fayl.size)}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setFayl(null); if (faylRef.current) faylRef.current.value = ''; }}
                      className="p-1 hover:bg-green-200 rounded-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <span>
                      <span className="font-bold text-indigo-600">Fayl tanlash</span>
                      {' '}yoki bu yerga tashlang
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Yuklanish progress */}
          {yuklanyapti && yuklanishFoiz > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-gray-600">
                <span>Yuklanmoqda...</span>
                <span>{yuklanishFoiz}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${yuklanishFoiz}%` }}
                />
              </div>
            </div>
          )}

          {/* Yuborish tugmasi */}
          <button
            onClick={saqlash}
            disabled={yuklanyapti || !nomi.trim() || (tur !== 'youtube' && !fayl) || (tur === 'youtube' && !youtubeIdParse(youtubeUrl))}
            className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
          >
            {yuklanyapti ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...</>
            ) : (
              <><Plus className="h-4 w-4" /> Kontent qo'shish</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AKTIVLIK QO'SHISH MODAL ──────────────────────────────────────────────
function AktivlikQoshModal({
  darsId, kursId, modulId, ustozId,
  onClose, onQoshildi
}: {
  darsId: string; kursId: string; modulId: string; ustozId: string;
  onClose: () => void; onQoshildi: () => void;
}) {
  const [tur, setTur] = useState<'test' | 'kazus'>('test');
  const [nomi, setNomi] = useState('');
  const [refKod, setRefKod] = useState('');
  const [rejim, setRejim] = useState<'tanlash' | 'qolda'>('tanlash');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [testlar, setTestlar] = useState<any[]>([]);
  const [kazuslar, setKazuslar] = useState<any[]>([]);
  const [royhatlYuklanyapti, setRoyhatlYuklanyapti] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const yuklash = async () => {
      setRoyhatlYuklanyapti(true);
      const [{ data: tData }, { data: kData }] = await Promise.all([
        supabase.from('testlar').select('id,kod,test_nomi').eq('ustoz_id', ustozId).order('created_at', { ascending: false }),
        supabase.from('toplamlar').select('id,kod,mavzu').eq('ustoz_id', ustozId).order('created_at', { ascending: false }),
      ]);
      setTestlar(tData || []);
      setKazuslar(kData || []);
      setRoyhatlYuklanyapti(false);
    };
    yuklash();
  }, [ustozId]);

  const turOzgartirish = (yangiTur: 'test' | 'kazus') => {
    setTur(yangiTur);
    setRefKod('');
    setNomi('');
  };

  const kodTanlash = (kod: string, nomiParam: string) => {
    setRefKod(kod);
    setNomi(nomiParam);
  };

  const royhatlList = tur === 'test' ? testlar : kazuslar;

  const saqlash = async () => {
    if (!nomi.trim()) {
      toast({ title: 'Xato', description: 'Aktivlik nomini kiriting', variant: 'destructive' });
      return;
    }
    setYuklanyapti(true);
    try {
      await supabase.from('kurs_aktivliklar').insert({
        dars_id: darsId, modul_id: modulId, kurs_id: kursId, ustoz_id: ustozId,
        tur, nomi: nomi.trim(), ref_kod: refKod.trim() || null, tartib: Math.floor(Date.now() / 1000000),
      });
      toast({ title: '✅ Aktivlik qo\'shildi!', description: nomi });
      onQoshildi();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl"><Zap className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black text-lg">Aktivlik qo'shish</h3>
              <p className="text-orange-100 text-xs">Test yoki kazus biriktirish</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Tur */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => turOzgartirish('test')}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                tur === 'test' ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-md' : 'border-gray-200 text-gray-500'
              }`}>
              📝 Test
            </button>
            <button onClick={() => turOzgartirish('kazus')}
              className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                tur === 'kazus' ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-md' : 'border-gray-200 text-gray-500'
              }`}>
              📋 Kazus
            </button>
          </div>

          {/* Rejim */}
          <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
            <button onClick={() => setRejim('tanlash')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                rejim === 'tanlash' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}>
              📂 Ro'yxatdan tanlash
            </button>
            <button onClick={() => setRejim('qolda')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                rejim === 'qolda' ? 'bg-white shadow text-gray-800' : 'text-gray-500'
              }`}>
              ✏️ Qo'lda kod kiritish
            </button>
          </div>

          {/* Ro'yxat */}
          {rejim === 'tanlash' && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">
                {tur === 'test' ? 'Testlaringiz' : 'Kazuslaringiz'}
                {royhatlList.length > 0 && <span className="ml-1.5 text-gray-400">({royhatlList.length})</span>}
              </p>
              {royhatlYuklanyapti ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                </div>
              ) : royhatlList.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-sm text-gray-400 font-medium">Hali {tur === 'test' ? 'test' : 'kazus'} yaratilmagan</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {royhatlList.map((item: any) => {
                    const displayNomi = tur === 'test' ? item.test_nomi : (item.mavzu || item.kod);
                    const isSelected = refKod === item.kod;
                    return (
                      <button key={item.id} onClick={() => kodTanlash(item.kod, displayNomi)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all ${
                          isSelected
                            ? tur === 'test' ? 'border-orange-400 bg-orange-50' : 'border-violet-400 bg-violet-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm flex-shrink-0 ${
                          tur === 'test' ? 'bg-orange-500' : 'bg-violet-500'
                        }`}>
                          {tur === 'test' ? '📝' : '📋'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{displayNomi}</p>
                          <p className="text-[10px] text-gray-400 font-mono">Kod: {item.kod}</p>
                        </div>
                        {isSelected && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {rejim === 'qolda' && (
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">Kod (ixtiyoriy)</label>
              <input value={refKod} onChange={e => setRefKod(e.target.value)}
                placeholder="5 ta raqam"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-400 outline-none font-mono tracking-widest" />
            </div>
          )}

          {/* Aktivlik nomi */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1.5 block">Aktivlik nomi *</label>
            <input value={nomi} onChange={e => setNomi(e.target.value)}
              placeholder="Masalan: Dars yakuniy testi"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-orange-400 outline-none" />
          </div>

          <button onClick={saqlash} disabled={yuklanyapti || !nomi.trim()}
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-orange-200">
            {yuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Aktivlik qo'shish
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ASOSIY KOMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function KurslarUstoz() {
  const { user } = useAuth();
  const { toast } = useToast();
  const ustozId = user?.ustoz_id || '';
  const ustozIsmi = user ? `${user.ism} ${user.familiya}` : '';

  // Debug: ustoz_id mavjudligini tekshirish
  useEffect(() => {
    console.log('[KurslarUstoz] user:', user);
    console.log('[KurslarUstoz] ustozId:', ustozId);
    if (user?.rol === 'ustoz' && !ustozId) {
      console.error('[KurslarUstoz] ❌ ustoz_id mavjud emas! user:', JSON.stringify(user));
      toast({ title: '⚠️ Xato', description: 'Ustoz ID topilmadi. Qayta kiring.', variant: 'destructive' });
    }
  }, [user]);

  const [kurslar, setKurslar] = useState<Kurs[]>([]);
  const [tanlanganKurs, setTanlanganKurs] = useState<Kurs | null>(null);
  const [modullar, setModullar] = useState<Modul[]>([]);
  const [darslarMap, setDarslarMap] = useState<Record<string, Dars[]>>({});
  const [kontentMap, setKontentMap] = useState<Record<string, Kontent[]>>({});
  const [aktivlikMap, setAktivlikMap] = useState<Record<string, Aktivlik[]>>({});
  const [ochiqModullar, setOchiqModullar] = useState<Set<string>>(new Set());
  const [ochiqDarslar, setOchiqDarslar] = useState<Set<string>>(new Set());
  const [yuklanyapti, setYuklanyapti] = useState(true);

  const [kursModal, setKursModal] = useState(false);
  const [kursNomi, setKursNomi] = useState('');
  const [kursTavsif, setKursTavsif] = useState('');
  const [kursRasmFayl, setKursRasmFayl] = useState<File | null>(null);
  const [kursRasmPreview, setKursRasmPreview] = useState('');
  const [kursYuklanyapti, setKursYuklanyapti] = useState(false);
  const kursRasmRef = useRef<HTMLInputElement>(null);

  const [modulModal, setModulModal] = useState(false);
  const [modulNomi, setModulNomi] = useState('');
  const [modulTavsif, setModulTavsif] = useState('');
  const [modulYuklanyapti, setModulYuklanyapti] = useState(false);

  const [darsModal, setDarsModal] = useState<string | null>(null);
  const [darsNomi, setDarsNomi] = useState('');
  const [darsTavsif, setDarsTavsif] = useState('');
  const [darsYuklanyapti, setDarsYuklanyapti] = useState(false);

  const [kontentModal, setKontentModal] = useState<{ darsId: string; modulId: string } | null>(null);
  const [aktivlikModal, setAktivlikModal] = useState<{ darsId: string; modulId: string } | null>(null);

  const kurslarniYuklash = async () => {
    const { data } = await supabase.from('kurslar').select('*').eq('ustoz_id', ustozId).order('tartib');
    setKurslar(data || []);
    setYuklanyapti(false);
  };

  useEffect(() => { kurslarniYuklash(); }, [ustozId]);

  const kursniTanlash = async (kurs: Kurs) => {
    setTanlanganKurs(kurs);
    setYuklanyapti(true);
    setOchiqModullar(new Set());
    setOchiqDarslar(new Set());
    setDarslarMap({});
    setKontentMap({});
    setAktivlikMap({});

    const [{ data: mData }, { data: dData }] = await Promise.all([
      supabase.from('kurs_modullar').select('*').eq('kurs_id', kurs.id).order('tartib'),
      supabase.from('kurs_darslar').select('*').eq('kurs_id', kurs.id).order('tartib'),
    ]);

    const mList = mData || [];
    const dList = dData || [];
    const dm: Record<string, Dars[]> = {};
    mList.forEach(m => { dm[m.id] = dList.filter((d: Dars) => d.modul_id === m.id); });
    setModullar(mList);
    setDarslarMap(dm);
    setYuklanyapti(false);
  };

  const darsniOchish = async (darsId: string) => {
    const yangi = new Set(ochiqDarslar);
    if (yangi.has(darsId)) { yangi.delete(darsId); setOchiqDarslar(yangi); return; }
    yangi.add(darsId);
    setOchiqDarslar(yangi);
    if (kontentMap[darsId]) return;
    const [{ data: kData }, { data: aData }] = await Promise.all([
      supabase.from('kurs_kontent').select('*').eq('dars_id', darsId).order('tartib'),
      supabase.from('kurs_aktivliklar').select('*').eq('dars_id', darsId).order('tartib'),
    ]);
    setKontentMap(prev => ({ ...prev, [darsId]: kData || [] }));
    setAktivlikMap(prev => ({ ...prev, [darsId]: aData || [] }));
  };

  const kursYaratish = async () => {
    if (!kursNomi.trim()) {
      toast({ title: 'Xato', description: 'Kurs nomi kiriting', variant: 'destructive' });
      return;
    }
    setKursYuklanyapti(true);
    try {
      let rasmUrl: string | null = null;
      if (kursRasmFayl) {
        const safeName = kursRasmFayl.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${ustozId}/kurs-rasmlar/${Date.now()}_${safeName}`;
        const arrayBuffer = await kursRasmFayl.arrayBuffer();
        const { error: upErr } = await supabase.storage.from('kurs-fayllar').upload(path, arrayBuffer, {
          contentType: kursRasmFayl.type,
          upsert: false,
        });
        if (!upErr) {
          const { data } = supabase.storage.from('kurs-fayllar').getPublicUrl(path);
          rasmUrl = data.publicUrl;
        }
      }
      await supabase.from('kurslar').insert({
        nomi: kursNomi.trim(),
        tavsif: kursTavsif.trim() || null,
        rasm_url: rasmUrl,
        ustoz_id: ustozId,
        ustoz_ismi: ustozIsmi,
        faol: false,
        tartib: kurslar.length,
      });
      toast({ title: '✅ Kurs yaratildi!', description: 'Modullar qo\'shingiz' });
      setKursModal(false); setKursNomi(''); setKursTavsif('');
      setKursRasmFayl(null); setKursRasmPreview('');
      kurslarniYuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setKursYuklanyapti(false); }
  };

  const kursFaolToggle = async (kurs: Kurs) => {
    await supabase.from('kurslar').update({ faol: !kurs.faol }).eq('id', kurs.id);
    setKurslar(prev => prev.map(k => k.id === kurs.id ? { ...k, faol: !k.faol } : k));
    if (tanlanganKurs?.id === kurs.id) setTanlanganKurs(prev => prev ? { ...prev, faol: !prev.faol } : null);
    toast({ title: kurs.faol ? '🙈 Kurs yashirildi' : '✅ Kurs faollashtirildi' });
  };

  const modulYaratish = async () => {
    if (!tanlanganKurs || !modulNomi.trim()) return;
    setModulYuklanyapti(true);
    try {
      await supabase.from('kurs_modullar').insert({
        kurs_id: tanlanganKurs.id, ustoz_id: ustozId,
        nomi: modulNomi.trim(), tavsif: modulTavsif.trim() || null,
        tartib: modullar.length, faol: true,
      });
      toast({ title: '✅ Modul qo\'shildi!' });
      setModulModal(false); setModulNomi(''); setModulTavsif('');
      kursniTanlash(tanlanganKurs);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setModulYuklanyapti(false); }
  };

  const darsYaratish = async () => {
    if (!tanlanganKurs || !darsModal || !darsNomi.trim()) return;
    setDarsYuklanyapti(true);
    try {
      const modulDarslar = darslarMap[darsModal] || [];
      await supabase.from('kurs_darslar').insert({
        modul_id: darsModal, kurs_id: tanlanganKurs.id, ustoz_id: ustozId,
        nomi: darsNomi.trim(), tavsif: darsTavsif.trim() || null,
        tartib: modulDarslar.length,
      });
      toast({ title: '✅ Dars qo\'shildi!' });
      setDarsModal(null); setDarsNomi(''); setDarsTavsif('');
      kursniTanlash(tanlanganKurs);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setDarsYuklanyapti(false); }
  };

  const kontentOchirish = async (kontentId: string, darsId: string) => {
    if (!confirm("Kontentni o'chirishni tasdiqlaysizmi?")) return;
    await supabase.from('kurs_kontent').delete().eq('id', kontentId);
    setKontentMap(prev => ({ ...prev, [darsId]: prev[darsId]?.filter(k => k.id !== kontentId) || [] }));
    toast({ title: "O'chirildi" });
  };

  const aktivlikOchirish = async (aktivlikId: string, darsId: string) => {
    await supabase.from('kurs_aktivliklar').delete().eq('id', aktivlikId);
    setAktivlikMap(prev => ({ ...prev, [darsId]: prev[darsId]?.filter(a => a.id !== aktivlikId) || [] }));
    toast({ title: "Aktivlik o'chirildi" });
  };

  const darsOchirish = async (darsId: string, modulId: string) => {
    if (!confirm("Darsni o'chirsiz barcha kontent ham o'chadi. Davom etasizmi?")) return;
    await supabase.from('kurs_darslar').delete().eq('id', darsId);
    setDarslarMap(prev => ({ ...prev, [modulId]: prev[modulId]?.filter(d => d.id !== darsId) || [] }));
    toast({ title: "Dars o'chirildi" });
  };

  const modulOchirish = async (modulId: string) => {
    if (!confirm("Modulni o'chirsiz barcha darslar ham o'chadi. Davom etasizmi?")) return;
    await supabase.from('kurs_modullar').delete().eq('id', modulId);
    setModullar(prev => prev.filter(m => m.id !== modulId));
    toast({ title: "Modul o'chirildi" });
  };

  const kursOchirish = async (kursId: string) => {
    if (!confirm("Kursni to'liq o'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi!")) return;
    await supabase.from('kurslar').delete().eq('id', kursId);
    setKurslar(prev => prev.filter(k => k.id !== kursId));
    if (tanlanganKurs?.id === kursId) setTanlanganKurs(null);
    toast({ title: "Kurs o'chirildi" });
  };

  if (user?.rol !== 'ustoz') return null;

  // ── KURSLAR RO'YXATI ─────────────────────────────────────────────────────
  if (!tanlanganKurs) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 text-white p-8 shadow-2xl">
          {/* Dekorativ elementlar */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-20 w-40 h-40 bg-blue-500/10 rounded-full translate-y-20" />
          <div className="absolute top-4 right-24 opacity-20">
            <GraduationCap className="h-20 w-20" />
          </div>

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-blue-500/30 border border-blue-400/40 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-blue-200 text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" /> Ta'lim platformasi
                  </span>
                </div>
              </div>
              <h1 className="text-3xl font-black mb-2 leading-tight">Mening Kurslarim</h1>
              <p className="text-blue-300 text-sm leading-relaxed max-w-md">
                Kurs → Modul → Dars → Kontent tuzilmasida o'quvchilaringiz uchun sifatli ta'lim yarating
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
                  <p className="text-2xl font-black">{kurslar.length}</p>
                  <p className="text-blue-300 text-[10px]">Kurslar</p>
                </div>
                <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
                  <p className="text-2xl font-black">{kurslar.filter(k => k.faol).length}</p>
                  <p className="text-blue-300 text-[10px]">Faol</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setKursModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white text-indigo-700 font-black text-sm rounded-2xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex-shrink-0"
            >
              <Plus className="h-4 w-4" /> Yangi kurs
            </button>
          </div>
        </div>

        {/* Kurslar grid */}
        {yuklanyapti ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
            <p className="text-gray-500 text-sm">Yuklanmoqda...</p>
          </div>
        ) : kurslar.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
              <BookOpen className="h-10 w-10 text-indigo-400" />
            </div>
            <h3 className="font-black text-gray-700 text-xl mb-2">Hali kurs yaratilmagan</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              Birinchi kursingizni yaratib, o'quvchilaringizga sifatli ta'lim bering
            </p>
            <button
              onClick={() => setKursModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl mx-auto transition-all shadow-lg shadow-indigo-200"
            >
              <Plus className="h-4 w-4" /> Birinchi kursni yarating
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {kurslar.map(kurs => {
              const gradient = gradientIndex(kurs.id);
              return (
                <div
                  key={kurs.id}
                  className={`group bg-white rounded-3xl border-2 shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col ${
                    kurs.faol ? 'border-indigo-100 hover:border-indigo-300' : 'border-gray-200 opacity-75'
                  }`}
                >
                  {/* Muqova */}
                  {kurs.rasm_url ? (
                    <div className="relative overflow-hidden h-48">
                      <img src={kurs.rasm_url} alt={kurs.nomi} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full backdrop-blur-sm border ${
                          kurs.faol ? 'bg-green-500/90 text-white border-green-400' : 'bg-gray-900/70 text-gray-300 border-gray-700'
                        }`}>
                          {kurs.faol ? '● FAOL' : '○ YASHIRIN'}
                        </span>
                      </div>
                      <div className="absolute bottom-3 left-4 right-4">
                        <h3 className="font-black text-white text-lg leading-snug drop-shadow-lg line-clamp-2">{kurs.nomi}</h3>
                      </div>
                    </div>
                  ) : (
                    <div className={`relative h-48 bg-gradient-to-br ${gradient} overflow-hidden`}>
                      {/* Pattern */}
                      <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
                        backgroundSize: '24px 24px'
                      }} />
                      <div className="absolute top-3 right-3">
                        <BookMarked className="h-24 w-24 text-white/10" />
                      </div>
                      <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                          kurs.faol ? 'bg-white/20 text-white border border-white/30' : 'bg-black/20 text-white/70 border border-white/10'
                        }`}>
                          {kurs.faol ? '● FAOL' : '○ YASHIRIN'}
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="font-black text-white text-lg leading-snug line-clamp-2 drop-shadow">{kurs.nomi}</h3>
                      </div>
                      {/* Dekorativ to'lqin */}
                      <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
                    </div>
                  )}

                  {/* Kontent */}
                  <div className="p-5 flex flex-col flex-1">
                    {kurs.tavsif && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed">{kurs.tavsif}</p>
                    )}

                    {/* Ustoz */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center font-black text-[10px] uppercase flex-shrink-0 shadow-sm`}>
                        {kurs.ustoz_ismi?.split(' ')[0]?.[0]}{kurs.ustoz_ismi?.split(' ')[1]?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{kurs.ustoz_ismi}</p>
                        <p className="text-[10px] text-gray-400">O'qituvchi</p>
                      </div>
                    </div>

                    {/* Tugmalar */}
                    <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100">
                      <button
                        onClick={() => kursniTanlash(kurs)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r ${gradient} text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0`}
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Boshqarish
                      </button>
                      <button
                        onClick={() => kursFaolToggle(kurs)}
                        className={`px-3.5 py-2.5 rounded-xl text-xs border-2 transition-all ${
                          kurs.faol
                            ? 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'
                            : 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                        title={kurs.faol ? "Yashirish" : "Faollashtirish"}
                      >
                        {kurs.faol ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={() => kursOchirish(kurs.id)}
                        className="px-3.5 py-2.5 rounded-xl text-xs border-2 border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                        title="O'chirish"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Kurs yaratish modal */}
        {kursModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5 flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl"><BookOpen className="h-5 w-5" /></div>
                  <div>
                    <h3 className="font-black text-lg">Yangi kurs yaratish</h3>
                    <p className="text-blue-200 text-xs">Ta'lim kursingizni sozlang</p>
                  </div>
                </div>
                <button onClick={() => setKursModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block">Kurs nomi *</label>
                  <input value={kursNomi} onChange={e => setKursNomi(e.target.value)}
                    placeholder="Masalan: Jinoyat huquqi asoslari"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-indigo-400 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block">Tavsif <span className="font-normal text-gray-400">(ixtiyoriy)</span></label>
                  <textarea value={kursTavsif} onChange={e => setKursTavsif(e.target.value)} rows={2}
                    placeholder="Kurs haqida qisqacha ma'lumot..."
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-indigo-400 outline-none resize-none transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1.5 block">Muqova rasm <span className="font-normal text-gray-400">(ixtiyoriy)</span></label>
                  <input ref={kursRasmRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setKursRasmFayl(f);
                        const reader = new FileReader();
                        reader.onload = ev => setKursRasmPreview(ev.target?.result as string);
                        reader.readAsDataURL(f);
                      }
                    }} />
                  {kursRasmPreview ? (
                    <div className="relative">
                      <img src={kursRasmPreview} alt="preview" className="w-full h-32 object-cover rounded-2xl border-2 border-indigo-200" />
                      <button
                        onClick={() => { setKursRasmFayl(null); setKursRasmPreview(''); if (kursRasmRef.current) kursRasmRef.current.value = ''; }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => kursRasmRef.current?.click()}
                      className="w-full flex items-center gap-3 px-4 py-4 border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/30 rounded-2xl text-sm text-gray-500 transition-all">
                      <Upload className="h-4 w-4 text-gray-400" />
                      <span><span className="text-indigo-600 font-bold">Rasm tanlash</span> (JPG, PNG)</span>
                    </button>
                  )}
                </div>
                <button onClick={kursYaratish} disabled={kursYuklanyapti || !kursNomi.trim()}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                  {kursYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Kurs yaratish
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .animate-fade-in { animation: fade-in 0.4s ease-out; }
        `}</style>
      </div>
    );
  }

  // ── KURS BOSHQARUV EKRANI ─────────────────────────────────────────────────
  const gradient = gradientIndex(tanlanganKurs.id);

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in">
      {/* Sarlavha */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} text-white rounded-3xl p-6 shadow-xl`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10">
          <button onClick={() => setTanlanganKurs(null)}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-bold mb-4 transition-colors bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl">
            ← Kurslar ro'yxati
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                  tanlanganKurs.faol ? 'bg-white/20 text-white border-white/40' : 'bg-black/20 text-white/60 border-white/20'
                }`}>
                  {tanlanganKurs.faol ? '● FAOL' : '○ YASHIRIN'}
                </span>
                <span className="text-white/50 text-xs">{modullar.length} modul</span>
              </div>
              <h1 className="text-2xl font-black leading-tight">{tanlanganKurs.nomi}</h1>
              {tanlanganKurs.tavsif && <p className="text-white/60 text-sm mt-1">{tanlanganKurs.tavsif}</p>}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button onClick={() => kursFaolToggle(tanlanganKurs)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs font-bold rounded-xl transition-all">
                {tanlanganKurs.faol ? <><EyeOff className="h-3.5 w-3.5" />Yashirish</> : <><Eye className="h-3.5 w-3.5" />Faollashtirish</>}
              </button>
              <button onClick={() => { setModulModal(true); setModulNomi(''); setModulTavsif(''); }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-gray-800 text-xs font-black rounded-xl hover:bg-gray-100 transition-all shadow-md">
                <Plus className="h-3.5 w-3.5" /> Modul qo'shish
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modullar */}
      {yuklanyapti ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
      ) : modullar.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Layers className="h-8 w-8 text-blue-400" />
          </div>
          <p className="text-gray-500 font-semibold mb-3">Hali modul qo'shilmagan</p>
          <button onClick={() => setModulModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl mx-auto hover:bg-indigo-700 transition-all">
            <Plus className="h-4 w-4" /> Birinchi modulni qo'shing
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {modullar.map((modul, mIdx) => {
            const modulDarslar = darslarMap[modul.id] || [];
            const modulOchiq = ochiqModullar.has(modul.id);

            // Modul rangi (alternating)
            const modulRanglar = [
              { bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
              { bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
              { bg: 'bg-violet-600', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
              { bg: 'bg-amber-600', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
              { bg: 'bg-rose-600', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
            ];
            const rang = modulRanglar[mIdx % modulRanglar.length];

            return (
              <div key={modul.id} className={`bg-white rounded-2xl border-2 shadow-sm transition-all duration-200 overflow-hidden ${modulOchiq ? rang.border : 'border-gray-100 hover:border-gray-200'}`}>
                {/* Modul sarlavha */}
                <div className={`flex items-center gap-3 px-5 py-4 ${modulOchiq ? rang.light : ''} transition-colors`}>
                  <button
                    onClick={() => {
                      const yangi = new Set(ochiqModullar);
                      if (yangi.has(modul.id)) yangi.delete(modul.id);
                      else yangi.add(modul.id);
                      setOchiqModullar(yangi);
                    }}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className={`w-9 h-9 rounded-xl ${rang.bg} text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-md`}>
                      {mIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm">{modul.nomi}</p>
                      <p className={`text-xs ${rang.text} font-semibold`}>{modulDarslar.length} ta dars</p>
                    </div>
                    <div className={`transition-transform ${modulOchiq ? 'rotate-90' : ''}`}>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setDarsModal(modul.id); setDarsNomi(''); setDarsTavsif(''); }}
                      className={`flex items-center gap-1 px-3 py-1.5 ${rang.light} ${rang.text} text-[10px] font-black rounded-xl transition-all border ${rang.border} hover:shadow-sm`}
                    >
                      <Plus className="h-3 w-3" /> Dars
                    </button>
                    <button
                      onClick={() => modulOchirish(modul.id)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Darslar */}
                {modulOchiq && (
                  <div className="border-t border-gray-100">
                    {modulDarslar.length === 0 ? (
                      <div className="px-5 py-5 text-center">
                        <p className="text-xs text-gray-400 mb-2">Hali dars qo'shilmagan</p>
                        <button
                          onClick={() => { setDarsModal(modul.id); setDarsNomi(''); }}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 ${rang.light} ${rang.text} border ${rang.border} text-xs font-bold rounded-xl transition-all`}
                        >
                          <Plus className="h-3.5 w-3.5" /> Dars qo'shish
                        </button>
                      </div>
                    ) : modulDarslar.map((dars, dIdx) => {
                      const darsOchiq = ochiqDarslar.has(dars.id);
                      const kontentlar = kontentMap[dars.id] || [];
                      const aktivliklar = aktivlikMap[dars.id] || [];
                      const jami = kontentlar.length + aktivliklar.length;

                      return (
                        <div key={dars.id} className="border-b border-gray-50 last:border-b-0">
                          {/* Dars sarlavha */}
                          <div className={`flex items-center gap-3 px-6 py-3.5 ${darsOchiq ? 'bg-gray-50' : ''} transition-colors`}>
                            <button onClick={() => darsniOchish(dars.id)} className="flex items-center gap-3 flex-1 text-left group">
                              <div className={`w-7 h-7 rounded-lg ${darsOchiq ? rang.bg : 'bg-gray-100'} flex items-center justify-center font-black text-[11px] flex-shrink-0 transition-all ${darsOchiq ? 'text-white' : 'text-gray-500'}`}>
                                {dIdx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${darsOchiq ? 'text-gray-900' : 'text-gray-700'}`}>{dars.nomi}</p>
                                {jami > 0 && !darsOchiq && (
                                  <p className="text-[10px] text-gray-400">{jami} ta material</p>
                                )}
                                {dars.tavsif && !darsOchiq && (
                                  <p className="text-[10px] text-gray-400 truncate">{dars.tavsif}</p>
                                )}
                              </div>
                              <div className={`transition-transform ${darsOchiq ? 'rotate-90' : ''}`}>
                                <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                              </div>
                            </button>
                            <button onClick={() => darsOchirish(dars.id, modul.id)}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-xl transition-all flex-shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Kontent panel */}
                          {darsOchiq && (
                            <div className="bg-gradient-to-b from-gray-50 to-white border-t border-gray-100 px-6 py-4 space-y-2.5">
                              {/* Mavjud kontentlar */}
                              {kontentlar.map(k => (
                                <div key={k.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3.5 py-2.5 shadow-sm hover:shadow-md transition-all group">
                                  <div className="bg-gray-50 p-1.5 rounded-lg flex-shrink-0">
                                    <KontentIkon tur={k.tur} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-800 truncate">{k.nomi}</p>
                                    <p className="text-[10px] text-gray-400 uppercase">
                                      {k.tur === 'youtube' ? `▶ YouTube ${k.youtube_id ? `• ${k.youtube_id}` : ''}` : `${k.tur} ${k.fayl_hajm ? `• ${faylHajmFormat(k.fayl_hajm)}` : ''}`}
                                    </p>
                                  </div>
                                  <button onClick={() => kontentOchirish(k.id, dars.id)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}

                              {/* Mavjud aktivliklar */}
                              {aktivliklar.map(a => (
                                <div key={a.id} className="flex items-center gap-3 bg-white rounded-xl border border-orange-100 px-3.5 py-2.5 shadow-sm group hover:shadow-md transition-all">
                                  <div className="bg-orange-50 p-1.5 rounded-lg flex-shrink-0">
                                    <Zap className="h-4 w-4 text-orange-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-gray-800 truncate">{a.nomi}</p>
                                    <p className="text-[10px] text-orange-500 uppercase font-semibold">
                                      {a.tur} {a.ref_kod ? `• Kod: ${a.ref_kod}` : '• Kod belgilanmagan'}
                                    </p>
                                  </div>
                                  <button onClick={() => aktivlikOchirish(a.id, dars.id)}
                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}

                              {kontentlar.length === 0 && aktivliklar.length === 0 && (
                                <div className="text-center py-4 text-xs text-gray-400">
                                  Bu darskga hali material qo'shilmagan
                                </div>
                              )}

                              {/* Qo'shish tugmalari */}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => setKontentModal({ darsId: dars.id, modulId: modul.id })}
                                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed ${rang.border} ${rang.light} ${rang.text} text-[11px] font-black rounded-xl transition-all hover:shadow-sm`}
                                >
                                  <Upload className="h-3.5 w-3.5" /> Kontent qo'shish
                                </button>
                                <button
                                  onClick={() => setAktivlikModal({ darsId: dars.id, modulId: modul.id })}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-orange-200 bg-orange-50 text-orange-600 text-[11px] font-black rounded-xl transition-all hover:shadow-sm"
                                >
                                  <Zap className="h-3.5 w-3.5" /> Aktivlik
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modul modal */}
      {modulModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className={`bg-gradient-to-r ${gradient} px-6 py-5 flex items-center justify-between text-white`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><Layers className="h-5 w-5" /></div>
                <h3 className="font-black text-lg">Modul qo'shish</h3>
              </div>
              <button onClick={() => setModulModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <input value={modulNomi} onChange={e => setModulNomi(e.target.value)} placeholder="Modul nomi *"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-indigo-400 outline-none transition-all" />
              <textarea value={modulTavsif} onChange={e => setModulTavsif(e.target.value)} rows={2} placeholder="Tavsif (ixtiyoriy)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-indigo-400 outline-none resize-none transition-all" />
              <button onClick={modulYaratish} disabled={modulYuklanyapti || !modulNomi.trim()}
                className={`w-full h-12 bg-gradient-to-r ${gradient} text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg`}>
                {modulYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Modul qo'shish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dars modal */}
      {darsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-5 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><BookOpen className="h-5 w-5" /></div>
                <h3 className="font-black text-lg">Dars qo'shish</h3>
              </div>
              <button onClick={() => setDarsModal(null)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <input value={darsNomi} onChange={e => setDarsNomi(e.target.value)} placeholder="Dars nomi *"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-teal-400 outline-none transition-all" />
              <textarea value={darsTavsif} onChange={e => setDarsTavsif(e.target.value)} rows={2} placeholder="Tavsif (ixtiyoriy)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-sm focus:border-teal-400 outline-none resize-none transition-all" />
              <button onClick={darsYaratish} disabled={darsYuklanyapti || !darsNomi.trim()}
                className="w-full h-12 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-lg">
                {darsYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Dars qo'shish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kontent modal */}
      {kontentModal && tanlanganKurs && (
        <KontentQoshModal
          darsId={kontentModal.darsId}
          modulId={kontentModal.modulId}
          kursId={tanlanganKurs.id}
          ustozId={ustozId}
          onClose={() => setKontentModal(null)}
          onQoshildi={() => {
            setKontentModal(null);
            supabase.from('kurs_kontent').select('*').eq('dars_id', kontentModal.darsId).order('tartib')
              .then(({ data }) => setKontentMap(prev => ({ ...prev, [kontentModal.darsId]: data || [] })));
          }}
        />
      )}

      {/* Aktivlik modal */}
      {aktivlikModal && tanlanganKurs && (
        <AktivlikQoshModal
          darsId={aktivlikModal.darsId}
          modulId={aktivlikModal.modulId}
          kursId={tanlanganKurs.id}
          ustozId={ustozId}
          onClose={() => setAktivlikModal(null)}
          onQoshildi={() => {
            setAktivlikModal(null);
            supabase.from('kurs_aktivliklar').select('*').eq('dars_id', aktivlikModal.darsId).order('tartib')
              .then(({ data }) => setAktivlikMap(prev => ({ ...prev, [aktivlikModal.darsId]: data || [] })));
          }}
        />
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.35s ease-out; }
      `}</style>
    </div>
  );
}
