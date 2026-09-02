import { useState, useEffect, useRef } from 'react';
import {
  HelpCircle, Send, Loader2, Image as ImageIcon, X,
  CheckCircle, Clock, MessageCircle, Phone, AlertCircle,
  ChevronRight, User, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function YordamSahifa() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [xabar, setXabar] = useState('');
  const [rasm, setRasm] = useState<File | null>(null);
  const [rasmPreview, setRasmPreview] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [meningXabarlarim, setMeningXabarlarim] = useState<any[]>([]);
  const [tarixYuklanyapti, setTarixYuklanyapti] = useState(false);
  const [yuborildi, setYuborildi] = useState(false);

  // Botdan telefon raqamini olish
  const [telefon, setTelefon] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    tarixniYuklash();

    // Talabaning telefon raqamini olish
    const telefonniOlish = async () => {
      const login = user.login;
      if (!login) return;
      const { data } = await supabase
        .from('talabalar')
        .select('phone')
        .or(`login_id.eq.${login},login_id.eq.+${login.replace(/\D/g, '')}`)
        .maybeSingle();
      if (data?.phone) setTelefon(data.phone);
    };

    if (user.rol === 'oquvchi') telefonniOlish();
    else if (user.rol === 'ustoz') {
      // Ustoz telefon
      const ustozTelefon = async () => {
        const { data } = await supabase
          .from('ustoz')
          .select('phone')
          .eq('id', user.ustoz_id)
          .maybeSingle();
        if (data?.phone) setTelefon(data.phone);
      };
      ustozTelefon();
    }
  }, [isAuthenticated, user]);

  const tarixniYuklash = async () => {
    if (!user) return;
    setTarixYuklanyapti(true);
    try {
      const fullIsm = `${user.ism}${user.familiya ? ' ' + user.familiya : ''}`;
      const { data, error } = await supabase
        .from('yordam_xabarlar')
        .select('*')
        .eq('foydalanuvchi_ism', user.ism)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setMeningXabarlarim(data || []);
    } catch (e) {
      console.error('Tarix yuklashda xato:', e);
    } finally {
      setTarixYuklanyapti(false);
    }
  };

  const rasmTanlash = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Xato', description: "Rasm hajmi 5 MB dan oshmasin", variant: 'destructive' });
      return;
    }
    setRasm(file);
    const reader = new FileReader();
    reader.onload = (ev) => setRasmPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const rasmniOlib = () => {
    setRasm(null);
    setRasmPreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const yuborish = async () => {
    if (!xabar.trim()) {
      toast({ title: 'Xabar yozing', description: "Muammoni qisqacha tavsiflab yozing", variant: 'destructive' });
      return;
    }
    if (!isAuthenticated || !user) {
      toast({ title: 'Kirish talab etiladi', description: "Yordam so'rash uchun tizimga kiring", variant: 'destructive' });
      return;
    }

    setYuklanyapti(true);
    try {
      let rasmUrl = '';

      // Rasmni Storage ga yuklash
      if (rasm) {
        const fileName = `yordam/${Date.now()}_${rasm.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from('chat-fayllar')
          .upload(fileName, rasm);
        if (storageError) throw storageError;
        const { data: urlData } = supabase.storage.from('chat-fayllar').getPublicUrl(fileName);
        rasmUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('yordam_xabarlar').insert({
        foydalanuvchi_ism: user.ism,
        foydalanuvchi_familiya: user.familiya || '',
        foydalanuvchi_tur: user.rol || 'oquvchi',
        foydalanuvchi_login: user.login || telefon || '',
        guruh: (user as any).guruh || '',
        kurs: (user as any).kurs || '',
        telefon: telefon || user.login || '',
        xabar: xabar.trim(),
        rasm_url: rasmUrl || null,
        holat: 'yangi',
      });
      if (error) throw error;

      setYuborildi(true);
      setXabar('');
      rasmniOlib();
      toast({ title: '✅ Yuborildi!', description: "Xabaringiz adminga yetkazildi. Tez orada javob beramiz." });
      setTimeout(() => setYuborildi(false), 3000);
      await tarixniYuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message || 'Yuborishda xatolik', variant: 'destructive' });
    } finally {
      setYuklanyapti(false);
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

  const holatMatn = (holat: string) => {
    switch (holat) {
      case 'yangi': return '⏳ Kutilmoqda';
      case 'korildi': return '👁 Ko\'rildi';
      case 'javob_berildi': return '✅ Javob berildi';
      default: return holat;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl">
            <HelpCircle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Yordam markazi</h1>
            <p className="text-blue-100 text-sm mt-1">Savol yoki muammo bo'lsa — yozing, yordam beramiz</p>
          </div>
        </div>

        {/* Telefon */}
        <div className="mt-4 bg-white/10 border border-white/20 rounded-2xl p-4 flex items-center gap-3">
          <Phone className="h-5 w-5 text-white flex-shrink-0" />
          <div>
            <p className="text-xs text-blue-200 font-semibold">To'g'ridan-to'g'ri qo'ng'iroq:</p>
            <a href="tel:+998902686363" className="text-white font-black text-lg tracking-wide hover:text-blue-200 transition-colors">
              +998 90 268-63-63
            </a>
          </div>
        </div>
      </div>

      {/* Xabar yuborish formi */}
      {!isAuthenticated ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 text-center">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="font-bold text-amber-800">Kirish talab etiladi</p>
          <p className="text-sm text-amber-700 mt-1">Yordam so'rash uchun avval tizimga kiring</p>
          <button
            onClick={() => window.dispatchEvent(new Event('open-login-modal'))}
            className="mt-4 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all"
          >
            Tizimga kirish
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100">
            <h2 className="font-black text-gray-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              Xabar yuborish
            </h2>
            <p className="text-xs text-gray-500 mt-1">Muammo, savol yoki taklifingizni qisqacha yozing</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Foydalanuvchi info */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.ism?.[0]}{user?.familiya?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{user?.ism} {user?.familiya}</p>
                <p className="text-xs text-gray-500">
                  {user?.rol === 'ustoz' ? '👨‍🏫 Ustoz' : '👨‍🎓 O\'quvchi'}
                  {telefon && ` • ${telefon}`}
                </p>
              </div>
              <span className="text-xs text-green-600 font-bold bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Tasdiqlangan</span>
            </div>

            {/* Xabar maydoni */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">Xabaringiz *</label>
              <textarea
                value={xabar}
                onChange={(e) => setXabar(e.target.value)}
                placeholder="Masalan: Test boshlashda xato chiqyapti, nima qilish kerak?&#10;&#10;Yoki: Login ID topilmayapti..."
                rows={5}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-sm text-gray-800 placeholder-gray-400 resize-none leading-relaxed transition-all"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{xabar.length} ta belgi</p>
            </div>

            {/* Rasm qo'shish */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">Skrinshot (ixtiyoriy)</label>
              {rasmPreview ? (
                <div className="relative inline-block">
                  <img
                    src={rasmPreview}
                    alt="Skrinshot"
                    className="max-h-40 rounded-xl border-2 border-blue-200 shadow-sm object-contain"
                  />
                  <button
                    onClick={rasmniOlib}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-sm text-gray-500 hover:text-blue-600 transition-all w-full justify-center"
                >
                  <ImageIcon className="h-4 w-4" />
                  Skrinshot yuklash (JPG, PNG — max 5MB)
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={rasmTanlash}
              />
            </div>

            {/* Yuborish tugmasi */}
            <button
              onClick={yuborish}
              disabled={yuklanyapti || !xabar.trim()}
              className={`w-full h-12 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                yuborildi
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-blue-600/25'
              }`}
            >
              {yuklanyapti ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Yuborilmoqda...</>
              ) : yuborildi ? (
                <><CheckCircle className="h-4 w-4" />Yuborildi! Tez orada javob beramiz</>
              ) : (
                <><Send className="h-4 w-4" />Yordam so'rash</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Xabarlar tarixi */}
      {isAuthenticated && (
        <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-black text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              Mening so'rovlarim
            </h2>
            <button onClick={tarixniYuklash} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
              <RefreshCw className={`h-4 w-4 ${tarixYuklanyapti ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-4">
            {tarixYuklanyapti ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
              </div>
            ) : meningXabarlarim.length === 0 ? (
              <div className="py-10 text-center">
                <MessageCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">Hali so'rov yubormadingiz</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meningXabarlarim.map((x) => (
                  <div key={x.id} className={`rounded-xl border-2 overflow-hidden transition-all ${
                    x.holat === 'javob_berildi' ? 'border-green-200 bg-green-50/30' :
                    x.holat === 'korildi' ? 'border-blue-200 bg-blue-50/20' :
                    'border-gray-200 bg-gray-50/30'
                  }`}>
                    <div className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-relaxed line-clamp-2">{x.xabar}</p>
                        <p className="text-xs text-gray-400 mt-1.5">
                          {new Date(x.created_at).toLocaleString('uz-UZ')}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full border ${holatRang(x.holat)}`}>
                          {holatMatn(x.holat)}
                        </span>
                      </div>
                    </div>

                    {x.rasm_url && (
                      <div className="px-4 pb-3">
                        <a href={x.rasm_url} target="_blank" rel="noopener noreferrer">
                          <img src={x.rasm_url} alt="Skrinshot" className="max-h-32 rounded-xl border border-gray-200 object-contain hover:opacity-80 transition-opacity" />
                        </a>
                      </div>
                    )}

                    {x.admin_javob && (
                      <div className="px-4 pb-4">
                        <div className="bg-white border border-green-200 rounded-xl p-3">
                          <p className="text-xs font-bold text-green-700 mb-1">👨‍💼 Admin javobi:</p>
                          <p className="text-sm text-gray-800 leading-relaxed">{x.admin_javob}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tez ko'mak */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-blue-600" />
          Eng ko'p beriladigan savollar
        </h3>
        <div className="space-y-2">
          {[
            { q: "Login ID va parolni unutib qo'ydim", a: "Kirish sahifasida 'Parolni unutdim' tugmasini bosib, bot orqali tiklashingiz mumkin." },
            { q: "Bot orqali ro'yxatdan o'tolmayapman", a: "Botga /start buyrug'ini yuboring va ko'rsatmalarga amal qiling. Muammo davom etsa — biz bilan bog'laning." },
            { q: "Test boshlashda xato chiqyapti", a: "Ustozdan testni START qilishini so'rang. Kod to'g'ri ekanligini tekshiring." },
            { q: "Ustoz sifatida kirmoqchiman", a: "Bot orqali '/start ustoz' yuboring va ariza topshiring. Admin tasdiqlaydi." },
          ].map((item, i) => (
            <details key={i} className="group bg-white border border-gray-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-gray-50 transition-colors">
                <span className="text-sm font-semibold text-gray-800">{item.q}</span>
                <ChevronRight className="h-4 w-4 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0" />
              </summary>
              <div className="px-4 pb-3 pt-1">
                <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
