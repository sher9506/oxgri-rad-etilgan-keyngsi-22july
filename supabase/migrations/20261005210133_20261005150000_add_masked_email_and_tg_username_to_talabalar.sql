/*
# Add google_email_masked, telegram_username, telegram_ism to talabalar

1. New Columns
- `talabalar.google_email_masked` (text, nullable) — niqoblangan Google email
  (masalan: sh***********76@gmail.com). To'liq email saqlanmaydi.
- `talabalar.telegram_username` (text, nullable) — Telegram @username (masalan: @sherzod)
- `talabalar.telegram_ism` (text, nullable) — Telegram first_name

2. Purpose
- Profil sahifasidagi "Akkauntni birlashtirish" kartasida ulangan akkauntlar
  ko'rsatiladi: Google uchun niqoblangan email, Telegram uchun @username.
- To'liq Google email hech qachon talabalar jadvaliga yozilmaydi — faqat niqoblangan ko'rinishi.

3. Security
- Mavjud RLS siyosati o'zgarmaydi (talabalar_all — anon+authenticated, USING(true)).
- Yangi ustunlar ham shu siyosat ostida o'qiladi.
- Sensitivity: telegram_username va telegram_ism — ochiq ma'lumot.
  google_email_masked — niqoblangan, to'liq email emas.

4. Backfill
- Mavjud talabalar uchun telegram_username va telegram_ism ni NULL qoldiramiz
  (bot keyingi ulash/kirishda to'ldiradi).
*/

ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS google_email_masked text;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS telegram_ism text;
