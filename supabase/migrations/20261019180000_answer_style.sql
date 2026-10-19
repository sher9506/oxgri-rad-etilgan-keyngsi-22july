-- Lo'nda rejimi Lexion orqali: 2-bosqich (case-answer-status) qisqa ko'rsatma va 3 ta hujjat chegarasini shundan biladi
alter table public.case_answer_jobs add column if not exists answer_style text;
