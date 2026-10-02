/*
# Add backend column to case_answer_jobs

1. Purpose
   Ikkinchi tashqi javob xizmati (ANSWER_SERVICE_URL_2) qo'shilmoqda.
   Har bir job qaysi backend'ga yuborilganini bilishi uchun `backend` ustuni qo'shiladi.
   - backend = 1 -> ANSWER_SERVICE_URL (mavjud, default)
   - backend = 2 -> ANSWER_SERVICE_URL_2 (yangi)

2. Changes
   - case_answer_jobs jadvaliga `backend` smallint ustuni qo'shildi (NOT NULL, DEFAULT 1).
   - Mavjud qatorlar avtomatik 1 qiymatini oladi (DEFAULT orqali).
   - Hech qanday ustun o'zgartirilmadi yoki o'chirilmadi.

3. Security
   - RLS yoki policy o'zgarishi yo'q. Jadvalning mavjud politikalari o'zgarishsiz qoladi.

4. Notes
   - ADDITIV migration: faqat yangi ustun qo'shildi.
   - Eski job qatorlari (backend = NULL) 1 deb o'qiladi (COALESCE orqali kodda).
*/

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS backend smallint NOT NULL DEFAULT 1;
