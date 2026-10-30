-- Muallif ismini o'zgartirsa ham, e'lon qilingan maqolasi bo'lsa blog manzili
-- (/blog/muallif/<slug>) o'zgarmaydi — Google'dagi va ulashilgan havolalar 404 bo'lib qolmasin.
CREATE OR REPLACE FUNCTION ustoz_update_muallif_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
  new_slug text;
  suffix int := 1;
BEGIN
  IF NEW.full_name IS DISTINCT FROM OLD.full_name
     AND (NEW.muallif_slug IS NULL OR NEW.muallif_slug = slugify(OLD.full_name))
     AND (NEW.muallif_slug IS NULL OR NOT EXISTS (
       SELECT 1 FROM blog_posts WHERE ustoz_id = NEW.id AND status = 'published'
     )) THEN
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
