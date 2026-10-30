/*
  # Ilmiy ishlar (Google Scholar uchun)
  Ustoz ilmiy ishini yuklaydi → admin tasdiqlaydi → /ilmiy/<slug> sahifasi Scholar meta teglari bilan.
  Yozish faqat `ilmiy-ishlar` edge funksiyasi orqali (ustoz tokeni yoki admin kodi).
  Brauzer faqat TASDIQLANGAN ishlarni o'qiydi.
*/
CREATE TABLE IF NOT EXISTS ilmiy_ishlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id uuid NOT NULL REFERENCES ustoz(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  sarlavha text NOT NULL,
  mualliflar text[] NOT NULL,                 -- tartib bilan, «Familiya Ism»
  annotatsiya text NOT NULL,
  kalit_sozlar text[] NOT NULL DEFAULT '{}',
  nashr_turi text NOT NULL DEFAULT 'maqola',  -- maqola | tezis | dissertatsiya | preprint
  nashr_nomi text,                            -- jurnal yoki konferensiya nomi
  nashr_sanasi date NOT NULL,
  til text NOT NULL DEFAULT 'uz',
  pdf_path text NOT NULL,                     -- blog-files bucket ichidagi yo'l
  scholar boolean NOT NULL DEFAULT true,      -- Google Scholar uchun ochilsinmi
  huquq_tasdiq boolean NOT NULL DEFAULT false,
  holat text NOT NULL DEFAULT 'kutilmoqda' CHECK (holat IN ('kutilmoqda','tasdiqlangan','rad')),
  rad_sababi text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  tasdiqlangan_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ilmiy_ishlar_holat ON ilmiy_ishlar(holat, nashr_sanasi DESC);
CREATE INDEX IF NOT EXISTS idx_ilmiy_ishlar_ustoz ON ilmiy_ishlar(ustoz_id);

ALTER TABLE ilmiy_ishlar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ilmiy_ishlar FROM anon, authenticated;
GRANT SELECT ON ilmiy_ishlar TO anon, authenticated;
DROP POLICY IF EXISTS "ilmiy_ishlar_tasdiqlangan" ON ilmiy_ishlar;
CREATE POLICY "ilmiy_ishlar_tasdiqlangan" ON ilmiy_ishlar FOR SELECT TO anon, authenticated USING (holat = 'tasdiqlangan');
