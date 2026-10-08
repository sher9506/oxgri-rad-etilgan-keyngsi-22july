// fanfaster-ai-chat — faqat admin monitoring uchun (admin_stats, admin_summary)
// Chat savollari endi fanfaster-chat-submit va fanfaster-chat-status orqali Render'ga yuboriladi.
// Eski Gemini/Groq yo'li, citationSearch, mode:'models' — olib tashlangan.
// Eski jadvallar (fanfaster_ai_stats, fanfaster_ai_sessions, fanfaster_ai_queue) O'CHIRILMADI.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function isAdmin(userLogin: string): Promise<boolean> {
  if (!userLogin) return false;
  try {
    const { data } = await supabaseAdmin
      .from('talabalar')
      .select('rol')
      .eq('login', userLogin)
      .maybeSingle();
    return data?.rol === 'admin';
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { mode, user_login } = body as { mode?: string; user_login?: string };

    // ── Admin monitoring — server-side rol tekshiruvi ──
    if (mode === 'admin_stats') {
      if (!(await isAdmin(user_login || ''))) {
        return new Response(JSON.stringify({ error: 'Ruxsat yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: stats } = await supabaseAdmin
        .from('fanfaster_ai_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ stats }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'admin_summary') {
      if (!(await isAdmin(user_login || ''))) {
        return new Response(JSON.stringify({ error: 'Ruxsat yo\'q' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: allStats } = await supabaseAdmin
        .from('fanfaster_ai_stats')
        .select('user_login, user_ism, user_rol, rejim, xato, sarflangan_sekund, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      const summary: Record<string, any> = {};
      (allStats || []).forEach((s: any) => {
        const key = s.user_login || 'anonim';
        if (!summary[key]) {
          summary[key] = {
            user_login: s.user_login,
            user_ism: s.user_ism,
            user_rol: s.user_rol,
            savol_soni: 0,
            xato_soni: 0,
            umumiy_vaqt: 0,
            rejimlar: new Set<string>(),
          };
        }
        summary[key].savol_soni++;
        if (s.xato) summary[key].xato_soni++;
        summary[key].umumiy_vaqt += s.sarflangan_sekund || 0;
        if (s.rejim) summary[key].rejimlar.add(s.rejim);
      });

      const result = Object.values(summary).map((s: any) => ({
        ...s,
        rejimlar: [...s.rejimlar],
      }));

      return new Response(JSON.stringify({ summary: result }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Noto\'g\'ri so'rov' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[fanfaster-ai-chat] xato:', msg.slice(0, 200));
    return new Response(JSON.stringify({ error: 'Xatolik yuz berdi' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
