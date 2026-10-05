/*
# Telegram bir marta bog'lanish + bir martalik havola tokenlari

## Maqsad
B) telegram_chat_id bir marta yozilgach o'zgarmaslik (trigger + partial unique index)
C) Tokenlar hash saqlash (sha256), used_at ustuni

## Yangi ustunlar
1. telegram_link_tokens.token_hash (text) — sha256(token)
2. telegram_login_sessions.used_at (timestamptz) — bir martalik kirish tokeni sarflangan vaqt

## Yangi indexlar
- talabalar_telegram_chat_id_uidx — partial unique index
  (bitta Telegram bitta faol talabaga)

## Yangi trigger
- talabalar_telegram_immutable — BEFORE UPDATE, telegram_chat_id
  o'zgartirishni rad etadi. Istisno: session_setting birlashtirish_aktiv=on

## Yangi funksiyalar
- set_merge_flag(boolean) — SECURITY DEFINER, merge payti triggerni vaqtinchalik o'chirish
*/

-- 1. telegram_link_tokens: token_hash ustuni
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'telegram_link_tokens' AND column_name = 'token_hash') THEN
    ALTER TABLE telegram_link_tokens ADD COLUMN token_hash text;
  END IF;
END $$;

-- Eski tokenlarni hash ga o'tkazish
UPDATE telegram_link_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tlt_token_hash ON telegram_link_tokens(token_hash) WHERE token_hash IS NOT NULL;

-- 2. telegram_login_sessions: used_at ustuni
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'telegram_login_sessions' AND column_name = 'used_at') THEN
    ALTER TABLE telegram_login_sessions ADD COLUMN used_at timestamptz;
  END IF;
END $$;

-- 3. telegram_chat_id partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS talabalar_telegram_chat_id_uidx
ON talabalar(telegram_chat_id)
WHERE telegram_chat_id IS NOT NULL AND merged_into IS NULL;

-- 4. Merge flag funksiyasi
CREATE OR REPLACE FUNCTION set_merge_flag(p_on boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_on THEN
    PERFORM set_config('birlashtirish_aktiv', 'on', true);
  ELSE
    PERFORM set_config('birlashtirish_aktiv', 'off', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_merge_flag(boolean) TO anon, authenticated;

-- 5. Trigger funksiyasi
CREATE OR REPLACE FUNCTION talabalar_telegram_immutable_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merge_flag text;
BEGIN
  v_merge_flag := current_setting('birlashtirish_aktiv', true);
  IF v_merge_flag = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.telegram_chat_id IS NOT NULL AND NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    RAISE EXCEPTION 'Telegram chat_id bir marta boglangach o-zgartirib boilmaydi';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talabalar_telegram_immutable ON talabalar;
CREATE TRIGGER trg_talabalar_telegram_immutable
BEFORE UPDATE ON talabalar
FOR EACH ROW
EXECUTE FUNCTION talabalar_telegram_immutable_trigger();
