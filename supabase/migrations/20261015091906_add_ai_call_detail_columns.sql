/*
# Add detailed logging columns to ai_usage_log

1. Modified Tables
- `ai_usage_log` — added columns for detailed AI call tracking:
  - `model_name` text — AI model used (e.g. gemini-3-flash-preview, openai/gpt-oss-120b)
  - `http_status` integer — HTTP response code (200, 429, 500, etc.)
  - `response_ms` integer — response time in milliseconds
  - `input_tokens` integer — tokens sent in the request
  - `output_tokens` integer — tokens received in the response
  - `thinking_tokens` integer — Gemini thinking tokens (separate from output)
  - `retry_after_sec` numeric — Retry-After header value if 429
  - `rate_limit_headers` jsonb — all x-ratelimit-* headers as JSON
  - `error_body` text — full error response body (truncated to 2000 chars)
  - `is_test` boolean default false — marks load-test calls so they can be filtered out

2. Security
- No new policies needed; existing INSERT/SELECT policies on ai_usage_log already allow anon+authenticated.

3. Notes
- All new columns are nullable so existing rows and old code paths are unaffected.
- `is_test` column lets us filter load-test traffic from real usage analytics.
*/ 

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS http_status integer,
  ADD COLUMN IF NOT EXISTS response_ms integer,
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS thinking_tokens integer,
  ADD COLUMN IF NOT EXISTS retry_after_sec numeric,
  ADD COLUMN IF NOT EXISTS rate_limit_headers jsonb,
  ADD COLUMN IF NOT EXISTS error_body text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_is_test_created
  ON ai_usage_log (is_test, created_at DESC);
