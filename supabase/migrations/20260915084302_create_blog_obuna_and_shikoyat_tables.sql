/*
# Blog obuna (subscriptions) va shikoyat (complaints) jadvallarini yaratish

1. Yangi jadvallar:
- `blog_obuna` — Foydalanuvchilar mualliflarga obuna bo'lishi (kuzatish) uchun
  - id (uuid, PK)
  - ustoz_id (text) — kuzatilayotgan muallif/ustoz ID
  - obuna_ustoz_id (text, null) — kuzatuvchi ustoz ID (agar tizimga kirgan bo'lsa)
  - obuna_ismi (text, null) — kuzatuvchi ismi (agar ustoz emas bo'lsa)
  - created_at (timestamptz)
- `blog_shikoyat` — Maqolalarga shikoyat qilish uchun
  - id (uuid, PK)
  - post_id (uuid) — shikoyat qilingan blog post ID
  - post_sarlavha (text) — post sarlavhasi (denormalized for admin display)
  - shikoyatchi_ismi (text) — shikoyat qiluvchi ismi
  - sabab (text) — shikoyat sababi (mualliflik huquqi buzilgan / haqoratli / qonunga zid / boshqa)
  - izoh (text) — qo'shimcha izoh
  - status (text) — holati (pending / reviewed / resolved)
  - admin_note (text, null) — admin tomonidan yozilgan izoh
  - created_at (timestamptz)
  - resolved_at (timestamptz, null)

2. Xavfsizlik (RLS):
- `blog_obuna`: anon + authenticated o'qish va yozish (blog ommaviy)
- `blog_shikoyat`: anon + authenticated yozish (har kim shikoyat qila oladi)
- `blog_shikoyat`: faqat authenticated o'qish (faqat admin panel uchun)
*/

-- Blog obuna (subscriptions) jadvali
CREATE TABLE IF NOT EXISTS blog_obuna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id text NOT NULL,
  obuna_ustoz_id text,
  obuna_ismi text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ustoz_id, obuna_ustoz_id)
);

ALTER TABLE blog_obuna ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_blog_obuna" ON blog_obuna;
CREATE POLICY "anon_select_blog_obuna" ON blog_obuna
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_blog_obuna" ON blog_obuna;
CREATE POLICY "anon_insert_blog_obuna" ON blog_obuna
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_blog_obuna" ON blog_obuna;
CREATE POLICY "anon_delete_blog_obuna" ON blog_obuna
  FOR DELETE TO anon, authenticated USING (true);

-- Blog shikoyat (complaints) jadvali
CREATE TABLE IF NOT EXISTS blog_shikoyat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  post_sarlavha text,
  shikoyatchi_ismi text,
  sabab text NOT NULL,
  izoh text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE blog_shikoyat ENABLE ROW LEVEL SECURITY;

-- Har kim shikoyat yubira oladi (insert)
DROP POLICY IF EXISTS "anon_insert_blog_shikoyat" ON blog_shikoyat;
CREATE POLICY "anon_insert_blog_shikoyat" ON blog_shikoyat
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Faqat authenticated (admin) o'qiy oladi
DROP POLICY IF EXISTS "auth_select_blog_shikoyat" ON blog_shikoyat;
CREATE POLICY "auth_select_blog_shikoyat" ON blog_shikoyat
  FOR SELECT TO authenticated USING (true);

-- Faqat authenticated (admin) yangilay oladi
DROP POLICY IF EXISTS "auth_update_blog_shikoyat" ON blog_shikoyat;
CREATE POLICY "auth_update_blog_shikoyat" ON blog_shikoyat
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_obuna_ustoz_id ON blog_obuna(ustoz_id);
CREATE INDEX IF NOT EXISTS idx_blog_shikoyat_status ON blog_shikoyat(status);
CREATE INDEX IF NOT EXISTS idx_blog_shikoyat_post_id ON blog_shikoyat(post_id);
