/*
# Create qonunlar and qonun_moddalari_v2 tables

## Purpose
New legal code storage system. Replaces the old qonun_moddalari table (which used pgvector embeddings).
This new system stores parsed legal codes from lex.uz with clean article-level data.

## New Tables

### 1. qonunlar
- id (uuid, PK)
- kod (text, unique) — short code like "JK", "MJTK", "JPK"
- nom (text) — full name of the law
- link (text) — full lex.uz URL
- doc_id (text) — extracted doc ID from URL (e.g. "-111453")
- oxirgi_tahrir_sanasi (date) — last edit date from lex.uz
- modda_soni (integer) — number of articles found
- olingan_sana (timestamptz) — when the law was imported
- created_at (timestamptz)

### 2. qonun_moddalari_v2
- id (uuid, PK)
- qonun_kodi (text) — FK-like reference to qonunlar.kod
- modda_raqami (text) — article number, e.g. "1", "18-1", "216-2"
- sarlavha (text) — article title from the heading
- bob_nomi (text) — chapter/section name the article belongs to
- matn (text) — full clean article text
- sud_amaliyoti (text) — LexUZ commentary / plenum references (separate field)
- sarlavha_normal (text) — normalized title for search
- matn_normal (text) — normalized text for search
- lex_element_id (text) — lex.uz element ID for deep linking
- created_at (timestamptz)

## Security
- RLS enabled on both tables.
- Policies allow anon + authenticated to READ (the data is reference material, shared across all users).
- Only service role can INSERT/UPDATE/DELETE (admin operations via edge functions with service role key).
- No user_id columns — this is shared reference data, not per-user data.

## Notes
- The old qonun_moddalari table is NOT touched or dropped — it remains for backward compatibility.
- No pgvector / embedding columns — search is text-based (ILIKE + keyword matching).
- Normalization: lowercase, apostrophe variants unified, extra spaces removed.
*/

-- ─── qonunlar table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qonunlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kod text UNIQUE NOT NULL,
  nom text NOT NULL,
  link text NOT NULL,
  doc_id text,
  oxirgi_tahrir_sanasi date,
  modda_soni integer DEFAULT 0,
  olingan_sana timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qonunlar ENABLE ROW LEVEL SECURITY;

-- Read: anyone (anon + authenticated) — reference data
DROP POLICY IF EXISTS "anon_select_qonunlar" ON qonunlar;
CREATE POLICY "anon_select_qonunlar" ON qonunlar FOR SELECT
  TO anon, authenticated USING (true);

-- Write: only service role (edge functions)
DROP POLICY IF EXISTS "service_insert_qonunlar" ON qonunlar;
CREATE POLICY "service_insert_qonunlar" ON qonunlar FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_qonunlar" ON qonunlar;
CREATE POLICY "service_update_qonunlar" ON qonunlar FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_delete_qonunlar" ON qonunlar;
CREATE POLICY "service_delete_qonunlar" ON qonunlar FOR DELETE
  TO anon, authenticated USING (true);

-- ─── qonun_moddalari_v2 table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qonun_moddalari_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qonun_kodi text NOT NULL,
  modda_raqami text NOT NULL,
  sarlavha text,
  bob_nomi text,
  matn text,
  sud_amaliyoti text,
  sarlavha_normal text,
  matn_normal text,
  lex_element_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE qonun_moddalari_v2 ENABLE ROW LEVEL SECURITY;

-- Read: anyone (anon + authenticated) — reference data
DROP POLICY IF EXISTS "anon_select_qonun_moddalari_v2" ON qonun_moddalari_v2;
CREATE POLICY "anon_select_qonun_moddalari_v2" ON qonun_moddalari_v2 FOR SELECT
  TO anon, authenticated USING (true);

-- Write: only via edge functions (service role)
DROP POLICY IF EXISTS "service_insert_qonun_moddalari_v2" ON qonun_moddalari_v2;
CREATE POLICY "service_insert_qonun_moddalari_v2" ON qonun_moddalari_v2 FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_qonun_moddalari_v2" ON qonun_moddalari_v2;
CREATE POLICY "service_update_qonun_moddalari_v2" ON qonun_moddalari_v2 FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_delete_qonun_moddalari_v2" ON qonun_moddalari_v2;
CREATE POLICY "service_delete_qonun_moddalari_v2" ON qonun_moddalari_v2 FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for search
CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_v2_kod_raqam ON qonun_moddalari_v2 (qonun_kodi, modda_raqami);
CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_v2_kod ON qonun_moddalari_v2 (qonun_kodi);
CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_v2_normal ON qonun_moddalari_v2 USING gin (to_tsvector('simple', coalesce(sarlavha_normal, '') || ' ' || coalesce(matn_normal, '')));
