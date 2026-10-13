-- Hukm v3: join log'ga success ustuni (faqat muvaffaqiyatsiz urinishlar sanalsin)
ALTER TABLE hukm_join_log ADD COLUMN IF NOT EXISTS success boolean DEFAULT false;

-- Eski yozuvlarni tozalash uchun index (1 sutkadan eski)
CREATE INDEX IF NOT EXISTS idx_hukm_join_log_created_at ON hukm_join_log (created_at);
