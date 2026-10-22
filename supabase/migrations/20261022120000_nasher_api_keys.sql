-- NaSher: Gemini API kalitlari havzalari (ovoz, tez rejim) va ularning kunlik hisobi.
-- Kalitlar MAXFIY: RLS yoqilgan, siyosat yo'q — anon/authenticated o'qiy olmaydi, faqat service_role (edge funksiyalar).
create table if not exists public.nasher_api_keys (
  id uuid primary key default gen_random_uuid(),
  pool text not null check (pool in ('voice', 'fast')),
  api_key text not null,
  label text not null default '',
  enabled boolean not null default true,
  last_test_at timestamptz,
  last_test_status text,
  created_at timestamptz not null default now(),
  unique (pool, api_key)
);
alter table public.nasher_api_keys enable row level security;

create table if not exists public.nasher_api_usage (
  key_id uuid not null references public.nasher_api_keys(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Tashkent')::date,
  ok integer not null default 0,
  quota integer not null default 0,     -- 429 / kvota tugagan
  errors integer not null default 0,    -- boshqa xatolar
  last_status text,
  last_at timestamptz,
  primary key (key_id, day)
);
alter table public.nasher_api_usage enable row level security;

-- Bitta so'rov natijasini hisobga qo'shish (parallel so'rovlarda ham to'g'ri sanaydi)
create or replace function public.nasher_api_usage_add(p_key uuid, p_kind text, p_status text)
returns void language sql security definer set search_path = public as $$
  insert into nasher_api_usage (key_id, day, ok, quota, errors, last_status, last_at)
  values (p_key, (now() at time zone 'Asia/Tashkent')::date,
          (p_kind = 'ok')::int, (p_kind = 'quota')::int, (p_kind = 'error')::int, p_status, now())
  on conflict (key_id, day) do update set
    ok = nasher_api_usage.ok + excluded.ok,
    quota = nasher_api_usage.quota + excluded.quota,
    errors = nasher_api_usage.errors + excluded.errors,
    last_status = excluded.last_status,
    last_at = excluded.last_at;
$$;
revoke all on function public.nasher_api_usage_add(uuid, text, text) from public, anon, authenticated;
