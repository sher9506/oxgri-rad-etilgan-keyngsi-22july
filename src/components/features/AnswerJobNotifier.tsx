import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface PendingJob {
  id: string;
  case_id: string | null;
  status: string;
  answer: string | null;
  error: string | null;
  notified: boolean;
  source_count: number;
  moot_court_cases?: { sarlavha: string } | null;
}

const POLL_MS = 8000;

export default function AnswerJobNotifier({ ustozId, currentCaseId }: { ustozId: string; currentCaseId?: string }) {
  const { toast } = useToast();
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTitle = useRef(typeof document !== 'undefined' ? document.title : '');

  const checkJobs = useCallback(async () => {
    if (typeof document === 'undefined' || document.hidden) return;
    try {
      const { data, error } = await supabase
        .from('case_answer_jobs')
        .select('id, case_id, status, answer, error, notified, source_count, moot_court_cases(case_id:sarlavha)')
        .eq('teacher_id', ustozId)
        .in('status', ['queued', 'running', 'done', 'error'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error || !data) return;

      const jobs = data as unknown as PendingJob[];
      setPendingJobs(jobs);

      const finished = jobs.filter(j =>
        (j.status === 'done' || j.status === 'error') && !j.notified
      );

      for (const job of finished) {
        if (job.case_id && job.case_id === currentCaseId) {
          await supabase.from('case_answer_jobs').update({ notified: true }).eq('id', job.id);
          continue;
        }

        const sarlavha = job.moot_court_cases?.sarlavha || 'Kazus';

        if (job.status === 'done') {
          toast({
            title: `Namunaviy javob tayyor: «${sarlavha}»`,
            description: 'Kazusni ochib tahrir qiling va saqlang.',
          });
        } else {
          toast({
            title: `«${sarlavha}» uchun javob tayyorlanmadi`,
            description: job.error || 'Qayta urinib ko\'ring.',
            variant: 'destructive',
          });
        }

        await supabase.from('case_answer_jobs').update({ notified: true }).eq('id', job.id);
      }

      const unnotifiedFinished = jobs.filter(j =>
        (j.status === 'done' || j.status === 'error') && !j.notified
      );
      if (document.hidden && unnotifiedFinished.length > 0) {
        document.title = `● ${originalTitle.current}`;
      } else if (!document.hidden) {
        document.title = originalTitle.current;
      }
    } catch {
      // ignore polling errors
    }
  }, [ustozId, currentCaseId, toast]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        document.title = originalTitle.current;
        checkJobs();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [checkJobs]);

  useEffect(() => {
    checkJobs();
    pollRef.current = setInterval(() => checkJobs(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkJobs]);

  useEffect(() => {
    const hasActive = pendingJobs.some(j => j.status === 'queued' || j.status === 'running');
    const hasUnnotified = pendingJobs.some(j => !j.notified && (j.status === 'done' || j.status === 'error'));

    if (!hasActive && !hasUnnotified && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    } else if ((hasActive || hasUnnotified) && !pollRef.current) {
      pollRef.current = setInterval(() => checkJobs(), POLL_MS);
    }
  }, [pendingJobs, checkJobs]);

  return null;
}
