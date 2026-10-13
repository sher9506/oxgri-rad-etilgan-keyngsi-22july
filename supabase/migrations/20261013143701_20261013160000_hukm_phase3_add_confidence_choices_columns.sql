/*
# Hukm Phase 3: confidence + choices columns on hukm_answers

## Changes
1. New columns on `hukm_answers` (additive only, no data loss):
   - `confidence` (text, nullable) — player confidence marker: 'aniq' or 'taxmin'. Used only in 'ishonch' score mode. Null for other modes or when not submitted. Defaults to 'taxmin' at scoring time if missing.
   - `choices` (jsonb, nullable) — array of selected option indices for 'multi' question type. Null for single-choice questions (variant4, togri_notogri). Stores e.g. [0, 2].

2. No new tables, no column deletions, no type changes.
3. No RLS changes — hukm_answers already has RLS enabled with 0 policies (anon blocked, service role bypasses). This migration does NOT touch RLS.
4. score_mode lives inside `hukm_games.settings` jsonb — no new column needed.

## Security
- No changes to existing policies. hukm_answers remains locked to anon.
- The service role (used only inside the edge function) bypasses RLS.

## Important notes
1. Both columns are nullable so existing rows and old games work unchanged.
2. Backward compatibility: old answer rows have NULL confidence and NULL choices — they are treated as single-choice 'aniqlik' mode by default.
3. No index added — queries already filter by game_id + player_id + question_index (existing unique constraint).
*/

ALTER TABLE hukm_answers
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT NULL;

ALTER TABLE hukm_answers
  ADD COLUMN IF NOT EXISTS choices jsonb DEFAULT NULL;
