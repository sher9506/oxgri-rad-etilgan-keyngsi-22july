/*
# NaSher AI Telegram boti

1. case_answer_jobs ga bot ustunlari:
   - tg_chat_id: javob yuboriladigan Telegram chat (null = saytdan kelgan savol)
   - tg_progress_msg_id: "izlanmoqda" xabari (yangilanadi, javobdan keyin o'chiriladi)
   - tg_phase: progress bosqichi (searching / reading)
   - tg_delivered_at: javob yuborilgan vaqt (ikki marta yuborilmasin)
2. nasher-bot-dispatch har daqiqada (pg_cron + pg_net).
   Cron siri migratsiyaga yozilmaydi — settings.CRON_SECRET dan ish vaqtida o'qiladi (repo ochiq).
*/
alter table case_answer_jobs add column if not exists tg_chat_id bigint;
alter table case_answer_jobs add column if not exists tg_progress_msg_id bigint;
alter table case_answer_jobs add column if not exists tg_phase text;
alter table case_answer_jobs add column if not exists tg_delivered_at timestamptz;

create index if not exists case_answer_jobs_tg_pending_idx
  on case_answer_jobs (created_at)
  where tg_chat_id is not null and tg_delivered_at is null;

select cron.unschedule('nasher-bot-dispatch')
  where exists (select 1 from cron.job where jobname = 'nasher-bot-dispatch');

select cron.schedule('nasher-bot-dispatch', '* * * * *', $$
  select net.http_post(
    url := 'https://gvhjzkqmyyaxtbrlxxmb.supabase.co/functions/v1/nasher-bot-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select text_value from public.settings where key = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);
