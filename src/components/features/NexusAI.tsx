import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, AlertCircle, Scale, RotateCcw, Copy, Check, Trash2, ExternalLink, Sparkles, FileText } from 'lucide-react';
import { useNexusAiChat } from '@/hooks/useNexusAiChat';
import { AI_NAME, AI_TAGLINE, SAMPLE_QUESTIONS, NEXUS_NOTES } from '@/constants/nexus';

function formatResetTime(nextResetAt: string | null): string | null {
  if (!nextResetAt) return null;
  const target = new Date(nextResetAt).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const timeStr = new Date(nextResetAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (hours > 0) {
    return `${hours} soat ${mins} daqiqadan keyin (${timeStr})`;
  }
  return `${mins} daqiqadan keyin (${timeStr})`;
}

function normalizeUrl(url: string): string {
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
  if (!url.startsWith('https://')) return `https://${url}`;
  return url;
}

function formatElapsed(created_at: string | undefined, server_now: string | undefined): string {
  if (!created_at || !server_now) return '0:00';
  const start = new Date(created_at).getTime();
  const now = new Date(server_now).getTime();
  const diff = Math.max(0, Math.floor((now - start) / 1000));
  const min = Math.floor(diff / 60);
  const sec = diff % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function NexusAI({ userId }: { userId: string }) {
  const { messages, isProcessing, quota, sendMessage, retry, clearChat, minInput, maxInput } = useNexusAiChat(userId);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [elapsedTick, setElapsedTick] = useState(0);

  useEffect(() => {
    if (!isProcessing) return;
    const t = setInterval(() => setElapsedTick(t2 => t2 + 1), 1000);
    return () => clearInterval(t);
  }, [isProcessing]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    if (input.trim().length < minInput) return;
    if (input.length > maxInput) return;
    if (quota && !quota.is_unlimited && quota.remaining <= 0) return;
    sendMessage(input);
    setInput('');
  }, [input, isProcessing, minInput, maxInput, quota, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    if (window.confirm('Suhbatni tozalash? Barcha xabarlar shu qurilmadan o\'chiriladi.')) {
      clearChat();
    }
  };

  const isLimited = quota && !quota.is_unlimited;
  const remaining = isLimited ? quota!.remaining : 99;
  const limit = isLimited ? quota!.limit : 99;
  const resetText = isLimited ? formatResetTime(quota!.next_reset_at) : null;
  const inputBlocked = isLimited && remaining <= 0;
  const inputTooShort = input.trim().length > 0 && input.trim().length < minInput;
  const inputTooLong = input.length > maxInput;
  const canSend = input.trim().length >= minInput && !inputTooLong && !isProcessing && !inputBlocked;

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
              <Scale className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate" style={{ color: 'var(--ink)' }}>{AI_NAME}</h1>
              <p className="text-xs truncate" style={{ color: 'var(--ink-muted)' }}>{AI_TAGLINE}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLimited && (
              <div
                className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                style={{
                  background: remaining <= 2 ? 'rgba(239,68,68,.08)' : 'var(--cobalt-tint)',
                  color: remaining <= 2 ? '#ef4444' : 'var(--cobalt-2)',
                }}
                aria-live="polite"
              >
                Qolgan savollar: {remaining} / {limit}
              </div>
            )}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all ff-focus hover:opacity-80"
                style={{ background: 'var(--bg-2)', color: 'var(--ink-muted)' }}
                aria-label="Suhbatni tozalash"
                title="Suhbatni tozalash"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        {/* Reset time line */}
        {isLimited && remaining < limit && resetText && (
          <div className="mt-1.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Keyingi savol huquqi {resetText} tiklanadi
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}>
              <Scale className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink)' }}>Huquqiy savol bering</h2>
            <p className="text-sm max-w-md" style={{ color: 'var(--ink-muted)' }}>
              O'zbekiston qonunchiligi bo'yicha savolingizni yozing. Tegishli moddalar va tushuntirish bilan javob beradi.
            </p>
            <div className="mt-6 flex flex-col gap-2 max-w-lg w-full">
              {SAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-left transition-all ff-focus hover:scale-[1.02]"
                  style={{
                    background: 'var(--bg-2)',
                    color: 'var(--ink-body)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <Sparkles className="inline-block h-3.5 w-3.5 mr-2" style={{ color: 'var(--cobalt-2)' }} />
                  {q}
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-6" style={{ color: 'var(--ink-muted)' }}>{NEXUS_NOTES.COLD_START}</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3"
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))'
                  : 'var(--card)',
                color: msg.role === 'user' ? '#fff' : 'var(--ink-body)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--line)',
              }}
            >
              {msg.role === 'assistant' && msg.status === 'queued' && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Savol yuborilmoqda...</span>
                </div>
              )}
              {msg.role === 'assistant' && msg.status === 'running' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-muted)' }}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {msg.lexionPhase === 'lexion_searching'
                        ? 'Qonunchilik qidirilmoqda...'
                        : msg.lexionPhase === 'answering'
                          ? 'Javob tayyorlanmoqda...'
                          : 'Javob tayyorlanmoqda...'}
                    </span>
                    {msg.jobCreatedAt && (
                      <span className="text-xs font-mono ml-1" style={{ color: 'var(--ink-muted)' }}>
                        {formatElapsed(msg.jobCreatedAt, msg.serverNow || new Date().toISOString())}
                      </span>
                    )}
                  </div>
                  {msg.lexionPhase === 'answering' && msg.lexionUrls && msg.lexionUrls.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold" style={{ color: 'var(--cobalt-2)' }}>
                        Tegishli hujjatlar topildi ({msg.lexionUrls.length} ta)
                      </p>
                      <div className="flex flex-col gap-1">
                        {msg.lexionUrls.slice(0, 8).map((url, i) => (
                          <a
                            key={url}
                            href={normalizeUrl(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
                            style={{ color: 'var(--cobalt-2)' }}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{normalizeUrl(url)}</span>
                          </a>
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                        Shu qonunchilik asosida tahlil qilinmoqda...
                      </p>
                    </div>
                  )}
                </div>
              )}
              {msg.role === 'assistant' && msg.status === 'timeout' && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-muted)' }} />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>{msg.error}</p>
                  </div>
                </div>
              )}
              {msg.role === 'assistant' && msg.status === 'error' && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--ink-muted)' }} />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--ink-body)' }}>{msg.error}</p>
                    {msg.jobId && (
                      <button
                        onClick={() => {
                          const userMsg = messages.find(m => m.id === `user-${msg.id.replace('ai-', 'user-')}`);
                          retry(msg.jobId, userMsg?.content || '');
                        }}
                        className="mt-2 flex items-center gap-1 text-xs font-bold transition-colors"
                        style={{ color: 'var(--cobalt-2)' }}
                      >
                        <RotateCcw className="h-3 w-3" /> Qayta urinish
                      </button>
                    )}
                  </div>
                </div>
              )}
              {msg.role === 'assistant' && msg.status === 'done' && (
                <div>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap break-words"
                    style={{ color: 'var(--ink-body)' }}
                    aria-live="polite"
                  >{msg.content}</div>
                  {msg.lexionFallback && (
                    <p className="text-xs mt-2 italic" style={{ color: 'var(--ink-muted)' }}>
                      (Umumiy rejimda javob berildi)
                    </p>
                  )}
                  {/* Foydalanilgan manbalar */}
                  {msg.lexionUrls && msg.lexionUrls.length > 0 && (
                    <div className="mt-3 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                      <p className="text-xs font-bold mb-1.5 flex items-center gap-1" style={{ color: 'var(--ink-muted)' }}>
                        <FileText className="h-3 w-3" />
                        Foydalanilgan manbalar ({msg.lexionUrls.length})
                      </p>
                      <div className="flex flex-col gap-1">
                        {msg.lexionUrls.slice(0, 10).map((url, i) => (
                          <a
                            key={url}
                            href={normalizeUrl(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
                            style={{ color: 'var(--cobalt-2)' }}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{normalizeUrl(url)}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Action row */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                      style={{ color: 'var(--ink-muted)' }}
                      aria-label="Nusxalash"
                    >
                      {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedId === msg.id ? 'Nusxalandi' : 'Nusxalash'}
                    </button>
                  </div>
                </div>
              )}
              {msg.role === 'user' && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 md:px-6 py-3 border-t" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
        {inputBlocked && (
          <div className="mb-2 px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'var(--bg-2)', color: 'var(--ink-muted)' }}>
            Savol limiti tugadi. {resetText} yana yozishingiz mumkin.
          </div>
        )}
        {inputTooShort && (
          <div className="mb-2 px-3 py-2 rounded-lg text-xs text-center" style={{ background: 'var(--bg-2)', color: 'var(--ink-muted)' }}>
            Savol kamida {minInput} belgi bo'lishi kerak
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxInput))}
            onKeyDown={handleKeyDown}
            placeholder="Huquqiy savolingizni yozing..."
            rows={1}
            disabled={isProcessing || inputBlocked}
            className="flex-1 resize-none rounded-xl px-4 py-3 text-sm transition-all ff-focus"
            style={{
              background: 'var(--bg)',
              color: 'var(--ink)',
              border: `1px solid ${inputTooLong ? '#ef4444' : 'var(--line)'}`,
              minHeight: 44,
              maxHeight: 120,
            }}
            aria-label="Savol matni"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-all active:scale-95 ff-focus disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))',
              color: '#fff',
            }}
            aria-label="Yuborish"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>
            Enter — yuborish, Shift+Enter — yangi qator
          </span>
          <span
            className="text-[10px]"
            style={{ color: inputTooLong ? '#ef4444' : 'var(--ink-muted)' }}
          >
            {input.length} / {maxInput}
          </span>
        </div>
        <div className="flex items-center justify-center gap-4 mt-1">
          <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>{NEXUS_NOTES.NO_MEMORY}</span>
          <span className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>{NEXUS_NOTES.LOCAL_ONLY}</span>
        </div>
        <p className="text-center text-[10px] mt-1" style={{ color: 'var(--ink-muted)' }}>{NEXUS_NOTES.DISCLAIMER}</p>
      </div>
    </div>
  );
}
