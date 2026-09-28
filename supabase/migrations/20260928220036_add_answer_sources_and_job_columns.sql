-- 1. answer_sources on moot_court_cases
ALTER TABLE moot_court_cases
  ADD COLUMN IF NOT EXISTS answer_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. case_answer_jobs: make case_id nullable (draft jobs), add new columns
ALTER TABLE case_answer_jobs
  ALTER COLUMN case_id DROP NOT NULL;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS draft_key text;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS source_count int NOT NULL DEFAULT 0;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS notified boolean NOT NULL DEFAULT false;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS telegram_sent boolean NOT NULL DEFAULT false;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- Index for draft_key lookups
CREATE INDEX IF NOT EXISTS idx_case_answer_jobs_draft_key ON case_answer_jobs(draft_key) WHERE draft_key IS NOT NULL;

-- Index for notified lookup (notifier component)
CREATE INDEX IF NOT EXISTS idx_case_answer_jobs_notified ON case_answer_jobs(teacher_id, notified) WHERE notified = false;

-- Relax status check to allow 'timeout'
ALTER TABLE case_answer_jobs
  DROP CONSTRAINT IF EXISTS case_answer_jobs_status_check;
ALTER TABLE case_answer_jobs
  ADD CONSTRAINT case_answer_jobs_status_check CHECK (status IN ('queued','running','done','error','timeout'));
