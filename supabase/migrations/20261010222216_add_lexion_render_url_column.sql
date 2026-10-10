/*
# Add lexion_render_url column to case_answer_jobs

1. Purpose
   - Tracks which Lexion search URL was used for each job, enabling:
     a) Correct polling of Lexion job status (multiple Lexion backends support)
     b) Retry on a different Lexion backend when one fails
     c) Admin visibility into which search backend was used

2. Changes
   - ADD COLUMN lexion_render_url text (nullable, default null)
   - No RLS changes (existing policies cover new column automatically)

3. Notes
   - Column is nullable; existing rows will have null (no data loss)
   - No index needed (column is only read by single-job polling queries)
*/

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS lexion_render_url text;