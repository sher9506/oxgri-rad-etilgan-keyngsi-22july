import { useState, useEffect } from 'react';
import {
  User, Shield, ShieldCheck, Edit3,
  GraduationCap, BookOpen, Briefcase,
  Loader2, AlertCircle, Star, CheckCircle,
  Clock, ArrowLeft, Send, X, LogOut,
  KeyRound, Eye, EyeOff, Lock, CheckCircle2, Save,
  BookOpenCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs', 'Boshqa'];
const GURUHLAR = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3', 'Boshqa'];

// ── Parol validatsiyasi ───────────────────────────────────────────────────
function parolTekshir(parol: string): { valid: boolean; xabar: string } {
  if (parol.length < 8) return { valid: false, xabar: 'Kamida 8 ta belgi bo\'lsin' };
  if (!/[A-Z]/.test(parol)) return { valid: false, xabar: 'Kamida 1 ta katta harf (A-Z) bo\'lsin' };
  if (!/[0-9]/.test(parol)) return { valid: false, xabar: 'Kamida 1 ta raqam bo\'lsin' };
  return { valid: true, xabar: '' };
}

async function parolHashla(parol: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(parol + 'juris_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ProfilSahifa() {
  const { user, login, logout } = useAuth();
  const { toast } = useToast();

  // ── Kurs/guruh tahrirlash ─────────────────────────────────────────────
  const [kursGuruhTahrirlash, setKursGuruhTahrirlash] = useState(false);
  const [kurs, setKurs] = useState('');
  const [guruh, setGuruh] = useState('');
  const [kgYuklanyapti, setKgYuklanyapti] = useState(false);

  // ── Ism tahrirlash ─────────────────────────────────────────────────────
  const [ismTahrirlash, setIsmTahrirlash] = useState(false);
  const [yangiIsm, setYangiIsm] = useState('');
  const [yangiFamiliya, setYangiFamiliya] = useState('');
  const [ismYuklanyapti, setIsmYuklanyapti] = useState(false);
  const [mavjudTahrirlash, setMavjudTahrirlash] = useState<any | null>(null);

  // ── Parol tahrirlash ───────────────────────────────────────────────────
  const [parolTahrirlash, setParolTahrirlash] = useState(false);
  const [eskiParol, setEskiParol] = useState('');
  const [yangiParol, setYangiParol] = useState('');
  const [yangiParolTakror, setYangiParolTakror] = useState('');
  const [parolKor, setParolKor] = useState({ eski: false, yangi: false, takror: false });
  const [parolYuklanyapti, setParolYuklanyapti] = useState(false);

  // ── Ustoz holati ──────────────────────────────────────────────────────
  const [ustozStatus, setUstozStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.rol === 'ustoz' && user.ustoz_id) {
      supabase.from('ustoz').select('status').eq('id', user.ustoz_id).maybeSingle()
        .then(({ data }) => { if (data?.status) setUstozStatus(data.status); });
      supabase.from('profil_tahrirlashlar').select('*').eq('murojaat_id', user.ustoz_id).eq('holat', 'pending').maybeSingle()
        .then(({ data }) => setMavjudTahrirlash(data));
    }
    if (user.rol === 'oquvchi') {
      supabase.from('profil_tahrirlashlar').select('*').eq('murojaat_id', `${user.ism}|${user.familiya}`).eq('holat', 'pending').maybeSingle()
        .then(({ data }) => setMavjudTahrirlash(data));
    }
  }, [user]);

  // Ism tahrirlash tasdiqlash polling
  useEffect(() => {
    if (!user || !mavjudTahrirlash || mavjudTahrirlash.holat !== 'pending') return;
    const tekshirish = async () => {
      const { data } = await supabase.from('profil_tahrirlashlar').select('*').eq('id', mavjudTahrirlash.id).maybeSingle();
      if (!data) return;
      if (data.holat === 'approved') {
        login({ ...user, ism: data.yangi_ism, familiya: data.yangi_familiya });
        setMavjudTahrirlash({ ...data });
        toast({ title: '✅ Ismingiz yangilandi!', description: `${data.yangi_familiya} ${data.yangi_ism}` });
      } else if (data.holat === 'rejected') {
        setMavjudTahrirlash({ ...data });
        toast({ title: 'So\'rov rad etildi', variant: 'destructive' });
      }
    };
    const interval = setInterval(tekshirish, 10000);
    return () => clearInterval(interval);
  }, [mavjudTahrirlash, user, login, toast]);

  if (!user) {
    return (
      <div className="max-w-sm mx-auto mt-16 text-center">
        <div className="bg-white rounded-2xl p-10 shadow-lg border border-gray-200">
          <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="font-bold text-gray-500">Profilni ko'rish uchun kiring</p>
        </div>
      </div>
    );
  }

  const isUstoz = user.rol === 'ustoz';
  const avatarInitials = `${(user.familiya?.[0] || '')}${(user.ism?.[0] || '')}`.toUpperCase();

  // ── Kurs/guruh saqlash ────────────────────────────────────────────────
  const handleKursGuruhSaqla = async () => {
    if (!kurs || !guruh) {
      toast({ title: 'Xato', description: 'Kurs va guruhni tanlang', variant: 'destructive' });
      return;
    }
    setKgYuklanyapti(true);
    try {
      const { data: mavjud } = await supabase.from('talabalar').select('id').eq('ism', user.ism).eq('familiya', user.familiya).maybeSingle();
      if (mavjud) {
        await supabase.from('talabalar').update({ kurs, guruh }).eq('id', mavjud.id);
      } else {
        await supabase.from('talabalar').insert({ ism: user.ism, familiya: user.familiya, kurs, guruh });
      }
      login({ ...user, kurs, guruh });
      toast({ title: '✅ Saqlandi!', description: `${kurs.toUpperCase()} / ${guruh.toUpperCase()}` });
      setKursGuruhTahrirlash(false);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setKgYuklanyapti(false);
    }
  };

  // ── Ism tahrirlash yuborish ───────────────────────────────────────────
  const handleIsmYuborish = async () => {
    if (!yangiIsm.trim() || !yangiFamiliya.trim()) {
      toast({ title: 'Xato', description: 'Ism va familiyani kiriting', variant: 'destructive' });
      return;
    }
    if (yangiIsm.trim() === user.ism && yangiFamiliya.trim() === user.familiya) {
      toast({ title: 'Xato', description: 'Ism o\'zgartirilmagan', variant: 'destructive' });
      return;
    }
    setIsmYuklanyapti(true);
    try {
      const murojaatId = isUstoz ? (user.ustoz_id || '') : `${user.ism}|${user.familiya}`;
      if (mavjudTahrirlash) {
        await supabase.from('profil_tahrirlashlar').update({ holat: 'rejected', admin_izoh: 'Yangi so\'rov' }).eq('id', mavjudTahrirlash.id);
      }
      const { data } = await supabase.from('profil_tahrirlashlar').insert({
        tur: isUstoz ? 'ustoz' : 'oquvchi',
        murojaat_id: murojaatId,
        eski_ism: user.ism,
        eski_familiya: user.familiya,
        yangi_ism: yangiIsm.trim(),
        yangi_familiya: yangiFamiliya.trim(),
        holat: 'pending',
      }).select().single();
      setMavjudTahrirlash(data);
      setIsmTahrirlash(false);
      toast({ title: 'So\'rov yuborildi!', description: 'Admin tasdiqini kuting' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setIsmYuklanyapti(false);
    }
  };

  // ── Parol o'zgartirish ────────────────────────────────────────────────
  const handleParolOzgartirish = async () => {
    const parolV = parolTekshir(yangiParol);
    if (!eskiParol || !yangiParol || !yangiParolTakror) {
      toast({ title: 'Xato', description: 'Barcha maydonlarni to\'ldiring', variant: 'destructive' });
      return;
    }
    if (!parolV.valid) {
      toast({ title: 'Parol talab', description: parolV.xabar, variant: 'destructive' });
      return;
    }
    if (yangiParol !== yangiParolTakror) {
      toast({ title: 'Xato', description: 'Yangi parollar mos kelmadi', variant: 'destructive' });
      return;
    }
    setParolYuklanyapti(true);
    try {
      // Eski parolni tekshirish
      const eskiHash = await parolHashla(eskiParol);
      const { data: talaba } = await supabase
        .from('talabalar')
        .select('id, parol_hash')
        .eq('ism', user.ism)
        .eq('familiya', user.familiya)
        .maybeSingle();

      if (!talaba || talaba.parol_hash !== eskiHash) {
        toast({ title: 'Xato', description: 'Eski parol noto\'g\'ri', variant: 'destructive' });
        setParolYuklanyapti(false);
        return;
      }
      const yangiHash = await parolHashla(yangiParol);
      await supabase.from('talabalar').update({ parol_hash: yangiHash }).eq('id', talaba.id);
      toast({ title: '✅ Parol o\'zgartirildi!' });
      setParolTahrirlash(false);
      setEskiParol(''); setYangiParol(''); setYangiParolTakror('');
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setParolYuklanyapti(false);
    }
  };

  const yangiParolV = parolTekshir(yangiParol);

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── AVATAR + ASOSIY MA'LUMOT ─────────────────────────────────── */}
      <div className={`relative rounded-2xl overflow-hidden shadow-lg border-2 ${isUstoz ? 'border-[hsl(221,83%,53%)]' : 'border-emerald-400'}`}>
        {/* Banner */}
        <div className={`h-20 ${isUstoz ? 'bg-gradient-to-r from-[hsl(221,83%,53%)] to-indigo-600' : 'bg-gradient-to-r from-emerald-500 to-teal-600'}`}>
          <div className="absolute inset-0 h-20 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
            {isUstoz && ustozStatus === 'approved' && (
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full border border-white/30 text-white text-xs font-bold">
                <CheckCircle2 className="h-3 w-3 text-green-300" />Tasdiqlangan
              </span>
            )}
          </div>
        </div>

        <div className="bg-white px-5 pb-5">
          <div className="flex items-end gap-4 -mt-8 mb-3">
            <div className={`w-16 h-16 rounded-2xl border-[3px] border-white shadow-lg flex items-center justify-center text-white text-xl font-black flex-shrink-0 ${isUstoz ? 'bg-gradient-to-br from-[hsl(221,83%,53%)] to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
              {avatarInitials}
            </div>
            <div className="flex-1 pb-1">
              <h1 className="text-lg font-black text-gray-900 leading-tight">
                {user.familiya} {user.ism}
              </h1>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${isUstoz ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {isUstoz ? <Briefcase className="h-2.5 w-2.5" /> : <GraduationCap className="h-2.5 w-2.5" />}
                  {isUstoz ? 'Ustoz' : "O'quvchi"}
                </span>
                {!isUstoz && user.kurs && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                    <BookOpen className="h-2.5 w-2.5" />{user.kurs.toUpperCase()}
                  </span>
                )}
                {!isUstoz && user.guruh && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                    <Star className="h-2.5 w-2.5" />{user.guruh.toUpperCase()}
                  </span>
                )}
                {isUstoz && ustozStatus === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    <Clock className="h-2.5 w-2.5" />Kutilmoqda
                  </span>
                )}
                {user.login && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                    <KeyRound className="h-2.5 w-2.5" />{user.login}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ma'lumotlar grid */}
          <div className="grid grid-cols-2 gap-2">
            <InfoChip label="Ism" value={user.ism} />
            <InfoChip label="Familiya" value={user.familiya} />
            <InfoChip label="Rol" value={isUstoz ? '👨‍🏫 Ustoz' : "👨‍🎓 O'quvchi"} />
            {user.login && <InfoChip label="Login" value={user.login} />}
            {!isUstoz && user.kurs && <InfoChip label="Kurs" value={user.kurs.toUpperCase()} />}
            {!isUstoz && user.guruh && <InfoChip label="Guruh" value={user.guruh.toUpperCase()} />}
            {isUstoz && ustozStatus && (
              <InfoChip label="Holat" value={ustozStatus === 'approved' ? '✅ Faol' : ustozStatus === 'pending' ? '⏳ Kutilmoqda' : '❌ Rad'} />
            )}
          </div>

          {/* Amallar qatori */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {!mavjudTahrirlash ? (
              <button onClick={() => { setYangiIsm(user.ism); setYangiFamiliya(user.familiya); setIsmTahrirlash(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-xs font-semibold text-gray-600 hover:text-blue-700 transition-all">
                <Edit3 className="h-3.5 w-3.5" />Ismni o'zgartirish
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700">
                <Clock className="h-3.5 w-3.5" />Tasdiq kutilmoqda
              </div>
            )}

            {/* Parol o'zgartirish — faqat o'quvchilarga (login/parol tizimi) */}
            {!isUstoz && user.login && (
              <button onClick={() => setParolTahrirlash(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-xl text-xs font-semibold text-gray-600 hover:text-purple-700 transition-all">
                <Lock className="h-3.5 w-3.5" />Parol o'zgartirish
              </button>
            )}

            {/* Chiqish */}
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-semibold text-red-600 hover:text-red-800 transition-all ml-auto">
              <LogOut className="h-3.5 w-3.5" />Chiqish
            </button>
          </div>
        </div>
      </div>

      {/* ── KURS/GURUH TAHRIRLASH (o'quvchi, ixtiyoriy) ────────────── */}
      {!isUstoz && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2 text-gray-700 font-bold text-sm">
              <BookOpenCheck className="h-4 w-4 text-emerald-500" />
              Kurs va guruh <span className="text-xs font-normal text-gray-400">(ixtiyoriy)</span>
            </div>
            {!kursGuruhTahrirlash && (
              <button onClick={() => { setKurs(user.kurs || ''); setGuruh(user.guruh || ''); setKursGuruhTahrirlash(true); }}
                className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                <Edit3 className="h-3.5 w-3.5" />{user.kurs ? 'O\'zgartirish' : 'Qo\'shish'}
              </button>
            )}
          </div>
          <div className="p-4">
            {!kursGuruhTahrirlash ? (
              user.kurs ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <InfoChip label="Kurs" value={user.kurs.toUpperCase()} />
                    <InfoChip label="Guruh" value={(user.guruh || '—').toUpperCase()} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 text-gray-400 text-sm">
                  Kurs va guruh qo'shilmagan. "Qo'shish" tugmasini bosing.
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1.5">Kurs</p>
                  <div className="flex flex-wrap gap-1.5">
                    {KURSLAR.map(k => (
                      <button key={k} onClick={() => setKurs(k)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${kurs === k ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'}`}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-600 mb-1.5">Guruh</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GURUHLAR.map(g => (
                      <button key={g} onClick={() => setGuruh(g)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${guruh === g ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'}`}>
                        {g.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setKursGuruhTahrirlash(false)} variant="outline" size="sm" className="flex-1 h-9">Bekor</Button>
                  <Button onClick={handleKursGuruhSaqla} disabled={!kurs || !guruh || kgYuklanyapti} size="sm"
                    className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white">
                    {kgYuklanyapti ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />...</> : <><Save className="h-3.5 w-3.5 mr-1" />Saqlash</>}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ISM TAHRIRLASH ─────────────────────────────────────────────── */}
      {ismTahrirlash && (
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Edit3 className="h-4 w-4" />
              <span className="font-bold text-sm">Ismni o'zgartirish</span>
            </div>
            <button onClick={() => setIsmTahrirlash(false)} className="text-white/80 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Yangi ism</label>
                <Input value={yangiIsm} onChange={e => setYangiIsm(e.target.value)} placeholder="Ism" className="border-2 h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Yangi familiya</label>
                <Input value={yangiFamiliya} onChange={e => setYangiFamiliya(e.target.value)} placeholder="Familiya" className="border-2 h-9 text-sm" />
              </div>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
              So'rovingiz admin paneliga yuboriladi. Tasdiqlangach o'zgaradi.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setIsmTahrirlash(false)} variant="outline" size="sm" className="flex-1 h-9">Bekor</Button>
              <Button onClick={handleIsmYuborish} disabled={ismYuklanyapti} size="sm" className="flex-1 h-9 bg-amber-500 hover:bg-amber-600 text-white">
                {ismYuklanyapti ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />...</> : <><Send className="h-3.5 w-3.5 mr-1" />Yuborish</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAROL O'ZGARTIRISH ─────────────────────────────────────────── */}
      {parolTahrirlash && !isUstoz && (
        <div className="bg-white rounded-2xl border-2 border-purple-300 shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Lock className="h-4 w-4" />
              <span className="font-bold text-sm">Parol o'zgartirish</span>
            </div>
            <button onClick={() => { setParolTahrirlash(false); setEskiParol(''); setYangiParol(''); setYangiParolTakror(''); }} className="text-white/80 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            {/* Eski parol */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Joriy parol</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type={parolKor.eski ? 'text' : 'password'}
                  placeholder="Joriy parolingiz"
                  value={eskiParol}
                  onChange={e => setEskiParol(e.target.value)}
                  className="pl-9 pr-10 border-2 h-9 text-sm"
                />
                <button type="button" onClick={() => setParolKor(p => ({ ...p, eski: !p.eski }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {parolKor.eski ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Yangi parol */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Yangi parol</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type={parolKor.yangi ? 'text' : 'password'}
                  placeholder="Kamida 8 belgi, 1 katta harf, 1 raqam"
                  value={yangiParol}
                  onChange={e => setYangiParol(e.target.value)}
                  className={`pl-9 pr-10 border-2 h-9 text-sm ${yangiParol ? yangiParolV.valid ? 'border-emerald-500' : 'border-red-400' : ''}`}
                />
                <button type="button" onClick={() => setParolKor(p => ({ ...p, yangi: !p.yangi }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {parolKor.yangi ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {yangiParol && (
                <div className="mt-1 space-y-0.5">
                  {[
                    { ok: yangiParol.length >= 8, text: 'Kamida 8 ta belgi' },
                    { ok: /[A-Z]/.test(yangiParol), text: 'Kamida 1 katta harf' },
                    { ok: /[0-9]/.test(yangiParol), text: 'Kamida 1 raqam' },
                  ].map((t, i) => (
                    <div key={i} className={`flex items-center gap-1 text-xs ${t.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <CheckCircle2 className={`h-3 w-3 ${t.ok ? 'text-emerald-500' : 'text-gray-300'}`} />{t.text}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Yangi parol takror */}
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Yangi parolni takrorlang</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type={parolKor.takror ? 'text' : 'password'}
                  placeholder="Yangi parolni qayta kiriting"
                  value={yangiParolTakror}
                  onChange={e => setYangiParolTakror(e.target.value)}
                  className={`pl-9 pr-10 border-2 h-9 text-sm ${yangiParolTakror ? yangiParol === yangiParolTakror ? 'border-emerald-500' : 'border-red-400' : ''}`}
                />
                <button type="button" onClick={() => setParolKor(p => ({ ...p, takror: !p.takror }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {parolKor.takror ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => { setParolTahrirlash(false); setEskiParol(''); setYangiParol(''); setYangiParolTakror(''); }} variant="outline" size="sm" className="flex-1 h-9">Bekor</Button>
              <Button
                onClick={handleParolOzgartirish}
                disabled={parolYuklanyapti || !eskiParol || !yangiParolV.valid || yangiParol !== yangiParolTakror}
                size="sm"
                className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {parolYuklanyapti ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />...</> : <><Save className="h-3.5 w-3.5 mr-1" />Saqlash</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAHRIRLASH SO'ROVI ─────────────────────────────────────────── */}
      {mavjudTahrirlash && mavjudTahrirlash.holat === 'pending' && (
        <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <Clock className="h-4 w-4 text-amber-600" />Ism o'zgartirish so'rovi — Admin kutilmoqda
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white rounded-xl p-2.5 border border-amber-100">
              <p className="text-gray-400 mb-0.5">Avvalgi ism</p>
              <p className="font-bold text-gray-800">{mavjudTahrirlash.eski_familiya} {mavjudTahrirlash.eski_ism}</p>
            </div>
            <div className="bg-amber-100 rounded-xl p-2.5 border border-amber-200">
              <p className="text-amber-600 mb-0.5">Yangi ism</p>
              <p className="font-bold text-amber-900">{mavjudTahrirlash.yangi_familiya} {mavjudTahrirlash.yangi_ism}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── USTOZ HOLATI ─────────────────────────────────────────────── */}
      {isUstoz && ustozStatus && (
        <div className={`rounded-2xl border-2 p-4 flex items-center gap-3 ${ustozStatus === 'approved' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          {ustozStatus === 'approved'
            ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            : <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />}
          <div>
            <p className={`font-bold text-sm ${ustozStatus === 'approved' ? 'text-green-800' : 'text-amber-800'}`}>
              {ustozStatus === 'approved' ? 'Faoliyatingiz tasdiqlangan' : 'Admin tasdiqini kutmoqda'}
            </p>
            <p className={`text-xs mt-0.5 ${ustozStatus === 'approved' ? 'text-green-600' : 'text-amber-600'}`}>
              {ustozStatus === 'approved' ? 'Barcha imkoniyatlar ochiq' : 'Tasdiqlanguncha imkoniyatlar cheklangan'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-xs font-semibold text-gray-800 text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}
