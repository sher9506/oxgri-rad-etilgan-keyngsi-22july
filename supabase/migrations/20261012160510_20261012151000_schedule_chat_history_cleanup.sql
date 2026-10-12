-- 14 kundan eski case_answer_jobs (job_kind='chat') qatorlarini tozalovchi cron
-- Limit oynasi 5 soat, shuning uchun 14 kun xavfsiz.
-- pg_cron allaqachon yoqilgan (20260930011008).

select cron.schedule(
  'nexus-chat-history-cleanup',
  '0 */6 * * *',
  $$
    delete from public.case_answer_jobs
    where job_kind = 'chat'
      and created_at < now() - interval '14 days';
  $$
);
