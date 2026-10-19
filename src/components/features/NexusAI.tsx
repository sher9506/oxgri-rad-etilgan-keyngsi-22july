import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowUp, Sparkles, Trash2, RotateCcw, Copy, Check,
  FileText, ExternalLink, AlertCircle, Clock, ChevronDown, Loader2,
  Plus, MessageCircle, Info, X, PanelLeft, Zap, Search, Target,
} from 'lucide-react';
import { useNexusAiChat } from '@/hooks/useNexusAiChat';
import type { ChatMeta, NasherMode } from '@/hooks/useNexusAiChat';
import { useNow } from '@/hooks/useNow';
import {
  AI_NAME, SAMPLE_QUESTIONS, NEXUS_NOTES,
  MAX_ACTIVE_CHATS, MAX_EXPIRED_CHATS,
  formatRemainingShort, getTimerTone, formatRelativeDate,
  COPY_LABEL, COPIED_LABEL,
} from '@/constants/nexus';
import NexusErrorBoundary from './NexusErrorBoundary';
import DocStack from './nexus/DocStack';
import AnswerText from './nexus/AnswerText';
import { stripSourceWords, prepareAnswer, useLexNames, lexDocName, useTypewriter } from '@/lib/nasherText';
import './nexus-claude.css';

/* ───────────────────────── helpers ───────────────────────── */

function formatResetTime(nextResetAt: string, nowMs: number): string | null {
  const target = new Date(nextResetAt).getTime();
  const diff = target - nowMs;
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const timeStr = new Date(nextResetAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  if (hours > 0) return `${hours} soat ${mins > 0 ? mins + ' daq ' : ''}keyin (${timeStr})`;
  return `${totalMin} daq keyin (${timeStr})`;
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

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)} daq ${String(seconds % 60).padStart(2, '0')} son`;
}

function formatSrTimer(remainingMs: number): string {
  return `Qolgan vaqt: ${formatRemainingShort(remainingMs)}`;
}

/* ───────────────────────── Media query hooks ───────────────────────── */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function useCanHover(): boolean {
  const [canHover, setCanHover] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover)');
    setCanHover(mq.matches);
    const handler = (e: MediaQueryListEvent) => setCanHover(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return canHover;
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
  panelCollapsed: boolean;
  onTogglePanel: () => void;
  title: string;
}

function NexusShell({
  children, onClear, showClear, quotaPill, resetLine,
  onToggleChats, activeChatCount, timerPill,
  panelCollapsed, onTogglePanel, title,
}: NexusShellProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const prevOverflowRef = useRef<string>('');

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const main = el.closest('main');
    if (!main) return;

    prevOverflowRef.current = main.style.overflow;
    main.style.overflow = 'hidden';
    if (main.scrollTop) main.scrollTop = 0;

    const update = () => {
      const mainRect = main.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const mainPad = getComputedStyle(main);
      const padBottom = parseFloat(mainPad.paddingBottom) || 0;
      const h = mainRect.bottom - elRect.top - padBottom;
      if (h > 0) el.style.height = `${h}px`;
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(main);
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener('resize', onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (vv) vv.removeEventListener('resize', onResize);
      main.style.overflow = prevOverflowRef.current;
      el.style.height = '';
    };
  }, []);

  return (
    <div className="nexus-claude" ref={shellRef}>
      <h1 className="sr-only">{AI_NAME}</h1>
      <div className="nc-header">
        <div className="nc-header-left">
          <button
            className="nc-chats-toggle"
            onClick={onToggleChats}
            aria-label="Suhbatlar ro'yxati"
          >
            <MessageCircle style={{ width: 18, height: 18 }} />
            {activeChatCount > 0 && (
              <span className="nc-chats-badge">{activeChatCount}</span>
            )}
          </button>
          <button
            className="nc-icon-btn nc-panel-toggle"
            onClick={onTogglePanel}
            aria-label={panelCollapsed ? "Suhbatlar ro'yxatini ochish" : "Suhbatlar ro'yxatini yig'ish"}
            title={panelCollapsed ? "Suhbatlar ro'yxatini ochish" : "Suhbatlar ro'yxatini yig'ish"}
            aria-expanded={!panelCollapsed}
          >
            <PanelLeft style={{ width: 18, height: 18 }} />
          </button>
          <span className="nc-header-title" title={title}>{title}</span>
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

function NexusEmptyState({ onPick, disabled }: { onPick: (q: string) => void; disabled: boolean }) {
  const reducedMotion = usePrefersReducedMotion();
  const canHover = useCanHover();

  return (
    <div className="nc-empty">
      <div className="nc-empty-docstack" aria-hidden="true">
        <DocStack phaseB={false} scanning={false} layers={canHover ? 4 : 2} reducedMotion={reducedMotion} canHover={canHover} active={false} />
      </div>
      <img src="/favicon.png" alt="" aria-hidden="true" className="nc-empty-favicon" />
      <h2 className="nc-empty-title">Huquqiy savol bering</h2>
      <p className="nc-empty-desc">
        O'zbekiston qonunchiligi bo'yicha savolingizni yozing. Tegishli moddalar va tushuntirish bilan javob beradi.
      </p>
      <div className="nc-suggestions">
        {SAMPLE_QUESTIONS.map((q, i) => (
          <button key={q} onClick={() => !disabled && onPick(q)} className={`nc-suggestion-card ${i >= 3 ? 'nc-suggestion-mobile-hidden' : ''}`} disabled={disabled}>
            <Sparkles className="nc-sparkle" />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── NexusThinking ───────────────────────── */

interface NexusThinkingProps {
  lexionUrls: string[] | undefined;
  jobCreatedAt: string | undefined;
  serverNow: string | undefined;
  mode: NasherMode | undefined;
}

// Kutish paytida ko'rsatiladigan qisqa foydali gaplar (har 9 soniyada almashadi)
const WAIT_TIPS = [
  "Boshqa oynaga o'tishingiz mumkin: javob tayyor bo'lganda sarlavhada ✓ belgisi chiqadi.",
  "Javobdagi qonun nomiga bossangiz, lex.uz da o'sha hujjat ochiladi.",
  "Vaziyatni aniqroq yozsangiz (kim, qachon, nima bo'ldi), javob ham aniqroq bo'ladi.",
  "Tez va qisqa javob kerak bo'lsa, «Lo'nda» rejimini tanlang.",
  "lex.uz — O'zbekiston qonun hujjatlarining rasmiy milliy bazasi.",
  "Muhim ishda javobni advokat bilan ham maslahatlashib oling.",
];

// Taxminiy davomiylik (s): progress chizig'i shunga qarab silliq to'ladi, hech qachon 100% ga yetmaydi
const MODE_EXPECTED_SEC: Record<NasherMode, number> = { lunda: 60, tezkor: 85, chuqur: 160 };

function NexusThinking({ lexionUrls, jobCreatedAt, serverNow, mode = 'chuqur' }: NexusThinkingProps) {
  const lexLinks = useMemo(() => (lexionUrls ?? []).filter(isLexUz), [lexionUrls]);
  const names = useLexNames(lexLinks.length > 0);
  const isPhaseB = lexLinks.length > 0;
  const now = useNow(1000);
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = serverNow ? new Date(serverNow).getTime() - Date.now() : 0;
  }, [serverNow]);

  const [elapsedSec, setElapsedSec] = useState(0);
  const prevElapsedRef = useRef(0);

  useEffect(() => {
    if (!jobCreatedAt) { setElapsedSec(0); prevElapsedRef.current = 0; return; }
    const start = new Date(jobCreatedAt).getTime();
    const calcSec = Math.max(0, Math.floor((now + offsetRef.current - start) / 1000));
    if (calcSec >= prevElapsedRef.current) {   // server vaqti kelganda orqaga sakramasin
      setElapsedSec(calcSec);
      prevElapsedRef.current = calcSec;
    }
  }, [now, jobCreatedAt]);

  // Chuqur: 2-bosqich (hujjatlar topildi) boshlangan vaqtni eslab qolamiz
  const phaseBAtRef = useRef<number | null>(null);
  if (isPhaseB && phaseBAtRef.current === null) phaseBAtRef.current = elapsedSec;

  const steps = mode === 'chuqur'
    ? ["Kerakli qonun hujjatlari izlanmoqda", "Topilgan hujjatlar o'qilmoqda", "Javob yozilmoqda"]
    : ["Kodekslar ochilmoqda", "Tegishli moddalar o'qilmoqda", "Javob yozilmoqda"];
  const step = mode === 'chuqur'
    ? (!isPhaseB ? 0 : elapsedSec - (phaseBAtRef.current ?? 0) < 20 ? 1 : 2)
    : (elapsedSec < 4 ? 0 : elapsedSec < 18 ? 1 : 2);
  const progress = Math.round(95 * (1 - Math.exp(-elapsedSec / (MODE_EXPECTED_SEC[mode] / 2))));
  const tip = WAIT_TIPS[Math.floor(elapsedSec / 9) % WAIT_TIPS.length];

  return (
    <div className="nc-thinking" aria-live="polite">
      <div className="nc-thinking-header">
        <Loader2 className="nc-thinking-icon" />
        <span className="nc-thinking-text" key={step}>{steps[step]}</span>
        <span className="nc-thinking-timer" aria-hidden="true">
          {jobCreatedAt ? formatElapsed(elapsedSec) : ''}
        </span>
      </div>
      <div className="nc-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
      <ol className="nc-steps" aria-hidden="true">
        {steps.map((t, i) => (
          <li key={t} className={i < step ? 'nc-step-done' : i === step ? 'nc-step-now' : ''}>
            {i < step ? <Check /> : <span className="nc-step-dot" />}
            {t}
          </li>
        ))}
      </ol>
      {isPhaseB && (
        <div className="nc-thinking-chips">
          {lexLinks.map((url, i) => (
            <a
              key={url}
              href={normalizeUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="nc-chip"
              title={lexDocName(url, names)}
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
            >
              <FileText style={{ width: 12, height: 12 }} />
              <span className="nc-chip-name">{lexDocName(url, names)}</span>
            </a>
          ))}
        </div>
      )}
      <p className="nc-thinking-tip" key={tip}>{tip}</p>
    </div>
  );
}

/* ───────────────────────── NexusMessage ───────────────────────── */

interface NexusMessageProps {
  msg: import('@/hooks/useNexusAiChat').ChatMessage;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  onRetry: (aiMsgId: string) => void;
}

function NexusMessage({ msg, copiedId, onCopy, onRetry }: NexusMessageProps) {
  const isDone = msg.role === 'assistant' && msg.status === 'done';
  const answer = useMemo(() => prepareAnswer(msg.content), [msg.content]);
  const { shown, typing } = useTypewriter(msg.id, answer, isDone && !!msg.fresh);
  const lexLinks = useMemo(() => (isDone ? (msg.lexionUrls ?? []).filter(isLexUz) : []), [isDone, msg.lexionUrls]);
  const names = useLexNames(lexLinks.length > 0);

  // Foydalanuvchi boshqa oynada bo'lsa, sarlavhada belgi: qaytib kelganda tiklanadi
  useEffect(() => {
    if (!isDone || !msg.fresh || !document.hidden) return;
    const prev = document.title;
    document.title = '✓ Javob tayyor · NaSher AI';
    const back = () => { if (!document.hidden) document.title = prev; };
    document.addEventListener('visibilitychange', back);
    return () => { document.removeEventListener('visibilitychange', back); document.title = prev; };
  }, [isDone, msg.fresh]);

  const finalSeconds = useMemo(() => {
    // serverNow yo'q (serverdan tiklangan javob): tugash vaqti noma'lum, noto'g'ri raqam ko'rsatilmaydi
    if (msg.role !== 'assistant' || msg.status !== 'done' || !msg.jobCreatedAt || !msg.serverNow) return null;
    const start = new Date(msg.jobCreatedAt).getTime();
    return Math.max(0, Math.floor((new Date(msg.serverNow).getTime() - start) / 1000));
  }, [msg.role, msg.status, msg.jobCreatedAt, msg.serverNow]);

  const modeMeta = NASHER_MODES.find(m => m.id === msg.mode);

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
          mode={msg.mode}
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
            <span>{stripSourceWords(msg.error ?? '')}</span>
          </div>
          <button onClick={() => onRetry(msg.id)} className="nc-error-retry">
            <RotateCcw /> Qayta urinish
          </button>
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
            <span>{stripSourceWords(msg.error ?? '')}</span>
          </div>
          <button onClick={() => onRetry(msg.id)} className="nc-error-retry">
            <RotateCcw /> Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nc-msg-assistant">
      <AnswerText text={shown} typing={typing} />
      {msg.lexionFallback && !typing && (
        <p className="nc-fallback-note">(Umumiy rejimda javob berildi)</p>
      )}
      {lexLinks.length > 0 && !typing && (
        <div className="nc-sources">
          <p className="nc-sources-label">
            <FileText style={{ width: 12, height: 12 }} />
            Qonun hujjatlari
          </p>
          <div className="nc-sources-list">
            {lexLinks.slice(0, 10).map((url) => (
              <a key={url} href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer" className="nc-source-link" title={lexDocName(url, names)}>
                <ExternalLink />
                <span className="nc-source-name">{lexDocName(url, names)}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      <div className={`nc-actions ${typing ? 'nc-actions-hidden' : ''}`} aria-live="polite">
        <button onClick={() => onCopy(msg.id, answer)} className="nc-action-btn" aria-label={copiedId === msg.id ? COPIED_LABEL : COPY_LABEL}>
          {copiedId === msg.id ? <Check /> : <Copy />}
          {copiedId === msg.id ? COPIED_LABEL : COPY_LABEL}
        </button>
        {modeMeta && (
          <span className="nc-answer-meta">
            <modeMeta.Icon className="nc-answer-meta-icon" />
            {modeMeta.label}
          </span>
        )}
        {finalSeconds !== null && (
          <span className="nc-answer-meta">
            <Clock className="nc-answer-meta-icon" />
            {formatElapsed(finalSeconds)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── NexusComposer ───────────────────────── */

// Tezlik tartibida: eng qisqasidan eng chuqurigacha
const NASHER_MODES: { id: NasherMode; label: string; hint: string; Icon: typeof Zap }[] = [
  { id: 'lunda', label: "Lo'nda", hint: "Qisqa javob: nima qilish kerak · ~1 daqiqa", Icon: Target },
  { id: 'tezkor', label: 'Tezkor', hint: "Moddalar bilan tushuntirish · ~1,5 daqiqa", Icon: Zap },
  { id: 'chuqur', label: 'Chuqur', hint: "Butun qonunchilik bo'yicha tahlil · ~2–3 daqiqa", Icon: Search },
];
const MODE_KEY = 'nasher_mode';

interface NexusComposerProps {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  mode: NasherMode;
  onModeChange: (m: NasherMode) => void;
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
  chatExpired: boolean;
  onNewChat: () => void;
  newChatBlocked: boolean;
  waitingElsewhere: boolean;
}

function NexusComposer({
  input, setInput, onSend, onKeyDown, mode, onModeChange,
  isProcessing, canSend, inputBlocked, inputTooLong, inputTooShort,
  minInput, maxInput, resetText, inputRef, chatLimitError, onOpenChats, memoryNote,
  chatExpired, onNewChat, newChatBlocked, waitingElsewhere,
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
  const textareaDisabled = isProcessing || inputBlocked || chatExpired;
  const sendDisabled = !canSend || chatExpired;
  const placeholder = chatExpired ? NEXUS_NOTES.EXPIRED_PLACEHOLDER : "Huquqiy savolingizni yozing...";

  return (
    <div className="nc-composer-wrap">
      {chatExpired ? (
        <div className="nc-expired-card">
          <p className="nc-expired-card-title">{NEXUS_NOTES.EXPIRED_COMPOSER_TITLE}</p>
          <p className="nc-expired-card-text">{NEXUS_NOTES.EXPIRED_COMPOSER_TEXT}</p>
          {newChatBlocked ? (
            <span className="nc-expired-card-limit">{NEXUS_NOTES.EXPIRED_LIMIT_TEXT}</span>
          ) : (
            <button onClick={onNewChat} className="nc-expired-card-btn">
              {NEXUS_NOTES.EXPIRED_NEW_CHAT_BTN}
            </button>
          )}
        </div>
      ) : (
        <>
          {chatLimitError && (
            <div className="nc-input-warning nc-chat-limit-warning">
              <span>{chatLimitError}</span>
              <button onClick={onOpenChats} className="nc-chat-limit-link">Suhbatlarni ochish</button>
            </div>
          )}
          {waitingElsewhere && !chatLimitError && (
            <div className="nc-input-warning">
              Boshqa suhbatdagi savolga javob tayyorlanmoqda. Javob kelgach yozishingiz mumkin.
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
        </>
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
            placeholder={placeholder}
            rows={1}
            disabled={textareaDisabled}
            className="nc-textarea"
            aria-label="Savol matni"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={onSend}
            disabled={sendDisabled}
            className="nc-send-btn"
            aria-label="Yuborish"
          >
            <ArrowUp />
          </button>
        </div>
        <div className="nc-composer-footer">
          <div className="nc-mode-switch" role="radiogroup" aria-label="Javob rejimi">
            {NASHER_MODES.map(m => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className={`nc-mode-btn nc-mode-${m.id} ${mode === m.id ? 'nc-mode-active' : ''}`}
                onClick={() => onModeChange(m.id)}
                title={m.hint}
              >
                <m.Icon />
                {m.label}
              </button>
            ))}
          </div>
          {input.length > maxInput * 0.8 && (
            <span className={`nc-counter nc-counter-sm ${counterWarn || inputTooLong ? 'nc-counter-warn' : ''}`}>
              {input.length} / {maxInput}
            </span>
          )}
        </div>
      </div>
      <div className="nc-composer-notes">
        <span className="nc-mode-hint" key={mode}>{NASHER_MODES.find(m => m.id === mode)!.hint}</span>
        <span className="nc-composer-disclaimer">{NEXUS_NOTES.AI_DISCLAIMER}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── TimerPill ───────────────────────── */

interface TimerPillProps {
  getChatTimer: (chatId: string, nowMs?: number) => { remaining: number; status: 'active' | 'expired' | 'none' };
  chatId: string;
  memoryEnabled: boolean;
  nowOverride?: number;
}

function TimerPill({ getChatTimer, chatId, memoryEnabled, nowOverride = 0 }: TimerPillProps) {
  const now = Math.max(useNow(), nowOverride);
  const [showPopover, setShowPopover] = useState(false);

  if (!memoryEnabled) return null;
  const timer = getChatTimer(chatId, now);
  if (timer.status !== 'active') return null;

  const tone = getTimerTone(timer.remaining);
  let cls = 'nc-timer-pill';
  if (tone === 'red') cls += ' nc-timer-pill-red nc-timer-pulse';
  else if (tone === 'amber') cls += ' nc-timer-pill-amber';
  else cls += ' nc-timer-pill-normal';

  return (
    <div className="nc-timer-pill-wrap">
      <button
        className={cls}
        onClick={() => setShowPopover(true)}
        aria-label="Xotira taymeri haqida ma'lumot"
        title="Chat xotirasi tugashigacha qolgan vaqt"
        aria-expanded={showPopover}
        aria-controls="nc-timer-popover"
      >
        <Clock style={{ width: 13, height: 13 }} />
        <span aria-hidden="true" className="nc-timer-pill-prefix">Xotira: </span>
        <span aria-hidden="true">{formatRemainingShort(timer.remaining)}</span>
        <Info style={{ width: 12, height: 12, opacity: 0.6 }} />
      </button>
      {showPopover && <TimerPopover onClose={() => setShowPopover(false)} />}
    </div>
  );
}

/* ───────────────────────── TimerBanner ───────────────────────── */

interface TimerBannerProps {
  getChatTimer: (chatId: string, nowMs?: number) => { remaining: number; status: 'active' | 'expired' | 'none' };
  chatId: string;
  memoryEnabled: boolean;
  nowOverride?: number;
}

function TimerBanner({ getChatTimer, chatId, memoryEnabled, nowOverride = 0 }: TimerBannerProps) {
  const now = Math.max(useNow(), nowOverride);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  if (!memoryEnabled) return null;
  const timer = getChatTimer(chatId, now);
  if (timer.status !== 'active') return null;

  const tone = getTimerTone(timer.remaining);
  if (tone === 'normal') return null;
  if (dismissedIds.has(chatId)) return null;

  const bannerText = NEXUS_NOTES.BANNER_WARNING.replace('{time}', formatRemainingShort(timer.remaining));
  const bannerRed = tone === 'red';

  return (
    <div className={`nc-timer-banner ${bannerRed ? 'nc-timer-banner-red' : ''}`}>
      <span>{bannerText}</span>
      <button
        onClick={() => setDismissedIds(prev => { const next = new Set(prev); next.add(chatId); return next; })}
        className="nc-timer-banner-close"
        aria-label="Yopish"
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

/* ───────────────────────── ResetLine ───────────────────────── */

interface ResetLineProps {
  quota: { next_reset_at: string | null; remaining: number; limit: number; is_unlimited: boolean } | null;
  serverOffset: number;
}

function ResetLine({ quota, serverOffset }: ResetLineProps) {
  const now = useNow();
  if (!quota || quota.is_unlimited || quota.remaining > 0 || !quota.next_reset_at) return null;
  const nowMs = now + serverOffset;
  const text = formatResetTime(quota.next_reset_at, nowMs);
  if (!text) return null;
  return <div className="nc-reset-line">Keyingi savol huquqi {text} tiklanadi</div>;
}

/* ───────────────────────── TimerChip ───────────────────────── */

function TimerChip({ remaining, status }: { remaining: number; status: 'active' | 'expired' | 'none' }) {
  if (status === 'none') return null;
  if (status === 'expired' || remaining <= 0) {
    return <span className="nc-timer-chip nc-timer-expired" aria-hidden="true">Tugadi</span>;
  }

  const tone = getTimerTone(remaining);
  let cls = 'nc-timer-chip nc-timer-normal';
  let icon = <Clock style={{ width: 11, height: 11 }} />;

  if (tone === 'amber') {
    cls = 'nc-timer-chip nc-timer-amber';
    icon = <span style={{ fontSize: 11, fontWeight: 700 }}>!</span>;
  } else if (tone === 'red') {
    cls = 'nc-timer-chip nc-timer-red nc-timer-pulse';
    icon = <span style={{ fontSize: 11, fontWeight: 700 }}>!</span>;
  }

  const srText = formatSrTimer(remaining);

  return (
    <span className={cls} aria-hidden="true" title="Suhbat xotirasi shu vaqtdan keyin tugaydi">
      {icon}
      {formatRemainingShort(remaining)} qoldi
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
  const canHover = useCanHover();
  const displayTitle = chat.title.charAt(0).toUpperCase() + chat.title.slice(1);

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
        <span className="nc-chat-title">{displayTitle}</span>
        <div className="nc-chat-meta">
          {hasPending && <span className="nc-chat-pending"><Loader2 style={{ width: 10, height: 10 }} /> ishlamoqda</span>}
          {timerStatus === 'expired' && <span className="nc-chat-date">{formatRelativeDate(chat.updatedAt)}</span>}
          {timerStatus === 'active' && !isActive && <TimerChip remaining={timerRemaining} status={timerStatus} />}
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
        (isActive || canHover || !canHover) && (
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
  getChatTimer: (chatId: string, nowMs?: number) => { remaining: number; status: 'active' | 'expired' | 'none' };
  pendingChatId: string | null;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onNewChat: () => void;
  activeCount: number;
  maxActive: number;
  memoryEnabled: boolean;
  chatsHydrated: boolean;
  nowOverride?: number;
  isDrawer?: boolean;
}

function ChatListPanel({
  chats, activeChatId, getChatTimer, pendingChatId, onSelect, onDelete, onNewChat,
  activeCount, maxActive, memoryEnabled, chatsHydrated, nowOverride = 0,
}: ChatListPanelProps) {
  const now = Math.max(useNow(), nowOverride);
  const pendingSet = useMemo(() => new Set(pendingChatId ? [pendingChatId] : []), [pendingChatId]);
  const atLimit = activeCount >= maxActive;

  const sortedChats = useMemo(() => [...chats].sort((a, b) => b.updatedAt - a.updatedAt), [chats]);

  const activeChats = sortedChats.filter(c => {
    const t = getChatTimer(c.chatId, now);
    return t.status === 'active' || pendingSet.has(c.chatId);
  });

  const expiredChats = sortedChats.filter(c => {
    const t = getChatTimer(c.chatId, now);
    return (t.status === 'expired' || t.status === 'none') && !pendingSet.has(c.chatId);
  }).slice(0, MAX_EXPIRED_CHATS);

  const activeExpiredIds = useMemo(() => new Set(expiredChats.filter(c => c.chatId === activeChatId).map(c => c.chatId)), [expiredChats, activeChatId]);
  const [expiredOpen, setExpiredOpen] = useState(false);
  useEffect(() => {
    if (activeExpiredIds.has(activeChatId)) setExpiredOpen(true);
  }, [activeExpiredIds, activeChatId]);

  const localActiveCount = activeChats.length;
  const displayCount = Math.max(activeCount, localActiveCount);
  const showOtherDeviceHint = activeCount > localActiveCount;

  const progressPct = Math.min(100, (displayCount / maxActive) * 100);
  let progressCls = 'nc-progress-bar';
  if (displayCount >= maxActive) progressCls += ' nc-progress-red';
  else if (displayCount >= maxActive - 2) progressCls += ' nc-progress-amber';

  return (
    <div className="nc-chat-list-panel">
      <div className="nc-panel-head-expanded">
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
              {NEXUS_NOTES.ACTIVE_CHATS}: {displayCount} / {maxActive}
            </span>
            <div className="nc-progress-track">
              <div className={progressCls} style={{ width: `${progressPct}%` }} />
            </div>
            {showOtherDeviceHint && (
              <span className="nc-other-device-hint">{NEXUS_NOTES.OTHER_DEVICE_HINT}</span>
            )}
          </div>
        )}
      </div>
      <div className="nc-chat-list-scroll">
        {chats.length === 0 && chatsHydrated && (
          <p className="nc-chat-empty">{NEXUS_NOTES.EMPTY_CHATS}</p>
        )}
        {memoryEnabled ? (
          <>
            {activeChats.length > 0 && (
              <>
                <div className="nc-chat-group-label">{NEXUS_NOTES.ACTIVE_CHATS}</div>
                {activeChats.map(chat => (
                  <ChatListItem
                    key={chat.chatId}
                    chat={chat}
                    isActive={chat.chatId === activeChatId}
                    timerRemaining={getChatTimer(chat.chatId, now).remaining}
                    timerStatus={getChatTimer(chat.chatId, now).status}
                    hasPending={pendingSet.has(chat.chatId)}
                    onSelect={() => onSelect(chat.chatId)}
                    onDelete={() => onDelete(chat.chatId)}
                  />
                ))}
              </>
            )}
            {expiredChats.length > 0 && (
              <>
                <button
                  className="nc-expired-group-header"
                  onClick={() => setExpiredOpen(v => !v)}
                  aria-expanded={expiredOpen}
                  aria-label={NEXUS_NOTES.EXPIRED_CHATS}
                >
                  <span className="nc-expired-group-label">{NEXUS_NOTES.EXPIRED_CHATS}</span>
                  <span className="nc-expired-group-count">{expiredChats.length}</span>
                  <span className="nc-expired-group-divider" />
                  <ChevronDown className={`nc-expired-group-chevron ${expiredOpen ? 'nc-expanded' : ''}`} />
                </button>
                {expiredOpen && expiredChats.map(chat => (
                  <ChatListItem
                    key={chat.chatId}
                    chat={chat}
                    isActive={chat.chatId === activeChatId}
                    timerRemaining={getChatTimer(chat.chatId, now).remaining}
                    timerStatus={getChatTimer(chat.chatId, now).status}
                    hasPending={pendingSet.has(chat.chatId)}
                    onSelect={() => onSelect(chat.chatId)}
                    onDelete={() => onDelete(chat.chatId)}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <div className="nc-chat-group-label">{NEXUS_NOTES.CHAT_LIST_TITLE}</div>
            {sortedChats.map(chat => (
              <ChatListItem
                key={chat.chatId}
                chat={chat}
                isActive={chat.chatId === activeChatId}
                timerRemaining={0}
                timerStatus="none"
                hasPending={pendingSet.has(chat.chatId)}
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
    <div ref={ref} id="nc-timer-popover" className="nc-timer-popover" role="dialog" aria-modal="false">
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

/** initialChatId: Telegram botdan "To'liq ko'rish" bosilganda aynan o'sha suhbat ochiladi */
export default function NexusAI({ userId, initialChatId }: { userId: string; initialChatId?: string }) {
  return (
    <NexusErrorBoundary>
      <NexusAIInner userId={userId} initialChatId={initialChatId} />
    </NexusErrorBoundary>
  );
}

function NexusAIInner({ userId, initialChatId }: { userId: string; initialChatId?: string }) {
  const {
    chats, activeChatId, messages, isProcessing, quota,
    memoryEnabled, chatLimitError, sendMessage, retry, deleteChat,
    switchChat, createNewChat, getChatTimer, isChatExpired,
    fetchChatsStatus, chatsStatus, serverOffset, pendingChatId,
    minInput, maxInput, chatsHydrated,
  } = useNexusAiChat(userId);
  const nowTick = useNow(60_000);   // limit tiklanish vaqti matni eskirib qolmasin

  // Botdan kelgan suhbat serverdan ro'yxatga tushishi bilan bir marta ochiladi
  const openedInitialRef = useRef(false);
  useEffect(() => {
    if (!initialChatId || openedInitialRef.current) return;
    if (!chats.some(c => c.chatId === initialChatId)) return;
    openedInitialRef.current = true;
    if (activeChatId !== initialChatId) switchChat(initialChatId);
  }, [initialChatId, chats, activeChatId, switchChat]);

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowOverride, setNowOverride] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.innerWidth < 1024) return false;
    return localStorage.getItem('nexus_chats_panel_collapsed_v1') === '1';
  });

  const togglePanel = useCallback(() => {
    setPanelCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexus_chats_panel_collapsed_v1', next ? '1' : '0');
      }
      return next;
    });
  }, []);

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

  const [mode, setMode] = useState<NasherMode>(() => {
    try { const v = localStorage.getItem(MODE_KEY); return NASHER_MODES.some(m => m.id === v) ? v as NasherMode : 'chuqur'; } catch { return 'chuqur'; }
  });
  const changeMode = useCallback((m: NasherMode) => {
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* xususiy rejim: faqat shu sessiyada eslanadi */ }
  }, []);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    if (input.trim().length < minInput) return;
    if (input.length > maxInput) return;
    if (quota && !quota.is_unlimited && quota.remaining <= 0) return;
    if (isChatExpired(activeChatId)) return;
    sendMessage(input, mode);
    setInput('');
  }, [input, isProcessing, minInput, maxInput, quota, sendMessage, isChatExpired, activeChatId, mode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleCopy = useCallback((id: string, text: string) => {
    const done = () => { setCopiedId(id); setTimeout(() => setCopiedId(null), 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch { /* ignore */ }
        document.body.removeChild(ta);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  }, []);

  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    if (window.confirm("Suhbatni o'chirish? Barcha xabarlar shu qurilmadan o'chiriladi.")) {
      deleteChat(activeChatId);
    }
  }, [messages.length, deleteChat, activeChatId]);

  const isLimited = quota && !quota.is_unlimited;
  const remaining = isLimited ? quota!.remaining : 99;
  const limit = isLimited ? quota!.limit : 99;
  const resetText = isLimited ? formatResetTime(quota!.next_reset_at!, nowTick + serverOffset) : null;
  const inputBlocked = isLimited && remaining <= 0;
  const inputTooShort = input.trim().length > 0 && input.trim().length < minInput;
  const inputTooLong = input.length > maxInput;

  const chatExpired = memoryEnabled && isChatExpired(activeChatId);
  const canSend = input.trim().length >= minInput && !inputTooLong && !isProcessing && !inputBlocked && !chatExpired;

  const quotaPill = isLimited ? (
    <div className={`nc-quota-pill ${remaining <= 2 ? 'nc-quota-pill-low' : ''}`} aria-live="polite" title={`Qolgan savollar: ${remaining} / ${limit}`} aria-label={`Qolgan savollar: ${remaining} / ${limit}`}>
      <span className="nc-quota-full-text">Qolgan savollar: {remaining} / {limit}</span>
      <span className="nc-quota-short-text" aria-hidden="true">{remaining} / {limit}</span>
    </div>
  ) : null;

  const activeCount = chatsStatus?.active_count ?? 0;
  const maxActive = chatsStatus?.max_active ?? MAX_ACTIVE_CHATS;

  const memoryNote = !memoryEnabled
    ? NEXUS_NOTES.NO_MEMORY
    : chatExpired
      ? NEXUS_NOTES.MEMORY_EXPIRED_NOTE
      : getChatTimer(activeChatId).status === 'active'
        ? NEXUS_NOTES.MEMORY_ACTIVE
        : NEXUS_NOTES.MEMORY_COLD;

  // One-time timeout when active chat expires
  const expiresAtIso = chatsStatus?.chats?.[activeChatId]?.expires_at;
  const [, setExpiredBump] = useState(0);
  useEffect(() => {
    if (!expiresAtIso || !memoryEnabled) return;
    const expires = new Date(expiresAtIso).getTime();
    const now = Date.now() + serverOffset;
    const ms = expires - now;
    if (ms <= 0) return;
    const t = setTimeout(() => {
      setExpiredBump(b => b + 1);
      setNowOverride(Date.now());
      fetchChatsStatus();
    }, ms + 300);
    return () => clearTimeout(t);
  }, [expiresAtIso, serverOffset, memoryEnabled, fetchChatsStatus]);

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
      resetLine={<ResetLine quota={quota} serverOffset={serverOffset} />}
      onToggleChats={() => setDrawerOpen(true)}
      activeChatCount={activeCount}
      timerPill={
        <TimerPill
          getChatTimer={getChatTimer}
          chatId={activeChatId}
          memoryEnabled={memoryEnabled}
          nowOverride={nowOverride}
        />
      }
      panelCollapsed={panelCollapsed}
      onTogglePanel={togglePanel}
      title={chats.find(c => c.chatId === activeChatId)?.title || NEXUS_NOTES.NEW_CHAT}
    >
      <div className="nc-layout">
        {/* Desktop chat list panel */}
        <aside className={`nc-chat-sidebar ${panelCollapsed ? 'nc-chat-sidebar-collapsed' : ''}`}>
          <div className="nc-chat-sidebar-inner">
            <ChatListPanel
            chats={chats}
            activeChatId={activeChatId}
            getChatTimer={getChatTimer}
            pendingChatId={pendingChatId}
            onSelect={handleSelectChat}
            onDelete={handleDeleteChat}
            onNewChat={handleNewChat}
            activeCount={activeCount}
            maxActive={maxActive}
            memoryEnabled={memoryEnabled}
            chatsHydrated={chatsHydrated}
            nowOverride={nowOverride}
          />
          </div>
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
                pendingChatId={pendingChatId}
                onSelect={handleSelectChat}
                onDelete={handleDeleteChat}
                onNewChat={handleNewChat}
                activeCount={activeCount}
                maxActive={maxActive}
                memoryEnabled={memoryEnabled}
                chatsHydrated={chatsHydrated}
                nowOverride={nowOverride}
                isDrawer
              />
            </aside>
          </>
        )}

        {/* Main chat area */}
        <div className="nc-main-area">
          <TimerBanner
            getChatTimer={getChatTimer}
            chatId={activeChatId}
            memoryEnabled={memoryEnabled}
            nowOverride={nowOverride}
          />
          <div className="nc-scroll-container" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div ref={scrollRef} className="nc-scroll">
              {messages.length === 0 ? (
                <NexusEmptyState onPick={(q) => { setInput(q); inputRef.current?.focus(); }} disabled={chatExpired} />
              ) : (
                <div className="nc-messages">
                  {messages.map((msg) => (
                    <NexusMessage
                      key={msg.id}
                      msg={msg}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onRetry={retry}
                    />
                  ))}
                  {chatExpired && (
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
            mode={mode}
            onModeChange={changeMode}
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
            chatExpired={chatExpired}
            onNewChat={handleNewChat}
            newChatBlocked={activeCount >= maxActive}
            waitingElsewhere={!!pendingChatId && pendingChatId !== activeChatId}
          />
        </div>
      </div>
    </NexusShell>
  );
}
