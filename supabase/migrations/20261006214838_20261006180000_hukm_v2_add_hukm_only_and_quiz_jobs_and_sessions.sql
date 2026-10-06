/*
# Hukm v2 — hukm_only huquqi, AI savol job'lari, o'tkazilgan o'yinlar sessiyalari

1. Yangi ustun
- `ustoz.hukm_only` (boolean, default false) — uchinchi huquq: faqat Hukm kabineti.
  Huquqlar bir-birini istisno qiladi:
  * blog_huquqi=true, ustoz_huquqi=false, hukm_only=false → faqat blog
  * ustoz_huquqi=true, blog_huquqi=false, hukm_only=false → to'liq ustoz (blog_yozishdan tashqari)
  * hukm_only=true → faqat Hukm kabineti
  * hammasi false → to'liq huquq (mavjud xulq-atvor saqlandi)

2. Yangi jadval: hukm_quiz_jobs
- AI savol tuzish job'lari uchun (ustoz manba qo'shadi, AI savol tuzadi, holat kuzatiladi).
- id, ustoz_id, quiz_id (nullable — job tugagach bog'lanadi), status (queued|processing|done|error),
  sources jsonb (manbalar ro'yxati), settings jsonb (savollar soni, qiyinlik, bo'limlar),
  result jsonb (tayyor savollar), error text, created_at, updated_at.
- RLS yoqilgan, policy yo'q (faqat service role).

3. Yangi jadval: hukm_huquq_log
- Kim, qachon, qaysi huquqni bergani/olgani jurnali.
- id, admin_id (ustoz.id), ustoz_id, huquq (blog_huquqi|ustoz_huquqi|hukm_only),
  granted boolean (true=berdi, false=oldi), created_at.
- RLS yoqilgan, policy yo'q (faqat service role / admin paneli).

4. Yangi jadval: hukm_sessions
- Har o'tkazilgan o'yin alohida sessiya sifatida (bir viktorina ko'p marta o'tkaziladi).
- id, quiz_id, game_id (nullable — tugagach bog'lanadi), ustoz_id, pin, started_at, ended_at,
  player_count int, avg_correct_pct numeric, avg_points numeric, finishers_pct numeric.
- RLS yoqilgan, policy yo'q (faqat service role).

5. Mavjud jadval o'zgarishi: hukm_players
- `talaba_id` ustuni — v2'da kirish majburiy, lekin NOT NULL qilib o'zgartirilmaydi
  (eski ma'lumotlar buzilmasligi uchun). Edge function'da tekshiriladi.

6. Xavfsizlik
- Barcha yangi jadvallarda RLS yoqilgan, anon policy yo'q.
- ustoz.hukm_only ustuniga anon UPDATE yo'q (mavjud ustoz RLS policy orqali).
*/

-- 1. hukm_only ustuni
DO $$ BEGIN
  ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS hukm_only boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. hukm_quiz_jobs
CREATE TABLE IF NOT EXISTS hukm_quiz_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id uuid NOT NULL,
  quiz_id uuid REFERENCES hukm_quizzes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','error')),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb DEFAULT NULL,
  error text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE hukm_quiz_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hukm_quiz_jobs_ustoz ON hukm_quiz_jobs(ustoz_id);
CREATE INDEX IF NOT EXISTS idx_hukm_quiz_jobs_status ON hukm_quiz_jobs(status);

-- 3. hukm_huquq_log
CREATE TABLE IF NOT EXISTS hukm_huquq_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  ustoz_id uuid NOT NULL,
  huquq text NOT NULL CHECK (huquq IN ('blog_huquqi','ustoz_huquqi','hukm_only')),
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hukm_huquq_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hukm_huquq_log_ustoz ON hukm_huquq_log(ustoz_id);

-- 4. hukm_sessions
CREATE TABLE IF NOT EXISTS hukm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES hukm_quizzes(id) ON DELETE CASCADE,
  game_id uuid REFERENCES hukm_games(id) ON DELETE SET NULL,
  ustoz_id uuid NOT NULL,
  pin text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  player_count int NOT NULL DEFAULT 0,
  avg_correct_pct numeric DEFAULT 0,
  avg_points numeric DEFAULT 0,
  finishers_pct numeric DEFAULT 0
);
ALTER TABLE hukm_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hukm_sessions_ustoz ON hukm_sessions(ustoz_id);
CREATE INDEX IF NOT EXISTS idx_hukm_sessions_quiz ON hukm_sessions(quiz_id);

-- 5. hukm_questions ga basis_check ustuni (AI tekshiruvi natijasi)
DO $$ BEGIN
  ALTER TABLE hukm_questions ADD COLUMN IF NOT EXISTS basis_check text DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. hukm_questions ga source ustuni (AI/Qo'lda/Matndan belgisi)
DO $$ BEGIN
  ALTER TABLE hukm_questions ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 7. hukm_quizzes ga is_active ustuni (o'chirilgan/o'chirilmagan)
DO $$ BEGIN
  ALTER TABLE hukm_quizzes ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
