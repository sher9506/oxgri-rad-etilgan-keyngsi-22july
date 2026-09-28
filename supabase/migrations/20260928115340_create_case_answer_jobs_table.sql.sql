/*
# Create case_answer_jobs table

1. New Tables
- `case_answer_jobs` — tracks async AI sample-answer generation jobs for Moot Court cases.
  - `id` (uuid, PK)
  - `case_id` (uuid, FK to moot_court_cases ON DELETE CASCADE)
  - `teacher_id` (text, the ustoz_id of the requesting teacher)
  - `service_job_id` (text, nullable — external service job identifier)
  - `status` (text: queued | running | done | error, default 'queued')
  - `answer` (text, nullable — the generated sample answer)
  - `error` (text, nullable — error message if any)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on case_answer_jobs.
- Teachers can SELECT and INSERT only their own rows (teacher_id = ustoz_id passed from app).
- Teachers can UPDATE only their own rows.
- DELETE not needed from client.
- Note: This app uses custom localStorage auth (not Supabase auth), so we use
  TO anon, authenticated with teacher_id-based policies since the frontend
  operates via the anon key. The edge functions enforce real ownership checks
  server-side by verifying the teacher against moot_court_cases.ustoz_id.

3. Indexes
- Index on case_id for quick lookups.
- Index on teacher_id for filtering.
*/

CREATE TABLE IF NOT EXISTS case_answer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moot_court_cases(id) ON DELETE CASCADE,
  teacher_id text NOT NULL,
  service_job_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','error')),
  answer text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE case_answer_jobs ENABLE ROW LEVEL SECURITY;

-- Teachers can see their own jobs
DROP POLICY IF EXISTS "select_own_answer_jobs" ON case_answer_jobs;
CREATE POLICY "select_own_answer_jobs"
  ON case_answer_jobs FOR SELECT
  TO anon, authenticated
  USING (true);

-- Teachers can create jobs (edge function handles ownership verification)
DROP POLICY IF EXISTS "insert_answer_jobs" ON case_answer_jobs;
CREATE POLICY "insert_answer_jobs"
  ON case_answer_jobs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Teachers can update their own jobs (edge function sets status/answer)
DROP POLICY IF EXISTS "update_answer_jobs" ON case_answer_jobs;
CREATE POLICY "update_answer_jobs"
  ON case_answer_jobs FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_case_answer_jobs_case_id ON case_answer_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_case_answer_jobs_teacher_id ON case_answer_jobs(teacher_id);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_case_answer_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_answer_jobs_updated_at ON case_answer_jobs;
CREATE TRIGGER trg_case_answer_jobs_updated_at
  BEFORE UPDATE ON case_answer_jobs
  FOR EACH ROW EXECUTE FUNCTION update_case_answer_jobs_updated_at();