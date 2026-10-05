/*
# Fix: settings jadvali RLS — yozishni anon/authenticated ga yopish

## Muammo
settings jadvalida USING(true)/WITH CHECK(true) policy bor.
Har kim TELEGRAM_TOKEN, GROQ_API_KEY kabi qatorlarni o'zgartira oladi.

## Yechim
- SELECT anon/authenticated ga ruxsat (frontend o'qiydi)
- INSERT/UPDATE/DELETE faqat service role (edge function lar)
- Eski settings_all policy ni o'chirib, alohida SELECT policy qo'shamiz
*/

-- Eski policy ni o'chirish
DROP POLICY IF EXISTS "settings_all" ON settings;

-- Faqat SELECT ruxsat — anon va authenticated o'qiy oladi
CREATE POLICY "settings_select_all"
ON settings FOR SELECT
TO anon, authenticated
USING (true);

-- INSERT/UPDATE/DELETE — faqat service_role (RLS bypass)
-- Anon va authenticated yozolmaydi
