/*
# Add blog_huquqi and ustoz_huquqi columns to ustoz table

1. New Columns
- `ustoz.blog_huquqi` (boolean, default false) — blog huquqi bilan tasdiqlangan
- `ustoz.ustoz_huquqi` (boolean, default false) — ustoz huquqi bilan tasdiqlangan

2. Purpose
- Admin tasdiqlash jarayonida ikki xil huquq beriladi:
  * blog_huquqi=true: faqat blog, blog yozish, profil, dastur haqida, yordam ko'rinadi
  * ustoz_huquqi=true: blog yozishdan tashqari barcha ustoz funksiyalari ko'rinadi
  * ikkalasi ham false: barcha funksiyalar ishlayveradi (to'liq huquq)

3. Security
- RLS o'zgartirilmaydi — mavjud ustoz UPDATE policy allaqachon ustoz o'z qatorini
  tahrirlashga ruxsat beradi. Admin update ham mavjud policy orqali amalga oshadi.
*/

DO $$ BEGIN
  ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS blog_huquqi boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS ustoz_huquqi boolean DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
