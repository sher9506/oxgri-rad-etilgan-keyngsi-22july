/*
# Nexus AI: chat = 1 NotebookLM daftar (5 soat)

## Maqsad
Nexus AI chatida har bir chat (frontend chat_id) uchun BITTA vaqtinchalik NotebookLM daftari ochilib,
chat boshlanganidan 5 soat saqlanadi. Chatning keyingi savollari shu daftarda (bir xil conversation_id bilan)
beriladi, shunda AI oldingi savol-javoblarni eslaydi. 5 soatdan keyin daftar o'chiriladi.

## Yangi jadval
- `nexus_chat_notebooks` — chat daftarlarini boshqarish uchun
  - `chat_id` (text) — frontend yaratgan chat UUID
  - `user_id` (text) — case_answer_jobs.teacher_id
  - `backend` (int) — daftarni yaratgan Render (1|2|3)
  - `profile` (text) — Render'dagi akkaunt profili
  - `notebook_id` (text, unique) — Render'dagi daftar ID
  - `conversation_id` (text) — suhbat ID
  - `turns` (int) — suhbatdagi javoblar soni
  - `lex_urls` (text[]) — daftarga qo'shilgan lex.uz hujjat raqamlari
  - `last_topic` (text) — oxirgi savol (~200 belgi)
  - `status` (text) — active|expired|deleted|failed
  - `expires_at` (timestamptz) — created_at + 5 soat
  - `deleted_at` (timestamptz)

## case_answer_jobs yangi ustunlari
- `chat_id` (text) — frontend chat UUID
- `chat_followup` (boolean, default false) — davom savoli ekanligi
- `chat_keep_requested` (boolean, default false) — daftar saqlash so'ralgan
- `chat_keep_registered` (boolean, default false) — daftar ro'yxatga olingan

## Security
- nexus_chat_notebooks: RLS yoqilgan, anon va authenticated'dan revoke qilingan (faqat service role)
- case_answer_jobs ustunlari mavjud jadvalga qo'shiladi, RLS o'zgarishsiz

## Settings
- NEXUS_KEEP_NOTEBOOK = 'off' (flag)
- NEXUS_KEEP_TTL_HOURS = '5' (daftar muddati soatlarda)
- NEXUS_MAX_KEPT_PER_BACKEND = '120' (har backend uchun maks daftarlar)

## pg_net
- pg_net kengaytmasi yoqiladi (cron cleanup uchun HTTP POST)

## Indexes
- nexus_chat_notebooks_one_active: chat_id bo'yicha unique, faqat status='active'
- nexus_chat_notebooks_due: status, expires_at bo'yicha
- case_answer_jobs_keep_pending: created_at bo'yicha, faqat keep_requested va not registered

## Idempotent
- Barcha DDL IF [NOT] EXISTS bilan, qayta ishga tushirilsa xavfsiz
*/

create table if not exists public.nexus_chat_notebooks (
  id               uuid primary key default gen_random_uuid(),
  chat_id          text not null,
  user_id          text not null,
  backend          int  not null,
  profile          text not null,
  notebook_id      text not null unique,
  conversation_id  text,
  turns            int  not null default 0,
  lex_urls         text[] not null default '{}',
  last_topic       text,
  status           text not null default 'active'
                   check (status in ('active','expired','deleted','failed')),
  delete_attempts  int  not null default 0,
  last_error       text,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  deleted_at       timestamptz
);

create unique index if not exists nexus_chat_notebooks_one_active
  on public.nexus_chat_notebooks (chat_id) where status = 'active';
create index if not exists nexus_chat_notebooks_due
  on public.nexus_chat_notebooks (status, expires_at);

alter table public.nexus_chat_notebooks enable row level security;
revoke all on public.nexus_chat_notebooks from anon, authenticated;

alter table public.case_answer_jobs
  add column if not exists chat_id              text,
  add column if not exists chat_followup        boolean not null default false,
  add column if not exists chat_keep_requested  boolean not null default false,
  add column if not exists chat_keep_registered boolean not null default false;

create index if not exists case_answer_jobs_keep_pending
  on public.case_answer_jobs (created_at)
  where chat_keep_requested and not chat_keep_registered;

-- pg_net kengaytmasi (cron cleanup uchun HTTP POST)
create extension if not exists pg_net;

-- Settings: NEXUS_KEEP_NOTEBOOK flag (standart: off)
insert into public.settings (key, text_value)
values ('NEXUS_KEEP_NOTEBOOK', 'off')
on conflict (key) do nothing;

insert into public.settings (key, text_value)
values ('NEXUS_KEEP_TTL_HOURS', '5')
on conflict (key) do nothing;

insert into public.settings (key, text_value)
values ('NEXUS_MAX_KEPT_PER_BACKEND', '120')
on conflict (key) do nothing;
