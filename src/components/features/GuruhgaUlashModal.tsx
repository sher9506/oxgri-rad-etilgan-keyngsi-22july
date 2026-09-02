import { useState, useEffect } from 'react';
import { X, Send, Users, BookOpen, ClipboardList, CheckCircle, Loader2, Bell, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { sendTestOmmaviyBotXabar, sendKazusOmmaviyBotXabar } from '@/lib/botNotification';

const KURSLAR = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];
const GURUHLAR = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3'];

interface GuruhgaUlashModalProps {
  isOpen: boolean;
  onClose: () => void;
  tur: 'toplam' | 'test';
  kod: string;
  nomi: string;
  ustozId?: string;
  ommaviyHolat?: boolean;
  onOmmaviyOzgartirish?: (yangiHolat: boolean) => void;
  // Test/kazus qo'shimcha ma'lumotlari (bot xabari uchun)
  savollarSoni?: number;
  vaqtDaqiqa?: number;
  ustozIsmi?: string;
  narx?: number;
}

export default function GuruhgaUlashModal({ isOpen, onClose, tur, kod, nomi, ustozId, ommaviyHolat = false, onOmmaviyOzgartirish, savollarSoni, vaqtDaqiqa, ustozIsmi, narx }: GuruhgaUlashModalProps) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'bildirishnoma' | 'ommaviy'>('bildirishnoma');
  const [tanlovTuri, setTanlovTuri] = useState<'barchasi' | 'kurs' | 'kurs_guruh'>('kurs_guruh');
  const [kurs, setKurs] = useState('');
  const [guruh, setGuruh] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [yuborildi, setYuborildi] = useState(false);
  const [talabaCount, setTalabaCount] = useState<number | null>(null);
  const [ommaviyYuklanyapti, setOmmaviyYuklanyapti] = useState(false);
  const [joriyOmmaviy, setJoriyOmmaviy] = useState(ommaviyHolat);

  useEffect(() => {
    setJoriyOmmaviy(ommaviyHolat);
  }, [ommaviyHolat]);

  // Reset modal yopilganda
  useEffect(() => {
    if (!isOpen) {
      setKurs('');
      setGuruh('');
      setTanlovTuri('kurs_guruh');
      setYuborildi(false);
      setActiveTab('bildirishnoma');
    }
  }, [isOpen]);

  // Talabalar sonini sanash
  useEffect(() => {
    if (!isOpen) return;
    const sanash = async () => {
      try {
        let query = supabase.from('talabalar').select('id', { count: 'exact', head: true });
        if (tanlovTuri === 'kurs' && kurs) query = query.eq('kurs', kurs);
        if (tanlovTuri === 'kurs_guruh' && kurs && guruh) {
          query = query.eq('kurs', kurs).eq('guruh', guruh);
        }
        if (tanlovTuri === 'barchasi' || (tanlovTuri === 'kurs' && kurs) || (tanlovTuri === 'kurs_guruh' && kurs && guruh)) {
          const { count } = await query;
          setTalabaCount(count);
        } else {
          setTalabaCount(null);
        }
      } catch (e) {
        setTalabaCount(null);
      }
    };
    sanash();
  }, [tanlovTuri, kurs, guruh, isOpen]);

  // Bildirishnoma yuborish
  const bildirishnomaYuborish = async () => {
    if (tanlovTuri === 'kurs' && !kurs) {
      toast({ title: 'Xato', description: 'Kursni tanlang', variant: 'destructive' });
      return;
    }
    if (tanlovTuri === 'kurs_guruh' && (!kurs || !guruh)) {
      toast({ title: 'Xato', description: 'Kurs va guruhni tanlang', variant: 'destructive' });
      return;
    }

    setYuklanyapti(true);
    try {
      const emoji = tur === 'toplam' ? '📝' : '📚';
      const turNom = tur === 'toplam' ? 'Kazus Toplami' : 'Test';
      const sarlavha = `${emoji} Yangi ${turNom} yuborildi!`;
      const matn = `"${nomi}" — ${turNom}\nKirish uchun kodni ishlating: ${kod}\n\nBosh sahifaga o'ting va "Sinovni boshlash" bo'limida ushbu kodni kiriting.`;

      const insertData: any = {
        qabul_qiluvchi_tur: 'oquvchi',
        qabul_qiluvchi_id: null,
        sarlavha,
        matn: `${matn}||META:${JSON.stringify({ tur, kod })}`,
        tur: 'info',
        filter_kurs: null,
        filter_guruh: null,
      };

      if (tanlovTuri === 'kurs' && kurs) {
        insertData.filter_kurs = kurs;
      } else if (tanlovTuri === 'kurs_guruh' && kurs && guruh) {
        insertData.filter_kurs = kurs;
        insertData.filter_guruh = guruh;
      }

      const { error } = await supabase.from('bildirishnomalar').insert(insertData);
      if (error) throw error;

      setYuborildi(true);
      toast({
        title: '✅ Muvaffaqiyatli yuborildi!',
        description: `${talabaCount ?? '?'} ta talabaga bildirishnoma yuborildi`,
      });
      setTimeout(() => {
        setYuborildi(false);
        onClose();
        setKurs('');
        setGuruh('');
        setTanlovTuri('kurs_guruh');
      }, 2000);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  // Ommaviy holatni o'zgartirish
  const ommaviyniOzgartirish = async () => {
    setOmmaviyYuklanyapti(true);
    const yangiHolat = !joriyOmmaviy;
    try {
      const jadval = tur === 'test' ? 'testlar' : 'toplamlar';
      const { error } = await supabase
        .from(jadval)
        .update({ ommaviy: yangiHolat })
        .eq('kod', kod);
      if (error) throw error;
      setJoriyOmmaviy(yangiHolat);
      onOmmaviyOzgartirish?.(yangiHolat);
      toast({
        title: yangiHolat ? '🌍 Ommaviy qilindi!' : '🔒 Ommaviydan olib tashlandi',
        description: yangiHolat
          ? `"${nomi}" endi Mavjud ${tur === 'test' ? 'testlar' : 'kazuslar'} sahifasida ko'rinadi`
          : `"${nomi}" endi faqat sizga ko'rinadi`,
      });

      // Bot xabari faqat ommaviy qilinganda (o'chirilganda emas)
      if (yangiHolat) {
        if (tur === 'test') {
          sendTestOmmaviyBotXabar({
            testNomi: nomi,
            testKod: kod,
            savollarSoni: savollarSoni || 0,
            vaqtDaqiqa: vaqtDaqiqa || 30,
            ustozIsmi: ustozIsmi || 'Ustoz',
            narx,
          }).catch((e) => console.warn('Bot test xabar xatosi:', e));
        } else {
          sendKazusOmmaviyBotXabar({
            mavzu: nomi,
            kod,
            kazuslarSoni: savollarSoni || 0,
            vaqtDaqiqa: vaqtDaqiqa || 30,
            ustozIsmi: ustozIsmi || 'Ustoz',
            narx,
          }).catch((e) => console.warn('Bot kazus xabar xatosi:', e));
        }
        toast({
          title: '📢 Bot xabari yuborilmoqda...',
          description: 'Barcha foydalanuvchilarga Telegram orqali xabar yuboriladi',
        });
      }
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setOmmaviyYuklanyapti(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white p-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                {tur === 'toplam' ? <ClipboardList className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold">Ulashish va sozlamalar</h3>
                <p className="text-blue-100 text-sm truncate max-w-xs">{nomi} • Kod: {kod}</p>
              </div>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-xl transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {yuborildi ? (
          <div className="p-10 text-center flex-1 flex flex-col items-center justify-center">
            <div className="bg-green-100 p-6 rounded-full mb-4">
              <CheckCircle className="h-16 w-16 text-green-500 animate-bounce" />
            </div>
            <p className="text-2xl font-bold text-green-600">Bildirishnoma yuborildi!</p>
            <p className="text-gray-500 mt-2">
              {talabaCount !== null ? `${talabaCount} ta talabaga` : 'Talabalarga'} bildirishnoma yuborildi
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-5 pt-4 gap-2">
              <button
                onClick={() => setActiveTab('bildirishnoma')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'bildirishnoma'
                    ? 'border-[hsl(221,83%,53%)] text-[hsl(221,83%,53%)] bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Bell className="h-4 w-4" />
                Bildirishnoma
              </button>
              <button
                onClick={() => setActiveTab('ommaviy')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'ommaviy'
                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe className="h-4 w-4" />
                Ommaviy qilish
                {joriyOmmaviy && (
                  <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black">ON</span>
                )}
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* ─── BILDIRISHNOMA TAB ─── */}
              {activeTab === 'bildirishnoma' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Bell className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800">
                      O'quvchilarning <strong>bildirishnomalar qo'ng'irog'i</strong>ga xabar yuboriladi.
                      Ular bildirishnomani bosib, to'g'ridan-to'g'ri sinovga kirishi mumkin.
                    </p>
                  </div>

                  {/* Kimga */}
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 block">Kimga yuborilsin?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'barchasi', label: '🌍 Barcha', desc: 'Hamma talabalar' },
                        { key: 'kurs', label: '📚 Kurs', desc: 'Bir kurs' },
                        { key: 'kurs_guruh', label: '👥 Guruh', desc: 'Aniq guruh' },
                      ].map((t) => (
                        <button
                          key={t.key}
                          onClick={() => { setTanlovTuri(t.key as any); setKurs(''); setGuruh(''); }}
                          className={`py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-center ${
                            tanlovTuri === t.key
                              ? 'bg-[hsl(221,83%,53%)] text-white border-[hsl(221,83%,53%)]'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-[hsl(221,83%,53%)]'
                          }`}
                        >
                          <span className="block">{t.label}</span>
                          <span className={`text-xs mt-0.5 block ${tanlovTuri === t.key ? 'text-blue-100' : 'text-gray-400'}`}>{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {(tanlovTuri === 'kurs' || tanlovTuri === 'kurs_guruh') && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Kurs tanlang:</label>
                      <div className="grid grid-cols-4 gap-2">
                        {KURSLAR.map((k) => (
                          <button
                            key={k}
                            onClick={() => { setKurs(k); setGuruh(''); }}
                            className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                              kurs === k ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                            }`}
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {tanlovTuri === 'kurs_guruh' && kurs && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Guruh tanlang:</label>
                      <div className="flex flex-wrap gap-2">
                        {GURUHLAR.map((g) => (
                          <button
                            key={g}
                            onClick={() => setGuruh(g)}
                            className={`py-2 px-3.5 rounded-xl text-sm font-bold border-2 transition-all ${
                              guruh === g ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                            }`}
                          >
                            {g.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Natija preview */}
                  <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
                    talabaCount !== null ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <Users className={`h-5 w-5 flex-shrink-0 ${talabaCount !== null ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                      {talabaCount !== null ? (
                        <>
                          <p className="font-bold text-green-800">{talabaCount} ta talaba</p>
                          <p className="text-xs text-green-600">
                            {tanlovTuri === 'barchasi' && "Barcha ro'yxatdan o'tgan talabalar"}
                            {tanlovTuri === 'kurs' && kurs && `${kurs} talabalari`}
                            {tanlovTuri === 'kurs_guruh' && kurs && guruh && `${kurs} / ${guruh.toUpperCase()} guruh talabalari`}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Tanlov qiling</p>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={bildirishnomaYuborish}
                    disabled={yuklanyapti || talabaCount === null}
                    className="w-full h-12 text-base font-bold"
                    size="lg"
                  >
                    {yuklanyapti
                      ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Yuborilmoqda...</>
                      : <><Bell className="mr-2 h-5 w-5" />{talabaCount !== null ? `${talabaCount} ta talabaga bildirishnoma` : 'Yuborish'}</>
                    }
                  </Button>
                </>
              )}

              {/* ─── OMMAVIY QO'YISH TAB ─── */}
              {activeTab === 'ommaviy' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <Globe className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-900 text-sm">Ommaviy qilish nima?</p>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        Ommaviy qilingan {tur === 'test' ? 'test' : 'kazus'} <strong>"Mavjud {tur === 'test' ? 'testlar' : 'kazuslar'}"</strong> sahifasida
                        barcha foydalanuvchilarga ko'rinadi. O'quvchilar o'sha sahifadan to'g'ridan-to'g'ri kirishi mumkin.
                        <br /><br />
                        ⚠️ <strong>Eslatma:</strong> Ommaviy bo'lsa ham, test/kazus faqat ustoz <strong>START</strong> bergandan
                        keyin boshlanishi mumkin.
                      </p>
                    </div>
                  </div>

                  {/* Joriy holat */}
                  <div className={`rounded-2xl p-6 border-2 text-center ${
                    joriyOmmaviy
                      ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300'
                      : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200'
                  }`}>
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                      joriyOmmaviy ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-gray-200'
                    }`}>
                      <Globe className={`h-8 w-8 ${joriyOmmaviy ? 'text-white' : 'text-gray-400'}`} />
                    </div>
                    <h3 className={`text-lg font-black mb-1 ${joriyOmmaviy ? 'text-emerald-800' : 'text-gray-600'}`}>
                      {joriyOmmaviy ? '🌍 Ommaviy (ko\'rinmoqda)' : '🔒 Maxfiy (ko\'rinmaydi)'}
                    </h3>
                    <p className={`text-sm ${joriyOmmaviy ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {joriyOmmaviy
                        ? `Mavjud ${tur === 'test' ? 'testlar' : 'kazuslar'} sahifasida ko'rinmoqda`
                        : `Faqat siz ko'rasiz, ommada ko'rinmaydi`}
                    </p>

                    <Button
                      onClick={ommaviyniOzgartirish}
                      disabled={ommaviyYuklanyapti}
                      className={`mt-5 w-full h-12 font-black text-base ${
                        joriyOmmaviy
                          ? 'bg-gray-600 hover:bg-gray-700 text-white'
                          : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white'
                      }`}
                    >
                      {ommaviyYuklanyapti ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Saqlanmoqda...</>
                      ) : joriyOmmaviy ? (
                        <><X className="mr-2 h-5 w-5" />Ommaviydan olib tashlash</>
                      ) : (
                        <><Globe className="mr-2 h-5 w-5" />Ommaviy qilish</>
                      )}
                    </Button>
                  </div>

                  {joriyOmmaviy && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">
                        <strong>{nomi}</strong> hozir ommaviy sahifada ko'rinmoqda.
                        O'quvchilar uni topib, kod bilan kirishi mumkin.
                        Kirish uchun esa <strong>START bosilgan bo'lishi shart</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in { animation: scale-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
