// LexionChatPanel — mehmon foydalanuvchilar uchun Lexion AI chat oynasi
// LexionAI robotchasi bosilganda ochiladi
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2, Sparkles } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const SESSION_KEY = 'lexion:chat:session';
const MAX_INPUT = 1000;

function getOrCreateSession(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `lex_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  text: 'Salom! Men Lexion — FanFaster yordamchisiman. O\'zbekiston huquqi bo\'yicha savollaringizni bering, qisqa javob beraman.',
};

export function LexionChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>(getOrCreateSession());

  // Avvalgi xabarlarni yuklash
  useEffect(() => {
    if (!open) return;
    const sessionId = sessionIdRef.current;
    supabase
      .from('lexion_chat_messages')
      .select('role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages([
            WELCOME,
            ...data.map((d: any) => ({ role: d.role as 'user' | 'assistant', text: d.content })),
          ]);
        }
      });
  }, [open]);

  // Pastga aylantirish
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Fokus
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // ESC bilan yopish
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    const userMsg: ChatMessage = { role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/lexion-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, text: m.text })),
          sessionId: sessionIdRef.current,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server xatosi (${res.status})`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (!data.reply) {
        throw new Error('Bo\'sh javob');
      }

      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err: any) {
      const errMsg = err?.message || 'Noma\'lum xato';
      setError(errMsg.slice(0, 200));
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Kechirasiz, javob bera olmadim. Birozdan keyin qayta urinib ko\'ring.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999] bg-black/20 lg:bg-transparent"
        onClick={onClose}
        style={{ animation: 'lexion-fade-in 200ms ease' }}
      />

      {/* Chat panel */}
      <div
        className="fixed z-[1001] flex flex-col"
        style={{
          right: '14px',
          bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))',
          width: 'min(380px, calc(100vw - 28px))',
          height: 'min(520px, calc(100vh - 160px))',
          borderRadius: '20px',
          background: 'linear-gradient(180deg, #0d1b42 0%, #14306c 100%)',
          boxShadow: '0 20px 60px -12px rgba(8, 20, 60, 0.5), 0 0 0 1px rgba(141, 183, 255, 0.15)',
          overflow: 'hidden',
          animation: 'lexion-panel-in 300ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--gold, #c89a3b), #8a6a1e)' }}
            >
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Lexion AI</p>
              <p className="text-[10px] text-blue-200/60 mt-0.5 leading-none">Huquq yordamchisi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-200/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[85%] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #2563eb, #1e40af)'
                    : 'rgba(255, 255, 255, 0.08)',
                  color: msg.role === 'user' ? '#fff' : 'rgba(255, 255, 255, 0.9)',
                  border: msg.role === 'assistant' ? '1px solid rgba(141, 183, 255, 0.12)' : 'none',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="px-3 py-2.5 rounded-2xl flex items-center gap-2"
                style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(141, 183, 255, 0.12)' }}
              >
                <Loader2 className="h-3.5 w-3.5 text-blue-300 animate-spin" />
                <span className="text-xs text-blue-200/70">Lexion yozmoqda...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={handleKeyDown}
              placeholder="Savolingizni yozing..."
              disabled={loading}
              maxLength={MAX_INPUT}
              className="flex-1 px-3 py-2 text-sm rounded-xl outline-none disabled:opacity-50"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(141, 183, 255, 0.15)',
                color: '#fff',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
              style={{
                background: input.trim() && !loading
                  ? 'linear-gradient(135deg, #2563eb, #1e40af)'
                  : 'rgba(255, 255, 255, 0.08)',
              }}
              aria-label="Yuborish"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
          {error && (
            <p className="text-[10px] text-red-300/80 mt-1.5 px-1">{error}</p>
          )}
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes lexion-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes lexion-panel-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
