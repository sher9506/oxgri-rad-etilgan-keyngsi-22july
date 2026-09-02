/**
 * Ustoz AI Kazus Yaratish Tizimi
 * --------------------------------
 * Ustoz kazus savoli + javobini AI Mentor chatiga tashlaydi.
 * AI: savol/javob/mavzu/model_tur ajratadi → JSON qaytaradi.
 * Avtomatik tizim: JSON'ni o'qib toplamlar jadvaliga yozadi.
 * Start va ommalashtirish ustoz qo'lda bosadi.
 */

import { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit, Send, Loader2, Plus, Check, X, Trash2,
  FileText, Play, Globe, ChevronRight, AlertCircle,
  Sparkles, BookOpen, Zap, Info, HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FunctionsHttpError } from '@supabase/supabase-js';

interface AiSavol {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface KazusTahlil {
  aniq: boolean;
  savol: string;
  javob: string;
  model_tur: 'oddiy' | 'protsesual';
  mavzu: string;
  izoh?: string;
}

interface YaratilganKazus {
  id: string;
  kod: string;
  mavzu: string;
  model_tur: string;
  kazuslar_soni: number;
  is_active: boolean;
  ommaviy: boolean;
  created_at: string;
}

function generateKod(length = 5): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function UstozAiKazusYaratish() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<AiSavol[]>([]);
  const [input, setInput] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [tahlil, setTahlil] = useState<KazusTahlil | null>(null);
  const [yaratilmoqda, setYaratilmoqda] = useState(false);
  const [yaratilganKazus, setYaratilganKazus] = useState<YaratilganKazus | null>(null);
  const [startYuklanyapti, setStartYuklanyapti] = useState(false);
  const [ommaYuklanyapti, setOmmaYuklanyapti] = useState(false);
  const [tahrirlash, setTahrirlash] = useState<Partial<KazusTahlil> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const aiGaYuborish = async (matn?: string) => {
    const text = (matn || input).trim();
    if (!text || yuklanyapti) return;

    const newMsg: AiSavol = { role: 'user', parts: [{ text }] };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput('');
    setYuklanyapti(true);

    try {
      const { data, error } = await supabase.functions.invoke('mentor-chat', {
        body: {
          messages: updated.map(m => ({ role: m.role, parts: m.parts })),
          mode: 'kazus_tahlil',
          ustozId: user?.ustoz_id,
          ustozIsmi: `${user?.ism} ${user?.familiya}`,
        },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { const txt = await error.context?.text?.(); errMsg = txt || errMsg; } catch {}
        }
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ ${errMsg}` }] }]);
        return;
      }

      const modelMsg: AiSavol = { role: 'model', parts: [{ text: data.reply || '' }] };
      setMessages(prev => [...prev, modelMsg]);

      // Agar AI aniq JSON qaytarsa — avtomatik tizimga yuborish
      if (data.parsed) {
        const parsed: KazusTahlil = data.parsed;
        if (parsed.aniq && parsed.savol && parsed.javob) {
          setTahlil(parsed);
          setTahrirlash({ ...parsed });
          // Avtomatik ravishda kazus yaratish
          await avtomatikYaratish(parsed);
        } else if (!parsed.aniq) {
          // AI qo'shimcha ma'lumot so'rayapti — javobni ko'rsatish
          setTahlil(null);
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ ${e.message}` }] }]);
    } finally {
      setYuklanyapti(false);
    }
  };

  // ── AVTOMATIK KAZUS YARATISH ──────────────────────────────────────────────
  const avtomatikYaratish = async (t: KazusTahlil) => {
    if (!user?.ustoz_id) return;
    setYaratilmoqda(true);
    try {
      // Unikal kod yaratish
      let kod = generateKod();
      // Takrorlanmasligini tekshirish
      for (let i = 0; i < 5; i++) {
        const { data: exists } = await supabase.from('toplamlar').select('id').eq('kod', kod).maybeSingle();
        if (!exists) break;
        kod = generateKod();
      }

      const kazuslar = [{ kazus: t.savol, javob: t.javob }];

      const { data, error } = await supabase.from('toplamlar').insert({
        kod,
        ustoz_id: user.ustoz_id,
        ustoz_ismi: `${user.ism} ${user.familiya}`,
        mavzu: t.mavzu || 'AI tomonidan yaratilgan kazus',
        kazuslar,
        vaqt_daqiqa: 30,
        is_active: false,      // Start bosilmagan
        ommaviy: false,        // Ommaviy emas
        model_tur: t.model_tur || 'oddiy',
        allow_retake: false,
        copy_paste_ruxsat: true,
        narx: 0,
      }).select().single();

      if (error) throw error;

      setYaratilganKazus({
        id: data.id,
        kod: data.kod,
        mavzu: data.mavzu,
        model_tur: data.model_tur,
        kazuslar_soni: 1,
        is_active: false,
        ommaviy: false,
        created_at: data.created_at,
      });

      toast({
        title: '✅ Kazus avtomatik yaratildi!',
        description: `Kod: ${kod} | Start va ommalashtirish sizning qo'lingizda`,
      });
    } catch (e: any) {
      toast({ title: 'Yaratishda xato', description: e.message, variant: 'destructive' });
    } finally {
      setYaratilmoqda(false);
    }
  };

  // ── QOLDA YARATISH (tahlil tahrirlanganda) ────────────────────────────────
  const qoldaYaratish = async () => {
    if (!tahrirlash?.savol || !tahrirlash?.javob || !tahrirlash?.mavzu) {
      toast({ title: 'To\'ldiring', description: 'Savol, javob va mavzu kiritilishi shart', variant: 'destructive' });
      return;
    }
    await avtomatikYaratish(tahrirlash as KazusTahlil);
  };

  // ── START ─────────────────────────────────────────────────────────────────
  const startBerish = async () => {
    if (!yaratilganKazus) return;
    setStartYuklanyapti(true);
    try {
      await supabase.from('toplamlar').update({ is_active: true }).eq('id', yaratilganKazus.id);
      setYaratilganKazus(prev => prev ? { ...prev, is_active: true } : null);
      toast({ title: '▶️ Kazus START berildi!', description: 'O\'quvchilar endi kod bilan kira oladi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setStartYuklanyapti(false); }
  };

  // ── STOP ──────────────────────────────────────────────────────────────────
  const stopBerish = async () => {
    if (!yaratilganKazus) return;
    await supabase.from('toplamlar').update({ is_active: false }).eq('id', yaratilganKazus.id);
    setYaratilganKazus(prev => prev ? { ...prev, is_active: false } : null);
    toast({ title: '⏹ Kazus to\'xtatildi' });
  };

  // ── OMMALASHTIRISH ────────────────────────────────────────────────────────
  const ommalashtrish = async () => {
    if (!yaratilganKazus) return;
    setOmmaYuklanyapti(true);
    try {
      const yangiOmmaviy = !yaratilganKazus.ommaviy;
      await supabase.from('toplamlar').update({ ommaviy: yangiOmmaviy }).eq('id', yaratilganKazus.id);
      setYaratilganKazus(prev => prev ? { ...prev, ommaviy: yangiOmmaviy } : null);
      toast({
        title: yangiOmmaviy ? '🌐 Ommaviy qilindi' : '🔒 Yashirin qilindi',
        description: yangiOmmaviy ? '"Mavjud kazuslar" sahifasida ko\'rinadi' : 'Endi ko\'rinmaydi',
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setOmmaYuklanyapti(false); }
  };

  // ── TOZALASH ──────────────────────────────────────────────────────────────
  const tozalash = () => {
    setMessages([]);
    setTahlil(null);
    setTahrirlash(null);
    setYaratilganKazus(null);
  };

  if (!user || user.rol !== 'ustoz') return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-xl">
            <BrainCircuit className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-black text-lg">AI Kazus Yaratuvchi</h2>
            <p className="text-violet-200 text-xs mt-0.5">Savol + Javobni yuboring → AI avtomatik kazus yaratadi</p>
          </div>
          {(messages.length > 0 || yaratilganKazus) && (
            <button onClick={tozalash} className="ml-auto p-1.5 hover:bg-white/20 rounded-lg">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Ko'rsatma */}
      {messages.length === 0 && !yaratilganKazus && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="font-bold text-blue-800 text-sm">Qanday ishlatiladi?</p>
          </div>
          <ol className="space-y-2 pl-2">
            {[
              'Quyidagi maydonga kazus savoli VA model javobini birga yozing',
              'AI savol, javob, mavzu va turini ajratib oladi',
              'Avtomatik ravishda toplamlar bazasiga qo\'shiladi (START=OFF)',
              'Siz istagan payt START va Ommaviy tugmalarini bosasiz',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>

          {/* Misol tugmalari */}
          <div className="pt-2 space-y-2">
            <p className="text-xs font-bold text-blue-600 uppercase">Misol xabarlar:</p>
            {[
              {
                label: '📝 Oddiy kazus misoli',
                text: `Kazus:\nAbdullayev davlat mablag'larini o'zlashtirdi. Uning harakati qanday jinoyatga kiradi?\n\nJavob:\nAbdullayev O'zbekiston Respublikasi Jinoyat kodeksining 167-moddasi (korrupsiya) bo'yicha javobgarlikka tortiladi. Uning harakati davlat mablag'larini shaxsiy manfaat uchun o'zlashtirishdan iborat bo'lib, bu jinoyatning asosiy belgisi hisoblanadi.`,
              },
              {
                label: '⚖️ Protsesual hujjat misoli',
                text: `Savol:\nAyyubov 2024 yil 15 martda pora olish jinoyatini sodir etdi. Unga nisbatan aybnoma mazmunini tuzing.\n\nJavob:\nAybnoma:\n«15 mart 2024 yil kuni Ayyubov, vakolatidan suiiste'mol qilib, 5.000.000 so'm miqdorida noqonuniy mukofot (pora) qabul qilganligi uchun JK 210-moddasi 1-qismi bo'yicha ayblandi.»`,
              },
            ].map((ex, i) => (
              <button
                key={i}
                onClick={() => setInput(ex.text)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-all text-xs text-blue-700 font-semibold"
              >
                <span>{ex.label}</span>
                <ChevronRight className="h-3 w-3 ml-auto text-blue-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat xabarlari */}
      {messages.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                    <BrainCircuit className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-tr-sm whitespace-pre-wrap'
                    : 'bg-gray-50 text-gray-800 border border-gray-200 rounded-tl-sm'
                }`}>
                  {msg.parts[0].text}
                </div>
              </div>
            ))}
            {yuklanyapti && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                  <BrainCircuit className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Yaratilmoqda... */}
      {yaratilmoqda && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-bold text-amber-800 text-sm">Kazus avtomatik yaratilmoqda...</p>
            <p className="text-xs text-amber-600">Bazaga yozilmoqda, bir lahza</p>
          </div>
        </div>
      )}

      {/* Tahrirlash paneli (agar tahlil aniq bo'lsa lekin yaratilmagan) */}
      {tahlil && !yaratilganKazus && !yaratilmoqda && tahrirlash && (
        <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm overflow-hidden">
          <div className="bg-violet-50 px-4 py-3 border-b border-violet-100 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <p className="font-bold text-violet-800 text-sm">AI tahlil natijasi — tahrirlash mumkin</p>
          </div>
          <div className="p-4 space-y-3">
            {/* Mavzu */}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">Mavzu *</label>
              <input
                value={tahrirlash.mavzu || ''}
                onChange={e => setTahrirlash(prev => ({ ...prev, mavzu: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-violet-400 outline-none"
                placeholder="Kazus mavzusi..."
              />
            </div>

            {/* Model tur */}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">Model turi *</label>
              <div className="flex gap-2">
                {(['oddiy', 'protsesual'] as const).map(tur => (
                  <button
                    key={tur}
                    onClick={() => setTahrirlash(prev => ({ ...prev, model_tur: tur }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                      tahrirlash.model_tur === tur
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'
                    }`}
                  >
                    {tur === 'oddiy' ? '📝 Oddiy' : '⚖️ Protsesual'}
                  </button>
                ))}
              </div>
            </div>

            {/* Savol */}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">Kazus savoli (matn) *</label>
              <textarea
                value={tahrirlash.savol || ''}
                onChange={e => setTahrirlash(prev => ({ ...prev, savol: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-violet-400 outline-none resize-none"
                rows={4}
                placeholder="Kazus matni..."
              />
            </div>

            {/* Javob */}
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">Model javob *</label>
              <textarea
                value={tahrirlash.javob || ''}
                onChange={e => setTahrirlash(prev => ({ ...prev, javob: e.target.value }))}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:border-violet-400 outline-none resize-none"
                rows={5}
                placeholder="To'g'ri javob matni..."
              />
            </div>

            <button
              onClick={qoldaYaratish}
              className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <Zap className="h-4 w-4" />
              Bazaga Qo'shish
            </button>
          </div>
        </div>
      )}

      {/* Yaratilgan kazus kartochkasi */}
      {yaratilganKazus && (
        <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-lg overflow-hidden">
          <div className="bg-emerald-500 text-white px-4 py-3 flex items-center gap-2">
            <Check className="h-5 w-5" />
            <div>
              <p className="font-black text-sm">Kazus muvaffaqiyatli yaratildi!</p>
              <p className="text-emerald-100 text-xs">Start va ommaviy holatni siz boshqarasiz</p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-black text-gray-400 uppercase">Kod</p>
                <p className="font-black text-xl text-gray-900 tracking-widest">{yaratilganKazus.kod}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-black text-gray-400 uppercase">Tur</p>
                <p className="font-bold text-sm text-gray-800">{yaratilganKazus.model_tur === 'protsesual' ? '⚖️ Protsesual' : '📝 Oddiy'}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Mavzu</p>
              <p className="font-bold text-sm text-gray-800">{yaratilganKazus.mavzu}</p>
            </div>

            {/* Holat ko'rsatkichlari */}
            <div className="flex gap-2">
              <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold ${
                yaratilganKazus.is_active
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <div className={`w-2 h-2 rounded-full ${yaratilganKazus.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                {yaratilganKazus.is_active ? 'FAOL (Start berilgan)' : 'NOFAOL (Start berilmagan)'}
              </div>
              <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold ${
                yaratilganKazus.ommaviy
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}>
                <Globe className={`h-3 w-3 ${yaratilganKazus.ommaviy ? 'text-blue-500' : 'text-gray-400'}`} />
                {yaratilganKazus.ommaviy ? 'OMMAVIY' : 'YASHIRIN'}
              </div>
            </div>

            {/* Tugmalar */}
            <div className="grid grid-cols-2 gap-2">
              {/* Start / Stop */}
              <button
                onClick={yaratilganKazus.is_active ? stopBerish : startBerish}
                disabled={startYuklanyapti}
                className={`h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  yaratilganKazus.is_active
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {startYuklanyapti ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : yaratilganKazus.is_active ? (
                  <><X className="h-4 w-4" />STOP</>
                ) : (
                  <><Play className="h-4 w-4" />START</>
                )}
              </button>

              {/* Ommaviy */}
              <button
                onClick={ommalashtrish}
                disabled={ommaYuklanyapti}
                className={`h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  yaratilganKazus.ommaviy
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {ommaYuklanyapti ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : yaratilganKazus.ommaviy ? (
                  <><X className="h-4 w-4" />Yashirish</>
                ) : (
                  <><Globe className="h-4 w-4" />Ommaviy</>
                )}
              </button>
            </div>

            {/* Yangi kazus yaratish */}
            <button
              onClick={tozalash}
              className="w-full h-10 border-2 border-dashed border-gray-200 hover:border-violet-400 text-gray-400 hover:text-violet-600 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Yangi kazus yaratish
            </button>
          </div>
        </div>
      )}

      {/* Input maydoni */}
      {!yaratilganKazus && (
        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm p-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.ctrlKey) aiGaYuborish();
            }}
            placeholder="Kazus savoli va model javobini bu yerga yozing...

Masalan:
Savol: Karimov mansab vazifasidan suiiste'mol qildi...
Javob: JK 205-modda bo'yicha..."
            rows={6}
            className="w-full px-3 py-2 text-sm text-gray-800 resize-none outline-none placeholder-gray-400 leading-relaxed"
            disabled={yuklanyapti}
          />
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Ctrl+Enter — yuborish</p>
            <button
              onClick={() => aiGaYuborish()}
              disabled={!input.trim() || yuklanyapti}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white font-bold text-sm rounded-xl transition-all active:scale-95"
            >
              {yuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              AI ga yuborish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
