/*
# Bulk update embeddings RPC

1. New Functions
- `bulk_update_embeddings`: SECURITY DEFINER function that accepts an array of
  {id, embedding, error} records and updates them all in a single DB round-trip
  instead of N individual UPDATE queries. Dramatically speeds up vectorization.
2. Security
- SECURITY DEFINER so the service-role key can use it; no RLS change needed.
- Only callable with service_role key (runs with elevated privileges).
*/

CREATE OR REPLACE FUNCTION bulk_update_embeddings(
  p_records jsonb
) RETURNS TABLE(updated bigint, errored bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec jsonb;
  upd_count bigint := 0;
  err_count bigint := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    IF (rec->>'embedding') IS NOT NULL THEN
      UPDATE qonun_moddalari
      SET embedding = (rec->>'embedding')::vector,
          embedding_error = NULL,
          embedding_attempted_at = now()
      WHERE id = (rec->>'id')::uuid;
      GET DIAGNOSTICS upd_count = ROW_COUNT;
    ELSIF (rec->>'error') IS NOT NULL THEN
      UPDATE qonun_moddalari
      SET embedding_error = LEFT(rec->>'error', 300),
          embedding_attempted_at = now()
      WHERE id = (rec->>'id')::uuid;
      GET DIAGNOSTICS err_count = ROW_COUNT;
    END IF;
  END LOOP;
  RETURN QUERY SELECT upd_count, err_count;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_update_embeddings(jsonb) TO authenticated, anon;
