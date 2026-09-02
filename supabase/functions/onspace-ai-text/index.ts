import { corsHeaders } from '../_shared/cors.ts';

const ONSPACE_AI_API_KEY = Deno.env.get('ONSPACE_AI_API_KEY');
const ONSPACE_AI_BASE_URL = Deno.env.get('ONSPACE_AI_BASE_URL');

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model = 'gpt-4o-mini', temperature = 0.7 } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OnSpace AI API'ga murojaat
    const response = await fetch(`${ONSPACE_AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ONSPACE_AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OnSpace AI Error:', response.status, errorText);
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ reply: '⚠️ AI vaqtincha ishlamayapti. Iltimos, keyinroq urinib ko\'ring.', error: null, _unavailable: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `OnSpace AI: ${response.status} - ${errorText.slice(0, 200)}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
