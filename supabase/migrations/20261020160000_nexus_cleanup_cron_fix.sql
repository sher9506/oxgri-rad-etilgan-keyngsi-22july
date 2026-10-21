/*
# nexus-notebook-cleanup cron manzilini tuzatish + CRON_SECRET almashtirish

Cron 2026-10-12 dan beri o'lik manzilga (gvhjzkqmyyaxtbrlxxmb) yuborilardi, shuning uchun muddati o'tgan
chat daftarlari hech qachon tozalanmadi. R2 da 70/70 bo'lib, suhbat xotirasi saqlanmay qoldi.
Eski sir 20261012031310 migratsiyasida ochiq yozilgan edi, u yangisiga almashtiriladi.
Endi sir har ishga tushishda settings'dan o'qiladi (nasher-bot-dispatch ham shunday).
*/
update public.settings
set text_value = md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
where key = 'CRON_SECRET';

select cron.unschedule('nexus-notebook-cleanup')
  where exists (select 1 from cron.job where jobname = 'nexus-notebook-cleanup');

select cron.schedule('nexus-notebook-cleanup', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://mrxdoeeyxawcwrndyrwp.supabase.co/functions/v1/nexus-notebook-cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select text_value from public.settings where key = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000);
$$);
