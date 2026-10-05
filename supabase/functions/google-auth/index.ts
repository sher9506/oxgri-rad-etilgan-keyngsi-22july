import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { code, linkTalabaId, redirectUri } = body as {
      code: string;
      linkTalabaId?: string;
      redirectUri?: string;
    };

    if (!redirectUri || !redirectUri.endsWith('/google-callback')) {
      return new Response(
        JSON.stringify({ error: 'Google redirect manzili noto‘g‘ri' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'code majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Google client credentials ni settings dan olish ──
    const { data: clientIdRow } = await supabaseAdmin
      .from('settings')
      .select('text_value')
      .eq('key', 'GOOGLE_CLIENT_ID')
      .maybeSingle();
    const { data: clientSecretRow } = await supabaseAdmin
      .from('settings')
      .select('text_value')
      .eq('key', 'GOOGLE_CLIENT_SECRET')
      .maybeSingle();

    const clientId = clientIdRow?.text_value;
    const clientSecret = clientSecretRow?.text_value;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Google OAuth sozlanmalari topilmadi' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Code ni token ga almashtirish ──
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('[google-auth] token exchange failed:', errText);
      return new Response(
        JSON.stringify({ error: 'Google token almashtirish amalga oshmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Google access token olinmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Foydalanuvchi ma lumotlarini olish ──
    const userInfoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Google foydalanuvchi ma lumotlari olinmadi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userInfo: GoogleUserInfo = await userInfoRes.json();
    const googleUserId = userInfo.sub;
    const googleEmail = userInfo.email || '';

    // ── Boglash rejimi ──
    if (linkTalabaId) {
      // Boshqa talabaga boglanganmi?
      const { data: existing } = await supabaseAdmin
        .from('talabalar')
        .select('id')
        .eq('google_user_id', googleUserId)
        .neq('id', linkTalabaId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Bu Google akkaunt boshqa talabaga boglangan', alreadyLinked: true }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Boglash
      const { error: linkErr } = await supabaseAdmin
        .from('talabalar')
        .update({ google_user_id: googleUserId })
        .eq('id', linkTalabaId);

      if (linkErr) {
        return new Response(
          JSON.stringify({ error: 'Boglashda xatolik: ' + linkErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Bonus berish (agar Telegram ham bogliq bolsa)
      const { data: talaba } = await supabaseAdmin
        .from('talabalar')
        .select('google_user_id, telegram_chat_id')
        .eq('id', linkTalabaId)
        .maybeSingle();

      if (talaba?.google_user_id && talaba?.telegram_chat_id) {
        await supabaseAdmin.rpc('berilish_birlashtirish_bonusi', { p_talaba_id: linkTalabaId });
      }

      return new Response(
        JSON.stringify({ mode: 'linked', googleUserId, googleEmail, name: userInfo.name || '' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Oddiy kirish: google_user_id bo'yicha talabani topish ──
    let { data: talaba } = await supabaseAdmin
      .from('talabalar')
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
      .eq('google_user_id', googleUserId)
      .maybeSingle();

    // ── Yangi talaba — Google ma'lumotlari bilan avtomatik yaratish ──
    if (!talaba) {
      const googleIsm = userInfo.given_name?.trim() || '';
      const googleFamiliya = userInfo.family_name?.trim() || '';
      const nameParts = (userInfo.name || '').trim().split(/\s+/).filter(Boolean);
      const ism = googleIsm || nameParts[0] || '';
      const familiya = googleFamiliya || nameParts.slice(1).join(' ');

      if (ism) {
        const { data: yangiTalaba, error: createError } = await supabaseAdmin
          .from('talabalar')
          .insert({
            ism,
            familiya: familiya || null,
            kurs: null,
            guruh: null,
            google_user_id: googleUserId,
          })
          .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
          .maybeSingle();

        if (createError) {
          const { data: existingTalaba } = await supabaseAdmin
            .from('talabalar')
            .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
            .eq('google_user_id', googleUserId)
            .maybeSingle();
          talaba = existingTalaba;
        } else {
          talaba = yangiTalaba;
        }

        if (!talaba) {
          console.error('[google-auth] talaba yaratilmadi:', createError?.message || 'noma\'lum xato');
          return new Response(
            JSON.stringify({ error: 'Talaba profili yaratilmadi' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (talaba) {
      const tasdiqlangan = !!(talaba.google_user_id && talaba.telegram_chat_id);
      return new Response(
        JSON.stringify({
          mode: 'login',
          talaba: {
            id: talaba.id,
            ism: talaba.ism || 'Foydalanuvchi',
            familiya: talaba.familiya || '',
            guruh: talaba.guruh || '',
            kurs: talaba.kurs || '',
            login: talaba.login_id || talaba.ism || '',
            tasdiqlangan,
            google_linked: true,
            telegram_linked: !!talaba.telegram_chat_id,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Google ism bermagan juda kam holat uchun qisqa forma
    return new Response(
      JSON.stringify({ mode: 'form', googleUserId, googleEmail, suggestedIsm: '', suggestedFamiliya: '' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[google-auth] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 150)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
