/*
# Add mutaxassislik column to ustoz table

1. New Columns
- `ustoz.mutaxassislik` (text, nullable) — ustozning mutaxassislik yo'nalishlari (vergul bilan ajratilgan)
  Faqat blog muallif sahifasida ko'rinadi, ustoz o'z profilidan tahrirlaydi.

2. Purpose
- Blog muallif sahifasining chap panelidagi "Mutaxassislik yo'nalishlari" bo'limini
  statik teglar o'rniga ustoz o'zi kiritgan yo'nalishlar bilan to'ldirish.

3. Security
- RLS o'zgartirilmaydi — mavjud ustoz UPDATE policy allaqachon ustoz o'z qatorini
  tahrirlashga ruxsat beradi.
*/

DO $$ BEGIN
  ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS mutaxassislik text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
