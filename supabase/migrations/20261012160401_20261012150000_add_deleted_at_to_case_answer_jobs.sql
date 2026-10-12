-- case_answer_jobs ga deleted_at qo'shish (soft-delete chat history uchun)
-- Muhim: limit hisoblovchi so'rovlar deleted_at ni HISOBGA OLMAYDI
-- (o'chirilgan chat ham limitdan sanalaversin)

ALTER TABLE public.case_answer_jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_case_answer_jobs_chat_history
  ON public.case_answer_jobs (teacher_id, chat_id, created_at)
  WHERE job_kind = 'chat';
