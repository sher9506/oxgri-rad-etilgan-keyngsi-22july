import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, AlertCircle, RotateCw, X, Bot, Sparkles } from 'lucide-react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface LexionAiSahifaProps {
  onClose: () => void;
}

const MAX_INPUT = 2000;
const MAX_MESSAGES = 20;

function getSessionId(): string {
  const KEY = 'lexion:session';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `lex_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export default function LexionAiSahifa({ onClose }: LexionAiSahifaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef(getSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', text };
    const nextMessages = [...messages, userMsg].slice(-MAX_MESSAGES);
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/lexion-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, text: m.text })),
          sessionId: sessionIdRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `So'rov xatosi (${res.status})`);
      }
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply || 'Javob bo\u2018sh chiqdi.' }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi. Qayta urinib ko\u2018ring.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const charCount = input.length;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
        style={{ maxHeight: '85vh', animation: 'lexion-panel-in 280ms cubic-bezier(0.22,1,0.36,1) both' }}
      >
        <style>{`
          @keyframes lexion-panel-in {
            from { opacity: 0; transform: translateY(24px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-1.5">
                Lexion AI
                <Sparkles className="h-3 w-3 text-blue-200" />
              </p>
              <p className="text-[10px] text-blue-100 font-medium">Huquqiy yordamchi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8 px-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mb-3">
                <Bot className="h-6 w-6 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Salom! Men Lexion'man</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Huquqiy savolingizni yozing — men O'zbekiston huquq tizimi bo'yicha qisqa javob beraman.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-1.5 text-red-500 text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
              <button
                onClick={() => setError(null)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-all"
              >
                <RotateCw className="h-3 w-3" /> Yopish
              </button>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Huquqiy savolingiz..."
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-gray-200 px-3.5 py-2.5 text-sm leading-relaxed focus:outline-none focus:border-blue-400 transition-colors disabled:bg-gray-50 max-h-24"
              style={{ minHeight: 42 }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className={`flex items-center justify-center w-10 h-10 rounded-2xl shrink-0 transition-all ${
                input.trim() && !loading
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95'
                  : 'bg-gray-100 text-gray-400'
              }`}
              aria-label="Yuborish"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {charCount > MAX_INPUT * 0.8 && (
            <p className="text-[10px] text-gray-400 mt-1 text-right">{charCount} / {MAX_INPUT}</p>
          )}
        </div>
      </div>
    </div>
  );
}
