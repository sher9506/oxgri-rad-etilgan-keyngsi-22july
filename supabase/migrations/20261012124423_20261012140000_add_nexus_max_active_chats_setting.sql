/*
# Nexus AI: faol suhbatlar limiti uchun sozlama

1. Changes
- settings jadvaliga NEXUS_MAX_ACTIVE_CHATS_PER_USER = '15' qo'shiladi (agar mavjud bo'lmasa).
- Kod shu qiymatdan o'qiydi, standart 15.

2. Security
- settings jadvali mavjud, RLS yoqilgan. Bu faqat INSERT — anon emas, faqat admin/service role.
- INSERT ON CONFLICT bilan idempotent.

3. Notes
- Hech qanday jadval o'chirilmaydi yoki ustun o'zgartirilmaydi.
*/

INSERT INTO settings (key, text_value)
VALUES ('NEXUS_MAX_ACTIVE_CHATS_PER_USER', '15')
ON CONFLICT (key) DO NOTHING;
