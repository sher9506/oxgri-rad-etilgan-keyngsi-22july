import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export type AnswerJobStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'timeout';

export interface AnswerJobState {
  status: AnswerJobStatus;
  answer: string | null;
  error: string | null;
  jobId: string | null;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 360000; // 6 minutes

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
    .select('id, status, answer, error, created_at')
    .eq('case_id', caseId)
    .eq('teacher_id', ustozId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (data.status === 'queued' || data.status === 'running') {
    if (ageMs > MAX_POLL_MS) {
      return {
        status: 'timeout',
        answer: null,
        error: null,
        jobId: data.id,
      };
    }
    return {
      status: data.status as AnswerJobStatus,
      answer: data.answer,
      error: data.error,
      jobId: data.id,
    };
  }

  if (data.status === 'done') {
    return {
      status: 'done',
      answer: data.answer,
      error: null,
      jobId: data.id,
    };
  }

  if (data.status === 'error') {
    return {
      status: 'error',
      answer: null,
      error: data.error,
      jobId: data.id,
    };
  }

  return null;
}

export function useAiAnswerJob(ustozId: string | undefined) {
  // Per-case job states: caseId -> AnswerJobState
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
          error: null,
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
          });
        } else if (data.status === 'error') {
          stopPolling(caseId);
          updateJobState(caseId, {
            status: 'error',
            answer: null,
            error: data.error,
          });
        } else {
          updateJobState(caseId, {
            status: data.status as AnswerJobStatus,
            answer: null,
            error: null,
          });
        }
      } catch {
        // Network error during polling — keep polling, don't crash
      }
    }, POLL_INTERVAL_MS);
  }, [stopPolling, updateJobState]);

  const submitJob = useCallback(async (
    caseId: string,
    title: string,
    kazusText: string,
    ustoz: string
  ): Promise<void> => {
    if (!ustoz) return;

    // Don't submit if already in progress
    const current = jobStates[caseId];
    if (current && (current.status === 'queued' || current.status === 'running')) {
      return;
    }

    updateJobState(caseId, {
      status: 'queued',
      answer: null,
      error: null,
      jobId: null,
    });

    try {
      const data = await callEdgeFunction('case-answer-submit', {
        case_id: caseId,
        kazus_text: kazusText,
        title,
        ustoz_id: ustoz,
      });

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

  const retry = useCallback(async (
    caseId: string,
    title: string,
    kazusText: string,
    ustoz: string
  ) => {
    stopPolling(caseId);
    updateJobState(caseId, {
      status: 'idle',
      answer: null,
      error: null,
      jobId: null,
    });
    await submitJob(caseId, title, kazusText, ustoz);
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
  };
}
