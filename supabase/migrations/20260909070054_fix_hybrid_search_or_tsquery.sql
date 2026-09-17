-- Fix hybrid search: use OR-based tsquery instead of AND-based plainto_tsquery
-- plainto_tsquery requires ALL words to match; we want ANY word to match (OR)
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
  -- Build OR-based tsquery: split words, join with | for to_tsquery
  text_search AS (
    SELECT
      q.id,
      ts_rank(q.search_tsv, to_tsquery('simple', 
        regexp_replace(
          trim(regexp_replace(lower(query_text), '[^\w\u0400-\u04FF\u0250-\u02AF\u02BB\u02BF]', ' ', 'g')),
          '\s+', ' | ', 'g'
        )
      )) AS txt_rank
    FROM qonun_moddalari q
    WHERE q.search_tsv @@ to_tsquery('simple', 
        regexp_replace(
          trim(regexp_replace(lower(query_text), '[^\w\u0400-\u04FF\u0250-\u02AF\u02BB\u02BF]', ' ', 'g')),
          '\s+', ' | ', 'g'
        )
      )
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