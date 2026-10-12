import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowUp, Scale, Sparkles, Trash2, RotateCcw, Copy, Check,
  FileText, ExternalLink, AlertCircle, Clock, ChevronDown, Loader2,
  Plus, MessageCircle, Info, X,
} from 'lucide-react';
import { useNexusAiChat } from '@/hooks/useNexusAiChat';
import type { ChatMeta } from '@/hooks/useNexusAiChat';
import {
  AI_NAME, AI_TAGLINE, SAMPLE_QUESTIONS, NEXUS_NOTES,
  MAX_ACTIVE_CHATS, MAX_EXPIRED_CHATS,
} from '@/constants/nexus';
import NexusErrorBoundary from './NexusErrorBoundary';
import DocStack from './nexus/DocStack';
import BgShapes from './nexus/BgShapes';
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

function formatTimerHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatSrTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `Qolgan vaqt ${h} soat ${m} daqiqa`;
}

/* ───────────────────────── NexusShell ───────────────────────── */

interface NexusShellProps {
  children: React.ReactNode;
  onClear: () => void;
  showClear: boolean;
  quotaPill: React.ReactNode;
  resetLine: React.ReactNode;
  onToggleChats: () => void;
  activeChatCount: number;
  timerPill: React.ReactNode;
}

function NexusShell({
  children, onClear, showClear, quotaPill, resetLine,
  onToggleChats, activeChatCount, timerPill,
}: NexusShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const main = el.closest('main');
    if (!main) return;
    const update = () => {
      const h = main.getBoundingClientRect().height;
      el.style.minHeight = `${h}px`;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="nexus-claude" ref={shellRef}>
      <BgShapes reducedMotion={reducedMotion} />
      <div className="nc-header">
        <div className="nc-header-left">
          <button
            className="nc-chats-toggle lg:hidden"
            onClick={onToggleChats}
            aria-label="Suhbatlar ro'yxati"
          >
            <MessageCircle style={{ width: 18, height: 18 }} />
            {activeChatCount > 0 && (
              <span className="nc-chats-badge">{activeChatCount}</span>
            )}
          </button>
          <div className="nc-header-icon-tile" aria-hidden="true">
            <Scale className="nc-header-icon" />
          </div>
          <div>
            <h1 className="nc-header-title">{AI_NAME}</h1>
            <p className="nc-header-sub">{AI_TAGLINE}</p>
          </div>
        </div>
        <div className="nc-header-right">
          {timerPill}
          {quotaPill}
          {showClear && (
            <button onClick={onClear} className="nc-icon-btn" aria-label="Shu suhbatni o'chirish" title="Shu suhbatni o'chirish">
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canHover, setCanHover] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hmq = window.matchMedia('(hover: hover)');
    setReducedMotion(rmq.matches);
    setCanHover(hmq.matches);
    const rmHandler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const hHandler = (e: MediaQueryListEvent) => setCanHover(e.matches);
    rmq.addEventListener('change', rmHandler);
    hmq.addEventListener('change', hHandler);
    return () => {
      rmq.removeEventListener('change', rmHandler);
      hmq.removeEventListener('change', hHandler);
    };
  }, []);

  return (
    <div className="nc-empty">
      <div className="nc-empty-docstack" aria-hidden="true">
        <DocStack phaseB={false} scanning={false} layers={canHover ? 4 : 2} reducedMotion={reducedMotion} canHover={canHover} active={false} />
      </div>
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

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover)').matches;
  const docLayers = canHover ? 4 : 2;

  return (
    <div className="nc-thinking" aria-live="polite">
      <div className="nc-thinking-header">
        {isPhaseB ? <FileText className="nc-thinking-icon" /> : <Loader2 className="nc-thinking-icon" />}
        <span className="nc-thinking-text" key={isPhaseB ? 'b' : 'a'}>
          {isPhaseB ? "Ushbu qonun hujjatlari o'rganilmoqda" : "Amaldagi qonunchilik o'rganilmoqda"}
        </span>
        <span className="nc-thinking-timer" aria-hidden="true">{formatClock(elapsedSec)}</span>
      </div>
      <div className="nc-thinking-docstack" aria-hidden="true">
        <DocStack
          phaseB={isPhaseB}
          scanning={!reducedMotion}
          layers={docLayers}
          reducedMotion={reducedMotion}
          canHover={canHover}
          active={true}
        />
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
      <div className="nc-thinking-skeleton" aria-hidden="true">
        <div className="nc-skeleton-line" style={{ width: '92%' }} />
        <div className="nc-skeleton-line" style={{ width: '78%' }} />
        <div className="nc-skeleton-line" style={{ width: '56%' }} />
      </div>
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
  chatLimitError: string | null;
  onOpenChats: () => void;
  memoryNote: string;
}

function NexusComposer({
  input, setInput, onSend, onKeyDown, onPillClick,
  isProcessing, canSend, inputBlocked, inputTooLong, inputTooShort,
  minInput, maxInput, resetText, inputRef, chatLimitError, onOpenChats, memoryNote,
}: NexusComposerProps) {
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef) (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = taRef.current;
  });

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  const counterWarn = input.length > maxInput * 0.9;

  return (
    <div className="nc-composer-wrap">
      {chatLimitError && (
        <div className="nc-input-warning nc-chat-limit-warning">
          <span>{chatLimitError}</span>
          <button onClick={onOpenChats} className="nc-chat-limit-link">Suhbatlarni ochish</button>
        </div>
      )}
      {inputBlocked && !chatLimitError && (
        <div className="nc-input-warning">
          Savol limiti tugadi. {resetText} yana yozishingiz mumkin.
        </div>
      )}
      {inputTooShort && !inputBlocked && !chatLimitError && (
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
        <span className="nc-note">{memoryNote}</span>
        <span className="nc-note-dot">·</span>
        <span className="nc-note">{NEXUS_NOTES.LOCAL_ONLY}</span>
        <span className="nc-note-dot nc-note-kbd">·</span>
        <span className="nc-note nc-note-kbd">Enter — yuborish, Shift+Enter — yangi qator</span>
      </div>
    </div>
  );
}

/* ───────────────────────── TimerChip ───────────────────────── */

function TimerChip({ remaining, status }: { remaining: number; status: 'active' | 'expired' | 'none' }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'active') return;
    const t = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  if (status === 'none') return null;
  if (status === 'expired' || remaining <= 0) {
    return <span className="nc-timer-chip nc-timer-expired" aria-hidden="true">Tugadi</span>;
  }

  const totalSec = Math.floor(remaining / 1000);
  const hours = totalSec / 3600;
  let cls = 'nc-timer-chip nc-timer-normal';
  let icon = <Clock style={{ width: 11, height: 11 }} />;

  if (hours < 1 && hours >= 1 / 6) {
    cls = 'nc-timer-chip nc-timer-amber';
    icon = <span style={{ fontSize: 11, fontWeight: 700 }}>!</span>;
  } else if (hours < 1 / 6) {
    cls = 'nc-timer-chip nc-timer-red nc-timer-pulse';
    icon = <span style={{ fontSize: 11, fontWeight: 700 }}>!</span>;
  }

  const srText = formatSrTimer(totalSec);

  return (
    <span className={cls} aria-hidden="true">
      {icon}
      {formatTimerHMS(totalSec)}
      <span className="sr-only" aria-live="off" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {srText}
      </span>
    </span>
  );
}

/* ───────────────────────── ChatListItem ───────────────────────── */

interface ChatListItemProps {
  chat: ChatMeta;
  isActive: boolean;
  timerRemaining: number;
  timerStatus: 'active' | 'expired' | 'none';
  hasPending: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ChatListItem({ chat, isActive, timerRemaining, timerStatus, hasPending, onSelect, onDelete }: ChatListItemProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className={`nc-chat-item ${isActive ? 'nc-chat-active' : ''} ${timerStatus === 'expired' ? 'nc-chat-dim' : ''}`}
      onClick={onSelect}
      role="option"
      aria-selected={isActive}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onSelect(); }
        if (e.key === 'Delete' && !confirming) { e.preventDefault(); setConfirming(true); }
      }}
    >
      {isActive && <div className="nc-chat-active-bar" />}
      <div className="nc-chat-content">
        <span className="nc-chat-title">{chat.title}</span>
        <div className="nc-chat-meta">
          {hasPending && <span className="nc-chat-pending"><Loader2 style={{ width: 10, height: 10 }} /> ishlamoqda</span>}
          {timerStatus !== 'none' && <TimerChip remaining={timerRemaining} status={timerStatus} />}
        </div>
      </div>
      {confirming ? (
        <div className="nc-chat-confirm" onClick={(e) => e.stopPropagation()}>
          <span className="nc-chat-confirm-text">{NEXUS_NOTES.DELETE_CONFIRM}</span>
          <button
            className="nc-chat-confirm-yes"
            onClick={(e) => { e.stopPropagation(); onDelete(); setConfirming(false); }}
          >{NEXUS_NOTES.DELETE_YES}</button>
          <button
            className="nc-chat-confirm-no"
            onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
          >{NEXUS_NOTES.DELETE_CANCEL}</button>
        </div>
      ) : (
        (isActive || typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) && (
          <button
            className="nc-chat-delete"
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            aria-label="Suhbatni o'chirish"
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        )
      )}
    </div>
  );
}

/* ───────────────────────── ChatListPanel ───────────────────────── */

interface ChatListPanelProps {
  chats: ChatMeta[];
  activeChatId: string;
  getChatTimer: (chatId: string) => { remaining: number; status: 'active' | 'expired' | 'none' };
  pendingChatIds: Set<string>;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onNewChat: () => void;
  activeCount: number;
  maxActive: number;
  memoryEnabled: boolean;
}

function ChatListPanel({
  chats, activeChatId, getChatTimer, pendingChatIds, onSelect, onDelete, onNewChat,
  activeCount, maxActive, memoryEnabled,
}: ChatListPanelProps) {
  const atLimit = activeCount >= maxActive;

  const activeChats = chats.filter(c => {
    const t = getChatTimer(c.chatId);
    return t.status === 'active' || pendingChatIds.has(c.chatId);
  }).sort((a, b) => b.updatedAt - a.updatedAt);

  const expiredChats = chats.filter(c => {
    const t = getChatTimer(c.chatId);
    return (t.status === 'expired' || t.status === 'none') && !pendingChatIds.has(c.chatId);
  }).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_EXPIRED_CHATS);

  const progressPct = Math.min(100, (activeCount / maxActive) * 100);
  let progressCls = 'nc-progress-bar';
  if (activeCount >= maxActive) progressCls += ' nc-progress-red';
  else if (activeCount >= maxActive - 2) progressCls += ' nc-progress-amber';

  return (
    <div className="nc-chat-list-panel">
      <button
        className={`nc-new-chat-btn ${atLimit ? 'nc-new-chat-disabled' : ''}`}
        onClick={onNewChat}
        disabled={atLimit}
        title={atLimit ? NEXUS_NOTES.LIMIT_TOOLTIP : undefined}
      >
        <Plus style={{ width: 16, height: 16 }} />
        {NEXUS_NOTES.NEW_CHAT}
      </button>
      {memoryEnabled && (
        <div className="nc-active-counter">
          <span className="nc-active-counter-text">
            {NEXUS_NOTES.ACTIVE_CHATS}: {activeCount} / {maxActive}
          </span>
          <div className="nc-progress-track">
            <div className={progressCls} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}
      <div className="nc-chat-list-scroll">
        {chats.length === 0 && (
          <p className="nc-chat-empty">{NEXUS_NOTES.EMPTY_CHATS}</p>
        )}
        {activeChats.length > 0 && (
          <>
            <div className="nc-chat-group-label">{NEXUS_NOTES.ACTIVE_CHATS}</div>
            {activeChats.map(chat => (
              <ChatListItem
                key={chat.chatId}
                chat={chat}
                isActive={chat.chatId === activeChatId}
                timerRemaining={getChatTimer(chat.chatId).remaining}
                timerStatus={getChatTimer(chat.chatId).status}
                hasPending={pendingChatIds.has(chat.chatId)}
                onSelect={() => onSelect(chat.chatId)}
                onDelete={() => onDelete(chat.chatId)}
              />
            ))}
          </>
        )}
        {expiredChats.length > 0 && (
          <>
            <div className="nc-chat-group-label">{NEXUS_NOTES.EXPIRED_CHATS}</div>
            {expiredChats.map(chat => (
              <ChatListItem
                key={chat.chatId}
                chat={chat}
                isActive={chat.chatId === activeChatId}
                timerRemaining={getChatTimer(chat.chatId).remaining}
                timerStatus={getChatTimer(chat.chatId).status}
                hasPending={pendingChatIds.has(chat.chatId)}
                onSelect={() => onSelect(chat.chatId)}
                onDelete={() => onDelete(chat.chatId)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── TimerPopover ───────────────────────── */

function TimerPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="nc-timer-popover" role="dialog" aria-modal="false">
      <div className="nc-timer-popover-header">
        <h3 className="nc-timer-popover-title">{NEXUS_NOTES.TIMER_POPOVER_TITLE}</h3>
        <button onClick={onClose} className="nc-timer-popover-close" aria-label="Yopish">
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <p className="nc-timer-popover-text">{NEXUS_NOTES.TIMER_POPOVER_TEXT}</p>
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
  const {
    chats, activeChatId, messages, isProcessing, quota,
    memoryEnabled, chatLimitError, sendMessage, retry, deleteChat,
    switchChat, createNewChat, getChatTimer, fetchChatsStatus,
    chatsStatus, minInput, maxInput,
  } = useNexusAiChat(userId);

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showTimerPopover, setShowTimerPopover] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const bannerDismissed = useRef<Set<string>>(new Set());

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => {
    if (isNearBottom()) scrollToBottom();
  }, [messages, isNearBottom, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollBtn(!isNearBottom() && messages.length > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isNearBottom, messages.length]);

  // Pending job chat IDs
  const pendingChatIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of messages) {
      if (m.jobId && (m.status === 'queued' || m.status === 'running')) {
        if (activeChatId) ids.add(activeChatId);
      }
    }
    return ids;
  }, [messages, activeChatId]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    if (input.trim().length < minInput) return;
    if (input.length > maxInput) return;
    if (quota && !quota.is_unlimited && quota.remaining <= 0) return;
    sendMessage(input);
    setInput('');
  }, [input, isProcessing, minInput, maxInput, quota, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleCopy = useCallback((id: string, text: string) => {
    try { navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch { /* ignore */ }
  }, []);

  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    if (window.confirm("Suhbatni o'chirish? Barcha xabarlar shu qurilmadan o'chiriladi.")) {
      deleteChat(activeChatId);
    }
  }, [messages.length, deleteChat, activeChatId]);

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

  // Timer for active chat
  const activeTimer = getChatTimer(activeChatId);
  const activeTimerSec = Math.floor(activeTimer.remaining / 1000);
  const activeTimerHours = activeTimerSec / 3600;

  const timerPill = memoryEnabled && activeTimer.status === 'active' ? (
    <div className="nc-timer-pill-wrap">
      <button
        className={`nc-timer-pill ${
          activeTimerHours < 1 / 6 ? 'nc-timer-pill-red nc-timer-pulse'
          : activeTimerHours < 1 ? 'nc-timer-pill-amber'
          : 'nc-timer-pill-normal'
        }`}
        onClick={() => setShowTimerPopover(true)}
        aria-label="Xotira taymeri haqida ma'lumot"
        aria-expanded={showTimerPopover}
        aria-controls="nc-timer-popover"
      >
        <Clock style={{ width: 13, height: 13 }} />
        <span aria-hidden="true">{formatTimerHMS(activeTimerSec)}</span>
        <Info style={{ width: 12, height: 12, opacity: 0.6 }} />
      </button>
      {showTimerPopover && <TimerPopover onClose={() => setShowTimerPopover(false)} />}
    </div>
  ) : null;

  // Banner for <1 hour
  const showTimerBanner = memoryEnabled && activeTimer.status === 'active' && activeTimerHours < 1 && !bannerDismissed.current.has(activeChatId);
  const bannerText = NEXUS_NOTES.BANNER_WARNING.replace('{time}', formatTimerHMS(activeTimerSec));
  const bannerRed = activeTimerHours < 1 / 6;

  // Memory divider: when timer just expired (was active, now not)
  const [prevTimerActive, setPrevTimerActive] = useState(false);
  const [showDivider, setShowDivider] = useState(false);
  useEffect(() => {
    const isActive = activeTimer.status === 'active';
    if (prevTimerActive && !isActive && activeTimer.status === 'expired') {
      setShowDivider(true);
      const t = setTimeout(() => setShowDivider(false), 5000);
      return () => clearTimeout(t);
    }
    setPrevTimerActive(isActive);
  }, [activeTimer.status, prevTimerActive]);

  // Memory note text
  const memoryNote = !memoryEnabled
    ? NEXUS_NOTES.NO_MEMORY
    : activeTimer.status === 'active'
      ? NEXUS_NOTES.MEMORY_ACTIVE
      : messages.length === 0
        ? NEXUS_NOTES.MEMORY_COLD
        : NEXUS_NOTES.MEMORY_COLD;

  const activeCount = chatsStatus?.active_count ?? 0;
  const maxActive = chatsStatus?.max_active ?? MAX_ACTIVE_CHATS;

  const handleSelectChat = useCallback((chatId: string) => {
    switchChat(chatId);
    setDrawerOpen(false);
  }, [switchChat]);

  const handleNewChat = useCallback(() => {
    createNewChat();
    setDrawerOpen(false);
  }, [createNewChat]);

  const handleDeleteChat = useCallback((chatId: string) => {
    deleteChat(chatId);
  }, [deleteChat]);

  // Esc closes drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [drawerOpen]);

  return (
    <NexusShell
      onClear={handleClear}
      showClear={messages.length > 0}
      quotaPill={quotaPill}
      resetLine={resetLine}
      onToggleChats={() => setDrawerOpen(true)}
      activeChatCount={activeCount}
      timerPill={timerPill}
    >
      <div className="nc-layout">
        {/* Desktop chat list panel */}
        <aside className="nc-chat-sidebar">
          <ChatListPanel
            chats={chats}
            activeChatId={activeChatId}
            getChatTimer={getChatTimer}
            pendingChatIds={pendingChatIds}
            onSelect={handleSelectChat}
            onDelete={handleDeleteChat}
            onNewChat={handleNewChat}
            activeCount={activeCount}
            maxActive={maxActive}
            memoryEnabled={memoryEnabled}
          />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <>
            <div className="nc-drawer-overlay" onClick={() => setDrawerOpen(false)} />
            <aside className="nc-chat-drawer">
              <div className="nc-drawer-header">
                <span className="nc-drawer-title">{NEXUS_NOTES.CHAT_LIST_TITLE}</span>
                <button onClick={() => setDrawerOpen(false)} className="nc-drawer-close" aria-label="Yopish">
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
              <ChatListPanel
                chats={chats}
                activeChatId={activeChatId}
                getChatTimer={getChatTimer}
                pendingChatIds={pendingChatIds}
                onSelect={handleSelectChat}
                onDelete={handleDeleteChat}
                onNewChat={handleNewChat}
                activeCount={activeCount}
                maxActive={maxActive}
                memoryEnabled={memoryEnabled}
              />
            </aside>
          </>
        )}

        {/* Main chat area */}
        <div className="nc-main-area">
          {showTimerBanner && (
            <div className={`nc-timer-banner ${bannerRed ? 'nc-timer-banner-red' : ''}`}>
              <span>{bannerText}</span>
              <button
                onClick={() => {
                  bannerDismissed.current.add(activeChatId);
                  setShowBanner(false);
                }}
                className="nc-timer-banner-close"
                aria-label="Yopish"
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          )}
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
                  {showDivider && (
                    <div className="nc-memory-divider">
                      <span>{NEXUS_NOTES.MEMORY_EXPIRED_DIVIDER}</span>
                    </div>
                  )}
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
            chatLimitError={chatLimitError}
            onOpenChats={() => setDrawerOpen(true)}
            memoryNote={memoryNote}
          />
        </div>
      </div>
    </NexusShell>
  );
}
