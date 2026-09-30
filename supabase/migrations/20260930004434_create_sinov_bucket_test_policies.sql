/*
# Sinov bucket test policies

Sinov uchun vaqtinchalik test policies — faqat sinov bucket'ida.
1. Anon va authenticated user'lar yuklash/o'qish/o'chirish huquqiga ega.
2. Bu faqat sinov maqsadida, real loyiha bucket'lari (case-sources) ustida emas.
*/

DROP POLICY IF EXISTS "sinov_select" ON storage.objects;
CREATE POLICY "sinov_select" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'sinov');

DROP POLICY IF EXISTS "sinov_insert" ON storage.objects;
CREATE POLICY "sinov_insert" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'sinov');

DROP POLICY IF EXISTS "sinov_update" ON storage.objects;
CREATE POLICY "sinov_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'sinov') WITH CHECK (bucket_id = 'sinov');

DROP POLICY IF EXISTS "sinov_delete" ON storage.objects;
CREATE POLICY "sinov_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'sinov');
