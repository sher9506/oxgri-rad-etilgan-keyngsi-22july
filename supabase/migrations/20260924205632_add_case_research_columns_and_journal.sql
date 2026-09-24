/*
# Add case research pipeline columns and search journal

1. Modified Tables
- `moot_court_cases`: add 3 columns for the new legal research pipeline
  - `tadqiqot_holati` (text): pipeline status — 'kutmoqda', 'jarayonda', 'tayyor', 'qisman', 'xato'
  - `tasdiqlangan_moddalar` (jsonb): confirmed legal articles from the pipeline
  - `namunaviy_javob` (text): AI-generated sample answer based on confirmed articles

2. New Tables
- `qidiruv_jurnali`: search journal for tracking the research pipeline per case
  - `id` (uuid, primary key)
  - `case_id` (uuid, FK to moot_court_cases)
  - `case_sarlavha` (text): case title for display
  - `holat` (text): pipeline status
  - `nomzodlar` (jsonb): raw AI candidates from step 1
  - `tasdiqlangan_moddalar` (jsonb): confirmed articles from step 2
  - `namunaviy_javob` (text): sample answer from step 3
  - `ai1_model` (text): model used for candidate generation
  - `ai1_tokens` (jsonb): input/output token counts for step 1
  - `ai2_model` (text): model used for sample answer
  - `ai2_tokens` (jsonb): token counts for step 3
  - `hukm_tarqatish` (jsonb): distribution of verdicts (full/text/number/none)
  - `jami_token` (int): total tokens used
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

3. Security
- Enable RLS on `qidiruv_jurnali`
- Anon+authenticated SELECT (admin panel reads via anon key)
- Anon+authenticated INSERT/UPDATE (edge function writes via service role, but allow anon for safety)
- No DELETE policy (journal entries preserved)
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moot_court_cases' AND column_name = 'tadqiqot_holati') THEN
    ALTER TABLE moot_court_cases ADD COLUMN tadqiqot_holati text DEFAULT 'kutmoqda';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moot_court_cases' AND column_name = 'tasdiqlangan_moddalar') THEN
    ALTER TABLE moot_court_cases ADD COLUMN tasdiqlangan_moddalar jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moot_court_cases' AND column_name = 'namunaviy_javob') THEN
    ALTER TABLE moot_court_cases ADD COLUMN namunaviy_javob text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS qidiruv_jurnali (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES moot_court_cases(id) ON DELETE CASCADE,
  case_sarlavha text,
  holat text DEFAULT 'kutmoqda',
  nomzodlar jsonb DEFAULT '[]'::jsonb,
  tasdiqlangan_moddalar jsonb DEFAULT '[]'::jsonb,
  namunaviy_javob text,
  ai1_model text,
  ai1_tokens jsonb,
  ai2_model text,
  ai2_tokens jsonb,
  hukm_tarqatish jsonb,
  jami_token integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE qidiruv_jurnali ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_jurnal" ON qidiruv_jurnali;
CREATE POLICY "anon_select_jurnal" ON qidiruv_jurnali FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_jurnal" ON qidiruv_jurnali;
CREATE POLICY "anon_insert_jurnal" ON qidiruv_jurnali FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_jurnal" ON qidiruv_jurnali;
CREATE POLICY "anon_update_jurnal" ON qidiruv_jurnali FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qidiruv_jurnali_case_id ON qidiruv_jurnali(case_id);
CREATE INDEX IF NOT EXISTS idx_qidiruv_jurnali_holat ON qidiruv_jurnali(holat);
CREATE INDEX IF NOT EXISTS idx_qidiruv_jurnali_created_at ON qidiruv_jurnali(created_at DESC);
