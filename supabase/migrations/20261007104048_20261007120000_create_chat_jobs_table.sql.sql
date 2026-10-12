/*
# Create chat_jobs table for FanFaster Chat module

1. New Tables
- `chat_jobs` — async job queue for FanFaster Chat (NotebookLM-style legal chat).
  - `id` (uuid, PK)
  - `user_id` (text, NOT NULL) — talaba or ustoz ID (from talabalar/ustozlar tables, not auth.users)
  - `user_role` (text, NOT NULL, default 'oquvchi') — 'oquvchi' or 'ustoz'
  - `model` (text, NOT NULL) — 'manbali' (RAG-based) or 'lexion' (lex.uz-based)
  - `savol` (text, NOT NULL) — user's question/case text
  - `status` (text, NOT NULL, default 'queued') — queued | running | done | failed
  - `javob` (text, nullable) — AI-generated answer (IRAC format)
  - `xato` (text, nullable) — error message if any
  - `phase` (text, nullable) — processing phase for UI: 'qidiryapti' | 'tasdiqlamoqda' | 'yozmoqda'
  - `sources` (jsonb, nullable) — found legal sources (modda raqami, matn, havola)
  - `retry_count` (int, NOT NULL, default 0) — automatic retry counter
  - `created_at` (timestamptz, default now())
  - `started_at` (timestamptz, nullable)
  - `finished_at` (timestamptz, nullable)

2. Security
- Enable RLS on chat_jobs.
- Anon + authenticated can SELECT/INSERT/UPDATE (app uses anon key with custom auth).
- Edge functions enforce real ownership server-side via service role key.
- DELETE not needed from client.

3. Indexes
- Index on user_id for filtering user's jobs.
- Index on status for worker to find queued jobs.
- Index on created_at for ordering.

4. Functions
- `claim_chat_job()` — atomically claims a queued job using FOR UPDATE SKIP LOCKED.
  Returns the job row or null. Sets status to 'running', started_at to now().
*/

CREATE TABLE IF NOT EXISTS chat_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_role text NOT NULL DEFAULT 'oquvchi',
  model text NOT NULL CHECK (model IN ('manbali', 'lexion')),
  savol text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  javob text,
  xato text,
  phase text,
  sources jsonb,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

ALTER TABLE chat_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_chat_jobs" ON chat_jobs;
CREATE POLICY "select_chat_jobs"
  ON chat_jobs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_chat_jobs" ON chat_jobs;
CREATE POLICY "insert_chat_jobs"
  ON chat_jobs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_chat_jobs" ON chat_jobs;
CREATE POLICY "update_chat_jobs"
  ON chat_jobs FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_jobs_user_id ON chat_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_jobs_status ON chat_jobs(status);
CREATE INDEX IF NOT EXISTS idx_chat_jobs_created_at ON chat_jobs(created_at);

-- Auto-update updated_at equivalent: update started_at/finished_at via trigger not needed,
-- edge function sets these explicitly.

-- Atomic job claiming function for worker instances
CREATE OR REPLACE FUNCTION claim_chat_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_row record;
  result jsonb;
BEGIN
  -- Atomically pick one queued job, skip locked rows (so 2 workers don't get same job)
  FOR job_row IN
    SELECT * FROM chat_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  LOOP
    UPDATE chat_jobs
    SET status = 'running',
        started_at = now(),
        phase = 'qidiryapti'
    WHERE id = job_row.id
    RETURNING * INTO job_row;

    result := jsonb_build_object(
      'id', job_row.id,
      'user_id', job_row.user_id,
      'user_role', job_row.user_role,
      'model', job_row.model,
      'savol', job_row.savol,
      'retry_count', job_row.retry_count
    );
    RETURN result;
  END LOOP;

  -- No job found
  RETURN null;
END;
$$;

-- Grant execute to anon and authenticated (edge functions use service role, but for safety)
GRANT EXECUTE ON FUNCTION claim_chat_job() TO anon, authenticated;

-- Count active jobs (for queue position display)
CREATE OR REPLACE FUNCTION count_active_chat_jobs()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT count(*)::int FROM chat_jobs WHERE status IN ('queued', 'running');
$$;
GRANT EXECUTE ON FUNCTION count_active_chat_jobs() TO anon, authenticated;
