import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Send, Loader2, BookOpen, Scale, AlertCircle, RefreshCw, Clock, ChevronDown, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: { qonun_kodi: string; modda_raqami: string; sarlavha: string }[];
  timestamp: number;
  jobId?: string;
}

interface JobState {
  status: 'idle' | 'queued' | 'running' | 'done' | 'failed';
  phase: string | null;
  javob: string | null;
  xato: string | null;
  sources: any[] | null;
  queuePosition: number | null;
}

const SAMPLE_QUESTIONS = [
  {
    title: "Shartnoma buzilishi",
    text: "Tomonlardan biri shartnomani vaqtida bajarmadi. Qanday huquqiy choralar ko'rish mumkin?",
  },
  {
    title: "Mehnat nizolari",
    text: "Ish beruvchi ish haqini o'z vaqtida to'lamayapti. Qanday qonun moddalari tatbiq etiladi?",
  },
  {
    title: "Fuqarolik javobgarlik",
    text: "Notijorat zarar yetkazilgan. Zararni qoplash tartibi qanday?",
  },
];

const PHASE_LABELS: Record<string, string> = {
  qidiryapti: "Moddalar qidirilmoqda...",
  tasdiqlamoqda: "Topilgan moddalar tasdiqlanmoqda...",
  yozmoqda: "Javob yozilmoqda...",
};

const POLL_INTERVAL = 4000;
const MAX_POLL_MS = 600000; // 10 min

export default function FanFasterChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'manbali' | 'lexion'>('manbali');
  const [jobState, setJobState] = useState<JobState>({
    status: 'idle', phase: null, javob: null, xato: null, sources: null, queuePosition: null,
  });
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userId = user?.id || user?.talaba_id || (user?.ism && user?.familiya ? `${user.ism}_${user.familiya}` : 'guest');
  const userRole = user?.rol || 'oquvchi';

  // ── Load conversation history from localStorage ──
  useEffect(() => {
    const saved = localStorage.getItem(`ff_chat_history_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed);
      } catch {}
    }
  }, [userId]);

  // ── Save to localStorage ──
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`ff_chat_history_${userId}`, JSON.stringify(messages.slice(-20)));
    }
  }, [messages, userId]);

  // ── Restore active job on mount ──
  useEffect(() => {
    const restoreJob = async () => {
      const { data } = await supabase
        .from('chat_jobs')
        .select('id, status, phase, javob, xato, sources, model, savol')
        .eq('user_id', String(userId))
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setPendingJobId(data.id);
        setJobState({
          status: data.status as JobState['status'],
          phase: data.phase,
          javob: null,
          xato: null,
          sources: null,
          queuePosition: null,
        });
        // Check if user message already in history
        const hasUserMsg = messages.some(m => m.text === data.savol && m.role === 'user');
        if (!hasUserMsg) {
          setMessages(prev => [...prev, { role: 'user', text: data.savol, timestamp: Date.now(), jobId: data.id }]);
        }
        startPolling(data.id);
      }
    };
    restoreJob();
  }, [userId]);

  // ── Auto-scroll ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, jobState]);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
    }
  }, [input]);

  const startPolling = useCallback((jobId: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollStart.current = Date.now();

    pollTimer.current = setInterval(async () => {
      const elapsed = Date.now() - pollStart.current;
      if (elapsed > MAX_POLL_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setJobState(prev => ({
          ...prev,
          status: 'failed',
          xato: "Javob hali tayyor emas. Keyinroq urinib ko'ring.",
        }));
        return;
      }

      try {
        const { data, error } = await supabase
          .from('chat_jobs')
          .select('id, status, phase, javob, xato, sources')
          .eq('id', jobId)
          .maybeSingle();

        if (error || !data) return;

        if (data.status === 'done') {
          if (pollTimer.current) clearInterval(pollTimer.current);
          const sources = Array.isArray(data.sources) ? data.sources : null;
          setJobState({
            status: 'done',
            phase: null,
            javob: data.javob,
            xato: null,
            sources,
            queuePosition: null,
          });
          // Add assistant message
          setMessages(prev => {
            // Replace placeholder if exists
            const withoutPending = prev.filter(m => m.jobId !== jobId || m.role !== 'assistant');
            return [...withoutPending, {
              role: 'assistant',
              text: data.javob || '',
              sources: sources || undefined,
              timestamp: Date.now(),
              jobId,
            }];
          });
          setPendingJobId(null);
        } else if (data.status === 'failed') {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setJobState({
            status: 'failed',
            phase: null,
            javob: null,
            xato: data.xato || "Javob tayyorlanmadi",
            sources: null,
            queuePosition: null,
          });
          setPendingJobId(null);
        } else {
          // queued or running
          let queuePos: number | null = null;
          if (data.status === 'queued') {
            const { count } = await supabase
              .from('chat_jobs')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'queued')
              .lt('created_at', new Date().toISOString());
            queuePos = count ?? null;
          }
          setJobState(prev => ({
            ...prev,
            status: data.status as JobState['status'],
            phase: data.phase,
            javob: null,
            xato: null,
            sources: null,
            queuePosition: queuePos,
          }));
        }
      } catch {
        // Network error, keep polling
      }
    }, POLL_INTERVAL);
  }, []);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const sendQuestion = async (questionText?: string) => {
    const text = (questionText || input).trim();
    if (!text || jobState.status === 'queued' || jobState.status === 'running') return;

    setInput('');

    // Add user message immediately
    const userMsg: ChatMessage = { role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    setJobState({
      status: 'queued',
      phase: 'qidiryapti',
      javob: null,
      xato: null,
      sources: null,
      queuePosition: null,
    });

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/chat-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          user_id: String(userId),
          user_role: userRole,
          model,
          savol: text,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "So'rov yuborilmadi");
      }

      if (data.already_active && data.id) {
        // Already have active job
        setPendingJobId(data.id);
        startPolling(data.id);
        return;
      }

      if (data.id) {
        setPendingJobId(data.id);
        setJobState(prev => ({ ...prev, queuePosition: data.queue_position ?? null }));
        // Update user message with jobId
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, jobId: data.id } : m
        ));
        startPolling(data.id);
      }
    } catch (err) {
      setJobState({
        status: 'failed',
        phase: null,
        javob: null,
        xato: err instanceof Error ? err.message : "Tarmoq xatosi",
        sources: null,
        queuePosition: null,
      });
    }
  };

  const retry = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove last failed state
      setJobState({
        status: 'idle', phase: null, javob: null, xato: null, sources: null, queuePosition: null,
      });
      sendQuestion(lastUserMsg.text);
    }
  };

  const isBusy = jobState.status === 'queued' || jobState.status === 'running';

  return (
    <div className="flex flex-col h-full max-h-[calc(100dvh-120px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="shrink-0 pt-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-sm shrink-0">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">FanFaster Chat</h2>
            <p className="text-[11px] text-gray-500">Huquqiy savollarga AI tahlil — IRAC usulida</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 px-1">
        {/* Empty state */}
        {messages.length === 0 && !isBusy && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4 shadow-sm">
              <Scale className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Huquqiy savol bering</h3>
            <p className="text-xs text-gray-500 text-center max-w-sm mb-6 leading-relaxed">
              AI kazusingizni qonunlar bazasi yoki lex.uz asosida tahlil qiladi va IRAC usulida javob beradi
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full max-w-2xl">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuestion(q.text)}
                  className="text-left p-3.5 rounded-2xl border border-gray-200/80 bg-white hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                    <span className="text-xs font-bold text-gray-700">{q.title}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{q.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-lg shadow-blue-500/20">
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[88%] w-full">
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <div className="h-0.5 w-4 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-blue-600">FanFaster AI</span>
                  </div>
                  <div className="bg-white shadow-md text-gray-800 rounded-2xl rounded-tl-md px-4 py-3 border border-gray-100/80">
                    <div className="prose prose-sm max-w-none">
                      <MarkdownRender text={msg.text} />
                    </div>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 px-1 space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> Manbalar:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, si) => (
                          <Badge key={si} variant="outline" className="text-[10px] border-blue-200 text-blue-600 bg-blue-50/50">
                            {src.qonun_kodi} {src.modda_raqami}-modda
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading / phase indicator */}
        {isBusy && (
          <div className="flex justify-start">
            <div className="max-w-[88%] w-full">
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <div className="h-0.5 w-4 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-blue-600">FanFaster AI</span>
              </div>
              <div className="bg-white shadow-md rounded-2xl rounded-tl-md px-4 py-4 border border-gray-100/80 space-y-3">
                {/* Queue position */}
                {jobState.status === 'queued' && jobState.queuePosition !== null && jobState.queuePosition > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Navbatdagi o'rningiz: {jobState.queuePosition}</span>
                  </div>
                )}
                {/* Phase indicator */}
                <div className="flex items-center gap-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-700">
                      {jobState.phase ? PHASE_LABELS[jobState.phase] || jobState.phase : "Jarayonda..."}
                    </span>
                    {/* Phase steps */}
                    <div className="flex items-center gap-1 mt-1">
                      {(['qidiryapti', 'tasdiqlamoqda', 'yozmoqda'] as const).map((p, pi) => (
                        <div
                          key={p}
                          className={`h-1 w-8 rounded-full transition-all duration-300 ${
                            jobState.phase === p
                              ? 'bg-blue-500'
                              : jobState.phase && ['qidiryapti', 'tasdiqlamoqda', 'yozmoqda'].indexOf(jobState.phase) > pi
                                ? 'bg-green-400'
                                : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                {/* Wait notice */}
                <div className="rounded-lg bg-blue-50/80 border border-blue-100 px-3 py-2">
                  <p className="text-[10px] text-blue-600 leading-relaxed">
                    Javob o'rtacha 3 daqiqa ichida tayyor bo'ladi. Tizim lex.uz va amaliy qonunchilikni chuqur tahlil qilmoqda.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {jobState.status === 'failed' && jobState.xato && (
          <div className="flex justify-start">
            <div className="max-w-[80%]">
              <div className="bg-red-50 border border-red-200 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-red-600 font-medium">{jobState.xato}</p>
                    <button
                      onClick={retry}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700"
                    >
                      <RefreshCw className="h-3 w-3" /> Qayta urinish
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 pb-2 pt-3">
        {/* Model selector */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] font-bold text-gray-400 shrink-0">Model:</span>
          <button
            onClick={() => setModel('manbali')}
            disabled={isBusy}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
              model === 'manbali'
                ? 'bg-blue-100 text-blue-700 border-blue-200'
                : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'
            } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Manbali (RAG)
          </button>
          <button
            onClick={() => setModel('lexion')}
            disabled={isBusy}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all ${
              model === 'lexion'
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'
            } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Lexion (lex.uz)
          </button>
        </div>

        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuestion();
              }
            }}
            placeholder="Huquqiy savolingizni yozing..."
            className="flex-1 min-h-[44px] max-h-40 resize-none rounded-2xl border-gray-200/80"
            rows={1}
            disabled={isBusy}
          />
          <Button
            onClick={() => sendQuestion()}
            disabled={isBusy || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl shadow-lg shadow-blue-500/20"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter — yuborish · Shift+Enter — yangi qator
        </p>
      </div>
    </div>
  );
}

// ── Simple markdown renderer ─────────────────────────────────────────────────
function MarkdownRender({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-1.5">
              <span className="text-blue-400 shrink-0">•</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h3 key={`h-${i}`} className="text-sm font-bold text-gray-900 mt-3 mb-1.5">
          {renderInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={`h-${i}`} className="text-base font-bold text-gray-900 mt-3 mb-2">
          {renderInline(line.slice(2))}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h4 key={`h-${i}`} className="text-[13px] font-bold text-gray-800 mt-2.5 mb-1">
          {renderInline(line.slice(4))}
        </h4>
      );
    } else if (line.match(/^[-*]\s/)) {
      inList = true;
      listItems.push(line.replace(/^[-*]\s/, ''));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={`p-${i}`} className="text-sm text-gray-700 leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushList();

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
