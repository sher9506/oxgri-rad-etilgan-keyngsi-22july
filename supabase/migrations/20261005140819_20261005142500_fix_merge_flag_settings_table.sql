/*
# Fix: set_merge_flag — settings jadvalidan foydalanish

## Muammo
PostgreSQL custom GUC parametrlarini set_config orqali o'rnatib
bo'lmaydi (unrecognized configuration parameter xatosi).

## Yechim
set_merge_flag funksiyasi settings jadvalida vaqtinchalik yozuv
yaratadi. Trigger funksiyasi settings jadvalidan tekshiradi.
*/
CREATE OR REPLACE FUNCTION set_merge_flag(p_on boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_on THEN
    -- Settings jadvaliga vaqtinchalik yozuv
    DELETE FROM settings WHERE key = '_merge_flag_aktiv';
    INSERT INTO settings (key, text_value) VALUES ('_merge_flag_aktiv', 'on');
  ELSE
    DELETE FROM settings WHERE key = '_merge_flag_aktiv';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_merge_flag(boolean) TO anon, authenticated;

-- Trigger funksiyasi settings dan tekshiradi
CREATE OR REPLACE FUNCTION talabalar_telegram_immutable_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merge_flag text;
BEGIN
  SELECT text_value INTO v_merge_flag FROM settings WHERE key = '_merge_flag_aktiv';
  
  IF v_merge_flag = 'on' THEN
    RETURN NEW;
  END IF;
  
  IF OLD.telegram_chat_id IS NOT NULL AND NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    RAISE EXCEPTION 'Telegram chat_id bir marta boglangach o-zgartirib boilmaydi';
  END IF;
  
  RETURN NEW;
END;
$$;
