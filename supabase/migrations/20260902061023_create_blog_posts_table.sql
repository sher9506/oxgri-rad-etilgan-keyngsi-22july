/*
# Create blog_posts table

1. New Tables
- `blog_posts`
  - `id` (uuid, primary key)
  - `ustoz_id` (uuid, the teacher who wrote the post — stored as plain uuid, no FK since ustoz table may be in a different DB)
  - `ustoz_ismi` (text, the teacher's full name for display)
  - `sarlavha` (text, the blog post title)
  - `mazmun` (text, the blog post body content)
  - `rasm_url` (text, optional cover image URL)
  - `status` (text, 'draft' or 'published', default 'published')
  - `created_at` (timestamptz, when the post was created)
  - `updated_at` (timestamptz, when the post was last edited)
2. Security
- Enable RLS on blog_posts.
- All CRUD uses TO anon, authenticated because this app uses custom auth (no Supabase Auth session, so auth.uid() is null). The frontend enforces ownership checks.
- SELECT: anyone can read posts (students read published posts).
- INSERT/UPDATE/DELETE: frontend enforces that only the logged-in teacher can modify their own posts.
3. Important Notes
- This app does NOT use Supabase Auth — it uses custom auth against the `ustoz` table with client-side password hashing. Therefore auth.uid() is always null, and policies must use `TO anon, authenticated`.
- The ustoz_id column has no foreign key because the ustoz table may not exist in this database instance.
*/

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id uuid,
  ustoz_ismi text NOT NULL DEFAULT '',
  sarlavha text NOT NULL DEFAULT '',
  mazmun text NOT NULL DEFAULT '',
  rasm_url text,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_blog_posts" ON blog_posts;
CREATE POLICY "anon_select_blog_posts" ON blog_posts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_blog_posts" ON blog_posts;
CREATE POLICY "anon_insert_blog_posts" ON blog_posts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_blog_posts" ON blog_posts;
CREATE POLICY "anon_update_blog_posts" ON blog_posts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_blog_posts" ON blog_posts;
CREATE POLICY "anon_delete_blog_posts" ON blog_posts FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts (created_at DESC);
