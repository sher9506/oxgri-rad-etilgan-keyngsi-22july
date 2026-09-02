import { useState, useEffect } from 'react';
import { Shield, Search, Users, Clock, CheckCircle, XCircle, Loader2, Trash2, Plus, Lightbulb, Settings, AlertTriangle, BookOpen, ChevronRight, ArrowLeft, FileText, ChevronDown, X, Bell, Send, GraduationCap, ShieldAlert, AlertCircle, Play, Square, Edit, Library, Eye, EyeOff, Bot, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Toplam, Javob } from '@/types';
import { Ustoz, approveUstoz, deleteUstoz } from '@/lib/auth';
import { Textarea } from '@/components/ui/textarea';
import JavobTahlil from './JavobTahlil';
import ZahiraPanel from './ZahiraPanel';
import FaceIdPanel from './FaceIdPanel';
import AdminChatBoshqaruv from './AdminChatBoshqaruv';
import BotSozlamalari from './BotSozlamalari';
import UstozBotSozlamalari from './UstozBotSozlamalari';
import BotXabarnomasi from './BotXabarnomasi';
import OquvchilarRoyhat from './OquvchilarRoyhat';
import MentorAiSozlamalari from './MentorAiSozlamalari';
import TelegramLoginSozlamalari from './TelegramLoginSozlamalari';
import Analitika from './Analitika';
import AdminChunking from './AdminChunking';

const ADMIN_CODE = 'adminchit';

interface AdminPanelProps {
  adminView?: string;
  onAdminViewChange?: (view: string) => void;
  isAdminLoggedIn?: boolean;
  onAdminLogin?: () => void;
  onAdminLogout?: () => void;
}

interface Yangilik {
  id: string;
  sarlavha: string;
  matn: string;
  rasm_url: string | null;
  manba: string;
  created_at: string;
}

type AdminTalaba = {
  id?: string;
  ism: string;
  familiya: string;
  guruh: string;
  kurs: string;
  fraud_flag?: boolean;
  phone?: string;
  login_id?: string;
};

export default function AdminPanel({ adminView, onAdminViewChange, isAdminLoggedIn, onAdminLogin, onAdminLogout }: AdminPanelProps) {
  const [kirish, setKirish] = useState(isAdminLoggedIn || false);
  const [kod, setKod] = useState('');
  const [view, setView] = useState<string>(adminView || 'ustoz');
  const [maxfiyKod, setMaxfiyKod] = useState('');
  const [kodOchiq, setKodOchiq] = useState(false);
  const [toplamKod, setToplamKod] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [toplam, setToplam] = useState<Toplam | null>(null);
  const [javoblar, setJavoblar] = useState<Javob[]>([]);
  const [ustozlar, setUstozlar] = useState<Ustoz[]>([]);
  const [yangiliklar, setYangiliklar] = useState<Yangilik[]>([]);
  const [yangiSarlavha, setYangiSarlavha] = useState('');
  const [yangiMatn, setYangiMatn] = useState('');
  const [yangiRasm, setYangiRasm] = useState('');
  const [yangiManba, setYangiManba] = useState('Bosh Prokuratura');
  const [aflotunFaol, setAflotunFaol] = useState(true);
  const [copyProtectionFaol, setCopyProtectionFaol] = useState(false);
  const [screenshotProtectionFaol, setScreenshotProtectionFaol] = useState(false);
  const [sozlamaYuklanyapti, setSozlamaYuklanyapti] = useState(false);
  const [otmTestSana, setOtmTestSana] = useState('');
  const [otmSanaSaqlanyapti, setOtmSanaSaqlanyapti] = useState(false);

  // Talabalar ro'yhati
  const [talabalar, setTalabalar] = useState<AdminTalaba[]>([]);
  const [talabaTanlanganKurs, setTalabaTanlanganKurs] = useState('barchasi');
  const [talabaTanlanganGuruh, setTalabaTanlanganGuruh] = useState('barchasi');
  const [talabaQidiruv, setTalabaQidiruv] = useState('');
  const [tanlanganAdminTalaba, setTanlanganAdminTalaba] = useState<AdminTalaba | null>(null);
  const [talabaJavoblariAdmin, setTalabaJavoblariAdmin] = useState<any[]>([]);
  const [talabaYuklanyaptiAdmin, setTalabaYuklanyaptiAdmin] = useState(false);
  const [tanlanganAdminJavob, setTanlanganAdminJavob] = useState<any | null>(null);

  // Fraud
  const [fraudUrinishlar, setFraudUrinishlar] = useState<any[]>([]);
  const [fraudYuklanyapti, setFraudYuklanyapti] = useState(false);

  // Barcha testlar
  const [barchaTestlar, setBarchaTestlar] = useState<any[]>([]);
  const [barchaTestlarYuklanyapti, setBarchaTestlarYuklanyapti] = useState(false);
  const [testStartToggle, setTestStartToggle] = useState<string | null>(null);

  // Bildirishnoma
  const [bildirishnomaYuboruvchi, setBildirishnomaYuboruvchi] = useState<'ustoz' | 'oquvchi'>('oquvchi');
  const [bildOquvchiTuri, setBildOquvchiTuri] = useState<'barchasi' | 'kurs' | 'kurs_guruh' | 'talaba'>('barchasi');
  const [bildKurs, setBildKurs] = useState('');
  const [bildGuruh, setBildGuruh] = useState('');
  const [bildTalabaIsm, setBildTalabaIsm] = useState('');
  const [bildTalabalar, setBildTalabalar] = useState<{ism: string, familiya: string}[]>([]);
  const [bildTalabalarYuklanmoqda, setBildTalabalarYuklanmoqda] = useState(false);
  const [bildNomi, setBildNomi] = useState('');
  const [bildSarlavha, setBildSarlavha] = useState('');
  const [bildMatn, setBildMatn] = useState('');
  const [bildTur, setBildTur] = useState<'info' | 'ogohlantirish' | 'muhim'>('info');
  const [bildYuborYuklanyapti, setBildYuborYuklanyapti] = useState(false);
  const [bildirishnomalar, setBildirishnomalar] = useState<any[]>([]);
  const [ustoz_bot_ruxsat, setUstozBotRuxsat] = useState(false);
  const [ustoz_bot_yuklanyapti, setUstozBotYuklanyapti] = useState(false);
  const [adminToplamKazuslar, setAdminToplamKazuslar] = useState<any[]>([]);
  const [ochiqKazuslarAdmin, setOchiqKazuslarAdmin] = useState<Set<number>>(new Set());
  const KURSLAR_ADMIN = ['1-kurs', '2-kurs', '3-kurs', '4-kurs'];
  const GURUHLAR_ADMIN = ['a-1', 'a-2', 'a-3', 'b-1', 'b-2', 'b-3', 'p-1', 'p-2', 'p-rus', 'p-3'];

  const [tahlilModal, setTahlilModal] = useState<{
    kazus: string;
    togriJavob: string;
    oquvchiJavob: string;
  } | null>(null);
  const { toast } = useToast();

  const bildTalabalarniYuklash = async (kurs: string, guruh: string) => {
    if (!kurs || !guruh) { setBildTalabalar([]); return; }
    setBildTalabalarYuklanmoqda(true);
    try {
      const { data, error } = await supabase.from('talabalar').select('ism, familiya').eq('kurs', kurs).eq('guruh', guruh).order('familiya', { ascending: true });
      if (error) throw error;
      setBildTalabalar(data || []);
    } catch (e) {
      setBildTalabalar([]);
    } finally {
      setBildTalabalarYuklanmoqda(false);
    }
  };

  const bildirishnomalarniYuklash = async () => {
    try {
      const { data, error } = await supabase.from('bildirishnomalar').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      setBildirishnomalar(data || []);
    } catch (e) { console.error('Bildirishnomalarni yuklashda xato:', e); }
  };

  const bildirishnomaYuborish = async () => {
    if (!bildSarlavha.trim() || !bildMatn.trim()) {
      toast({ title: 'Xato', description: "Sarlavha va matn to'ldiring", variant: 'destructive' }); return;
    }
    setBildYuborYuklanyapti(true);
    try {
      let qabul_id: string | null = null;
      let filter_kurs: string | null = null;
      let filter_guruh: string | null = null;
      if (bildirishnomaYuboruvchi === 'ustoz') {
        qabul_id = bildNomi.trim() || null;
      } else {
        if (bildOquvchiTuri === 'talaba') {
          qabul_id = bildTalabaIsm.trim() || null;
        } else if (bildOquvchiTuri === 'kurs') {
          filter_kurs = bildKurs || null;
        } else if (bildOquvchiTuri === 'kurs_guruh') {
          filter_kurs = bildKurs || null;
          filter_guruh = bildGuruh || null;
        }
      }
      const { error } = await supabase.from('bildirishnomalar').insert({
        qabul_qiluvchi_tur: bildirishnomaYuboruvchi,
        qabul_qiluvchi_id: qabul_id,
        filter_kurs,
        filter_guruh,
        sarlavha: bildSarlavha.trim(),
        matn: bildMatn.trim(),
        tur: bildTur,
      });
      if (error) throw error;
      toast({ title: 'Yuborildi!', description: 'Bildirishnoma muvaffaqiyatli yuborildi' });
      setBildSarlavha(''); setBildMatn(''); setBildNomi(''); setBildTalabaIsm('');
      setBildKurs(''); setBildGuruh(''); setBildOquvchiTuri('barchasi'); setBildTalabalar([]);
      await bildirishnomalarniYuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setBildYuborYuklanyapti(false);
    }
  };

  useEffect(() => {
    if (adminView && adminView !== view) setView(adminView);
  }, [adminView]);

  useEffect(() => {
    if (isAdminLoggedIn !== undefined) setKirish(isAdminLoggedIn);
  }, [isAdminLoggedIn]);

  useEffect(() => {
    if (kirish) {
      if (view === 'royhat') talabalarniYuklashAdmin();
      else if (view === 'ustoz') ustozlarniYuklash();
      else if (view === 'sozlamalar') sozlamalarniYuklash();
      else if (view === 'asosiy_sozlamalar') asosiySOzlamalarniYuklash();
      else if (view === 'bildirishnoma') bildirishnomalarniYuklash();
      else if (view === 'bot_ustoz_ruxsat') ustozBotRuxsatniYuklash();
      else if (view === 'fraud') fraudlarniYuklash();
      else if (view === 'barcha_testlar') barchaTestlarniYuklash();
      else if (view === 'materiallar') {} // materiallar paneliga alohida yuklanadi
    }
  }, [kirish, view]);

  const barchaTestlarniYuklash = async () => {
    setBarchaTestlarYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('testlar')
        .select('*, ustoz:ustoz_id(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBarchaTestlar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Testlarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setBarchaTestlarYuklanyapti(false);
    }
  };

  const adminTestStartStop = async (test: any) => {
    setTestStartToggle(test.id);
    const yangiHolat = !test.is_active;
    try {
      const { error } = await supabase.from('testlar').update({ is_active: yangiHolat }).eq('id', test.id);
      if (error) throw error;
      setBarchaTestlar(prev => prev.map(t => t.id === test.id ? { ...t, is_active: yangiHolat } : t));
      toast({ title: yangiHolat ? '▶ Test boshlandi!' : '⏹ Test to\'xtatildi', description: `"${test.test_nomi}" testi ${yangiHolat ? 'faollashtirildi' : "to'xtatildi"}` });
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setTestStartToggle(null);
    }
  };

  const adminTestOchirish = async (testId: string) => {
    if (!confirm("Bu testni o'chirmoqchimisiz?")) return;
    try {
      const { error } = await supabase.from('testlar').delete().eq('id', testId);
      if (error) throw error;
      setBarchaTestlar(prev => prev.filter(t => t.id !== testId));
      toast({ title: "O'chirildi", description: "Test o'chirildi" });
    } catch (e: any) {
      toast({ title: 'Xato', description: "O'chirishda xatolik", variant: 'destructive' });
    }
  };

  const talabalarniYuklashAdmin = async () => {
    try {
      const { data, error } = await supabase.from('talabalar').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      const talabalarData = (data || []).map((t: any) => ({
        id: t.id,
        ism: t.ism,
        familiya: t.familiya,
        guruh: t.guruh,
        kurs: t.kurs,
        fraud_flag: t.fraud_flag || false,
        phone: t.phone || '',
        login_id: t.login_id || '',
      }));
      setTalabalar(talabalarData);
    } catch (error: any) {
      toast({ title: 'Xato', description: "Talabalar ro'yxatini yuklashda xatolik", variant: 'destructive' });
    }
  };

  // ── FRAUD FUNKSIYALARI ──
  const fraudlarniYuklash = async () => {
    setFraudYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('fraud_urinishlar')
        .select('*')
        .eq('admin_status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFraudUrinishlar(data || []);
    } catch (e) {
      console.error('Fraud yuklashda xato:', e);
    } finally {
      setFraudYuklanyapti(false);
    }
  };

  const fraudniTasdiqlash = async (fraud: any) => {
    try {
      if (fraud.new_talaba_id) {
        await supabase.from('talabalar').update({ fraud_flag: false }).eq('id', fraud.new_talaba_id);
      }
      await supabase.from('fraud_urinishlar').update({ admin_status: 'approved' }).eq('id', fraud.id);
      toast({ title: 'Tasdiqlandi', description: `${fraud.ism} ${fraud.familiya} profili tasdiqlandi. Undov belgisi olib tashlandi.` });
      await fraudlarniYuklash();
      await talabalarniYuklashAdmin();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const fraudniOchirish = async (fraud: any) => {
    if (!confirm(`${fraud.ism} ${fraud.familiya} profilini o'chirmoqchimisiz? Bu amaldan qaytib bo'lmaydi!`)) return;
    try {
      if (fraud.new_talaba_id) {
        await supabase.from('talabalar').delete().eq('id', fraud.new_talaba_id);
      } else {
        await supabase.from('fraud_urinishlar').update({ admin_status: 'deleted' }).eq('id', fraud.id);
      }
      toast({ title: "O'chirildi", description: `${fraud.ism} ${fraud.familiya} profili o'chirildi.` });
      await fraudlarniYuklash();
      await talabalarniYuklashAdmin();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  // Maxfiy kod uchun klaviatura listener
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (view !== 'sozlamalar') { setMaxfiyKod(''); setKodOchiq(false); return; }
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key >= '0' && e.key <= '9') {
        const yangiKod = maxfiyKod + e.key;
        setMaxfiyKod(yangiKod);
        if (yangiKod === '9506') { setKodOchiq(true); setMaxfiyKod(''); }
        if (yangiKod.length >= 4 && yangiKod !== '9506') setMaxfiyKod('');
      } else if (e.key === 'Escape') { setMaxfiyKod(''); setKodOchiq(false); }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [view, maxfiyKod]);

  // ── Admin ro'yhat funksiyalari ──
  const talabaJavoblariniYuklashAdmin = async (talaba: AdminTalaba) => {
    setTanlanganAdminTalaba(talaba);
    setTalabaYuklanyaptiAdmin(true);
    setTalabaJavoblariAdmin([]);
    setTanlanganAdminJavob(null);
    const fullName = `${talaba.ism} ${talaba.familiya}`;
    try {
      const { data: javoblarData, error } = await supabase.from('javoblar').select('*').eq('oquvchi_ismi', fullName).order('created_at', { ascending: false });
      if (error) throw error;
      if (!javoblarData || javoblarData.length === 0) { setTalabaJavoblariAdmin([]); setTalabaYuklanyaptiAdmin(false); return; }
      const kodlar = [...new Set(javoblarData.map((j: any) => j.toplam_kod))];
      const { data: toplamlar } = await supabase.from('toplamlar').select('kod, mavzu, kazuslar').in('kod', kodlar);
      const toplamMap: Record<string, any> = {};
      (toplamlar || []).forEach((t: any) => { toplamMap[t.kod] = { mavzu: t.mavzu || 'Mavzusiz', kazuslar: t.kazuslar || [] }; });
      setTalabaJavoblariAdmin(javoblarData.map((j: any) => ({ ...j, toplam_mavzu: toplamMap[j.toplam_kod]?.mavzu || 'Mavzusiz', _kazuslar: toplamMap[j.toplam_kod]?.kazuslar || [] })));
    } catch {
      toast({ title: 'Xato', description: 'Javoblarni yuklashda xatolik', variant: 'destructive' });
    } finally {
      setTalabaYuklanyaptiAdmin(false);
    }
  };

  const ortachaBallAdmin = (baho: any[]) => {
    if (!baho || !baho.length) return 0;
    return Math.round(baho.reduce((s: number, b: any) => s + b.ball, 0) / baho.length);
  };

  const talabaOchirish = async (talaba: AdminTalaba) => {
    const fullName = `${talaba.ism} ${talaba.familiya}`;
    if (!confirm(`${fullName} ni ro'yxatdan o'chirmoqchimisiz?\nBu amaldan qaytarib bo'lmaydi!`)) return;
    try {
      const { error } = await supabase.from('talabalar').delete().eq('ism', talaba.ism).eq('familiya', talaba.familiya).eq('guruh', talaba.guruh).eq('kurs', talaba.kurs);
      if (error) throw error;
      const yangilar = talabalar.filter(t => !(t.ism === talaba.ism && t.familiya === talaba.familiya && t.guruh === talaba.guruh && t.kurs === talaba.kurs));
      setTalabalar(yangilar);
      if (tanlanganAdminTalaba?.ism === talaba.ism && tanlanganAdminTalaba?.familiya === talaba.familiya) {
        setTanlanganAdminTalaba(null); setTalabaJavoblariAdmin([]);
      }
      toast({ title: "O'chirildi", description: `${fullName} ro'yxatdan o'chirildi` });
    } catch (error: any) {
      toast({ title: 'Xato', description: "Talabani o'chirishda xatolik", variant: 'destructive' });
    }
  };

  const adminKirish = () => {
    if (kod === ADMIN_CODE) {
      setKirish(true);
      onAdminLogin?.();
      toast({ title: 'Xush kelibsiz, Admin!', description: 'Admin paneliga kirildi' });
    } else {
      toast({ title: 'Xato', description: "Admin kodi noto'g'ri", variant: 'destructive' });
    }
  };

  const ustozlarniYuklash = async () => {
    try {
      const { data, error } = await supabase.from('ustoz').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUstozlar(data as Ustoz[] || []);
    } catch (error: any) {
      toast({ title: 'Xato', description: "Ustoz ro'yxatini yuklashda xatolik", variant: 'destructive' });
    }
  };

  const ustozniTasdiqlash = async (ustozId: string, status: 'approved' | 'rejected') => {
    setYuklanyapti(true);
    try {
      // Ustoz ma'lumotlarini olish (bot xabari uchun)
      const { data: ustozData } = await supabase
        .from('ustoz')
        .select('id, full_name, phone, telegram_chat_id')
        .eq('id', ustozId)
        .maybeSingle();

      await approveUstoz(ustozId, status);

      // Bot orqali ustoz ga xabar yuborish (avval ustoz bot, keyin oquvchi bot)
      if (ustozData?.telegram_chat_id) {
        try {
          // Ustoz bot token va oquvchi bot token ni bir vaqtda olish
          const { data: tokenSettings } = await supabase.from('settings').select('key, text_value').in('key', ['TELEGRAM_TOKEN', 'USTOZ_BOT_TOKEN', 'BOT_SITE_URL', 'BOT_SITE_BUTTON_TEXT']);
          const siteMap: Record<string, string> = {};
          (tokenSettings || []).forEach((s: any) => { siteMap[s.key] = s.text_value || ''; });

          const ustozBotToken = siteMap['USTOZ_BOT_TOKEN'] || '';
          const oquvchiBotToken = siteMap['TELEGRAM_TOKEN'] || '';
          // Ustoz boti token bo'lsa uni ishlatamiz, aks holda oquvchi botni
          const activeToken = ustozBotToken || oquvchiBotToken;
          const siteUrl = siteMap['BOT_SITE_URL'] || 'https://fanfaster.uz';
          const siteBtnText = siteMap['BOT_SITE_BUTTON_TEXT'] || '🌐 Saytga kirish';

          if (activeToken) {
            const xabar = status === 'approved'
              ? `🎉 <b>Tabriklaymiz! Hisobingiz tasdiqlandi!</b>\n\n` +
                `👤 F.I.O: <b>${ustozData.full_name}</b>\n\n` +
                `✅ Endi siz <b>ustoz</b> sifatida saytga kirishingiz mumkin.\n` +
                `📱 Login (telefon): <code>${ustozData.phone}</code>\n\n` +
                `Bilim ulashishdan charchamang! 📚`
              : `❌ <b>Arizangiz rad etildi.</b>\n\n` +
                `Qo'shimcha ma'lumot uchun admin bilan bog'laning.`;

            await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: ustozData.telegram_chat_id,
                text: xabar,
                parse_mode: 'HTML',
                ...(status === 'approved' ? {
                  reply_markup: { inline_keyboard: [[{ text: siteBtnText, url: siteUrl }]] }
                } : {}),
              }),
            });
          }
        } catch (botErr) {
          console.error('Bot xabar yuborishda xato:', botErr);
        }
      }

      await ustozlarniYuklash();
      toast({ title: 'Muvaffaqiyatli', description: status === 'approved' ? 'Ustoz tasdiqlandi va bot xabari yuborildi' : 'Ustoz rad etildi' });
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || "Ustoz holatini o'zgartirishda xatolik", variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const ustozniOchirish = async (ustozId: string, fullName: string) => {
    if (!confirm(`${fullName} ni o'chirmoqchimisiz? Bu amaldan qaytarib bo'lmaydi!`)) return;
    setYuklanyapti(true);
    try {
      await deleteUstoz(ustozId);
      await ustozlarniYuklash();
      toast({ title: "O'chirildi", description: "Ustoz muvaffaqiyatli o'chirildi" });
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || "Ustoz o'chirishda xatolik", variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const yangiliklarniYuklash = async () => {
    try {
      const { data, error } = await supabase.from('yangiliklar').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setYangiliklar(data as Yangilik[] || []);
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Yangiliklar yuklanmadi', variant: 'destructive' });
    }
  };

  const yangiliQoshish = async () => {
    if (!yangiSarlavha.trim() || !yangiMatn.trim()) {
      toast({ title: 'Xato', description: "Sarlavha va matn to'ldirilishi shart", variant: 'destructive' }); return;
    }
    setYuklanyapti(true);
    try {
      const { error } = await supabase.from('yangiliklar').insert({ sarlavha: yangiSarlavha.trim(), matn: yangiMatn.trim(), rasm_url: yangiRasm.trim() || null, manba: yangiManba.trim() });
      if (error) throw error;
      setYangiSarlavha(''); setYangiMatn(''); setYangiRasm(''); setYangiManba('Bosh Prokuratura');
      await yangiliklarniYuklash();
      toast({ title: 'Muvaffaqiyatli', description: "Yangilik qo'shildi" });
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || "Yangilik qo'shishda xatolik", variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const yangiliOchirish = async (id: string) => {
    if (!confirm("Bu yangilikni o'chirmoqchimisiz?")) return;
    setYuklanyapti(true);
    try {
      const { error } = await supabase.from('yangiliklar').delete().eq('id', id);
      if (error) throw error;
      await yangiliklarniYuklash();
      toast({ title: "O'chirildi", description: "Yangilik o'chirildi" });
    } catch (error: any) {
      toast({ title: 'Xato', description: error.message || "Yangilik o'chirishda xatolik", variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const sozlamalarniYuklash = async () => {
    setSozlamaYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('key', 'aflotun_funksiya_faol');
      if (error) { console.error('Sozlamalarni yuklash xatosi:', error); return; }
      (data || []).forEach((row: any) => {
        if (row.key === 'aflotun_funksiya_faol') setAflotunFaol(row.value ?? true);
      });
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Sozlamalarni yuklashda xatolik', variant: 'destructive' });
    } finally { setSozlamaYuklanyapti(false); }
  };

  const asosiySOzlamalarniYuklash = async () => {
    setSozlamaYuklanyapti(true);
    try {
      const { data, error } = await supabase.from('settings').select('*').in('key', ['copy_protection_faol', 'screenshot_protection_faol', 'OTM_TEST_SANA']);
      if (error) { console.error('Asosiy sozlamalarni yuklash xatosi:', error); return; }
      (data || []).forEach((row: any) => {
        if (row.key === 'copy_protection_faol') setCopyProtectionFaol(row.value ?? false);
        if (row.key === 'screenshot_protection_faol') setScreenshotProtectionFaol(row.value ?? false);
        if (row.key === 'OTM_TEST_SANA') setOtmTestSana(row.text_value || '');
      });
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Asosiy sozlamalarni yuklashda xatolik', variant: 'destructive' });
    } finally { setSozlamaYuklanyapti(false); }
  };

  const otmSanaSaqlash = async () => {
    setOtmSanaSaqlanyapti(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'OTM_TEST_SANA', text_value: otmTestSana.trim(), value: true, tavsif: 'OTM qabul test sinovi sanasi' }, { onConflict: 'key' });
      if (error) throw error;
      toast({ title: '✅ Sana saqlandi!', description: otmTestSana ? `OTM test sanasi: ${new Date(otmTestSana).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}` : 'Sana olib tashlandi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setOtmSanaSaqlanyapti(false);
    }
  };

  const aflotunToggle = async (yangiHolat: boolean) => {
    setSozlamaYuklanyapti(true);
    try {
      const { error } = await supabase.from('settings').update({ value: yangiHolat }).eq('key', 'aflotun_funksiya_faol');
      if (error) throw error;
      setAflotunFaol(yangiHolat);
      toast({ title: 'Muvaffaqiyatli', description: `Aflotun funksiyasi ${yangiHolat ? 'faollashtirildi' : "o'chirildi"}` });
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Sozlamani yangilashda xatolik', variant: 'destructive' });
      await asosiySOzlamalarniYuklash();
    } finally { setSozlamaYuklanyapti(false); }
  };

  const copyProtectionToggle = async (yangiHolat: boolean) => {
    setSozlamaYuklanyapti(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'copy_protection_faol', value: yangiHolat, tavsif: "Matnni belgilash va nusxa ko'chirish himoyasi" }, { onConflict: 'key' });
      if (error) throw error;
      setCopyProtectionFaol(yangiHolat);
      toast({ title: 'Muvaffaqiyatli', description: `Nusxa ko'chirish himoyasi ${yangiHolat ? 'yoqildi' : "o'chirildi"}` });
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Sozlamani yangilashda xatolik', variant: 'destructive' });
      await asosiySOzlamalarniYuklash();
    } finally { setSozlamaYuklanyapti(false); }
  };

  const screenshotProtectionToggle = async (yangiHolat: boolean) => {
    setSozlamaYuklanyapti(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'screenshot_protection_faol', value: yangiHolat, tavsif: 'Ekrani tasvirga olish (screenshot) taqiqlash himoyasi' }, { onConflict: 'key' });
      if (error) throw error;
      setScreenshotProtectionFaol(yangiHolat);
      toast({ title: 'Muvaffaqiyatli', description: `Ekrani tasvirga olish himoyasi ${yangiHolat ? 'yoqildi' : "o'chirildi"}` });
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Sozlamani yangilashda xatolik', variant: 'destructive' });
      await asosiySOzlamalarniYuklash();
    } finally { setSozlamaYuklanyapti(false); }
  };

  const ustozBotRuxsatniYuklash = async () => {
    setUstozBotYuklanyapti(true);
    const { data } = await supabase.from('settings').select('value').eq('key', 'USTOZ_BOT_YANGILIK_RUXSAT').maybeSingle();
    setUstozBotRuxsat(data?.value ?? false);
    setUstozBotYuklanyapti(false);
  };

  const ustozBotRuxsatToggle = async (yangi: boolean) => {
    setUstozBotYuklanyapti(true);
    await supabase.from('settings').upsert({ key: 'USTOZ_BOT_YANGILIK_RUXSAT', value: yangi, tavsif: 'Ustozlarga botga yangilik yuborish ruxsati' }, { onConflict: 'key' });
    setUstozBotRuxsat(yangi);
    setUstozBotYuklanyapti(false);
    toast({ title: yangi ? '✅ Ruxsat berildi' : "❌ Ruxsat olib tashlandi", description: `Ustozlar bot yangiligi ${yangi ? 'yoqildi' : "o'chirildi"}` });
  };

  const natijalarniKorish = async () => {
    if (!toplamKod.trim() || toplamKod.trim().length !== 5) {
      toast({ title: 'Xato', description: "Toplam kodi 5 raqamdan iborat bo'lishi kerak", variant: 'destructive' }); return;
    }
    setYuklanyapti(true);
    try {
      const { data: toplamData, error: toplamError } = await supabase.from('toplamlar').select('*').eq('kod', toplamKod.trim()).single();
      if (toplamError || !toplamData) {
        toast({ title: 'Toplam topilmadi', description: 'Kodni tekshirib qaytadan kiriting', variant: 'destructive' }); return;
      }
      const { data: javoblarData, error: javoblarError } = await supabase.from('javoblar').select('*').eq('toplam_kod', toplamKod.trim()).order('created_at', { ascending: false });
      if (javoblarError) throw javoblarError;
      setToplam(toplamData as Toplam);
      setJavoblar(javoblarData as Javob[] || []);
      if (!javoblarData || javoblarData.length === 0) {
        toast({ title: "Javoblar yo'q", description: "Bu toplam uchun hali o'quvchilar javob yuborishgan" });
      }
    } catch (error: any) {
      toast({ title: 'Xato', description: 'Natijalarni yuklashda xatolik', variant: 'destructive' });
    } finally { setYuklanyapti(false); }
  };

  const ortachaHisoblash = (baho: any[]) => {
    if (!baho || baho.length === 0) return 0;
    return Math.round(baho.reduce((sum: number, b: any) => sum + b.foiz, 0) / baho.length);
  };

  if (!kirish) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card className="w-full max-w-md shadow-xl border-2 border-red-500">
          <CardHeader className="bg-gradient-to-r from-red-600 to-red-500 text-white">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8" />
              <CardTitle className="text-2xl">Admin Panel</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Admin kodi:</label>
              <Input type="password" placeholder="Admin kodi" value={kod} onChange={(e) => setKod(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && adminKirish()} />
            </div>
            <Button onClick={adminKirish} className="w-full" size="lg">
              <Shield className="mr-2 h-5 w-5" /> Kirish
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ─────────── O'QUVCHILAR (ADMIN) ─────────── */}
      {view === 'analitika' && <Analitika />}

      {view === 'oquvchilar' && <OquvchilarRoyhat mode="admin" />}

      {/* ─────────── O'QUV MATERIALLAR (ADMIN) ─────────── */}
      {view === 'materiallar' && (
        <AdminMateriallarPanel />
      )}

      {/* ─────────── BARCHA TESTLAR ─────────── */}
      {view === 'barcha_testlar' && (
        <div className="space-y-6">
          <Card className="border-2 border-indigo-500 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-3 rounded-2xl"><BookOpen className="h-8 w-8" /></div>
                  <div>
                    <h1 className="text-2xl font-bold">Barcha Testlar</h1>
                    <p className="text-indigo-100 text-sm mt-1">{barchaTestlar.length} ta test mavjud • START/STOP boshqaruvi</p>
                  </div>
                </div>
                <button onClick={barchaTestlarniYuklash} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all">Yangilash</button>
              </div>
            </div>
          </Card>

          {barchaTestlarYuklanyapti ? (
            <Card><CardContent className="py-16 text-center"><Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto mb-4" /><p className="text-gray-500">Yuklanmoqda...</p></CardContent></Card>
          ) : barchaTestlar.length === 0 ? (
            <Card><CardContent className="py-16 text-center"><BookOpen className="h-20 w-20 text-gray-300 mx-auto mb-4" /><p className="text-xl font-medium text-gray-500">Hali testlar yaratilmagan</p></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {barchaTestlar.map((test) => (
                <Card key={test.id} className={`border-2 transition-all ${test.is_active ? 'border-green-400 bg-green-50/30' : 'border-gray-200 hover:border-indigo-300'}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-lg font-bold text-gray-900">{test.test_nomi}</h3>
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${
                            test.is_active
                              ? 'bg-green-100 border-green-400 text-green-700'
                              : 'bg-gray-100 border-gray-300 text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${test.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            {test.is_active ? 'FAOL' : "TO'XTATILGAN"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-semibold">Kod: {test.kod}</span>
                          <span>{test.savollar?.length || 0} ta savol</span>
                          <span>{test.vaqt_daqiqa} daqiqa</span>
                          <span className="text-gray-500">Ustoz: {test.ustoz?.full_name || test.ustoz_ismi}</span>
                          <span className="text-gray-400">{new Date(test.created_at).toLocaleDateString('uz-UZ')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* START/STOP */}
                        <button
                          onClick={() => adminTestStartStop(test)}
                          disabled={testStartToggle === test.id}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                            test.is_active
                              ? 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                              : 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {testStartToggle === test.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                          ) : test.is_active ? (
                            <><Square className="h-4 w-4" />STOP</>
                          ) : (
                            <><Play className="h-4 w-4" />START</>
                          )}
                        </button>
                        <button onClick={() => adminTestOchirish(test.id)} className="p-2 rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 transition-all">
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

      {/* ─────────── USTOZLAR ─────────── */}
      {view === 'ustoz' && (
        <div className="space-y-4">
          {ustozlar.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">Hali ustozlar yo'q</CardContent></Card>
          ) : (
            ustozlar.map((ustoz: any) => (
              <Card key={ustoz.id} className={`hover:shadow-lg transition-shadow border-2 ${
                ustoz.status === 'pending' ? 'border-yellow-300' : ustoz.status === 'approved' ? 'border-green-200' : 'border-red-200'
              }`}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-4">
                    {ustoz.face_image ? (
                      <div className="flex-shrink-0">
                        <img src={ustoz.face_image} alt={ustoz.full_name} className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200 shadow-md" />
                        <p className="text-[10px] text-center text-gray-400 mt-1">Yuz rasmi</p>
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-20 h-20 rounded-xl bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                        <Users className="h-8 w-8 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-lg">{ustoz.full_name}</h3>
                          <p className="text-sm text-gray-600">📱 {ustoz.phone || ustoz.username}</p>
                          {ustoz.telegram_username && (
                            <p className="text-sm text-blue-600 font-medium">✈️ {ustoz.telegram_username}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">Ro'yxatdan o'tgan: {new Date(ustoz.created_at).toLocaleDateString('uz-UZ')}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {ustoz.face_descriptor && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Face ID</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {ustoz.status === 'pending' && <div className="flex items-center gap-1 text-yellow-600 bg-yellow-50 border border-yellow-200 px-3 py-1 rounded-full text-sm font-medium"><Clock className="h-3.5 w-3.5" />Kutilmoqda</div>}
                          {ustoz.status === 'approved' && <div className="flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full text-sm font-medium"><CheckCircle className="h-3.5 w-3.5" />Tasdiqlangan</div>}
                          {ustoz.status === 'rejected' && <div className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full text-sm font-medium"><XCircle className="h-3.5 w-3.5" />Rad etilgan</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {ustoz.status === 'pending' && (
                          <>
                            <Button onClick={() => ustozniTasdiqlash(ustoz.id, 'approved')} disabled={yuklanyapti} size="sm" className="bg-green-600 hover:bg-green-700 h-8">
                              {yuklanyapti ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle className="h-3.5 w-3.5 mr-1" />Tasdiqlash</>}
                            </Button>
                            <Button onClick={() => ustozniTasdiqlash(ustoz.id, 'rejected')} disabled={yuklanyapti} variant="destructive" size="sm" className="h-8">
                              {yuklanyapti ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" />Rad etish</>}
                            </Button>
                          </>
                        )}
                        {ustoz.status === 'approved' && ustoz.face_image && (
                          <Button onClick={async () => {
                            if (!confirm("Yuz rasmini o'chirib tashlamoqchimisiz?")) return;
                            try { await supabase.from('ustoz').update({ face_image: null }).eq('id', ustoz.id); await ustozlarniYuklash(); toast({ title: "O'chirildi", description: 'Yuz rasmi o\'chirildi.' }); } catch (e: any) { toast({ title: 'Xato', description: e.message, variant: 'destructive' }); }
                          }} variant="outline" size="sm" className="h-8 border-orange-300 text-orange-700 hover:bg-orange-50">
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Rasmni o'chirish
                          </Button>
                        )}
                        <Button onClick={() => ustozniOchirish(ustoz.id, ustoz.full_name)} disabled={yuklanyapti} variant="ghost" size="sm" className="h-8 text-red-600 hover:bg-red-50 ml-auto">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ─────────── ASOSIY SOZLAMALAR ─────────── */}
      {view === 'asosiy_sozlamalar' && (
        <div className="space-y-6">
          <Card className="border-2 border-emerald-500">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-6 w-6" />Asosiy sozlamalar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Nusxa ko'chirish himoyasi */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-red-500 p-2 rounded-lg">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Nusxa ko'chirish himoyasi</h3>
                  </div>
                  <p className="text-sm text-gray-600 ml-14">
                    O'quvchilar saytdagi matnlarni belgilay va nusxa ko'chira olmaydi.
                    O'ng tugma (kontekst menyu) va Ctrl+C, Ctrl+A ham bloklangan.
                  </p>
                  <div className="mt-3 ml-14 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2 ${
                      copyProtectionFaol
                        ? 'bg-green-100 border-green-400 text-green-700'
                        : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${copyProtectionFaol ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {copyProtectionFaol ? 'Faol' : "O'chirilgan"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  {sozlamaYuklanyapti ? (
                    <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
                  ) : (
                    <Switch
                      checked={copyProtectionFaol}
                      onCheckedChange={copyProtectionToggle}
                      className="data-[state=checked]:bg-red-600"
                    />
                  )}
                </div>
              </div>

              {/* Ekrani tasvirga olish himoyasi */}
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-violet-50 border-2 border-purple-200 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-purple-600 p-2 rounded-lg">
                      <span className="text-white text-xl">📵</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Ekrani tasvirga olish</h3>
                  </div>
                  <p className="text-sm text-gray-600 ml-14">
                    O'quvchilar sayt ekranini tasvirga ola olmaydi.
                    Screenshot tugmasi bosilganda ekran qorayib, ogohlantirish xabari chiqadi.
                  </p>
                  <div className="mt-3 ml-14 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2 ${
                      screenshotProtectionFaol
                        ? 'bg-green-100 border-green-400 text-green-700'
                        : 'bg-gray-100 border-gray-300 text-gray-500'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${screenshotProtectionFaol ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {screenshotProtectionFaol ? 'Faol' : "O'chirilgan"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  {sozlamaYuklanyapti ? (
                    <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                  ) : (
                    <Switch
                      checked={screenshotProtectionFaol}
                      onCheckedChange={screenshotProtectionToggle}
                      className="data-[state=checked]:bg-purple-600"
                    />
                  )}
                </div>
              </div>

              {/* OTM Test Sanasi */}
              <div className="flex items-start justify-between p-6 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-amber-500 p-2 rounded-lg">
                      <span className="text-white text-xl">🎓</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">OTM Sinov Test Sanasi</h3>
                  </div>
                  <p className="text-sm text-gray-600 ml-14">
                    Bosh sahifada OTM sinov testgacha qolgan kunlar hisoblagichi ko'rinadi.
                    Sana o'tgach hisoblagich avtomatik yashirinadi.
                  </p>
                  <div className="mt-4 ml-14 flex items-center gap-3 flex-wrap">
                    <input
                      type="date"
                      value={otmTestSana}
                      onChange={e => setOtmTestSana(e.target.value)}
                      className="px-4 py-2 border-2 border-amber-300 rounded-xl focus:outline-none focus:border-amber-500 bg-white text-sm font-semibold"
                    />
                    {otmTestSana && (
                      <span className="text-sm font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
                        📅 {new Date(otmTestSana + 'T00:00:00').toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    )}
                    {otmTestSana && (() => {
                      const kunlar = Math.ceil((new Date(otmTestSana + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return kunlar > 0 ? (
                        <span className="text-sm font-black text-green-700 bg-green-100 border border-green-300 px-3 py-1 rounded-full">
                          ⏳ {kunlar} kun qoldi
                        </span>
                      ) : (
                        <span className="text-sm font-black text-red-700 bg-red-100 border border-red-300 px-3 py-1 rounded-full">
                          ✅ Sana o'tgan
                        </span>
                      );
                    })()}
                  </div>
                  <div className="mt-3 ml-14 flex gap-2">
                    <button
                      onClick={otmSanaSaqlash}
                      disabled={otmSanaSaqlanyapti}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all"
                    >
                      {otmSanaSaqlanyapti ? <><Loader2 className="h-4 w-4 animate-spin" />Saqlanmoqda...</> : <>💾 Saqlash</>}
                    </button>
                    {otmTestSana && (
                      <button
                        onClick={() => { setOtmTestSana(''); }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-xl transition-all"
                      >
                        ✕ Tozalash
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Izoh */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Sozlamalar ta'sir qiladigan amallar:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-blue-700 mt-1">
                    <div>
                      <p className="font-bold text-xs uppercase text-blue-600 mb-1">Nusxa ko'chirish himoyasi:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>Matnni sichqoncha bilan belgilash</li>
                        <li>O'ng tugma (kontekst menyu)</li>
                        <li>Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+S</li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-bold text-xs uppercase text-purple-600 mb-1">Ekran tasviri himoyasi:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        <li>PrtScn (Print Screen) tugmasi</li>
                        <li>Cmd+Shift+3/4/5 (Mac screenshot)</li>
                        <li>Win+Shift+S (Windows Snipping)</li>
                      </ul>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-blue-600 font-medium">⚡ O'zgartirish 30 soniyada kuchga kiradi</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────── SOZLAMALAR (maxfiy - faqat Aflotun) ─────────── */}
      {view === 'sozlamalar' && (
        kodOchiq ? (
          <div className="space-y-6">
            <Card className="border-2 border-[hsl(221,83%,53%)]">
              <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Settings className="h-6 w-6" />Qo'shimcha sozlamalar</CardTitle>
                  <button onClick={() => setKodOchiq(false)} className="text-xs text-blue-100 hover:text-white px-3 py-1 bg-white/10 rounded hover:bg-white/20">Yopish (ESC)</button>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-purple-500 p-2 rounded-lg"><Lightbulb className="h-6 w-6 text-white" /></div>
                      <h3 className="text-xl font-bold text-gray-900">Aflotun kodi funksiyasi</h3>
                    </div>
                    <p className="text-sm text-gray-600 ml-14">O'quvchilar test yechishda maxsus "AFLOTUN GURUHI" belgisini qo'shishlari mumkin.</p>
                    <div className="mt-3 ml-14"><p className="text-xs text-gray-500">Holat: <span className={`font-bold ${aflotunFaol ? 'text-green-600' : 'text-red-600'}`}>{aflotunFaol ? 'Faol ✓' : "O'chirilgan ✗"}</span></p></div>
                  </div>
                  <div className="flex items-center gap-4">
                    {sozlamaYuklanyapti ? <Loader2 className="h-8 w-8 text-purple-500 animate-spin" /> : <Switch checked={aflotunFaol} onCheckedChange={aflotunToggle} className="data-[state=checked]:bg-purple-600" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto py-20 text-center">
            <Card className="border-2 border-red-500 shadow-xl">
              <CardContent className="py-16">
                <AlertTriangle className="h-24 w-24 text-red-500 mx-auto mb-6 animate-pulse" />
                <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Sahifa topilmadi</h2>
                <p className="text-gray-600 mb-2">Kechirasiz, siz qidirayotgan sahifa mavjud emas yoki o'chirilgan.</p>
                <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 inline-block">
                  <p className="text-xs text-gray-500">Error Code: ADMIN_SETTINGS_404</p>
                  <p className="text-xs text-gray-400 mt-1">Timestamp: {new Date().toISOString()}</p>
                </div>
                <div className="mt-12 text-[10px] text-gray-300 opacity-5 hover:opacity-30 transition-opacity duration-1000 select-none">🔐 Secret: 9-5-0-6</div>
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* ─────────── YANGILIK ─────────── */}
      {view === 'yangilik' && (
        <div className="space-y-6">
          <Card className="border-2 border-[hsl(221,83%,53%)]">
            <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
              <CardTitle className="flex items-center gap-2"><Plus className="h-6 w-6" />Yangilik qo'shish</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Sarlavha:</label><Input placeholder="Yangilik sarlavhasi" value={yangiSarlavha} onChange={(e) => setYangiSarlavha(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Matn:</label><Textarea placeholder="Yangilik matni" value={yangiMatn} onChange={(e) => setYangiMatn(e.target.value)} rows={5} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Rasm URL (ixtiyoriy):</label><Input placeholder="https://example.com/image.jpg" value={yangiRasm} onChange={(e) => setYangiRasm(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Manba:</label><Input placeholder="Bosh Prokuratura" value={yangiManba} onChange={(e) => setYangiManba(e.target.value)} /></div>
              <Button onClick={yangiliQoshish} disabled={yuklanyapti} className="w-full" size="lg">
                <Plus className="h-5 w-5 mr-2" />{yuklanyapti ? "Qo'shilmoqda..." : "Yangilik qo'shish"}
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Mavjud yangiliklar ({yangiliklar.length})</h3>
            {yangiliklar.length === 0 ? <Card><CardContent className="py-12 text-center text-gray-500">Hozircha yangiliklar yo'q</CardContent></Card> : (
              yangiliklar.map((yangilik) => (
                <Card key={yangilik.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg mb-2">{yangilik.sarlavha}</h4>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{yangilik.matn}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">{yangilik.manba}</span>
                          <span>{new Date(yangilik.created_at).toLocaleDateString('uz-UZ')}</span>
                        </div>
                      </div>
                      <Button onClick={() => yangiliOchirish(yangilik.id)} disabled={yuklanyapti} variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 ml-4">
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─────────── NATIJA ─────────── */}
      {view === 'natija' && !toplam && (
        <Card>
          <CardHeader><CardTitle>Toplam natijalarini ko'rish</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Toplam kodini kiriting:</label>
              <Input placeholder="12345" value={toplamKod} onChange={(e) => setToplamKod(e.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} className="text-2xl font-bold text-center tracking-widest" /></div>
            <Button onClick={natijalarniKorish} disabled={yuklanyapti || toplamKod.length !== 5} className="w-full" size="lg">
              <Search className="mr-2 h-5 w-5" />{yuklanyapti ? 'Yuklanmoqda...' : "Natijalarni ko'rish"}
            </Button>
          </CardContent>
        </Card>
      )}

      {view === 'natija' && toplam && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">{toplam.mavzu || 'Toplam natijalar'}</CardTitle>
                  <div className="flex items-center gap-6 text-sm text-blue-100">
                    <span>Kod: {toplam.kod}</span><span>Ustoz: {toplam.ustoz_ismi}</span>
                    <span className="flex items-center gap-1"><Users className="h-4 w-4" />{javoblar.length} o'quvchi</span>
                  </div>
                </div>
                <Button onClick={() => { setToplam(null); setJavoblar([]); setToplamKod(''); }} variant="secondary">Orqaga</Button>
              </div>
            </CardHeader>
          </Card>
          {javoblar.map((javob) => {
            const ortacha = ortachaHisoblash(javob.baho);
            return (
              <Card key={javob.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{javob.oquvchi_ismi}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><Clock className="h-4 w-4" />{new Date(javob.created_at).toLocaleString('uz-UZ')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">O'rtacha ball</p>
                      <p className={`text-4xl font-bold ${ortacha >= 70 ? 'text-green-600' : ortacha >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{ortacha}%</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-4">
                    {javob.baho.map((baho: any, idx: number) => {
                      const kazus = toplam.kazuslar[baho.kazus_index];
                      const oquvchiJavob = javob.javoblar.find((j: any) => j.kazus_index === baho.kazus_index);
                      return (
                        <div key={idx} className="border rounded-lg p-4 space-y-2 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-[hsl(221,83%,53%)]">Kazus {baho.kazus_index + 1}</span>
                            <span className={`text-2xl font-bold ${baho.foiz >= 70 ? 'text-green-600' : baho.foiz >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{baho.foiz}%</span>
                          </div>
                          <div className="text-sm space-y-2">
                            <div><p className="font-medium text-gray-500 mb-1">Kazus:</p><p className="text-gray-700 bg-gray-50 p-2 rounded">{kazus.kazus}</p></div>
                            <div><p className="font-medium text-gray-500 mb-1">O'quvchi javobi:</p><p className="text-gray-700 bg-blue-50 p-2 rounded">{oquvchiJavob?.javob || 'Javob berilmagan'}</p></div>
                            <div><p className="font-medium text-gray-500 mb-1">AI izohi:</p><p className="text-gray-800 bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">{baho.izoh}</p></div>
                            <div className="pt-2">
                              <Button onClick={() => setTahlilModal({ kazus: kazus.kazus, togriJavob: kazus.javob, oquvchiJavob: oquvchiJavob?.javob || '' })} variant="outline" size="sm" className="w-full border-2 border-purple-300 hover:bg-purple-50 hover:border-purple-500 text-purple-700">
                                <Lightbulb className="h-4 w-4 mr-2" />Batafsil tahlil (AI)
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {tahlilModal && <JavobTahlil kazusMatni={tahlilModal.kazus} togriJavob={tahlilModal.togriJavob} oquvchiJavobi={tahlilModal.oquvchiJavob} onClose={() => setTahlilModal(null)} />}
        </div>
      )}

      {/* ─────────── BILDIRISHNOMA ─────────── */}
      {view === 'bildirishnoma' && (
        <div className="space-y-6">
          <Card className="border-2 border-[hsl(221,83%,53%)]">
            <CardHeader className="bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(221,83%,43%)] text-white">
              <CardTitle className="flex items-center gap-2"><Send className="h-6 w-6" />Bildirishnoma yuborish</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 block">Kimga yuborilsin?</label>
                <div className="flex gap-3">
                  <button onClick={() => setBildirishnomaYuboruvchi('oquvchi')} className={`flex-1 py-3 px-4 rounded-xl font-semibold border-2 flex items-center justify-center gap-2 transition-all ${bildirishnomaYuboruvchi === 'oquvchi' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200 hover:border-green-500'}`}>
                    <GraduationCap className="h-5 w-5" /> O'quvchilar
                  </button>
                  <button onClick={() => setBildirishnomaYuboruvchi('ustoz')} className={`flex-1 py-3 px-4 rounded-xl font-semibold border-2 flex items-center justify-center gap-2 transition-all ${bildirishnomaYuboruvchi === 'ustoz' ? 'bg-[hsl(221,83%,53%)] text-white border-[hsl(221,83%,53%)]' : 'bg-white text-gray-700 border-gray-200 hover:border-[hsl(221,83%,53%)]'}`}>
                    <Users className="h-5 w-5" /> Ustozlar
                  </button>
                </div>
              </div>
              {bildirishnomaYuboruvchi === 'oquvchi' && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700 block">Qaysi o'quvchilarga?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ key: 'barchasi', label: '🌍 Barcha talabalar' }, { key: 'kurs', label: "📚 Kurs bo'yicha" }, { key: 'kurs_guruh', label: '👥 Kurs + Guruh' }, { key: 'talaba', label: '👤 Muayyan talaba' }].map((t) => (
                      <button key={t.key} onClick={() => setBildOquvchiTuri(t.key as any)} className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${bildOquvchiTuri === t.key ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>{t.label}</button>
                    ))}
                  </div>
                  {(bildOquvchiTuri === 'kurs' || bildOquvchiTuri === 'kurs_guruh') && (
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Kurs</label>
                      <div className="grid grid-cols-4 gap-2">{KURSLAR_ADMIN.map(k => (<button key={k} onClick={() => setBildKurs(k)} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${bildKurs === k ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>{k}</button>))}</div>
                    </div>
                  )}
                  {bildOquvchiTuri === 'kurs_guruh' && bildKurs && (
                    <div><label className="text-sm font-medium text-gray-700 mb-1 block">Guruh</label>
                      <div className="flex flex-wrap gap-2">{GURUHLAR_ADMIN.map(g => (<button key={g} onClick={() => setBildGuruh(g)} className={`py-1.5 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${bildGuruh === g ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>{g.toUpperCase()}</button>))}</div>
                    </div>
                  )}
                  {bildOquvchiTuri === 'talaba' && (
                    <div className="space-y-3">
                      <div><label className="text-sm font-medium text-gray-700 mb-1 block">Avval kurs tanlang</label>
                        <div className="grid grid-cols-4 gap-2">{KURSLAR_ADMIN.map(k => (<button key={k} onClick={() => { setBildKurs(k); setBildGuruh(''); setBildTalabaIsm(''); setBildTalabalar([]); }} className={`py-2 rounded-lg text-sm font-semibold border-2 transition-all ${bildKurs === k ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400'}`}>{k}</button>))}</div>
                      </div>
                      {bildKurs && (<div><label className="text-sm font-medium text-gray-700 mb-1 block">Guruhni tanlang</label>
                        <div className="flex flex-wrap gap-2">{GURUHLAR_ADMIN.map(g => (<button key={g} onClick={() => { setBildGuruh(g); setBildTalabaIsm(''); bildTalabalarniYuklash(bildKurs, g); }} className={`py-1.5 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${bildGuruh === g ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400'}`}>{g.toUpperCase()}</button>))}</div>
                      </div>)}
                      {bildKurs && bildGuruh && (
                        <div><label className="text-sm font-medium text-gray-700 mb-1 block">Talabani tanlang</label>
                          {bildTalabalarYuklanmoqda ? (
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border-2 border-gray-200"><div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full" /><span className="text-sm text-gray-500">Yuklanmoqda...</span></div>
                          ) : bildTalabalar.length === 0 ? (
                            <div className="p-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-sm text-yellow-800 text-center">Bu guruhda talabalar topilmadi</div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl divide-y divide-gray-100">
                              {bildTalabalar.map((t, i) => {
                                const key = `${t.ism}|${t.familiya}`;
                                const tanlangan = bildTalabaIsm === key;
                                return (
                                  <button key={i} onClick={() => setBildTalabaIsm(tanlangan ? '' : key)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${tanlangan ? 'bg-orange-50 text-orange-800' : 'hover:bg-gray-50 text-gray-800'}`}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${tanlangan ? 'bg-orange-500 border-orange-500' : 'border-gray-300'}`}>{tanlangan && <div className="w-2 h-2 bg-white rounded-full" />}</div>
                                    <span className="font-medium">{t.familiya} {t.ism}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`p-3 rounded-xl border-2 text-sm font-medium ${bildOquvchiTuri === 'barchasi' ? 'bg-green-50 border-green-200 text-green-800' : bildOquvchiTuri === 'kurs' && bildKurs ? 'bg-blue-50 border-blue-200 text-blue-800' : bildOquvchiTuri === 'kurs_guruh' && bildKurs && bildGuruh ? 'bg-purple-50 border-purple-200 text-purple-800' : bildOquvchiTuri === 'talaba' && bildTalabaIsm ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                    📬 Yuboriladi:
                    {bildOquvchiTuri === 'barchasi' && ' Barcha talabalar'}
                    {bildOquvchiTuri === 'kurs' && bildKurs && ` ${bildKurs} barcha talabalari`}
                    {bildOquvchiTuri === 'kurs' && !bildKurs && ' (kurs tanlanmagan)'}
                    {bildOquvchiTuri === 'kurs_guruh' && bildKurs && bildGuruh && ` ${bildKurs} / ${bildGuruh.toUpperCase()} guruhi`}
                    {bildOquvchiTuri === 'kurs_guruh' && (!bildKurs || !bildGuruh) && ' (kurs yoki guruh tanlanmagan)'}
                    {bildOquvchiTuri === 'talaba' && bildTalabaIsm && ` ${bildTalabaIsm}`}
                    {bildOquvchiTuri === 'talaba' && !bildTalabaIsm && ' (talaba kiritilmagan)'}
                  </div>
                </div>
              )}
              {bildirishnomaYuboruvchi === 'ustoz' && (
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Ustoz ID (bo'sh = barcha ustozlar)</label>
                  <Input placeholder="uuid... yoki bo'sh qoldiring" value={bildNomi} onChange={(e) => setBildNomi(e.target.value)} />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Bildirishnoma turi</label>
                <div className="flex gap-2">
                  {(['info', 'ogohlantirish', 'muhim'] as const).map((t) => (
                    <button key={t} onClick={() => setBildTur(t)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${bildTur === t ? t === 'info' ? 'bg-blue-500 text-white border-blue-500' : t === 'ogohlantirish' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                      {t === 'info' ? "ℹ️ Ma'lumot" : t === 'ogohlantirish' ? '⚠️ Ogohlantirish' : '🔴 Muhim'}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Sarlavha</label><Input placeholder="Bildirishnoma sarlavhasi" value={bildSarlavha} onChange={(e) => setBildSarlavha(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Matn</label><Textarea placeholder="Bildirishnoma matni..." value={bildMatn} onChange={(e) => setBildMatn(e.target.value)} rows={4} /></div>
              <Button onClick={bildirishnomaYuborish} disabled={bildYuborYuklanyapti} className="w-full" size="lg">
                {bildYuborYuklanyapti ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Yuborilmoqda...</> : <><Send className="mr-2 h-5 w-5" />Bildirishnoma yuborish</>}
              </Button>
            </CardContent>
          </Card>
          <Card className="border border-gray-200">
            <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5" />Yuborilgan bildirishnomalar ({bildirishnomalar.length})</CardTitle></CardHeader>
            <CardContent>
              {bildirishnomalar.length === 0 ? (
                <div className="py-10 text-center text-gray-400"><Bell className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Hali bildirishnomalar yuborilmagan</p></div>
              ) : (
                <div className="space-y-3">
                  {bildirishnomalar.map((b) => (
                    <div key={b.id} className={`p-4 rounded-xl border-2 ${b.tur === 'muhim' ? 'border-red-200 bg-red-50' : b.tur === 'ogohlantirish' ? 'border-yellow-200 bg-yellow-50' : 'border-blue-200 bg-blue-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-gray-900">{b.sarlavha}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${b.qabul_qiluvchi_tur === 'ustoz' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                              {b.qabul_qiluvchi_tur === 'ustoz' ? '👨‍🏫 Ustozlar' : "👨‍🎓 O'quvchilar"}
                            </span>
                            {b.filter_kurs && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{b.filter_kurs}{b.filter_guruh ? ` / ${b.filter_guruh.toUpperCase()}` : ''}</span>}
                          </div>
                          <p className="text-sm text-gray-600">{b.matn}</p>
                          <p className="text-xs text-gray-400 mt-2">{new Date(b.created_at).toLocaleString('uz-UZ')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────── TAHRIRLASHLAR ─────────── */}
      {view === 'tahrirlashlar' && (
        <TahrirlashlarPanel />
      )}

      {/* ─────────── FRAUD KO'RIB CHIQISH ─────────── */}
      {view === 'fraud' && (
        <div className="space-y-6">
          <Card className="border-2 border-orange-500 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-red-500 text-white p-6">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl"><ShieldAlert className="h-8 w-8" /></div>
                <div>
                  <h1 className="text-2xl font-bold">Fraud Ko'rib Chiqish</h1>
                  <p className="text-orange-100 text-sm mt-1">
                    {fraudYuklanyapti ? 'Yuklanmoqda...' : `${fraudUrinishlar.length} ta kutilayotgan shubhali ro'yxatdan o'tish`}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {fraudYuklanyapti ? (
            <Card><CardContent className="py-16 text-center"><Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" /><p className="text-gray-500">Yuklanmoqda...</p></CardContent></Card>
          ) : fraudUrinishlar.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <CheckCircle className="h-20 w-20 text-green-400 mx-auto mb-4" />
              <p className="text-xl font-medium text-gray-500">Shubhali ro'yxatdan o'tishlar yo'q</p>
              <p className="text-sm text-gray-400 mt-2">Barcha profillar tekshirilgan</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-6">
              {fraudUrinishlar.map((fraud) => {
                const oxshashlik = Math.round((1 - (fraud.distance || 0)) * 100);
                return (
                  <Card key={fraud.id} className="border-2 border-orange-400 shadow-lg overflow-hidden">
                    <div className="bg-orange-50 border-b-2 border-orange-200 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-6 w-6 text-orange-600" />
                          <div>
                            <p className="font-bold text-orange-900 text-lg">{fraud.ism} {fraud.familiya}</p>
                            <p className="text-sm text-orange-700">{fraud.kurs} / {fraud.guruh} • {new Date(fraud.created_at).toLocaleString('uz-UZ')}</p>
                          </div>
                        </div>
                        <div className="bg-orange-100 border-2 border-orange-300 px-4 py-2 rounded-xl text-center">
                          <p className="text-xs text-orange-600 font-semibold">O'xshashlik</p>
                          <p className="text-2xl font-black text-orange-700">{oxshashlik}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Yangi profil (shubhali) */}
                        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <p className="text-sm font-bold text-red-700 uppercase tracking-wide">Yangi ro'yxatdan o'tish (shubhali)</p>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Ism:</span><span className="font-semibold text-red-900">{fraud.ism} {fraud.familiya}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Kurs:</span><span className="font-semibold text-red-900">{fraud.kurs}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Guruh:</span><span className="font-semibold text-red-900">{fraud.guruh}</span></div>
                          </div>
                          {fraud.rasm_data && (
                            <div className="mt-3">
                              <p className="text-xs text-red-600 font-semibold mb-2">Yangi profil rasmi (fraud paytida):</p>
                              <img src={fraud.rasm_data} alt="Yangi profil" className="w-full max-w-[180px] mx-auto rounded-xl border-2 border-red-300 shadow-md object-cover" style={{ aspectRatio: '4/3' }} />
                            </div>
                          )}
                        </div>
                        {/* Mavjud profil (eski) */}
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <p className="text-sm font-bold text-blue-700 uppercase tracking-wide">Mavjud profil (eski)</p>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Ism:</span><span className="font-semibold text-blue-900">{fraud.mos_talaba_ism} {fraud.mos_talaba_familiya}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Kurs:</span><span className="font-semibold text-blue-900">{fraud.mos_talaba_kurs}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Guruh:</span><span className="font-semibold text-blue-900">{fraud.mos_talaba_guruh}</span></div>
                          </div>
                          <div className="mt-3 bg-blue-100 rounded-lg p-3">
                            <p className="text-xs text-blue-700 font-semibold">Tizim bu ikkala profilni {oxshashlik}% o'xshash deb aniqladi</p>
                          </div>
                        </div>
                      </div>
                      {/* Admin amallar */}
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-gray-700 mb-3">Admin qarori:</p>
                        <div className="flex items-center gap-3">
                          <Button onClick={() => fraudniTasdiqlash(fraud)} className="flex-1 bg-green-600 hover:bg-green-700 h-11">
                            <CheckCircle className="h-4 w-4 mr-2" />Tasdiqlash (undov belgisini olib tashlash)
                          </Button>
                          <Button onClick={() => fraudniOchirish(fraud)} variant="destructive" className="flex-1 h-11">
                            <Trash2 className="h-4 w-4 mr-2" />Profilni o'chirish
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          ✅ Tasdiqlash = undov belgisi olib tashlanadi | 🗑️ O'chirish = profil butunlay o'chiriladi
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────── YORDAM XABARLARI ─────────── */}
      {view === 'yordam_admin' && <YordamAdminPanel />}

      {/* ─────────── ZAHIRA ─────────── */}
      {view === 'zahira' && <ZahiraPanel />}

      {/* ─────────── BOT XABARNOMASI ─────────── */}
      {view === 'bot_xabarnoma' && <BotXabarnomasi />}

      {/* ─────────── BOT USTOZ RUXSAT ─────────── */}
      {view === 'bot_ustoz_ruxsat' && (
        <UstozBotRuxsatPanel />
      )}

      {/* ─────────── BOT SOZLAMALARI ─────────── */}
      {view === 'bot_sozlamalari' && <BotSozlamalari />}

      {/* ─────────── USTOZ BOTI SOZLAMALARI ─────────── */}
      {view === 'ustoz_bot_sozlamalari' && <UstozBotSozlamalari />}

      {/* ─────────── CHAT BOSHQARUV ─────────── */}
      {view === 'chat_admin' && <AdminChatBoshqaruv />}

      {/* ─────────── FACE ID ─────────── */}
      {view === 'faceid' && <FaceIdPanel />}

      {/* ─────────── AI MENTOR ─────────── */}
      {view === 'ai_mentor' && <MentorAiSozlamalari />}

      {/* ─────────── CHUNKING ─────────── */}
      {view === 'chunking' && <AdminChunking />}

      {/* ─────────── TELEGRAM LOGIN BOT ─────────── */}
      {view === 'tg_login_bot' && <TelegramLoginSozlamalari />}

      {/* ─────────── ADMIN RO'YHAT ─────────── */}
      {view === 'royhat' && (() => {
        if (tanlanganAdminJavob) {
          const umumiyBall = ortachaBallAdmin(tanlanganAdminJavob.baho);
          const maks = tanlanganAdminJavob.baho.length * 30;
          const foiz = maks ? Math.round((umumiyBall / maks) * 100) : 0;
          return (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <button onClick={() => { setTanlanganAdminTalaba(null); setTanlanganAdminJavob(null); }} className="hover:text-red-600">Ro'yhat</button>
                <ChevronRight className="h-4 w-4" />
                <button onClick={() => setTanlanganAdminJavob(null)} className="hover:text-red-600">{tanlanganAdminTalaba?.ism} {tanlanganAdminTalaba?.familiya}</button>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-gray-800">{tanlanganAdminJavob.toplam_mavzu}</span>
              </div>
              <Card className="border-2 border-red-400 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-red-500 text-white p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">{tanlanganAdminJavob.toplam_mavzu}</h2>
                      <p className="text-red-100 text-sm">Kod: <span className="font-bold tracking-wider">{tanlanganAdminJavob.toplam_kod}</span></p>
                      <p className="text-red-100 text-sm mt-1">{new Date(tanlanganAdminJavob.created_at).toLocaleString('uz-UZ')}</p>
                    </div>
                    <div className="text-right bg-white/10 rounded-2xl p-4">
                      <p className="text-xs text-red-200 mb-1">Umumiy natija</p>
                      <p className={`text-5xl font-black ${foiz >= 70 ? 'text-green-300' : foiz >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>{umumiyBall}</p>
                      <p className="text-red-200 text-sm">/ {maks} ball</p>
                      <div className={`mt-2 text-lg font-bold ${foiz >= 70 ? 'text-green-300' : foiz >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>{foiz}%</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${foiz >= 70 ? 'bg-green-400' : foiz >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${foiz}%` }} />
                  </div>
                </div>
              </Card>
              <div className="space-y-4">
                {tanlanganAdminJavob.baho.map((baho: any, idx: number) => {
                  const kazus = adminToplamKazuslar[baho.kazus_index];
                  const oquvchiJavob = tanlanganAdminJavob.javoblar.find((j: any) => j.kazus_index === baho.kazus_index);
                  const ochiq = ochiqKazuslarAdmin.has(idx);
                  return (
                    <Card key={idx} className={`border-2 shadow-md transition-all ${ochiq ? 'border-red-400' : 'border-gray-200 hover:border-red-300'}`}>
                      <button className="w-full text-left" onClick={() => setOchiqKazuslarAdmin(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; })}>
                        <div className="flex items-center justify-between p-5">
                          <div className="flex items-center gap-4">
                            <div className="bg-red-600 text-white font-bold w-10 h-10 rounded-xl flex items-center justify-center text-lg">{baho.kazus_index + 1}</div>
                            <div>
                              <p className="font-semibold text-gray-800">Kazus {baho.kazus_index + 1}</p>
                              {kazus && <p className="text-sm text-gray-500 mt-0.5 line-clamp-1 max-w-md">{kazus.kazus?.slice(0, 80)}...</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className={`border-2 px-4 py-2 rounded-xl text-center ${baho.ball >= 21 ? 'bg-green-100 border-green-300' : baho.ball >= 15 ? 'bg-yellow-100 border-yellow-300' : 'bg-red-100 border-red-300'}`}>
                              <span className={`text-2xl font-black ${baho.ball >= 21 ? 'text-green-600' : baho.ball >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{baho.ball}</span>
                              <span className="text-gray-500 text-sm"> / 30</span>
                            </div>
                            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${ochiq ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </button>
                      {ochiq && (
                        <div className="border-t border-gray-100 p-5 space-y-4">
                          {kazus && <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl"><p className="text-xs font-bold text-blue-700 uppercase mb-2">📋 Kazus matni</p><p className="text-sm text-blue-900 leading-relaxed">{kazus.kazus}</p></div>}
                          {kazus && <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-xl"><p className="text-xs font-bold text-green-700 uppercase mb-2">✅ To'g'ri javob</p><p className="text-sm text-green-900 leading-relaxed whitespace-pre-wrap">{kazus.javob}</p></div>}
                          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-xl"><p className="text-xs font-bold text-purple-700 uppercase mb-2">✏️ Talaba javobi</p><p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{oquvchiJavob?.javob || 'Javob berilmagan'}</p></div>
                          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl"><p className="text-xs font-bold text-amber-700 uppercase mb-2">🤖 AI izohi</p><p className="text-sm text-amber-900 leading-relaxed">{baho.izoh}</p></div>
                          {baho.batafsil_tahlil && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {baho.batafsil_tahlil.xatolar?.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                  <p className="text-xs font-bold text-red-700 uppercase mb-3">❌ Xatolar</p>
                                  <div className="space-y-2">{baho.batafsil_tahlil.xatolar.map((x: any, xi: number) => (
                                    <div key={xi} className={`text-xs p-2 rounded-lg border ${x.tur === 'imlo' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-100 border-red-200'}`}>
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-white font-bold mr-2 text-[10px] ${x.tur === 'imlo' ? 'bg-yellow-500' : 'bg-red-500'}`}>{x.tur}</span>
                                      <span className="text-red-700">"{x.xato}"</span><span className="text-gray-500"> → </span><span className="text-green-700 font-semibold">"{x.togri}"</span>
                                    </div>))}
                                  </div>
                                </div>)}
                              {baho.batafsil_tahlil.yetishmayotganlar?.length > 0 && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                  <p className="text-xs font-bold text-orange-700 uppercase mb-3">⚠️ Yozilmay qolgan</p>
                                  <ul className="space-y-1">{baho.batafsil_tahlil.yetishmayotganlar.map((el: string, yi: number) => (<li key={yi} className="text-xs text-orange-900">• {el}</li>))}</ul>
                                </div>)}
                            </div>)}
                        </div>)}
                    </Card>);
                })}
              </div>
              <button onClick={() => setTanlanganAdminJavob(null)} className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 hover:border-red-400 text-gray-700 hover:text-red-600 rounded-xl font-medium transition-all">
                <ArrowLeft className="h-5 w-5" /> Orqaga
              </button>
            </div>
          );
        }

        if (tanlanganAdminTalaba) {
          return (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <button onClick={() => setTanlanganAdminTalaba(null)} className="hover:text-red-600">Ro'yhat</button>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-gray-800 flex items-center gap-2">
                  {tanlanganAdminTalaba.ism} {tanlanganAdminTalaba.familiya}
                  {tanlanganAdminTalaba.fraud_flag && <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black">!</span>}
                </span>
              </div>
              <Card className="border-2 border-red-500 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-red-600 to-red-500 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black">{tanlanganAdminTalaba.familiya[0]}{tanlanganAdminTalaba.ism[0]}</div>
                      <div>
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                          {tanlanganAdminTalaba.familiya} {tanlanganAdminTalaba.ism}
                          {tanlanganAdminTalaba.fraud_flag && <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">⚠️ Tekshirilmoqda</span>}
                        </h2>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">{tanlanganAdminTalaba.kurs.toUpperCase()}</span>
                          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">Guruh: {tanlanganAdminTalaba.guruh.toUpperCase()}</span>
                          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">{talabaJavoblariAdmin.length} ta test</span>
                          {tanlanganAdminTalaba.phone && (
                            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                              📱 {tanlanganAdminTalaba.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => talabaOchirish(tanlanganAdminTalaba)} className="bg-white/10 hover:bg-white/30 border-2 border-white/30 hover:border-white text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all">
                      <Trash2 className="h-4 w-4" /> O'chirish
                    </button>
                  </div>
                </div>
              </Card>
              {talabaYuklanyaptiAdmin ? (
                <Card><CardContent className="py-16 text-center"><div className="animate-spin h-12 w-12 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4" /><p className="text-gray-500">Yuklanmoqda...</p></CardContent></Card>
              ) : talabaJavoblariAdmin.length === 0 ? (
                <Card><CardContent className="py-16 text-center"><FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" /><p className="text-xl font-medium text-gray-500">Hali test topshirmagan</p></CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {talabaJavoblariAdmin.map((javob: any, idx: number) => {
                    const oball = ortachaBallAdmin(javob.baho);
                    const maks = javob.baho.length * 30;
                    const f = maks ? Math.round((oball / maks) * 100) : 0;
                    return (
                      <Card key={javob.id} className="border-2 border-gray-200 hover:border-red-400 cursor-pointer hover:shadow-lg transition-all" onClick={() => { setTanlanganAdminJavob(javob); setAdminToplamKazuslar(javob._kazuslar || []); setOchiqKazuslarAdmin(new Set()); }}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="bg-red-100 text-red-700 font-bold w-10 h-10 rounded-xl flex items-center justify-center">{idx + 1}</div>
                              <div>
                                <p className="font-semibold text-gray-900 text-lg">{javob.toplam_mavzu}</p>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">#{javob.toplam_kod}</span>
                                  <span>{new Date(javob.created_at).toLocaleDateString('uz-UZ')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className={`text-3xl font-black ${oball >= 21 ? 'text-green-600' : oball >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{oball}</span>
                                <span className="text-gray-400 text-sm"> / {maks}</span>
                                <div className={`text-sm font-semibold ${oball >= 21 ? 'text-green-600' : oball >= 15 ? 'text-yellow-600' : 'text-red-600'}`}>{f}%</div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
              <button onClick={() => setTanlanganAdminTalaba(null)} className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 hover:border-red-400 text-gray-700 hover:text-red-600 rounded-xl font-medium transition-all">
                <ArrowLeft className="h-5 w-5" /> Orqaga
              </button>
            </div>
          );
        }

        const kurslarHisob: Record<string, number> = {};
        talabalar.forEach(t => { kurslarHisob[t.kurs] = (kurslarHisob[t.kurs] || 0) + 1; });
        const filtred = talabalar
          .filter(t => {
            const kOk = talabaTanlanganKurs === 'barchasi' || t.kurs === talabaTanlanganKurs;
            const gOk = talabaTanlanganGuruh === 'barchasi' || t.guruh === talabaTanlanganGuruh;
            const qOk = talabaQidiruv === '' || `${t.ism} ${t.familiya}`.toLowerCase().includes(talabaQidiruv.toLowerCase());
            return kOk && gOk && qOk;
          })
          .sort((a, b) => a.familiya.localeCompare(b.familiya, 'uz'));
        const guruhlarMap: Record<string, Record<string, typeof filtred>> = {};
        filtred.forEach(t => {
          if (!guruhlarMap[t.kurs]) guruhlarMap[t.kurs] = {};
          if (!guruhlarMap[t.kurs][t.guruh]) guruhlarMap[t.kurs][t.guruh] = [];
          guruhlarMap[t.kurs][t.guruh].push(t);
        });

        return (
          <div className="max-w-5xl mx-auto space-y-6">
            <Card className="border-2 border-red-500 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-500 text-white p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl"><Users className="h-8 w-8" /></div>
                    <div>
                      <h1 className="text-2xl font-bold">Talabalar Ro'yhati</h1>
                      <p className="text-red-100 text-sm mt-1">Jami {talabalar.length} ta talaba • Admin rejimi</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-3">
                    {KURSLAR_ADMIN.map(k => (<div key={k} className="bg-white/10 px-3 py-2 rounded-xl text-center"><p className="text-lg font-black">{kurslarHisob[k] || 0}</p><p className="text-red-200 text-xs">{k}</p></div>))}
                  </div>
                </div>
              </div>
            </Card>
            <Card className="border border-gray-200">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input placeholder="Qidirish..." value={talabaQidiruv} onChange={e => setTalabaQidiruv(e.target.value)} className="w-full pl-9 pr-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-400 text-sm" />
                    {talabaQidiruv && <button onClick={() => setTalabaQidiruv('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="h-4 w-4 text-gray-400" /></button>}
                  </div>
                  <select value={talabaTanlanganKurs} onChange={e => setTalabaTanlanganKurs(e.target.value)} className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-400 bg-white text-sm">
                    <option value="barchasi">Barcha kurslar</option>
                    {KURSLAR_ADMIN.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <select value={talabaTanlanganGuruh} onChange={e => setTalabaTanlanganGuruh(e.target.value)} className="px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-red-400 bg-white text-sm">
                    <option value="barchasi">Barcha guruhlar</option>
                    {GURUHLAR_ADMIN.map(g => <option key={g} value={g}>{g.toUpperCase()}</option>)}
                  </select>
                  <span className="text-sm text-gray-500">{filtred.length} ta</span>
                </div>
              </CardContent>
            </Card>
            {filtred.length === 0 ? (
              <Card><CardContent className="py-20 text-center"><Users className="h-20 w-20 text-gray-300 mx-auto mb-4" /><p className="text-xl font-medium text-gray-500">{talabalar.length === 0 ? "Hali talabalar ro'yxatdan o'tmagan" : 'Talaba topilmadi'}</p></CardContent></Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(guruhlarMap).sort(([a], [b]) => a.localeCompare(b)).map(([kurs, guruhlar]) => (
                  <div key={kurs} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold uppercase">{kurs}</div>
                      <div className="flex-1 h-0.5 bg-red-100" />
                      <span className="text-sm text-gray-500">{Object.values(guruhlar).reduce((s, a) => s + a.length, 0)} ta</span>
                    </div>
                    {Object.entries(guruhlar).sort(([a], [b]) => a.localeCompare(b)).map(([guruh, oqituvchilar]) => (
                      <Card key={guruh} className="border border-gray-200 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3"><BookOpen className="h-5 w-5 text-red-600" /><span className="font-bold text-gray-800 text-lg">Guruh: {guruh.toUpperCase()}</span></div>
                          <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">{oqituvchilar.length} talaba</div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {oqituvchilar.map((talaba, idx) => (
                            <div key={idx} className="flex items-center px-5 py-3.5 hover:bg-red-50 transition-colors group">
                              <button className="flex items-center gap-4 flex-1" onClick={() => talabaJavoblariniYuklashAdmin(talaba)}>
                                <span className="w-8 text-sm font-semibold text-gray-400">{idx + 1}.</span>
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 text-white font-bold text-sm flex items-center justify-center">{talaba.familiya[0]?.toUpperCase()}</div>
                                <span className="font-semibold text-gray-900 group-hover:text-red-700 transition-colors flex items-center gap-2">
                                  {talaba.familiya} {talaba.ism}
                                  {talaba.fraud_flag && <span title="Admin ko'rib chiqish kutilmoqda" className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white rounded-full text-xs font-black flex-shrink-0">!</span>}
                                </span>
                              </button>
                              <button onClick={() => talabaOchirish(talaba)} className="p-2 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors ml-2" title="O'chirish">
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-red-500 ml-2" />
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <style>{`
        @keyframes slide-up { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.5s ease-out; }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// YORDAM ADMIN PANEL
// ──────────────────────────────────────────────────────────────────────────────
function YordamAdminPanel() {
  const [xabarlar, setXabarlar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [tanlanganXabar, setTanlanganXabar] = useState<any | null>(null);
  const [javob, setJavob] = useState('');
  const [javobYuklanyapti, setJavobYuklanyapti] = useState(false);
  const [filter, setFilter] = useState<'barchasi' | 'yangi' | 'korildi' | 'javob_berildi'>('barchasi');
  const { toast } = useToast();

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      let query = supabase.from('yordam_xabarlar').select('*').order('created_at', { ascending: false });
      if (filter !== 'barchasi') query = query.eq('holat', filter);
      const { data, error } = await query;
      if (error) throw error;
      setXabarlar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Yuklanmadi', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  useEffect(() => { yuklash(); }, [filter]);

  const holatOzgartirish = async (id: string, holat: string) => {
    await supabase.from('yordam_xabarlar').update({ holat }).eq('id', id);
    setXabarlar(prev => prev.map(x => x.id === id ? { ...x, holat } : x));
    if (tanlanganXabar?.id === id) setTanlanganXabar((prev: any) => ({ ...prev, holat }));
  };

  const javobYuborish = async () => {
    if (!javob.trim() || !tanlanganXabar) return;
    setJavobYuklanyapti(true);
    try {
      await supabase.from('yordam_xabarlar').update({
        admin_javob: javob.trim(),
        holat: 'javob_berildi',
      }).eq('id', tanlanganXabar.id);
      setXabarlar(prev => prev.map(x => x.id === tanlanganXabar.id ? { ...x, admin_javob: javob.trim(), holat: 'javob_berildi' } : x));
      setTanlanganXabar((prev: any) => ({ ...prev, admin_javob: javob.trim(), holat: 'javob_berildi' }));
      setJavob('');
      toast({ title: '✅ Javob yuborildi!' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setJavobYuklanyapti(false);
    }
  };

  const holatRang = (holat: string) => {
    switch (holat) {
      case 'yangi': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'korildi': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'javob_berildi': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const yangilarSoni = xabarlar.filter(x => x.holat === 'yangi').length;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Card className="border-2 border-blue-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl">
                <HelpCircle className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Yordam Xabarlari</h1>
                <p className="text-blue-100 text-sm mt-1">
                  {yuklanyapti ? 'Yuklanmoqda...' : `${xabarlar.length} ta so'rov`}
                  {yangilarSoni > 0 && <span className="ml-2 bg-amber-400 text-amber-900 text-xs font-black px-2 py-0.5 rounded-full">{yangilarSoni} yangi</span>}
                </p>
              </div>
            </div>
            <button onClick={yuklash} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
              Yangilash
            </button>
          </div>
        </div>
      </Card>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{key: 'barchasi', label: 'Barchasi'}, {key: 'yangi', label: '⏳ Yangi'}, {key: 'korildi', label: '👁 Ko\'rildi'}, {key: 'javob_berildi', label: '✅ Javob berildi'}].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${filter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Xabarlar ro'yhati */}
        <div className="space-y-3">
          {yuklanyapti ? (
            <Card><CardContent className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" /></CardContent></Card>
          ) : xabarlar.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Yordam so'rovlari yo'q</p>
            </CardContent></Card>
          ) : xabarlar.map(x => (
            <Card key={x.id}
              onClick={() => { setTanlanganXabar(x); setJavob(x.admin_javob || ''); if (x.holat === 'yangi') holatOzgartirish(x.id, 'korildi'); }}
              className={`cursor-pointer border-2 transition-all hover:shadow-md ${
                tanlanganXabar?.id === x.id ? 'border-blue-400 bg-blue-50/30' :
                x.holat === 'yangi' ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 hover:border-blue-300'
              }`}>
              <CardContent className="py-4 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">
                        {x.foydalanuvchi_ism} {x.foydalanuvchi_familiya}
                      </p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${x.foydalanuvchi_tur === 'ustoz' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-emerald-100 text-emerald-700 border-emerald-300'}`}>
                        {x.foydalanuvchi_tur === 'ustoz' ? 'Ustoz' : "O'quvchi"}
                      </span>
                      {x.holat === 'yangi' && <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
                    </div>
                    {x.telefon && <p className="text-xs text-blue-600 font-semibold">📱 {x.telefon}</p>}
                    {x.kurs && <p className="text-xs text-gray-500">{x.kurs} / {x.guruh}</p>}
                    <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{x.xabar}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(x.created_at).toLocaleString('uz-UZ')}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${holatRang(x.holat)}`}>
                    {x.holat === 'yangi' ? '⏳' : x.holat === 'korildi' ? '👁' : '✅'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tanlangan xabar batafsil */}
        {tanlanganXabar ? (
          <Card className="border-2 border-blue-300 shadow-lg sticky top-4">
            <CardContent className="pt-5 pb-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-gray-900">So'rov tafsilotlari</h3>
                  <button onClick={() => setTanlanganXabar(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Foydalanuvchi ma'lumotlari */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ism:</span>
                    <span className="font-semibold">{tanlanganXabar.foydalanuvchi_ism} {tanlanganXabar.foydalanuvchi_familiya}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tur:</span>
                    <span className="font-semibold capitalize">{tanlanganXabar.foydalanuvchi_tur}</span>
                  </div>
                  {tanlanganXabar.telefon && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Telefon:</span>
                      <a href={`tel:${tanlanganXabar.telefon}`} className="font-bold text-blue-600 hover:underline">{tanlanganXabar.telefon}</a>
                    </div>
                  )}
                  {tanlanganXabar.foydalanuvchi_login && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Login:</span>
                      <span className="font-mono text-xs">{tanlanganXabar.foydalanuvchi_login}</span>
                    </div>
                  )}
                  {tanlanganXabar.kurs && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Kurs/Guruh:</span>
                      <span className="font-semibold">{tanlanganXabar.kurs} / {tanlanganXabar.guruh}</span>
                    </div>
                  )}
                </div>

                {/* Xabar */}
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 mb-1.5">So'rov:</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{tanlanganXabar.xabar}</p>
                </div>

                {/* Rasm */}
                {tanlanganXabar.rasm_url && (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-gray-600 mb-1.5">Yuklangan rasm:</p>
                    <a href={tanlanganXabar.rasm_url} target="_blank" rel="noopener noreferrer">
                      <img src={tanlanganXabar.rasm_url} alt="Skrinshot" className="max-h-48 rounded-xl border border-gray-200 object-contain hover:opacity-80 transition-opacity" />
                    </a>
                  </div>
                )}
              </div>

              {/* Holat o'zgartirish */}
              <div className="flex gap-2">
                {['yangi', 'korildi', 'javob_berildi'].map(h => (
                  <button key={h} onClick={() => holatOzgartirish(tanlanganXabar.id, h)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold border-2 transition-all ${
                      tanlanganXabar.holat === h ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400'
                    }`}>
                    {h === 'yangi' ? '⏳ Yangi' : h === 'korildi' ? '👁 Ko\'rildi' : '✅ Javob'}
                  </button>
                ))}
              </div>

              {/* Javob yozish */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1.5 block">Admin javobi:</label>
                <textarea
                  value={javob}
                  onChange={e => setJavob(e.target.value)}
                  placeholder="Foydalanuvchiga javob yozing..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 focus:border-blue-400 outline-none text-sm resize-none transition-all"
                />
                <button
                  onClick={javobYuborish}
                  disabled={javobYuklanyapti || !javob.trim()}
                  className="w-full mt-2 h-10 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {javobYuklanyapti ? <><Loader2 className="h-4 w-4 animate-spin" />Saqlanmoqda...</> : <>✅ Javob yuborish</>}
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-dashed border-gray-200">
            <CardContent className="py-20 text-center">
              <HelpCircle className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Xabarni bosib batafsil ko'ring</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// USTOZ BOT RUXSAT PANEL - individual
// ──────────────────────────────────────────────────────────────────────────────
function UstozBotRuxsatPanel() {
  const [ustozlar, setUstozlar] = useState<any[]>([]);
  const [umumiyRuxsat, setUmumiyRuxsat] = useState(false);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const { toast } = useToast();

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const [ustozRes, sozRes] = await Promise.all([
        supabase.from('ustoz').select('id, full_name, username, status').order('created_at', { ascending: true }),
        supabase.from('settings').select('key, value, text_value').in('key', ['USTOZ_BOT_YANGILIK_RUXSAT', ...[] ]),
      ]);
      setUstozlar(ustozRes.data || []);
      // Umumiy ruxsat
      const { data: sozData } = await supabase.from('settings').select('value').eq('key', 'USTOZ_BOT_YANGILIK_RUXSAT').maybeSingle();
      setUmumiyRuxsat(sozData?.value ?? false);
    } catch (e) {
      console.error(e);
    } finally {
      setYuklanyapti(false);
    }
  };

  const getUstozRuxsat = async (ustozId: string): Promise<boolean> => {
    const { data } = await supabase.from('settings').select('value').eq('key', `USTOZ_BOT_RUXSAT_${ustozId}`).maybeSingle();
    return data?.value ?? umumiyRuxsat;
  };

  // Individual ustoz ruxsatini o'zgartirish
  const toggleUstozRuxsat = async (ustoz: any, joriyRuxsat: boolean) => {
    setToggling(ustoz.id);
    const yangi = !joriyRuxsat;
    try {
      await supabase.from('settings').upsert({
        key: `USTOZ_BOT_RUXSAT_${ustoz.id}`,
        value: yangi,
        tavsif: `${ustoz.full_name} uchun bot yangilik yuborish ruxsati`,
      }, { onConflict: 'key' });
      setUstozlar(prev => prev.map(u => u.id === ustoz.id ? { ...u, _ruxsat: yangi } : u));
      toast({ title: yangi ? `✅ Ruxsat berildi` : `❌ Ruxsat olib tashlandi`, description: `${ustoz.full_name}` });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  // Umumiy ruxsatni o'zgartirish
  const toggleUmumiy = async (yangi: boolean) => {
    setToggling('umumiy');
    try {
      await supabase.from('settings').upsert({ key: 'USTOZ_BOT_YANGILIK_RUXSAT', value: yangi, tavsif: 'Ustozlarga botga yangilik yuborish ruxsati' }, { onConflict: 'key' });
      setUmumiyRuxsat(yangi);
      toast({ title: yangi ? '✅ Barcha ustozlarga ruxsat berildi' : '❌ Barcha ustozlarga ruxsat olib tashlandi' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    } finally {
      setToggling(null);
    }
  };

  // Individual ruxsat olish
  const [ustozRuxsatlar, setUstozRuxsatlar] = useState<Record<string, boolean>>({});

  useEffect(() => {
    yuklash();
  }, []);

  useEffect(() => {
    if (ustozlar.length === 0) return;
    // Har bir ustoz uchun ruxsatni yuklash
    const keys = ustozlar.map((u: any) => `USTOZ_BOT_RUXSAT_${u.id}`);
    supabase.from('settings').select('key, value').in('key', keys).then(({ data }) => {
      const map: Record<string, boolean> = {};
      (data || []).forEach((s: any) => {
        const ustozId = s.key.replace('USTOZ_BOT_RUXSAT_', '');
        map[ustozId] = s.value;
      });
      setUstozRuxsatlar(map);
    });
  }, [ustozlar.length, umumiyRuxsat]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Card className="border-2 border-indigo-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Shield className="h-8 w-8" /></div>
            <div>
              <h1 className="text-2xl font-black">Ustoz Bot Ruxsati</h1>
              <p className="text-indigo-200 text-sm mt-1">Ustozlarga botga yangilik yuborish huquqini boshqaring</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Umumiy ruxsat */}
      <Card className="border-2 border-slate-200">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="bg-indigo-500 p-2 rounded-lg"><Bot className="h-5 w-5 text-white" /></div>
                <h3 className="text-base font-bold text-gray-900">Barcha ustozlarga ruxsat</h3>
              </div>
              <p className="text-xs text-gray-600 ml-12">Yoqilsa, barcha ustozlar botga yangilik yubora oladi.</p>
              <div className="mt-2 ml-12">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${
                  umumiyRuxsat ? 'bg-green-100 border-green-400 text-green-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${umumiyRuxsat ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {umumiyRuxsat ? "Barcha ustozlarga ruxsat bor" : "Ruxsat yo'q"}
                </span>
              </div>
            </div>
            <div className="ml-4">
              {toggling === 'umumiy' ? (
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              ) : (
                <Switch checked={umumiyRuxsat} onCheckedChange={toggleUmumiy} className="data-[state=checked]:bg-indigo-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual ustozlar */}
      <Card className="border-2 border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Individual ruxsat boshqaruvi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {yuklanyapti ? (
            <div className="py-10 text-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" /></div>
          ) : ustozlar.filter((u: any) => u.status === 'approved').length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Tasdiqlangan ustozlar yo'q</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ustozlar.filter((u: any) => u.status === 'approved').map((ustoz: any) => {
                const hasIndividual = ustozId => ustozRuxsatlar.hasOwnProperty(ustozId);
                const ruxsat = hasIndividual(ustoz.id) ? ustozRuxsatlar[ustoz.id] : umumiyRuxsat;
                const isToggling = toggling === ustoz.id;
                return (
                  <div key={ustoz.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    ruxsat ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-gray-50/30'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${
                        ruxsat ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        {ustoz.full_name?.[0] || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{ustoz.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">@{ustoz.username}</span>
                          {hasIndividual(ustoz.id) && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">Maxsus</span>
                          )}
                          {!hasIndividual(ustoz.id) && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Umumiy</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${
                        ruxsat ? 'text-green-600' : 'text-gray-400'
                      }`}>
                        {ruxsat ? 'Ruxsat bor' : "Ruxsat yo'q"}
                      </span>
                      {isToggling ? (
                        <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                      ) : (
                        <Switch
                          checked={ruxsat}
                          onCheckedChange={() => toggleUstozRuxsat(ustoz, ruxsat)}
                          className="data-[state=checked]:bg-green-600"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ADMIN MATERIALLAR PANEL
// ──────────────────────────────────────────────────────────────────────────────
function AdminMateriallarPanel() {
  const [bolimlar, setBolimlar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const { toast } = useToast();

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('om_bolimlar')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const { data: korishlar } = await supabase.from('om_korishlar').select('bolim_id');
      const korishMap: Record<string, number> = {};
      (korishlar || []).forEach((k: any) => { korishMap[k.bolim_id] = (korishMap[k.bolim_id] || 0) + 1; });
      setBolimlar((data || []).map((b: any) => ({ ...b, _korishlar_soni: korishMap[b.id] || 0 })));
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Yuklanmadi', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  useEffect(() => { yuklash(); }, []);

  const bloklashtirish = async (bolim: any) => {
    const yangiHolat = !bolim.admin_bloklangan;
    try {
      const { error } = await supabase
        .from('om_bolimlar')
        .update({ admin_bloklangan: yangiHolat, faol: yangiHolat ? false : bolim.faol })
        .eq('id', bolim.id);
      if (error) throw error;
      setBolimlar(prev => prev.map(b =>
        b.id === bolim.id ? { ...b, admin_bloklangan: yangiHolat, faol: yangiHolat ? false : b.faol } : b
      ));
      toast({
        title: yangiHolat ? 'Bloklandi' : 'Blok olib tashlandi',
        description: yangiHolat
          ? `"${bolim.nomi}" bloklandi. Ustoz qayta yoqa olmaydi.`
          : `"${bolim.nomi}" bloki olib tashlandi. Ustoz yoqishi mumkin.`,
      });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-2 border-teal-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl"><Library className="h-8 w-8" /></div>
              <div>
                <h1 className="text-2xl font-bold">O'quv Materiallar Boshqaruvi</h1>
                <p className="text-teal-100 text-sm mt-1">{yuklanyapti ? 'Yuklanmoqda...' : `${bolimlar.length} ta bo'lim`}</p>
              </div>
            </div>
            <button onClick={yuklash} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all">Yangilash</button>
          </div>
        </div>
      </Card>

      {yuklanyapti ? (
        <Card><CardContent className="py-16 text-center"><Loader2 className="h-12 w-12 animate-spin text-teal-500 mx-auto mb-4" /></CardContent></Card>
      ) : bolimlar.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Library className="h-20 w-20 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-500">Hali bo'limlar yaratilmagan</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {bolimlar.map((bolim) => (
            <Card key={bolim.id} className={`border-2 transition-all ${
              bolim.admin_bloklangan ? 'border-red-400 bg-red-50/30' : bolim.faol ? 'border-green-300 bg-green-50/20' : 'border-gray-200'
            }`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900">{bolim.nomi}</h3>
                      {bolim.admin_bloklangan ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border bg-red-100 border-red-400 text-red-700">Bloklangan</span>
                      ) : bolim.faol ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border bg-green-100 border-green-400 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Faol
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border bg-gray-100 border-gray-300 text-gray-500">Nofaol</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                      <span className="text-gray-500">Ustoz: {bolim.ustoz_ismi}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-violet-500" />{bolim._korishlar_soni} o'quvchi ko'rgan</span>
                      {bolim.tavsif && <span className="italic text-gray-400 text-xs">"{bolim.tavsif.slice(0, 50)}{bolim.tavsif.length > 50 ? '...' : ''}"</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => bloklashtirish(bolim)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                        bolim.admin_bloklangan
                          ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                          : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {bolim.admin_bloklangan ? (
                        <><EyeOff className="h-4 w-4" />Blokni olib tashlash</>
                      ) : (
                        <><Shield className="h-4 w-4" />Bloklash</>
                      )}
                    </button>
                  </div>
                </div>
                {bolim.admin_bloklangan && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-xl">
                    <p className="text-xs text-red-700 font-semibold">
                      Bu bo'lim bloklangan: Ustoz uni yoqa olmaydi va o'quvchilar ko'ra olmaydi.
                      Admin blokni olib tashlagandan keyin ustoz o'zi faollashtirishi mumkin.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// TAHRIRLASHLAR PANEL
// ──────────────────────────────────────────────────────────────────────────────
function TahrirlashlarPanel() {
  const [tahrirlashlar, setTahrirlashlar] = useState<any[]>([]);
  const [yuklanyapti, setYuklanyapti] = useState(true);
  const { toast } = useToast();

  const yuklash = async () => {
    setYuklanyapti(true);
    try {
      const { data, error } = await supabase
        .from('profil_tahrirlashlar')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTahrirlashlar(data || []);
    } catch (e: any) {
      toast({ title: 'Xato', description: 'Yuklanmadi', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
    }
  };

  useEffect(() => { yuklash(); }, []);

  const tasdiqlash = async (id: string, item: any) => {
    try {
      // Asosiy jadvalda ismni o'zgartirish
      if (item.tur === 'oquvchi') {
        await supabase
          .from('talabalar')
          .update({ ism: item.yangi_ism, familiya: item.yangi_familiya })
          .eq('ism', item.eski_ism)
          .eq('familiya', item.eski_familiya);

        // localStorage persistent keylarini tozalash (eski ism bilan saqlangan)
        // Foydalanuvchi keyingi kirishda yangi ism bilan ko'rinadi
        const persistentKey = 'huquq_persistent_user';
        const storageKey = 'huquq_auth_user';
        const savedUser = localStorage.getItem(persistentKey);
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            if (userData.ism === item.eski_ism && userData.familiya === item.eski_familiya) {
              // Foydalanuvchi hozir shu brauzerda tizimga kirgan — yangi ismga yangilash
              const yangiUser = { ...userData, ism: item.yangi_ism, familiya: item.yangi_familiya };
              localStorage.setItem(persistentKey, JSON.stringify(yangiUser));
              localStorage.setItem(storageKey, JSON.stringify(yangiUser));
              // Profil localStorageni ham yangilash
              const eskiProfilKey = `juris_profil_v2_${item.eski_ism}_${item.eski_familiya}`;
              const yangiProfilKey = `juris_profil_v2_${item.yangi_ism}_${item.yangi_familiya}`;
              const profilData = localStorage.getItem(eskiProfilKey);
              if (profilData) {
                localStorage.setItem(yangiProfilKey, profilData);
                localStorage.removeItem(eskiProfilKey);
              }
            }
          } catch {}
        }
      } else if (item.tur === 'ustoz') {
        // murojaat_id = ustoz_id
        await supabase
          .from('ustoz')
          .update({ full_name: `${item.yangi_familiya} ${item.yangi_ism}` })
          .eq('id', item.murojaat_id);

        // Ustoz localStorage yangilash
        const persistentKey = 'huquq_persistent_user';
        const storageKey = 'huquq_auth_user';
        const savedUser = localStorage.getItem(persistentKey);
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            if (userData.ustoz_id === item.murojaat_id) {
              const yangiUser = { ...userData, ism: item.yangi_ism, familiya: item.yangi_familiya };
              localStorage.setItem(persistentKey, JSON.stringify(yangiUser));
              localStorage.setItem(storageKey, JSON.stringify(yangiUser));
            }
          } catch {}
        }
      }

      await supabase
        .from('profil_tahrirlashlar')
        .update({ holat: 'approved' })
        .eq('id', id);

      toast({ title: '✅ Tasdiqlandi', description: `${item.yangi_familiya} ${item.yangi_ism} ga o'zgartirildi. Foydalanuvchi sahifasini yangilanganda yangi ism ko'rinadi.` });
      yuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const radEtish = async (id: string) => {
    try {
      await supabase.from('profil_tahrirlashlar').update({ holat: 'rejected' }).eq('id', id);
      toast({ title: 'Rad etildi', description: 'So\'rov rad etildi' });
      yuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const rasmOchirish = async (id: string) => {
    if (!confirm('Rasmni o\'chirib tashlamoqchimisiz?')) return;
    try {
      await supabase.from('profil_tahrirlashlar').update({ yuz_rasmi: null }).eq('id', id);
      setTahrirlashlar(prev => prev.map(t => t.id === id ? { ...t, yuz_rasmi: null } : t));
      toast({ title: 'O\'chirildi', description: 'Rasm o\'chirildi (xotira tejaldi)' });
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
  };

  const pendinglar = tahrirlashlar.filter(t => t.holat === 'pending');
  const qolganlar = tahrirlashlar.filter(t => t.holat !== 'pending');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-2 border-amber-500 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-amber-600 to-orange-500 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl"><Edit className="h-8 w-8" /></div>
              <div>
                <h1 className="text-2xl font-bold">Tahrirlash So'rovlari</h1>
                <p className="text-amber-100 text-sm mt-1">
                  {yuklanyapti ? 'Yuklanmoqda...' : `${pendinglar.length} ta kutilayotgan so'rov`}
                </p>
              </div>
            </div>
            <button onClick={yuklash} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-semibold transition-all">Yangilash</button>
          </div>
        </div>
      </Card>

      {yuklanyapti ? (
        <Card><CardContent className="py-16 text-center"><Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto mb-4" /></CardContent></Card>
      ) : pendinglar.length === 0 && qolganlar.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <CheckCircle className="h-16 w-16 text-green-300 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-500">Tahrirlash so'rovlari yo'q</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {/* Kutilayotgan so'rovlar */}
          {pendinglar.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-amber-700 flex items-center gap-2">
                <Clock className="h-5 w-5" /> Kutilayotgan ({pendinglar.length})
              </h2>
              {pendinglar.map(item => (
                <Card key={item.id} className="border-2 border-amber-400 shadow-lg">
                  <CardContent className="pt-5 pb-5 space-y-4">
                    {/* Tur badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${
                        item.tur === 'ustoz'
                          ? 'bg-blue-100 border-blue-400 text-blue-700'
                          : 'bg-emerald-100 border-emerald-400 text-emerald-700'
                      }`}>
                        {item.tur === 'ustoz' ? '\ud83d\udc68\u200d\ud83c\udfeb Ustoz' : "\ud83d\udc68\u200d\ud83c\udf93 O'quvchi"}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString('uz-UZ')}</span>
                    </div>

                    {/* Avvalgi / yangi ism */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Avvalgi ism</p>
                        <p className="text-xl font-black text-gray-800">{item.eski_familiya} {item.eski_ism}</p>
                      </div>
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                        <p className="text-xs font-bold text-amber-600 uppercase mb-2">Yangi ism (so'rov)</p>
                        <p className="text-xl font-black text-amber-900">{item.yangi_familiya} {item.yangi_ism}</p>
                      </div>
                    </div>

                    {/* Yuz rasmi */}
                    {item.yuz_rasmi && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-gray-600 mb-2">Verifikatsiya paytidagi yuz rasmi:</p>
                        <div className="flex items-start gap-4">
                          <img
                            src={item.yuz_rasmi}
                            alt="Yuz rasmi"
                            className="w-32 h-32 rounded-xl object-cover border-2 border-gray-300 shadow"
                          />
                          <Button
                            onClick={() => rasmOchirish(item.id)}
                            variant="outline"
                            size="sm"
                            className="border-2 border-red-300 text-red-600 hover:bg-red-50 mt-auto"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Rasmni o'chirish
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Admin amallar */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => tasdiqlash(item.id, item)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white h-11"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" /> Tasdiqlash va o'zgartirish
                      </Button>
                      <Button
                        onClick={() => radEtish(item.id)}
                        variant="destructive"
                        className="flex-1 h-11"
                      >
                        <XCircle className="h-4 w-4 mr-2" /> Rad etish
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tugallangan so'rovlar */}
          {qolganlar.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-bold text-gray-500 flex items-center gap-2">
                Tugatilgan so'rovlar ({qolganlar.length})
              </h2>
              {qolganlar.map(item => (
                <Card key={item.id} className={`border ${
                  item.holat === 'approved' ? 'border-green-200 bg-green-50/30' : 'border-red-200 bg-red-50/30'
                }`}>
                  <CardContent className="py-3.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        item.holat === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {item.holat === 'approved' ? '\u2705 Tasdiqlandi' : '\u274c Rad etildi'}
                      </span>
                      <span className="text-sm text-gray-500">{item.eski_familiya} {item.eski_ism}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-semibold text-gray-800">{item.yangi_familiya} {item.yangi_ism}</span>
                      {item.yuz_rasmi && (
                        <button
                          onClick={() => rasmOchirish(item.id)}
                          className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Rasmni o'chirish
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
