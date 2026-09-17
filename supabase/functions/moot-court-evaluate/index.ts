import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed?.criteria && Array.isArray(parsed.criteria) && typeof parsed.total_score === 'number') {
      return parsed as EvaluationResult;
    }
  } catch {
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
    const { sessionId, debug } = await req.json() as { sessionId: string; debug?: boolean };

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId majburiy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      .select('sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol, difficulty')
      .eq('id', session.case_id)
      .maybeSingle();

    if (!caseData) {
      return new Response(
        JSON.stringify({ error: 'Kazus topilmadi' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const difficulty = caseData.difficulty || 'orta';
    const difficultyLabels: Record<string, string> = {
      yengil: 'Yengil',
      orta: "O'rta",
      qattiq: 'Qattiq',
    };
    const difficultyContext: Record<string, string> = {
      yengil: "Bu YENGIL darajadagi sessiya bo'lgan — AI talabaga yordam beruvchi, yo'naltiruvchi bo'lgan. Shu sababli talabadan yuqori darajadagi mustaqillik kutilmagan. Baholashda shu kontekstni hisobga oling.",
      orta: "Bu O'RTA darajadagi sessiya bo'lgan — AI standart professional darajada savol bergan va e'tiroz bildirgan. Standart baholash mezonlarini qo'llang.",
      qattiq: "Bu QATTIQ darajadagi sessiya bo'lgan — AI juda qattiq, tajribali advokat/sudya kabi talabani qiynagan. Agar talaba past ball olsa, bu tabiiy — qattiq sharoitda ishlagan. overall_comment'da darajani hisobga oling (masalan 'Qattiq daraja sharoitida bu yaxshi natija' kabi).",
    };

    const messages = (session.messages || []) as { role: string; text: string }[];
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Suhbat bo\'sh — baholash mumkin emas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

## Qiyinlik darajasi: ${difficultyLabels[difficulty] || difficultyLabels.orta}
${difficultyContext[difficulty] || difficultyContext.orta}

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

    const { text: aiText, provider } = await callAIWithFallback({
      systemPrompt: evalSystemPrompt,
      messages: [{ role: 'user', text: 'Iltimos, yuqoridagi suhbatni baholang va QAT\'IY JSON formatida javob bering.' }],
      maxTokens: 2000,
      temperature: 0.3,
      jsonMode: true,
      functionName: 'moot-court-evaluate',
    });
    console.log(`[moot-court-evaluate] provider=${provider}`);

    const evaluation = extractJson(aiText);

    if (!evaluation) {
      console.error('[moot-court-evaluate] JSON parse xato:', aiText.slice(0, 500));
      if (debug) {
        return new Response(
          JSON.stringify({ error: 'AI javobi noto\'g\'ri formatda', raw: aiText.slice(0, 2000) }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'AI javobi noto\'g\'ri formatda. Qayta urinib ko\'ring.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
// deploy trigger 1788610507
