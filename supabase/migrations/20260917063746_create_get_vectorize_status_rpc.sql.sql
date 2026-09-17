-- Fast status query for vectorize-articles edge function
-- Returns per-kodeks counts without loading all rows
CREATE OR REPLACE FUNCTION public.get_vectorize_status()
RETURNS TABLE (
  kodeks_nomi text,
  total bigint,
  vectorized bigint,
  errors bigint,
  pending bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kodeks_nomi,
    count(*) AS total,
    count(embedding) AS vectorized,
    count(*) - count(embedding) - count(*) FILTER (WHERE embedding IS NULL AND embedding_error IS NULL) AS errors,
    count(*) FILTER (WHERE embedding IS NULL AND embedding_error IS NULL) AS pending
  FROM qonun_moddalari
  GROUP BY kodeks_nomi;
$$;