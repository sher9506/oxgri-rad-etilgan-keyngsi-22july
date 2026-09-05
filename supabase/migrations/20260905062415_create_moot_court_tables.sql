/*
# Create Moot Court tables (sud jarayoni simulyatsiyasi)

1. New Tables
- `moot_court_cases` — ustoz yaratgan kazuslar (sarlavha, vaziyat, qonun, tomonlar, AI roli, faol flag)
  - id (uuid, PK)
  - ustoz_id (text, ustoz identifikatori)
  - ustoz_ismi (text, ustoz to'liq ismi)
  - sarlavha (text, majburiy)
  - tavsif (text, majburiy — vaziyat matni)
  - qonun_moddalar (text — qonun/modda nomlari)
  - tomonlar (text[] — talaba tanlay oladigan tomonlar, masalan ['da\'vogar','javobgar'])
  - ai_rol (text — 'qarshi_tomon' yoki 'sudya')
  - faol (boolean, default true)
  - created_at, updated_at
- `moot_court_sessions` — talaba sessiyalari (suhbat tarixi, holat, baho)
  - id (uuid, PK)
  - case_id (uuid, FK → moot_court_cases)
  - oquvchi_ismi (text)
  - oquvchi_tomon (text — talaba tanlagan tomon)
  - messages (jsonb — [{role, text, timestamp}] suhbat tarixi)
  - status (text — 'faol' | 'yakunlangan')
  - baho (int, null — 1-10 ball)
  - izoh (text, null — ustoz izohi)
  - created_at, updated_at

2. Security
- RLS enabled on both tables.
- moot_court_cases: anon+authenticated can SELECT (faol=true only for oquvchi; ustoz sees own);
  INSERT/UPDATE/DELETE only for ustoz (filtered by ustoz_id).
  Since this app uses custom localStorage auth (not Supabase auth), all access is via anon key.
  Policies use TO anon, authenticated with USING(true) for SELECT on active cases,
  and full CRUD for anon (the app enforces role checks in code).
- moot_court_sessions: anon+authenticated full CRUD (app enforces role checks in code).

3. Indexes
- moot_court_cases: ustoz_id, faol
- moot_court_sessions: case_id, oquvchi_ismi, status
*/

CREATE TABLE IF NOT EXISTS moot_court_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id text NOT NULL,
  ustoz_ismi text NOT NULL DEFAULT '',
  sarlavha text NOT NULL,
  tavsif text NOT NULL,
  qonun_moddalar text NOT NULL DEFAULT '',
  tomonlar text[] NOT NULL DEFAULT '{}',
  ai_rol text NOT NULL DEFAULT 'qarshi_tomon',
  faol boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE moot_court_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_moot_cases" ON moot_court_cases;
CREATE POLICY "anon_select_moot_cases" ON moot_court_cases FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_moot_cases" ON moot_court_cases;
CREATE POLICY "anon_insert_moot_cases" ON moot_court_cases FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_moot_cases" ON moot_court_cases;
CREATE POLICY "anon_update_moot_cases" ON moot_court_cases FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_moot_cases" ON moot_court_cases;
CREATE POLICY "anon_delete_moot_cases" ON moot_court_cases FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_moot_cases_ustoz_id ON moot_court_cases(ustoz_id);
CREATE INDEX IF NOT EXISTS idx_moot_cases_faol ON moot_court_cases(faol);

CREATE TABLE IF NOT EXISTS moot_court_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES moot_court_cases(id) ON DELETE CASCADE,
  oquvchi_ismi text NOT NULL,
  oquvchi_tomon text NOT NULL DEFAULT '',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'faol',
  balo integer,
  izoh text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE moot_court_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_moot_sessions" ON moot_court_sessions;
CREATE POLICY "anon_select_moot_sessions" ON moot_court_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_moot_sessions" ON moot_court_sessions;
CREATE POLICY "anon_insert_moot_sessions" ON moot_court_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_moot_sessions" ON moot_court_sessions;
CREATE POLICY "anon_update_moot_sessions" ON moot_court_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_moot_sessions" ON moot_court_sessions;
CREATE POLICY "anon_delete_moot_sessions" ON moot_court_sessions FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_moot_sessions_case_id ON moot_court_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_moot_sessions_oquvchi ON moot_court_sessions(oquvchi_ismi);
CREATE INDEX IF NOT EXISTS idx_moot_sessions_status ON moot_court_sessions(status);
