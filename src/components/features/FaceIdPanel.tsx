import { useState, useEffect } from 'react';
import { ShieldAlert, Eye, User, Clock, AlertTriangle, RefreshCw, CheckCircle, ScanFace, ShieldCheck, ShieldX, Trash2, UserX, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface FraudUrinish {
  id: string;
  ism: string;
  familiya: string;
  kurs: string;
  guruh: string;
  mos_talaba_ism: string;
  mos_talaba_familiya: string;
  mos_talaba_guruh: string;
  mos_talaba_kurs: string;
  distance: number;
  rasm_data: string | null;
  created_at: string;
  new_talaba_id: string | null;
  admin_status: string;
}

interface OquvchiVerifikatsiya {
  id: string;
  ism: string;
  familiya: string;
  kurs: string;
  guruh: string;
  face_descriptor: number[] | null;
  fraud_flag: boolean;
  created_at: string;
  profil_verified?: boolean;
  profil_face_image?: string | null;
}

type ActiveTab = 'fraud' | 'oquvchi_tasdiq' | 'register';

export default function FaceIdPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('register');
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [fraudlar, setFraudlar] = useState<FraudUrinish[]>([]);
  const [registerlar, setRegisterlar] = useState<FraudUrinish[]>([]);
  const [oquvchilar, setOquvchilar] = useState<OquvchiVerifikatsiya[]>([]);
  const [tanlanganFraud, setTanlanganFraud] = useState<FraudUrinish | null>(null);
  const [tanlanganOquvchi, setTanlanganOquvchi] = useState<OquvchiVerifikatsiya | null>(null);
  const [tanlanganRegister, setTanlanganRegister] = useState<FraudUrinish | null>(null);
  const { toast } = useToast();

  useEffect(() => { yuklash(); }, []);

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const [fraudRes, oquvchiRes, registerRes] = await Promise.all([
        supabase
          .from('fraud_urinishlar')
          .select('*')
          .not('admin_status', 'eq', 'register')
          .order('created_at', { ascending: false }),
        supabase
          .from('talabalar')
          .select('id, ism, familiya, kurs, guruh, face_descriptor, fraud_flag, created_at')
          .not('face_descriptor', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('fraud_urinishlar')
          .select('*')
          .eq('admin_status', 'register')
          .order('created_at', { ascending: false }),
      ]);

      setFraudlar(fraudRes.data || []);
      setRegisterlar(registerRes.data || []);

      const oquvchilarBilan = (oquvchiRes.data || []).map((t: any) => {
        const profilKey = `juris_profil_data_oquvchi_${t.ism}_${t.familiya}`;
        try {
          const raw = localStorage.getItem(profilKey);
          if (raw) {
            const profilData = JSON.parse(raw);
            return { ...t, profil_verified: profilData.verified || false, profil_face_image: null };
          }
        } catch {}
        return { ...t, profil_verified: false, profil_face_image: null };
      });
      setOquvchilar(oquvchilarBilan);
    } catch (e: any) {
      toast({ title: 'Xato', description: "Ma'lumotlarni yuklashda xatolik", variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  const getOxshashlik = (distance: number) => Math.round((1 - distance) * 100);

  const getOxshashlikRang = (distance: number) => {
    const ox = getOxshashlik(distance);
    if (ox >= 80) return 'text-red-600 bg-red-100 border-red-300';
    if (ox >= 70) return 'text-orange-600 bg-orange-100 border-orange-300';
    return 'text-yellow-600 bg-yellow-100 border-yellow-300';
  };

  const fraudniHal = async (fraudId: string, holat: 'approved' | 'rejected') => {
    try {
      await supabase.from('fraud_urinishlar').update({ admin_status: holat }).eq('id', fraudId);
      toast({ title: holat === 'approved' ? '✅ Tasdiqlandi' : '❌ Rad etildi', description: 'Holat yangilandi' });
      yuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const oquvchiTasdiqBekorQilish = async (oquvchi: OquvchiVerifikatsiya) => {
    const profilKey = `juris_profil_data_oquvchi_${oquvchi.ism}_${oquvchi.familiya}`;
    try {
      const raw = localStorage.getItem(profilKey);
      if (raw) {
        const data = JSON.parse(raw);
        data.verified = false;
        data.verifiedAt = undefined;
        localStorage.setItem(profilKey, JSON.stringify(data));
      }
    } catch {}
    toast({ title: 'Tasdiqlash bekor qilindi', description: `${oquvchi.ism} ${oquvchi.familiya}` });
    yuklash();
  };

  const rasmniOchirish = async (id: string, jadval: 'fraud_urinishlar' | 'fraud_main' = 'fraud_urinishlar') => {
    if (!confirm("Rasmni o'chirib tashlamoqchimisiz? (Xotira tejash uchun)")) return;
    try {
      await supabase.from('fraud_urinishlar').update({ rasm_data: null }).eq('id', id);
      setFraudlar(prev => prev.map(f => f.id === id ? { ...f, rasm_data: null } : f));
      setRegisterlar(prev => prev.map(r => r.id === id ? { ...r, rasm_data: null } : r));
      if (tanlanganFraud?.id === id) setTanlanganFraud(prev => prev ? { ...prev, rasm_data: null } : null);
      if (tanlanganRegister?.id === id) setTanlanganRegister(prev => prev ? { ...prev, rasm_data: null } : null);
      toast({ title: "O'chirildi", description: "Rasm muvaffaqiyatli o'chirildi" });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const oquvchiOchirish = async (oquvchi: OquvchiVerifikatsiya) => {
    if (!confirm(`${oquvchi.ism} ${oquvchi.familiya} ni o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await supabase.from('talabalar').delete().eq('id', oquvchi.id);
      const profilKey = `juris_profil_data_oquvchi_${oquvchi.ism}_${oquvchi.familiya}`;
      localStorage.removeItem(profilKey);
      toast({ title: "O'quvchi o'chirildi", description: `${oquvchi.ism} ${oquvchi.familiya}` });
      setTanlanganOquvchi(null);
      yuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  if (yuklanyapti) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card>
          <CardContent className="py-20 text-center">
            <div className="animate-spin h-16 w-16 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Yuklanmoqda...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── O'QUVCHI BATAFSIL ─────────────────────────────────────────────────────
  if (tanlanganOquvchi) {
    const oq = tanlanganOquvchi;
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setTanlanganOquvchi(null)} size="sm">← Orqaga</Button>
          <h2 className="text-xl font-bold text-gray-800">O'quvchi profili</h2>
        </div>
        <Card className="border-2 border-[hsl(221,83%,53%)] shadow-xl overflow-hidden">
          <div className={`h-3 ${oq.profil_verified ? 'bg-green-500' : 'bg-blue-500'}`} />
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl">
                {oq.familiya[0]}{oq.ism[0]}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{oq.familiya} {oq.ism}</h3>
                <p className="text-sm text-gray-500">{oq.kurs?.toUpperCase()} • {oq.guruh?.toUpperCase()}</p>
                <div className="flex items-center gap-2 mt-1">
                  {oq.profil_verified ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3.5 w-3.5" /> Face ID tasdiqlangan
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      <ScanFace className="h-3.5 w-3.5" /> Face ID ro'yxatda
                    </span>
                  )}
                  {oq.fraud_flag && (
                    <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="h-3.5 w-3.5" /> Shubhali
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Ro'yxatdan o'tish vaqti</p>
                <p className="font-semibold text-gray-800 text-sm">{new Date(oq.created_at).toLocaleString('uz-UZ')}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Face ID holati</p>
                <p className={`font-bold text-sm ${oq.profil_verified ? 'text-green-700' : 'text-blue-700'}`}>
                  {oq.profil_verified ? "✅ Tasdiqlangan" : "🔵 Ro'yxatda (tasdiqlanmagan)"}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {oq.profil_verified && (
                <Button onClick={() => oquvchiTasdiqBekorQilish(oq)} variant="outline" className="border-2 border-amber-400 text-amber-700 hover:bg-amber-50 flex-1">
                  <ShieldX className="h-4 w-4 mr-2" /> Tasdiqlashni bekor qilish
                </Button>
              )}
              <Button onClick={() => oquvchiOchirish(oq)} variant="outline" className="border-2 border-red-400 text-red-700 hover:bg-red-50 flex-1">
                <Trash2 className="h-4 w-4 mr-2" /> Profilni o'chirish
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── FRAUD BATAFSIL ─────────────────────────────────────────────────────────
  if (tanlanganFraud) {
    const oxshashlik = getOxshashlik(tanlanganFraud.distance);
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setTanlanganFraud(null)} size="sm">← Orqaga</Button>
          <h2 className="text-xl font-bold text-red-700">Fraud urinishi batafsil</h2>
        </div>
        <Card className="border-2 border-red-500 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-xl"><ShieldAlert className="h-8 w-8" /></div>
              <div>
                <CardTitle className="text-xl">🚨 Fraud Urinishi</CardTitle>
                <p className="text-red-100 text-sm mt-1">{new Date(tanlanganFraud.created_at).toLocaleString('uz-UZ')}</p>
              </div>
              <div className="ml-auto">
                <span className="text-sm font-bold px-3 py-1.5 rounded-xl border-2 bg-white/10 border-white/30 text-white">
                  {tanlanganFraud.admin_status === 'pending' ? '⏳ Kutilmoqda' : tanlanganFraud.admin_status === 'approved' ? '✅ Tasdiqlangan' : '❌ Rad etilgan'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
                <h3 className="font-bold text-red-800 mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Kirmoqchi bo'lgan shaxs</h3>
                <div className="space-y-2">
                  {[['Ism', tanlanganFraud.ism], ['Familiya', tanlanganFraud.familiya], ['Kurs', tanlanganFraud.kurs], ['Guruh', tanlanganFraud.guruh]].map(([label, val]) => (
                    <div key={label} className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                      <span className="text-gray-600 text-sm">{label}:</span>
                      <span className="font-bold text-gray-900">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
                <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><User className="h-5 w-5" />Tizimda mos kelgan profil</h3>
                <div className="space-y-2">
                  {[['Ism', tanlanganFraud.mos_talaba_ism], ['Familiya', tanlanganFraud.mos_talaba_familiya], ['Kurs', tanlanganFraud.mos_talaba_kurs], ['Guruh', tanlanganFraud.mos_talaba_guruh]].map(([label, val]) => (
                    <div key={label} className="flex justify-between items-center py-1.5 px-3 bg-white rounded-lg">
                      <span className="text-gray-600 text-sm">{label}:</span>
                      <span className="font-bold text-gray-900">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-5">
              <h3 className="font-bold text-gray-800 mb-3">Yuz o'xshashlik darajasi</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 to-red-700 rounded-full" style={{ width: `${oxshashlik}%` }} />
                </div>
                <span className={`text-3xl font-black px-4 py-2 rounded-xl border-2 ${getOxshashlikRang(tanlanganFraud.distance)}`}>{oxshashlik}%</span>
              </div>
            </div>
            {tanlanganFraud.rasm_data && (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Eye className="h-5 w-5" />Yuz rasmi</h3>
                <div className="flex justify-center">
                  <img src={tanlanganFraud.rasm_data} alt="Fraud rasmi" className="max-w-xs rounded-xl border-2 border-gray-300 shadow-md" style={{ transform: 'scaleX(-1)' }} />
                </div>
                <Button onClick={() => rasmniOchirish(tanlanganFraud.id)} variant="outline" size="sm" className="w-full mt-3 border-2 border-red-300 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" /> Rasmni o'chirish (xotira tejash)
                </Button>
              </div>
            )}
            {tanlanganFraud.admin_status === 'pending' && (
              <div className="flex gap-3">
                <Button onClick={() => { fraudniHal(tanlanganFraud.id, 'approved'); setTanlanganFraud(null); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="h-4 w-4 mr-2" /> Tasdiqlash (ruxsat berish)
                </Button>
                <Button onClick={() => { fraudniHal(tanlanganFraud.id, 'rejected'); setTanlanganFraud(null); }} variant="outline" className="flex-1 border-2 border-red-400 text-red-700 hover:bg-red-50">
                  <ShieldX className="h-4 w-4 mr-2" /> Rad etish
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ASOSIY RO'YHAT ─────────────────────────────────────────────────────────
  const pendingFraudlar = fraudlar.filter(f => f.admin_status === 'pending');

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <Card className="border-2 border-[hsl(221,83%,53%)] shadow-xl">
        <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-3 rounded-xl"><ScanFace className="h-8 w-8" /></div>
              <div>
                <CardTitle className="text-2xl">Face ID Monitoring</CardTitle>
                <p className="text-blue-100 text-sm mt-1">O'quvchi tasdiqlashlari va fraud urinishlar</p>
              </div>
            </div>
            <Button onClick={yuklash} variant="secondary" size="sm" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Yangilash
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Statistika */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Jami o'quvchilar", val: oquvchilar.length, icon: <User className="h-6 w-6 text-blue-600" />, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-900' },
          { label: "Yangi ro'yxatdan o'tish", val: registerlar.length, icon: <ScanFace className="h-6 w-6 text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-900' },
          { label: 'Fraud urinishlar', val: fraudlar.length, icon: <ShieldAlert className="h-6 w-6 text-red-600" />, bg: 'bg-red-50 border-red-200', text: 'text-red-900' },
          { label: 'Kutilayotgan fraud', val: pendingFraudlar.length, icon: <AlertTriangle className="h-6 w-6 text-amber-600" />, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-900' },
        ].map(s => (
          <Card key={s.label} className={`border-2 ${s.bg}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-xl shadow-sm">{s.icon}</div>
                <div>
                  <p className="text-xs text-gray-600 font-medium leading-tight">{s.label}</p>
                  <p className={`text-2xl font-black ${s.text}`}>{s.val}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-1.5 ${activeTab === 'register' ? 'bg-white text-emerald-600 shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <ShieldCheck className="h-4 w-4" /> Yangi ({registerlar.length})
          {registerlar.length > 0 && (
            <span className="bg-emerald-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {registerlar.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('oquvchi_tasdiq')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-1.5 ${activeTab === 'oquvchi_tasdiq' ? 'bg-white text-[hsl(221,83%,53%)] shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <ScanFace className="h-4 w-4" /> Face ID ({oquvchilar.length})
        </button>
        <button
          onClick={() => setActiveTab('fraud')}
          className={`flex-1 py-2.5 px-3 rounded-lg font-semibold transition-all text-sm flex items-center justify-center gap-1.5 ${activeTab === 'fraud' ? 'bg-white text-red-600 shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <ShieldAlert className="h-4 w-4" /> Fraud ({fraudlar.length})
          {pendingFraudlar.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {pendingFraudlar.length}
            </span>
          )}
        </button>
      </div>

      {/* ── YANGI RO'YXATDAN O'TISH TAB ────────────────────────────────────── */}
      {activeTab === 'register' && (
        <div>
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p>
              Bu yerda o'quvchilar profil tasdiqlashda yuborgan <strong>yuz rasmlari</strong> ko'rsatiladi.
              Rasmni ko'rib, foydalanuvchi haqiqatda o'sha shaxs ekanligini tekshiring.
            </p>
          </div>
          {registerlar.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShieldCheck className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                <p className="text-lg text-gray-500">Hali yangi ro'yxatdan o'tishlar yo'q</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {registerlar.map((reg) => (
                <Card key={reg.id} className="border-2 border-emerald-200 hover:border-emerald-400 transition-all hover:shadow-md">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      {reg.rasm_data ? (
                        <img
                          src={reg.rasm_data}
                          alt={`${reg.ism} ${reg.familiya}`}
                          className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-300 shadow flex-shrink-0 cursor-pointer"
                          style={{ transform: 'scaleX(-1)' }}
                          onClick={() => setTanlanganRegister(reg)}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center flex-shrink-0">
                          <User className="h-7 w-7 text-emerald-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{reg.familiya} {reg.ism}</span>
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                            {reg.kurs} / {reg.guruh?.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(reg.created_at).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {reg.rasm_data && (
                          <button
                            onClick={() => setTanlanganRegister(reg)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" /> Ko'rish
                          </button>
                        )}
                        <button
                          onClick={() => rasmniOchirish(reg.id)}
                          className="p-2 rounded-xl border-2 border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                          title="Rasmni o'chirish"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── O'QUVCHI FACE ID TAB ─────────────────────────────────────────────── */}
      {activeTab === 'oquvchi_tasdiq' && (
        <div>
          {oquvchilar.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ScanFace className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                <p className="text-lg text-gray-500">Hali birorta o'quvchi Face ID bilan ro'yxatdan o'tmagan</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {oquvchilar.map((oq) => (
                <Card
                  key={oq.id}
                  className="border-2 border-gray-200 hover:border-[hsl(221,83%,53%)] cursor-pointer transition-all hover:shadow-md"
                  onClick={() => setTanlanganOquvchi(oq)}
                >
                  <CardContent className="py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                        {oq.familiya[0]}{oq.ism[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{oq.familiya} {oq.ism}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {oq.kurs?.toUpperCase()} / {oq.guruh?.toUpperCase()}
                          </span>
                          {oq.profil_verified && (
                            <span className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              <ShieldCheck className="h-3 w-3" /> Tasdiqlangan
                            </span>
                          )}
                          {oq.fraud_flag && (
                            <span className="flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                              <ShieldAlert className="h-3 w-3" /> Shubhali
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(oq.created_at).toLocaleString('uz-UZ')}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); oquvchiOchirish(oq); }}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                        title="O'chirish"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FRAUD TAB ──────────────────────────────────────────────────────────── */}
      {activeTab === 'fraud' && (
        <div>
          {fraudlar.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle className="h-16 w-16 text-green-200 mx-auto mb-4" />
                <p className="text-lg text-green-600">✅ Fraud urinishlari topilmadi</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {fraudlar.map((fraud, idx) => {
                const oxshashlik = getOxshashlik(fraud.distance);
                return (
                  <Card
                    key={fraud.id}
                    className="border-2 border-red-200 hover:border-red-500 cursor-pointer transition-all hover:shadow-md"
                    onClick={() => setTanlanganFraud(fraud)}
                  >
                    <CardContent className="py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 text-red-600 font-bold w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-gray-900">{fraud.ism} {fraud.familiya}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {fraud.kurs} / {fraud.guruh}
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              fraud.admin_status === 'pending' ? 'bg-amber-100 text-amber-700'
                              : fraud.admin_status === 'approved' ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                            }`}>
                              {fraud.admin_status === 'pending' ? '⏳ Kutilmoqda' : fraud.admin_status === 'approved' ? '✅ Ruxsat' : '❌ Rad'}
                            </span>
                          </div>
                          <p className="text-xs text-red-500 font-medium mt-0.5">
                            → {fraud.mos_talaba_ism} {fraud.mos_talaba_familiya} bilan mos keldi
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(fraud.created_at).toLocaleString('uz-UZ')}
                          </p>
                        </div>
                        <div className={`text-lg font-black px-3 py-1 rounded-xl border-2 flex-shrink-0 ${getOxshashlikRang(fraud.distance)}`}>
                          {oxshashlik}%
                        </div>
                        {fraud.rasm_data && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); rasmniOchirish(fraud.id); }}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                              title="Rasmni o'chirish"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <Eye className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rasm ko'rish modal (yangi ro'yxatdan o'tish) */}
      {tanlanganRegister && tanlanganRegister.rasm_data && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setTanlanganRegister(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-lg">{tanlanganRegister.familiya} {tanlanganRegister.ism}</p>
                  <p className="text-emerald-100 text-sm">{tanlanganRegister.kurs} / {tanlanganRegister.guruh?.toUpperCase()}</p>
                </div>
                <button onClick={() => setTanlanganRegister(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <img
                src={tanlanganRegister.rasm_data}
                alt="Yuz rasmi"
                className="w-full rounded-xl border-2 border-gray-200 shadow"
                style={{ transform: 'scaleX(-1)' }}
              />
              <p className="text-xs text-gray-500 text-center">{new Date(tanlanganRegister.created_at).toLocaleString('uz-UZ')}</p>
              <Button
                onClick={() => { rasmniOchirish(tanlanganRegister.id); setTanlanganRegister(null); }}
                variant="outline"
                className="w-full border-2 border-red-300 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Rasmni o'chirish (ko'rib bo'lgandan keyin)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
