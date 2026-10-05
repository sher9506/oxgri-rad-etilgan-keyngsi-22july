/*
# Revert: settings RLS — yozishni qayta ochish

## Sabab
Admin panel frontend to'g'ridan-to'g'ri settings jadvaliga yozadi
(update, upsert). RLS ni qulflab qo'yish admin panelni buzdi.
Aksariyat yozuvlar admin funksiyalari uchun.

## O'zgarish
- Eski settings_select_all (faqat SELECT) ni o'chirib,
  to'liq CRUD policy ni qayta qo'shamiz.
*/

-- Faqat-SELECT policy ni o'chirish
DROP POLICY IF EXISTS "settings_select_all" ON settings;

-- To'liq CRUD — anon + authenticated
CREATE POLICY "settings_select_all"
ON settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "settings_insert_all"
ON settings FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "settings_update_all"
ON settings FOR UPDATE
TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "settings_delete_all"
ON settings FOR DELETE
TO anon, authenticated
USING (true);
