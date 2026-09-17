/*
# Create find_similar_articles RPC function for vector search

1. Functions
- `find_similar_articles(query_embedding vector(768), match_count int)`:
  Uses pgvector cosine distance operator (<=>) to find the most similar articles
  to the given query embedding. Returns article data + similarity score (0-1).
  Only returns articles that HAVE an embedding (embedding IS NOT NULL).

2. Security
- The function is SECURITY DEFINER so it can run with elevated privileges
  (needed because the edge function calls it via service role).
- It only reads from qonun_moddalari, which is already SELECT-accessible to all authenticated users.

3. Important Notes
- Cosine distance: 0 = identical, 2 = opposite. We convert to similarity: 1 - distance.
- The function filters out articles without embeddings (NULL).
- Results are ordered by similarity (highest first).
*/

CREATE OR REPLACE FUNCTION find_similar_articles(
  query_embedding vector(768),
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  kodeks_nomi text,
  modda_raqami text,
  modda_matni text,
  manba_havola text,
  similarity float
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    q.id,
    q.kodeks_nomi,
    q.modda_raqami,
    q.modda_matni,
    q.manba_havola,
    1 - (q.embedding <=> query_embedding) AS similarity
  FROM qonun_moddalari q
  WHERE q.embedding IS NOT NULL
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
$$;