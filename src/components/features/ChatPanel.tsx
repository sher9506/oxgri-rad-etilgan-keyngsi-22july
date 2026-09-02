import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle, Plus, Search, Send, Paperclip, Trash2,
  Users, Lock, Unlock, UserPlus, Settings, X, Check,
  Crown, Shield, User as UserIcon, Image, FileText,
  ChevronLeft, Hash, MoreVertical, Edit3, Camera,
  Loader2, AlertCircle, Download, Eye, UserMinus,
  Globe, ShieldOff
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// ── TYPES ──────────────────────────────────────────────────────────────────
interface Chat {
  id: string;
  tur: 'guruh' | 'shaxsiy';
  nomi: string | null;
  rasm_url: string | null;
  tavsif: string | null;
  yaratuvchi_id: string;
  yaratuvchi_tur: string;
  qoshish_ruxsat: boolean;
  ommaviy: boolean;
  created_at: string;
  // computed
  mening_rolim?: 'ega' | 'admin' | 'azo';
  azo_soni?: number;
  oxirgi_habar?: string;
  oxirgi_vaqt?: string;
  azomi?: boolean; // qidiruv natijasida — azomizmi yoki yo'q
}

interface ChatAzo {
  id: string;
  chat_id: string;
  azo_id: string;
  azo_ism: string;
  azo_tur: 'oquvchi' | 'ustoz' | 'admin';
  rol: 'ega' | 'admin' | 'azo';
  created_at: string;
}

interface Habar {
  id: string;
  chat_id: string;
  yuboruvchi_id: string;
  yuboruvchi_ism: string;
  yuboruvchi_tur: 'oquvchi' | 'ustoz' | 'admin';
  matn: string | null;
  fayl_url: string | null;
  fayl_tur: string | null;
  fayl_nom: string | null;
  ochirilgan: boolean;
  created_at: string;
}

interface UstozInfo {
  id: string;
  full_name: string;
  status: string;
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function vaqtFormat(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Hozirgina';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}d oldin`;
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('uz', { day: '2-digit', month: '2-digit' });
}

function avatarRengi(ism: string): string {
  const colors = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-600',
    'from-rose-500 to-pink-600',
    'from-indigo-500 to-blue-600',
  ];
  let sum = 0;
  for (let i = 0; i < ism.length; i++) sum += ism.charCodeAt(i);
  return colors[sum % colors.length];
}

function initials(ism: string): string {
  const parts = ism.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return ism.slice(0, 2).toUpperCase();
}

// ── AVATAR ─────────────────────────────────────────────────────────────────
function Avatar({ ism, rasmUrl, hajm = 'md' }: { ism: string; rasmUrl?: string | null; hajm?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-8 h-8 text-[10px]', md: 'w-10 h-10 text-xs', lg: 'w-14 h-14 text-base' };
  if (rasmUrl) return (
    <img src={rasmUrl} alt={ism} className={`${sizes[hajm]} rounded-full object-cover flex-shrink-0`} />
  );
  return (
    <div className={`${sizes[hajm]} rounded-full bg-gradient-to-br ${avatarRengi(ism)} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials(ism)}
    </div>
  );
}

// ── ROL BADGE ──────────────────────────────────────────────────────────────
function RolBadge({ rol }: { rol: string }) {
  if (rol === 'ega') return <Crown className="h-3 w-3 text-amber-400" title="Ega" />;
  if (rol === 'admin') return <Shield className="h-3 w-3 text-blue-400" title="Admin" />;
  return null;
}

// ── GURUH YARATISH MODAL ───────────────────────────────────────────────────
function GuruhYaratishModal({
  onClose, onYaratildi, meningId, meningIsm, meningTur
}: {
  onClose: () => void;
  onYaratildi: (chat: Chat) => void;
  meningId: string;
  meningIsm: string;
  meningTur: 'oquvchi' | 'ustoz' | 'admin';
}) {
  const [nomi, setNomi] = useState('');
  const [tavsif, setTavsif] = useState('');
  const [qoshishRuxsat, setQoshishRuxsat] = useState(true);
  const [ommaviy, setOmmaviy] = useState(false);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const { toast } = useToast();

  const yaratish = async () => {
    if (!nomi.trim()) { toast({ title: 'Xato', description: 'Guruh nomini kiriting', variant: 'destructive' }); return; }
    setYuklanyapti(true);
    try {
      const { data: chat, error } = await supabase.from('chatlar').insert({
        tur: 'guruh',
        nomi: nomi.trim(),
        tavsif: tavsif.trim() || null,
        yaratuvchi_id: meningId,
        yaratuvchi_tur: meningTur,
        qoshish_ruxsat: qoshishRuxsat,
        ommaviy,
      }).select().single();
      if (error) throw error;

      await supabase.from('chat_azolar').insert({
        chat_id: chat.id,
        azo_id: meningId,
        azo_ism: meningIsm,
        azo_tur: meningTur,
        rol: 'ega',
      });

      toast({ title: '✅ Guruh yaratildi!', description: nomi });
      onYaratildi({ ...chat, mening_rolim: 'ega', azo_soni: 1 });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Users className="h-5 w-5" />
            <h2 className="font-bold text-lg">Yangi guruh</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Guruh nomi *</label>
            <input
              value={nomi} onChange={e => setNomi(e.target.value)}
              placeholder="Masalan: 1-kurs A-1 guruh"
              className="w-full bg-[#0d0d0d] border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Tavsif (ixtiyoriy)</label>
            <textarea
              value={tavsif} onChange={e => setTavsif(e.target.value)}
              placeholder="Guruh haqida qisqacha..."
              rows={2}
              className="w-full bg-[#0d0d0d] border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>

          {/* A'zo qo'shish ruxsati */}
          <div
            onClick={() => setQoshishRuxsat(!qoshishRuxsat)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${qoshishRuxsat ? 'border-violet-500 bg-violet-500/10' : 'border-white/10 bg-white/5'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${qoshishRuxsat ? 'bg-violet-500/20' : 'bg-white/10'}`}>
              {qoshishRuxsat ? <Unlock className="h-5 w-5 text-violet-400" /> : <Lock className="h-5 w-5 text-gray-500" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${qoshishRuxsat ? 'text-violet-300' : 'text-gray-400'}`}>
                {qoshishRuxsat ? "Har kim a'zo qo'sha oladi" : "Faqat admin/ega a'zo qo'sha oladi"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">A'zo qo'shish huquqi</p>
            </div>
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${qoshishRuxsat ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`}>
              {qoshishRuxsat && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>

          {/* Ommaviy / Maxfiy */}
          <div
            onClick={() => setOmmaviy(!ommaviy)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${ommaviy ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ommaviy ? 'bg-emerald-500/20' : 'bg-white/10'}`}>
              {ommaviy ? <Globe className="h-5 w-5 text-emerald-400" /> : <Lock className="h-5 w-5 text-gray-500" />}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${ommaviy ? 'text-emerald-300' : 'text-gray-400'}`}>
                {ommaviy ? "Ommaviy — qidiruvda ko'rinadi" : "Maxfiy — faqat a'zolarga ko'rinadi"}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Guruh ko'rinishi</p>
            </div>
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${ommaviy ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
              {ommaviy && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>

          <button
            onClick={yaratish} disabled={yuklanyapti || !nomi.trim()}
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {yuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Guruh yaratish
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SHAXSIY CHAT MODAL ─────────────────────────────────────────────────────
function ShaxsiyModal({
  onClose, onYaratildi, meningId, meningIsm, meningTur, mavjudChatlar
}: {
  onClose: () => void;
  onYaratildi: (chat: Chat) => void;
  meningId: string;
  meningIsm: string;
  meningTur: 'oquvchi' | 'ustoz' | 'admin';
  mavjudChatlar: Chat[];
}) {
  const [ustozlar, setUstozlar] = useState<UstozInfo[]>([]);
  const [tasdiqlananOquvchilar, setTasdiqlananOquvchilar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('ustoz').select('id, full_name, status').eq('status', 'approved')
      .then(({ data }) => setUstozlar(data || []));
    // Face ID tasdiqlangan o'quvchilarni yuklash
    supabase.from('talabalar').select('id, ism, familiya, kurs, guruh')
      .not('face_descriptor', 'is', null)
      .then(({ data }) => setTasdiqlananOquvchilar(data || []));
  }, []);

  const suhbatBoshlash = async (target: { id: string; ism: string; tur: 'ustoz' | 'admin' }) => {
    setYuklanyapti(true);
    try {
      const existing = mavjudChatlar.find(c =>
        c.tur === 'shaxsiy' && (
          c.yaratuvchi_id === target.id ||
          c.yaratuvchi_id === meningId
        )
      );
      if (existing) { onYaratildi(existing); onClose(); return; }

      const nomi = `${meningIsm} ↔ ${target.ism}`;
      const { data: chat, error } = await supabase.from('chatlar').insert({
        tur: 'shaxsiy',
        nomi,
        yaratuvchi_id: meningId,
        yaratuvchi_tur: meningTur,
        qoshish_ruxsat: false,
        ommaviy: false,
      }).select().single();
      if (error) throw error;

      await supabase.from('chat_azolar').insert([
        { chat_id: chat.id, azo_id: meningId, azo_ism: meningIsm, azo_tur: meningTur, rol: 'azo' },
        { chat_id: chat.id, azo_id: target.id, azo_ism: target.ism, azo_tur: target.tur, rol: 'azo' },
      ]);

      onYaratildi({ ...chat, mening_rolim: 'azo', azo_soni: 2 });
      onClose();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const targets: { id: string; ism: string; tur: 'oquvchi' | 'ustoz' | 'admin'; extra?: string }[] = [
    { id: 'admin', ism: 'Admin', tur: 'admin' },
    ...ustozlar.filter(u => u.id !== meningId).map(u => ({ id: u.id, ism: u.full_name, tur: 'ustoz' as const })),
    ...tasdiqlananOquvchilar
      .filter(t => `${t.ism}|${t.familiya}` !== meningId)
      .map(t => ({ id: `${t.ism}|${t.familiya}`, ism: `${t.ism} ${t.familiya}`, tur: 'oquvchi' as const, extra: `${t.kurs || ''} ${t.guruh || ''}`.trim() })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle className="h-5 w-5" />
            <h2 className="font-bold">Shaxsiy chat boshlash</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4">
          <p className="text-xs text-gray-500 mb-3">Ustoz yoki admin bilan suhbat boshlang</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {targets.map(t => (
              <button key={t.id} onClick={() => suhbatBoshlash(t)} disabled={yuklanyapti}
                className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] hover:bg-white/5 border border-white/10 hover:border-cyan-500/50 rounded-xl transition-all text-left">
                <Avatar ism={t.ism} hajm="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{t.ism}</p>
                  <p className="text-xs text-gray-500">
                    {t.tur === 'admin' ? '🔴 Admin' : t.tur === 'ustoz' ? '👨‍🏫 Ustoz' : "👨‍🎓 O'quvchi"}
                    {t.extra && ` • ${t.extra}`}
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── A'ZO QO'SHISH MODAL ────────────────────────────────────────────────────
function AzoQoshishModal({
  chatId, chatNomi, mavjudAzolar, onClose, onQoshildi
}: {
  chatId: string;
  chatNomi: string;
  mavjudAzolar: ChatAzo[];
  onClose: () => void;
  onQoshildi: () => void;
}) {
  const [qidiruv, setQidiruv] = useState('');
  const [talabalar, setTalabalar] = useState<any[]>([]);
  const [ustozlar, setUstozlar] = useState<UstozInfo[]>([]);
  const [tasdiqlananOquvchilar, setTasdiqlananOquvchilar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('talabalar').select('id, ism, familiya, kurs, guruh').then(({ data }) => setTalabalar(data || []));
    supabase.from('ustoz').select('id, full_name, status').eq('status', 'approved').then(({ data }) => setUstozlar(data || []));
  }, []);

  const mavjudIds = new Set(mavjudAzolar.map(a => a.azo_id));

  const barcha = [
    { id: 'admin', ism: 'Admin', tur: 'admin' as const },
    ...ustozlar.map(u => ({ id: u.id, ism: u.full_name, tur: 'ustoz' as const })),
    ...talabalar.map(t => ({ id: `${t.ism}|${t.familiya}`, ism: `${t.ism} ${t.familiya}`, tur: 'oquvchi' as const, extra: `${t.kurs || ''} ${t.guruh || ''}`.trim() })),
  ].filter(x => !mavjudIds.has(x.id));

  const filtred = qidiruv ? barcha.filter(x => x.ism.toLowerCase().includes(qidiruv.toLowerCase())) : barcha;

  const qoshish = async (azo: any) => {
    setYuklanyapti(true);
    try {
      await supabase.from('chat_azolar').insert({
        chat_id: chatId, azo_id: azo.id, azo_ism: azo.ism, azo_tur: azo.tur, rol: 'azo',
      });
      toast({ title: "✅ Qo'shildi", description: `${azo.ism} guruhga qo'shildi` });
      onQoshildi();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5" />
            <h2 className="font-bold">A'zo qo'shish</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input value={qidiruv} onChange={e => setQidiruv(e.target.value)}
              placeholder="Qidirish..."
              className="w-full bg-[#0d0d0d] border border-white/10 text-white placeholder-gray-600 pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {filtred.length === 0 ? (
              <p className="text-center text-gray-600 text-sm py-8">Topilmadi</p>
            ) : filtred.slice(0, 30).map(x => (
              <button key={x.id} onClick={() => qoshish(x)} disabled={yuklanyapti}
                className="w-full flex items-center gap-3 p-2.5 bg-[#0d0d0d] hover:bg-white/5 border border-white/10 hover:border-emerald-500/50 rounded-xl transition-all text-left">
                <Avatar ism={x.ism} hajm="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{x.ism}</p>
                  <p className="text-[10px] text-gray-600">
                    {x.tur === 'admin' ? 'Admin' : x.tur === 'ustoz' ? 'Ustoz' : "O'quvchi"}
                    {(x as any).extra && ` • ${(x as any).extra}`}
                  </p>
                </div>
                <Plus className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GURUH SOZLAMALARI MODAL ────────────────────────────────────────────────
function GuruhSozlamalariModal({
  chat, azolar, meningRol, meningId, onClose, onYangilandi, onChiqish
}: {
  chat: Chat;
  azolar: ChatAzo[];
  meningRol: 'ega' | 'admin' | 'azo';
  meningId: string;
  onClose: () => void;
  onYangilandi: () => void;
  onChiqish: () => void;
}) {
  const [nomi, setNomi] = useState(chat.nomi || '');
  const [tavsif, setTavsif] = useState(chat.tavsif || '');
  const [qoshishRuxsat, setQoshishRuxsat] = useState(chat.qoshish_ruxsat);
  const [ommaviy, setOmmaviy] = useState(chat.ommaviy || false);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [tab, setTab] = useState<'info' | 'azolar'>('info');
  const { toast } = useToast();

  const isEgaYaAdmin = meningRol === 'ega' || meningRol === 'admin';

  const saqlash = async () => {
    setYuklanyapti(true);
    try {
      const yangilanadi: any = { nomi, tavsif, qoshish_ruxsat: qoshishRuxsat };
      // Faqat ega ommaviy sozlamasini o'zgartira oladi
      if (meningRol === 'ega') {
        yangilanadi.ommaviy = ommaviy;
      }
      await supabase.from('chatlar').update(yangilanadi).eq('id', chat.id);
      toast({ title: '✅ Saqlandi' });
      onYangilandi();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const rolOzgartirish = async (azo: ChatAzo, yangiRol: 'admin' | 'azo') => {
    await supabase.from('chat_azolar').update({ rol: yangiRol }).eq('id', azo.id);
    toast({ title: `${azo.azo_ism} → ${yangiRol === 'admin' ? 'Admin qilindi' : 'Oddiy a\'zoga o\'tkazildi'}` });
    onYangilandi();
  };

  const azoChiqarish = async (azo: ChatAzo) => {
    await supabase.from('chat_azolar').delete().eq('id', azo.id);
    toast({ title: `${azo.azo_ism} chiqarildi` });
    onYangilandi();
  };

  const ozimChiqish = async () => {
    await supabase.from('chat_azolar').delete().eq('chat_id', chat.id).eq('azo_id', meningId);
    onChiqish();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-[#1e1e1e] to-[#2a2a2a] px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5 text-gray-400" />
            <h2 className="font-bold">Guruh sozlamalari</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 p-2 bg-[#0d0d0d] border-b border-white/10">
          {(['info', 'azolar'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t === 'info' ? "⚙️ Ma'lumot" : `👥 A'zolar (${azolar.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'info' && (
            <div className="space-y-4">
              {isEgaYaAdmin && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block font-semibold">Guruh nomi</label>
                    <input value={nomi} onChange={e => setNomi(e.target.value)}
                      className="w-full bg-[#0d0d0d] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block font-semibold">Tavsif</label>
                    <textarea value={tavsif} onChange={e => setTavsif(e.target.value)} rows={2}
                      className="w-full bg-[#0d0d0d] border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>
                  {/* A'zo qo'shish ruxsati */}
                  <div onClick={() => setQoshishRuxsat(!qoshishRuxsat)}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${qoshishRuxsat ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10 bg-white/5'}`}>
                    {qoshishRuxsat ? <Unlock className="h-4 w-4 text-violet-400" /> : <Lock className="h-4 w-4 text-gray-500" />}
                    <div className="flex-1">
                      <p className="text-xs text-gray-300">{qoshishRuxsat ? "Har kim a'zo qo'sha oladi" : "Faqat admin/ega a'zo qo'sha oladi"}</p>
                      <p className="text-[10px] text-gray-600">A'zo qo'shish huquqi</p>
                    </div>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${qoshishRuxsat ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`}>
                      {qoshishRuxsat && <Check className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                  {/* Ommaviy/Maxfiy — faqat EGA */}
                  {meningRol === 'ega' && (
                    <div onClick={() => setOmmaviy(!ommaviy)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${ommaviy ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                      {ommaviy ? <Globe className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-gray-500" />}
                      <div className="flex-1">
                        <p className="text-xs text-gray-300">{ommaviy ? "Ommaviy — qidiruvda ko'rinadi" : "Maxfiy — faqat a'zolarga ko'rinadi"}</p>
                        <p className="text-[10px] text-gray-600">Guruh ko'rinishi (faqat ega o'zgartira oladi)</p>
                      </div>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${ommaviy ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'}`}>
                        {ommaviy && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                  )}
                  <button onClick={saqlash} disabled={yuklanyapti}
                    className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
                    {yuklanyapti ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                </>
              )}
              <button onClick={ozimChiqish}
                className="w-full py-2.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                <UserMinus className="h-4 w-4" />Guruhdan chiqish
              </button>
            </div>
          )}

          {tab === 'azolar' && (
            <div className="space-y-2">
              {azolar.map(azo => (
                <div key={azo.id} className="flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-xl border border-white/5">
                  <Avatar ism={azo.azo_ism} hajm="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white font-medium truncate">{azo.azo_ism}</p>
                      <RolBadge rol={azo.rol} />
                    </div>
                    <p className="text-[10px] text-gray-600">
                      {azo.azo_tur === 'admin' ? 'Admin' : azo.azo_tur === 'ustoz' ? 'Ustoz' : "O'quvchi"}
                      {' '}• {azo.rol === 'ega' ? '👑 Ega' : azo.rol === 'admin' ? '🛡 Admin' : "A'zo"}
                    </p>
                  </div>
                  {/* Admin tayinlash — faqat EGA */}
                  {meningRol === 'ega' && azo.azo_id !== meningId && azo.rol !== 'ega' && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => rolOzgartirish(azo, azo.rol === 'admin' ? 'azo' : 'admin')}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${azo.rol === 'admin' ? 'border-blue-500/50 text-blue-400 bg-blue-500/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50' : 'border-white/10 text-gray-500 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/10'}`}
                        title={azo.rol === 'admin' ? "Admin'dan olish" : 'Admin tayinlash'}
                      >
                        {azo.rol === 'admin' ? '🛡 Admin ↓' : '🛡 Admin ↑'}
                      </button>
                      <button onClick={() => azoChiqarish(azo)}
                        className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Guruhdan chiqarish">
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {/* Admin: chiqarish uchun (o'zi boshqa a'zolarni chiqara oladi, egani emas) */}
                  {meningRol === 'admin' && azo.azo_id !== meningId && azo.rol === 'azo' && (
                    <button onClick={() => azoChiqarish(azo)}
                      className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Guruhdan chiqarish">
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── OMMAVIY GURUHLAR QIDIRUV MODAL ─────────────────────────────────────────
function OmmaviyGuruhlarModal({
  onClose, meningId, meningIsm, meningTur, onKirildi
}: {
  onClose: () => void;
  meningId: string;
  meningIsm: string;
  meningTur: 'oquvchi' | 'ustoz' | 'admin';
  onKirildi: (chat: Chat) => void;
}) {
  const [guruhlar, setGuruhlar] = useState<Chat[]>([]);
  const [qidiruv, setQidiruv] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [qoshilmoqda, setQoshilmoqda] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const yuklash = async () => {
      setYuklanyapti(true);
      const { data } = await supabase
        .from('chatlar')
        .select('*')
        .eq('tur', 'guruh')
        .eq('ommaviy', true)
        .order('created_at', { ascending: false });

      // A'zo sonini hisoblash
      if (data && data.length > 0) {
        const ids = data.map((c: any) => c.id);
        const { data: azolar } = await supabase.from('chat_azolar').select('chat_id').in('chat_id', ids);
        const azoMap = new Map<string, number>();
        (azolar || []).forEach((a: any) => azoMap.set(a.chat_id, (azoMap.get(a.chat_id) || 0) + 1));

        // Mening azomligimni tekshirish
        const { data: mening } = await supabase.from('chat_azolar').select('chat_id').eq('azo_id', meningId).in('chat_id', ids);
        const meningChatIds = new Set((mening || []).map((a: any) => a.chat_id));

        setGuruhlar(data.map((c: any) => ({
          ...c,
          azo_soni: azoMap.get(c.id) || 0,
          azomi: meningChatIds.has(c.id),
        })));
      } else {
        setGuruhlar([]);
      }
      setYuklanyapti(false);
    };
    yuklash();
  }, [meningId]);

  const guruhgaQoshilish = async (chat: Chat) => {
    setQoshilmoqda(chat.id);
    try {
      await supabase.from('chat_azolar').insert({
        chat_id: chat.id,
        azo_id: meningId,
        azo_ism: meningIsm,
        azo_tur: meningTur,
        rol: 'azo',
      });
      toast({ title: "✅ Guruhga qo'shildingiz!", description: chat.nomi || '' });
      onKirildi({ ...chat, mening_rolim: 'azo', azomi: true });
      onClose();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setQoshilmoqda(null);
    }
  };

  const filtred = qidiruv
    ? guruhlar.filter(g => g.nomi?.toLowerCase().includes(qidiruv.toLowerCase()) || g.tavsif?.toLowerCase().includes(qidiruv.toLowerCase()))
    : guruhlar;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Globe className="h-5 w-5" />
            <h2 className="font-bold">Ommaviy guruhlar</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input value={qidiruv} onChange={e => setQidiruv(e.target.value)}
              placeholder="Guruh qidirish..."
              className="w-full bg-[#0d0d0d] border border-white/10 text-white placeholder-gray-600 pl-9 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {yuklanyapti ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 text-emerald-400 animate-spin" /></div>
          ) : filtred.length === 0 ? (
            <div className="py-12 text-center">
              <Globe className="h-10 w-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">Hozircha ommaviy guruh yo'q</p>
            </div>
          ) : filtred.map(g => (
            <div key={g.id} className="bg-[#0d0d0d] border border-white/10 rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                {g.rasm_url ? <img src={g.rasm_url} alt="" className="w-full h-full rounded-full object-cover" /> : <Hash className="h-5 w-5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{g.nomi}</p>
                {g.tavsif && <p className="text-gray-500 text-xs truncate mt-0.5">{g.tavsif}</p>}
                <p className="text-gray-600 text-[10px] mt-1">{g.azo_soni || 0} a'zo</p>
              </div>
              {g.azomi ? (
                <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold flex-shrink-0">
                  <Check className="h-4 w-4" />A'zosiz
                </div>
              ) : (
                <button
                  onClick={() => guruhgaQoshilish(g)}
                  disabled={qoshilmoqda === g.id}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                >
                  {qoshilmoqda === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Kirish
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HABAR KOMPONENTI ───────────────────────────────────────────────────────
function HabarCard({
  habar, meningId, onOchirish, isGuruh, bloklangan, onBlok
}: {
  habar: Habar;
  meningId: string;
  onOchirish: (id: string) => void;
  isGuruh: boolean;
  bloklangan?: Set<string>;
  onBlok?: (userId: string, ism: string) => void;
}) {
  const mening = habar.yuboruvchi_id === meningId;
  const vaqt = new Date(habar.created_at).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
  const isBloklangan = bloklangan?.has(habar.yuboruvchi_id) || false;

  if (habar.ochirilgan) {
    return (
      <div className={`flex ${mening ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-2xl border border-white/5">
          <Trash2 className="h-3 w-3 text-gray-600" />
          <span className="text-xs text-gray-600 italic">Habar o'chirildi</span>
        </div>
      </div>
    );
  }

  if (isBloklangan && !mening) {
    return null;
  }

  return (
    <div className={`flex ${mening ? 'justify-end' : 'justify-start'} mb-2 group`}>
      {!mening && (
        <div className="mr-2 self-end mb-0.5">
          <Avatar ism={habar.yuboruvchi_ism} hajm="sm" />
        </div>
      )}
      <div className={`max-w-[75%] ${mening ? 'items-end' : 'items-start'} flex flex-col`}>
        {!mening && isGuruh && (
          <p className={`text-[10px] font-semibold mb-1 px-1 ${
            habar.yuboruvchi_tur === 'admin' ? 'text-red-400' :
            habar.yuboruvchi_tur === 'ustoz' ? 'text-amber-400' : 'text-cyan-400'
          }`}>{habar.yuboruvchi_ism}</p>
        )}
        <div className="relative">
          <div className={`relative px-4 py-2.5 rounded-2xl ${
            mening
              ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white rounded-br-sm'
              : 'bg-[#1e1e1e] text-gray-100 border border-white/10 rounded-bl-sm'
          }`}>
            {habar.fayl_url && (
              <div className="mb-2">
                {habar.fayl_tur === 'rasm' ? (
                  <img src={habar.fayl_url} alt={habar.fayl_nom || 'rasm'}
                    className="max-w-[200px] max-h-[200px] rounded-xl object-cover cursor-pointer"
                    onClick={() => window.open(habar.fayl_url!, '_blank')} />
                ) : (
                  <a href={habar.fayl_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 bg-black/20 rounded-xl hover:bg-black/30 transition-all">
                    <div className={`p-2 rounded-lg ${habar.fayl_tur === 'pdf' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{habar.fayl_nom}</p>
                      <p className="text-[10px] text-white/60 uppercase">{habar.fayl_tur}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-white/60" />
                  </a>
                )}
              </div>
            )}
            {habar.matn && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{habar.matn}</p>}
            <div className={`flex items-center justify-end gap-1 mt-1 ${mening ? 'text-white/50' : 'text-gray-600'}`}>
              <span className="text-[9px]">{vaqt}</span>
            </div>
          </div>
          {/* Amallar: o'chirish + blok */}
          <div className={`absolute ${mening ? '-left-16' : '-right-16'} top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all`}>
            <button
              onClick={() => onOchirish(habar.id)}
              className="p-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg hover:bg-red-900/30 hover:border-red-900/50"
              title="Habarni o'chirish"
            >
              <Trash2 className="h-3 w-3 text-red-400" />
            </button>
            {!mening && onBlok && (
              <button
                onClick={() => onBlok(habar.yuboruvchi_id, habar.yuboruvchi_ism)}
                className="p-1.5 bg-[#1a1a1a] border border-white/10 rounded-lg hover:bg-orange-900/30 hover:border-orange-900/50"
                title={isBloklangan ? 'Blokdan chiqarish' : 'Bloklash'}
              >
                {isBloklangan
                  ? <Eye className="h-3 w-3 text-orange-400" />
                  : <UserMinus className="h-3 w-3 text-orange-400" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ASOSIY CHAT PANELI
// ════════════════════════════════════════════════════════════════════════════
export default function ChatPanel() {
  const { user } = useAuth();
  const { toast } = useToast();

  const meningId = user
    ? user.rol === 'ustoz' && user.ustoz_id
      ? user.ustoz_id
      : `${user.ism}|${user.familiya}`
    : 'admin';
  const meningIsm = user ? `${user.ism} ${user.familiya}` : 'Admin';
  const meningTur = user
    ? (user.rol === 'ustoz' ? 'ustoz' : 'oquvchi') as 'oquvchi' | 'ustoz' | 'admin'
    : 'admin';

  // Face ID tekshiruvi (o'quvchilar uchun)
  const [faceIdTasdiqlangan, setFaceIdTasdiqlangan] = useState<boolean | null>(null);

  // ── Tablar: chatlar | guruhlar ──
  const [activeTab, setActiveTab] = useState<'chatlar' | 'guruhlar'>('chatlar');

  const [chatlar, setChatlar] = useState<Chat[]>([]);
  const [tanlanganChat, setTanlanganChat] = useState<Chat | null>(null);
  const [habarlar, setHabarlar] = useState<Habar[]>([]);
  const [azolar, setAzolar] = useState<ChatAzo[]>([]);
  const [matn, setMatn] = useState('');
  const [qidiruv, setQidiruv] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [habarYuklanyapti, setHabarYuklanyapti] = useState(false);
  const [faylYuklanyapti, setFaylYuklanyapti] = useState(false);

  const [showGuruhModal, setShowGuruhModal] = useState(false);
  const [showShaxsiyModal, setShowShaxsiyModal] = useState(false);
  const [showAzoModal, setShowAzoModal] = useState(false);
  const [showSozlamalar, setShowSozlamalar] = useState(false);
  const [showOmmaviy, setShowOmmaviy] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  // Bloklangan foydalanuvchilar (localStorage ga saqlanadi)
  const [bloklangan, setBloklangan] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('chat_bloklangan');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const togBlok = (userId: string, ism: string) => {
    setBloklangan(prev => {
      const yangi = new Set(prev);
      if (yangi.has(userId)) {
        yangi.delete(userId);
        toast({ title: `${ism} blokdan chiqarildi` });
      } else {
        yangi.add(userId);
        toast({ title: `${ism} bloklandi`, description: 'Uning xabarlari ko\'rinmaydi' });
      }
      localStorage.setItem('chat_bloklangan', JSON.stringify([...yangi]));
      return yangi;
    });
  };

  const habarlarRef = useRef<HTMLDivElement>(null);
  const faylInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ── Face ID tekshiruvi ─────────────────────────────────────────────────
  useEffect(() => {
    const tekshirish = async () => {
      if (!user) { setFaceIdTasdiqlangan(false); return; }
      if (user.rol !== 'oquvchi') { setFaceIdTasdiqlangan(true); return; }
      // LoginModal orqali Face ID bilan ro'yxatdan o'tgan bo'lsa — ruxsat
      const persistentUser = localStorage.getItem('huquq_persistent_user');
      if (persistentUser) {
        try {
          const data = JSON.parse(persistentUser);
          if (data.faceIdTasdiqlangan === true) { setFaceIdTasdiqlangan(true); return; }
        } catch {}
      }
      // DB dan tekshirish (oldin Face ID saqlangan bo'lsa)
      const { data } = await supabase
        .from('talabalar')
        .select('face_descriptor')
        .eq('ism', user.ism)
        .eq('familiya', user.familiya)
        .maybeSingle();
      const tasdiqlangan = !!(data?.face_descriptor && Array.isArray(data.face_descriptor) && data.face_descriptor.length > 0);
      setFaceIdTasdiqlangan(tasdiqlangan);
    };
    tekshirish();
  }, [user]);

  // ── Chat loading ───────────────────────────────────────────────────────
  const chatlarniYuklash = useCallback(async () => {
    try {
      const { data: azoData } = await supabase
        .from('chat_azolar')
        .select('chat_id, rol')
        .eq('azo_id', meningId);

      if (!azoData || azoData.length === 0) { setChatlar([]); return; }

      const chatIds = azoData.map(a => a.chat_id);
      const rolMap = new Map(azoData.map(a => [a.chat_id, a.rol]));

      const { data: chatData } = await supabase
        .from('chatlar')
        .select('*')
        .in('id', chatIds)
        .order('created_at', { ascending: false });

      if (!chatData) return;

      const { data: azoSoniData } = await supabase
        .from('chat_azolar')
        .select('chat_id')
        .in('chat_id', chatIds);

      const azoSoniMap = new Map<string, number>();
      (azoSoniData || []).forEach(a => {
        azoSoniMap.set(a.chat_id, (azoSoniMap.get(a.chat_id) || 0) + 1);
      });

      const { data: oxirgilar } = await supabase
        .from('chat_habarlar')
        .select('chat_id, matn, fayl_tur, created_at')
        .in('chat_id', chatIds)
        .eq('ochirilgan', false)
        .order('created_at', { ascending: false });

      const oxirgiMap = new Map<string, any>();
      (oxirgilar || []).forEach(h => {
        if (!oxirgiMap.has(h.chat_id)) oxirgiMap.set(h.chat_id, h);
      });

      const yangilar: Chat[] = chatData.map(c => ({
        ...c,
        mening_rolim: rolMap.get(c.id) as 'ega' | 'admin' | 'azo',
        azo_soni: azoSoniMap.get(c.id) || 0,
        oxirgi_habar: oxirgiMap.get(c.id)?.matn || (oxirgiMap.get(c.id)?.fayl_tur ? '📎 Fayl' : ''),
        oxirgi_vaqt: oxirgiMap.get(c.id)?.created_at || c.created_at,
      }));

      yangilar.sort((a, b) => new Date(b.oxirgi_vaqt!).getTime() - new Date(a.oxirgi_vaqt!).getTime());
      setChatlar(yangilar);
    } catch (e) {
      console.error('Chatlar yuklash xato:', e);
    }
  }, [meningId]);

  // ── Habarlar loading ───────────────────────────────────────────────────
  const habarlarniYuklash = useCallback(async (chatId: string, silent = false) => {
    if (!silent) setHabarYuklanyapti(true);
    try {
      const { data } = await supabase
        .from('chat_habarlar')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(200);
      setHabarlar(data || []);
    } catch (e) {
      console.error('Habarlar xato:', e);
    } finally {
      if (!silent) setHabarYuklanyapti(false);
    }
  }, []);

  const azolarniYuklash = useCallback(async (chatId: string) => {
    const { data } = await supabase.from('chat_azolar').select('*').eq('chat_id', chatId);
    setAzolar(data || []);
  }, []);

  useEffect(() => {
    if (user) {
      chatlarniYuklash();
      const interval = setInterval(chatlarniYuklash, 10000);
      return () => clearInterval(interval);
    }
  }, [chatlarniYuklash, user]);

  useEffect(() => {
    if (!tanlanganChat) { setHabarlar([]); setAzolar([]); return; }
    habarlarniYuklash(tanlanganChat.id);
    azolarniYuklash(tanlanganChat.id);

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      habarlarniYuklash(tanlanganChat.id, true);
    }, 3000);

    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [tanlanganChat?.id]);

  useEffect(() => {
    if (habarlarRef.current) {
      habarlarRef.current.scrollTop = habarlarRef.current.scrollHeight;
    }
  }, [habarlar]);

  // ── Habar yuborish ─────────────────────────────────────────────────────
  const habarYuborish = async () => {
    if (!matn.trim() || !tanlanganChat) return;
    const matnVal = matn.trim();
    setMatn('');
    try {
      await supabase.from('chat_habarlar').insert({
        chat_id: tanlanganChat.id,
        yuboruvchi_id: meningId,
        yuboruvchi_ism: meningIsm,
        yuboruvchi_tur: meningTur,
        matn: matnVal,
      });
      habarlarniYuklash(tanlanganChat.id, true);
      chatlarniYuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
      setMatn(matnVal);
    }
  };

  // ── Fayl yuklash ───────────────────────────────────────────────────────
  const faylYuklash = async (file: File) => {
    if (!tanlanganChat) return;
    setFaylYuklanyapti(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const tur = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'rasm' :
                  ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'boshqa';
      const path = `${tanlanganChat.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage.from('chat-fayllar').upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('chat-fayllar').getPublicUrl(path);

      await supabase.from('chat_habarlar').insert({
        chat_id: tanlanganChat.id,
        yuboruvchi_id: meningId,
        yuboruvchi_ism: meningIsm,
        yuboruvchi_tur: meningTur,
        fayl_url: urlData.publicUrl,
        fayl_tur: tur,
        fayl_nom: file.name,
      });

      habarlarniYuklash(tanlanganChat.id, true);
      chatlarniYuklash();
      toast({ title: '✅ Fayl yuborildi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setFaylYuklanyapti(false);
    }
  };

  const habarOchirish = async (habarId: string) => {
    await supabase.from('chat_habarlar').update({ ochirilgan: true }).eq('id', habarId);
    habarlarniYuklash(tanlanganChat!.id, true);
  };

  const chatOchirish = async (chatId: string) => {
    await supabase.from('chatlar').delete().eq('id', chatId);
    setTanlanganChat(null);
    chatlarniYuklash();
    toast({ title: "Guruh o'chirildi" });
  };

  // Tabga mos chatlar
  const tabChatlar = chatlar.filter(c =>
    activeTab === 'chatlar' ? c.tur === 'shaxsiy' : c.tur === 'guruh'
  );

  const filtredChatlar = qidiruv
    ? tabChatlar.filter(c => c.nomi?.toLowerCase().includes(qidiruv.toLowerCase()))
    : tabChatlar;

  const mening_rolim = tanlanganChat?.mening_rolim || 'azo';
  const isEgaYaAdmin = mening_rolim === 'ega' || mening_rolim === 'admin';
  const canAddMember = tanlanganChat?.tur === 'guruh' && (
    tanlanganChat.qoshish_ruxsat || isEgaYaAdmin
  );

  // ── Kirish ekrani ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a] rounded-2xl">
        <div className="text-center space-y-3">
          <MessageCircle className="h-16 w-16 text-gray-700 mx-auto" />
          <p className="text-gray-500 font-semibold">Chat uchun tizimga kiring</p>
        </div>
      </div>
    );
  }

  // ── Face ID tekshiruvi ─────────────────────────────────────────────────
  if (faceIdTasdiqlangan === null) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a] rounded-2xl">
        <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (faceIdTasdiqlangan === false && user.rol === 'oquvchi') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0a] rounded-2xl p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-5">
          <ShieldOff className="h-10 w-10 text-red-400" />
        </div>
        <h3 className="text-white text-xl font-bold mb-2">Face ID tasdiqlanmagan</h3>
        <p className="text-gray-500 text-sm max-w-xs">
          Chatga kirish uchun avval <strong className="text-violet-400">Profil</strong> sahifasida yuz rasmingizni ro'yxatdan o'tkazishingiz kerak.
        </p>
        <div className="mt-5 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-amber-300 text-xs text-left">Face ID ro'yxatdan o'tgandan so'ng chat avtomatik ochiladi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#0a0a0a] rounded-2xl overflow-hidden border border-white/10 shadow-2xl" style={{ height: '100vh' }}>

      {/* ══ CHAP PANEL ════════════════════════════════════════════════════ */}
      <div className={`${mobileChat ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-80 border-r border-white/10 bg-[#0f0f0f] flex-shrink-0`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-violet-400" />
              Messenjer
            </h2>
            <div className="flex items-center gap-1.5">
              {activeTab === 'guruhlar' && (
                <button onClick={() => setShowOmmaviy(true)}
                  className="p-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 rounded-xl transition-all" title="Ommaviy guruhlar">
                  <Globe className="h-4 w-4 text-emerald-400" />
                </button>
              )}
              {activeTab === 'chatlar' && (
                <button onClick={() => setShowShaxsiyModal(true)}
                  className="p-2 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/50 rounded-xl transition-all" title="Yangi chat">
                  <UserIcon className="h-4 w-4 text-cyan-400" />
                </button>
              )}
              {activeTab === 'guruhlar' && (
                <button onClick={() => setShowGuruhModal(true)}
                  className="p-2 bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-500/50 rounded-xl transition-all" title="Guruh yaratish">
                  <Plus className="h-4 w-4 text-violet-400" />
                </button>
              )}
            </div>
          </div>

          {/* Telegram uslubida tablar */}
          <div className="flex gap-1 p-1 bg-[#1a1a1a] rounded-xl mb-3">
            <button
              onClick={() => { setActiveTab('chatlar'); setTanlanganChat(null); setMobileChat(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'chatlar'
                  ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Chatlar
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === 'chatlar' ? 'bg-white/20' : 'bg-white/10 text-gray-400'}`}>
                {chatlar.filter(c => c.tur === 'shaxsiy').length}
              </span>
            </button>
            <button
              onClick={() => { setActiveTab('guruhlar'); setTanlanganChat(null); setMobileChat(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'guruhlar'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Guruhlar
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${activeTab === 'guruhlar' ? 'bg-white/20' : 'bg-white/10 text-gray-400'}`}>
                {chatlar.filter(c => c.tur === 'guruh').length}
              </span>
            </button>
          </div>

          {/* Qidiruv */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <input value={qidiruv} onChange={e => setQidiruv(e.target.value)}
              placeholder={activeTab === 'chatlar' ? 'Chatlarni qidiring...' : 'Guruhlarni qidiring...'}
              className="w-full bg-[#1a1a1a] border border-white/10 text-white placeholder-gray-700 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-violet-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Chat/Guruh ro'yhati */}
        <div className="flex-1 overflow-y-auto">
          {filtredChatlar.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              {activeTab === 'chatlar' ? (
                <>
                  <MessageCircle className="h-12 w-12 text-gray-800 mb-3" />
                  <p className="text-gray-600 text-sm font-semibold">Hech qanday chat yo'q</p>
                  <p className="text-gray-700 text-xs mt-1">Ustoz yoki admin bilan suhbat boshlang</p>
                  <button onClick={() => setShowShaxsiyModal(true)}
                    className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-semibold hover:bg-cyan-600/30 transition-all">
                    <Plus className="h-3.5 w-3.5" />Yangi chat
                  </button>
                </>
              ) : (
                <>
                  <Users className="h-12 w-12 text-gray-800 mb-3" />
                  <p className="text-gray-600 text-sm font-semibold">Hech qanday guruh yo'q</p>
                  <p className="text-gray-700 text-xs mt-1">Yangi guruh yarating yoki ommaviy guruhga qo'shiling</p>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setShowGuruhModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-400 text-xs font-semibold hover:bg-violet-600/30 transition-all">
                      <Plus className="h-3 w-3" />Yaratish
                    </button>
                    <button onClick={() => setShowOmmaviy(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition-all">
                      <Globe className="h-3 w-3" />Ommaviy
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : filtredChatlar.map(chat => {
            const aktiv = tanlanganChat?.id === chat.id;
            return (
              <button key={chat.id}
                onClick={() => { setTanlanganChat(chat); setMobileChat(true); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/5 transition-all text-left ${aktiv ? 'bg-violet-600/20 border-l-2 border-l-violet-500' : 'hover:bg-white/5'}`}>
                <div className="relative flex-shrink-0">
                  {chat.rasm_url ? (
                    <img src={chat.rasm_url} alt={chat.nomi || ''} className="w-11 h-11 rounded-full object-cover" />
                  ) : chat.tur === 'guruh' ? (
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${chat.ommaviy ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-violet-600 to-purple-700'}`}>
                      {chat.ommaviy ? <Globe className="h-5 w-5 text-white" /> : <Hash className="h-5 w-5 text-white" />}
                    </div>
                  ) : (
                    <Avatar ism={chat.nomi || 'Chat'} />
                  )}
                  {chat.tur === 'guruh' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0f0f0f] rounded-full flex items-center justify-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${chat.ommaviy ? 'bg-emerald-500' : 'bg-violet-500'}`} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className={`text-sm font-semibold truncate ${aktiv ? 'text-violet-300' : 'text-gray-200'}`}>
                        {chat.nomi}
                      </p>
                      <RolBadge rol={chat.mening_rolim || 'azo'} />
                      {chat.tur === 'guruh' && (
                        chat.ommaviy
                          ? <Globe className="h-2.5 w-2.5 text-emerald-500 flex-shrink-0" title="Ommaviy" />
                          : <Lock className="h-2.5 w-2.5 text-gray-600 flex-shrink-0" title="Maxfiy" />
                      )}
                    </div>
                    <span className="text-[9px] text-gray-600 flex-shrink-0 ml-1">{vaqtFormat(chat.oxirgi_vaqt || chat.created_at)}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 truncate">
                    {chat.oxirgi_habar || (chat.tur === 'guruh' ? `${chat.azo_soni || 0} a'zo` : 'Suhbat boshlang')}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ O'NG PANEL: CHAT MAYDONI ════════════════════════════════════════ */}
      <div className={`${mobileChat ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
        {!tanlanganChat ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/20 to-purple-700/20 border border-violet-500/20 flex items-center justify-center mb-5">
              <MessageCircle className="h-12 w-12 text-violet-400" />
            </div>
            <h3 className="text-white text-xl font-bold mb-2">
              {activeTab === 'chatlar' ? 'Chat tanlang' : 'Guruh tanlang'}
            </h3>
            <p className="text-gray-600 text-sm max-w-xs">
              {activeTab === 'chatlar'
                ? "Chap paneldan chat tanlang yoki yangi suhbat boshlang"
                : "Chap paneldan guruh tanlang yoki yangi guruh yarating"}
            </p>
            <div className="flex gap-3 mt-6">
              {activeTab === 'chatlar' ? (
                <button onClick={() => setShowShaxsiyModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600/20 border border-cyan-500/30 rounded-xl text-cyan-300 text-sm font-semibold hover:bg-cyan-600/30 transition-all">
                  <UserIcon className="h-4 w-4" />Yangi chat
                </button>
              ) : (
                <>
                  <button onClick={() => setShowGuruhModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-300 text-sm font-semibold hover:bg-violet-600/30 transition-all">
                    <Plus className="h-4 w-4" />Guruh yaratish
                  </button>
                  <button onClick={() => setShowOmmaviy(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-semibold hover:bg-emerald-600/30 transition-all">
                    <Globe className="h-4 w-4" />Ommaviy guruhlar
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3.5 bg-[#111111] border-b border-white/10 flex items-center gap-3">
              <button onClick={() => { setMobileChat(false); setTanlanganChat(null); }}
                className="md:hidden p-1.5 text-gray-500 hover:text-white transition-colors">
                <ChevronLeft className="h-5 w-5" />
              </button>
              {tanlanganChat.rasm_url ? (
                <img src={tanlanganChat.rasm_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : tanlanganChat.tur === 'guruh' ? (
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tanlanganChat.ommaviy ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-violet-600 to-purple-700'}`}>
                  {tanlanganChat.ommaviy ? <Globe className="h-4 w-4 text-white" /> : <Hash className="h-4 w-4 text-white" />}
                </div>
              ) : (
                <Avatar ism={tanlanganChat.nomi || 'Chat'} hajm="sm" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold text-sm truncate">{tanlanganChat.nomi}</p>
                  {tanlanganChat.tur === 'guruh' && (
                    tanlanganChat.ommaviy
                      ? <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30 flex-shrink-0">🌐 Ommaviy</span>
                      : <span className="text-[9px] bg-gray-500/20 text-gray-400 px-1.5 py-0.5 rounded-full border border-gray-500/30 flex-shrink-0">🔒 Maxfiy</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">
                  {tanlanganChat.tur === 'guruh' ? `${tanlanganChat.azo_soni || 0} a'zo` : 'Shaxsiy suhbat'}
                  {tanlanganChat.mening_rolim === 'ega' && ' • 👑 Ega'}
                  {tanlanganChat.mening_rolim === 'admin' && ' • 🛡 Admin'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {canAddMember && (
                  <button onClick={() => { setShowAzoModal(true); azolarniYuklash(tanlanganChat.id); }}
                    className="p-2 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-xl transition-all">
                    <UserPlus className="h-4 w-4 text-emerald-400" />
                  </button>
                )}
                {tanlanganChat.tur === 'guruh' && (
                  <button onClick={() => { setShowSozlamalar(true); azolarniYuklash(tanlanganChat.id); }}
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
                    <Settings className="h-4 w-4 text-gray-400" />
                  </button>
                )}
                {(mening_rolim === 'ega') && tanlanganChat.tur === 'guruh' && (
                  <button onClick={() => chatOchirish(tanlanganChat.id)}
                    className="p-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-xl transition-all">
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Habarlar */}
            <div ref={habarlarRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 bg-[#0a0a0a]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
              {habarYuklanyapti ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
                </div>
              ) : habarlar.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageCircle className="h-10 w-10 text-gray-800 mb-2" />
                  <p className="text-gray-600 text-sm">Hali habar yo'q</p>
                  <p className="text-gray-700 text-xs mt-0.5">Birinchi bo'lib yozing!</p>
                </div>
              ) : (
                habarlar.map((h, idx) => {
                  const prev = idx > 0 ? habarlar[idx - 1] : null;
                  const sana = new Date(h.created_at).toDateString();
                  const prevSana = prev ? new Date(prev.created_at).toDateString() : null;
                  return (
                    <div key={h.id}>
                      {sana !== prevSana && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-white/5" />
                          <span className="text-[10px] text-gray-700 bg-[#111] px-3 py-1 rounded-full border border-white/5">
                            {new Date(h.created_at).toLocaleDateString('uz', { day: '2-digit', month: 'long' })}
                          </span>
                          <div className="flex-1 h-px bg-white/5" />
                        </div>
                      )}
                      <HabarCard
                        habar={h}
                        meningId={meningId}
                        onOchirish={habarOchirish}
                        isGuruh={tanlanganChat.tur === 'guruh'}
                        bloklangan={bloklangan}
                        onBlok={togBlok}
                      />
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 bg-[#111111] border-t border-white/10">
              <input ref={faylInputRef} type="file" accept="image/*,.pdf,.docx,.doc" className="hidden"
                onChange={e => { if (e.target.files?.[0]) faylYuklash(e.target.files[0]); e.target.value = ''; }}
              />
              <div className="flex items-end gap-2">
                <button onClick={() => faylInputRef.current?.click()} disabled={faylYuklanyapti}
                  className="flex-shrink-0 p-3 bg-[#1a1a1a] hover:bg-white/10 border border-white/10 rounded-xl transition-all text-gray-400 hover:text-white">
                  {faylYuklanyapti ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <textarea
                  value={matn} onChange={e => setMatn(e.target.value)}
                  placeholder="Xabar yozing..."
                  rows={1}
                  style={{ maxHeight: '100px', overflowY: matn.split('\n').length > 3 ? 'auto' : 'hidden' }}
                  className="flex-1 bg-[#1a1a1a] border border-white/10 text-white placeholder-gray-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-violet-500/50 transition-colors resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); habarYuborish(); } }}
                />
                <button onClick={habarYuborish} disabled={!matn.trim()}
                  className="flex-shrink-0 p-3 bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[9px] text-gray-700 mt-1.5 text-center">
                Enter — yuborish • Shift+Enter — yangi qator • 📎 — rasm, PDF, DOCX
              </p>
            </div>
          </>
        )}
      </div>

      {/* ══ MODALAR ═══════════════════════════════════════════════════════ */}
      {showGuruhModal && (
        <GuruhYaratishModal
          onClose={() => setShowGuruhModal(false)}
          onYaratildi={chat => {
            setShowGuruhModal(false);
            chatlarniYuklash();
            setActiveTab('guruhlar');
            setTanlanganChat(chat);
            setMobileChat(true);
          }}
          meningId={meningId} meningIsm={meningIsm} meningTur={meningTur}
        />
      )}
      {showShaxsiyModal && (
        <ShaxsiyModal
          onClose={() => setShowShaxsiyModal(false)}
          onYaratildi={chat => { chatlarniYuklash(); setActiveTab('chatlar'); setTanlanganChat(chat); setMobileChat(true); }}
          meningId={meningId} meningIsm={meningIsm} meningTur={meningTur}
          mavjudChatlar={chatlar}
        />
      )}
      {showAzoModal && tanlanganChat && (
        <AzoQoshishModal
          chatId={tanlanganChat.id} chatNomi={tanlanganChat.nomi || 'Guruh'}
          mavjudAzolar={azolar}
          onClose={() => setShowAzoModal(false)}
          onQoshildi={() => { azolarniYuklash(tanlanganChat.id); chatlarniYuklash(); }}
        />
      )}
      {showSozlamalar && tanlanganChat && (
        <GuruhSozlamalariModal
          chat={tanlanganChat} azolar={azolar} meningRol={mening_rolim} meningId={meningId}
          onClose={() => setShowSozlamalar(false)}
          onYangilandi={() => { azolarniYuklash(tanlanganChat.id); chatlarniYuklash(); setTimeout(chatlarniYuklash, 500); }}
          onChiqish={() => { setTanlanganChat(null); chatlarniYuklash(); }}
        />
      )}
      {showOmmaviy && (
        <OmmaviyGuruhlarModal
          onClose={() => setShowOmmaviy(false)}
          meningId={meningId} meningIsm={meningIsm} meningTur={meningTur}
          onKirildi={chat => { chatlarniYuklash(); setActiveTab('guruhlar'); setTanlanganChat(chat); setMobileChat(true); }}
        />
      )}

      <style>{`
        .overflow-y-auto::-webkit-scrollbar { width: 4px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #3a3a3a; }
      `}</style>
    </div>
  );
}
