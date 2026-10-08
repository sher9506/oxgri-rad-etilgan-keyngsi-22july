/*
# FanFaster AI Chat — yangi funksiya uchun jadvallar

## Tavsif
FanFaster platformasiga yangi AI chat funksiyasi qo'shiladi. Bu moot court dan AYRIDILGAN alohida tizim.
Ikki rejim mavjud: "Lexion" (to'g'ridan-to'g'ri AI javoblari) va "Manba" (RAG orqali manba asosida javoblar).

## Yangi jadvallar

1. **fanfaster_ai_sessions** — foydalanuvchi chat sessiyalari
   - id (uuid, PK)
   - user_login (text) — foydalanuvchi login i
   - user_ism (text) — ism familiya
   - user_rol (text) — 'oquvchi' | 'ustoz'
   - rejim (text) — 'lexion' | 'manba' (default 'lexion')
   - messages (jsonb) — {role, text, timestamp}[]
   - savol_soni (int) — nechta savol berilgan
   - sarflangan_vaqt_sekund (int) — umumiy sarflangan vaqt
   - created_at (timestamptz)
   - updated_at (timestamptz)
   - is_active (boolean, default true)

2. **fanfaster_ai_stats** — admin monitoring uchun statistika
   - id (uuid, PK)
   - user_login (text)
   - user_ism (text)
   - user_rol (text)
   - rejim (text) — 'lexion' | 'manba'
   - savol_matn (text) — foydalanuvchi savoli (qisqartirilgan, max 200)
   - javob_matn (text) — AI javobi (qisqartirilgan, max 500)
   - xato (boolean) — AI xato berganmi
   - xato_matn (text) — xato tavsifi
   - sarflangan_sekund (int) — javob vaqti
   - session_id (uuid) — fanfaster_ai_sessions ga havola
   - created_at (timestamptz)

3. **fanfaster_ai_queue** — navbat tizimi (moot court bilan chalkashmaslik uchun)
   - id (uuid, PK)
   - user_login (text)
   - session_id (uuid)
   - status (text) — 'waiting' | 'processing' | 'done' | 'error'
   - created_at (timestamptz)
   - updated_at (timestamptz)

## Xavfsizlik (RLS)
- Barcha jadvallarda RLS yoqilgan.
- anon + authenticated uchun CRUD ruxsat berilgan (frontend anon key ishlatadi).
- Maxfiy ma'lumot (token, kalit, parol) saqlanmaydi.
*/

-- ── 1. fanfaster_ai_sessions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fanfaster_ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_login text NOT NULL,
  user_ism text,
  user_rol text DEFAULT 'oquvchi',
  rejim text DEFAULT 'lexion',
  messages jsonb DEFAULT '[]'::jsonb,
  savol_soni int DEFAULT 0,
  sarflangan_vaqt_sekund int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

ALTER TABLE fanfaster_ai_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fanfaster_ai_sessions" ON fanfaster_ai_sessions;
CREATE POLICY "anon_select_fanfaster_ai_sessions" ON fanfaster_ai_sessions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fanfaster_ai_sessions" ON fanfaster_ai_sessions;
CREATE POLICY "anon_insert_fanfaster_ai_sessions" ON fanfaster_ai_sessions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fanfaster_ai_sessions" ON fanfaster_ai_sessions;
CREATE POLICY "anon_update_fanfaster_ai_sessions" ON fanfaster_ai_sessions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fanfaster_ai_sessions" ON fanfaster_ai_sessions;
CREATE POLICY "anon_delete_fanfaster_ai_sessions" ON fanfaster_ai_sessions FOR DELETE
TO anon, authenticated USING (true);

-- ── 2. fanfaster_ai_stats ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fanfaster_ai_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_login text,
  user_ism text,
  user_rol text,
  rejim text,
  savol_matn text,
  javob_matn text,
  xato boolean DEFAULT false,
  xato_matn text,
  sarflangan_sekund int DEFAULT 0,
  session_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fanfaster_ai_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fanfaster_ai_stats" ON fanfaster_ai_stats;
CREATE POLICY "anon_select_fanfaster_ai_stats" ON fanfaster_ai_stats FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fanfaster_ai_stats" ON fanfaster_ai_stats;
CREATE POLICY "anon_insert_fanfaster_ai_stats" ON fanfaster_ai_stats FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fanfaster_ai_stats" ON fanfaster_ai_stats;
CREATE POLICY "anon_update_fanfaster_ai_stats" ON fanfaster_ai_stats FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fanfaster_ai_stats" ON fanfaster_ai_stats;
CREATE POLICY "anon_delete_fanfaster_ai_stats" ON fanfaster_ai_stats FOR DELETE
TO anon, authenticated USING (true);

-- ── 3. fanfaster_ai_queue ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fanfaster_ai_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_login text,
  session_id uuid,
  status text DEFAULT 'waiting',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fanfaster_ai_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fanfaster_ai_queue" ON fanfaster_ai_queue;
CREATE POLICY "anon_select_fanfaster_ai_queue" ON fanfaster_ai_queue FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fanfaster_ai_queue" ON fanfaster_ai_queue;
CREATE POLICY "anon_insert_fanfaster_ai_queue" ON fanfaster_ai_queue FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fanfaster_ai_queue" ON fanfaster_ai_queue;
CREATE POLICY "anon_update_fanfaster_ai_queue" ON fanfaster_ai_queue FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fanfaster_ai_queue" ON fanfaster_ai_queue;
CREATE POLICY "anon_delete_fanfaster_ai_queue" ON fanfaster_ai_queue FOR DELETE
TO anon, authenticated USING (true);

-- ── INDEXES ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fanfaster_ai_sessions_user ON fanfaster_ai_sessions(user_login);
CREATE INDEX IF NOT EXISTS idx_fanfaster_ai_stats_user ON fanfaster_ai_stats(user_login);
CREATE INDEX IF NOT EXISTS idx_fanfaster_ai_stats_created ON fanfaster_ai_stats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fanfaster_ai_queue_status ON fanfaster_ai_queue(status);
CREATE INDEX IF NOT EXISTS idx_fanfaster_ai_queue_updated ON fanfaster_ai_queue(updated_at DESC);
