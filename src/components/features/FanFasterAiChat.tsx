import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Loader2, RotateCcw, BookOpen, Zap, ChevronRight,
  BrainCircuit, History, X, AlertCircle, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useFanFasterChatJob } from '@/hooks/useFanFasterChatJob';
import type { ChatRejim, ChatSourceItem } from '@/hooks/useFanFasterChatJob';
import { ChatSourcesBlock } from '@/components/features/ChatSourcesBlock';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: number;
  rejim?: string;
  error?: boolean;
}

interface SessionRow {
  id: string;
  rejim: string;
  messages: ChatMessage[];
  savol_soni: number;
  sarflangan_vaqt_sekund: number;
  created_at: string;
}

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

function formatVaqt(sekund: number): string {
  if (sekund < 60) return `${sekund}s`;
  const m = Math.floor(sekund / 60);
  const s = sekund % 60;
  return `${m}m ${s}s`;
}

const TEZKOR_SAVOLLAR = [
  { label: 'Jinoyat kodeksi 158-modda', text: 'JK 158-moddasini tushuntirib bering' },
  { label: 'Shartnoma turlari', text: 'O\'zbekiston qonunchiligida shartnoma turlari qanday?' },
  { label: 'Sud tartibi', text: 'Fuqarolik sud tartibida da\'vo arizasi qanday topshiriladi?' },
  { label: 'Advokat vazifalari', text: 'Advokatning huquq va vazifalari qanday?' },
];

function getElapsedText(ms: number): string {
  const sekund = Math.floor(ms / 1000);
  if (sekund < 60) return `${sekund} soniya`;
  const m = Math.floor(sekund / 60);
  const s = sekund % 60;
  return `${m} daqiqa ${s} soniya`;
}

function getLoadingText(rejim: ChatRejim, lexionPhase?: string | null, status?: string): string {
  if (status === 'queued') return 'Navbatda, tez orada boshlanadi';
  if (rejim === 'lexion') {
    if (lexionPhase === 'lexion_searching') return 'Qonun hujjatlari lex.uz saytidan qidirilmoqda...';
    if (lexionPhase === 'answering') return 'Chuqur tahlil (lex.uz, amaliy qonunchilik) tufayli javob biroz kutiladi';
    return 'Chuqur tahlil (lex.uz, amaliy qonunchilik) tufayli javob biroz kutiladi';
  }
  return 'Chuqur tahlil tufayli javob biroz kutiladi';
}

interface FanFasterAiChatProps {
  onNavigate?: (tab: string, extra?: { materialId?: string }) => void;
}

export default function FanFasterAiChat(_props: FanFasterAiChatProps) {
  const { user, isAuthenticated } = useAuth();
  const [rejim, setRejim] = useState<ChatRejim>('lexion');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [totalSavol, setTotalSavol] = useState(0);
  const [totalVaqt, setTotalVaqt] = useState(0);
  const [sources, setSources] = useState<ChatSourceItem[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  const { jobState, submitChat, reset: resetJob } = useFanFasterChatJob();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<number>(0);
  const lastHandledJobRef = useRef<string | null>(null);

  const userLogin = user?.login || '';
  const userIsm = user ? `${user.ism} ${user.familiya}` : '';

  const isBusy = jobState.status === 'queued' || jobState.status === 'running';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, jobState.status]);

  // ── Elapsed timer ──
  useEffect(() => {
    if (!isBusy) {
      setElapsedMs(0);
      return;
    }
    if (startTimeRef.current === 0) startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [isBusy]);

  // ── Handle job completion ──
  useEffect(() => {
    if (jobState.jobId && jobState.jobId !== lastHandledJobRef.current) {
      if (jobState.status === 'done' && jobState.answer) {
        lastHandledJobRef.current = jobState.jobId;
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          text: jobState.answer,
          timestamp: Date.now(),
          rejim,
          error: false,
        };
        setMessages(prev => [...prev, assistantMsg]);
        saveToSession(jobState.answer, false);
        startTimeRef.current = 0;
      } else if ((jobState.status === 'error' || jobState.status === 'timeout') && jobState.error) {
        lastHandledJobRef.current = jobState.jobId;
        const errorMsg: ChatMessage = {
          role: 'assistant',
          text: jobState.error,
          timestamp: Date.now(),
          error: true,
        };
        setMessages(prev => [...prev, errorMsg]);
        saveToSession(jobState.error, true);
        startTimeRef.current = 0;
      }
    }
  }, [jobState.jobId, jobState.status, jobState.answer, jobState.error, rejim]);

  const saveToSession = useCallback(async (aiText: string, isError: boolean) => {
    if (!sessionId) return;
    const elapsedSec = Math.round((Date.now() - (startTimeRef.current || Date.now())) / 1000);
    const allMessages = [...messages, { role: 'assistant' as const, text: aiText, error: isError }];
    const savolSoni = allMessages.filter(m => m.role === 'user').length;
    try {
      await supabase
        .from('fanfaster_ai_sessions')
        .update({
          messages: JSON.stringify(allMessages),
          savol_soni: savolSoni,
          sarflangan_vaqt_sekund: elapsedSec,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      await loadSessions();
    } catch (e) {
      console.warn('[FanFasterAiChat] sessiya yangilash xatosi:', e);
    }
  }, [sessionId, messages]);

  // ── Load session history ──
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

  const handleRejimChange = (newRejim: ChatRejim) => {
    if (newRejim === rejim || isBusy) return;
    setRejim(newRejim);
    setMessages([]);
    setSessionId(null);
    setSources([]);
  };

  const xabarYuborish = async (matn?: string) => {
    const trimmed = (matn || input).trim();
    if (!trimmed || isBusy) return;

    const userMsg: ChatMessage = { role: 'user', text: trimmed, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    lastHandledJobRef.current = null;
    startTimeRef.current = Date.now();

    const sId = await ensureSession();
    await submitChat(trimmed, userLogin || 'anonim', rejim, sId, rejim === 'manba' ? sources : undefined);
  };

  const retryLastQuestion = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user' && !m.error);
    if (!lastUserMsg) return;
    // Remove last assistant error message
    setMessages(prev => {
      const filtered = [...prev];
      while (filtered.length > 0 && filtered[filtered.length - 1].role === 'assistant') {
        filtered.pop();
      }
      return filtered;
    });
    lastHandledJobRef.current = null;
    startTimeRef.current = Date.now();
    void submitChat(lastUserMsg.text, userLogin || 'anonim', rejim, sessionId || undefined, rejim === 'manba' ? sources : undefined);
  };

  const loadOldSession = (sess: SessionRow) => {
    setMessages(sess.messages || []);
    setRejim((sess.rejim || 'lexion') as ChatRejim);
    setSessionId(sess.id);
    setShowHistory(false);
  };

  const chatniTozalash = () => {
    setMessages([]);
    setSessionId(null);
    setSources([]);
    resetJob();
    startTimeRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleAddSource = (src: ChatSourceItem) => setSources(prev => [...prev, src]);
  const handleRemoveSource = (index: number) => setSources(prev => prev.filter((_, i) => i !== index));

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

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
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
          aria-label="Tarix"
        >
          <History className="h-4 w-4" />
        </button>
        <button
          onClick={chatniTozalash}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          title="Yangi chat"
          aria-label="Yangi chat"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showHistory && (
          <div className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700">Tarix</p>
              <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-100 rounded" aria-label="Yopish">
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

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && !isBusy && (
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
                      : 'Qo\'shgan manbalaringizdan foydalanib javob beraman.'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {TEZKOR_SAVOLLAR.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => xabarYuborish(s.text)}
                      disabled={isBusy}
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
                        dangerouslySetInnerHTML={{ __html: formatPlainText(msg.text) }}
                      />
                      {msg.error && (
                        <button
                          onClick={retryLastQuestion}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" /> Qayta urinish
                        </button>
                      )}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}

            {isBusy && (
              <div className="flex justify-start">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 mr-2 ${
                  rejim === 'manba' ? 'bg-emerald-600' : 'bg-blue-600'
                }`}>
                  <BrainCircuit className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    {elapsedMs > 0 && (
                      <span className="text-[10px] text-gray-400 ml-1 inline-flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {getElapsedText(elapsedMs)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {getLoadingText(rejim, jobState.lexionPhase, jobState.status)}
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0 space-y-2">
            {rejim === 'manba' && (
              <ChatSourcesBlock sources={sources} onAdd={handleAddSource} onRemove={handleRemoveSource} />
            )}

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleRejimChange('lexion')}
                disabled={isBusy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-50 ${
                  rejim === 'lexion'
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Zap className="h-3 w-3" />
                <span>Lexion</span>
              </button>
              <button
                onClick={() => handleRejimChange('manba')}
                disabled={isBusy}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-50 ${
                  rejim === 'manba'
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                }`}
              >
                <BookOpen className="h-3 w-3" />
                <span>Manbali</span>
              </button>
            </div>

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
                  ? 'Savolingizni yozing (manbalardan javob beriladi)...'
                  : 'Huquqiy savolingizni yozing...'
                }
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400 py-1 resize-none max-h-24"
                disabled={isBusy}
                style={{ minHeight: '24px' }}
                aria-label="Savol matni"
              />
              <button
                onClick={() => xabarYuborish()}
                disabled={!input.trim() || isBusy}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 flex-shrink-0 ${
                  rejim === 'manba'
                    ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300'
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300'
                } text-white`}
                aria-label="Yuborish"
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[9px] text-gray-400 text-center">
              FanFaster AI xato qilishi mumkin, qayta tekshiring · Enter — yuborish
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
