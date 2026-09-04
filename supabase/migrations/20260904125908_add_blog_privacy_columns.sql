/*
# Add blog privacy toggle columns to ustoz table

1. New Columns
- `telegram_public` (boolean, default false) — when true, the teacher's Telegram username is visible on their blog author profile
- `phone_public` (boolean, default false) — when true, the teacher's phone number is visible on their blog author profile

2. Purpose
Teachers can independently control whether their Telegram username and/or phone number
are shown publicly on their blog author page. Both default to false (hidden) so no
contact info is ever exposed without explicit opt-in.

3. Security
No RLS changes needed — these are boolean columns on the existing `ustoz` table
which already has appropriate policies. The columns are readable by anon/authenticated
(same as other public profile fields like full_name, face_photo_url, note).
*/

ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS telegram_public boolean NOT NULL DEFAULT false;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS phone_public boolean NOT NULL DEFAULT false;
