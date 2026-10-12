import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { AI_NAME, MIN_CHAT_INPUT, MAX_CHAT_INPUT, MAX_ACTIVE_CHATS, MAX_EXPIRED_CHATS } from '@/constants/nexus';

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

export interface ChatMeta {
  chatId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatStatusInfo {
  status: string;
  expires_at: string | null;
  turns: number;
}

export interface ChatsStatusResponse {
  server_now: string;
  memory_enabled: boolean;
  max_active: number;
  active_count: number;
  chats: Record<string, ChatStatusInfo>;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 1800000;
const STATUS_REFRESH_MS = 60000;
const CHATS_KEY_PREFIX = 'nexus_chats_v2';
const MSGS_KEY_PREFIX = 'nexus_chat_msgs_v2';
const LEGACY_HISTORY_PREFIX = 'nexus_chat_v1';
const LEGACY_CHATID_PREFIX = 'nexus_chat_id_v1';
const MAX_HISTORY = 50;

function chatsKey(userId: string): string {
  return `${CHATS_KEY_PREFIX}_${userId}`;
}

function msgsKey(userId: string, chatId: string): string {
  return `${MSGS_KEY_PREFIX}_${userId}_${chatId}`;
}

function msgsKeyPrefix(userId: string): string {
  return `${MSGS_KEY_PREFIX}_${userId}_`;
}

function legacyHistoryKey(userId: string): string {
  return `${LEGACY_HISTORY_PREFIX}_${userId}`;
}

function legacyChatIdKey(userId: string): string {
  return `${LEGACY_CHATID_PREFIX}_${userId}`;
}

function loadChatsList(userId: string): ChatMeta[] {
  try {
    const raw = localStorage.getItem(chatsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c: unknown): c is ChatMeta =>
        c !== null && typeof c === 'object' &&
        typeof (c as ChatMeta).chatId === 'string' &&
        typeof (c as ChatMeta).title === 'string',
    );
  } catch {
    return [];
  }
}

function saveChatsList(userId: string, chats: ChatMeta[]) {
  try {
    localStorage.setItem(chatsKey(userId), JSON.stringify(chats));
  } catch { /* ignore */ }
}

function loadChatMessages(userId: string, chatId: string): { messages: ChatMessage[]; pendingJobId?: string } {
  try {
    const raw = localStorage.getItem(msgsKey(userId, chatId));
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { messages: [] };
    const rawMessages = parsed.messages;
    if (!Array.isArray(rawMessages)) return { messages: [] };
    const messages = rawMessages
      .filter((m: unknown): m is ChatMessage =>
        m !== null && typeof m === 'object' && typeof (m as ChatMessage).id === 'string' && typeof (m as ChatMessage).role === 'string',
      )
      .slice(-MAX_HISTORY);
    const pendingJobId = typeof parsed.pendingJobId === 'string' ? parsed.pendingJobId : undefined;
    return { messages, pendingJobId };
  } catch {
    return { messages: [] };
  }
}

function saveChatMessages(userId: string, chatId: string, messages: ChatMessage[], pendingJobId?: string) {
  try {
    if (messages.length === 0) {
      localStorage.removeItem(msgsKey(userId, chatId));
      return;
    }
    localStorage.setItem(msgsKey(userId, chatId), JSON.stringify({
      messages: messages.slice(-MAX_HISTORY),
      pendingJobId: pendingJobId || undefined,
    }));
  } catch { /* ignore */ }
}

function deleteChatMessages(userId: string, chatId: string) {
  try { localStorage.removeItem(msgsKey(userId, chatId)); } catch { /* ignore */ }
}

function rebuildChatsFromStorage(userId: string): ChatMeta[] {
  const prefix = msgsKeyPrefix(userId);
  const metas: ChatMeta[] = [];
  const chatIds = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const chatId = key.slice(prefix.length);
    if (!chatId) continue;
    const { messages } = loadChatMessages(userId, chatId);
    if (messages.length === 0) {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      continue;
    }
    const firstUser = messages.find(m => m.role === 'user');
    const title = firstUser ? firstUser.content.slice(0, 40) : 'Suhbat';
    const createdAt = messages[0].createdAt;
    const updatedAt = messages[messages.length - 1].createdAt;
    metas.push({ chatId, title, createdAt, updatedAt });
    chatIds.add(chatId);
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
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
    const err = new Error(data?.error || `So'rov xatosi (${res.status})`) as Error & { code?: string; next_reset_at?: string; max?: number };
    if (data?.code) err.code = data.code;
    if (data?.next_reset_at) err.next_reset_at = data.next_reset_at;
    if (data?.max) err.max = data.max;
    throw err;
  }
  return data;
}

function migrateLegacyChats(userId: string): ChatMeta[] {
  try {
    const existing = localStorage.getItem(chatsKey(userId));
    if (existing) return [];
    const legacyRaw = localStorage.getItem(legacyHistoryKey(userId));
    const legacyChatId = localStorage.getItem(legacyChatIdKey(userId));
    if (legacyChatId) {
      const chatId = legacyChatId;
      let title = 'Eski suhbat';
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw);
          if (parsed?.messages && Array.isArray(parsed.messages)) {
            const firstUser = parsed.messages.find((m: ChatMessage) => m.role === 'user');
            if (firstUser) title = firstUser.content.slice(0, 40);
          }
        } catch { /* ignore */ }
      }
      const meta: ChatMeta = {
        chatId,
        title,
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now(),
      };
      saveChatsList(userId, [meta]);
      return [meta];
    }
  } catch { /* ignore */ }
  return [];
}

export function useNexusAiChat(userId: string | undefined) {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [chatsHydrated, setChatsHydrated] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [chatsStatus, setChatsStatus] = useState<ChatsStatusResponse | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [chatLimitError, setChatLimitError] = useState<string | null>(null);
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);
  const pollingJobId = useRef<string | null>(null);
  const pollingChatId = useRef<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasHidden = useRef(false);
  const activeChatIdRef = useRef<string>('');
  const userIdRef = useRef<string | undefined>(userId);

  activeChatIdRef.current = activeChatId;
  userIdRef.current = userId;

  // ── Initialize: migrate + load chat list + rebuild from storage + pick active chat ──
  useEffect(() => {
    if (!userId) return;
    setChatsHydrated(false);
    const migrated = migrateLegacyChats(userId);
    const loaded = loadChatsList(userId);
    const rebuilt = rebuildChatsFromStorage(userId);
    const byId = new Map<string, ChatMeta>();
    for (const m of rebuilt) byId.set(m.chatId, m);
    for (const m of loaded.length > 0 ? loaded : migrated) {
      if (!byId.has(m.chatId)) byId.set(m.chatId, m);
    }
    const list = Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    setChats(list);
    setChatsHydrated(true);
    if (list.length > 0) {
      const first = list[0];
      setActiveChatId(first.chatId);
      const { messages: msgs, pendingJobId } = loadChatMessages(userId, first.chatId);
      setMessages(msgs);
      if (pendingJobId) {
        const pendingMsg = msgs.find(m => m.jobId === pendingJobId);
        const jobAgeMs = pendingMsg?.createdAt ? Date.now() - pendingMsg.createdAt : 0;
        if (jobAgeMs > 20 * 60 * 1000) {
          setMessages(prev => prev.map(m =>
            m.jobId === pendingJobId
              ? { ...m, status: 'error' as ChatJobStatus, error: "Server qayta ishga tushdi, savolni qayta yuboring." }
              : m,
          ));
        } else {
          setIsProcessing(true);
          setPendingChatId(first.chatId);
          pollingJobId.current = pendingJobId;
          pollingChatId.current = first.chatId;
          startPolling(pendingJobId, userId, first.chatId);
        }
      }
    } else {
      setActiveChatId(crypto.randomUUID());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── Save chats list when it changes (only after hydration) ──
  useEffect(() => {
    if (!userId || !chatsHydrated) return;
    saveChatsList(userId, chats);
    // Cleanup expired chats beyond MAX_EXPIRED_CHATS
    if (chatsStatus?.memory_enabled) {
      const expired = chats.filter(c => {
        const info = chatsStatus.chats[c.chatId];
        if (!info || !info.expires_at) return false;
        const expires = new Date(info.expires_at).getTime();
        return expires <= Date.now() + serverOffset;
      }).sort((a, b) => a.updatedAt - b.updatedAt);
      if (expired.length > MAX_EXPIRED_CHATS) {
        const toRemove = expired.slice(0, expired.length - MAX_EXPIRED_CHATS);
        for (const c of toRemove) {
          if (c.chatId === activeChatIdRef.current) continue;
          if (c.chatId === pendingChatId) continue;
          deleteChatMessages(userId, c.chatId);
        }
        const removeIds = new Set(toRemove.map(c => c.chatId));
        setChats(prev => prev.filter(c => !removeIds.has(c.chatId)));
      }
    }
  }, [chats, userId, chatsHydrated, chatsStatus, serverOffset, pendingChatId]);

  // ── Save messages when they change ──
  useEffect(() => {
    if (!userId || !activeChatId) return;
    const pending = messages.find(m => m.jobId && (m.status === 'queued' || m.status === 'running'));
    if (messages.length === 0) {
      deleteChatMessages(userId, activeChatId);
    } else {
      saveChatMessages(userId, activeChatId, messages, pending?.jobId);
    }
  }, [messages, userId, activeChatId]);

  // ── Fetch quota ──
  const fetchQuota = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await callEdgeFunction('nexus-quota', { user_id: userId });
      setQuota(data as QuotaInfo);
      if (data.server_now) {
        setServerOffset(new Date(data.server_now).getTime() - Date.now());
      }
    } catch { /* ignore */ }
  }, [userId]);

  useEffect(() => { fetchQuota(); }, [fetchQuota]);

  // ── Fetch chats status (timers + memory) ──
  const fetchChatsStatus = useCallback(async () => {
    if (!userId || chats.length === 0) return;
    const chatIds = chats.map(c => c.chatId);
    try {
      const data = await callEdgeFunction('nexus-chats-status', { user_id: userId, chat_ids: chatIds }) as ChatsStatusResponse;
      setChatsStatus(data);
      const serverNow = new Date(data.server_now).getTime();
      setServerOffset(serverNow - Date.now());
    } catch { /* ignore */ }
  }, [userId, chats]);

  useEffect(() => {
    fetchChatsStatus();
  }, [fetchChatsStatus]);

  // ── Status refresh: every 60s when visible ──
  useEffect(() => {
    if (!userId) return;
    const startTimer = () => {
      if (statusTimer.current) clearInterval(statusTimer.current);
      statusTimer.current = setInterval(() => fetchChatsStatus(), STATUS_REFRESH_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (wasHidden.current) {
          wasHidden.current = false;
          fetchChatsStatus();
          fetchQuota();
        }
        startTimer();
      } else {
        wasHidden.current = true;
        if (statusTimer.current) { clearInterval(statusTimer.current); statusTimer.current = null; }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    if (document.visibilityState === 'visible') startTimer();
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      if (statusTimer.current) clearInterval(statusTimer.current);
    };
  }, [userId, fetchChatsStatus, fetchQuota]);

  // ── Quota reset timer ──
  useEffect(() => {
    if (!quota?.next_reset_at || quota.remaining >= quota.limit) return;
    const msUntilReset = new Date(quota.next_reset_at).getTime() - (Date.now() + serverOffset);
    if (msUntilReset <= 0) { fetchQuota(); return; }
    const timer = setTimeout(() => fetchQuota(), msUntilReset + 500);
    return () => clearTimeout(timer);
  }, [quota, fetchQuota, serverOffset]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    setPendingChatId(null);
  }, []);

  // ── Apply job message update to correct chat (active or background) ──
  const applyToJobMessage = useCallback((
    chatId: string,
    jobId: string,
    updater: (m: ChatMessage) => ChatMessage,
  ) => {
    if (chatId === activeChatIdRef.current) {
      setMessages(prev => prev.map(m => m.jobId === jobId ? updater(m) : m));
    } else {
      const uid = userIdRef.current;
      if (!uid) return;
      const { messages: msgs } = loadChatMessages(uid, chatId);
      if (msgs.length === 0) return;
      const updated = msgs.map(m => m.jobId === jobId ? updater(m) : m);
      const pending = updated.find(m => m.jobId && (m.status === 'queued' || m.status === 'running'));
      saveChatMessages(uid, chatId, updated, pending?.jobId);
    }
  }, []);

  const startPolling = useCallback((jobId: string, uid: string, chatId: string) => {
    stopPolling();
    pollStart.current = Date.now();
    setPendingChatId(chatId);

    pollTimer.current = setInterval(async () => {
      const elapsed = Date.now() - pollStart.current;
      if (elapsed > MAX_POLL_MS) {
        stopPolling();
        setIsProcessing(false);
        applyToJobMessage(chatId, jobId, m =>
          ({ ...m, status: 'timeout' as ChatJobStatus, error: 'Javob hali tayyor emas. Keyinroq urinib ko\'ring.' }),
        );
        return;
      }

      try {
        const data = await callEdgeFunction('case-answer-status', { id: jobId, ustoz_id: uid });
        if (data.status === 'done') {
          stopPolling();
          setIsProcessing(false);
          fetchQuota();
          applyToJobMessage(chatId, jobId, m => ({
            ...m,
            status: 'done',
            content: data.answer || '',
            error: undefined,
            lexionPhase: data.lexion_phase || null,
            lexionFallback: data.lexion_fallback || false,
            lexionUrls: Array.isArray(data.lexion_urls) ? data.lexion_urls : Array.isArray(data.urls) ? data.urls : undefined,
            jobCreatedAt: data.created_at || m.jobCreatedAt,
            serverNow: data.server_now,
          }));
          fetchChatsStatus();
        } else if (data.status === 'error') {
          stopPolling();
          setIsProcessing(false);
          applyToJobMessage(chatId, jobId, m => ({
            ...m,
            status: 'error',
            error: data.error || 'Xatolik',
            content: data.error || 'Xatolik yuz berdi',
            lexionPhase: data.lexion_phase ?? null,
          }));
        } else {
          applyToJobMessage(chatId, jobId, m => ({
            ...m,
            status: data.status as ChatJobStatus,
            lexionPhase: data.lexion_phase ?? data.phase ?? null,
            lexionFallback: data.lexion_fallback ?? false,
            lexionUrls: Array.isArray(data.lexion_urls) ? data.lexion_urls : Array.isArray(data.urls) ? data.urls : m.lexionUrls,
            jobCreatedAt: data.created_at || m.jobCreatedAt,
            serverNow: data.server_now,
          }));
        }
      } catch {
        // Network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, fetchQuota, fetchChatsStatus, applyToJobMessage]);

  // ── Get timer info for a chat ──
  const getChatTimer = useCallback((chatId: string, nowMs?: number): { remaining: number; status: 'active' | 'expired' | 'none' } => {
    if (!chatsStatus?.memory_enabled) return { remaining: 0, status: 'none' };
    const info = chatsStatus.chats[chatId];
    if (!info || !info.expires_at) return { remaining: 0, status: 'none' };
    const expires = new Date(info.expires_at).getTime();
    const now = (nowMs ?? Date.now()) + serverOffset;
    const remaining = expires - now;
    if (remaining <= 0) return { remaining: 0, status: 'expired' };
    return { remaining, status: 'active' };
  }, [chatsStatus, serverOffset]);

  // ── Is chat expired ──
  const isChatExpired = useCallback((chatId: string): boolean => {
    if (!chatsStatus?.memory_enabled) return false;
    return getChatTimer(chatId).status === 'expired';
  }, [chatsStatus, getChatTimer]);

  const switchChat = useCallback((chatId: string) => {
    if (!userId || chatId === activeChatId) return;
    setActiveChatId(chatId);
    setChatLimitError(null);
    const { messages: msgs, pendingJobId } = loadChatMessages(userId, chatId);
    setMessages(msgs);
    if (pendingJobId) {
      const pendingMsg = msgs.find(m => m.jobId === pendingJobId);
      if (pendingMsg && (pendingMsg.status === 'queued' || pendingMsg.status === 'running')) {
        const jobAgeMs = pendingMsg?.createdAt ? Date.now() - pendingMsg.createdAt : 0;
        if (jobAgeMs <= 20 * 60 * 1000) {
          setIsProcessing(true);
          setPendingChatId(chatId);
          pollingJobId.current = pendingJobId;
          pollingChatId.current = chatId;
          startPolling(pendingJobId, userId, chatId);
          return;
        }
      }
    }
    if (pollingJobId.current && pollingChatId.current && pollingChatId.current !== chatId) {
      setIsProcessing(true);
    } else {
      setIsProcessing(false);
    }
  }, [userId, activeChatId, startPolling]);

  const createNewChat = useCallback(() => {
    if (!userId) return;
    const activeCount = chatsStatus?.active_count ?? 0;
    const maxActive = chatsStatus?.max_active ?? MAX_ACTIVE_CHATS;
    if (activeCount >= maxActive) return;
    const newId = crypto.randomUUID();
    setActiveChatId(newId);
    setMessages([]);
    setChatLimitError(null);
    stopPolling();
    setIsProcessing(false);
    pollingJobId.current = null;
    pollingChatId.current = null;
  }, [userId, chatsStatus, stopPolling]);

  const sendMessage = useCallback(async (text: string) => {
    if (!userId || !text.trim() || isProcessing) return;
    const trimmed = text.trim();
    if (trimmed.length < MIN_CHAT_INPUT || trimmed.length > MAX_CHAT_INPUT) return;

    // Block sending in expired chat
    if (isChatExpired(activeChatId)) return;

    setChatLimitError(null);
    const currentChatId = activeChatId || crypto.randomUUID();
    if (!activeChatId) setActiveChatId(currentChatId);

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
    pollingChatId.current = currentChatId;

    try {
      const payload: Record<string, unknown> = {
        kazus_text: trimmed,
        title: trimmed.slice(0, 100),
        ustoz_id: userId,
        answer_mode: 'lexion',
        chat_id: currentChatId,
      };
      const data = await callEdgeFunction('case-answer-submit', payload);

      if (data.id) {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, jobId: data.id, jobCreatedAt: new Date().toISOString() } : m,
        ));
        pollingJobId.current = data.id;

        setChats(prev => {
          const existing = prev.find(c => c.chatId === currentChatId);
          if (existing) {
            return prev.map(c => c.chatId === currentChatId ? { ...c, updatedAt: Date.now() } : c);
          }
          const newChat: ChatMeta = {
            chatId: currentChatId,
            title: trimmed.slice(0, 40),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return [newChat, ...prev];
        });

        fetchQuota();
        startPolling(data.id, userId, currentChatId);
      } else if (data.error) {
        setIsProcessing(false);
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, status: 'error', error: data.error, content: data.error } : m,
        ));
      }
    } catch (err) {
      setIsProcessing(false);
      const e = err as Error & { code?: string; next_reset_at?: string; max?: number };
      let errorMsg = e.message || 'Xatolik yuz berdi';

      if (e.code === 'chat_limit' || e.code === 'chat_expired') {
        setChatLimitError(errorMsg);
        setMessages(prev => prev.filter(m => m.id !== userMsg.id && m.id !== aiMsgId));
        fetchChatsStatus();
        return;
      }

      if (e.code === 'quota_exceeded' || e.code === 'active_job') {
        errorMsg = e.message;
      }
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, status: 'error', error: errorMsg, content: errorMsg } : m,
      ));
      fetchQuota();
    }
  }, [userId, isProcessing, activeChatId, startPolling, fetchQuota, fetchChatsStatus, isChatExpired]);

  const retry = useCallback(async (aiMsgId: string) => {
    if (!userId) return;
    setMessages(prev => {
      const aiIdx = prev.findIndex(m => m.id === aiMsgId);
      if (aiIdx < 0) return prev;
      let userText = '';
      for (let i = aiIdx - 1; i >= 0; i--) {
        if (prev[i].role === 'user') {
          userText = prev[i].content;
          break;
        }
      }
      if (!userText) return prev;
      const toRemove = new Set([aiMsgId, prev[aiIdx - 1]?.id].filter(Boolean) as string[]);
      const filtered = prev.filter(m => !toRemove.has(m.id));
      setTimeout(() => sendMessage(userText), 0);
      return filtered;
    });
  }, [userId, sendMessage]);

  const deleteChat = useCallback(async (chatId: string) => {
    if (!userId) return;
    try {
      await callEdgeFunction('nexus-chat-delete', { user_id: userId, chat_id: chatId });
    } catch { /* ignore */ }

    setChats(prev => {
      const filtered = prev.filter(c => c.chatId !== chatId);
      saveChatsList(userId, filtered);
      return filtered;
    });
    deleteChatMessages(userId, chatId);

    if (activeChatId === chatId) {
      const remaining = chats.filter(c => c.chatId !== chatId);
      if (remaining.length > 0) {
        const next = remaining[0];
        setActiveChatId(next.chatId);
        const { messages: msgs } = loadChatMessages(userId, next.chatId);
        setMessages(msgs);
      } else {
        setActiveChatId(crypto.randomUUID());
        setMessages([]);
      }
      stopPolling();
      setIsProcessing(false);
    }
    fetchChatsStatus();
  }, [userId, chats, activeChatId, stopPolling, fetchChatsStatus]);

  const clearChat = useCallback(() => {
    if (!userId || !activeChatId) return;
    deleteChatMessages(userId, activeChatId);
    setMessages([]);
    stopPolling();
    setIsProcessing(false);
    setChats(prev => {
      const filtered = prev.filter(c => c.chatId !== activeChatId);
      saveChatsList(userId, filtered);
      return filtered;
    });
    setActiveChatId(crypto.randomUUID());
    fetchChatsStatus();
  }, [userId, activeChatId, stopPolling, fetchChatsStatus]);

  const memoryEnabled = chatsStatus?.memory_enabled ?? false;

  useEffect(() => () => stopPolling(), [stopPolling]);

  return {
    chats,
    activeChatId,
    messages,
    isProcessing,
    quota,
    chatsStatus,
    memoryEnabled,
    serverOffset,
    chatLimitError,
    pendingChatId,
    sendMessage,
    retry,
    clearChat,
    deleteChat,
    switchChat,
    createNewChat,
    getChatTimer,
    isChatExpired,
    fetchChatsStatus,
    minInput: MIN_CHAT_INPUT,
    maxInput: MAX_CHAT_INPUT,
    aiName: AI_NAME,
  };
}
