/*
# Hukm Analitika v1 — ma'lumot yig'ish ustunlari

1. Yangi ustunlar (qo'shuvchi, additive):
   - hukm_questions: kodeks_nomi (text, nullable), mavzu (text, nullable), modda_raqami (text, nullable)
   - hukm_quizzes: default_kodeks (text, nullable), default_mavzu (text, nullable)
   - hukm_answers: elapsed_ms (integer, nullable) — javob qabul qilinganda savol ochilgan vaqtdan o'tgan ms
   - hukm_games: questions_snapshot (jsonb, nullable) — o'yin yaratilganda savollar nusxasi
   - hukm_games: group_label (text, nullable) — ixtiyoriy guruh nomi
   - hukm_sessions: group_label (text, nullable) — o'yin tugaganda nusxalanadi
   - hukm_sessions: questions_snapshot (jsonb, nullable) — o'yin tugaganda nusxalanadi

2. Yangi jadval:
   - hukm_grade_scales — ustozning baho shkalasi (ustoz_id, scale, t5, t4, t3, updated_at)

3. Xavfsizlik:
   - hukm_grade_scales'da RLS yoqiladi, 0 ta policy (service role orqali, hukm-api ichida)
   - Boshqa jadvallarda RLS o'zgarmaydi (allaqachon yoqiq, 0 ta policy)

4. Eslatma:
   - Eski yozuvlar uchun yangi ustunlar NULL — UI "ma'lumot yo'q" deb ko'rsatadi
   - Hech qanday ustun o'chirilmaydi yoki turini o'zgartirmaydi
*/

-- A1. hukm_questions: teg maydonlari
ALTER TABLE hukm_questions ADD COLUMN IF NOT EXISTS kodeks_nomi text;
ALTER TABLE hukm_questions ADD COLUMN IF NOT EXISTS mavzu text;
ALTER TABLE hukm_questions ADD COLUMN IF NOT EXISTS modda_raqami text;

-- A2. hukm_quizzes: default teglar
ALTER TABLE hukm_quizzes ADD COLUMN IF NOT EXISTS default_kodeks text;
ALTER TABLE hukm_quizzes ADD COLUMN IF NOT EXISTS default_mavzu text;

-- A3. hukm_answers: javob vaqti
ALTER TABLE hukm_answers ADD COLUMN IF NOT EXISTS elapsed_ms integer;

-- A4. hukm_games: snapshot va guruh
ALTER TABLE hukm_games ADD COLUMN IF NOT EXISTS questions_snapshot jsonb;
ALTER TABLE hukm_games ADD COLUMN IF NOT EXISTS group_label text;

-- A5. hukm_sessions: guruh va snapshot
ALTER TABLE hukm_sessions ADD COLUMN IF NOT EXISTS group_label text;
ALTER TABLE hukm_sessions ADD COLUMN IF NOT EXISTS questions_snapshot jsonb;

-- A6. hukm_grade_scales: ustoz baho shkalasi
CREATE TABLE IF NOT EXISTS hukm_grade_scales (
  ustoz_id uuid NOT NULL,
  scale text NOT NULL DEFAULT '5',
  t5 integer NOT NULL DEFAULT 86,
  t4 integer NOT NULL DEFAULT 71,
  t3 integer NOT NULL DEFAULT 55,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (ustoz_id)
);

ALTER TABLE hukm_grade_scales ENABLE ROW LEVEL SECURITY;

-- Indekslar analitika so'rovlari uchun
CREATE INDEX IF NOT EXISTS idx_hukm_answers_game_question ON hukm_answers (game_id, question_index);
CREATE INDEX IF NOT EXISTS idx_hukm_answers_player ON hukm_answers (player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_hukm_sessions_ustoz ON hukm_sessions (ustoz_id, started_at);
CREATE INDEX IF NOT EXISTS idx_hukm_questions_kodeks ON hukm_questions (kodeks_nomi);
