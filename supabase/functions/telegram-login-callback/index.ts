// telegram-login-callback v2 — bir martalik kirish tokenini sarflash
// Frontend POST bilan tokenni yuboradi, edge function atomik ravishda
// used_at o'rnatib, talaba ma'lumotlarini qaytaradi.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token kerak' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Token hash hisoblash
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Eski tokenlar (session_token da raw qiymat saqlangan) — muddati bilan tanish
    // Avval hash bo'yicha, keyin raw bo'yicha qidiramiz
    let sessionData: any = null;

    // Hash bo'yicha atomik sarflash
    const { data: hashedSession, error: hashErr } = await supabaseAdmin
      .from('telegram_login_sessions')
      .update({ used_at: new Date().toISOString(), status: 'used' })
      .eq('session_token', tokenHash)
      .is('used_at', null)
      .gte('expires_at', new Date().toISOString())
      .select('*')
      .maybeSingle();

    if (hashedSession) {
      sessionData = hashedSession;
    }

    // Eski raw tokenlar (migratsiyadan oldingi)
    if (!sessionData) {
      const { data: rawSession } = await supabaseAdmin
        .from('telegram_login_sessions')
        .update({ used_at: new Date().toISOString(), status: 'used' })
        .eq('session_token', token)
        .is('used_at', null)
        .gte('expires_at', new Date().toISOString())
        .select('*')
        .maybeSingle();
      sessionData = rawSession;
    }

    if (!sessionData) {
      // Token topilmadi yoki allaqachon ishlatilgan yoki muddati o'tgan
      // Nima sababli ekanligini aniqlaymiz
      const { data: anySession } = await supabaseAdmin
        .from('telegram_login_sessions')
        .select('used_at, expires_at, status')
        .or(`session_token.eq.${tokenHash},session_token.eq.${token}`)
        .maybeSingle();

      if (anySession?.used_at) {
        return new Response(
          JSON.stringify({ error: 'Bu havola allaqachon ishlatilgan' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (anySession && new Date(anySession.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Havola muddati tugagan' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Token topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // status confirmed bo'lishi kerak
    if (sessionData.status && sessionData.status !== 'confirmed' && sessionData.status !== 'used') {
      // pending bo'lsa — hali bot tasdiqlamagan
      return new Response(
        JSON.stringify({ status: 'pending', message: 'Bot javobi kutilmoqda' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // merged_into tekshirish — agar talaba boshqasiga birlashtirilgan bo'lsa
    let talabaId = sessionData.talaba_id;
    if (talabaId) {
      const { data: talaba } = await supabaseAdmin
        .from('talabalar')
        .select('id, merged_into, ism, familiya, guruh, kurs, login_id')
        .eq('id', talabaId)
        .maybeSingle();

      if (talaba?.merged_into) {
        talabaId = talaba.merged_into;
        const { data: asosiy } = await supabaseAdmin
          .from('talabalar')
          .select('ism, familiya, guruh, kurs, login_id')
          .eq('id', talabaId)
          .maybeSingle();

        if (asosiy) {
          sessionData.ism = asosiy.ism;
          sessionData.familiya = asosiy.familiya;
          sessionData.guruh = asosiy.guruh;
          sessionData.kurs = asosiy.kurs;
          sessionData.login_id = asosiy.login_id;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          ism: sessionData.ism || 'Foydalanuvchi',
          familiya: sessionData.familiya || '',
          guruh: sessionData.guruh || '',
          kurs: sessionData.kurs || '',
          login_id: sessionData.login_id || sessionData.ism,
          talaba_id: talabaId,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[telegram-login-callback] xato:', err);
    return new Response(
      JSON.stringify({ error: 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
