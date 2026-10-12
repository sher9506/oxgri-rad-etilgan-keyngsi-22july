import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowUp, Scale, Sparkles, Trash2, RotateCcw, Copy, Check,
  FileText, ExternalLink, AlertCircle, Clock, ChevronDown, Loader2,
} from 'lucide-react';
import { useNexusAiChat } from '@/hooks/useNexusAiChat';
import { AI_NAME, AI_TAGLINE, SAMPLE_QUESTIONS, NEXUS_NOTES } from '@/constants/nexus';
import NexusErrorBoundary from './NexusErrorBoundary';
import './nexus-claude.css';

/* ───────────────────────── helpers ───────────────────────── */

function formatResetTime(nextResetAt: string | null): string | null {
  if (!nextResetAt) return null;
  const target = new Date(nextResetAt).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const timeStr = new Date(nextResetAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (hours > 0) return `${hours} soat ${mins} daqiqadan keyin (${timeStr})`;
  return `${mins} daqiqadan keyin (${timeStr})`;
}

function normalizeUrl(url: string): string {
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://');
  if (!url.startsWith('https://')) return `https://${url}`;
  return url;
}

function isLexUz(url: string): boolean {
  const u = normalizeUrl(url);
  return u.startsWith('https://lex.uz') || u.startsWith('https://www.lex.uz');
}

function extractLexDocId(url: string): string {
  const m = url.match(/\/docs\/(-?\d+)/);
  return m ? `lex.uz/docs/${m[1]}` : url.replace(/^https?:\/\/(www\.)?/, '');
}

function formatClock(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/* ───────────────────────── NexusShell ───────────────────────── */

interface NexusShellProps {
  children: React.ReactNode;
  onClear: () => void;
  showClear: boolean;
  quotaPill: React.ReactNode;
  resetLine: React.ReactNode;
}

function NexusShell({ children, onClear, showClear, quotaPill, resetLine }: NexusShellProps) {
  return (
    <div className="nexus-claude">
      <div className="nc-header">
        <div className="nc-header-left">
          <Scale className="nc-header-icon" />
          <div>
            <h1 className="nc-header-title">{AI_NAME}</h1>
            <p className="nc-header-sub">{AI_TAGLINE}</p>
          </div>
        </div>
        <div className="nc-header-right">
          {quotaPill}
          {showClear && (
            <button onClick={onClear} className="nc-icon-btn" aria-label="Suhbatni tozalash" title="Suhbatni tozalash">
              <Trash2 style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
      </div>
      {resetLine}
      {children}
    </div>
  );
}

/* ───────────────────────── NexusEmptyState ───────────────────────── */

function NexusEmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="nc-empty">
      <Scale className="nc-empty-icon" />
      <h2 className="nc-empty-title">Huquqiy savol bering</h2>
      <p className="nc-empty-desc">
        O'zbekiston qonunchiligi bo'yicha savolingizni yozing. Tegishli moddalar va tushuntirish bilan javob beradi.
      </p>
      <div className="nc-suggestions">
        {SAMPLE_QUESTIONS.map((q) => (
          <button key={q} onClick={() => onPick(q)} className="nc-suggestion-card">
            <Sparkles className="nc-sparkle" />
            <span>{q}</span>
          </button>
        ))}
      </div>
      <p className="nc-cold-start">{NEXUS_NOTES.COLD_START}</p>
    </div>
  );
}

/* ───────────────────────── NexusThinking ───────────────────────── */

interface NexusThinkingProps {
  lexionUrls: string[] | undefined;
  jobCreatedAt: string | undefined;
  serverNow: string | undefined;
}

function NexusThinking({ lexionUrls, jobCreatedAt, serverNow }: NexusThinkingProps) {
  const lexLinks = useMemo(() => {
    if (!lexionUrls || lexionUrls.length === 0) return [];
    return lexionUrls.filter(isLexUz);
  }, [lexionUrls]);

  const isPhaseB = lexLinks.length > 0;

  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    if (!jobCreatedAt) { setElapsedSec(0); return; }
    const start = new Date(jobCreatedAt).getTime();
    const baseNow = serverNow ? new Date(serverNow).getTime() : Date.now();
    setElapsedSec(Math.max(0, Math.floor((baseNow - start) / 1000)));
    const t = setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [jobCreatedAt, serverNow]);

  const visibleChips = lexLinks.slice(0, 6);
  const remaining = lexLinks.length - visibleChips.length;

  return (
    <div className="nc-thinking" aria-live="polite">
      <div className="nc-thinking-row">
        {isPhaseB ? <FileText className="nc-thinking-icon" /> : <Loader2 className="nc-thinking-icon" />}
        <span className="nc-thinking-text" key={isPhaseB ? 'b' : 'a'}>
          {isPhaseB ? "Ushbu qonun hujjatlari o'rganilmoqda" : "Amaldagi qonunchilik o'rganilmoqda"}
        </span>
        <span className="nc-thinking-timer" aria-hidden="true">{formatClock(elapsedSec)}</span>
      </div>
      {isPhaseB && visibleChips.length > 0 && (
        <div className="nc-thinking-chips">
          {visibleChips.map((url, i) => (
            <a
              key={url}
              href={normalizeUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="nc-chip"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <FileText style={{ width: 12, height: 12 }} />
              {extractLexDocId(url)}
            </a>
          ))}
          {remaining > 0 && (
            <span className="nc-chip-more" style={{ animationDelay: `${visibleChips.length * 60}ms` }}>
              +{remaining}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── NexusMessage ───────────────────────── */

interface NexusMessageProps {
  msg: import('@/hooks/useNexusAiChat').ChatMessage;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  onRetry: (jobId: string | undefined, originalText: string) => void;
  findUserText: (aiId: string) => string;
}

function NexusMessage({ msg, copiedId, onCopy, onRetry, findUserText }: NexusMessageProps) {
  const finalSeconds = useMemo(() => {
    if (msg.role !== 'assistant' || msg.status !== 'done' || !msg.jobCreatedAt) return null;
    const start = new Date(msg.jobCreatedAt).getTime();
    const end = msg.serverNow ? new Date(msg.serverNow).getTime() : Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  }, [msg.role, msg.status, msg.jobCreatedAt, msg.serverNow]);

  if (msg.role === 'user') {
    return <div className="nc-msg-user">{msg.content}</div>;
  }

  // Assistant
  if (msg.status === 'queued' || msg.status === 'running') {
    return (
      <div className="nc-msg-assistant">
        <NexusThinking
          lexionUrls={msg.lexionUrls}
          jobCreatedAt={msg.jobCreatedAt}
          serverNow={msg.serverNow}
        />
      </div>
    );
  }

  if (msg.status === 'timeout') {
    return (
      <div className="nc-msg-assistant">
        <div className="nc-error-panel">
          <div className="nc-error-text" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: 'var(--nc-error-text)' }} />
            <span>{msg.error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (msg.status === 'error') {
    return (
      <div className="nc-msg-assistant">
        <div className="nc-error-panel">
          <div className="nc-error-text" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2, color: 'var(--nc-error-text)' }} />
            <span>{msg.error}</span>
          </div>
          {msg.jobId && (
            <button onClick={() => onRetry(msg.jobId, findUserText(msg.id))} className="nc-error-retry">
              <RotateCcw /> Qayta urinish
            </button>
          )}
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="nc-msg-assistant">
      <div className="nc-answer" aria-live="polite">{msg.content}</div>
      {msg.lexionFallback && (
        <p className="nc-fallback-note">(Umumiy rejimda javob berildi)</p>
      )}
      {msg.lexionUrls && msg.lexionUrls.filter(isLexUz).length > 0 && (
        <div className="nc-sources">
          <p className="nc-sources-label">
            <FileText style={{ width: 12, height: 12 }} />
            Foydalanilgan manbalar ({msg.lexionUrls.filter(isLexUz).length})
          </p>
          <div className="nc-sources-list">
            {msg.lexionUrls.filter(isLexUz).slice(0, 10).map((url) => (
              <a key={url} href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" className="nc-source-link">
                <ExternalLink />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extractLexDocId(url)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="nc-actions">
        <button onClick={() => onCopy(msg.id, msg.content)} className="nc-action-btn" aria-label="Nusxalash">
          {copiedId === msg.id ? <Check /> : <Copy />}
          {copiedId === msg.id ? 'Nusxalandi' : 'Nusxalash'}
        </button>
        {finalSeconds !== null && (
          <span className="nc-answer-meta">
            <Clock className="nc-answer-meta-icon" />
            {formatClock(finalSeconds)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── NexusComposer ───────────────────────── */

interface NexusComposerProps {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPillClick: () => void;
  isProcessing: boolean;
  canSend: boolean;
  inputBlocked: boolean;
  inputTooLong: boolean;
  inputTooShort: boolean;
  minInput: number;
  maxInput: number;
  resetText: string | null;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

function NexusComposer({
  input, setInput, onSend, onKeyDown, onPillClick,
  isProcessing, canSend, inputBlocked, inputTooLong, inputTooShort,
  minInput, maxInput, resetText, inputRef,
}: NexusComposerProps) {
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep parent ref in sync
  useEffect(() => {
    if (inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = taRef.current;
  });

  // Auto-grow textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const counterWarn = input.length > maxInput * 0.9;

  return (
    <div className="nc-composer-wrap">
      {inputBlocked && (
        <div className="nc-input-warning">
          Savol limiti tugadi. {resetText} yana yozishingiz mumkin.
        </div>
      )}
      {inputTooShort && !inputBlocked && (
        <div className="nc-input-warning">
          Savol kamida {minInput} belgi bo'lishi kerak
        </div>
      )}
      <div className={`nc-composer ${focused ? 'nc-composer-focused' : ''}`}>
        <div className="nc-composer-inner">
          <textarea
            ref={(el) => { taRef.current = el; if (inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el; }}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, maxInput))}
            onKeyDown={onKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Huquqiy savolingizni yozing..."
            rows={1}
            disabled={isProcessing || inputBlocked}
            className="nc-textarea"
            aria-label="Savol matni"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            className="nc-send-btn"
            aria-label="Yuborish"
          >
            <ArrowUp />
          </button>
        </div>
        <div className="nc-composer-footer">
          <button onClick={onPillClick} className="nc-lexion-pill" aria-label="Lexion AI">
            <span className="nc-lexion-dot" />
            Lexion AI
          </button>
          <span className={`nc-counter ${counterWarn || inputTooLong ? 'nc-counter-warn' : ''}`}>
            {input.length} / {maxInput}
          </span>
        </div>
      </div>
      <div className="nc-composer-notes">
        <span className="nc-note">{NEXUS_NOTES.NO_MEMORY}</span>
        <span className="nc-note-dot">·</span>
        <span className="nc-note">{NEXUS_NOTES.LOCAL_ONLY}</span>
        <span className="nc-note-dot nc-note-kbd">·</span>
        <span className="nc-note nc-note-kbd">Enter — yuborish, Shift+Enter — yangi qator</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Main Component ───────────────────────── */

export default function NexusAI({ userId }: { userId: string }) {
  return (
    <NexusErrorBoundary>
      <NexusAIInner userId={userId} />
    </NexusErrorBoundary>
  );
}

function NexusAIInner({ userId }: { userId: string }) {
  const { messages, isProcessing, quota, sendMessage, retry, clearChat, minInput, maxInput } = useNexusAiChat(userId);
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Auto-scroll logic: only if user is near bottom
  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [messages, isNearBottom, scrollToBottom]);

  // Scroll button visibility
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollBtn(!isNearBottom() && messages.length > 0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isNearBottom, messages.length]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    if (input.trim().length < minInput) return;
    if (input.length > maxInput) return;
    if (quota && !quota.is_unlimited && quota.remaining <= 0) return;
    sendMessage(input);
    setInput('');
  }, [input, isProcessing, minInput, maxInput, quota, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCopy = useCallback((id: string, text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  }, []);

  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    if (window.confirm("Suhbatni tozalash? Barcha xabarlar shu qurilmadan o'chiriladi.")) {
      clearChat();
    }
  }, [messages.length, clearChat]);

  const findUserText = useCallback((aiId: string) => {
    const userMsg = messages.find((m) => m.id === `user-${aiId.replace('ai-', 'user-')}`);
    return userMsg?.content || '';
  }, [messages]);

  const isLimited = quota && !quota.is_unlimited;
  const remaining = isLimited ? quota!.remaining : 99;
  const limit = isLimited ? quota!.limit : 99;
  const resetText = isLimited ? formatResetTime(quota!.next_reset_at) : null;
  const inputBlocked = isLimited && remaining <= 0;
  const inputTooShort = input.trim().length > 0 && input.trim().length < minInput;
  const inputTooLong = input.length > maxInput;
  const canSend = input.trim().length >= minInput && !inputTooLong && !isProcessing && !inputBlocked;

  const quotaPill = isLimited ? (
    <div className={`nc-quota-pill ${remaining <= 2 ? 'nc-quota-pill-low' : ''}`} aria-live="polite">
      Qolgan savollar: {remaining} / {limit}
    </div>
  ) : null;

  const resetLine = isLimited && remaining < limit && resetText ? (
    <div className="nc-reset-line">Keyingi savol huquqi {resetText} tiklanadi</div>
  ) : null;

  return (
    <NexusShell onClear={handleClear} showClear={messages.length > 0} quotaPill={quotaPill} resetLine={resetLine}>
      <div className="nc-scroll-container" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} className="nc-scroll">
          {messages.length === 0 ? (
            <NexusEmptyState onPick={(q) => { setInput(q); inputRef.current?.focus(); }} />
          ) : (
            <div className="nc-messages">
              {messages.map((msg) => (
                <NexusMessage
                  key={msg.id}
                  msg={msg}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  onRetry={retry}
                  findUserText={findUserText}
                />
              ))}
            </div>
          )}
        </div>
        {showScrollBtn && (
          <button className="nc-scroll-bottom" onClick={scrollToBottom} aria-label="Pastga o'tish">
            <ChevronDown />
          </button>
        )}
      </div>
      <NexusComposer
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        onPillClick={() => {}}
        isProcessing={isProcessing}
        canSend={canSend}
        inputBlocked={inputBlocked}
        inputTooLong={inputTooLong}
        inputTooShort={inputTooShort}
        minInput={minInput}
        maxInput={maxInput}
        resetText={resetText}
        inputRef={inputRef}
      />
    </NexusShell>
  );
}
