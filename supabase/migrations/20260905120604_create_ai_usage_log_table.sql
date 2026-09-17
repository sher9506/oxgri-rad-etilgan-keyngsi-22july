/*
# AI Usage Log table
Tracks every AI request (provider, function name, timestamp) for quota monitoring.
*/
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'gemini',
  function_name text NOT NULL,
  model text,
  success boolean NOT NULL DEFAULT true,
  error_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_ai_usage_log" ON ai_usage_log FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_ai_usage_log" ON ai_usage_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_provider_date ON ai_usage_log (provider, created_at);
