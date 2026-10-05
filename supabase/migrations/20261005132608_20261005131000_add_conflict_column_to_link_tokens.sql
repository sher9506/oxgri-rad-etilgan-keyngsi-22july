/*
# Telegram link token ga mojaro ustuni qo'shish

## Maqsad
Telegram ulash jarayonida chat_id boshqa talabaga bog'langan bo'lsa,
bot edge function mojaro ma'lumotini token qatoriga yozadi.
Frontend token ni poll qilib mojaroni aniqlaydi va tasdiq oynasini ko'rsatadi.

## Yangi ustun
- `telegram_link_tokens.conflict_talaba_id` (uuid, nullable) — agar mojaro
  bo'lsa, bu Telegram chat_id bog'langan boshqa talaba ID si.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'telegram_link_tokens' AND column_name = 'conflict_talaba_id') THEN
    ALTER TABLE telegram_link_tokens ADD COLUMN conflict_talaba_id uuid;
  END IF;
END $$;
