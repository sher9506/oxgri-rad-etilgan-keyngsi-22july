// handoff-consume — bir martalik tokenni atomik sarflash va talaba qaytarish v2
// verify_jwt = false (config.toml'da aniq)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const securityHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  };

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string' || token.length < 64) {
      return new Response(JSON.stringify({ error: 'Token noto\'g\'ri' }),
        { status: 400, headers: securityHeaders });
    }

    // Hash hisoblash
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Atomik sarflash: faqat ishlatilmagan va muddati o'tmagan
    const { data: session, error: consumeErr } = await supabaseAdmin
      .from('telegram_login_sessions')
      .update({ used_at: new Date().toISOString() })
      .eq('session_token', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('talaba_id, ism, familiya, guruh, kurs, login_id')
      .maybeSingle();

    if (consumeErr || !session) {
      return new Response(JSON.stringify({ error: 'Token muddati o\'tgan yoki allaqachon ishlatilgan' }),
        { status: 410, headers: securityHeaders });
    }

    // Talaba ma'lumotlarini olish
    const { data: talaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
      .eq('id', session.talaba_id)
      .maybeSingle();

    if (!talaba) {
      return new Response(JSON.stringify({ error: 'Talaba topilmadi' }),
        { status: 404, headers: securityHeaders });
    }

    return new Response(JSON.stringify({
      talaba: {
        id: talaba.id,
        ism: talaba.ism || session.ism || 'Foydalanuvchi',
        familiya: talaba.familiya || session.familiya || '',
        guruh: talaba.guruh || session.guruh || '',
        kurs: talaba.kurs || session.kurs || '',
        login: talaba.login_id || session.login_id || talaba.ism,
        tasdiqlangan: !!(talaba.google_user_id && talaba.telegram_chat_id),
        google_linked: !!talaba.google_user_id,
        telegram_linked: !!talaba.telegram_chat_id,
      },
    }),
      { headers: securityHeaders });
  } catch (err) {
    console.error('[handoff-consume] xato:', err);
    return new Response(JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: securityHeaders });
  }
});
