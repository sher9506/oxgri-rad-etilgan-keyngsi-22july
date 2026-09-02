# AGENTS.md

## Purpose
This file helps AI coding agents understand the repository quickly and focus on the most important code paths, especially the AI mentor / GROQ integration and API fallback behavior.

## Project overview
- Frontend: Vite + React + TypeScript + shadcn-ui + Tailwind CSS.
- Backend: Supabase Edge Functions in `supabase/functions/`.
- AI Mentor: implemented in `supabase/functions/mentor-chat/index.ts` using the GROQ OpenAI-compatible REST API.

## Key files
- `supabase/functions/mentor-chat/index.ts`
  - loads mentor settings from Supabase `settings` table
  - supports `GROQ_API_KEY`, `GROQ_API_KEYS`, `AI_MENTOR_MODEL`, `AI_MENTOR_FAOL`, `AI_MENTOR_SYSTEM_INSTRUCTION`
  - builds a chat request body for `https://api.groq.com/openai/v1/chat/completions`
  - contains caching logic for repeated prompts
  - should be the main file to update for API key rotation, rate-limit handling, and Groq fallback logic
- `README.md`
  - has general setup instructions for local development
- `package.json`
  - use `npm i`, `npm run dev`, `npm run build`, `npm run lint`

## Important behavior to preserve
- The mentor endpoint is expected to work with multiple GROQ API keys.
- `GROQ_API_KEYS` is stored as a JSON string in the DB and should parse to an array of `gsk_...` keys.
- If one key hits a rate limit / 429 / quota issue, the backend should failover to the next available key.
- If no keys remain or all keys are exhausted, the endpoint should return a clear diagnostic error.
- `mentor-chat/index.ts` enforces teacher isolation. Analytics and content access must stay limited to `ustoz_id` unless a valid admin/service key is explicitly provided.

## Localization
- The backend code and logs contain Uzbek language comments and messages.
- Keep user-facing messages simple and consistent with existing Uzbek text.

## Recommended way to use this repo
1. Install dependencies: `npm install`
2. Run frontend locally: `npm run dev`
3. Validate TypeScript/linting: `npm run lint`

## Notes for agents
- Do not add frontend-only logic to the mentor-chat edge function.
- Keep API key fallback and request handling inside `mentor-chat/index.ts`.
- Avoid changing the Supabase environment behavior unless necessary; the function uses Deno env variables `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- If a task is to improve rate limit handling, review `isRateLimitError`, `callGroqDirect`, and `callGroqWithFallback` first.
- If asked to relax mentor restrictions for teachers, treat it as a security-sensitive backend change and do not bypass author isolation or access controls without explicit review.

## Useful guardrails
- Prefer minimal changes that fix key rotation and error detection rather than broad refactors.
- Preserve the existing `fetch`-based GROQ request structure unless a clear bug requires a redesign.
- Maintain strict author-filtering by `ustoz_id` in analytics code paths and avoid exposing other teachers' materials.
- When adding logging, use the current Uzbek log style like `[mentor-chat] ...`.
