/*
# Fix profile-photos storage bucket RLS policies

## Muammo
Profile photos upload qilganda "new row violates row-level security policy" xatosi chiqdi.
Sababi: `profile_photos_upload_own` INSERT siyosatida faqat `WITH CHECK` bor edi,
lekin `upsert: true` ishlatilganda avval UPDATE qilinadi, keyin INSERT.
UPDATE siyosati `profile_photos_update_own` esa faqat `USING` bilan tekshirardi,
`WITH CHECK` yo'q edi. Bu RLS xatosiga olib kelardi.

## O'zgarishlar
1. `profile_photos_upload_own` — INSERT siyosati saqlandi (to'g'ri)
2. `profile_photos_update_own` — UPDATE siyosatiga `WITH CHECK` qo'shildi
3. `profile_photos_delete_own` — DELETE siyosati saqlandi (to'g'ri)
4. `profile_photos_read_all` — SELECT siyosati saqlandi (to'g'ri)

## Xavfsizlik
- Barcha siyosatlar `profile-photos` bucket uchun cheklangan
- Upload/update/delete faqat authenticated foydalanuvchilarga
- Read hamma uchun ochiq (profil rasmlari blog'da ko'rinadi)
*/

-- Drop existing policies
DROP POLICY IF EXISTS "profile_photos_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_read_all" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "profile_photos_delete_own" ON storage.objects;

-- Allow authenticated users to upload (INSERT)
CREATE POLICY "profile_photos_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

-- Allow public read (profile photos are visible on blog)
CREATE POLICY "profile_photos_read_all"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-photos');

-- Allow authenticated users to update (upsert support)
CREATE POLICY "profile_photos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos')
WITH CHECK (bucket_id = 'profile-photos');

-- Allow authenticated users to delete
CREATE POLICY "profile_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');
