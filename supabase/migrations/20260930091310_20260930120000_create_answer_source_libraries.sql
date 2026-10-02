/*
# Create answer_source_libraries table + answer_library_enabled setting

## Purpose
Allow teachers to save a set of sources (text, URL, files) for reuse across
future moot court cases. When the feature flag `answer_library_enabled` is "false",
the current behavior (new notebook per case → answer → delete) is preserved exactly.

## New Tables
- `answer_source_libraries`
  - `id` (uuid, PK)
  - `teacher_id` (text, NOT NULL) — references ustoz_id from the ustoz table
  - `title` (text, ≤80 chars) — display name for the library
  - `sources` (jsonb) — [{name, type, size}] display-only metadata
  - `notebook_id` (text) — internal, never exposed to browser
  - `profile` (text) — internal, never exposed to browser
  - `status` (text: 'creating' | 'ready', default 'creating')
  - `created_at` (timestamptz)
  - `last_used_at` (timestamptz, nullable)

## Settings
- New row `answer_library_enabled` (text_value, default 'false').
  When 'false': current behavior is preserved (no library features visible).
  When 'true': library features are enabled.

## Security
- RLS enabled on `answer_source_libraries`.
- NO policies created — the browser (anon/authenticated) cannot read, insert,
  update, or delete this table directly. All access is through edge functions
  using the service role key, which bypasses RLS.
*/

-- Insert the settings flag if it doesn't exist
INSERT INTO settings (key, text_value)
VALUES ('answer_library_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Create the answer_source_libraries table
CREATE TABLE IF NOT EXISTS answer_source_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id text NOT NULL,
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 80),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  notebook_id text NOT NULL DEFAULT '',
  profile text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'creating' CHECK (status IN ('creating', 'ready')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

-- Enable RLS — no policies, so only service role (edge functions) can access
ALTER TABLE answer_source_libraries ENABLE ROW LEVEL SECURITY;

-- Index for listing a teacher's libraries ordered by last_used_at
CREATE INDEX IF NOT EXISTS idx_answer_source_libraries_teacher
  ON answer_source_libraries (teacher_id, last_used_at NULLS FIRST);
