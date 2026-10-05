/*
# Google ulash, avatar, birlashtirish bonusi va tasdiq belgisi

## Yangi ustunlar (talabalar jadvali)
- `google_user_id` (uuid, unique, null) — Google OAuth orqali bog'langan foydalanuvchi ID'si
- `birlashtirish_bonus_berildi` (boolean, default false) — bonus faqat bir marta berilishini ta'minlaydi
- `bonus_urinish` (integer, default 0) — Moot Court'da qo'shimcha urinishlar soni
- `avatar_url` (text, null) — talaba profil rasmi URL'i

## Yangi jadval: telegram_link_tokens
- Telegramni bog'lash uchun bir martalik tokenlar
- `token` (text, primary key) — 32+ bayt tasodifiy token
- `talaba_id` (uuid) — talabalar jadvalidagi talaba ID'si
- `platform` (text) — 'mobile' yoki 'desktop' (faqat qulaylik uchun)
- `expires_at` (timestamptz) — 10 daqiqalik amal qilish muddati
- `used_at` (timestamptz, null) — token ishlatilgan vaqt
- `created_at` (timestamptz, default now())

## Yangi SECURITY DEFINER funksiya: berilish_birlashtirish_bonusi
- Atomik ravishda bonus beradi (faqat bir marta)
- `birlashtirish_bonus_berildi = false` sharti bilan
- settings'dan LINK_BONUS_ATTEMPTS ni o'qiydi (default 3)

## Yangi SECURITY DEFINER funksiya: ishlash_bonus_urinish
- Atomik ravishda bonus_urinishni 1 ga kamaytiradi
- 0 dan katta bo'lsa true, aks holda false qaytaradi

## Yangi SECURITY DEFINER funksiya: talaba_sessiyasi_tasdiqlangan
- Talaba ID bo'yicha tasdiqlangan (birlashtirilgan) holatini tekshiradi
- google_user_id IS NOT NULL AND telegram_chat_id IS NOT NULL

## Yangi view: talabalar_ommaviy
- Reyting/jamoatchilik uchun: ism, familiya, avatar_url, tasdiqlangan (boolean)
- google_user_id, telegram_chat_id, phone, parol_hash OCHMAYDI

## RLS
- telegram_link_tokens: anon uchun butunlay yopiq
- talabalar: yangi ustunlar uchun anon SELECT huquqi (tasdiqlangan, avatar_url)
- talabalar_ommaviy view: anon SELECT huquqi

## Storage
- Yangi bucket: avatars (ommaviy o'qish, anon yuklash edge function orqali)
*/

-- ═══ 1. talabalar yangi ustunlar ═══
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talabalar' AND column_name = 'google_user_id') THEN
    ALTER TABLE talabalar ADD COLUMN google_user_id uuid UNIQUE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talabalar' AND column_name = 'birlashtirish_bonus_berildi') THEN
    ALTER TABLE talabalar ADD COLUMN birlashtirish_bonus_berildi boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talabalar' AND column_name = 'bonus_urinish') THEN
    ALTER TABLE talabalar ADD COLUMN bonus_urinish integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'talabalar' AND column_name = 'avatar_url') THEN
    ALTER TABLE talabalar ADD COLUMN avatar_url text;
  END IF;
END $$;

-- ═══ 2. telegram_link_tokens jadval ═══
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token text PRIMARY KEY,
  talaba_id uuid NOT NULL REFERENCES talabalar(id) ON DELETE CASCADE,
  platform text DEFAULT 'mobile',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE telegram_link_tokens ENABLE ROW LEVEL SECURITY;

-- telegram_link_tokens: anon uchun butunlay yopiq (faqat service role ishlatadi)
DROP POLICY IF EXISTS "deny_all_anon_link_tokens" ON telegram_link_tokens;
CREATE POLICY "deny_all_anon_link_tokens"
ON telegram_link_tokens FOR SELECT
TO anon, authenticated
USING (false);

-- ═══ 3. talabalar_ommaviy view ═══
CREATE OR REPLACE VIEW talabalar_ommaviy AS
SELECT
  id,
  ism,
  familiya,
  avatar_url,
  (google_user_id IS NOT NULL AND telegram_chat_id IS NOT NULL) AS tasdiqlangan
FROM talabalar;

GRANT SELECT ON talabalar_ommaviy TO anon, authenticated;

-- ═══ 4. SECURITY DEFINER: berilish_birlashtirish_bonusi ═══
CREATE OR REPLACE FUNCTION berilish_birlashtirish_bonusi(p_talaba_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bonus_count integer;
  v_result boolean;
BEGIN
  SELECT COALESCE(
    (SELECT text_value::int FROM settings WHERE key = 'LINK_BONUS_ATTEMPTS'),
    3
  ) INTO v_bonus_count;

  UPDATE talabalar
  SET
    bonus_urinish = bonus_urinish + v_bonus_count,
    birlashtirish_bonus_berildi = true
  WHERE
    id = p_talaba_id
    AND birlashtirish_bonus_berildi = false
    AND google_user_id IS NOT NULL
    AND telegram_chat_id IS NOT NULL
  RETURNING true INTO v_result;

  RETURN COALESCE(v_result, false);
END;
$$;

GRANT EXECUTE ON FUNCTION berilish_birlashtirish_bonusi(uuid) TO anon, authenticated;

-- ═══ 5. SECURITY DEFINER: ishlash_bonus_urinish ═══
CREATE OR REPLACE FUNCTION ishlash_bonus_urinish(p_talaba_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result boolean;
BEGIN
  UPDATE talabalar
  SET bonus_urinish = bonus_urinish - 1
  WHERE
    id = p_talaba_id
    AND bonus_urinish > 0
  RETURNING true INTO v_result;

  RETURN COALESCE(v_result, false);
END;
$$;

GRANT EXECUTE ON FUNCTION ishlash_bonus_urinish(uuid) TO anon, authenticated;

-- ═══ 6. SECURITY DEFINER: talaba_sessiyasi_tasdiqlangan ═══
CREATE OR REPLACE FUNCTION talaba_sessiyasi_tasdiqlangan(p_talaba_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM talabalar
    WHERE id = p_talaba_id
    AND google_user_id IS NOT NULL
    AND telegram_chat_id IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION talaba_sessiyasi_tasdiqlangan(uuid) TO anon, authenticated;

-- ═══ 7. talabalar ustunlari uchun RLS yangilash ═══
-- Anon allaqachon talabalar'dan keng SELECT qila oladi (mavjud holat)
-- Yangi ustunlarda shaxsiy ma'lumotlar (google_user_id) anon uchun yopilishi kerak
-- Buni column-level REVOKE bilan qilamiz
REVOKE SELECT (google_user_id) ON talabalar FROM anon, authenticated;
REVOKE SELECT (birlashtirish_bonus_berildi) ON talabalar FROM anon;
REVOKE SELECT (bonus_urinish) ON talabalar FROM anon;

-- ═══ 8. avatars storage bucket ═══
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- avatars bucket: ommaviy o'qish
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

-- avatars bucket: yuklash faqat service role orqali (edge function)
-- anon to'g'ridan-to'g'ri yuklay olmaydi
DROP POLICY IF EXISTS "avatars_service_upload" ON storage.objects;
CREATE POLICY "avatars_service_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "avatars_service_update" ON storage.objects;
CREATE POLICY "avatars_service_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "avatars_service_delete" ON storage.objects;
CREATE POLICY "avatars_service_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (false);
