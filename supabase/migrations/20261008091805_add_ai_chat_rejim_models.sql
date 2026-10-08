/*
# FanFaster AI Chat: rejim-specific model settings

1. Yangi settings kalitlari:
   - AI_CHAT_LEXION_MODEL — Lexion rejimi uchun AI model (default: AI_MENTOR_MODEL dan oladi)
   - AI_CHAT_MANBA_MODEL — Manba rejimi uchun AI model (default: AI_MENTOR_MODEL dan oladi)
   - AI_CHAT_LEXION_PROVIDER — Lexion rejimi uchun provider ('gemini' | 'groq', default: 'gemini')
   - AI_CHAT_MANBA_PROVIDER — Manba rejimi uchun provider ('gemini' | 'groq', default: 'groq')
2. Mavjud jadval: settings (hech qanday yangi ustun yoki jadval ochilmaydi)
3. Xavfsizlik: settings jadvali RLS mavjud, faqat INSERT qilinadi
*/

INSERT INTO settings (key, text_value)
VALUES
  ('AI_CHAT_LEXION_MODEL', 'gemini-3.1-flash-lite'),
  ('AI_CHAT_MANBA_MODEL', 'openai/gpt-oss-120b'),
  ('AI_CHAT_LEXION_PROVIDER', 'gemini'),
  ('AI_CHAT_MANBA_PROVIDER', 'groq')
ON CONFLICT (key) DO NOTHING;
