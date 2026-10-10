/*
# Add last_render_error column to case_answer_jobs

1. New Columns
- `last_render_error` (text, nullable) — so'nggi Render xato matni (300 belgigacha).
  Chat 2-bosqichda Render xato berganda, asl xato matni shu maydonga yoziladi
  va admin panelda ko'rsatiladi. Fallback uni endi yutmaydi.

2. Security
- RLS o'zgarishi yo'q. Mavjud policy'lar o'zgarmaydi.

3. Notes
- Bu ustun faqat diagnostic maqsadida — foydalanuvchi xatosi `error` maydonida qoladi.
- `last_render_error` Render'dan kelgan xom xato matnini saqlaydi.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_answer_jobs' AND column_name = 'last_render_error'
  ) THEN
    ALTER TABLE case_answer_jobs ADD COLUMN last_render_error text;
  END IF;
END $$;
