-- [N] iqtiboslarni lex.uz moddasiga havola qilish (sinov, faqat preview): case-answer-status 2-bosqichda Render'ga citations=true yuboradi
alter table public.case_answer_jobs add column if not exists cite_links boolean not null default false;
