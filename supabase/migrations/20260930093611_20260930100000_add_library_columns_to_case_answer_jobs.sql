/*
# Add library_id and is_library_reuse columns to case_answer_jobs

## Purpose
Track which answer_source_libraries row (if any) is associated with a job,
and whether the job is reusing a saved library vs creating a new one.
This lets case-answer-status update the library row after completion.

## Changes
### case_answer_jobs table
- New column `library_id` (uuid, nullable) — references answer_source_libraries.id
- New column `is_library_reuse` (boolean, default false) — true if reusing an existing library
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'library_id'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN library_id uuid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'is_library_reuse'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN is_library_reuse boolean NOT NULL DEFAULT false;
  END IF;
END $$;
