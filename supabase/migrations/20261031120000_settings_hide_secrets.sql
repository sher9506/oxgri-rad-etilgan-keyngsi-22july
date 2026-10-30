/*
  # settings: maxfiy qiymatlarni yopish (xavfsizlik, 0-bosqich)

  Oldin anon (sayt kaliti) settings'ning hammasini o'qiy va yoza olardi — bot tokenlari,
  Groq/Google kalitlari ommaviy edi.

  Endi:
  - anon/authenticated faqat quyidagi ochiq kalitlarni O'QIYDI (brauzer kodi shularni ishlatadi);
  - anon/authenticated YOZA OLMAYDI. Admin panel `admin-settings` edge funksiyasi orqali
    (admin kodi serverda tekshiriladi), bot xabarlari `telegram-api` ning `bot` rejimi orqali yuboriladi;
  - edge funksiyalar service role bilan ishlaydi — RLS ularga ta'sir qilmaydi.
  Yangi kalit qo'shilsa, u avtomatik YOPIQ bo'ladi; brauzerga kerak bo'lsa shu ro'yxatga qo'shiladi.
*/

DROP POLICY IF EXISTS "settings_select_all" ON settings;
DROP POLICY IF EXISTS "settings_insert_all" ON settings;
DROP POLICY IF EXISTS "settings_update_all" ON settings;
DROP POLICY IF EXISTS "settings_delete_all" ON settings;
DROP POLICY IF EXISTS "settings_select_public" ON settings;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_public"
ON settings FOR SELECT
TO anon, authenticated
USING (
  key = ANY (ARRAY[
    'AI_MENTOR_FAOL', 'GOOGLE_CLIENT_ID', 'LINK_BONUS_ATTEMPTS',
    'USTOZ_BOT_LINK', 'TELEGRAM_LOGIN_BOT_LINK', 'TELEGRAM_BOT_LINK',
    'TELEGRAM_BOT_USERNAME', 'MINIAPP_BOT_USERNAME', 'MINIAPP_URL', 'NASHER_MINIAPP_URL',
    'USTOZ_BOT_YANGILIK_RUXSAT', 'answer_file_sources_enabled', 'answer_library_enabled',
    'BOT_SITE_URL', 'BOT_SITE_BUTTON_TEXT', 'USTOZ_BOT_SITE_URL', 'USTOZ_BOT_SITE_BUTTON_TEXT',
    'aflotun_funksiya_faol', 'copy_protection_faol', 'screenshot_protection_faol',
    'OTM_TEST_SANA', 'start_faol'
  ])
  OR key LIKE 'USTOZ\_BOT\_RUXSAT\_%'
);

-- Qo'shimcha himoya: RLS TRUNCATE'ga ta'sir qilmaydi — yozish huquqlarini butunlay olib qo'yamiz.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON settings FROM anon, authenticated;
