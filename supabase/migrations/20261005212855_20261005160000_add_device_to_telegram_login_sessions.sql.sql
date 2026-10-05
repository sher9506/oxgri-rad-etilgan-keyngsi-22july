/*
# Add device column to telegram_login_sessions

1. Changes
- Add `device` text column to `telegram_login_sessions` table
- Stores the detected device type ('mobile' or 'desktop') when a login session is created
- Existing rows have NULL — backward compatible
- Used by telegram-login bot to respond with appropriate buttons (Mini App for mobile, return-to-site for desktop)
2. Security
- No RLS changes
- No new policies
*/

ALTER TABLE telegram_login_sessions
ADD COLUMN IF NOT EXISTS device text;
