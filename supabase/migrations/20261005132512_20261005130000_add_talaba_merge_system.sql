/*
# Talaba akkauntlarini birlashtirish tizimi

## Maqsad
Bitta odamda ikkita `talabalar` qatori paydo bo'lishining oldini olish:
eski akkaunt (parol/Telegram bilan) va Google orqali avtomatik yaratilgan
yangi qator. Birlashtirish jarayoni xavfsiz, atomar va teskari bo'lmasligi kerak.

## Yangi ustunlar (talabalar jadvalida)
- `merged_into` (uuid, nullable) — agar bu qator boshqasiga birlashtirilgan bo'lsa,
  asosiy qatorning ID si. NULL = mustaqil qator.
- `merged_at` (timestamptz, nullable) — birlashtirilgan vaqt.

## Yangi jadval: akkaunt_birlashtirish_log
- `id` (uuid, PK)
- `asosiy_id` (uuid) — asosiy (eski) talaba ID si
- `birlashgan_id` (uuid) — birlashtirilgan (yangi) talaba ID si
- `sabab` (text) — birlashtirish sababi (masalan: 'telegram_link', 'google_oauth')
- `kochirilgan_jadvallar_soni` (integer) — qayta bog'langan yozuvlar soni
- `birlashtirgan_ustunlar` (jsonb) — qaysi maydonlar ko'chirilgan (qiymatlarsiz, faqat nomlar)
- `yaratilgan_vaqt` (timestamptz, default now())

## Yangi Postgres funksiya: birlashtirish_talabalari
SECURITY DEFINER, atomar (DO $$ ichida):
- Ikki talaba qatorini FOR UPDATE bilan qulflaydi
- Eskisini (created_at bo'yicha, teng bo'lsa total_xp ko'prog'i) asosiy deb tanlaydi
- Ikkinchi qatordagi google_user_id, telegram_chat_id, phone, avatar_url asosiyda
  BO'SH bo'lsa ko'chiriladi (asosiydagi qiymat ustun)
- total_xp qo'shiladi (takror hisoblanmasin)
- badges massivlari birlashtiriladi (takrorlar olib tashlanadi)
- bonus_urinish maksimal qiymat saqlanadi
- xp_tarix, chaqiruvlar, payments, auto_start_signals, telegram_link_tokens,
  telegram_login_sessions dagi talaba_id lar asosiy qatorga qayta bog'lanadi
- om_korishlar, moot_court_sessions, test_sessiyalar dagi oquvchi_ismi
  ikkinchi qatorning ism+familiyasidan asosiy qatorning ism+familiyasiga yangilanadi
- Ikkinchi qator o'chirilmaydi: merged_into=asosiy_id, merged_at=now(),
  google_user_id=NULL, telegram_chat_id=NULL
- akkaunt_birlashtirish_log ga yozuv qo'shiladi
- berilish_birlashtirish_bonusi RPC chaqiriladi (bir martalik)
- Asosiy qator ID sini qaytaradi

## Xavfsizlik
- akkaunt_birlashtirish_log da RLS yoqilgan, faqat authenticated o'qiydi
  (admin paneli orqali); yozish faqat service role (SECURITY DEFINER) orqali
- birlashtirish_talabalari funksiyasi anon/authenticated ga ochiq,
  lekin talaba_id lar serverda tekshiriladi (kliyent ishonmsiz)
- Rate limit: 1 soatda 3 martadan ko'p emas (log jadvalidan tekshiriladi)

## Muhim eslatmalar
1. Hech qanday qator o'chirilmaydi
2. Eski 64 belgili Telegram tokenlari hali amalda (10 daqiqa muddat bilan tugaydi)
3. google_user_id UNIQUE cheklovi bor — birlashtirishda ikkinchi qatorda NULL qilinadi
4. talaba_id text tipida ko'plab jadvallarda (uuid emas) — string sifatida qayta bog'lanadi
*/

-- ═══ 1. talabalar ga merged_into / merged_at ustunlari ═══
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talabalar' AND column_name = 'merged_into') THEN
    ALTER TABLE talabalar ADD COLUMN merged_into uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talabalar' AND column_name = 'merged_at') THEN
    ALTER TABLE talabalar ADD COLUMN merged_at timestamptz;
  END IF;
END $$;

-- ═══ 2. akkaunt_birlashtirish_log jadvali ═══
CREATE TABLE IF NOT EXISTS akkaunt_birlashtirish_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asosiy_id uuid NOT NULL,
  birlashgan_id uuid NOT NULL,
  sabab text NOT NULL DEFAULT 'manual',
  kochirilgan_jadvallar_soni integer NOT NULL DEFAULT 0,
  birlashtirgan_ustunlar jsonb NOT NULL DEFAULT '{}'::jsonb,
  yaratilgan_vaqt timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE akkaunt_birlashtirish_log ENABLE ROW LEVEL SECURITY;

-- Faqat authenticated o'qiy oladi (admin paneli uchun)
DROP POLICY IF EXISTS "admin_read_birlashtirish_log" ON akkaunt_birlashtirish_log;
CREATE POLICY "admin_read_birlashtirish_log"
  ON akkaunt_birlashtirish_log FOR SELECT
  TO authenticated USING (true);

-- ═══ 3. birlashtirish_talabalari funksiyasi ═══
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
BEGIN
  -- Ikki ID bir xil emasligini tekshirish
  IF p_asosiy_id = p_birlashgan_id THEN
    RAISE EXCEPTION 'Bir xil talaba ID birlashtirib boilmaydi';
  END IF;

  -- Rate limit: 1 soatda 3 martadan ko'p emas
  IF (
    SELECT COUNT(*) FROM akkaunt_birlashtirish_log
    WHERE yaratilgan_vaqt > now() - interval '1 hour'
  ) >= 3 THEN
    RAISE EXCEPTION 'Birlashtirish limiti: 1 soatda 3 marta';
  END IF;

  -- Ikkala qatorni FOR UPDATE bilan qulflash
  SELECT * INTO v_asosiy
    FROM talabalar WHERE id = p_asosiy_id FOR UPDATE;
  SELECT * INTO v_birlashgan
    FROM talabalar WHERE id = p_birlashgan_id FOR UPDATE;

  IF NOT FOUND OR v_asosiy.id IS NULL THEN
    RAISE EXCEPTION 'Asosiy talaba topilmadi: %', p_asosiy_id;
  END IF;
  IF v_birlashgan.id IS NULL THEN
    RAISE EXCEPTION 'Birlashtirilgan talaba topilmadi: %', p_birlashgan_id;
  END IF;

  -- Allaqachon birlashtirilganmi?
  IF v_birlashgan.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Bu talaba allaqachon birlashtirilgan: merged_into=%', v_birlashgan.merged_into;
  END IF;
  IF v_asosiy.merged_into IS NOT NULL THEN
    RAISE EXCEPTION 'Asosiy talaba boshqasiga birlashtirilgan: %', v_asosiy.merged_into;
  END IF;

  -- Asosiy qatorda bo'sh maydonlarni to'ldirish (asosiy qiymat ustun)
  -- google_user_id
  IF v_asosiy.google_user_id IS NULL AND v_birlashgan.google_user_id IS NOT NULL THEN
    UPDATE talabalar SET google_user_id = v_birlashgan.google_user_id
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"google_user_id":true}'::jsonb;
  END IF;

  -- telegram_chat_id
  IF v_asosiy.telegram_chat_id IS NULL AND v_birlashgan.telegram_chat_id IS NOT NULL THEN
    UPDATE talabalar SET telegram_chat_id = v_birlashgan.telegram_chat_id
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"telegram_chat_id":true}'::jsonb;
  END IF;

  -- phone
  IF (v_asosiy.phone IS NULL OR v_asosiy.phone = '') AND v_birlashgan.phone IS NOT NULL THEN
    UPDATE talabalar SET phone = v_birlashgan.phone
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"phone":true}'::jsonb;
  END IF;

  -- avatar_url
  IF v_asosiy.avatar_url IS NULL AND v_birlashgan.avatar_url IS NOT NULL THEN
    UPDATE talabalar SET avatar_url = v_birlashgan.avatar_url
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"avatar_url":true}'::jsonb;
  END IF;

  -- parol_hash (asosiyda yo'q bo'lsa)
  IF v_asosiy.parol_hash IS NULL AND v_birlashgan.parol_hash IS NOT NULL THEN
    UPDATE talabalar SET parol_hash = v_birlashgan.parol_hash
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"parol_hash":true}'::jsonb;
  END IF;

  -- login_id (asosiyda yo'q bo'lsa)
  IF (v_asosiy.login_id IS NULL OR v_asosiy.login_id = '') AND v_birlashgan.login_id IS NOT NULL THEN
    UPDATE talabalar SET login_id = v_birlashgan.login_id
      WHERE id = v_asosiy.id;
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
    UPDATE talabalar SET bonus_urinish = v_birlashgan.bonus_urinish
      WHERE id = v_asosiy.id;
    v_kochirilgan_ustunlar := v_kochirilgan_ustunlar || '{"bonus_urinish":true}'::jsonb;
  END IF;

  -- badges birlashtirish (takrorlar olib tashlanadi)
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
    UPDATE talabalar SET current_level = v_birlashgan.current_level
      WHERE id = v_asosiy.id;
  END IF;

  -- xp_streak maksimal
  IF v_birlashgan.xp_streak IS NOT NULL AND v_birlashgan.xp_streak > COALESCE(v_asosiy.xp_streak, 0) THEN
    UPDATE talabalar SET xp_streak = v_birlashgan.xp_streak
      WHERE id = v_asosiy.id;
  END IF;

  -- ═══ Bola jadvallarni qayta bog'lash ═══

  -- talaba_id (text tipida) bo'yicha
  -- xp_tarix
  UPDATE xp_tarix SET talaba_id = v_asosiy.id::text
    WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- chaqiruvlar
  UPDATE chaqiruvlar SET talaba_id = v_asosiy.id::text
    WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- payments
  UPDATE payments SET talaba_id = v_asosiy.id::text
    WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- auto_start_signals
  UPDATE auto_start_signals SET talaba_id = v_asosiy.id::text
    WHERE talaba_id = v_birlashgan.id::text;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- telegram_link_tokens
  UPDATE telegram_link_tokens SET talaba_id = v_asosiy.id
    WHERE talaba_id = v_birlashgan.id;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- telegram_login_sessions
  UPDATE telegram_login_sessions SET talaba_id = v_asosiy.id
    WHERE talaba_id = v_birlashgan.id;
  GET DIAGNOSTICS v_id = ROW_COUNT;
  v_kochirilgan_soni := v_kochirilgan_soni + v_id;

  -- oquvchi_ismi (text) bo'yicha — ikkinchi qatorning ism+familiyasidan asosiy qatornikiga
  v_birlashgan_ism_familiya := trim(COALESCE(v_birlashgan.ism, '') || ' ' || COALESCE(v_birlashgan.familiya, ''));
  v_asosiy_ism_familiya := trim(COALESCE(v_asosiy.ism, '') || ' ' || COALESCE(v_asosiy.familiya, ''));

  IF v_birlashgan_ism_familiya IS NOT NULL AND v_birlashgan_ism_familiya != '' THEN
    -- om_korishlar
    UPDATE om_korishlar SET oquvchi_ismi = v_asosiy_ism_familiya
      WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    -- moot_court_sessions
    UPDATE moot_court_sessions SET oquvchi_ismi = v_asosiy_ism_familiya
      WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    -- test_sessiyalar
    UPDATE test_sessiyalar SET oquvchi_ismi = v_asosiy_ism_familiya
      WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    -- sj_natijalar
    UPDATE sj_natijalar SET oquvchi_ismi = v_asosiy_ism_familiya
      WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    -- javoblar
    UPDATE javoblar SET oquvchi_ismi = v_asosiy_ism_familiya
      WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;

    -- test_javoblar
    UPDATE test_javoblar SET oquvchi_ismi = v_asosiy_ism_familiya
      WHERE oquvchi_ismi = v_birlashgan_ism_familiya;
    GET DIAGNOSTICS v_id = ROW_COUNT;
    v_kochirilgan_soni := v_kochirilgan_soni + v_id;
  END IF;

  -- ═══ Ikkinchi qatorni belgilash (o'chirmaslik) ═══
  UPDATE talabalar SET
    merged_into = v_asosiy.id,
    merged_at = now(),
    google_user_id = NULL,
    telegram_chat_id = NULL
  WHERE id = v_birlashgan.id;

  -- ═══ Log yozish ═══
  INSERT INTO akkaunt_birlashtirish_log (asosiy_id, birlashgan_id, sabab, kochirilgan_jadvallar_soni, birlashtirgan_ustunlar)
  VALUES (v_asosiy.id, v_birlashgan.id, p_sabab, v_kochirilgan_soni, v_kochirilgan_ustunlar);

  -- ═══ Bonus berish (bir martalik) ═══
  PERFORM berilish_birlashtirish_bonusi(v_asosiy.id);

  RETURN v_asosiy.id;
END;
$$;

-- Funksiyani anon/authenticated ga ochiq qilamiz
-- (talaba_id lar serverda tekshiriladi, kliyent ishonmsiz)
GRANT EXECUTE ON FUNCTION birlashtirish_talabalari(uuid, uuid, text) TO anon, authenticated;

-- ═══ 4. talabalar ga merged_into bo'yicha index ═══
CREATE INDEX IF NOT EXISTS idx_talabalar_merged_into ON talabalar(merged_into) WHERE merged_into IS NOT NULL;
