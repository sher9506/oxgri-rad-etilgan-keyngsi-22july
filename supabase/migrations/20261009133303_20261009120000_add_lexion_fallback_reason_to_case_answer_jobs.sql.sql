/*
# Add lexion_fallback_reason and fallback_count columns

## Maqsad
Lexion rejimi umumiy rejimga tushib qolganda (fallback) sababni aniq saqlash uchun
ikki ustun qo'shamiz. Bu admin panelida "nega umumiy daftarga o'tib ketdi" savoliga
javob beradi.

## Yangi ustunlar
- `lexion_fallback_reason` (text, nullable) — fallback sababi (qisqa matn, masalan:
  "lexion_1_xato", "lexion_url_topilmadi", "lexion_2_xato", "lexion_2_404", "lexion_job_404")
- `fallback_count` (smallint, default 0) — necha marta fallback bo'lgani (0 = fallbacksiz)

## Ta'sir
- Mavjud qatorlarga zarar yetmaydi (nullable/default qiymatlar)
- RLS yoki policy o'zgartirilmaydi
*/

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS lexion_fallback_reason text DEFAULT NULL;

ALTER TABLE case_answer_jobs
  ADD COLUMN IF NOT EXISTS fallback_count smallint DEFAULT 0;
