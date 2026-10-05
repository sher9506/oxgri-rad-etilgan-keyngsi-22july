/*
# Merge funksiyasini yangilash: set_merge_flag, xp_streak, last_xp_date

## O'zgarishlar
1. birlashtirish_talabalari funksiyasi set_merge_flag(true) chaqiradi
   telegram_chat_id ni o'zgartirish uchun (trigger bypass)
2. xp_streak dan kattasi olinadi
3. last_xp_date dan kattasi olinadi
4. Oxirida set_merge_flag(false) tozalanadi
*/

CREATE OR REPLACE FUNCTION birlashtirish_talabalari(
  p_asosiy_id uuid,
  p_birlashgan_id uuid,
  p_sabab text DEFAULT 'manual'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asosiy RECORD;
  v_birlashgan RECORD;
  v_kochirilgan_soni integer := 0;
  v_kochirilgan_ustunlar jsonb := '{}'::jsonb;
  v_asosiy_ism_familiya text;
  v_birlashgan_ism_familiya text;
  v_row_count integer;
  v_temp_google text;
  v_temp_tg text;
BEGIN
  IF p_asosiy_id = p_birlashgan_id THEN
    RAISE EXCEPTION 'Bir xil talaba ID birlashtirib boilmaydi';
  END IF;

  IF (
    SELECT COUNT(*) FROM akkaunt_birlashtirish_log
    WHERE yaratilgan_vaqt > now() - interval '1 hour'
  ) >= 3 THEN
    RAISE EXCEPTION 'Birlashtirish limiti: 1 soatda 3 marta';
  END IF;

  -- Merge flag yoqish — trigger telegram_chat_id o'zgartirishga ruxsat beradi
  PERFORM set_merge_flag(true);

  SELECT * INTO v_asosiy FROM talabalar WHERE id = p_asosiy_id FOR UPDATE;
  SELECT * INTO v_birlashgan FROM talabalar WHERE id = p_birlashgan_id FOR UPDATE;

  IF v_asosiy.id IS NULL THEN
    PERFORM set_merge_flag(false);
    RAISE EXCEPTION 'Asosiy talaba topilmadi: %', p_asosiy_id;
  END IF;
  IF v_birlashgan.id IS NULL THEN
    PERFORM set_merge_flag(false);
    RAISE EXCEPTION 'Birlashtirilgan talaba topilmadi: %', p_birlashgan_id;
  END IF;

  IF v_birlashgan.merged_into IS NOT NULL THEN
    PERFORM set_merge_flag(false);
    RAISE EXCEPTION 'Bu talaba allaqachon birlashtirilgan';
  END IF;
  IF v_asosiy.merged_into IS NOT NULL THEN
    PERFORM set_merge_flag(false);
    RAISE EXCEPTION 'Asosiy talaba boshqasiga birlashtirilgan';
  END IF;

  -- Unique cheklov: avval ikkinchi qatordan olib tashlaymiz
  IF v_birlashgan.google_user_id IS NOT NULL AND v_asosiy.google_user_id IS NULL THEN
    v_temp_google := v_birlashgan.google_user_id;
    UPDATE talabalar SET google_user_id = NULL WHERE id = v_birlashgan.id;
    UPDATE talabalar SET google_user_id = v_temp_google WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"google_user_id":true}'::jsonb;
  END IF;

  IF v_birlashgan.telegram_chat_id IS NOT NULL AND v_asosiy.telegram_chat_id IS NULL THEN
    v_temp_tg := v_birlashgan.telegram_chat_id;
    UPDATE talabalar SET telegram_chat_id = NULL WHERE id = v_birlashgan.id;
    UPDATE talabalar SET telegram_chat_id = v_temp_tg WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"telegram_chat_id":true}'::jsonb;
  END IF;

  IF (v_asosiy.phone IS NULL OR v_asosiy.phone = '') AND v_birlashgan.phone IS NOT NULL THEN
    UPDATE talabalar SET phone = v_birlashgan.phone WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"phone":true}'::jsonb;
  END IF;

  IF v_asosiy.avatar_url IS NULL AND v_birlashgan.avatar_url IS NOT NULL THEN
    UPDATE talabalar SET avatar_url = v_birlashgan.avatar_url WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"avatar_url":true}'::jsonb;
  END IF;

  IF v_asosiy.parol_hash IS NULL AND v_birlashgan.parol_hash IS NOT NULL THEN
    UPDATE talabalar SET parol_hash = v_birlashgan.parol_hash WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"parol_hash":true}'::jsonb;
  END IF;

  IF (v_asosiy.login_id IS NULL OR v_asosiy.login_id = '') AND v_birlashgan.login_id IS NOT NULL THEN
    UPDATE talabalar SET login_id = v_birlashgan.login_id WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"login_id":true}'::jsonb;
  END IF;

  IF v_birlashgan.total_xp IS NOT NULL AND v_birlashgan.total_xp > 0 THEN
    UPDATE talabalar SET total_xp = COALESCE(v_asosiy.total_xp, 0) + v_birlashgan.total_xp WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"total_xp":true}'::jsonb;
  END IF;

  IF v_birlashgan.bonus_urinish IS NOT NULL AND v_birlashgan.bonus_urinish > COALESCE(v_asosiy.bonus_urinish, 0) THEN
    UPDATE talabalar SET bonus_urinish = v_birlashgan.bonus_urinish WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"bonus_urinish":true}'::jsonb;
  END IF;

  IF v_birlashgan.badges IS NOT NULL AND v_birlashgan.badges != '[]'::jsonb THEN
    UPDATE talabalar SET badges = (
      SELECT jsonb_agg(DISTINCT x) FROM jsonb_array_elements(
        COALESCE(v_asosiy.badges, '[]'::jsonb) || v_birlashgan.badges
      ) AS x
    ) WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"badges":true}'::jsonb;
  END IF;

  IF v_birlashgan.current_level IS NOT NULL AND v_birlashgan.current_level > COALESCE(v_asosiy.current_level, 0) THEN
    UPDATE talabalar SET current_level = v_birlashgan.current_level WHERE id = v_asosiy.id;
  END IF;

  -- xp_streak dan kattasi
  IF v_birlashgan.xp_streak IS NOT NULL AND v_birlashgan.xp_streak > COALESCE(v_asosiy.xp_streak, 0) THEN
    UPDATE talabalar SET xp_streak = v_birlashgan.xp_streak WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"xp_streak":true}'::jsonb;
  END IF;

  -- last_xp_date dan kattasi
  IF v_birlashgan.last_xp_date IS NOT NULL AND (v_asosiy.last_xp_date IS NULL OR v_birlashgan.last_xp_date > v_asosiy.last_xp_date) THEN
    UPDATE talabalar SET last_xp_date = v_birlashgan.last_xp_date WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"last_xp_date":true}'::jsonb;
  END IF;

  -- Bola jadvallarni qayta bog'lash
  UPDATE xp_tarix SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

  UPDATE chaqiruvlar SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

  UPDATE payments SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

  UPDATE auto_start_signals SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

  UPDATE telegram_link_tokens SET talaba_id = v_asosiy.id WHERE talaba_id = v_birlashgan.id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

  UPDATE telegram_login_sessions SET talaba_id = v_asosiy.id WHERE talaba_id = v_birlashgan.id;
  GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

  -- oquvchi_ismi bo'yicha
  v_birlashgan_ism_familiya := trim(COALESCE(v_birlashgan.ism, '') || ' ' || COALESCE(v_birlashgan.familiya, ''));
  v_asosiy_ism_familiya := trim(COALESCE(v_asosiy.ism, '') || ' ' || COALESCE(v_asosiy.familiya, ''));

  IF v_birlashgan_ism_familiya IS NOT NULL AND v_birlashgan_ism_familiya != '' THEN
    UPDATE om_korishlar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

    UPDATE moot_court_sessions SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

    UPDATE test_sessiyalar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

    UPDATE sj_natijalar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

    UPDATE javoblar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;

    UPDATE test_javoblar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_row_count = ROW_COUNT; v_kochirilgan_soni := v_kochirilgan_soni + v_row_count;
  END IF;

  -- Ikkinchi qatorni belgilash
  UPDATE talabalar SET
    merged_into = v_asosiy.id,
    merged_at = now(),
    google_user_id = NULL,
    telegram_chat_id = NULL
  WHERE id = v_birlashgan.id;

  -- Log
  INSERT INTO akkaunt_birlashtirish_log (asosiy_id, birlashgan_id, sabab, kochirilgan_jadvallar_soni, birlashtirgan_ustunlar)
  VALUES (v_asosiy.id, v_birlashgan.id, p_sabab, v_kochirilgan_soni, v_kochirilgan_ustunlar);

  -- Bonus
  PERFORM berilish_birlashtirish_bonusi(v_asosiy.id);

  -- Merge flag tozalash
  PERFORM set_merge_flag(false);

  RETURN v_asosiy.id;
END;
$$;

GRANT EXECUTE ON FUNCTION birlashtirish_talabalari(uuid, uuid, text) TO anon, authenticated;
