-- Add job_kind column to distinguish chat jobs from kazus jobs
ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS job_kind text NOT NULL DEFAULT 'kazus';

-- Backfill: any job with chat_kazus_text but no case_id is a chat job
UPDATE case_answer_jobs
  SET job_kind = 'chat'
  WHERE chat_kazus_text IS NOT NULL AND case_id IS NULL;

-- Index for trial limit queries (count chat jobs per teacher)
CREATE INDEX IF NOT EXISTS idx_case_answer_jobs_kind_teacher
  ON case_answer_jobs (job_kind, teacher_id)
  WHERE job_kind = 'chat';
