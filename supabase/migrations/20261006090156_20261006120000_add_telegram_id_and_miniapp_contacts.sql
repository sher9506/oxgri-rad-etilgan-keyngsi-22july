/*
# Add telegram_id column to talabalar + create miniapp_contacts table

## Changes

### 1. talabalar table
- Adds `telegram_id` (bigint, nullable) column — stores the Telegram user ID (numeric, permanent, bot-independent).
- This is DIFFERENT from the existing `telegram_chat_id` (text) which stores the chat/conversation ID and is bot-specific.
- An index on `telegram_id` is created for fast lookups during Mini App auth.
- `telegram_id` is bot-independent: when admin swaps the Mini App bot token, users keep the same telegram_id and are found automatically.

### 2. miniapp_contacts table (NEW)
- Stores phone numbers shared via Telegram Mini App `requestContact()`.
- Columns: `telegram_id` (bigint PK), `phone` (text), `created_at` (timestamptz).
- Only the edge function (service role) writes to this table — no anon access.
- Used as a fallback lookup: if a user opens the Mini App but has no `telegram_id` in `talabalar`, we check `miniapp_contacts` for their phone, then match against `talabalar.phone`.

### 3. Security
- RLS enabled on `miniapp_contacts`.
- NO policies created — only service role can access (edge functions use service role key).
- `talabalar` RLS is not modified (existing policies remain unchanged).
*/

-- 1. Add telegram_id column to talabalar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talabalar' AND column_name = 'telegram_id'
  ) THEN
    ALTER TABLE talabalar ADD COLUMN telegram_id bigint;
  END IF;
END $$;

-- Index for fast telegram_id lookups
CREATE INDEX IF NOT EXISTS idx_talabalar_telegram_id ON talabalar (telegram_id) WHERE telegram_id IS NOT NULL;

-- 2. Create miniapp_contacts table
CREATE TABLE IF NOT EXISTS miniapp_contacts (
  telegram_id bigint PRIMARY KEY,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS — no policies = service-role only
ALTER TABLE miniapp_contacts ENABLE ROW LEVEL SECURITY;
