-- NaSher kanal bonusi: @fanfasteruz a'zolariga 5 soatlik savol limitiga +2. A'zolik oxirgi tasdiqlangan vaqt (1 kunlik kesh).
alter table public.talabalar add column if not exists nasher_channel_ok_at timestamptz;
