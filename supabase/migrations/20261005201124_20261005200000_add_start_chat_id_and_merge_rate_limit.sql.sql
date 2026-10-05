/*
# Telegram link token: start_chat_id ustun + birlashtirish rate limit jadvali

1. Yangi ustun
- `telegram_link_tokens.start_chat_id` (bigint, NULL) — START jo'natgan chat_id
  Mojaro tasdig'i callback da shu chat_id bilan solishtiriladi.

2. Yangi jadval
- `merge_attempts` — birlashtirish urinishlarini soatiga 3 martaga cheklash uchun
  - `id` (uuid PK)
  - `talaba_id` (uuid, FK → talabalar)
  - `created_at` (timestamptz, default now())

3. Index
- `merge_attempts` ustida `talaba_id, created_at` bo'yicha index — soatlik tekshiruv uchun

4. Security
- `merge_attempts` RLS yoqilgan, anon/authenticated uchun deny (faqat service role yozadi)
- `telegram_link_tokens` RLS o'zgarmaydi (deny_all_anon_link_tokens saqlanadi)
*/

-- 1. start_chat_id ustun
ALTER TABLE telegram_link_tokens
  ADD COLUMN IF NOT EXISTS start_chat_id bigint;

-- 2. merge_attempts jadval
CREATE TABLE IF NOT EXISTS merge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talaba_id uuid NOT NULL REFERENCES talabalar(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merge_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_merge_attempts" ON merge_attempts;
CREATE POLICY "deny_all_merge_attempts"
  ON merge_attempts FOR SELECT
  TO anon, authenticated
  USING (false);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_merge_attempts_talaba_created
  ON merge_attempts (talaba_id, created_at DESC);
