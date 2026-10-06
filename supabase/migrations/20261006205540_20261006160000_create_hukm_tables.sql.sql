/*
# Hukm — jonli viktorina jadvallari (v1)

1. Yangi jadvallar
- `hukm_quizzes`: viktorina shabloni (ustoz yaratadi). owner = ustoz.id (uuid, da'vo sifatida).
- `hukm_questions`: savollar. quiz_id FK, position, type (variant4|togri_notogri|kazus), options jsonb, time_limit_s, explanation, legal_basis, hint.
- `hukm_games`: jonli o'yin. quiz_id FK, pin (6 raqam noyob faol o'yinlar orasida), status, current_index, opened_at, host_token_hash, settings jsonb.
- `hukm_players`: o'yinchi. game_id FK, nickname, player_token_hash, talaba_id (nullable), kicked.
- `hukm_answers`: javob. game_id+player_id+question_index unique. choice, received_at (server), correct, points.

2. Xavfsizlik
- Barcha jadvalda RLS yoqilgan.
- HECH QANDAY policy yo'q — anon va authenticated ham hech narsa qila olmaydi.
- Faqat edge function (service role) kiradi.

3. Index'lar
- hukm_games.pin (faqat faol o'yinlar orasida noyob bo'lishi uchun partial unique index)
- hukm_questions.quiz_id
- hukm_players.game_id
- hukm_answers unique (game_id, player_id, question_index)
*/

-- hukm_quizzes
CREATE TABLE IF NOT EXISTS hukm_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner uuid, -- ustoz.id (da'vo sifatida, vakolat emas)
  title text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE hukm_quizzes ENABLE ROW LEVEL SECURITY;

-- hukm_questions
CREATE TABLE IF NOT EXISTS hukm_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES hukm_quizzes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'variant4' CHECK (type IN ('variant4','togri_notogri','kazus')),
  text text NOT NULL,
  case_text text DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_limit_s int NOT NULL DEFAULT 20,
  explanation text DEFAULT '',
  legal_basis text DEFAULT '',
  hint text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hukm_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hukm_questions_quiz_id ON hukm_questions(quiz_id);

-- hukm_games
CREATE TABLE IF NOT EXISTS hukm_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES hukm_quizzes(id) ON DELETE CASCADE,
  pin text NOT NULL,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','question','reveal','leaderboard','finished')),
  current_index int NOT NULL DEFAULT -1,
  opened_at timestamptz,
  host_token_hash text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{"speed_bonus":true,"registered_only":false,"lobby_locked":false,"show_text_on_phone":true}'::jsonb,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE hukm_games ENABLE ROW LEVEL SECURITY;
-- PIN noyob faqat faol (finished bo'lmagan) o'yinlar orasida
CREATE UNIQUE INDEX IF NOT EXISTS idx_hukm_games_pin_active ON hukm_games(pin) WHERE status != 'finished';

-- hukm_players
CREATE TABLE IF NOT EXISTS hukm_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES hukm_games(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  player_token_hash text NOT NULL,
  talaba_id uuid, -- nullable, tasdiqlanmagan da'vo
  joined_at timestamptz DEFAULT now(),
  kicked boolean NOT NULL DEFAULT false
);
ALTER TABLE hukm_players ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hukm_players_game_id ON hukm_players(game_id);

-- hukm_answers
CREATE TABLE IF NOT EXISTS hukm_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES hukm_games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES hukm_players(id) ON DELETE CASCADE,
  question_index int NOT NULL,
  choice int,
  received_at timestamptz NOT NULL DEFAULT now(),
  correct boolean NOT NULL DEFAULT false,
  points int NOT NULL DEFAULT 0
);
ALTER TABLE hukm_answers ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hukm_answers_unique ON hukm_answers(game_id, player_id, question_index);
