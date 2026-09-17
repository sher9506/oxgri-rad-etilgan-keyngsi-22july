/*
# Enable pgvector + add embedding column to qonun_moddalari

1. Extensions
- Enable `vector` extension (pgvector) for cosine similarity search

2. Schema Changes
- Add `embedding` column (vector(768)) to `qonun_moddalari` — stores text embeddings
  768 dimensions matches Gemini's text-embedding-004 model output
- Add `bob_nomi` column (text, optional) to `qonun_moddalari` — stores chapter/section name

3. Indexes
- Add IVF index on embedding column for fast cosine similarity search
  (ivfflat with lists=100, probes=10 — good for up to ~10k articles)

4. Security
- No policy changes — existing RLS policies remain intact

5. Important Notes
- The embedding column is nullable — existing articles without embeddings still work
- The vector dimension (768) matches Google's text-embedding-004 model
- IVF index allows fast approximate nearest neighbor search even with thousands of articles
*/

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE qonun_moddalari ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE qonun_moddalari ADD COLUMN IF NOT EXISTS bob_nomi text;

CREATE INDEX IF NOT EXISTS idx_qonun_moddalari_embedding
  ON qonun_moddalari USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);