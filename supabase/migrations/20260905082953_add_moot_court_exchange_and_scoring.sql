-- Add max_exchanges to moot_court_cases
ALTER TABLE moot_court_cases ADD COLUMN IF NOT EXISTS max_exchanges integer DEFAULT 5;
ALTER TABLE moot_court_cases ADD CONSTRAINT max_exchanges_range CHECK (max_exchanges >= 3 AND max_exchanges <= 10);

-- Add AI scoring columns to moot_court_sessions
ALTER TABLE moot_court_sessions ADD COLUMN IF NOT EXISTS ai_score integer;
ALTER TABLE moot_court_sessions ADD COLUMN IF NOT EXISTS ai_score_breakdown jsonb;
ALTER TABLE moot_court_sessions ADD COLUMN IF NOT EXISTS ai_comment text;
ALTER TABLE moot_court_sessions ADD COLUMN IF NOT EXISTS teacher_score integer;