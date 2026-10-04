import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

export type AnswerJobStatus = 'idle' | 'queued' | 'running' | 'done' | 'error' | 'timeout';
export type AnswerMode = 'general' | 'sources' | 'lexion';
export type LexionPhase = 'lexion_searching' | 'answering' | 'done' | 'error' | null;

export type SourceItem =
  | { id: string; type: 'text'; title: string; content: string; charCount: number }
  | { id: string; type: 'url'; title: string; url: string; charCount: number }
  | { id: string; type: 'file'; title: string; content: string; fileKind: 'pdf' | 'docx'; charCount: number; storagePath?: string; fileSize?: number };

export interface AnswerJobState {
  status: AnswerJobStatus;
  answer: string | null;
  error: string | null;
  jobId: string | null;
  applied: boolean;
  sourceCount: number;
  libraryId?: string | null;
  isLibraryReuse?: boolean;
  libraryFull?: boolean;
  libraries?: LibraryItem[];
  answerMode?: AnswerMode;
  lexionPhase?: LexionPhase;
  lexionFallback?: boolean;
}

export interface LibraryItem {
  id: string;
  title: string;
  source_count: number;
  sources: { name: string; size: number }[];
  last_used_at: string | null;
  created_at: string;
}

export interface ServiceSource {
  type: 'text' | 'url' | 'file';
  title: string;
  content?: string;
  url?: string;
  storagePath?: string;
  fileKind?: string;
  fileSize?: number;
}

export function buildSourcesPayload(sources: SourceItem[]): ServiceSource[] {
  return sources.map(s => {
    if (s.type === 'url') return { type: 'url' as const, title: s.title, url: s.url };
    if (s.type === 'file') return { type: 'file' as const, title: s.title, content: s.content, fileKind: s.fileKind, storagePath: s.storagePath, fileSize: s.fileSize };
    return { type: 'text' as const, title: s.title, content: s.content };
  });
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_MS = 1800000; // 30 daqiqa — javob tayyorlanishi sekin bo'lishi mumkin

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
    .select('id, status, answer, error, created_at, applied, source_count, answer_mode, lexion_phase, lexion_fallback')
    .eq('case_id', caseId)
    .eq('teacher_id', ustozId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const base = {
    jobId: data.id,
    applied: data.applied ?? false,
    sourceCount: data.source_count ?? 0,
    answerMode: (data.answer_mode as AnswerMode) || undefined,
    lexionPhase: (data.lexion_phase as LexionPhase) || null,
    lexionFallback: data.lexion_fallback ?? false,
  };

  if (data.status === 'queued' || data.status === 'running') {
    return {
      ...base,
      status: data.status as AnswerJobStatus,
      answer: data.answer,
      error: data.error,
    };
  }

  if (data.status === 'done') {
    return {
      ...base,
      status: 'done',
      answer: data.answer,
      error: null,
    };
  }

  if (data.status === 'error' || data.status === 'timeout') {
    return {
      ...base,
      status: data.status as AnswerJobStatus,
      answer: null,
      error: data.error,
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
            libraryId: data.library_id || null,
            isLibraryReuse: data.is_library_reuse || false,
            lexionPhase: (data.lexion_phase as LexionPhase) || null,
            lexionFallback: data.lexion_fallback || false,
          });
        } else if (data.status === 'error') {
          stopPolling(caseId);
          updateJobState(caseId, {
            status: 'error',
            answer: null,
            error: data.error || 'Javob tayyorlanmadi. Qayta urinib ko\'ring.',
            lexionPhase: (data.lexion_phase as LexionPhase) || null,
            lexionFallback: data.lexion_fallback || false,
          });
        } else {
          updateJobState(caseId, {
            status: data.status as AnswerJobStatus,
            answer: null,
            error: null,
            lexionPhase: (data.lexion_phase as LexionPhase) ?? undefined,
            lexionFallback: data.lexion_fallback ?? false,
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
    sources?: SourceItem[],
    options?: { libraryId?: string; saveLibrary?: boolean; libraryTitle?: string; answerMode?: AnswerMode }
  ): Promise<void> => {
    if (!ustoz) return;

    const current = jobStates[caseId];
    if (current && (current.status === 'queued' || current.status === 'running')) {
      return;
    }

    const mode = options?.answerMode || (sources && sources.length > 0 ? 'sources' : 'general');

    updateJobState(caseId, {
      status: 'queued',
      answer: null,
      error: null,
      jobId: null,
      applied: false,
      sourceCount: sources?.length || 0,
      libraryFull: false,
      libraries: undefined,
      answerMode: mode,
      lexionPhase: mode === 'lexion' ? 'lexion_searching' : null,
      lexionFallback: false,
    });

    try {
      const payload: Record<string, unknown> = {
        case_id: caseId,
        kazus_text: kazusText,
        title,
        ustoz_id: ustoz,
        answer_mode: mode,
      };
      if (mode !== 'lexion') {
        if (options?.libraryId) {
          payload.library_id = options.libraryId;
        } else {
          payload.sources = buildSourcesPayload(sources || []);
          if (options?.saveLibrary) {
            payload.save_library = true;
            payload.library_title = options.libraryTitle;
          }
        }
      }
      const data = await callEdgeFunction('case-answer-submit', payload);

      if (data.id) {
        updateJobState(caseId, { jobId: data.id });
        startPolling(caseId, data.id, ustoz);
      } else if (data.error_code === 'library_full') {
        updateJobState(caseId, {
          status: 'error',
          error: data.error || 'Saqlangan manbalar soni 20 ga yetdi.',
          libraryFull: true,
          libraries: data.libraries,
        });
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
    sources?: SourceItem[],
    options?: { libraryId?: string; saveLibrary?: boolean; libraryTitle?: string; answerMode?: AnswerMode }
  ) => {
    stopPolling(caseId);
    updateJobState(caseId, {
      status: 'idle',
      answer: null,
      error: null,
      jobId: null,
      applied: false,
      sourceCount: 0,
      libraryFull: false,
      libraries: undefined,
      lexionPhase: null,
      lexionFallback: false,
    });
    await submitJob(caseId, title, kazusText, ustoz, sources, options);
  }, [stopPolling, updateJobState, submitJob]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(t => clearInterval(t));
      pollTimers.current = {};
    };
  }, []);

  const fetchLibraries = useCallback(async (ustoz: string): Promise<LibraryItem[]> => {
    try {
      const data = await callEdgeFunction('case-library-list', { ustoz_id: ustoz });
      return data.libraries || [];
    } catch {
      return [];
    }
  }, []);

  const deleteLibrary = useCallback(async (libraryId: string, ustoz: string): Promise<boolean> => {
    try {
      await callEdgeFunction('case-library-delete', { library_id: libraryId, ustoz_id: ustoz });
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    jobStates,
    submitJob,
    retry,
    restoreJob,
    stopPolling,
    markApplied,
    fetchLibraries,
    deleteLibrary,
  };
}
