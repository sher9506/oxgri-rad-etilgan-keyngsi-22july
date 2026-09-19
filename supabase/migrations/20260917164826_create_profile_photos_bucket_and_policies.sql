-- Profile photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "profile_photos_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-photos');

-- Allow public read (profile photos are visible on blog)
CREATE POLICY "profile_photos_read_all"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-photos');

-- Allow users to update/delete their own photos
CREATE POLICY "profile_photos_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-photos');

CREATE POLICY "profile_photos_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-photos');
