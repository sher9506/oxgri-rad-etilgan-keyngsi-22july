import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export type AnswerJobStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'timeout';

export type SourceItem =
  | { id: string; type: 'text'; title: string; content: string; charCount: number }
  | { id: string; type: 'url'; title: string; url: string; charCount: number }
  | { id: string; type: 'file'; title: string; content: string; fileKind: 'pdf' | 'docx'; charCount: number };

export interface AnswerJobState {
  status: AnswerJobStatus;
  answer: string | null;
  error: string | null;
  jobId: string | null;
  applied: boolean;
  sourceCount: number;
}

export interface ServiceSource {
  type: 'text' | 'url';
  title: string;
  content?: string;
  url?: string;
}

export function buildSourcesPayload(sources: SourceItem[]): ServiceSource[] {
  return sources.map(s => {
    if (s.type === 'url') return { type: 'url' as const, title: s.title, url: s.url };
    return { type: 'text' as const, title: s.title, content: s.content };
  });
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 1800000; // 30 minutes — javob tayyorlanishi sekin bo'lishi mumkin

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

async function restoreJobFromDb(caseId: string, ustozId: string): Promise<AnswerJobState | null> {
  const { supabase } = await import('@/lib/supabase');
  const { data } = await supabase
    .from('case_answer_jobs')
    .select('id, status, answer, error, created_at, applied, source_count')
    .eq('case_id', caseId)
    .eq('teacher_id', ustozId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (data.status === 'queued' || data.status === 'running') {
    // Vaqt cheklovi yo'q — Render'da ish hali bajarilayotgan bo'lishi mumkin.
    // Frontend polling'ni qayta boshlaydi va Render'dan holatni so'raydi.
    return {
      status: data.status as AnswerJobStatus,
      answer: data.answer,
      error: data.error,
      jobId: data.id,
      applied: data.applied ?? false,
      sourceCount: data.source_count ?? 0,
    };
  }

  if (data.status === 'done') {
    return {
      status: 'done',
      answer: data.answer,
      error: null,
      jobId: data.id,
      applied: data.applied ?? false,
      sourceCount: data.source_count ?? 0,
    };
  }

  if (data.status === 'error' || data.status === 'timeout') {
    return {
      status: data.status as AnswerJobStatus,
      answer: null,
      error: data.error,
      jobId: data.id,
      applied: data.applied ?? false,
      sourceCount: data.source_count ?? 0,
    };
  }

  return null;
}

export function useAiAnswerJob(ustozId: string | undefined) {
  const [jobStates, setJobStates] = useState<Record<string, AnswerJobState>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const pollStarts = useRef<Record<string, number>>({});

  const updateJobState = useCallback((caseId: string, state: Partial<AnswerJobState>) => {
    setJobStates(prev => ({
      ...prev,
      [caseId]: { ...prev[caseId], ...state } as AnswerJobState,
    }));
  }, []);

  const stopPolling = useCallback((caseId: string) => {
    if (pollTimers.current[caseId]) {
      clearInterval(pollTimers.current[caseId]);
      delete pollTimers.current[caseId];
    }
    delete pollStarts.current[caseId];
  }, []);

  const startPolling = useCallback((caseId: string, jobId: string, ustoz: string) => {
    stopPolling(caseId);
    pollStarts.current[caseId] = Date.now();

    pollTimers.current[caseId] = setInterval(async () => {
      const elapsed = Date.now() - pollStarts.current[caseId];
      if (elapsed > MAX_POLL_MS) {
        stopPolling(caseId);
        updateJobState(caseId, {
          status: 'timeout',
          error: 'Javob hali tayyor emas. Keyinroq shu kazusni oching, tayyor bo\'lsa avtomatik chiqadi.',
        });
        return;
      }

      try {
        const data = await callEdgeFunction('case-answer-status', { id: jobId, ustoz_id: ustoz });
        if (data.status === 'done') {
          stopPolling(caseId);
          updateJobState(caseId, {
            status: 'done',
            answer: data.answer,
            error: null,
            applied: data.applied ?? false,
          });
        } else if (data.status === 'error') {
          stopPolling(caseId);
          updateJobState(caseId, {
            status: 'error',
            answer: null,
            error: data.error || 'Javob tayyorlanmadi. Qayta urinib ko\'ring.',
          });
        } else {
          updateJobState(caseId, {
            status: data.status as AnswerJobStatus,
            answer: null,
            error: null,
          });
        }
      } catch {
        // Network error during polling — keep polling
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, updateJobState]);

  const submitJob = useCallback(async (
    caseId: string,
    title: string,
    kazusText: string,
    ustoz: string,
    sources?: SourceItem[]
  ): Promise<void> => {
    if (!ustoz) return;

    const current = jobStates[caseId];
    if (current && (current.status === 'queued' || current.status === 'running')) {
      return;
    }

    updateJobState(caseId, {
      status: 'queued',
      answer: null,
      error: null,
      jobId: null,
      applied: false,
      sourceCount: sources?.length || 0,
    });

    try {
      const payload: Record<string, unknown> = {
        case_id: caseId,
        kazus_text: kazusText,
        title,
        ustoz_id: ustoz,
      };
      payload.sources = buildSourcesPayload(sources || []);
      const data = await callEdgeFunction('case-answer-submit', payload);

      if (data.id) {
        updateJobState(caseId, { jobId: data.id });
        startPolling(caseId, data.id, ustoz);
      }
    } catch (err) {
      updateJobState(caseId, {
        status: 'error',
        answer: null,
        error: err instanceof Error ? err.message : 'Xatolik yuz berdi',
      });
    }
  }, [jobStates, updateJobState, startPolling]);

  const restoreJob = useCallback(async (caseId: string, ustoz: string) => {
    if (!ustoz) return;
    try {
      const restored = await restoreJobFromDb(caseId, ustoz);
      if (restored) {
        updateJobState(caseId, restored);
        if (restored.status === 'queued' || restored.status === 'running') {
          if (restored.jobId) {
            startPolling(caseId, restored.jobId, ustoz);
          }
        }
      }
    } catch {
      // ignore restore errors
    }
  }, [updateJobState, startPolling]);

  const markApplied = useCallback(async (caseId: string, ustoz: string) => {
    const { supabase } = await import('@/lib/supabase');
    const jobState = jobStates[caseId];
    if (!jobState?.jobId) return;
    await supabase
      .from('case_answer_jobs')
      .update({ applied: true })
      .eq('id', jobState.jobId);
    updateJobState(caseId, { applied: true });
  }, [jobStates, updateJobState]);

  const retry = useCallback(async (
    caseId: string,
    title: string,
    kazusText: string,
    ustoz: string,
    sources?: SourceItem[]
  ) => {
    stopPolling(caseId);
    updateJobState(caseId, {
      status: 'idle',
      answer: null,
      error: null,
      jobId: null,
      applied: false,
      sourceCount: 0,
    });
    await submitJob(caseId, title, kazusText, ustoz, sources);
  }, [stopPolling, updateJobState, submitJob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(t => clearInterval(t));
      pollTimers.current = {};
    };
  }, []);

  return {
    jobStates,
    submitJob,
    retry,
    restoreJob,
    stopPolling,
    markApplied,
  };
}
