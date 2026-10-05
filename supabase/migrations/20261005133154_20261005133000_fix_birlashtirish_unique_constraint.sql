/*
# Fix: birlashtirish_talabalari funksiyasini unique cheklov to'qnashuvi tuzatish

## Muammo
google_user_id UNIQUE cheklovi bor. Birlashtirishda asosiy qatorga
google_user_id ko'chirishdan oldin ikkinchi qatorda NULL qilinmagan,
shuning uchun unique cheklov xato beradi.

## Yechim
Funksiya ichida ko'chirish tartibini o'zgartirdik:
1. Avval ikkinchi qatorning google_user_id ni vaqtinchalik saqlaymiz
2. Ikkinchi qatorda google_user_id ni NULL qilamiz
3. Asosiy qatorga qiymatni ko'chiramiz
Xuddi shunday telegram_chat_id uchun ham (agar noyob bo'lsa).
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
  v_id uuid;
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

  SELECT * INTO v_asosiy
    FROM talabalar WHERE id = p_asosiy_id FOR UPDATE;
  SELECT * INTO v_birlashgan
    FROM talabalar WHERE id = p_birlashgan_id FOR UPDATE;

  IF v_asosiy.id IS NULL THEN
    RAISE EXCEPTION 'Asosiy talaba topilmadi: %', p_asosiy_id;
  END IF;
  IF v_birlashgan.id IS NULL THEN
    RAISE EXCEPTION 'Birlashtirilgan talaba topilmadi: %', p_birlashgan_id;
  END IF;

  IF v_birlashgan.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Bu talaba allaqachon birlashtirilgan: merged_into=%', v_birlashgan.merged_into;
  END IF;
  IF v_asosiy.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Asosiy talaba boshqasiga birlashtirilgan: %', v_asosiy.merged_into;
  END IF;

  -- ═══ Unique cheklov tuzatish: avval ikkinchi qatardan olib tashlaymiz ═══
  -- google_user_id ni vaqtinchalik saqlab, ikkinchi qatordan NULL qilamiz
  IF v_birlashgan.google_user_id IS NOT NULL AND v_asosiy.google_user_id IS NULL THEN
    v_temp_google := v_birlashgan.google_user_id;
    UPDATE talabalar SET google_user_id = NULL WHERE id = v_birlashgan.id;
    UPDATE talabalar SET google_user_id = v_temp_google WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"google_user_id":true}'::jsonb;
  END IF;

  -- telegram_chat_id ni ko'chirish (asosiyda bo'sh bo'lsa)
  IF v_birlashgan.telegram_chat_id IS NOT NULL AND v_asosiy.telegram_chat_id IS NULL THEN
    v_temp_tg := v_birlashgan.telegram_chat_id;
    UPDATE talabalar SET telegram_chat_id = NULL WHERE id = v_birlashgan.id;
    UPDATE talabalar SET telegram_chat_id = v_temp_tg WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"telegram_chat_id":true}'::jsonb;
  END IF;

  -- phone (asosiyda bo'sh bo'lsa)
  IF (v_asosiy.phone IS NULL OR v_asosiy.phone = '') AND v_birlashgan.phone IS NOT NULL THEN
    UPDATE talabalar SET phone = v_birlashgan.phone WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"phone":true}'::jsonb;
  END IF;

  -- avatar_url
  IF v_asosiy.avatar_url IS NULL AND v_birlashgan.avatar_url IS NOT NULL THEN
    UPDATE talabalar SET avatar_url = v_birlashgan.avatar_url WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"avatar_url":true}'::jsonb;
  END IF;

  -- parol_hash
  IF v_asosiy.parol_hash IS NULL AND v_birlashgan.parol_hash IS NOT NULL THEN
    UPDATE talabalar SET parol_hash = v_birlashgan.parol_hash WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"parol_hash":true}'::jsonb;
  END IF;

  -- login_id
  IF (v_asosiy.login_id IS NULL OR v_asosiy.login_id = '') AND v_birlashgan.login_id IS NOT NULL THEN
    UPDATE talabalar SET login_id = v_birlashgan.login_id WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"login_id":true}'::jsonb;
  END IF;

  -- total_xp qo'shish
  IF v_birlashgan.total_xp IS NOT NULL AND v_birlashgan.total_xp > 0 THEN
    UPDATE talabalar SET total_xp = COALESCE(v_asosiy.total_xp, 0) + v_birlashgan.total_xp
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"total_xp":true}'::jsonb;
  END IF;

  -- bonus_urinish maksimal
  IF v_birlashgan.bonus_urinish IS NOT NULL AND v_birlashgan.bonus_urinish > COALESCE(v_asosiy.bonus_urinish, 0) THEN
    UPDATE talabalar SET bonus_urinish = v_birlashgan.bonus_urinish WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"bonus_urinish":true}'::jsonb;
  END IF;

  -- badges birlashtirish
  IF v_birlashgan.badges IS NOT NULL AND v_birlashgan.badges != '[]'::jsonb THEN
    UPDATE talabalar
      SET badges = (
        SELECT jsonb_agg(DISTINCT x)
        FROM jsonb_array_elements(
          COALESCE(v_asosiy.badges, '[]'::jsonb) || v_birlashgan.badges
        ) AS x
      )
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"badges":true}'::jsonb;
  END IF;

  -- current_level maksimal
  IF v_birlashgan.current_level IS NOT NULL AND v_birlashgan.current_level > COALESCE(v_asosiy.current_level, 0) THEN
    UPDATE talabalar SET current_level = v_birlashgan.current_level WHERE id = v_asosiy.id;
  END IF;

  -- xp_streak maksimal
  IF v_birlashgan.xp_streak IS NOT NULL AND v_birlashgan.xp_streak > COALESCE(v_asosiy.xp_streak, 0) THEN
    UPDATE talabalar SET xp_streak = v_birlashgan.xp_streak WHERE id = v_asosiy.id;
  END IF;

  -- ═══ Bola jadvallarni qayta bog'lash ═══
  UPDATE xp_tarix SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  UPDATE chaqiruvlar SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  UPDATE payments SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  UPDATE auto_start_signals SET talaba_id = v_asosiy.id::text WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  UPDATE telegram_link_tokens SET talaba_id = v_asosiy.id WHERE talaba_id = v_birlashgan.id;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  UPDATE telegram_login_sessions SET talaba_id = v_asosiy.id WHERE talaba_id = v_birlashgan.id;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- oquvchi_ismi bo'yicha
  v_birlashgan_ism_familiya := trim(COALESCE(v_birlashgan.ism, '') || ' ' || COALESCE(v_birlashgan.familiya, ''));
  v_asosiy_ism_familiya := trim(COALESCE(v_asosiy.ism, '') || ' ' || COALESCE(v_asosiy.familiya, ''));

  IF v_birlashgan_ism_familiya IS NOT NULL AND v_birlashgan_ism_familiya != '' THEN
    UPDATE om_korishlar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    UPDATE moot_court_sessions SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    UPDATE test_sessiyalar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    UPDATE sj_natijalar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    UPDATE javoblar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    UPDATE test_javoblar SET oquvchi_ismi = v_asosiy_ism_familiya WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;
  END IF;

  -- ═══ Ikkinchi qatorni belgilash ═══
  UPDATE talabalar SET
    merged_into = v_asosiy.id,
    merged_at = now(),
    google_user_id = NULL,
    telegram_chat_id = NULL
  WHERE id = v_birlashgan.id;

  -- ═══ Log yozish ═══
  INSERT INTO akkaunt_birlashtirish_log (asosiy_id, birlashgan_id, sabab, kochirilgan_jadvallar_soni, birlashtirgan_ustunlar)
  VALUES (v_asosiy.id, v_birlashgan.id, p_sabab, v_kochirilgan_soni, v_kochirilgan_ustunlar);

  -- ═══ Bonus berish ═══
  PERFORM berilish_birlashtirish_bonusi(v_asosiy.id);

  RETURN v_asosiy.id;
END;
$$;

GRANT EXECUTE ON FUNCTION birlashtirish_talabalari(uuid, uuid, text) TO anon, authenticated;
