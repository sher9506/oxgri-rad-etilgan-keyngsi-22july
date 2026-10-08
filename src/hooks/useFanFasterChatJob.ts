// useFanFasterChatJob — FanFaster AI Chat uchun submit→poll hook
// useAiAnswerJob'ga tegmaydi — to'liq alohida.

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export type ChatJobStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'timeout';
export type ChatRejim = 'lexion' | 'manba';
export type LexionPhase = 'lexion_searching' | 'answering' | 'done' | 'error' | null;

export interface ChatSourceItem {
  type: 'text' | 'url' | 'file';
  title: string;
  content?: string;
  url?: string;
}

export interface ChatJobState {
  status: ChatJobStatus;
  answer: string | null;
  error: string | null;
  jobId: string | null;
  rejim?: ChatRejim;
  lexionPhase?: LexionPhase;
  lexionFallback?: boolean;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 15 * 60 * 1000; // 15 daqiqa

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
    throw new Error(data?.error || `So'rov xatosi (${res.status})`);
  }
  return data;
}

export function useFanFasterChatJob() {
  const [jobState, setJobState] = useState<ChatJobState>({ status: 'idle', answer: null, error: null, jobId: null });
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStart = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const updateState = useCallback((state: Partial<ChatJobState>) => {
    setJobState(prev => ({ ...prev, ...state }));
  }, []);

  const startPolling = useCallback((jobId: string, userLogin: string) => {
    stopPolling();
    pollStart.current = Date.now();

    pollTimer.current = setInterval(async () => {
      const elapsed = Date.now() - pollStart.current;
      if (elapsed > MAX_POLL_MS) {
        stopPolling();
        updateState({
          status: 'timeout',
          error: 'Javob hali tayyor emas. Qayta urinib ko\'ring.',
        });
        return;
      }

      try {
        const data = await callEdgeFunction('fanfaster-chat-status', { id: jobId, user_login: userLogin });
        if (data.status === 'done') {
          stopPolling();
          updateState({
            status: 'done',
            answer: data.answer,
            error: null,
            lexionPhase: data.lexion_phase || null,
            lexionFallback: data.lexion_fallback || false,
          });
        } else if (data.status === 'error') {
          stopPolling();
          updateState({
            status: 'error',
            answer: null,
            error: data.error || 'Javob tayyorlanmadi. Qayta urinib ko\'ring.',
            lexionPhase: data.lexion_phase || null,
            lexionFallback: data.lexion_fallback || false,
          });
        } else if (data.status === 'timeout') {
          stopPolling();
          updateState({
            status: 'timeout',
            answer: null,
            error: data.error || 'Vaqt tugadi. Qayta urinib ko\'ring.',
          });
        } else {
          updateState({
            status: data.status as ChatJobStatus,
            answer: null,
            error: null,
            lexionPhase: data.lexion_phase ?? null,
            lexionFallback: data.lexion_fallback ?? false,
          });
        }
      } catch {
        // Network error during polling — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, updateState]);

  const submitChat = useCallback(async (
    savol: string,
    userLogin: string,
    rejim: ChatRejim,
    sessionId?: string,
    sources?: ChatSourceItem[]
  ): Promise<void> => {
    stopPolling();
    updateState({
      status: 'queued',
      answer: null,
      error: null,
      jobId: null,
      rejim,
      lexionPhase: rejim === 'lexion' ? 'lexion_searching' : null,
      lexionFallback: false,
    });

    try {
      const payload: Record<string, unknown> = {
        savol,
        user_login: userLogin,
        rejim,
        session_id: sessionId || null,
      };
      if (rejim === 'manba' && sources && sources.length > 0) {
        payload.sources = sources;
      }

      const data = await callEdgeFunction('fanfaster-chat-submit', payload);

      if (data.id) {
        updateState({ jobId: data.id });
        startPolling(data.id, userLogin);
      } else {
        updateState({
          status: 'error',
          error: data.error || 'Job yaratilmadi.',
        });
      }
    } catch (err) {
      updateState({
        status: 'error',
        answer: null,
        error: err instanceof Error ? err.message : 'Xatolik yuz berdi',
      });
    }
  }, [stopPolling, updateState, startPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setJobState({ status: 'idle', answer: null, error: null, jobId: null });
  }, [stopPolling]);

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  return { jobState, submitChat, reset, stopPolling };
}
