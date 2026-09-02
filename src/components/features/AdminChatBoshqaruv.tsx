import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Trash2, Search, Eye, Users, Hash,
  ChevronRight, AlertCircle, Loader2, X, RefreshCw,
  UserIcon, FileText, Image
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Chat {
  id: string;
  tur: 'guruh' | 'shaxsiy';
  nomi: string | null;
  yaratuvchi_tur: string;
  qoshish_ruxsat: boolean;
  created_at: string;
  azo_soni?: number;
  habar_soni?: number;
}

interface Habar {
  id: string;
  chat_id: string;
  yuboruvchi_id: string;
  yuboruvchi_ism: string;
  yuboruvchi_tur: string;
  matn: string | null;
  fayl_url: string | null;
  fayl_tur: string | null;
  fayl_nom: string | null;
  ochirilgan: boolean;
  created_at: string;
}

function vaqtFormat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('uz', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminChatBoshqaruv() {
  const { toast } = useToast();
  const [chatlar, setChatlar] = useState<Chat[]>([]);
  const [tanlanganChat, setTanlanganChat] = useState<Chat | null>(null);
  const [habarlar, setHabarlar] = useState<Habar[]>([]);
  const [qidiruv, setQidiruv] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [habarYuklanyapti, setHabarYuklanyapti] = useState(false);
  const [confirmOchirish, setConfirmOchirish] = useState<string | null>(null);

  const chatlarniYuklash = useCallback(async () => {
    setYuklanyapti(true);
    try {
      const { data: chatData } = await supabase.from('chatlar').select('*').order('created_at', { ascending: false });
      if (!chatData) return;

      const chatIds = chatData.map(c => c.id);

      const [azoRes, habarRes] = await Promise.all([
        supabase.from('chat_azolar').select('chat_id').in('chat_id', chatIds),
        supabase.from('chat_habarlar').select('chat_id').in('chat_id', chatIds).eq('ochirilgan', false),
      ]);

      const azoMap = new Map<string, number>();
      (azoRes.data || []).forEach(a => azoMap.set(a.chat_id, (azoMap.get(a.chat_id) || 0) + 1));

      const habarMap = new Map<string, number>();
      (habarRes.data || []).forEach(h => habarMap.set(h.chat_id, (habarMap.get(h.chat_id) || 0) + 1));

      setChatlar(chatData.map(c => ({
        ...c,
        azo_soni: azoMap.get(c.id) || 0,
        habar_soni: habarMap.get(c.id) || 0,
      })));
    } catch (e) {
      console.error('Chatlar yuklash xato:', e);
    } finally {
      setYuklanyapti(false);
    }
  }, []);

  const habarlarniYuklash = useCallback(async (chatId: string) => {
    setHabarYuklanyapti(true);
    try {
      const { data } = await supabase.from('chat_habarlar').select('*')
        .eq('chat_id', chatId).order('created_at', { ascending: false }).limit(100);
      setHabarlar(data || []);
    } finally {
      setHabarYuklanyapti(false);
    }
  }, []);

  useEffect(() => { chatlarniYuklash(); }, [chatlarniYuklash]);

  useEffect(() => {
    if (tanlanganChat) habarlarniYuklash(tanlanganChat.id);
  }, [tanlanganChat]);

  const chatOchirish = async (chatId: string) => {
    try {
      await supabase.from('chatlar').delete().eq('id', chatId);
      if (tanlanganChat?.id === chatId) setTanlanganChat(null);
      toast({ title: '✅ Guruh o\'chirildi' });
      chatlarniYuklash();
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message, variant: 'destructive' });
    }
    setConfirmOchirish(null);
  };

  const habarOchirish = async (habarId: string) => {
    await supabase.from('chat_habarlar').update({ ochirilgan: true }).eq('id', habarId);
    habarlarniYuklash(tanlanganChat!.id);
    chatlarniYuklash();
    toast({ title: 'Habar o\'chirildi' });
  };

  const filtred = qidiruv
    ? chatlar.filter(c => c.nomi?.toLowerCase().includes(qidiruv.toLowerCase()))
    : chatlar;

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div className="bg-gradient-to-r from-[#1a1a1a] to-[#2a2a2a] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/20 border border-violet-500/30 rounded-xl">
            <MessageCircle className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Chat boshqaruvi</h2>
            <p className="text-gray-500 text-xs mt-0.5">Barcha chatlar va habarlarni nazorat qiling</p>
          </div>
        </div>
        <button onClick={chatlarniYuklash} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all">
          <RefreshCw className={`h-4 w-4 text-gray-400 ${yuklanyapti ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Jami chatlar', val: chatlar.length, icon: MessageCircle, color: 'violet' },
          { label: 'Guruhlar', val: chatlar.filter(c => c.tur === 'guruh').length, icon: Hash, color: 'blue' },
          { label: 'Shaxsiy', val: chatlar.filter(c => c.tur === 'shaxsiy').length, icon: UserIcon, color: 'cyan' },
        ].map(s => (
          <div key={s.label} className="bg-[#111] border border-white/10 rounded-xl p-4 text-center">
            <p className={`text-2xl font-black text-${s.color}-400`}>{s.val}</p>
            <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chatlar ro'yhati */}
        <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
              <input value={qidiruv} onChange={e => setQidiruv(e.target.value)}
                placeholder="Chatlarni qidirish..."
                className="w-full bg-[#1a1a1a] border border-white/10 text-white placeholder-gray-700 pl-9 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            {yuklanyapti ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 text-violet-500 animate-spin" />
              </div>
            ) : filtred.map(chat => {
              const aktiv = tanlanganChat?.id === chat.id;
              return (
                <div key={chat.id}
                  className={`flex items-center gap-3 px-4 py-3.5 border-b border-white/5 transition-all ${aktiv ? 'bg-violet-600/20' : 'hover:bg-white/5'}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: chat.tur === 'guruh' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'linear-gradient(135deg, #0891b2, #0e7490)' }}>
                    {chat.tur === 'guruh' ? <Hash className="h-4 w-4 text-white" /> : <UserIcon className="h-4 w-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-semibold truncate">{chat.nomi}</p>
                    <p className="text-[10px] text-gray-600">
                      {chat.tur === 'guruh' ? 'Guruh' : 'Shaxsiy'} • {chat.azo_soni} a'zo • {chat.habar_soni} habar
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setTanlanganChat(chat)}
                      className="p-1.5 bg-white/5 hover:bg-blue-500/20 border border-white/10 rounded-lg transition-all" title="Ko'rish">
                      <Eye className="h-3.5 w-3.5 text-blue-400" />
                    </button>
                    <button onClick={() => setConfirmOchirish(chat.id)}
                      className="p-1.5 bg-white/5 hover:bg-red-500/20 border border-white/10 rounded-lg transition-all" title="O'chirish">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Habarlar */}
        <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden">
          {!tanlanganChat ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
              <Eye className="h-10 w-10 text-gray-800 mb-3" />
              <p className="text-gray-600 text-sm">Chatni tanlang</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-600/50 flex items-center justify-center">
                    <Hash className="h-3.5 w-3.5 text-violet-300" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-semibold">{tanlanganChat.nomi}</p>
                    <p className="text-[9px] text-gray-600">Habarlar tarixi</p>
                  </div>
                </div>
                <button onClick={() => setTanlanganChat(null)} className="text-gray-600 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[440px] p-3 space-y-2">
                {habarYuklanyapti ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />
                  </div>
                ) : habarlar.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 text-sm">Habar yo'q</p>
                  </div>
                ) : habarlar.map(h => (
                  <div key={h.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${h.ochirilgan ? 'bg-red-900/10 border-red-900/20 opacity-60' : 'bg-[#1a1a1a] border-white/5 hover:border-white/10'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${
                      h.yuboruvchi_tur === 'admin' ? 'bg-red-600' :
                      h.yuboruvchi_tur === 'ustoz' ? 'bg-amber-600' : 'bg-violet-600'
                    }`}>
                      {h.yuboruvchi_ism.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-white truncate">{h.yuboruvchi_ism}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          h.yuboruvchi_tur === 'admin' ? 'bg-red-900/50 text-red-400' :
                          h.yuboruvchi_tur === 'ustoz' ? 'bg-amber-900/50 text-amber-400' : 'bg-violet-900/50 text-violet-400'
                        }`}>{h.yuboruvchi_tur}</span>
                        <span className="text-[9px] text-gray-700 ml-auto flex-shrink-0">{vaqtFormat(h.created_at)}</span>
                      </div>
                      {h.ochirilgan ? (
                        <p className="text-xs text-gray-600 italic">O'chirilgan habar</p>
                      ) : (
                        <>
                          {h.matn && <p className="text-xs text-gray-400 break-words line-clamp-3">{h.matn}</p>}
                          {h.fayl_url && (
                            <div className="flex items-center gap-1.5 mt-1">
                              {h.fayl_tur === 'rasm' ? <Image className="h-3 w-3 text-emerald-400" /> : <FileText className="h-3 w-3 text-blue-400" />}
                              <a href={h.fayl_url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-400 hover:underline truncate">{h.fayl_nom}</a>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {!h.ochirilgan && (
                      <button onClick={() => habarOchirish(h.id)}
                        className="flex-shrink-0 p-1.5 hover:bg-red-500/20 rounded-lg transition-all" title="O'chirish">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tasdiqlash dialog */}
      {confirmOchirish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-red-900/50 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/20 rounded-xl">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">Guruhni o'chirish</h3>
                <p className="text-gray-500 text-xs mt-0.5">Bu amalni bekor qilib bo'lmaydi</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-5">
              "{chatlar.find(c => c.id === confirmOchirish)?.nomi}" guruhini va barcha habarlarni o'chirishni tasdiqlaysizmi?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmOchirish(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 text-sm font-semibold transition-all">
                Bekor
              </button>
              <button onClick={() => chatOchirish(confirmOchirish)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" />O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
