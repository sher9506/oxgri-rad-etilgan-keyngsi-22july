import { supabase } from './supabase';
import { detectPlatform } from './platform';

/**
 * Google OAuth orqali kirishni boshlaydi.
 * redirectTo = window.location.origin + '/google-callback'
 */
export async function startGoogleLogin(): Promise<{ error?: string }> {
  try {
    const redirectTo = window.location.origin + '/google-callback';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err.message || 'Google bilan kirishda xatolik' };
  }
}

/**
 * Google OAuth orqali mavjud talabaga Google'ni bog'lash.
 * Bog'lash rejimida redirect URL ga link=true&talaba_id=... qo'shiladi.
 */
export async function startGoogleLink(talabaId: string): Promise<{ error?: string }> {
  try {
    const redirectTo = `${window.location.origin}/google-callback?link=true&talaba_id=${talabaId}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err.message || 'Google bog'lashda xatolik' };
  }
}

export { detectPlatform };
