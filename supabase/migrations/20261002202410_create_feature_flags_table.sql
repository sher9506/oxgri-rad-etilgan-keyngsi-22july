/*
# Create feature_flags table for maintenance mode

1. New Tables
- `feature_flags` — feature bayroqlari uchun jadval
  - `key` (text, primary key) — bayroq nomi, masalan 'MOOT_COURT_MAINTENANCE'
  - `value` (text) — bayroq qiymati ('true' / 'false')
  - `updated_at` (timestamptz, default now()) — oxirgi o'zgartirilgan vaqt

2. Security
- RLS yoqilgan: anon va authenticated faqat SELECT qila oladi
- INSERT/UPDATE/DELETE faqat service_role (admin SQL) orqali — hech qanday policy yozilmaydi
- settings jadvalidagi sezuvli ma'lumotlardan alohida, bu jadvalda faqat bayroqlar bor

3. Realtime
- Jadval Supabase Realtime publication'ga qo'shilgan (UPDATE/INSERT event'lari uchun)

4. Initial Data
- MOOT_COURT_MAINTENANCE = 'true' qatori kiritilgan (rejim hozirdan yoqilgan)
*/

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT 'false',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Anon va authenticated faqat o'qiy oladi
DROP POLICY IF EXISTS "feature_flags_select_all" ON feature_flags;
CREATE POLICY "feature_flags_select_all"
ON feature_flags FOR SELECT
TO anon, authenticated
USING (true);

-- INSERT/UPDATE/DELETE uchun hech qanday policy yo'q — faqat service_role (RLS bypass) yozishi mumkin

-- Realtime publication'ga qo'shish
ALTER PUBLICATION supabase_realtime ADD TABLE feature_flags;

-- Bayroqni yoqilgan holatda kiritish (idempotent)
INSERT INTO feature_flags (key, value) VALUES ('MOOT_COURT_MAINTENANCE', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
