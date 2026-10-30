/*
  # Ustoz login'i serverga — B qism: maxfiy ustunlarni yopish
  FAQAT yangi login (ustoz-auth) saytda ishlashi tasdiqlangandan keyin qo'llanadi.

  Brauzer endi o'qiy ham, o'zgartira ham olmaydi: parol xeshlari, OTP, token, bank karta ma'lumotlari.
  Qolgan ustunlar avvalgidek ishlaydi (2-bosqichda ular ham server orqali bo'ladi).
  Postgres'da ustun darajasidagi huquq jadval darajasidagi huquq olib tashlangandagina ishlaydi.
*/

REVOKE SELECT, INSERT, UPDATE ON public.ustoz FROM anon, authenticated;

GRANT SELECT (id, full_name, ism, familiya, status, phone, face_descriptor, face_photo_url, created_at,
  username, face_image, note, telegram_username, telegram_chat_id, muallif_slug, telegram_public,
  phone_public, ustoz_huquqi, blog_huquqi, hudud, mutaxassislik, hukm_only)
  ON public.ustoz TO anon, authenticated;

GRANT UPDATE (full_name, ism, familiya, status, phone, face_descriptor, face_photo_url,
  username, face_image, note, telegram_username, telegram_chat_id, muallif_slug, telegram_public,
  phone_public, ustoz_huquqi, blog_huquqi, hudud, mutaxassislik, hukm_only)
  ON public.ustoz TO anon, authenticated;

-- Eski brauzer parol tiklash jadvali endi ishlatilmaydi (ustoz-auth o'z jadvaliga yozadi).
REVOKE ALL ON public.parol_reset_kodlar FROM anon, authenticated;
