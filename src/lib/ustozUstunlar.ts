/**
 * `ustoz` jadvalining brauzer o'qiy oladigan ustunlari. Parol xeshlari, OTP, token va
 * bank karta ma'lumotlari bazada brauzerdan yopiq — `select('*')` ishlatmang.
 */
export const USTOZ_OCHIQ_USTUNLAR =
  'id, full_name, ism, familiya, status, phone, face_descriptor, face_photo_url, created_at, username, face_image, note, telegram_username, telegram_chat_id, muallif_slug, telegram_public, phone_public, ustoz_huquqi, blog_huquqi, hudud, mutaxassislik, hukm_only';
