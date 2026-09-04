import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { token, method, body } = await req.json();

    if (!token || !method) {
      return new Response(
        JSON.stringify({ ok: false, description: 'token va method majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowed = ['getMe', 'setWebhook', 'getWebhookInfo', 'deleteWebhook', 'sendMessage', 'sendPhoto', 'answerCallbackQuery', 'getChat', 'getChatMember'];
    if (!allowed.includes(method)) {
      return new Response(
        JSON.stringify({ ok: false, description: `Method '${method}' ruxsat etilmagan` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = `https://api.telegram.org/bot${token}/${method}`;
    const fetchOpts: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    if (body) fetchOpts.body = JSON.stringify(body);

    const res = await fetch(url, fetchOpts);
    const data = await res.json();

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, description: e.message || 'Server xatosi' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
