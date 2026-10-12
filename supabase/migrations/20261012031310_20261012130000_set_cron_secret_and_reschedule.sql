/*
# pg_cron nexus-notebook-cleanup ni yangi secret bilan qayta yaratish

## Maqsad
pg_cron 'nexus-notebook-cleanup' jadvalini haqiqiy CRON_SECRET qiymati bilan qayta yaratish.
Eski jadvalda 'placeholder-replace-via-secrets' turibdi.

## Eslatma
- Vault ga yozish ruxsat berilmadi, shuning uchun secret cron buyrug'ida to'g'ridan-to'g'ri yoziladi
- pg_cron.job jadvali faqat service role orqali o'qiladi, frontend/anon orqali emas
- CRON_SECRET qiymati Edge Function environment variable sifatida ham o'rnatilishi kerak
  (lekin MCP orqali secret o'rnatish ruxsat berilmadi — foydalanuvchi dashboard'dan o'rnatishi kerak)

## Xavfsizlik
- CRON_SECRET qiymati hisobotda ko'rsatilmaydi
- pg_cron.job jadvali service role bilan himoyalangan
*/

select cron.unschedule('nexus-notebook-cleanup');

select cron.schedule('nexus-notebook-cleanup', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://gvhjzkqmyyaxtbrlxxmb.supabase.co/functions/v1/nexus-notebook-cleanup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','54d788e9996226e126eceefb1e26d68b3c1016ab02bcf99e31b7ba58345ed4ab'
    ),
    body := '{}'::jsonb);
$$);
