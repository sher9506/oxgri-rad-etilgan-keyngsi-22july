/*
# Qisman RLS: chat joblarini anon o'qishdan yashirish

1. O'zgarishlar
   - case_answer_jobs SELECT siyosati: job_kind='chat' bo'lgan qatorlar anon/authenticated uchun ko'rinmas
   - UPDATE siyosati: job_kind='chat' qatorlarni anon/authenticated yangilay olmasligi
   - INSERT siyosati: job_kind='chat' bilan anon/authenticated insert qila olmasligi
   - Yangi DELETE siyosati: job_kind='chat' bo'lmagan qatorlar uchun anon/authenticated o'chira oladi (avval yo'q edi)

2. Xavfsizlik
   - Edge function'lar service role key bilan ishlaydi — RLS bypass qiladi, chat joblari ularga ko'rinadi
   - Moot Court qatorlari (job_kind NULL yoki 'kazus') avvalgidek o'qiladi/yangilanadi
   - Frontend Nexus AI case_answer_jobs'ga to'g'ridan-to'g'ri murojaat qilmaydi (faqat edge function'lar orqali)

3. Rollback SQL (zarur bo'lsa):
   DROP POLICY IF EXISTS "select_own_answer_jobs" ON case_answer_jobs;
   CREATE POLICY "select_own_answer_jobs" ON case_answer_jobs FOR SELECT
     TO anon, authenticated USING (true);
   DROP POLICY IF EXISTS "update_answer_jobs" ON case_answer_jobs;
   CREATE POLICY "update_answer_jobs" ON case_answer_jobs FOR UPDATE
     TO anon, authenticated USING (true) WITH CHECK (true);
   DROP POLICY IF EXISTS "insert_answer_jobs" ON case_answer_jobs;
   CREATE POLICY "insert_answer_jobs" ON case_answer_jobs FOR INSERT
     TO anon, authenticated WITH CHECK (true);
   DROP POLICY IF EXISTS "delete_non_chat_answer_jobs" ON case_answer_jobs;
*/

DROP POLICY IF EXISTS "select_own_answer_jobs" ON case_answer_jobs;
CREATE POLICY "select_own_answer_jobs"
ON case_answer_jobs FOR SELECT
TO anon, authenticated
USING (job_kind IS DISTINCT FROM 'chat');

DROP POLICY IF EXISTS "update_answer_jobs" ON case_answer_jobs;
CREATE POLICY "update_answer_jobs"
ON case_answer_jobs FOR UPDATE
TO anon, authenticated
USING (job_kind IS DISTINCT FROM 'chat')
WITH CHECK (job_kind IS DISTINCT FROM 'chat');

DROP POLICY IF EXISTS "insert_answer_jobs" ON case_answer_jobs;
CREATE POLICY "insert_answer_jobs"
ON case_answer_jobs FOR INSERT
TO anon, authenticated
WITH CHECK (job_kind IS DISTINCT FROM 'chat');

DROP POLICY IF EXISTS "delete_non_chat_answer_jobs" ON case_answer_jobs;
CREATE POLICY "delete_non_chat_answer_jobs"
ON case_answer_jobs FOR DELETE
TO anon, authenticated
USING (job_kind IS DISTINCT FROM 'chat');
