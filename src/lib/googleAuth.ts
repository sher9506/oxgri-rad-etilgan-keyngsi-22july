import { supabase } from './supabase';
import { detectPlatform } from './platform';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const REDIRECT_PATH = '/google-callback';

async function getGoogleClientId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('text_value')
    .eq('key', 'GOOGLE_CLIENT_ID')
    .maybeSingle();

  if (error) throw error;
  return data?.text_value || null;
}

async function redirectToGoogle(state?: string): Promise<{ error?: string }> {
  try {
    const clientId = await getGoogleClientId();
    if (!clientId) return { error: 'Google sozlanmagan. Admin bilan boglaning.' };

    const redirectUri = `${window.location.origin}${REDIRECT_PATH}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    });
    if (state) params.set('state', state);

    window.location.assign(`${GOOGLE_AUTH_URL}?${params.toString()}`);
    return {};
  } catch (err: any) {
    return { error: err.message || 'Google bilan kirishda xatolik' };
  }
}

export function startGoogleLogin(): Promise<{ error?: string }> {
  return redirectToGoogle();
}

export function startGoogleLink(talabaId: string): Promise<{ error?: string }> {
  return redirectToGoogle(`link=true&talaba_id=${encodeURIComponent(talabaId)}`);
}

export { detectPlatform };
