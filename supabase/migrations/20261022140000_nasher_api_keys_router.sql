-- NaSher: rejim tanlovchi (router) uchun alohida kalitlar havzasi
alter table public.nasher_api_keys drop constraint if exists nasher_api_keys_pool_check;
alter table public.nasher_api_keys add constraint nasher_api_keys_pool_check check (pool in ('voice', 'fast', 'router'));
