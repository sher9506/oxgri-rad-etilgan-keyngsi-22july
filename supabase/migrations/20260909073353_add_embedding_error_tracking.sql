-- Add embedding error tracking columns to qonun_moddalari
ALTER TABLE qonun_moddalari
  ADD COLUMN IF NOT EXISTS embedding_error text,
  ADD COLUMN IF NOT EXISTS embedding_attempted_at timestamptz;

-- Index for quick lookup of pending (no embedding, no error) articles
CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_pending_embed
  ON qonun_moddalari(kodeks_nomi)
  WHERE embedding IS NULL AND embedding_error IS NULL;

-- Index for finding errored articles
CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_embed_error
  ON qonun_moddalari(kodeks_nomi)
  WHERE embedding_error IS NOT NULL;