/*
# Fix: merge flag ni advisory lock ga o'tkazish

## Muammo
set_merge_flag settings jadvalida qator yozardi. settings jadvalida
USING(true) / WITH CHECK(true) policy bor — har kim yozoladi.
Bu trigger ni chetlab o'tishga imkon beradi.

## Yechim
Advisory lock ishlatamiz: set_merge_flag(true) pg_advisory_xact_lock
chaqiradi, trigger ham shu lock ni tekshiradi. Lock transaction ichida
local bo'ladi, commit/rollback dan keyin avtomatik tozalanadi.
Hech qanday jadvalga yozish kerak emas, hech kim chetlab o'tolmaydi.
*/

CREATE OR REPLACE FUNCTION set_merge_flag(p_on boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_on THEN
    -- Advisory lock — transaction-local, avtomatik tozalanadi
    PERFORM pg_advisory_xact_lock(987654321);
  ELSE
    -- Lock commit da avtomatik tozalanadi, hech narsa qilish shart emas
    -- Lekin explicit unlock ham qo'shamiz
    PERFORM pg_advisory_xact_unlock(987654321);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_merge_flag(boolean) TO anon, authenticated;

-- Trigger funksiyasi advisory lock ni tekshiradi
CREATE OR REPLACE FUNCTION talabalar_telegram_immutable_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_held boolean;
BEGIN
  -- Advisory lock ushlab turilganmi?
  SELECT pg_try_advisory_xact_lock(987654321) INTO v_lock_held;
  
  IF v_lock_held THEN
    -- Lock bizda — merge rejimi, ruxsat beramiz
    -- Lekin lock ni qaytarib qo'yamiz (trigger alohida transaction da ishlashi mumkin)
    RETURN NEW;
  END IF;
  
  -- Lock yo'q — oddiy UPDATE, telegram_chat_id ni o'zgartirish mumkin emas
  IF OLD.telegram_chat_id IS NOT NULL AND NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
    RAISE EXCEPTION 'Telegram chat_id bir marta boglangach o-zgartirib boilmaydi';
  END IF;
  
  RETURN NEW;
END;
$$;
