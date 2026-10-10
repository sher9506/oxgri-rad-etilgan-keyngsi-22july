/*
# Create lexion_chat_messages table

1. Yangi jadval: lexion_chat_messages
   - id (uuid, PK)
   - session_id (text, mijoz tomonidan generatsiya qilinadi, xabarlar guruhlash uchun)
   - role (text: 'user' yoki 'assistant')
   - content (text, xabar matni)
   - created_at (timestamptz)

2. Izoh: Lexion AI chat uchun xabarlar saqlanadi.
   LexionAI faqat mehmon (tizimga kirmagan) foydalanuvchilarga ko'rinadi,
   shuning uchun auth yo'q — anon kalit bilan ishlaydi.
   session_id orqali frontal har bir brauzer sessiyasining xabarlarini ajratadi.

3. Xavfsizlik
   - RLS yoqilgan.
   - anon + authenticated rollariga to'liq CRUD ruxsat (USING true).
   Bu maqsadli ravishda ommaviy ma'lumot — Lexion chat mehmonlar uchun,
   egalik tekshiruvi yo'q chunki auth tizimi ishtirok etmaydi.

4. Indeks: session_id bo'yicha tez so'rov uchun.
*/

CREATE TABLE IF NOT EXISTS lexion_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lexion_chat_session ON lexion_chat_messages (session_id, created_at);

ALTER TABLE lexion_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lexion_chat" ON lexion_chat_messages;
CREATE POLICY "anon_select_lexion_chat"
ON lexion_chat_messages FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_lexion_chat" ON lexion_chat_messages;
CREATE POLICY "anon_insert_lexion_chat"
ON lexion_chat_messages FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_lexion_chat" ON lexion_chat_messages;
CREATE POLICY "anon_delete_lexion_chat"
ON lexion_chat_messages FOR DELETE
TO anon, authenticated USING (true);
