/*
# Add views column to blog_posts

1. New Columns
- `blog_posts.views` (integer, default 0) — view counter for each blog post

2. Security
- A SECURITY DEFINER function `increment_blog_views(slug text)` increments views safely server-side
- This prevents client-side manipulation of view counts
- The function is callable by anon and authenticated roles

3. Important Notes
- Idempotent: uses DO $$ to check column existence before adding
- Existing posts get views = 0
*/

DO $$ BEGIN
  ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION increment_blog_views(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE blog_posts SET views = views + 1 WHERE slug = p_slug AND status = 'published';
END;
$$;

GRANT EXECUTE ON FUNCTION increment_blog_views(text) TO anon, authenticated;
