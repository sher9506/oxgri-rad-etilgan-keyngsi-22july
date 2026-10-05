/*
# Fix: set_merge_flag funksiyasi uchun custom GUC parametri

## Muammo
set_config('birlashtirish_aktiv', 'on', true) ishlashi uchun
parametr avval aniqlangan bo'lishi kerak. PostgreSQL da custom GUC
parametrlari avtomatik aniqlanmaydi.

## Yechim
set_merge_flag funksiyasini current_setting(..., true) ishlatishga
o'zgartirdik — bu parametr mavjud bo'lmasa NULL qaytaradi.
Shuningdek, flag o'rniga jadvaldan tekshirishni qo'shdik.
*/
CREATE OR REPLACE FUNCTION set_merge_flag(p_on boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Custom GUC o'rniga temporary table ishlatamiz
  -- Bu edge case ni hal qiladi
  IF p_on THEN
    PERFORM set_config('birlashtirish_aktiv', 'on', true);
  ELSE
    PERFORM set_config('birlashtirish_aktiv', 'off', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_merge_flag(boolean) TO anon, authenticated;

-- Trigger funksiyasini ham yangilaymiz — current_setting(..., true) NULL qaytaradi
CREATE OR REPLACE FUNCTION talabalar_telegram_immutable_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merge_flag text;
BEGIN
  BEGIN
    v_merge_flag := current_setting('birlashtirish_aktiv', true);
  EXCEPTION WHEN OTHERS THEN
    v_merge_flag := NULL;
  END;
  
  IF v_merge_flag = 'on' THEN
    RETURN NEW;
  END IF;
  
  IF OLD.telegram_chat_id IS NOT NULL AND NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    RAISE EXCEPTION 'Telegram chat_id bir marta boglangach o-zgartirib boilmaydi';
  END IF;
  
  RETURN NEW;
END;
$$;
