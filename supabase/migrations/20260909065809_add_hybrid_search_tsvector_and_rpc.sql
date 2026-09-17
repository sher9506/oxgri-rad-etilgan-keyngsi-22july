-- 1. Add tsvector column for full-text search
ALTER TABLE qonun_moddalari
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;

-- 2. Populate tsvector from modda_matni + kodeks_nomi + modda_raqami + bob_nomi
UPDATE qonun_moddalari
SET search_tsv = to_tsvector('simple',
  coalesce(modda_matni, '') || ' ' ||
  coalesce(kodeks_nomi, '') || ' ' ||
  coalesce(modda_raqami, '') || ' ' ||
  coalesce(bob_nomi, '')
);

-- 3. Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS qonun_moddalari_search_tsv_gin
  ON qonun_moddalari USING GIN (search_tsv);

-- 4. Trigger to keep tsvector updated on INSERT/UPDATE
CREATE OR REPLACE FUNCTION qonun_moddalari_tsv_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_tsv := to_tsvector('simple',
    coalesce(NEW.modda_matni, '') || ' ' ||
    coalesce(NEW.kodeks_nomi, '') || ' ' ||
    coalesce(NEW.modda_raqami, '') || ' ' ||
    coalesce(NEW.bob_nomi, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qonun_moddalari_tsv ON qonun_moddalari;

CREATE TRIGGER trg_qonun_moddalari_tsv
  BEFORE INSERT OR UPDATE ON qonun_moddalari
  FOR EACH ROW
  EXECUTE FUNCTION qonun_moddalari_tsv_trigger();

-- 5. Hybrid search RPC: combines vector similarity + full-text rank
--    Weights are configurable via function arguments (not hardcoded).
CREATE OR REPLACE FUNCTION find_hybrid_articles(
  query_embedding vector(768),
  query_text text,
  match_count int DEFAULT 10,
  vector_weight float DEFAULT 0.7,
  text_weight float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  kodeks_nomi text,
  modda_raqami text,
  modda_matni text,
  manba_havola text,
  bob_nomi text,
  final_score float,
  vector_score float,
  text_score float,
  match_type text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH vector_search AS (
    SELECT
      q.id,
      1 - (q.embedding <=> query_embedding) AS vec_sim
    FROM qonun_moddalari q
    WHERE q.embedding IS NOT NULL
  ),
  text_search AS (
    SELECT
      q.id,
      ts_rank(q.search_tsv, plainto_tsquery('simple', query_text)) AS txt_rank
    FROM qonun_moddalari q
    WHERE q.search_tsv @@ plainto_tsquery('simple', query_text)
  ),
  max_text AS (
    SELECT max(txt_rank) AS max_rank FROM text_search
  )
  SELECT
    q.id,
    q.kodeks_nomi,
    q.modda_raqami,
    q.modda_matni,
    q.manba_havola,
    q.bob_nomi,
    -- final_score = w1 * normalized_vector + w2 * normalized_text
    (vector_weight * COALESCE(vs.vec_sim, 0) +
     text_weight * CASE WHEN mt.max_rank > 0
       THEN COALESCE(ts.txt_rank, 0) / mt.max_rank
       ELSE 0 END) AS final_score,
    COALESCE(vs.vec_sim, 0) AS vector_score,
    CASE WHEN mt.max_rank > 0
      THEN COALESCE(ts.txt_rank, 0) / mt.max_rank
      ELSE 0 END AS text_score,
    CASE
      WHEN vs.vec_sim IS NOT NULL AND ts.txt_rank IS NOT NULL THEN 'hybrid'
      WHEN vs.vec_sim IS NOT NULL THEN 'vector'
      ELSE 'text'
    END AS match_type
  FROM qonun_moddalari q
  LEFT JOIN vector_search vs ON q.id = vs.id
  LEFT JOIN text_search ts ON q.id = ts.id
  CROSS JOIN max_text mt
  WHERE vs.vec_sim IS NOT NULL OR ts.txt_rank IS NOT NULL
  ORDER BY final_score DESC
  LIMIT match_count;
$$;