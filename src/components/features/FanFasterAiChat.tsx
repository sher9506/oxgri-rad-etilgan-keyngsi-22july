import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Loader2, RotateCcw, BookOpen, Zap, ChevronRight,
  BrainCircuit, MessageSquare, Clock, AlertCircle, CheckCircle2,
  History, X, Menu, ScrollText, BookMarked,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: number;
  citationMeta?: CitationMeta[] | null;
  rejim?: string;
  error?: boolean;
}

interface CitationMeta {
  ref: number;
  material_id: string;
  bolim_id: string;
  bob_id: string;
  bolim_nomi: string;
  bob_nomi: string;
  material_nomi: string;
}

interface SessionRow {
  id: string;
  rejim: string;
  messages: ChatMessage[];
  savol_soni: number;
  sarflangan_vaqt_sekund: number;
  created_at: string;
}

type Rejim = 'lexion' | 'manba';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatPlainText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^### (.+)$/gm, '<p class="text-xs font-bold text-blue-700 uppercase tracking-wider mt-2 mb-1">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="text-sm font-bold text-gray-800 mt-2 mb-1">$1</p>')
    .replace(/(<li>.*?<\/li>\n?)+/gs, m => `<ul class="list-disc pl-4 space-y-0.5 my-1">${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(?<!>)\n(?!<)/g, '<br/>');
}

function renderWithCitations(html: string, citationMeta?: CitationMeta[] | null): string {
  if (!citationMeta || citationMeta.length === 0) return html;
  return html.replace(/\[([0-9]+)\]/g, (match, num) => {
    const n = parseInt(num);
    if (n === 0) return `<span class="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-200 text-gray-500 border border-gray-300">[0]</span>`;
    const meta = citationMeta.find(c => c.ref === n);
    if (!meta) return match;
    return `<span class="citation-ref inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-700 border border-blue-300 cursor-pointer hover:bg-blue-200 transition-all" title="${meta.bolim_nomi} > ${meta.bob_nomi}">[${n}]</span>`;
  });
}

function formatVaqt(sekund: number): string {
  if (sekund < 60) return `${sekund}s`;
  const m = Math.floor(sekund / 60);
  const s = sekund % 60;
  return `${m}m ${s}s`;
}

// ── Tezkor savollar ───────────────────────────────────────────────────────────
const TEZKOR_SAVOLLAR_OQUVCHI = [
  { label: 'Jinoyat kodeksi 158-modda', text: 'JK 158-moddasini tushuntirib bering' },
  { label: 'Shartnoma turlari', text: 'O\'zbekiston qonunchiligida shartnoma turlari qanday?' },
  { label: 'Sud tartibi', text: 'Fuqarolik sud tartibida da\'vo arizasi qanday topshiriladi?' },
  { label: 'Advokat vazifalari', text: 'Advokatning huquq va vazifalari qanday?' },
];

const TEZKOR_SAVOLLAR_USTOZ = [
  { label: 'JK 158-modda tahlili', text: 'JK 158-modda (firibgarlik) tahlilini batafsil yozing' },
  { label: 'Shartnoma huquqi', text: 'Shartnoma huquqi asoslari va turlari haqida xulosa bering' },
  { label: 'Sud ish yuritish', text: 'Fuqarolik va jinoyat sud ish yuritishidagi asosiy farqlar nimalardan iborat?' },
  { label: 'Protsessual kodeks', text: 'JPK ning asosiy prinsiplari qanday?' },
];

// ── Main Component ────────────────────────────────────────────────────────────
interface FanFasterAiChatProps {
  onNavigate?: (tab: string, extra?: { materialId?: string }) => void;
}

export default function FanFasterAiChat({ onNavigate }: FanFasterAiChatProps) {
  const { user, isAuthenticated } = useAuth();
  const [rejim, setRejim] = useState<Rejim>('lexion');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [totalSavol, setTotalSavol] = useState(0);
  const [totalVaqt, setTotalVaqt] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isUstoz = user?.rol === 'ustoz';
  const userLogin = user?.login || '';
  const userIsm = user ? `${user.ism} ${user.familiya}` : '';

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load session history ─────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!userLogin) return;
    try {
      const { data } = await supabase
        .from('fanfaster_ai_sessions')
        .select('*')
        .eq('user_login', userLogin)
        .order('updated_at', { ascending: false })
        .limit(20);
      if (data) {
        setSessions(data as SessionRow[]);
        const tSavol = (data as SessionRow[]).reduce((s, r) => s + (r.savol_soni || 0), 0);
        const tVaqt = (data as SessionRow[]).reduce((s, r) => s + (r.sarflangan_vaqt_sekund || 0), 0);
        setTotalSavol(tSavol);
        setTotalVaqt(tVaqt);
      }
    } catch (e) {
      console.warn('[FanFasterAiChat] sessiya tarixi xatosi:', e);
    }
  }, [userLogin]);

  useEffect(() => {
    if (isAuthenticated && userLogin) loadSessions();
  }, [isAuthenticated, userLogin, loadSessions]);

  // ── Create new session ───────────────────────────────────────────────────
  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    try {
      const { data, error } = await supabase
        .from('fanfaster_ai_sessions')
        .insert({
          user_login: userLogin || 'anonim',
          user_ism: userIsm,
          user_rol: user?.rol || 'oquvchi',
          rejim,
          messages: [],
          savol_soni: 0,
          sarflangan_vaqt_sekund: 0,
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw error;
      setSessionId(data.id);
      return data.id;
    } catch (e) {
      console.warn('[FanFasterAiChat] sessiya yaratish xatosi:', e);
      return '';
    }
  };

  // ── Rejim o'zgarganda yangi sessiya ──────────────────────────────────────
  const handleRejimChange = (newRejim: Rejim) => {
    if (newRejim === rejim) return;
    setRejim(newRejim);
    setMessages([]);
    setSessionId(null);
  };

  // ── Xabar yuborish ───────────────────────────────────────────────────────
  const xabarYuborish = async (matn?: string) => {
    const trimmed = (matn || input).trim();
    if (!trimmed || yuklanyapti) return;

    const userMsg: ChatMessage = { role: 'user', text: trimmed, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setYuklanyapti(true);

    try {
      const sId = await ensureSession();
      const contextMessages = updatedMessages.slice(-12).map(m => ({ role: m.role, text: m.text }));

      const { data, error } = await supabase.functions.invoke('fanfaster-ai-chat', {
        body: {
          messages: contextMessages,
          rejim,
          userLogin: userLogin || 'anonim',
          userIsm,
          userRol: user?.rol || 'oquvchi',
          sessionId: sId,
        },
      });

      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const t = await error.context?.text?.();
            if (t) { try { errMsg = JSON.parse(t).error || t; } catch { errMsg = t; } }
          } catch {}
        }
        setMessages(prev => [...prev, {
          role: 'assistant', text: `Xatolik: ${errMsg}`, timestamp: Date.now(), error: true,
        }]);
        return;
      }

      if (data?.reply) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: data.reply,
          timestamp: Date.now(),
          citationMeta: data.citationMeta || null,
          rejim: data.rejim || rejim,
          error: data.error || false,
        }]);
        // Statistikani yangilash
        if (sId) {
          await loadSessions();
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'AI yordamchi vaqtincha mavjud emas. Iltimos, keyinroq urinib ko\'ring.',
        timestamp: Date.now(),
        error: true,
      }]);
    } finally {
      setYuklanyapti(false);
    }
  };

  // ── Eski sessiyani yuklash ───────────────────────────────────────────────
  const loadOldSession = (sess: SessionRow) => {
    setMessages(sess.messages || []);
    setRejim((sess.rejim || 'lexion') as Rejim);
    setSessionId(sess.id);
    setShowHistory(false);
  };

  // ── Chatni tozalash ──────────────────────────────────────────────────────
  const chatniTozalash = () => {
    setMessages([]);
    setSessionId(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Citation click ───────────────────────────────────────────────────────
  const handleCitationClick = (e: React.MouseEvent, citationMeta?: CitationMeta[] | null) => {
    if (!citationMeta) return;
    const target = (e.target as HTMLElement).closest('[data-citation]');
    if (!target) return;
    // For rendered HTML citations, we handle via title attribute
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
          <BrainCircuit className="h-8 w-8 text-blue-600" />
        </div>
        <p className="font-bold text-gray-800 text-lg">FanFaster AI Chat</p>
        <p className="text-sm text-gray-500 max-w-xs">AI yordamchidan foydalanish uchun tizimga kiring.</p>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all"
        >
          Kirish
        </button>
      </div>
    );
  }

  const tezkorSavollar = isUstoz ? TEZKOR_SAVOLLAR_USTOZ : TEZKOR_SAVOLLAR_OQUVCHI;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-md">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <BrainCircuit className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">FanFaster AI Chat</p>
          <p className="text-blue-200 text-[10px] leading-tight">
            {totalSavol > 0 ? `${totalSavol} savol · ${formatVaqt(totalVaqt)}` : 'Huquqiy AI yordamchi'}
          </p>
        </div>
        <button
          onClick={() => setShowHistory(v => !v)}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          title="Tarix"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          onClick={chatniTozalash}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          title="Yangi chat"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Rejim toggle ─────────────────────────────────────────────────── */}
      <div className="flex bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => handleRejimChange('lexion')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            rejim === 'lexion'
              ? 'border-blue-500 text-blue-700 bg-blue-50'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Lexion</span>
          <span className="text-[9px] text-gray-400 font-normal hidden sm:inline">to'g'ridan-to'g'ri</span>
        </button>
        <button
          onClick={() => handleRejimChange('manba')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            rejim === 'manba'
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Manba</span>
          <span className="text-[9px] text-gray-400 font-normal hidden sm:inline">darslikdan</span>
        </button>
      </div>

      {/* ── Rejim info banner ────────────────────────────────────────────── */}
      {messages.length === 0 && (
        <div className={`px-4 py-2 text-[10px] font-medium flex-shrink-0 ${
          rejim === 'lexion' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {rejim === 'lexion'
            ? 'Lexion rejimi — AI to\'g\'ridan-to\'g\'ri bilimidan javob beradi. Tez va qisqa javoblar uchun ideal.'
            : 'Manba rejimi — AI faqat darslik materiallardan javob beradi. Har bir javob manba bilan tasdiqlanadi [N].'}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ── History panel ─────────────────────────────────────────────── */}
        {showHistory && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">Tarix</p>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6 px-3">Hali suhbat tarixi yo'q</p>
              ) : (
                sessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadOldSession(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        s.rejim === 'manba' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>{s.rejim || 'lexion'}</span>
                      <span className="text-[9px] text-gray-400">{s.savol_soni || 0} savol</span>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">
                      {s.messages?.[0]?.text?.slice(0, 40) || 'Bo\'sh suhbat'}
                    </p>
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      {new Date(s.created_at).toLocaleDateString('uz-UZ')}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Chat area ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && !yuklanyapti && (
              <div className="space-y-2 pt-4">
                <div className={`rounded-2xl p-4 text-center ${
                  rejim === 'lexion' ? 'bg-blue-50 border border-blue-200' : 'bg-emerald-50 border border-emerald-200'
                }`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2 ${
                    rejim === 'lexion' ? 'bg-blue-100' : 'bg-emerald-100'
                  }`}>
                    {rejim === 'lexion' ? <Zap className="h-6 w-6 text-blue-600" /> : <BookOpen className="h-6 w-6 text-emerald-600" />}
                  </div>
                  <p className={`font-bold text-sm mb-1 ${rejim === 'lexion' ? 'text-blue-800' : 'text-emerald-800'}`}>
                    Salom{user?.ism ? `, ${user.ism}` : ''}!
                  </p>
                  <p className={`text-xs ${rejim === 'lexion' ? 'text-blue-600' : 'text-emerald-600'}`}>
                    {rejim === 'lexion'
                      ? 'Huquqiy savollaringizga to\'g\'ridan-to\'g\'ri javob beraman.'
                      : 'Darslik materiallardan manbali javob beraman.'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {tezkorSavollar.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => xabarYuborish(s.text)}
                      disabled={yuklanyapti}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl text-left transition-all group disabled:opacity-50"
                    >
                      <span className="text-xs text-gray-700 group-hover:text-blue-700 font-medium">{s.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 mr-2 ${
                    msg.error ? 'bg-red-100' : rejim === 'manba' ? 'bg-emerald-600' : 'bg-blue-600'
                  }`}>
                    {msg.error ? <AlertCircle className="h-4 w-4 text-red-600" /> : <BrainCircuit className="h-4 w-4 text-white" />}
                  </div>
                )}
                <div className={`max-w-[80%] ${
                  msg.role === 'user'
                    ? 'px-3 py-2.5 rounded-2xl rounded-tr-sm bg-blue-600 text-white text-sm leading-relaxed'
                    : 'w-full'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className={`bg-white shadow-sm border rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm leading-relaxed ${
                      msg.error ? 'border-red-100' : 'border-gray-100'
                    }`}>
                      <div
                        className="prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: renderWithCitations(
                            formatPlainText(msg.text),
                            msg.citationMeta
                          ),
                        }}
                        onClick={(e) => {
                          const target = (e.target as HTMLElement).closest('.citation-ref');
                          if (target && msg.citationMeta) {
                            // Extract ref number from title or content
                            const text = target.textContent || '';
                            const match = text.match(/\[(\d+)\]/);
                            if (match) {
                              const n = parseInt(match[1]);
                              const meta = msg.citationMeta.find(c => c.ref === n);
                              if (meta) onNavigate?.('oqmatlar', { materialId: meta.material_id });
                            }
                          }
                        }}
                      />
                      {msg.citationMeta && msg.citationMeta.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Manbalar:</p>
                          {msg.citationMeta.map(c => (
                            <button
                              key={c.ref}
                              onClick={() => onNavigate?.('oqmatlar', { materialId: c.material_id })}
                              className="flex items-center gap-1.5 text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              <span className="font-bold">[{c.ref}]</span>
                              <span className="truncate">{c.bolim_nomi} {'>'} {c.bob_nomi} {'>'} {c.material_nomi}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {yuklanyapti && (
              <div className="flex justify-start">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 mr-2 ${
                  rejim === 'manba' ? 'bg-emerald-600' : 'bg-blue-600'
                }`}>
                  <BrainCircuit className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Input area ──────────────────────────────────────────────── */}
          <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-end gap-2 bg-gray-50 border-2 border-gray-200 focus-within:border-blue-400 rounded-xl transition-all px-3 py-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    xabarYuborish();
                  }
                }}
                placeholder={rejim === 'manba'
                  ? 'Darslikdan qidirmoqchi bo\'lgan savolingiz...'
                  : 'Huquqiy savolingizni yozing...'
                }
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400 py-1 resize-none max-h-24"
                disabled={yuklanyapti}
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={() => xabarYuborish()}
                disabled={!input.trim() || yuklanyapti}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 flex-shrink-0 ${
                  rejim === 'manba'
                    ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300'
                } text-white`}
              >
                {yuklanyapti ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[9px] text-gray-400 text-center mt-1.5">
              FanFaster AI · {rejim === 'lexion' ? 'Lexion rejimi' : 'Manba rejimi'} · Enter — yuborish
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
