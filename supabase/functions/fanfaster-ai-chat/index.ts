import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { callAIWithFallback } from '../_shared/ai-provider.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface CitationChunk {
  ref: number;
  material_id: string;
  bolim_id: string;
  bob_id: string;
  bolim_nomi: string;
  bob_nomi: string;
  material_nomi: string;
  chunk_index: number;
  matn: string;
}

// ── Xavfsizlik filtrlari ──────────────────────────────────────────────────────
function isHaramSavol(text: string): boolean {
  return /\b(din|islom|xristian|yahudiy|budda|namoz|ro['']za|haj|qur['']on|injil|tavrot|siyosat|prezident|partiya|saylov|terrorchi|bomb[aа]|qurol|narkotik|giyohvand)\b/i.test(text);
}

function isShaxsiyMalumotSorovi(text: string): boolean {
  return /\b(telefon|tel|raqam|phone|parol|password|login.*parol|access.*token|api.*key|secret|passport|pinfl|inn\b)\b/i.test(text)
    && /\b(ber|ko.rsat|ayt|top|bil|yoz|nima|qanday|qancha)\b/i.test(text);
}

// ── Lexion rejimi uchun system prompt ─────────────────────────────────────────
const LEXION_SYSTEM = `Siz FanFaster huquq ta'lim platformasining AI yordamchisiz — "FanFaster AI Chat" (Lexion rejimi).

## ASOSIY QOIDALAR
- O'zbek tilida, "Siz" murojaat, qisqa va aniq javob bering (3-7 gap)
- Huquqiy savollarga to'g'ridan-to'g'ri bilimingizdan javob bering
- Agar aniq bilmayotgan bo'lsangiz, "Bu masala bo'yicha aniq ma'lumotim yo'q" deb ayt
- Hech qachon mavjud bo'lmagan qonun moddasini o'ylab topmang
- Hech qachon xayoliy faktlar yozmang
- Javoblaringiz professional huquqiy uslubda bo'lsin

## TAQIQLAR
- Din, siyosat, shaxsiy ma'lumotlar haqida gapirmang
- Telefon, parol, login kabi ma'lumotlar bermang
- O'zgartirib bo'lmaydigan qarorlar chiqarmang`;

// ── Manba rejimi uchun system prompt (RAG) ────────────────────────────────────
const MANBA_SYSTEM = `Siz FanFaster huquq ta'lim platformasining AI yordamchisiz — "FanFaster AI Chat" (Manba rejimi).

## ASOSIY QOIDALAR
- O'zbek tilida, "Siz" murojaat, qisqa va aniq javob bering
- FAQAT berilgan darslik mazmunidan (manba) javob bering
- Har bir gap oxiriga [N] raqamini qo'ying (manba havolasi)
- Materialda javob yo'q bo'lsa: "Bu ma'lumot darsliklarimizda topilmadi [0]."
- Matnni qayta yozmang — qisqa xulosa + [N]
- MAX 5 gap

## TAQIQLAR
- Din, siyosat, shaxsiy ma'lumotlar berma
- Hech qachon mavjud bo'lmagan modda raqamini o'ylab topma`;

// ── Citation search (ILIKE + FTS fallback) ────────────────────────────────────
async function citationSearch(savol: string, maxChunks = 5): Promise<CitationChunk[]> {
  const stop = new Set(['va', 'yoki', 'bu', 'u', 'men', 'sen', 'biz', 'siz', 'nima', 'qanday', 'qaysi', 'kim', 'haqida', 'uchun', 'bilan', 'ning', 'ga', 'da', 'dan', 'ni', 'ham', 'ammo', 'lekin', 'chunki', 'agar', 'bir', 'edi', 'bor', 'yo', 'kerak']);

  const rawWords = savol.toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w));

  if (!rawWords.length) return [];

  const finalTerms = [...new Set(rawWords)].slice(0, 10);
  const ilikeConditions = finalTerms.slice(0, 8).map(t => `matn.ilike.%${t}%`).join(',');

  const { data: ilikeData } = await supabaseAdmin
    .from('om_chunks')
    .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn')
    .or(ilikeConditions)
    .limit(maxChunks + 4);

  if (ilikeData && ilikeData.length > 0) {
    const scored = (ilikeData as any[]).map(c => {
      const matn = (c.matn || '').toLowerCase();
      const score = finalTerms.reduce((s, t) => s + (matn.includes(t) ? 1 : 0), 0);
      return { ...c, _score: score };
    }).sort((a, b) => b._score - a._score);
    return scored.slice(0, maxChunks).map((c: any, i: number) => {
      const { _score, ...rest } = c;
      return { ref: i + 1, ...rest } as CitationChunk;
    });
  }

  // FTS fallback
  const tsQuery = finalTerms.slice(0, 6).join(' | ');
  const { data: ftsData } = await supabaseAdmin
    .from('om_chunks')
    .select('id,material_id,bolim_id,bob_id,bolim_nomi,bob_nomi,material_nomi,chunk_index,matn')
    .textSearch('matn', tsQuery, { config: 'simple', type: 'plain' })
    .limit(maxChunks);

  if (ftsData && ftsData.length > 0) {
    return ftsData.slice(0, maxChunks).map((c: any, i: number) => ({ ref: i + 1, ...c })) as CitationChunk[];
  }

  return [];
}

function buildCitationBlok(chunks: CitationChunk[]): string {
  if (!chunks.length) return '\n## DARSLIK MAZMUNI\nHozircha bu mavzu bo\'yicha darslik matni topilmadi.\n\n';
  let b = '\n## DARSLIK MAZMUNI\nQOIDA: Har bir gap oxiriga [N] qo\'y. Matnni QAYTA YOZMA — qisqa xulosa+[N].\n\n';
  chunks.forEach(c => {
    b += `### [${c.ref}] ${c.bolim_nomi} > ${c.bob_nomi} > ${c.material_nomi}\n`;
    b += c.matn.slice(0, 300) + (c.matn.length > 300 ? '...' : '') + '\n\n';
  });
  return b;
}

// ── Queue tizimi ──────────────────────────────────────────────────────────────
async function enqueue(userLogin: string, sessionId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('fanfaster_ai_queue')
    .insert({ user_login: userLogin, session_id: sessionId, status: 'waiting' })
    .select('id')
    .single();
  return data?.id || '';
}

async function updateQueueStatus(queueId: string, status: string) {
  if (!queueId) return;
  await supabaseAdmin
    .from('fanfaster_ai_queue')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', queueId);
}

// ── Statistika saqlash ────────────────────────────────────────────────────────
async function saveStat(params: {
  userLogin: string; userIsm: string; userRol: string; rejim: string;
  savolMatn: string; javobMatn: string; xato: boolean; xatoMatn?: string;
  sarflanganSekund: number; sessionId: string;
}) {
  try {
    await supabaseAdmin.from('fanfaster_ai_stats').insert({
      user_login: params.userLogin,
      user_ism: params.userIsm,
      user_rol: params.userRol,
      rejim: params.rejim,
      savol_matn: params.savolMatn.slice(0, 200),
      javob_matn: params.javobMatn.slice(0, 500),
      xato: params.xato,
      xato_matn: params.xatoMatn || null,
      sarflangan_sekund: params.sarflanganSekund,
      session_id: params.sessionId,
    });
  } catch (e) {
    console.warn('[fanfaster-ai-chat] stat saqlash xato:', e);
  }
}

// ── Sessiya yangilash ─────────────────────────────────────────────────────────
async function updateSession(sessionId: string, messages: ChatMessage[], savolSoni: number, sarflanganVaqt: number) {
  try {
    await supabaseAdmin
      .from('fanfaster_ai_sessions')
      .update({
        messages: JSON.stringify(messages),
        savol_soni: savolSoni,
        sarflangan_vaqt_sekund: sarflanganVaqt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  } catch (e) {
    console.warn('[fanfaster-ai-chat] sessiya yangilash xato:', e);
  }
}

// ── Edge function ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      messages, rejim, userLogin, userIsm, userRol,
      sessionId, mode,
    } = body as {
      messages: ChatMessage[];
      rejim?: 'lexion' | 'manba';
      userLogin?: string;
      userIsm?: string;
      userRol?: string;
      sessionId?: string;
      mode?: string;
    };

    // ── Admin monitoring mode ─────────────────────────────────────────────────
    if (mode === 'admin_stats') {
      const { data: stats } = await supabaseAdmin
        .from('fanfaster_ai_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ stats }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (mode === 'admin_summary') {
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

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "messages bo'sh" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const chatRejim = rejim || 'lexion';
    const lastText = messages.filter(m => m.role === 'user').at(-1)?.text || '';

    // ── Xavfsizlik filtri ─────────────────────────────────────────────────────
    if (isHaramSavol(lastText) || isShaxsiyMalumotSorovi(lastText)) {
      const xavfsizJavob = isShaxsiyMalumotSorovi(lastText)
        ? 'Shaxsiy ma\u2019lumotlar (telefon, parol, login va h.k.) xavfsizlik sababli berilmaydi.'
        : 'Uzr, bu mavzu bo\u2019yicha yordam bera olmayman.';

      // Statistikaga yozish
      if (sessionId) {
        await saveStat({
          userLogin: userLogin || 'anonim', userIsm: userIsm || '', userRol: userRol || 'oquvchi',
          rejim: chatRejim, savolMatn: lastText, javobMatn: xavfsizJavob, xato: false,
          sarflanganSekund: 0, sessionId,
        });
      }

      return new Response(JSON.stringify({ reply: xavfsizJavob, rejim: chatRejim, rejected: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── Navbatga qo'shish ─────────────────────────────────────────────────────
    let queueId = '';
    if (sessionId && userLogin) {
      queueId = await enqueue(userLogin, sessionId);
    }

    const startTime = Date.now();

    try {
      let systemPrompt: string;
      let citationMeta: any[] | null = null;

      if (chatRejim === 'manba') {
        // ── Manba rejimi: RAG orqali ─────────────────────────────────────────
        const chunks = await citationSearch(lastText, 5);
        const citBlok = buildCitationBlok(chunks);
        systemPrompt = `${MANBA_SYSTEM}\n${citBlok}`;
        citationMeta = chunks.length > 0 ? chunks.map(c => ({
          ref: c.ref, material_id: c.material_id, bolim_id: c.bolim_id,
          bob_id: c.bob_id, bolim_nomi: c.bolim_nomi, bob_nomi: c.bob_nomi,
          material_nomi: c.material_nomi,
        })) : null;
      } else {
        // ── Lexion rejimi: to'g'ridan-to'g'ri ────────────────────────────────
        systemPrompt = LEXION_SYSTEM;
      }

      const { text: aiReply } = await callAIWithFallback({
        systemPrompt,
        messages,
        maxTokens: 1500,
        temperature: 0.5,
        functionName: 'fanfaster-ai-chat',
      });

      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // ── Sessiya yangilash ───────────────────────────────────────────────────
      if (sessionId) {
        const allMessages = [...messages, { role: 'assistant' as const, text: aiReply }];
        const savolSoni = allMessages.filter(m => m.role === 'user').length;
        await updateSession(sessionId, allMessages, savolSoni, elapsed);
        await saveStat({
          userLogin: userLogin || 'anonim', userIsm: userIsm || '', userRol: userRol || 'oquvchi',
          rejim: chatRejim, savolMatn: lastText, javobMatn: aiReply, xato: false,
          sarflanganSekund: elapsed, sessionId,
        });
      }

      // ── Navbatni yakunlash ──────────────────────────────────────────────────
      await updateQueueStatus(queueId, 'done');

      return new Response(JSON.stringify({
        reply: aiReply,
        rejim: chatRejim,
        citationMeta,
        elapsed,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (aiError: any) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);

      // Statistikaga xato yozish
      if (sessionId) {
        await saveStat({
          userLogin: userLogin || 'anonim', userIsm: userIsm || '', userRol: userRol || 'oquvchi',
          rejim: chatRejim, savolMatn: lastText, javobMatn: '', xato: true, xatoMatn: errMsg.slice(0, 200),
          sarflanganSekund: elapsed, sessionId,
        });
      }

      await updateQueueStatus(queueId, 'error');

      console.error('[fanfaster-ai-chat] AI xato:', errMsg.slice(0, 200));

      const friendlyMsg = errMsg.includes('402') || errMsg.includes('429')
        ? 'AI yordamchi vaqtincha band. Iltimos, bir necha daqiqadan so\'ng qayta urinib ko\'ring.'
        : 'AI javob berishda xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.';

      return new Response(JSON.stringify({
        reply: friendlyMsg,
        rejim: chatRejim,
        error: true,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[fanfaster-ai-chat] tashqi xato:', msg.slice(0, 200));
    return new Response(JSON.stringify({ error: `Xatolik: ${msg.slice(0, 150)}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
