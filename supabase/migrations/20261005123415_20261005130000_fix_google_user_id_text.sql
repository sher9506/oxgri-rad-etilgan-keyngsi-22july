/*
# Fix Google user ID storage type

1. Purpose
- Google OAuth returns `sub` as a string identifier, which may be a long numeric value and is not a UUID.
- The existing `talabalar.google_user_id` column was incorrectly typed as UUID, causing new Google sign-ins to fail during INSERT.

2. Modified columns
- `public.talabalar.google_user_id`: converted from UUID to text using the existing value's text representation.
- Existing rows and their Google IDs are preserved.

3. View preservation
- `public.talabalar_ommaviy` is recreated with the same columns and verified-status expression because PostgreSQL does not allow changing a column type while a view depends on it.
- Existing view access for anon, authenticated, postgres, and service_role is restored.

4. Constraints and security
- The existing unique constraint on `google_user_id` remains in place.
- No rows are deleted and no row access policies are changed.

5. Important notes
- Google IDs are now stored exactly as returned by Google's verified userinfo response.
- `kurs` and `guruh` remain nullable and are not changed by this migration.
*/

DROP VIEW IF EXISTS public.talabalar_ommaviy;

ALTER TABLE public.talabalar
  ALTER COLUMN google_user_id TYPE text
  USING google_user_id::text;

CREATE VIEW public.talabalar_ommaviy AS
SELECT
  id,
  ism,
  familiya,
  avatar_url,
  (google_user_id IS NOT NULL AND telegram_chat_id IS NOT NULL) AS tasdiqlangan
FROM public.talabalar;

GRANT ALL ON public.talabalar_ommaviy TO anon, authenticated, postgres, service_role;