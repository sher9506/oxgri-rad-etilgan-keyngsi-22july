/*
# Add Lexion model columns to case_answer_jobs

## Purpose
Uchinchi rejim — "Lexion model" qo'shilmoqda. Ushbu rejim ikki bosqichli ishlaydi:
1. Kazus matni alohida Lexion xizmatiga yuboriladi → topilgan qonun hujjatlari URL'lari qaytadi.
2. Topilgan URL'lar manba sifatida oddiy javob xizmatiga yuboriladi → tahlil tayyorlanadi.

Bu migration faqat QO'SHIMCHA ustunlar qo'shadi — mavjud ustunlar/ma'lumotlar o'zgartirilmaydi.

## Changes (case_answer_jobs table)
- `answer_mode` (text, nullable, default NULL) — qaysi rejimda ishlayotgani: 'general' | 'sources' | 'lexion'. NULL = eski job'lar (avvalgi xatti-harakat saqlanadi).
- `lexion_job_id` (text, nullable) — Lexion xizmatidan qaytgan job_id (1-bosqich).
- `lexion_urls` (text, nullable) — 1-bosqichda topilgan lex.uz URL'lari JSON massiv ko'rinishida: '["http://lex.uz/docs/123","http://lex.uz/docs/-456"]'.
- `lexion_fallback` (boolean, default false) — Lexion ishlamasa yoki URL topilmasa, "Umumiy" rejimga o'tganligi belgisi.
- `lexion_phase` (text, nullable, default NULL) — Lexion jarayon bosqichi: 'lexion_searching' | 'answering' | 'done' | 'error'. NULL = Lexion rejimi emas.

## Security
- RLS yoki policy o'zgarishi yo'q. Jadvalning mavjud politikalari o'zgarishsiz qoladi.

## Notes
- ADDITIV migration: faqat yangi ustunlar qo'shildi, hech qanday ustun o'zgartirilmadi yoki o'chirilmadi.
- Eski job qatorlari (answer_mode = NULL) avvalgi kabi ishlayveradi.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'answer_mode'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN answer_mode text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'lexion_job_id'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN lexion_job_id text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'lexion_urls'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN lexion_urls text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'lexion_fallback'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN lexion_fallback boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'lexion_phase'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN lexion_phase text;
  END IF;
END $$;
