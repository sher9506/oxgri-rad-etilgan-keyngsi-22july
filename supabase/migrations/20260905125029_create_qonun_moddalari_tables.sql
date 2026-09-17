/*
# Qonunlar bazasi — legal articles table + case-article junction

1. New Tables
- `qonun_moddalari` — shared database of legal articles (statutes)
  - id (uuid PK)
  - kodeks_nomi (text, e.g. "Fuqarolik kodeksi")
  - modda_raqami (text, e.g. "333")
  - modda_matni (text, full article text)
  - manba_havola (text, optional lex.uz URL)
  - oxirgi_yangilangan (date, when the article was last updated officially)
  - yaratgan_ustoz_id (text, which teacher added it)
  - yaratgan_ustoz_ismi (text, teacher name for display)
  - created_at (timestamptz)
  - Unique constraint on (kodeks_nomi, modda_raqami) to prevent duplicates

- `moot_court_case_articles` — junction table linking cases to articles
  - id (uuid PK)
  - case_id (uuid FK → moot_court_cases ON DELETE CASCADE)
  - modda_id (uuid FK → qonun_moddalari ON DELETE CASCADE)
  - created_at (timestamptz)
  - Unique constraint on (case_id, modda_id) to prevent duplicate links

2. Security
- `qonun_moddalari`: RLS enabled. All authenticated users can SELECT (shared legal database).
  Any authenticated user can INSERT/UPDATE/DELETE (teachers manage articles).
- `moot_court_case_articles`: RLS enabled. All authenticated users can SELECT (needed for chat).
  Any authenticated user can INSERT/UPDATE/DELETE.

3. Important Notes
- The existing `qonun_moddalar` text column on `moot_court_cases` is NOT removed —
  it stays for backward compatibility with existing cases that have free-text references.
- Articles are shared across all teachers — once added, any teacher can link them to cases.
- The unique constraint on (kodeks_nomi, modda_raqami) prevents duplicate articles.
*/

CREATE TABLE IF NOT EXISTS qonun_moddalari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kodeks_nomi text NOT NULL,
  modda_raqami text NOT NULL,
  modda_matni text NOT NULL,
  manba_havola text,
  oxirgi_yangilangan date,
  yaratgan_ustoz_id text,
  yaratgan_ustoz_ismi text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (kodeks_nomi, modda_raqami)
);

ALTER TABLE qonun_moddalari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_qonun_moddalari" ON qonun_moddalari;
CREATE POLICY "select_qonun_moddalari" ON qonun_moddalari
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_qonun_moddalari" ON qonun_moddalari;
CREATE POLICY "insert_qonun_moddalari" ON qonun_moddalari
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_qonun_moddalari" ON qonun_moddalari;
CREATE POLICY "update_qonun_moddalari" ON qonun_moddalari
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_qonun_moddalari" ON qonun_moddalari;
CREATE POLICY "delete_qonun_moddalari" ON qonun_moddalari
  FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_kodeks ON qonun_moddalari(kodeks_nomi);
CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_raqam ON qonun_moddalari(modda_raqami);

CREATE TABLE IF NOT EXISTS moot_court_case_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moot_court_cases(id) ON DELETE CASCADE,
  modda_id uuid NOT NULL REFERENCES qonun_moddalari(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (case_id, modda_id)
);

ALTER TABLE moot_court_case_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_case_articles" ON moot_court_case_articles;
CREATE POLICY "select_case_articles" ON moot_court_case_articles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_case_articles" ON moot_court_case_articles;
CREATE POLICY "insert_case_articles" ON moot_court_case_articles
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_case_articles" ON moot_court_case_articles;
CREATE POLICY "delete_case_articles" ON moot_court_case_articles
  FOR DELETE TO authenticated USING (true);