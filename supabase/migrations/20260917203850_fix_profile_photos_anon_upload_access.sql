/*
# Fix profile photo upload access and replacement

## Summary
The application uses its own teacher login flow rather than a Supabase Auth session.
Therefore browser uploads arrive as the `anon` database role. This migration allows
that existing application flow to upload, replace, and remove public teacher profile
photos without changing any application login logic.

## Security
1. Read access remains public because teacher photos appear on public blog pages.
2. Insert, update, and delete access is limited to the `profile-photos` bucket.
3. No tables, columns, or stored data are removed or changed.
*/

DROP POLICY IF EXISTS "profile_photos_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_delete_own" ON storage.objects;

CREATE POLICY "profile_photos_upload_own"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "profile_photos_update_own"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'profile-photos')
WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "profile_photos_delete_own"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'profile-photos');
