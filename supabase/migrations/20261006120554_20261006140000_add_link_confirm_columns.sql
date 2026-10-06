-- 20261006140000_add_link_confirm_columns.sql
-- Account linking: telegram_link_tokens kengaytirish (ikki isbotli holat mashinasi)

-- 1. Yangi UUID id ustun qo'shamaslik (avval token PK ni olib tashlash kerak)
ALTER TABLE telegram_link_tokens DROP CONSTRAINT telegram_link_tokens_pkey;

-- 2. token ustunini nullable qilamiz (yangi yozuvlarda xom token saqlanmaydi)
ALTER TABLE telegram_link_tokens ALTER COLUMN token DROP NOT NULL;

-- 3. Yangi id UUID ustun va PK
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE telegram_link_tokens ADD CONSTRAINT telegram_link_tokens_pkey PRIMARY KEY (id);

-- 4. token_hash ustunini unique qilamiz (eski NULL qatorlar uchun partial unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_link_tokens_token_hash_unique
  ON telegram_link_tokens(token_hash) WHERE token_hash IS NOT NULL;

-- 5. Google isboti
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS google_sub text;
-- 6. Telegram isboti (initData'dan)
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS telegram_id bigint;
-- 7. Google OAuth state hash (CSRF)
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS state_hash text;
-- 8. Holat: pending, google_proven, telegram_proven, confirmed, rejected
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
-- 9. IP rate limit uchun
ALTER TABLE telegram_link_tokens ADD COLUMN IF NOT EXISTS ip_address text;

-- Indekslar
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_telegram_id
  ON telegram_link_tokens(telegram_id) WHERE telegram_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_state_hash
  ON telegram_link_tokens(state_hash) WHERE state_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_talaba_id
  ON telegram_link_tokens(talaba_id);

-- MINIAPP_LINK_CHANNEL setting
INSERT INTO settings (key, text_value, value, tavsif)
VALUES ('MINIAPP_LINK_CHANNEL', '', false, 'Mini App birlashtirish uchun majburiy kanal')
ON CONFLICT (key) DO NOTHING;