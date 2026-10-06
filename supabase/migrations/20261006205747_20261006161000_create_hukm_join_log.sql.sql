/*
# Hukm — join rate limit log jadvali

1. Yangi jadval
- `hukm_join_log`: PIN qo'shilish urinishlarini sanaydi (rate limit uchun).
  key = IP:PIN, created_at = vaqt.
  RLS yoqilgan, policy yo'q (faqat service role).

2. Xavfsizlik
- RLS yoqilgan, anon policy yo'q.
*/

CREATE TABLE IF NOT EXISTS hukm_join_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE hukm_join_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hukm_join_log_key_time ON hukm_join_log(key, created_at);
