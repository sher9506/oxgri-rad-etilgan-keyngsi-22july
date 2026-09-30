-- case-sources bucket'idan 24 soatdan eski fayllarni o'chirish uchun RPC funksiya
-- pg_cron har soatda chaqiradi

CREATE OR REPLACE FUNCTION public.cleanup_case_sources_24h()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  obj record;
  cutoff timestamptz := now() - interval '24 hours';
  deleted_count integer := 0;
BEGIN
  -- Faqat case-sources bucket'idan 24 soatdan eski fayllarni tanlash
  FOR obj IN
    SELECT id, name
    FROM storage.objects
    WHERE bucket_id = 'case-sources'
      AND created_at < cutoff
  LOOP
    -- Faylni o'chirish
    DELETE FROM storage.objects WHERE id = obj.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  -- Log uchun (edge function log'ida ko'rinmaydi, lekin xatolik bo'lmasa kerak emas)
  RAISE NOTICE 'cleanup_case_sources_24h: % ta fayl o''chirildi (cutoff: %)', deleted_count, cutoff;
END;
$$;

-- pg_cron bilan har soatda chaqirish
-- Eslatma: pg_cron extensions schema'sida bo'lgani uchun to'liq nom bilan chaqiramiz
SELECT cron.schedule(
  'cleanup-case-sources-hourly',
  '0 * * * *',
  $$SELECT public.cleanup_case_sources_24h();$$
);
