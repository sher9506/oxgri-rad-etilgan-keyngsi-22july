// google-auth v2 — name-based existing account detection
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Email ni niqoblash: local qismning birinchi 2 va oxirgi 2 belgisi ochiq, o'rtasi yulduzcha
// masalan: sherzod.abdurashidov@gmail.com → sh****************ov@gmail.com
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 4) return `${local[0] || ''}**${local[local.length - 1] || ''}@${domain}`;
  const prefix = local.slice(0, 2);
  const suffix = local.slice(-2);
  const stars = '*'.repeat(Math.max(4, local.length - 4));
  return `${prefix}${stars}${suffix}@${domain}`;
}

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
    const { code, linkTalabaId, linkState, redirectUri } = body as {
      code: string;
      linkTalabaId?: string;
      linkState?: string;
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
      // State hash tekshiruvi
      if (linkState) {
        const stateHashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(linkState));
        const stateHash = Array.from(new Uint8Array(stateHashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const { data: linkRow } = await supabaseAdmin
          .from('telegram_link_tokens')
          .select('id, talaba_id, used_at, expires_at')
          .eq('state_hash', stateHash)
          .maybeSingle();

        if (!linkRow) {
          return new Response(JSON.stringify({ error: 'State noto\'g\'ri' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (linkRow.used_at) {
          return new Response(JSON.stringify({ error: 'State allaqachon ishlatilgan' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (new Date(linkRow.expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: 'State muddati o\'tgan' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // talaba_id mosligi
        if (linkRow.talaba_id !== linkTalabaId) {
          return new Response(JSON.stringify({ error: 'Talaba mos emas' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        // google_sub ni qatorga yozish
        await supabaseAdmin
          .from('telegram_link_tokens')
          .update({ google_sub: googleUserId, status: 'google_proven' })
          .eq('state_hash', stateHash);
      }

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
        .update({ google_user_id: googleUserId, google_email_masked: maskEmail(googleEmail) })
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
      .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, merged_into')
      .eq('google_user_id', googleUserId)
      .maybeSingle();

    // merged_into zanjirini kuzatib, asosiy qatorga o'tish
    if (talaba?.merged_into) {
      const { data: asosiy } = await supabaseAdmin
        .from('talabalar')
        .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id')
        .eq('id', talaba.merged_into)
        .maybeSingle();
      if (asosiy) talaba = asosiy;
    }

    // ── Yangi talaba — Google ma'lumotlari bilan avtomatik yaratish ──
    if (!talaba) {
      const googleIsm = userInfo.given_name?.trim() || '';
      const googleFamiliya = userInfo.family_name?.trim() || '';
      const nameParts = (userInfo.name || '').trim().split(/\s+/).filter(Boolean);
      const ism = googleIsm || nameParts[0] || '';
      const familiya = googleFamiliya || nameParts.slice(1).join(' ');

      // Mavjud talabani ism+familiya bo'yicha tekshirish — takroriy qator oldini olish
      if (ism && familiya) {
        const { data: existingByName } = await supabaseAdmin
          .from('talabalar')
          .select('id, ism, familiya, guruh, kurs, login_id, google_user_id, telegram_chat_id, created_at')
          .ilike('ism', ism)
          .ilike('familiya', familiya)
          .is('merged_into', null)
          .maybeSingle();

        if (existingByName && !existingByName.google_user_id) {
          // Mavjud talaba topildi — yangi qator ochmaslik
          // google_user_id ni bog'lab qaytaramiz (avtomatik ulash)
          await supabaseAdmin
            .from('talabalar')
            .update({ google_user_id: googleUserId, google_email_masked: maskEmail(googleEmail) })
            .eq('id', existingByName.id);

          const tasdiqlangan = !!(existingByName.telegram_chat_id);
          return new Response(
            JSON.stringify({
              mode: 'login',
              talaba: {
                id: existingByName.id,
                ism: existingByName.ism || ism,
                familiya: existingByName.familiya || familiya,
                guruh: existingByName.guruh || '',
                kurs: existingByName.kurs || '',
                login: existingByName.login_id || ism || '',
                tasdiqlangan,
                google_linked: true,
                telegram_linked: !!existingByName.telegram_chat_id,
              },
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (existingByName && existingByName.google_user_id && existingByName.google_user_id !== googleUserId) {
          // Boshqa Google bilan bog'langan — yangi qator ochmaymiz
          return new Response(
            JSON.stringify({
              mode: 'merge_required',
              existing_talaba: {
                id: existingByName.id,
                ism: existingByName.ism,
                familiya: existingByName.familiya,
                created_at: existingByName.created_at,
              },
              google_user_id: googleUserId,
              google_email: googleEmail,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (ism) {
        const { data: yangiTalaba, error: createError } = await supabaseAdmin
          .from('talabalar')
          .insert({
            ism,
            familiya: familiya || null,
            kurs: null,
            guruh: null,
            google_user_id: googleUserId,
            google_email_masked: maskEmail(googleEmail),
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
          const code = (createError as any)?.code || 'noma_lum';
          const details = (createError as any)?.details || '';
          const hint = (createError as any)?.hint || '';
          console.error('[google-auth] talaba yaratilmadi:', JSON.stringify({ message: createError?.message, code, details, hint }));
          return new Response(
            JSON.stringify({ error: 'Talaba profili yaratilmadi', db_error: createError?.message || '', code, details, hint }),
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
