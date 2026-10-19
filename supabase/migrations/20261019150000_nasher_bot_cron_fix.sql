/*
# nasher-bot-dispatch cron manzilini tuzatish

Oldingi migratsiyada eski Supabase loyihasi manzili (gvhjzkqmyyaxtbrlxxmb) yozilgan edi — u mavjud emas.
Sayt haqiqatda mrxdoeeyxawcwrndyrwp loyihasida ishlaydi. Cron shu manzilga qayta yo'naltiriladi.
CRON_SECRET settings da bo'lmasa, tasodifiy qiymat bilan yaratiladi (migratsiyaga sir yozilmaydi).
*/
insert into public.settings (key, text_value, value, tavsif)
select 'CRON_SECRET', md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text),
       true, 'pg_cron -> edge funksiyalar uchun ichki sir'
where not exists (select 1 from public.settings where key = 'CRON_SECRET' and coalesce(text_value, '') <> '');

select cron.unschedule('nasher-bot-dispatch')
  where exists (select 1 from cron.job where jobname = 'nasher-bot-dispatch');

select cron.schedule('nasher-bot-dispatch', '* * * * *', $$
  select net.http_post(
    url := 'https://mrxdoeeyxawcwrndyrwp.supabase.co/functions/v1/nasher-bot-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select text_value from public.settings where key = 'CRON_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);
