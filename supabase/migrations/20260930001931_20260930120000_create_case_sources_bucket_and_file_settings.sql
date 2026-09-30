/*
# Create case-sources Storage bucket, file source setting, and source_files tracking

## Purpose
Enable PDF/Word file sources to be uploaded to Supabase Storage (private bucket) and
sent to the external answer service via signed URLs, instead of extracting text in-browser.

## Changes

### 1. Storage Bucket
- New private bucket `case-sources` (public = false).
- Used to store teacher-uploaded PDF/DOCX files for AI answer generation.
- Files stored at path: `{teacher_user_id}/{uuid}/{original_filename}`.

### 2. Storage RLS Policies
- INSERT: authenticated users can upload only to their own folder (`{auth.uid()}/...`).
- SELECT: authenticated users can read only their own files.
- DELETE: authenticated users can delete only their own files.
- No public read access. Only the service role (edge functions) can bypass RLS.

### 3. Settings Table
- New row `answer_file_sources_enabled` (boolean, default FALSE).
- When FALSE: current behavior (browser text extraction) is preserved.
- When TRUE: files are uploaded to Storage and sent via signed URLs.

### 4. case_answer_jobs Table
- New column `source_file_paths` (jsonb, default '[]'): list of storage paths
  for files uploaded for this job, so they can be cleaned up after completion.
*/

-- Insert the settings flag if it doesn't exist
INSERT INTO settings (key, text_value)
VALUES ('answer_file_sources_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Add source_file_paths column to case_answer_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'source_file_paths'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN source_file_paths jsonb DEFAULT '[]';
  END IF;
END $$;

-- Create the storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-sources', 'case-sources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies: teacher can only manage files under their own uid folder
-- Path format: {auth.uid()}/{uuid}/{filename}

DROP POLICY IF EXISTS "case_sources_upload_own" ON storage.objects;
CREATE POLICY "case_sources_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'case-sources'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "case_sources_read_own" ON storage.objects;
CREATE POLICY "case_sources_read_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'case-sources'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "case_sources_delete_own" ON storage.objects;
CREATE POLICY "case_sources_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'case-sources'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
