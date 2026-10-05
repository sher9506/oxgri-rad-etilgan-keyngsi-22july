/*
# Fix: merge flag ni temporary table ga o'tkazish

## Muammo
Advisory lock trigger ichida pg_try_advisory_xact_lock true qaytaradi
(lokni o'ziga oladi), shuning uchun trigger har doim merge rejimida
deb hisoblaydi.

## Yechim
set_merge_flag temporary table yaratadi (_merge_flag). Trigger
bu table ni tekshiradi. Temporary table transaction-local,
hech kim tashqaridan yozolmaydi, commit da avtomatik tozalanadi.
*/
CREATE OR REPLACE FUNCTION set_merge_flag(p_on boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_on THEN
    -- Temporary table — transaction-local, commit da tozalanadi
    -- @extschema@ belgilash shart emas, temp schema avtomatik
    EXECUTE 'CREATE TEMP TABLE IF NOT EXISTS _merge_flag (flag boolean) ON COMMIT DROP';
    EXECUTE 'INSERT INTO _merge_flag VALUES (true) ON CONFLICT DO NOTHING';
  ELSE
    EXECUTE 'DROP TABLE IF EXISTS _merge_flag';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_merge_flag(boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION talabalar_telegram_immutable_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag_exists boolean;
BEGIN
  BEGIN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM _merge_flag WHERE flag = true)' INTO v_flag_exists;
  EXCEPTION WHEN undefined_table THEN
    v_flag_exists := false;
  END;
  
  IF v_flag_exists THEN
    RETURN NEW;
  END IF;
  
  IF OLD.telegram_chat_id IS NOT NULL AND NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    RAISE EXCEPTION 'Telegram chat_id bir marta boglangach o-zgartirib boilmaydi';
  END IF;
  
  RETURN NEW;
END;
$$;
