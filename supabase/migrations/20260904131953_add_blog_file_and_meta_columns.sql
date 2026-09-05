/*
# Add file_url and meta_description columns to blog_posts

1. New Columns
- `file_url` (text, nullable) — public URL of the original uploaded file (PDF, Word, HTML)
  stored in Supabase Storage. When present, a "Download original file" button is shown
  on the article page. Null for articles written directly in the editor.
- `meta_description` (text, nullable) — short SEO description (150-160 chars) that appears
  in Google search results. Required before publishing.

2. Security
No RLS changes needed — these are text columns on the existing blog_posts table
which already has appropriate policies.
*/

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS meta_description text;
