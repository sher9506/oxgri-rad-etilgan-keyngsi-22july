/*
# NaSher bot: foydalanuvchining joriy suhbati

Har Telegram foydalanuvchisi uchun botdagi joriy suhbat (chat_id) va u boshlangan vaqt.
Suhbat 5 soat yashaydi (sayt bilan bir xil): 5 soatdan keyingi savol yangi suhbatda boshlanadi.
Faqat edge funksiyalar (service role) o'qiydi/yozadi — RLS yoqilgan, siyosat yo'q.
*/
create table if not exists public.nasher_tg_state (
  telegram_id bigint primary key,
  user_id text not null,
  chat_id text not null,
  chat_started_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.nasher_tg_state enable row level security;
