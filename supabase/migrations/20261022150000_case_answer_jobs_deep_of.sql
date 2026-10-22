-- NaSher: «Chuqur tahlil» qayta so'rovi — qaysi tez javobdan so'ralgani.
-- Unikal: bitta tez javobga faqat bitta Chuqur (tugmani ikki marta bosish ikkita savol yaratmaydi);
-- deep_of bor qatorlar 5 soatlik savol limitiga qo'shilmaydi.
alter table public.case_answer_jobs add column if not exists deep_of uuid;
create unique index if not exists case_answer_jobs_deep_of_key on public.case_answer_jobs (deep_of) where deep_of is not null;
