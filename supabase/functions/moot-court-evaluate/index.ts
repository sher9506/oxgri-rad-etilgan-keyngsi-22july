import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function loadAiConfig(): Promise<{ apiUrl: string; apiKey: string; model: string }> {
  const { data } = await supabaseAdmin
    .from('settings')
    .select('key, text_value')
    .in('key', ['AI_MENTOR_API_URL', 'AI_MENTOR_API_KEY', 'AI_MENTOR_MODEL']);
  const map: Record<string, string> = {};
  (data || []).forEach((r: any) => { map[r.key] = r.text_value || ''; });
  return {
    apiUrl: map['AI_MENTOR_API_URL'] || '',
    apiKey: map['AI_MENTOR_API_KEY'] || '',
    model: map['AI_MENTOR_MODEL'] || 'gemini-3-flash-preview',
  };
}

interface EvaluationCriteria {
  name: string;
  score: number;
  explanation: string;
}

interface EvaluationResult {
  criteria: EvaluationCriteria[];
  total_score: number;
  overall_comment: string;
}

function extractJson(text: string): EvaluationResult | null {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed?.criteria && Array.isArray(parsed.criteria) && typeof parsed.total_score === 'number') {
      return parsed as EvaluationResult;
    }
  } catch {
    // Try removing markdown code fences
    const cleaned = jsonMatch[0].replace(/```json\s*/g, '').replace(/```\s*/g, '');
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed?.criteria && Array.isArray(parsed.criteria)) return parsed as EvaluationResult;
    } catch {}
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json() as { sessionId: string };

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load session with case details
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from('moot_court_sessions')
      .select('id, case_id, messages, oquvchi_ismi, oquvchi_tomon')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionErr || !session) {
      return new Response(
        JSON.stringify({ error: 'Sessiya topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: caseData } = await supabaseAdmin
      .from('moot_court_cases')
      .select('sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol')
      .eq('id', session.case_id)
      .maybeSingle();

    if (!caseData) {
      return new Response(
        JSON.stringify({ error: 'Kazus topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = (session.messages || []) as { role: string; text: string }[];
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Suhbat bo\'sh — baholash mumkin emas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { apiUrl, apiKey, model } = await loadAiConfig();
    if (!apiUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'AI sozlanmagan' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build conversation transcript
    const transcript = messages.map(m => {
      const speaker = m.role === 'user' ? 'Talaba' : (caseData.ai_rol === 'sudya' ? 'Sudya (AI)' : 'Qarshi tomon (AI)');
      return `${speaker}: ${m.text}`;
    }).join('\n\n');

    const evalSystemPrompt = `Siz huquq fanidan o'quv Moot Court (sud jarayoni simulyatsiyasi) sessiyasini bahovchi ekspert professor sifatida harakat qiling.

Sizga quyidagi ma'lumotlar berilgan:

## Kazus tavsifi:
${caseData.tavsif}

## Tegishli qonun/moddalar:
${caseData.qonun_moddalar || 'Aniq ko\'rsatilmagan'}

## Talabaning tanlagan tomoni:
${session.oquvchi_tomon || 'Tanlanmagan'}

## Suhbat stenogrammasi:
${transcript}

## Baholash mezonlari (har biri 0-2 ball):
1. Qonunga asoslanganlik (0-2): Talaba to'g'ri va aniq qonun moddalariga tayanib argument berganmi?
2. Argumentatsiya tuzilishi (0-2): Fikr mantiqiy izchil, tushunarli va tizimli bayon qilinganmi?
3. Qarshi dalillarga javob qobiliyati (0-2): AI'ning e'tirozlariga qanchalik adekvat va o'z vaqtida javob bergan?
4. Professional til va uslub (0-2): Rasmiy, huquqiy uslubga mos yozganmi?
5. Original/ijodiy yondashuv (0-2): Shablon bo'lmagan, o'ziga xos fikr bildirganmi?

## Qoidalar:
- Har bir mezon uchun 0, 1 yoki 2 ball bering.
- Har bir mezon uchun aniq izoh yozing (nima uchun shu ball berildi).
- total_score = barcha mezon ballari yig'indisi (maksimum 10).
- overall_comment — umumiy izoh va tavsiyalar.
- Javobni QAT'IY JSON formatida bering, boshqa matn yozmang.

## JSON format namunasi:
{
  "criteria": [
    {"name": "Qonunga asoslanganlik", "score": 2, "explanation": "Talaba FK 333 va 331-moddalarga aniq va o'rinli tayandi"},
    {"name": "Argumentatsiya tuzilishi", "score": 1, "explanation": "Fikr tushunarli, lekin xulosa qismi yetarlicha kuchli emas edi"},
    {"name": "Qarshi dalillarga javob qobiliyati", "score": 2, "explanation": "AI e'tirozlariga aniq va mantiqiy javob berdi"},
    {"name": "Professional til va uslub", "score": 1, "explanation": "Asosan rasmiy til ishlatgan, ammo ba'zi so'zlar huquqiy uslubga to'g'ri kelmadi"},
    {"name": "Original/ijodiy yondashuv", "score": 1, "explanation": "Standart argumentlar, o'ziga xos yondashuv kam"}
  ],
  "total_score": 7,
  "overall_comment": "Umumiy yaxshi himoya, ayniqsa qonunga tayanish kuchli edi. Yakuniy xulosani yanada mustahkamlash tavsiya etiladi."
}`;

    const modelPath = model.replace(/^google\//, '');
    const url = `${apiUrl}/${modelPath}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Iltimos, yuqoridagi suhbatni baholang va QAT\'IY JSON formatida javob bering.' }] }],
        systemInstruction: { parts: [{ text: evalSystemPrompt }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      }),
    });

    const txt = await res.text();
    if (!res.ok) {
      console.error('[moot-court-evaluate] AI xato:', res.status, txt.slice(0, 300));
      return new Response(
        JSON.stringify({ error: 'AI baholashda xatolik yuz berdi' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(txt);
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const evaluation = extractJson(aiText);

    if (!evaluation) {
      console.error('[moot-court-evaluate] JSON parse xato:', aiText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: 'AI javobi noto\'g\'ri formatda' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save evaluation to session
    await supabaseAdmin
      .from('moot_court_sessions')
      .update({
        ai_score: evaluation.total_score,
        ai_score_breakdown: evaluation.criteria,
        ai_comment: evaluation.overall_comment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({ evaluation }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[moot-court-evaluate] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Server xatosi: ${msg.slice(0, 150)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
