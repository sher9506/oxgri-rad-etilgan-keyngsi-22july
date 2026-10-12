/*
# Schedule nexus-notebook-cleanup via pg_cron

## Maqsad
pg_cron orqali har 10 daqiqada nexus-notebook-cleanup edge funksiyasini chaqirish.

## Idempotent
cron.schedule qayta ishga tushirilsa xavfsiz (avval unschedule qilinmaydi, chunki birinchi marta yoqilmoqda).
*/

select cron.schedule('nexus-notebook-cleanup', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://gvhjzkqmyyaxtbrlxxmb.supabase.co/functions/v1/nexus-notebook-cleanup',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','placeholder-replace-via-secrets'),
    body := '{}'::jsonb);
$$);
