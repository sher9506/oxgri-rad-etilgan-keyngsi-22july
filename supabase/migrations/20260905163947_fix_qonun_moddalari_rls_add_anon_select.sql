-- Allow anon role to SELECT from qonun_moddalari (app uses custom auth, not Supabase auth)
DROP POLICY IF EXISTS "select_qonun_moddalari" ON qonun_moddalari;
CREATE POLICY "select_qonun_moddalari" ON qonun_moddalari
  FOR SELECT TO anon, authenticated USING (true);

-- Also allow anon to read case-article junction
DROP POLICY IF EXISTS "select_case_articles" ON moot_court_case_articles;
CREATE POLICY "select_case_articles" ON moot_court_case_articles
  FOR SELECT TO anon, authenticated USING (true);