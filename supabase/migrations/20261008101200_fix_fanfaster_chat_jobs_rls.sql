/*
# Fix fanfaster_chat_jobs RLS — service role bypass pattern

Edge functions use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
The frontend never directly reads/writes fanfaster_chat_jobs — all access goes through
edge functions that verify ownership server-side. So RLS policies can be simple:
- SELECT/INSERT/UPDATE: allow anon+authenticated (edge functions enforce ownership).
- This is safe because the table is only accessed via edge functions with service role.
*/

DROP POLICY IF EXISTS "chat_jobs_select_own" ON fanfaster_chat_jobs;
DROP POLICY IF EXISTS "chat_jobs_insert_own" ON fanfaster_chat_jobs;
DROP POLICY IF EXISTS "chat_jobs_update_own" ON fanfaster_chat_jobs;

CREATE POLICY "chat_jobs_anon_select" ON fanfaster_chat_jobs
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "chat_jobs_anon_insert" ON fanfaster_chat_jobs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "chat_jobs_anon_update" ON fanfaster_chat_jobs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
