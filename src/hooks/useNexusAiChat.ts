import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { AI_NAME, MIN_CHAT_INPUT, MAX_CHAT_INPUT } from '@/constants/nexus';

export type ChatJobStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'timeout';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: ChatJobStatus;
  jobId?: string;
  error?: string;
  lexionPhase?: string | null;
  lexionFallback?: boolean;
  lexionUrls?: string[];
  createdAt: number;
  jobCreatedAt?: string;
  serverNow?: string;
}

export interface QuotaInfo {
  limit: number;
  window_hours: number;
  used: number;
  remaining: number;
  next_reset_at: string | null;
  server_now: string;
  is_unlimited: boolean;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 1800000;
const STORAGE_KEY_PREFIX = 'nexus_chat_v1';
const CHAT_ID_KEY_PREFIX = 'nexus_chat_id_v1';
const MAX_HISTORY = 50;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

function chatIdKey(userId: string): string {
  return `${CHAT_ID_KEY_PREFIX}_${userId}`;
}

function getOrCreateChatId(userId: string): string {
  try {
    let id = localStorage.getItem(chatIdKey(userId));
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(chatIdKey(userId), id); }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function resetChatId(userId: string) {
  try { localStorage.removeItem(chatIdKey(userId)); } catch { /* e'tiborsiz */ }
}

function loadHistory(userId: string): { messages: ChatMessage[]; pendingJobId?: string } {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { messages: [] };
    const rawMessages = parsed.messages;
    if (!Array.isArray(rawMessages)) return { messages: [] };
    const messages = rawMessages
      .filter((m: unknown): m is ChatMessage =>
        m !== null && typeof m === 'object' && typeof (m as ChatMessage).id === 'string' && typeof (m as ChatMessage).role === 'string'
      )
      .slice(-MAX_HISTORY);
    const pendingJobId = typeof parsed.pendingJobId === 'string' ? parsed.pendingJobId : undefined;
    return { messages, pendingJobId };
  } catch {
    return { messages: [] };
  }
}

function saveHistory(userId: string, messages: ChatMessage[], pendingJobId?: string) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({
      messages: messages.slice(-MAX_HISTORY),
      pendingJobId: pendingJobId || undefined,
    }));
  } catch {
    // ignore
  }
}

function clearHistory(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

async function callEdgeFunction(fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || `So'rov xatosi (${res.status})`) as Error & { code?: string; next_reset_at?: string };
    if (data?.code) err.code = data.code;
    if (data?.next_reset_at) err.next_reset_at = data.next_reset_at;
    throw err;
  }
  return data;
}

export function useNexusAiChat(userId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);

  // Load history from localStorage on mount
  useEffect(() => {
    if (!userId) return;
    let loaded: ChatMessage[] = [];
    let pendingJobId: string | undefined;
    try {
      const result = loadHistory(userId);
      loaded = Array.isArray(result.messages) ? result.messages : [];
      pendingJobId = typeof result.pendingJobId === 'string' ? result.pendingJobId : undefined;
    } catch {
      loaded = [];
      pendingJobId = undefined;
    }
    setMessages(loaded);
    if (pendingJobId) {
      // Check if pending job is stale (>20 min old) before polling
      const pendingMsg = loaded.find(m => m.jobId === pendingJobId);
      const jobAgeMs = pendingMsg?.createdAt ? Date.now() - pendingMsg.createdAt : 0;
      if (jobAgeMs > 20 * 60 * 1000) {
        // Stale — mark as error, clear pending, don't block user
        setMessages(prev => prev.map(m =>
          m.jobId === pendingJobId
            ? { ...m, status: 'error' as ChatJobStatus, error: "Server qayta ishga tushdi, savolni qayta yuboring." }
            : m
        ));
        try { saveHistory(userId, loaded.filter(m => m.jobId !== pendingJobId)); } catch { /* e'tiborsiz */ }
      } else {
        setIsProcessing(true);
        startPolling(pendingJobId, userId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (!userId) return;
    const pending = messages.find(m => m.jobId && (m.status === 'queued' || m.status === 'running'));
    saveHistory(userId, messages, pending?.jobId);
  }, [messages, userId]);

  // Fetch quota
  const fetchQuota = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await callEdgeFunction('nexus-quota', { user_id: userId });
      setQuota(data as QuotaInfo);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  // Refresh quota on visibility/focus
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchQuota();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [userId, fetchQuota]);

  // Timer to refetch quota when reset time arrives
  useEffect(() => {
    if (!quota?.next_reset_at || quota.remaining >= quota.limit) return;
    const msUntilReset = new Date(quota.next_reset_at).getTime() - Date.now();
    if (msUntilReset <= 0) {
      fetchQuota();
      return;
    }
    const timer = setTimeout(() => fetchQuota(), msUntilReset + 500);
    return () => clearTimeout(timer);
  }, [quota, fetchQuota]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId: string, uid: string) => {
    stopPolling();
    pollStart.current = Date.now();

    pollTimer.current = setInterval(async () => {
      const elapsed = Date.now() - pollStart.current;
      if (elapsed > MAX_POLL_MS) {
        stopPolling();
        setIsProcessing(false);
        setMessages(prev => prev.map(m =>
          m.jobId === jobId
            ? { ...m, status: 'timeout', error: 'Javob hali tayyor emas. Keyinroq urinib ko\'ring.' }
            : m
        ));
        return;
      }

      try {
        const data = await callEdgeFunction('case-answer-status', { id: jobId, ustoz_id: uid });
        if (data.status === 'done') {
          stopPolling();
          setIsProcessing(false);
          fetchQuota();
          setMessages(prev => prev.map(m =>
            m.jobId === jobId
              ? {
                  ...m,
                  status: 'done',
                  content: data.answer || '',
                  error: undefined,
                  lexionPhase: data.lexion_phase || null,
                  lexionFallback: data.lexion_fallback || false,
                  lexionUrls: Array.isArray(data.lexion_urls) ? data.lexion_urls : Array.isArray(data.urls) ? data.urls : undefined,
                  jobCreatedAt: data.created_at || m.jobCreatedAt,
                  serverNow: data.server_now,
                }
              : m
          ));
        } else if (data.status === 'error') {
          stopPolling();
          setIsProcessing(false);
          setMessages(prev => prev.map(m =>
            m.jobId === jobId
              ? { ...m, status: 'error', error: data.error || 'Xatolik', content: data.error || 'Xatolik yuz berdi', lexionPhase: data.lexion_phase ?? null }
              : m
          ));
        } else {
          setMessages(prev => prev.map(m =>
            m.jobId === jobId
              ? {
                  ...m,
                  status: data.status as ChatJobStatus,
                  lexionPhase: data.lexion_phase ?? data.phase ?? null,
                  lexionFallback: data.lexion_fallback ?? false,
                  lexionUrls: Array.isArray(data.lexion_urls) ? data.lexion_urls : Array.isArray(data.urls) ? data.urls : m.lexionUrls,
                  jobCreatedAt: data.created_at || m.jobCreatedAt,
                  serverNow: data.server_now,
                }
              : m
          ));
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, fetchQuota]);

  const sendMessage = useCallback(async (text: string) => {
    if (!userId || !text.trim() || isProcessing) return;
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHAT_INPUT || trimmed.length > MAX_CHAT_INPUT) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };
    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      status: 'queued',
      createdAt: Date.now() + 1,
    };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setIsProcessing(true);

    try {
      const payload: Record<string, unknown> = {
        kazus_text: trimmed,
        title: trimmed.slice(0, 100),
        ustoz_id: userId,
        answer_mode: 'lexion',
        chat_id: getOrCreateChatId(userId),
      };
      const data = await callEdgeFunction('case-answer-submit', payload);

      if (data.id) {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, jobId: data.id, jobCreatedAt: new Date().toISOString() } : m
        ));
        fetchQuota();
        startPolling(data.id, userId);
      } else if (data.error) {
        setIsProcessing(false);
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, status: 'error', error: data.error, content: data.error } : m
        ));
      }
    } catch (err) {
      setIsProcessing(false);
      const e = err as Error & { code?: string; next_reset_at?: string };
      let errorMsg = e.message || 'Xatolik yuz berdi';
      if (e.code === 'quota_exceeded' || e.code === 'active_job') {
        errorMsg = e.message;
      }
      // active_job bloklash — saqlangan pending job'ni tozalash
      if (e.code === 'active_job') {
        const pending = messages.find(m => m.jobId && (m.status === 'queued' || m.status === 'running'));
        if (pending?.jobId) {
          // Pending job stale bo'lishi mumkin — tozalang
          saveHistory(userId, messages.filter(m => m.jobId !== pending.jobId));
        }
      }
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, status: 'error', error: errorMsg, content: errorMsg } : m
      ));
      fetchQuota();
    }
  }, [userId, isProcessing, startPolling, fetchQuota]);

  const retry = useCallback(async (jobId: string | undefined, originalText: string) => {
    if (!jobId || !userId) return;
    setMessages(prev => prev.filter(m => m.jobId !== jobId));
    await sendMessage(originalText);
  }, [userId, sendMessage]);

  const clearChat = useCallback(() => {
    if (!userId) return;
    clearHistory(userId);
    resetChatId(userId);
    setMessages([]);
    stopPolling();
    setIsProcessing(false);
  }, [userId, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    messages,
    isProcessing,
    quota,
    sendMessage,
    retry,
    clearChat,
    minInput: MIN_CHAT_INPUT,
    maxInput: MAX_CHAT_INPUT,
    aiName: AI_NAME,
  };
}
