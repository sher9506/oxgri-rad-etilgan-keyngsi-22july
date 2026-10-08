/*
# FanFaster Chat Jobs jadvali

1. Yangi jadval: fanfaster_chat_jobs
   - id (uuid PK)
   - user_login (text) — foydalanuvchi login'i
   - session_id (text, null) — fanfaster_ai_sessions.id
   - rejim (text) — 'lexion' | 'manba'
   - savol (text) — foydalanuvchi savoli
   - javob (text, null) — AI javobi
   - status (text) — 'queued' | 'running' | 'done' | 'error' | 'timeout'
   - error (text, null)
   - lexion_phase (text, null) — 'lexion_searching' | 'answering' | 'done' | 'error'
   - lexion_fallback (bool, default false)
   - lexion_job_id (text, null)
   - lexion_urls (text, null) — JSON array
   - render_id (int, default 1) — qaysi Render backend (1 yoki 2)
   - service_job_id (text, null) — Render job_id
   - sources (jsonb, default '[]') — yuborilgan manbalar
   - created_at, updated_at, finished_at (timestamptz)
2. Security: RLS yoqiladi. Faqat egasi ko'radi (user_login bo'yicha).
   - admin_stats/admin_summary edge function service role bilan ishlaydi (RLS bypass).
*/

CREATE TABLE IF NOT EXISTS fanfaster_chat_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_login text NOT NULL,
  session_id text,
  rejim text NOT NULL DEFAULT 'lexion',
  savol text NOT NULL,
  javob text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  lexion_phase text,
  lexion_fallback boolean NOT NULL DEFAULT false,
  lexion_job_id text,
  lexion_urls text,
  render_id int NOT NULL DEFAULT 1,
  service_job_id text,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE fanfaster_chat_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_jobs_select_own" ON fanfaster_chat_jobs;
CREATE POLICY "chat_jobs_select_own" ON fanfaster_chat_jobs
  FOR SELECT TO anon, authenticated
  USING (user_login = current_setting('app.current_user_login', true));

DROP POLICY IF EXISTS "chat_jobs_insert_own" ON fanfaster_chat_jobs;
CREATE POLICY "chat_jobs_insert_own" ON fanfaster_chat_jobs
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_login = current_setting('app.current_user_login', true));

DROP POLICY IF EXISTS "chat_jobs_update_own" ON fanfaster_chat_jobs;
CREATE POLICY "chat_jobs_update_own" ON fanfaster_chat_jobs
  FOR UPDATE TO anon, authenticated
  USING (user_login = current_setting('app.current_user_login', true))
  WITH CHECK (user_login = current_setting('app.current_user_login', true));

CREATE INDEX IF NOT EXISTS idx_chat_jobs_user_login ON fanfaster_chat_jobs(user_login);
CREATE INDEX IF NOT EXISTS idx_chat_jobs_status ON fanfaster_chat_jobs(status);
CREATE INDEX IF NOT EXISTS idx_chat_jobs_created_at ON fanfaster_chat_jobs(created_at);
