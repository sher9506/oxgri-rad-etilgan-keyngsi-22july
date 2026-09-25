import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// ─── NORMALIZATSIYA ───────────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ʻʼ'’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeModdaRaqam(raqam: string): string {
  return raqam
    .replace(/\s+/g, '')
    .replace(/[ʻʼ'’‘`]/g, "'")
    .replace(/[²³]/g, (m) => m === '²' ? '2' : '3')
    .toLowerCase();
}

// ─── STEP 1: AI NOMZODLARI ────────────────────────────────────────────────────
interface AINomzod {
  qonun_kodi: string;
  modda_raqami: string;
  kalit_sozlar: string[];
  tushuncha: string;
  bolim_bob: string;
  nega_kerak: string;
}

interface AIResponse {
  nomzodlar: AINomzod[];
}

function extractJsonFromAI(text: string): AIResponse | null {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed?.nomzodlar && Array.isArray(parsed.nomzodlar)) return parsed;
  } catch {}

  // Extract JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const cleaned = jsonMatch[0].replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const parsed = JSON.parse(cleaned);
    if (parsed?.nomzodlar && Array.isArray(parsed.nomzodlar)) return parsed;
  } catch {}
  return null;
}

async function step1_AINomzodlar(
  kazusMatn: string,
  qonunlarRoxyati: { kod: string; nom: string }[]
): Promise<{ nomzodlar: AINomzod[]; model: string; tokens: any }> {
  const qonunlarStr = qonunlarRoxyati.map(q => `- ${q.kod}: ${q.nom}`).join('\n');

  const systemPrompt = `Siz huquq ekspertisiz. Vazifangiz — berilgan kazus matni uchun tegishli qonun moddalarini nomzod qilib ko'rsatish.

QOIDALAR:
1. Faqat ro'yxatdagi qonun kodlaridan tanlang. Ro'yxatda yo'q qonunni o'ylab topmang.
2. Agar kazusga mos qonun ro'yxatda bo'lmasa, "qonun kiritilmagan" deb javob bering.
3. 12 ta nomzod bering. Imkon qadar har xil qonunlardan; kazus bitta qonunga oid bo'lsa, hammasi shu qonundan bo'lishi mumkin.
4. Har nomzod uchun:
   - qonun_kodi: ro'yxatdagi kod
   - modda_raqami: taxminiy modda raqami (string)
   - kalit_sozlar: 3-5 ta kalit so'z (moddaning asosiy tushunchasi)
   - tushuncha: 1 gaplik modda mazmuni
   - bolim_bob: taxminiy bob/bo'lim nomi
   - nega_kerak: 1 gap — bu modda kazusga nega tegishli
5. Modda sarlavhasini so'zma-so'z yozmang, modda matnini yozmang.
6. Javob QAT'IY JSON formatida bo'lsin.

JSON format:
{
  "nomzodlar": [
    {
      "qonun_kodi": "JK",
      "modda_raqami": "105",
      "kalit_sozlar": ["odam o'ldirish", "qasddan", "jazo"],
      "tushuncha": "Qasddan odam o'ldirish uchun javobgarlik",
      "bolim_bob": "Jinoyatga qarshi jinoyatlar",
      "nega_kerak": "Kazusdagi shaxs qasddan odam o'ldirgan"
    }
  ]
}

Mavjud qonunlar ro'yxati:
${qonunlarStr}

Agar bu kazusga mos qonun ro'yxatda yo'q bo'lsa:
{
  "nomzodlar": []
}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
    maxTokens: 2000,
    temperature: 0.3,
    jsonMode: true,
    functionName: 'case-research-step1',
  });

  const parsed = extractJsonFromAI(text);
  if (!parsed || !parsed.nomzodlar) {
    return { nomzodlar: [], model: provider, tokens: { input: 0, output: 0 } };
  }

  return {
    nomzodlar: parsed.nomzodlar.slice(0, 12),
    model: provider,
    tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
  };
}

// ─── STEP 2: TASDIQLASH (AI'siz, faqat bazadan) ───────────────────────────────
interface ModdaNatija {
  modda_raqami: string;
  sarlavha: string;
  bob_nomi: string;
  matn: string;
  lex_element_id: string | null;
  ball: number;
}

interface NomzodNatija {
  ai_nomzod: AINomzod;
  raqam_topildi: boolean;
  matn_top3: ModdaNatija[];
  hukm: 'tolliq_mos' | 'faqat_matn_mos' | 'faqat_raqam_mos' | 'topilmadi' | 'qonun_kiritilmagan';
  tasdiqlangan: ModdaNatija | null;
}

// So'z ozaklari bo'yicha ball berish
function sozOzaklari(soz: string): string[] {
  return soz
    .toLowerCase()
    .replace(/[ʻʼ'’‘`]/g, "'")
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w.replace(/^(nit|nik|ning|dan|ga|da|ni|ka)$/g, ''));
}

function sozOzakKesishma(aiSozlar: string[], dbSozlar: string[]): number {
  let kesishma = 0;
  for (const aiW of aiSozlar) {
    for (const dbW of dbSozlar) {
      if (dbW.startsWith(aiW) || aiW.startsWith(dbW)) {
        kesishma++;
        break;
      }
    }
  }
  return kesishma;
}

async function step2_Tasdiqlash(
  nomzodlar: AINomzod[],
  qonunlarRoxyati: { kod: string; nom: string }[]
): Promise<{ natijalar: NomzodNatija[]; tasdiqlanganlar: NomzodNatija[] }> {
  const natijalar: NomzodNatija[] = [];

  for (const nomzod of nomzodlar) {
    // Qonun ro'yxatda bormi?
    const qonunBor = qonunlarRoxyati.some(q => q.kod.toUpperCase() === nomzod.qonun_kodi.toUpperCase());
    if (!qonunBor) {
      natijalar.push({
        ai_nomzod: nomzod,
        raqam_topildi: false,
        matn_top3: [],
        hukm: 'qonun_kiritilmagan',
        tasdiqlangan: null,
      });
      continue;
    }

    const qonunKod = nomzod.qonun_kodi.toUpperCase();
    const aiRaqamKey = normalizeModdaRaqam(nomzod.modda_raqami);

    // (a) Modda raqami bo'yicha qidirish
    let raqamNatija: any = null;
    if (aiRaqamKey) {
      const { data: raqamData } = await supabaseAdmin
        .from('qonun_moddalari_v2')
        .select('id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id')
        .eq('qonun_kodi', qonunKod)
        .ilike('modda_raqami', `${nomzod.modda_raqami}%`)
        .limit(3);
      raqamNatija = raqamData && raqamData.length > 0 ? raqamData[0] : null;
    }

    // (b) Kalit so'zlar + tushuncha bo'yicha qidirish
    const kalitSozlar = [...(nomzod.kalit_sozlar || []), nomzod.tushuncha || '']
      .join(' ');
    const aiOzaklar = sozOzaklari(kalitSozlar);

    const { data: textData } = await supabaseAdmin
      .from('qonun_moddalari_v2')
      .select('id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id')
      .eq('qonun_kodi', qonunKod)
      .limit(500);

    let matnTop3: ModdaNatija[] = [];
    if (textData && textData.length > 0) {
      const scored = textData.map((m: any) => {
        const dbOzaklar = sozOzaklari(`${m.sarlavha || ''} ${m.matn_normal || m.matn || ''}`);
        let ball = sozOzakKesishma(aiOzaklar, dbOzaklar);
        // bolim_bob mos kelsa qo'shimcha ball
        if (nomzod.bolim_bob && m.bob_nomi) {
          const bobNorm = normalizeText(nomzod.bolim_bob);
          const dbBobNorm = normalizeText(m.bob_nomi);
          if (bobNorm && dbBobNorm) {
            const bobOzaklar = sozOzaklari(nomzod.bolim_bob);
            const dbBobOzaklar = sozOzaklari(m.bob_nomi);
            ball += sozOzakKesishma(bobOzaklar, dbBobOzaklar) * 2;
          }
        }
        return {
          modda_raqami: m.modda_raqami,
          sarlavha: m.sarlavha || '',
          bob_nomi: m.bob_nomi || '',
          matn: m.matn || '',
          lex_element_id: m.lex_element_id || null,
          ball,
        };
      })
      .filter((m: ModdaNatija) => m.ball > 0)
      .sort((a: ModdaNatija, b: ModdaNatija) => b.ball - a.ball)
      .slice(0, 3);
      matnTop3 = scored;
    }

    // Hukm chiqarish
    let hukm: NomzodNatija['hukm'] = 'topilmadi';
    let tasdiqlangan: ModdaNatija | null = null;

    if (raqamNatija && matnTop3.length > 0) {
      // To'liq mos: raqam bo'yicha topilgan modda matn top-3 ichida bormi?
      const raqamInTop3 = matnTop3.some(
        m => normalizeModdaRaqam(m.modda_raqami) === normalizeModdaRaqam(raqamNatija.modda_raqami)
      );
      if (raqamInTop3) {
        hukm = 'tolliq_mos';
        tasdiqlangan = matnTop3.find(
          m => normalizeModdaRaqam(m.modda_raqami) === normalizeModdaRaqam(raqamNatija.modda_raqami)
        ) || null;
      } else {
        // Faqat raqam mos, matn top-3 da yo'q — gumonli
        hukm = 'faqat_raqam_mos';
        tasdiqlangan = {
          modda_raqami: raqamNatija.modda_raqami,
          sarlavha: raqamNatija.sarlavha || '',
          bob_nomi: raqamNatija.bob_nomi || '',
          matn: raqamNatija.matn || '',
          lex_element_id: raqamNatija.lex_element_id || null,
          ball: 0,
        };
      }
    } else if (matnTop3.length > 0) {
      // Faqat matn mos
      hukm = 'faqat_matn_mos';
      tasdiqlangan = matnTop3[0];
    } else if (raqamNatija) {
      hukm = 'faqat_raqam_mos';
      tasdiqlangan = {
        modda_raqami: raqamNatija.modda_raqami,
        sarlavha: raqamNatija.sarlavha || '',
        bob_nomi: raqamNatija.bob_nomi || '',
        matn: raqamNatija.matn || '',
        lex_element_id: raqamNatija.lex_element_id || null,
        ball: 0,
      };
    }

    natijalar.push({
      ai_nomzod: nomzod,
      raqam_topildi: !!raqamNatija,
      matn_top3: matnTop3,
      hukm,
      tasdiqlangan,
    });
  }

  // Eng ko'pi 8 ta tasdiqlangan modda olish
  // Prioritet: tolliq_mos → faqat_matn_mos → faqat_raqam_mos (faqat 8 ta yetmasa)
  const sorted = [...natijalar].sort((a, b) => {
    const priority: Record<string, number> = {
      tolliq_mos: 0,
      faqat_matn_mos: 1,
      faqat_raqam_mos: 2,
      topilmadi: 3,
      qonun_kiritilmagan: 4,
    };
    return priority[a.hukm] - priority[b.hukm];
  });

  const tasdiqlanganlar = sorted
    .filter(n => n.tasdiqlangan && (n.hukm === 'tolliq_mos' || n.hukm === 'faqat_matn_mos'))
    .slice(0, 8);

  // Agar 8 ta yetmasa, gumonlilarni qo'sh
  if (tasdiqlanganlar.length < 8) {
    const gumonlilar = sorted
      .filter(n => n.hukm === 'faqat_raqam_mos' && n.tasdiqlangan)
      .slice(0, 8 - tasdiqlanganlar.length);
    tasdiqlanganlar.push(...gumonlilar);
  }

  return { natijalar, tasdiqlanganlar };
}

// ─── STEP 3: NAMUNAVIY JAVOB (2-AI chaqiruv) ──────────────────────────────────
async function step3_NamunaviyJavob(
  kazusMatn: string,
  tasdiqlanganlar: NomzodNatija[]
): Promise<{ javob: string; model: string; tokens: any }> {
  if (tasdiqlanganlar.length === 0) {
    // Tasdiqlangan modda yo'q — umumiy javob
    const systemPrompt = `Siz huquq ekspertisiz. Berilgan kazus uchun umumiy huquqiy bilim asosida namunaviy javob bering. Hech qachon aniq modda raqamini keltirmang — "umumiy huquqiy bilim asosida" deb yozing. Javob 3-5 paragrafdan oshmasin. O'zbek tilida, professional huquqiy uslubda yozing.`;

    const { text, provider } = await callAIWithFallback({
      systemPrompt,
      messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
      maxTokens: 1500,
      temperature: 0.4,
      functionName: 'case-research-step3-no-articles',
    });

    return {
      javob: text,
      model: provider,
      tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
    };
  }

  // Tasdiqlangan moddalar matnini berish
  const moddalarStr = tasdiqlanganlar
    .map((n, i) => {
      const m = n.tasdiqlangan!;
      return `### Modda ${i + 1}: ${n.ai_nomzod.qonun_kodi} ${m.modda_raqami}-modda
Sarlavha: ${m.sarlavha}
Bob: ${m.bob_nomi}
Matn: ${m.matn}`;
    })
    .join('\n\n');

  const systemPrompt = `Siz huquq ekspertisiz. Berilgan kazus uchun namunaviy javob shakllantiring.

QOIDALAR:
1. Faqat berilgan moddalarga tayaning. Boshqa modda raqamini o'ylab topmang.
2. Javobda qaysi moddalar qo'llanilganini, nega va xulosani yozing.
3. Agar berilgan moddalar yetarli bo'lmasa, "bu masala bo'yicha aniq modda tasdiqlanmadi" deb ochiq aytting.
4. Javob 3-5 paragrafdan oshmasin.
5. O'zbek tilida, professional huquqiy uslubda yozing.

Tasdiqlangan moddalar:
${moddalarStr}`;

  const { text, provider } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: 'user', text: `Kazus matni:\n\n${kazusMatn}` }],
    maxTokens: 1500,
    temperature: 0.4,
    functionName: 'case-research-step3',
  });

  return {
    javob: text,
    model: provider,
    tokens: { input: systemPrompt.length + kazusMatn.length, output: text.length },
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { caseId, action } = await req.json() as { caseId: string; action?: 'run' | 'status' };

    if (!caseId) {
      return new Response(JSON.stringify({ error: 'caseId majburiy' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Kazusni olish
    const { data: caseData, error: caseErr } = await supabaseAdmin
      .from('moot_court_cases')
      .select('id, sarlavha, tavsif, tadqiqot_holati, tasdiqlangan_moddalar, namunaviy_javob')
      .eq('id', caseId)
      .maybeSingle();

    if (caseErr || !caseData) {
      return new Response(JSON.stringify({ error: 'Kazus topilmadi' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Status so'ralgan bo'lsa, faqat holatni qaytarish
    if (action === 'status') {
      return new Response(JSON.stringify({
        holat: caseData.tadqiqot_holati || 'kutmoqda',
        tasdiqlangan_moddalar: caseData.tasdiqlangan_moddalar || [],
        namunaviy_javob: caseData.namunaviy_javob || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pipeline'ni ishga tushirish
    console.log(`[case-research] Boshlandi: caseId=${caseId} sarlavha=${caseData.sarlavha}`);

    // Holatni 'jarayonda' ga o'tkazish
    await supabaseAdmin
      .from('moot_court_cases')
      .update({ tadqiqot_holati: 'jarayonda', updated_at: new Date().toISOString() })
      .eq('id', caseId);

    // Jurnal yozuvi yaratish
    const { data: jurnalRow } = await supabaseAdmin
      .from('qidiruv_jurnali')
      .insert({
        case_id: caseId,
        case_sarlavha: caseData.sarlavha,
        holat: 'jarayonda',
      })
      .select()
      .single();

    const jurnalId = jurnalRow?.id;

    try {
      // Qonunlar ro'yxatini olish
      const { data: qonunlarData } = await supabaseAdmin
        .from('qonunlar')
        .select('kod, nom')
        .order('kod');

      const qonunlar = (qonunlarData || []).map((q: any) => ({ kod: q.kod, nom: q.nom }));

      if (qonunlar.length === 0) {
        throw new Error('Bazada qonun yo\'q. Avval Lex.uz qidiruvchisidan qonun qo\'shing.');
      }

      // ── STEP 1: AI nomzodlari ──
      console.log(`[case-research] Step 1: AI nomzodlari...`);
      const step1Result = await step1_AINomzodlar(caseData.tavsif || '', qonunlar);
      console.log(`[case-research] Step 1 done: ${step1Result.nomzodlar.length} ta nomzod, model=${step1Result.model}`);

      if (step1Result.nomzodlar.length === 0) {
        // AI qonun topmadi
        await supabaseAdmin
          .from('moot_court_cases')
          .update({
            tadqiqot_holati: 'qisman',
            tasdiqlangan_moddalar: [],
            namunaviy_javob: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', caseId);

        if (jurnalId) {
          await supabaseAdmin
            .from('qidiruv_jurnali')
            .update({
              holat: 'qisman',
              nomzodlar: [],
              ai1_model: step1Result.model,
              ai1_tokens: step1Result.tokens,
              updated_at: new Date().toISOString(),
            })
            .eq('id', jurnalId);
        }

        return new Response(JSON.stringify({
          success: true,
          holat: 'qisman',
          message: 'AI hech qanday qonun nomzod bermadi. Bazada qonunlar to\'liq emas.',
          step1: { nomzodlar: [], model: step1Result.model },
          step2: { natijalar: [], tasdiqlanganlar: [] },
          step3: { javob: null, model: null },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── STEP 2: Tasdiqlash ──
      console.log(`[case-research] Step 2: Tasdiqlash...`);
      const step2Result = await step2_Tasdiqlash(step1Result.nomzodlar, qonunlar);
      console.log(`[case-research] Step 2 done: ${step2Result.tasdiqlanganlar.length} ta tasdiqlangan`);

      // ── STEP 3: Namunaviy javob ──
      console.log(`[case-research] Step 3: Namunaviy javob...`);
      const step3Result = await step3_NamunaviyJavob(caseData.tavsif || '', step2Result.tasdiqlanganlar);
      console.log(`[case-research] Step 3 done: model=${step3Result.model}`);

      // Hukm tarqatishni hisoblash
      const hukmTarqatish: Record<string, number> = {};
      for (const n of step2Result.natijalar) {
        hukmTarqatish[n.hukm] = (hukmTarqatish[n.hukm] || 0) + 1;
      }

      const jamiToken = (step1Result.tokens.input + step1Result.tokens.output) +
        (step3Result.tokens.input + step3Result.tokens.output);

      // Kazusni yangilash
      const tasdiqlanganJson = step2Result.tasdiqlanganlar.map(n => ({
        qonun_kodi: n.ai_nomzod.qonun_kodi,
        modda_raqami: n.tasdiqlangan!.modda_raqami,
        sarlavha: n.tasdiqlangan!.sarlavha,
        bob_nomi: n.tasdiqlangan!.bob_nomi,
        matn: n.tasdiqlangan!.matn,
        lex_element_id: n.tasdiqlangan!.lex_element_id,
        hukm: n.hukm,
        kalit_sozlar: n.ai_nomzod.kalit_sozlar,
        nega_kerak: n.ai_nomzod.nega_kerak,
      }));

      const holat = step2Result.tasdiqlanganlar.length > 0 ? 'tayyor' : 'qisman';

      await supabaseAdmin
        .from('moot_court_cases')
        .update({
          tadqiqot_holati: holat,
          tasdiqlangan_moddalar: JSON.parse(JSON.stringify(tasdiqlanganJson)),
          namunaviy_javob: step3Result.javob,
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseId);

      // Jurnalni yangilash
      if (jurnalId) {
        await supabaseAdmin
          .from('qidiruv_jurnali')
          .update({
            holat,
            nomzodlar: JSON.parse(JSON.stringify(step1Result.nomzodlar)),
            tasdiqlangan_moddalar: JSON.parse(JSON.stringify(tasdiqlanganJson)),
            namunaviy_javob: step3Result.javob,
            ai1_model: step1Result.model,
            ai1_tokens: step1Result.tokens,
            ai2_model: step3Result.model,
            ai2_tokens: step3Result.tokens,
            hukm_tarqatish: JSON.parse(JSON.stringify(hukmTarqatish)),
            jami_token: jamiToken,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jurnalId);
      }

      console.log(`[case-research] Tugadi: holat=${holat}, tasdiqlangan=${tasdiqlanganJson.length}`);

      return new Response(JSON.stringify({
        success: true,
        holat,
        step1: {
          nomzodlar: step1Result.nomzodlar,
          model: step1Result.model,
          tokens: step1Result.tokens,
        },
        step2: {
          natijalar: step2Result.natijalar.map(n => ({
            ai_nomzod: n.ai_nomzod,
            raqam_topildi: n.raqam_topildi,
            matn_top3: n.matn_top3,
            hukm: n.hukm,
            tasdiqlangan: n.tasdiqlangan,
          })),
          tasdiqlanganlar: tasdiqlanganJson,
        },
        step3: {
          javob: step3Result.javob,
          model: step3Result.model,
          tokens: step3Result.tokens,
        },
        hukm_tarqatish: hukmTarqatish,
        jami_token: jamiToken,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (innerErr) {
      // Pipeline xatosi
      console.error('[case-research] pipeline xato:', innerErr);
      const errMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);

      await supabaseAdmin
        .from('moot_court_cases')
        .update({ tadqiqot_holati: 'xato', updated_at: new Date().toISOString() })
        .eq('id', caseId);

      if (jurnalId) {
        await supabaseAdmin
          .from('qidiruv_jurnali')
          .update({ holat: 'xato', updated_at: new Date().toISOString() })
          .eq('id', jurnalId);
      }

      return new Response(JSON.stringify({
        success: false,
        holat: 'xato',
        error: errMsg.slice(0, 300),
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    console.error('[case-research] xato:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg.slice(0, 300) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
