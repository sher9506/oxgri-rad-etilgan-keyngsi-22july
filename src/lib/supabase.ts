import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL muhit o\'zgaruvchisi topilmadi. Netlify sayti sozlamalarida Environment variables bo\'limiga kirib, VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY qo\'shing.');
}
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY muhit o\'zgaruvchisi topilmadi. Netlify sayti sozlamalarida Environment variables bo\'limiga kirib, VITE_SUPABASE_ANON_KEY qo\'shing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { supabaseUrl, supabaseAnonKey };
