-- Admin paneli anon key orqali ishlaydi, shuning uchun
-- blog_shikoyat UPDATE huquqini ham anon ga ochamiz.
DROP POLICY IF EXISTS "anon_update_blog_shikoyat" ON blog_shikoyat;
CREATE POLICY "anon_update_blog_shikoyat" ON blog_shikoyat
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
