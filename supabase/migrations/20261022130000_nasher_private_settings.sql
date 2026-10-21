-- Maxfiy sozlamalar (masalan, admin "API kalitlari" bo'limi PIN'ining SHA-256 xeshi).
-- public.settings hammaga ochiq, shuning uchun alohida jadval: RLS yoqilgan, siyosat yo'q — faqat service_role o'qiydi.
create table if not exists public.nasher_private_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.nasher_private_settings enable row level security;
