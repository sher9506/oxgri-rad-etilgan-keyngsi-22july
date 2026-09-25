-- Add kelishmovchilik (disagreement) flag to moot_court_sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moot_court_sessions' AND column_name = 'kelishmovchilik') THEN
    ALTER TABLE moot_court_sessions ADD COLUMN kelishmovchilik boolean DEFAULT false;
  END IF;
END $$;

-- Add index for filtering disputed sessions
CREATE INDEX IF NOT EXISTS idx_moot_sessions_kelishmovchilik ON moot_court_sessions(kelishmovchilik) WHERE kelishmovchilik = true;
