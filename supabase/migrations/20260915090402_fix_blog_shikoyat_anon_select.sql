-- Admin paneli anon key orqali ishlaydi (authenticated emas),
-- shuning uchun blog_shikoyat SELECT huquqini anon ga ham ochamiz.
-- Faqat o'qish uchun, yozish/yangilash allaqachon authenticated bilan cheklangan.

DROP POLICY IF EXISTS "anon_select_blog_shikoyat" ON blog_shikoyat;
CREATE POLICY "anon_select_blog_shikoyat" ON blog_shikoyat
  FOR SELECT TO anon, authenticated USING (true);
