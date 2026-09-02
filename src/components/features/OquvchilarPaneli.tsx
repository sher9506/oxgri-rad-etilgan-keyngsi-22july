import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, RefreshCw, Loader2, Phone, Calendar,
  Key, Hash, Lock, Eye, EyeOff, MessageCircle, ChevronRight,
  BookOpen, FileText, X, CheckCircle, AlertCircle,
  GraduationCap, Trophy
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Talaba {
  id: string;
  ism: string;
  familiya: string;
  guruh: string;
  kurs: string;
  login_id: string | null;
  phone: string | null;
  telegram_chat_id: number | null;
  created_at: string;
  fraud_flag?: boolean;
  face_descriptor?: any;
}

async function parolHashla(parol: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(parol + 'juris_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function vaqtFormat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('uz', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' });
}

export default function OquvchilarPaneli() {
  const { toast } = useToast();
  const [talabalar, setTalabalar] = useState<Talaba[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [qidiruv, setQidiruv] = useState('');
  const [kursFilter, setKursFilter] = useState('barchasi');
  const [tanlanganTalaba, setTanlanganTalaba] = useState<Talaba | null>(null);
  const [yangiParol, setYangiParol] = useState('');
  const [parolKor, setParolKor] = useState(false);
  const [parolYuklanyapti, setParolYuklanyapti] = useState(false);
  const [natijalar, setNatijalar] = useState<any[]>([]);
  const [natijalarYuklanyapti, setNatijalarYuklanyapti] = useState(false);
  const [botXabarYuklanyapti, setBotXabarYuklanyapti] = useState(false);

  const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];

  const yuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('talabalar')
        .select('id, ism, familiya, guruh, kurs, login_id, phone, telegram_chat_id, created_at, fraud_flag, face_descriptor')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTalabalar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  }, []);

  useEffect(() => { yuklash(); }, [yuklash]);

  const natijalarniYuklash = useCallback(async (talaba: Talaba) => {
    setNatijalarYuklanyapti(true);
    setNatijalar([]);
    const fullName = `${talaba.ism} ${talaba.familiya}`;
    try {
      const [{ data: testJavoblar }, { data: kazusJavoblar }] = await Promise.all([
        supabase.from('test_javoblar').select('*, testlar!test_id(test_nomi)').eq('oquvchi_ismi', fullName).order('created_at', { ascending: false }).limit(20),
        supabase.from('javoblar').select('*, toplamlar!toplam_id(mavzu)').eq('oquvchi_ismi', fullName).order('created_at', { ascending: false }).limit(20),
      ]);
      const birlashgan = [
        ...(testJavoblar || []).map((j: any) => ({
          tur: 'test',
          nomi: j.testlar?.test_nomi || j.test_kod,
          togri: j.togri_soni,
          jami: j.togri_soni + j.xato_soni + j.javob_berilmagan,
          foiz: j.foiz,
          created_at: j.created_at,
        })),
        ...(kazusJavoblar || []).map((j: any) => {
          const baho: any[] = j.baho || [];
          const jami_ball = baho.reduce((s: number, b: any) => s + (b.ball || 0), 0);
          const maks = baho.length * 30;
          return {
            tur: 'kazus',
            nomi: j.toplamlar?.mavzu || j.toplam_kod,
            ball: jami_ball,
            maks,
            foiz: maks ? Math.round((jami_ball / maks) * 100) : 0,
            created_at: j.created_at,
          };
        }),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNatijalar(birlashgan);
    } catch (e) {
      console.error('Natijalar yuklash xatosi:', e);
    } finally {
      setNatijalarYuklanyapti(false);
    }
  }, []);

  useEffect(() => {
    if (tanlanganTalaba) natijalarniYuklash(tanlanganTalaba);
  }, [tanlanganTalaba]);

  const parolniTiklash = async () => {
    if (!tanlanganTalaba || !yangiParol.trim()) return;
    if (yangiParol.length < 8 || !/[A-Z]/.test(yangiParol) || !/[0-9]/.test(yangiParol)) {
      toast({ title: 'Xato', description: 'Parol: min 8 belgi, 1 katta harf, 1 raqam', variant: 'destructive' });
      return;
    }
    setParolYuklanyapti(true);
    try {
      const hash = await parolHashla(yangiParol);
      const { error } = await supabase.from('talabalar').update({ parol_hash: hash }).eq('id', tanlanganTalaba.id);
      if (error) throw error;
      toast({ title: '✅ Parol yangilandi', description: `${tanlanganTalaba.ism} uchun yangi parol o'rnatildi` });

      // Telegram bot orqali ham xabar yuborish
      if (tanlanganTalaba.telegram_chat_id) {
        try {
          await supabase.functions.invoke('telegram-bot', {
            body: {
              action: 'send_result',
              chat_id: tanlanganTalaba.telegram_chat_id,
              text: `🔐 <b>Admin parolingizni tikladi!</b>\n\n🔑 Login: <code>${tanlanganTalaba.login_id}</code>\n🔒 Yangi parol: <code>${yangiParol}</code>\n\n⚠️ Parolni eslab qoling!`,
            },
          });
        } catch (e) {
          console.warn('Bot xabar yuborish xatosi:', e);
        }
      }
      setYangiParol('');
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setParolYuklanyapti(false);
    }
  };

  const botNatijalarYuborish = async (talaba: Talaba, natijalar: any[]) => {
    if (!talaba.telegram_chat_id) {
      toast({ title: 'Xato', description: "Bu talabaning Telegram bot chat ID si yo'q", variant: 'destructive' });
      return;
    }
    setBotXabarYuklanyapti(true);
    try {
      const fullName = `${talaba.ism} ${talaba.familiya}`;
      let matn = `📊 <b>${fullName} — Natijalar xulosasi</b>\n\n`;
      if (natijalar.length === 0) {
        matn += `Hali hech qanday test/kazus topshirilmagan.`;
      } else {
        natijalar.slice(0, 10).forEach((n, i) => {
          const icon = n.tur === 'test' ? '📝' : '📋';
          const foiz = n.foiz || 0;
          matn += `${icon} <b>${i + 1}. ${n.nomi}</b>\n`;
          if (n.tur === 'test') matn += `   ✅ To'g'ri: ${n.togri}/${n.jami} • ${foiz}%\n`;
          else matn += `   🏆 Ball: ${n.ball}/${n.maks} • ${foiz}%\n`;
          matn += `   📅 ${vaqtFormat(n.created_at)}\n\n`;
        });
      }
      await supabase.functions.invoke('telegram-bot', {
        body: { action: 'send_result', chat_id: talaba.telegram_chat_id, text: matn },
      });
      toast({ title: '✅ Telegram ga yuborildi', description: `${fullName} ga natijalar yuborildi` });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setBotXabarYuklanyapti(false);
    }
  };

  const filtred = talabalar.filter(t => {
    const kOk = kursFilter === 'barchasi' || t.kurs === kursFilter;
    const qOk = !qidiruv || `${t.ism} ${t.familiya} ${t.login_id || ''}`.toLowerCase().includes(qidiruv.toLowerCase());
    return kOk && qOk;
  });

  const botOrqali = talabalar.filter(t => t.telegram_chat_id).length;
  const loginBor = talabalar.filter(t => t.login_id).length;

  return (
    <div className="space-y-5">
      {/* Sarlavha */}
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl">
            <Users className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">O'quvchilar</h2>
            <p className="text-gray-500 text-xs mt-0.5">Telegram bot orqali ro'yxatdan o'tgan o'quvchilar</p>
          </div>
        </div>
        <button onClick={yuklash} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
          <RefreshCw className={`h-4 w-4 text-gray-400 ${yuklanyapti ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jami o\'quvchilar', val: talabalar.length, color: 'blue' },
          { label: 'Bot orqali', val: botOrqali, color: 'emerald' },
          { label: 'Login bor', val: loginBor, color: 'violet' },
          { label: 'Telefon bor', val: talabalar.filter(t => t.phone).length, color: 'amber' },
        ].map(s => (
          <div key={s.label} className="bg-[#111] border border-white/10 rounded-xl p-4 text-center">
            <p className={`text-2xl font-black text-${s.color}-400`}>{s.val}</p>
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ro'yxat */}
        <div className="lg:col-span-2 bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
          {/* Filter */}
          <div className="px-4 py-3 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
              <input value={qidiruv} onChange={e => setQidiruv(e.target.value)}
                placeholder="Ism, familiya yoki login..."
                className="w-full bg-[#1a1a1a] border border-white/10 text-white placeholder-gray-700 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['barchasi', ...KURSLAR].map(k => (
                <button key={k} onClick={() => setKursFilter(k)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    kursFilter === k ? 'bg-blue-600 border-blue-600 text-white' : 'border-white/10 text-gray-500 hover:text-white'
                  }`}
                >
                  {k === 'barchasi' ? 'Barchasi' : k}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[600px]">
            {yuklanyapti ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            ) : filtred.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Users className="h-12 w-12 text-gray-800 mb-3" />
                <p className="text-gray-600 text-sm">O'quvchilar topilmadi</p>
              </div>
            ) : filtred.map(talaba => {
              const aktiv = tanlanganTalaba?.id === talaba.id;
              return (
                <button key={talaba.id} onClick={() => setTanlanganTalaba(aktiv ? null : talaba)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/5 text-left transition-all ${
                    aktiv ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : 'hover:bg-white/5'
                  }`}>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                    {talaba.familiya[0]}{talaba.ism[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-white font-semibold truncate">{talaba.familiya} {talaba.ism}</p>
                      {talaba.telegram_chat_id && (
                        <span className="text-[9px] bg-blue-900/50 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30 flex-shrink-0">Bot</span>
                      )}
                      {talaba.fraud_flag && (
                        <span className="text-[9px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/30 flex-shrink-0">!</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {talaba.login_id && (
                        <span className="text-[10px] text-gray-600 font-mono">@{talaba.login_id}</span>
                      )}
                      {talaba.phone && (
                        <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5" />{talaba.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {talaba.kurs && <span className="text-[9px] text-gray-700">{talaba.kurs}</span>}
                      {talaba.guruh && <span className="text-[9px] text-gray-700">{talaba.guruh}</span>}
                      <span className="text-[9px] text-gray-700 flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {vaqtFormat(talaba.created_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${aktiv ? 'rotate-90 text-blue-400' : 'text-gray-700'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
          {!tanlanganTalaba ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
              <GraduationCap className="h-10 w-10 text-gray-800 mb-3" />
              <p className="text-gray-600 text-sm">O'quvchini tanlang</p>
            </div>
          ) : (
            <div className="flex flex-col h-full max-h-[680px]">
              {/* Header */}
              <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#111]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-black">
                    {tanlanganTalaba.familiya[0]}{tanlanganTalaba.ism[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white font-bold">{tanlanganTalaba.familiya} {tanlanganTalaba.ism}</p>
                    <p className="text-[10px] text-gray-600">{tanlanganTalaba.kurs} • {tanlanganTalaba.guruh}</p>
                  </div>
                </div>
                <button onClick={() => setTanlanganTalaba(null)} className="text-gray-600 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Ma'lumotlar */}
                <div className="space-y-2">
                  {[
                    { icon: Hash, label: 'Login', val: tanlanganTalaba.login_id || '—', mono: true },
                    { icon: Phone, label: 'Telefon', val: tanlanganTalaba.phone || '—' },
                    { icon: MessageCircle, label: 'Telegram ID', val: tanlanganTalaba.telegram_chat_id ? String(tanlanganTalaba.telegram_chat_id) : '—', mono: true },
                    { icon: Calendar, label: "Ro'yxat sanasi", val: vaqtFormat(tanlanganTalaba.created_at) },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2.5 px-3 py-2.5 bg-[#1a1a1a] border border-white/5 rounded-xl">
                      <item.icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                      <span className="text-xs text-gray-500 w-20 flex-shrink-0">{item.label}</span>
                      <span className={`text-xs text-white truncate ${item.mono ? 'font-mono' : ''}`}>{item.val}</span>
                    </div>
                  ))}
                </div>

                {/* Parolni tiklash */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" /> Parolni tiklash
                  </p>
                  <div className="relative">
                    <input
                      type={parolKor ? 'text' : 'password'}
                      value={yangiParol}
                      onChange={e => setYangiParol(e.target.value)}
                      placeholder="Yangi parol (min 8, 1 katta, 1 raqam)"
                      className="w-full bg-[#0d0d0d] border border-white/10 text-white placeholder-gray-700 px-3 py-2.5 pr-10 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button type="button" onClick={() => setParolKor(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                      {parolKor ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  {yangiParol && (
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { ok: yangiParol.length >= 8, text: '8+ belgi' },
                        { ok: /[A-Z]/.test(yangiParol), text: 'KATTA harf' },
                        { ok: /[0-9]/.test(yangiParol), text: 'Raqam' },
                      ].map(r => (
                        <span key={r.text} className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${r.ok ? 'bg-green-900/50 text-green-400' : 'bg-red-900/30 text-red-500'}`}>
                          {r.ok ? '✓' : '✗'} {r.text}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={parolniTiklash}
                    disabled={parolYuklanyapti || !yangiParol || yangiParol.length < 8 || !/[A-Z]/.test(yangiParol) || !/[0-9]/.test(yangiParol)}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    {parolYuklanyapti ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                    Parolni yangilash
                    {tanlanganTalaba.telegram_chat_id && <span className="text-[9px] opacity-70">(Bot ga ham yuboriladi)</span>}
                  </button>
                </div>

                {/* Natijalar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5" /> Natijalar ({natijalar.length})
                    </p>
                    {tanlanganTalaba.telegram_chat_id && (
                      <button
                        onClick={() => botNatijalarYuborish(tanlanganTalaba, natijalar)}
                        disabled={botXabarYuklanyapti || natijalarYuklanyapti}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-[#229ED9]/20 border border-[#229ED9]/30 text-[#229ED9] rounded-xl text-[10px] font-bold hover:bg-[#229ED9]/30 transition-all disabled:opacity-40"
                      >
                        {botXabarYuklanyapti ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                          </svg>
                        )}
                        Bot ga yuborish
                      </button>
                    )}
                  </div>

                  {natijalarYuklanyapti ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="h-5 w-5 text-gray-600 animate-spin" />
                    </div>
                  ) : natijalar.length === 0 ? (
                    <div className="py-6 text-center">
                      <p className="text-gray-700 text-xs">Hali natijalar yo'q</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {natijalar.map((n, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-[#1a1a1a] border border-white/5 rounded-xl">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${n.tur === 'test' ? 'bg-indigo-900/50' : 'bg-violet-900/50'}`}>
                            {n.tur === 'test' ? <FileText className="h-3 w-3 text-indigo-400" /> : <BookOpen className="h-3 w-3 text-violet-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white truncate font-medium">{n.nomi}</p>
                            <p className="text-[9px] text-gray-600">{vaqtFormat(n.created_at)}</p>
                          </div>
                          <div className={`text-xs font-black flex-shrink-0 ${n.foiz >= 70 ? 'text-emerald-400' : n.foiz >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {n.foiz}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
