/*
# Add retry control, public demo flag, and guest session support to Moot Court

1. New Columns on `moot_court_cases`
- `allow_retry` (boolean, default true) — ustoz talabaning qayta yechishiga ruxsat beradimi yo'qmi
- `is_public_demo` (boolean, default false) — bu kazus tizimga kirmagan mehmonlar uchun namunaviy demo sifatida ko'rinadimi

2. New Columns on `moot_court_sessions`
- `guest_token` (text, nullable) — mehmon sessiyalari uchun vaqtinchalik identifikator
- `oquvchi_ismi` altered to nullable via new column not feasible without data loss, so we keep existing but allow guest sessions to use a default name

3. Security
- No RLS policy changes needed — existing anon+authenticated policies already allow CRUD.
- New columns are accessible through existing policies.

4. Important Notes
- `allow_retry` defaults to true so existing kazuslar behavior is unchanged.
- `is_public_demo` defaults to false so no kazus is accidentally exposed to guests.
- `guest_token` is nullable so existing sessions are unaffected.
*/

ALTER TABLE moot_court_cases ADD COLUMN IF NOT EXISTS allow_retry boolean NOT NULL DEFAULT true;
ALTER TABLE moot_court_cases ADD COLUMN IF NOT EXISTS is_public_demo boolean NOT NULL DEFAULT false;

ALTER TABLE moot_court_sessions ADD COLUMN IF NOT EXISTS guest_token text;
