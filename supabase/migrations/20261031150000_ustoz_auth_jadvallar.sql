/*
  # Ustoz login'i serverga (xavfsizlik 1-bosqich) — A qism: yangi jadvallar

  ustoz-auth edge funksiyasi (service role) ishlatadi; brauzer (anon/authenticated)
  bu jadvallarni umuman ko'rmaydi: RLS yoqilgan, siyosat yo'q, huquqlar olingan.
*/

CREATE TABLE IF NOT EXISTS ustoz_sessiyalar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id uuid NOT NULL REFERENCES ustoz(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,          -- sha256(token); tokenning o'zi saqlanmaydi
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ustoz_sessiyalar_ustoz ON ustoz_sessiyalar(ustoz_id);

CREATE TABLE IF NOT EXISTS ustoz_parol_tiklash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ustoz_id uuid NOT NULL REFERENCES ustoz(id) ON DELETE CASCADE,
  kod_hash text NOT NULL,                   -- sha256(kod)
  expires_at timestamptz NOT NULL,
  urinishlar int NOT NULL DEFAULT 0,
  ishlatilgan boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ustoz_parol_tiklash_ustoz ON ustoz_parol_tiklash(ustoz_id, created_at DESC);

-- Parolni taxmin qilishga urinishlarni cheklash (login/telefon bo'yicha)
CREATE TABLE IF NOT EXISTS auth_urinishlar (
  id bigserial PRIMARY KEY,
  kalit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_urinishlar ON auth_urinishlar(kalit, created_at DESC);

ALTER TABLE ustoz_sessiyalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE ustoz_parol_tiklash ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_urinishlar ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ustoz_sessiyalar, ustoz_parol_tiklash, auth_urinishlar FROM anon, authenticated;
