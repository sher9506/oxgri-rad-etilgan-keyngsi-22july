import { useState, useEffect } from 'react';
import { Toplam } from '@/types';
import { FileText, BarChart3, Trophy, Bell, Send, Loader2, GraduationCap, Zap, Layers, Users, BrainCircuit } from 'lucide-react';
import AvtomatikBoshlash from './AvtomatikBoshlash';
import UstozAiKazusYaratish from './UstozAiKazusYaratish';
import SavolJavobUstoz from './SavolJavobUstoz';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import ToplamYaratish from './ToplamYaratish';
import UstozNatijalar from './UstozNatijalar';
import UstozStatistika from './UstozStatistika';
import OquvchilarRoyhat from './OquvchilarRoyhat';

const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];
const GURUHLAR = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3'];

export default function UstozKabineti() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'yaratish' | 'natijalar' | 'statistika' | 'bildirishnoma' | 'avtomatik' | 'savol_javob' | 'oquvchilar' | 'ai_kazus'>('yaratish');
  const [tahrirlashToplam, setTahrirlashToplam] = useState<Toplam | null>(null);

  const handleTahrirlash = (toplam: Toplam) => {
    setTahrirlashToplam(toplam);
    setActiveTab('yaratish');
  };

  const handleTahrirlashTugadi = () => {
    setTahrirlashToplam(null);
    setActiveTab('natijalar');
  };

  if (!user || user.rol !== 'ustoz') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
            <CardTitle className="text-center">Ustoz Kabineti</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                Ustoz kabinetiga kirish uchun o'ng tepada "Kirish" tugmasini bosib,
                ustoz sifatida tizimga kiring.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Eslatma:</strong> Admin tomonidan tasdiqlanganingizdan so'ng kira olasiz.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <UstozKabinetInner
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tahrirlashToplam={tahrirlashToplam}
      handleTahrirlash={handleTahrirlash}
      handleTahrirlashTugadi={handleTahrirlashTugadi}
    />
  );
}


function BildirishnomaYuborish({ ustozId }: { ustozId: string }) {
  const { toast } = useToast();
  // Kim uchun
  const [oquvchiTuri, setOquvchiTuri] = useState<'barchasi' | 'kurs' | 'kurs_guruh' | 'talaba'>('barchasi');
  const [kurs, setKurs] = useState('');
  const [guruh, setGuruh] = useState('');
  const [tanlananTalaba, setTanlananTalaba] = useState('');
  const [talabalar, setTalabalar] = useState<{ism: string, familiya: string}[]>([]);
  const [talabalarYuklanmoqda, setTalabalarYuklanmoqda] = useState(false);
  const [sarlavha, setSarlavha] = useState('');
  const [matn, setMatn] = useState('');
  const [tur, setTur] = useState<'info' | 'ogohlantirish' | 'muhim'>('info');
  const [yuborYuklanyapti, setYuborYuklanyapti] = useState(false);
  const [yuborilganlar, setYuborilganlar] = useState<any[]>([]);

  useEffect(() => {
    yuborilganlarniYuklash();
  }, []);

  const yuborilganlarniYuklash = async () => {
    try {
      const { data } = await supabase
        .from('bildirishnomalar')
        .select('*')
        .eq('qabul_qiluvchi_tur', 'oquvchi')
        .order('created_at', { ascending: false })
        .limit(20);
      setYuborilganlar(data || []);
    } catch (e) { console.error(e); }
  };

  const talabalarniYuklash = async (k: string, g: string) => {
    if (!k || !g) { setTalabalar([]); return; }
    setTalabalarYuklanmoqda(true);
    try {
      const { data, error } = await supabase
        .from('talabalar')
        .select('ism, familiya')
        .eq('kurs', k)
        .eq('guruh', g)
        .order('familiya', { ascending: true });
      if (error) throw error;
      setTalabalar(data || []);
    } catch (e) {
      setTalabalar([]);
    } finally {
      setTalabalarYuklanmoqda(false);
    }
  };

  const yuborish = async () => {
    if (!sarlavha.trim() || !matn.trim()) {
      toast({ title: 'Xato', description: "Sarlavha va matn to'ldiring", variant: 'destructive' });
      return;
    }
    if (oquvchiTuri === 'talaba' && !tanlananTalaba) {
      toast({ title: 'Xato', description: 'Talabani tanlang', variant: 'destructive' });
      return;
    }
    if (oquvchiTuri === 'kurs' && !kurs) {
      toast({ title: 'Xato', description: 'Kursni tanlang', variant: 'destructive' });
      return;
    }
    if (oquvchiTuri === 'kurs_guruh' && (!kurs || !guruh)) {
      toast({ title: 'Xato', description: 'Kurs va guruhni tanlang', variant: 'destructive' });
      return;
    }

    setYuborYuklanyapti(true);
    try {
      let qabul_id: string | null = null;
      let filter_kurs: string | null = null;
      let filter_guruh: string | null = null;

      if (oquvchiTuri === 'talaba') {
        qabul_id = tanlananTalaba;
      } else if (oquvchiTuri === 'kurs') {
        filter_kurs = kurs;
      } else if (oquvchiTuri === 'kurs_guruh') {
        filter_kurs = kurs;
        filter_guruh = guruh;
      }

      const { error } = await supabase.from('bildirishnomalar').insert({
        qabul_qiluvchi_tur: 'oquvchi',
        qabul_qiluvchi_id: qabul_id,
        filter_kurs,
        filter_guruh,
        sarlavha: sarlavha.trim(),
        matn: matn.trim(),
        tur,
      });
      if (error) throw error;

      toast({ title: 'Yuborildi!', description: 'Bildirishnoma muvaffaqiyatli yuborildi' });
      setSarlavha(''); setMatn(''); setTanlananTalaba('');
      setKurs(''); setGuruh(''); setOquvchiTuri('barchasi'); setTalabalar([]);
      await yuborilganlarniYuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setYuborYuklanyapti(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-[hsl(221,83%,53%)]">
        <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
          <CardTitle className="flex items-center gap-2">
            <Send className="h-6 w-6" />
            O'quvchilarga bildirishnoma yuborish
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">

          {/* Kimga yuborilsin */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">Kimga yuborilsin?</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'barchasi', label: '🌍 Barcha talabalar' },
                { key: 'kurs', label: '📚 Kurs bo\'yicha' },
                { key: 'kurs_guruh', label: '👥 Kurs + Guruh' },
                { key: 'talaba', label: '👤 Muayyan talaba' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setOquvchiTuri(t.key as any);
                    setKurs(''); setGuruh(''); setTanlananTalaba(''); setTalabalar([]);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                    oquvchiTuri === t.key
                      ? 'bg-[hsl(221,83%,53%)] text-white border-[hsl(221,83%,53%)]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[hsl(221,83%,53%)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Kurs tanlash */}
          {(oquvchiTuri === 'kurs' || oquvchiTuri === 'kurs_guruh' || oquvchiTuri === 'talaba') && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Kurs</label>
              <div className="grid grid-cols-4 gap-2">
                {KURSLAR.map(k => (
                  <button key={k} onClick={() => {
                    setKurs(k);
                    setGuruh('');
                    setTanlananTalaba('');
                    setTalabalar([]);
                  }}
                    className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                      kurs === k
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                    }`}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Guruh tanlash */}
          {(oquvchiTuri === 'kurs_guruh' || oquvchiTuri === 'talaba') && kurs && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Guruh</label>
              <div className="flex flex-wrap gap-2">
                {GURUHLAR.map(g => (
                  <button key={g} onClick={() => {
                    setGuruh(g);
                    setTanlananTalaba('');
                    if (oquvchiTuri === 'talaba') talabalarniYuklash(kurs, g);
                  }}
                    className={`py-1.5 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                      guruh === g
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                    }`}>
                    {g.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Talabalar ro'yhati (faqat 'talaba' turida) */}
          {oquvchiTuri === 'talaba' && kurs && guruh && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Talabani tanlang</label>
              {talabalarYuklanmoqda ? (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-gray-500">Yuklanmoqda...</span>
                </div>
              ) : talabalar.length === 0 ? (
                <div className="p-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-sm text-yellow-800 text-center">
                  Bu guruhda talabalar topilmadi
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto border-2 border-gray-200 rounded-xl divide-y divide-gray-100">
                  {talabalar.map((t, i) => {
                    const key = `${t.ism}|${t.familiya}`;
                    const selected = tanlananTalaba === key;
                    return (
                      <button
                        key={i}
                        onClick={() => setTanlananTalaba(selected ? '' : key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                          selected ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}>
                          {selected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="font-medium">{t.familiya} {t.ism}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tanlangan natija preview */}
          <div className={`p-3 rounded-xl border-2 text-sm font-medium ${
            oquvchiTuri === 'barchasi' ? 'bg-green-50 border-green-200 text-green-800' :
            oquvchiTuri === 'kurs' && kurs ? 'bg-blue-50 border-blue-200 text-blue-800' :
            oquvchiTuri === 'kurs_guruh' && kurs && guruh ? 'bg-purple-50 border-purple-200 text-purple-800' :
            oquvchiTuri === 'talaba' && tanlananTalaba ? 'bg-orange-50 border-orange-200 text-orange-800' :
            'bg-gray-50 border-gray-200 text-gray-500'
          }`}>
            📬 Yuboriladi:
            {oquvchiTuri === 'barchasi' && ' Barcha talabalar'}
            {oquvchiTuri === 'kurs' && kurs && ` ${kurs} barcha talabalari`}
            {oquvchiTuri === 'kurs' && !kurs && ' (kurs tanlanmagan)'}
            {oquvchiTuri === 'kurs_guruh' && kurs && guruh && ` ${kurs} / ${guruh.toUpperCase()} guruhi`}
            {oquvchiTuri === 'kurs_guruh' && (!kurs || !guruh) && ' (kurs yoki guruh tanlanmagan)'}
            {oquvchiTuri === 'talaba' && tanlananTalaba && ` ${tanlananTalaba.replace('|', ' ')}`}
            {oquvchiTuri === 'talaba' && !tanlananTalaba && ' (talaba tanlanmagan)'}
          </div>

          {/* Tur */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Bildirishnoma turi</label>
            <div className="flex gap-2">
              {(['info', 'ogohlantirish', 'muhim'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTur(t)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                    tur === t
                      ? t === 'info' ? 'bg-blue-500 text-white border-blue-500'
                        : t === 'ogohlantirish' ? 'bg-yellow-500 text-white border-yellow-500'
                        : 'bg-red-500 text-white border-red-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {t === 'info' ? "ℹ️ Ma'lumot" : t === 'ogohlantirish' ? '⚠️ Ogohlantirish' : '🔴 Muhim'}
                </button>
              ))}
            </div>
          </div>

          {/* Sarlavha */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Sarlavha</label>
            <Input placeholder="Bildirishnoma sarlavhasi" value={sarlavha} onChange={(e) => setSarlavha(e.target.value)} />
          </div>

          {/* Matn */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Matn</label>
            <Textarea placeholder="Bildirishnoma matni..." value={matn} onChange={(e) => setMatn(e.target.value)} rows={4} />
          </div>

          <Button onClick={yuborish} disabled={yuborYuklanyapti} className="w-full" size="lg">
            {yuborYuklanyapti
              ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Yuborilmoqda...</>
              : <><Send className="mr-2 h-5 w-5" />Bildirishnoma yuborish</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* Yuborilgan bildirishnomalar */}
      {yuborilganlar.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5" />
              Oxirgi yuborilgan bildirishnomalar ({yuborilganlar.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {yuborilganlar.map((b) => (
                <div key={b.id} className={`p-4 rounded-xl border-2 ${
                  b.tur === 'muhim' ? 'border-red-200 bg-red-50' :
                  b.tur === 'ogohlantirish' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-900">{b.sarlavha}</span>
                        {b.filter_kurs && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            {b.filter_kurs}{b.filter_guruh ? ` / ${b.filter_guruh.toUpperCase()}` : ''}
                          </span>
                        )}
                        {b.qabul_qiluvchi_id && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                            👤 {b.qabul_qiluvchi_id.replace('|', ' ')}
                          </span>
                        )}
                        {!b.filter_kurs && !b.qabul_qiluvchi_id && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            🌍 Barcha talabalar
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{b.matn}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(b.created_at).toLocaleString('uz-UZ')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UstozKabinetInner({
  user,
  activeTab,
  setActiveTab,
  tahrirlashToplam,
  handleTahrirlash,
  handleTahrirlashTugadi,
}: {
  user: any;
  activeTab: string;
  setActiveTab: (t: any) => void;
  tahrirlashToplam: Toplam | null;
  handleTahrirlash: (t: Toplam) => void;
  handleTahrirlashTugadi: () => void;
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="border-2 border-[hsl(221,83%,53%)] shadow-lg">
        <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{user.ism} {user.familiya}</CardTitle>
              <p className="text-sm text-blue-100 mt-1">@{user.login || 'Ustoz'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            <Button onClick={() => setActiveTab('yaratish')} variant={activeTab === 'yaratish' ? 'default' : 'outline'} size="sm">
              <FileText className="h-4 w-4 mr-1" />Toplam
            </Button>
            <Button onClick={() => setActiveTab('natijalar')} variant={activeTab === 'natijalar' ? 'default' : 'outline'} size="sm">
              <BarChart3 className="h-4 w-4 mr-1" />Natijalar
            </Button>
            <Button onClick={() => setActiveTab('statistika')} variant={activeTab === 'statistika' ? 'default' : 'outline'} size="sm">
              <Trophy className="h-4 w-4 mr-1" />Statistika
            </Button>
            <Button onClick={() => setActiveTab('bildirishnoma')} variant={activeTab === 'bildirishnoma' ? 'default' : 'outline'} size="sm">
              <Bell className="h-4 w-4 mr-1" />Xabarnoma
            </Button>
            <Button onClick={() => setActiveTab('oquvchilar')} variant={activeTab === 'oquvchilar' ? 'default' : 'outline'} size="sm" className={activeTab === 'oquvchilar' ? '' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}>
              <Users className="h-4 w-4 mr-1" />O'quvchilarim
            </Button>
            <Button onClick={() => setActiveTab('avtomatik')} variant={activeTab === 'avtomatik' ? 'default' : 'outline'} size="sm" className={activeTab === 'avtomatik' ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : 'border-green-400 text-green-700 hover:bg-green-50'}>
              <Zap className="h-4 w-4 mr-1" />Avtomatik
            </Button>
            <Button
              onClick={() => setActiveTab('ai_kazus')}
              variant={activeTab === 'ai_kazus' ? 'default' : 'outline'}
              size="sm"
              className={activeTab === 'ai_kazus'
                ? 'bg-violet-600 hover:bg-violet-700 text-white border-violet-600'
                : 'border-violet-300 text-violet-700 hover:bg-violet-50'
              }
            >
              <BrainCircuit className="h-4 w-4 mr-1" />AI Kazus
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="animate-slide-in">
        {activeTab === 'yaratish' && (
          <ToplamYaratish ustozId={user.ustoz_id!} tahrirlashToplam={tahrirlashToplam} onTahrirlashTugadi={handleTahrirlashTugadi} />
        )}
        {activeTab === 'natijalar' && (
          <UstozNatijalar ustozId={user.ustoz_id!} onTahrirlash={handleTahrirlash} />
        )}
        {activeTab === 'statistika' && <UstozStatistika ustozId={user.ustoz_id!} />}
        {activeTab === 'bildirishnoma' && <BildirishnomaYuborish ustozId={user.ustoz_id!} />}
        {activeTab === 'avtomatik' && <AvtomatikBoshlash ustozId={user.ustoz_id!} />}
        {activeTab === 'oquvchilar' && <OquvchilarRoyhat ustozId={user.ustoz_id} mode="ustoz" />}
        {activeTab === 'savol_javob' && <SavolJavobUstoz />}
        {activeTab === 'ai_kazus' && <UstozAiKazusYaratish />}
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
