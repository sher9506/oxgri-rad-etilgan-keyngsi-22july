/*
# Add slug columns for blog posts and authors

1. New Columns
- `blog_posts.slug` (text, unique) — URL-friendly slug for each blog post, auto-generated from sarlavha
- `ustoz.muallif_slug` (text, unique) — URL-friendly slug for each author, auto-generated from full_name

2. Purpose
- Enables clean URLs: /blog/{slug} for blog posts and /blog/muallif/{muallif_slug} for author pages
- Improves SEO by making blog post and author URLs human-readable and indexable

3. Data Population
- Existing blog_posts rows get slug generated from sarlavha (lowercased, Latin-transliterated, hyphenated)
- Existing ustoz rows get muallif_slug generated from full_name (lowercased, Latin-transliterated, hyphenated)
- A trigger function auto-generates slug on insert if not provided

4. Security
- No RLS policy changes — existing policies remain in effect
- New columns are readable by the same roles that already have SELECT access

5. Important Notes
- The slugify function handles Cyrillic-to-Latin transliteration for Uzbek names
- Uniqueness is enforced via UNIQUE constraints with conflict resolution using a suffix
- Idempotent: uses DO $$ blocks to check column existence before adding
*/

-- Slugify function: converts text to a URL-friendly slug
CREATE OR REPLACE FUNCTION slugify(input text) RETURNS text AS $$
DECLARE
  result text;
BEGIN
  result := lower(trim(input));
  -- Common Cyrillic-to-Latin transliteration for Uzbek
  result := replace(result, 'а','a'); result := replace(result, 'б','b'); result := replace(result, 'в','v');
  result := replace(result, 'г','g'); result := replace(result, 'д','d'); result := replace(result, 'е','e');
  result := replace(result, 'ё','e'); result := replace(result, 'ж','j'); result := replace(result, 'з','z');
  result := replace(result, 'и','i'); result := replace(result, 'й','y'); result := replace(result, 'к','k');
  result := replace(result, 'л','l'); result := replace(result, 'м','m'); result := replace(result, 'н','n');
  result := replace(result, 'о','o'); result := replace(result, 'п','p'); result := replace(result, 'р','r');
  result := replace(result, 'с','s'); result := replace(result, 'т','t'); result := replace(result, 'у','u');
  result := replace(result, 'ф','f'); result := replace(result, 'х','h'); result := replace(result, 'ц','ts');
  result := replace(result, 'ч','ch'); result := replace(result, 'ш','sh'); result := replace(result, 'щ','sh');
  result := replace(result, 'ъ',''); result := replace(result, 'ь',''); result := replace(result, 'ы','i');
  result := replace(result, 'э','e'); result := replace(result, 'ю','yu'); result := replace(result, 'я','ya');
  result := replace(result, 'ў','o'); result := replace(result, 'қ','q'); result := replace(result, 'ғ','g');
  result := replace(result, 'ҳ','h'); result := replace(result, 'ж','j');
  -- Replace spaces and non-alphanumeric with hyphens
  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := regexp_replace(result, '-+', '-', 'g');
  result := trim(both '-' from result);
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add slug column to blog_posts
DO $$ BEGIN
  ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS slug text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add muallif_slug column to ustoz
DO $$ BEGIN
  ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS muallif_slug text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Populate existing blog_posts slugs
UPDATE blog_posts SET slug = slugify(sarlavha) WHERE slug IS NULL OR slug = '';

-- Populate existing ustoz muallif_slug
UPDATE ustoz SET muallif_slug = slugify(full_name) WHERE muallif_slug IS NULL OR muallif_slug = '';

-- Handle duplicates by appending a numeric suffix
DO $$
DECLARE
  dup_row RECORD;
  counter int;
BEGIN
  -- blog_posts slug duplicates
  FOR dup_row IN
    SELECT slug, count(*) as cnt FROM blog_posts WHERE slug IS NOT NULL GROUP BY slug HAVING count(*) > 1
  LOOP
    counter := 1;
    FOR dup_row IN
      SELECT id FROM blog_posts WHERE slug = dup_row.slug ORDER BY created_at
    LOOP
      UPDATE blog_posts SET slug = dup_row.slug || '-' || counter WHERE id = dup_row.id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END $$;

-- Fix any remaining NULL or empty slugs with a fallback
UPDATE blog_posts SET slug = 'post-' || substr(id::text, 1, 8) WHERE slug IS NULL OR slug = '';
UPDATE ustoz SET muallif_slug = 'muallif-' || substr(id::text, 1, 8) WHERE muallif_slug IS NULL OR muallif_slug = '';

-- Add unique indexes (after data is populated)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_slug_unique ON blog_posts (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ustoz_muallif_slug_unique ON ustoz (muallif_slug);

-- Create trigger function to auto-generate blog_posts.slug on insert
CREATE OR REPLACE FUNCTION blog_posts_set_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
  new_slug text;
  suffix int := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := slugify(NEW.sarlavha);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'post-' || substr(NEW.id::text, 1, 8);
    END IF;
    new_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM blog_posts WHERE slug = new_slug AND id != NEW.id) LOOP
      new_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    NEW.slug := new_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blog_posts_set_slug ON blog_posts;
CREATE TRIGGER trg_blog_posts_set_slug
  BEFORE INSERT ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_set_slug();

-- Create trigger function to auto-generate ustoz.muallif_slug on insert
CREATE OR REPLACE FUNCTION ustoz_set_muallif_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
  new_slug text;
  suffix int := 1;
BEGIN
  IF NEW.muallif_slug IS NULL OR NEW.muallif_slug = '' THEN
    base_slug := slugify(NEW.full_name);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'muallif-' || substr(NEW.id::text, 1, 8);
    END IF;
    new_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM ustoz WHERE muallif_slug = new_slug AND id != NEW.id) LOOP
      new_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    NEW.muallif_slug := new_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ustoz_set_muallif_slug ON ustoz;
CREATE TRIGGER trg_ustoz_set_muallif_slug
  BEFORE INSERT ON ustoz
  FOR EACH ROW EXECUTE FUNCTION ustoz_set_muallif_slug();

-- Also update muallif_slug when full_name changes
CREATE OR REPLACE FUNCTION ustoz_update_muallif_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
  new_slug text;
  suffix int := 1;
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name AND (NEW.muallif_slug IS NULL OR NEW.muallif_slug = slugify(OLD.full_name)) THEN
    base_slug := slugify(NEW.full_name);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'muallif-' || substr(NEW.id::text, 1, 8);
    END IF;
    new_slug := base_slug;
    WHILE EXISTS (SELECT 1 FROM ustoz WHERE muallif_slug = new_slug AND id != NEW.id) LOOP
      new_slug := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    NEW.muallif_slug := new_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ustoz_update_muallif_slug ON ustoz;
CREATE TRIGGER trg_ustoz_update_muallif_slug
  BEFORE UPDATE ON ustoz
  FOR EACH ROW EXECUTE FUNCTION ustoz_update_muallif_slug();
