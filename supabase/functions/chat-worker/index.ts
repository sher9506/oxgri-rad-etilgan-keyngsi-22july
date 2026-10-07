import { createClient } from "npm:@supabase/supabase-js@2";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const CHAT_MAX_CONCURRENCY = 3;
const MAX_SAVOL_LENGTH = 12000;

// ── Helpers (ported from case-research, simplified) ──────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ʻʼ'’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "va", "ham", "bilan", "uchun", "bor", "har", "bu", "shu", "u", "ular",
    "bir", "emas", "edi", "kerak", "lozim", "the", "and", "for", "is", "are",
    "qanday", "nima", "qiladi", "qilgan", "sud", "sudga", "sudda",
    "shaxs", "shaxsning", "yoki", "lekin", "ammo", "chunki", "faqat",
    "keyin", "so'ng", "hamda", "yana", "ko'ra", "kishi", "holat",
    "qaror", "qarori", "soat", "kuni", "yil", "kun", "hozir", "qilib",
    "qarab", "tomonidan", "orqali", "bundan", "buni", "uni", "men", "sen",
    "biz", "siz", "uning", "endi", "faqat", "gina",
  ]);
  function stem(word: string): string {
    return word
      .replace(/(larini|lardan|larga|larda|lardir|lar)$/i, "")
      .replace(/(ningdan|ningga|ningni|ningda|ning)$/i, "")
      .replace(/(ini|idan|iga|ida|idan|iga|ida)$/i, "")
      .replace(/(dan|ga|da|ni|ka|ki|qa)$/i, "")
      .replace(/(lar|lar|lar)$/i, "");
  }
  return normalizeText(text)
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .map((w) => stem(w))
    .filter((w) => w.length >= 3 && !stopWords.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .slice(0, 25);
}

function extractJsonFromAI(text: string): any | null {
  try { return JSON.parse(text); } catch {}
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()); } catch {}
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const cleaned = jsonMatch[0].replace(/```json\s*/g, "").replace(/```\s*/g, "");
    return JSON.parse(cleaned);
  } catch {}
  try {
    const cleaned = jsonMatch[0]
      .replace(/```json\s*/g, "").replace(/```\s*/g, "")
      .replace(/,\s*([}\]])/g, "$1").replace(/'/g, '"');
    return JSON.parse(cleaned);
  } catch {}
  return null;
}

// ── Stage 0: Identify relevant qonun codes ──────────────────────────────────
async function stage0_QonunAniqlash(
  savolMatn: string,
  qonunlar: { kod: string; nom: string }[]
): Promise<string[]> {
  const qonunlarStr = qonunlar.map((q) => `- ${q.kod}: ${q.nom}`).join("\n");
  const systemPrompt = `Siz huquq ekspertisiz. Berilgan savol/kazus matnini o'qib,
quyidagi ro'yxatdagi qaysi qonun kodekslari unga tegishli ekanligini aniqlang.

Mavjud qonunlar ro'yxati:
${qonunlarStr}

QOIDALAR:
1. Kazus bir nechta huquq sohasiga tegishli bo'lishi mumkin.
2. 1 dan 3 gacha eng tegishli qonun kodini tanlang.
3. Ro'yxatda yo'q nomni o'ylab topmang.
4. Javob QAT'IY JSON formatida: {"qonunlar": ["KOD1", "KOD2"]}`;

  const { text } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: "user", text: savolMatn }],
    maxTokens: 300,
    temperature: 0.2,
    jsonMode: true,
    functionName: "chat-worker-stage0",
  });

  const parsed = extractJsonFromAI(text);
  const kodlar = parsed?.qonunlar && Array.isArray(parsed.qonunlar)
    ? parsed.qonunlar.filter((k: string) =>
        qonunlar.some((q) => q.kod.toUpperCase() === k.toUpperCase())
      ).map((k: string) => k.toUpperCase())
    : [];

  return kodlar.length > 0 ? kodlar : qonunlar.slice(0, 3).map((q) => q.kod.toUpperCase());
}

// ── Stage 1: FTS + ILIKE search for candidate moddalar ──────────────────────
async function stage1_Qidiruv(
  qonunKodi: string,
  savolMatn: string,
  kalitSozlar: string[]
): Promise<{ modda_raqami: string; sarlavha: string; bob_nomi: string; matn: string; lex_element_id: string | null }[]> {
  const allKeywords = [...new Set([...extractKeywords(savolMatn), ...kalitSozlar])].slice(0, 30);

  // FTS
  const { data: ftsData } = await supabaseAdmin.rpc("search_moddalar_v2_fts", {
    p_qonun_kodi: qonunKodi,
    p_keywords: allKeywords,
    p_limit_count: 20,
  });

  let moddalar: any[] = [];
  if (ftsData) moddalar = ftsData as any[];

  // ILIKE fallback
  if (moddalar.length < 8) {
    const topWords = allKeywords.filter((w) => w.length >= 4).slice(0, 6);
    if (topWords.length > 0) {
      const ilikeConds = topWords.map((w) => `matn.ilike.%${w}%`).join(",");
      const { data: ilikeData } = await supabaseAdmin
        .from("qonun_moddalari_v2")
        .select("id, modda_raqami, sarlavha, bob_nomi, matn, lex_element_id")
        .eq("qonun_kodi", qonunKodi)
        .or(ilikeConds)
        .limit(20);
      if (ilikeData) {
        const existingIds = new Set(moddalar.map((m) => m.id));
        for (const m of ilikeData) {
          if (!existingIds.has(m.id)) moddalar.push(m);
        }
      }
    }
  }

  return moddalar.slice(0, 25).map((m) => ({
    modda_raqami: m.modda_raqami,
    sarlavha: m.sarlavha || "",
    bob_nomi: m.bob_nomi || "",
    matn: m.matn || "",
    lex_element_id: m.lex_element_id || null,
  }));
}

// ── Stage 2: AI verification of candidate moddalar ──────────────────────────
async function stage2_Tasdiqlash(
  savolMatn: string,
  nomzodlar: { qonun_kodi: string; modda_raqami: string; sarlavha: string; bob_nomi: string; matn: string }[]
): Promise<{ qonun_kodi: string; modda_raqami: string; sarlavha: string; matn: string; ball: number; asoslash: string }[]> {
  if (nomzodlar.length === 0) return [];

  const moddalarStr = nomzodlar.slice(0, 20).map((n, i) => {
    const matnShort = n.matn.length > 500 ? n.matn.slice(0, 500) + "..." : n.matn;
    return `### Modda ${i + 1}: ${n.qonun_kodi} ${n.modda_raqami}-modda\nSarlavha: ${n.sarlavha}\nBob: ${n.bob_nomi}\nMatn: ${matnShort}`;
  }).join("\n\n");

  const systemPrompt = `Siz huquq ekspertisiz. Quyida savol/kazus matni va unga oid
bo'lishi mumkin bo'lgan qonun moddalari berilgan. Har bir modda uchun 0-10 ball bering.
Ball 6+ = kuchli aloqador. Javob JSON: {"baholar": [{"indeks": 1, "ball": 9, "asoslash": "..."}]}

Kazus matni:
${savolMatn}

Moddalar:
${moddalarStr}`;

  const { text } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: "user", text: "Baholashni boshlang. Faqat JSON qaytaring." }],
    maxTokens: 3000,
    temperature: 0.2,
    jsonMode: true,
    functionName: "chat-worker-stage2",
  });

  const parsed = extractJsonFromAI(text);
  const baholar: any[] = (() => {
    if (!parsed) return [];
    if (Array.isArray(parsed)) return parsed;
    for (const key of ["baholar", "moddalar", "results", "items"]) {
      if (parsed[key] && Array.isArray(parsed[key])) return parsed[key];
    }
    return [];
  })();

  const bahoMap = new Map<number, { ball: number; asoslash: string }>();
  for (const b of baholar) {
    const idx = Number(b.indeks) || Number(b.index) || 0;
    if (idx >= 1 && idx <= nomzodlar.length) {
      bahoMap.set(idx, { ball: Number(b.ball) || 0, asoslash: b.asoslash || "" });
    }
  }

  const tasdiqlanganlar: any[] = [];
  for (let i = 0; i < Math.min(nomzodlar.length, 20); i++) {
    const baho = bahoMap.get(i + 1);
    if (baho && baho.ball >= 6) {
      const n = nomzodlar[i];
      tasdiqlanganlar.push({
        qonun_kodi: n.qonun_kodi,
        modda_raqami: n.modda_raqami,
        sarlavha: n.sarlavha,
        matn: n.matn,
        ball: baho.ball,
        asoslash: baho.asoslash,
      });
    }
  }

  return tasdiqlanganlar.sort((a, b) => b.ball - a.ball).slice(0, 8);
}

// ── Stage 3: IRAC answer generation ─────────────────────────────────────────
async function stage3_IRACjavob(
  savolMatn: string,
  model: string,
  tasdiqlanganlar: { qonun_kodi: string; modda_raqami: string; sarlavha: string; matn: string; asoslash: string }[]
): Promise<{ javob: string; sources: any[] }> {
  const moddalarStr = tasdiqlanganlar.length > 0
    ? tasdiqlanganlar.map((t, i) => {
        const matnShort = t.matn.length > 800 ? t.matn.slice(0, 800) + "..." : t.matn;
        return `### Modda ${i + 1}: ${t.qonun_kodi} ${t.modda_raqami}-modda\nSarlavha: ${t.sarlavha}\nMatn: ${matnShort}\nAsoslash: ${t.asoslash}`;
      }).join("\n\n")
    : "Tegishli modda topilmadi. Umumiy huquqiy bilim asosida javob bering.";

  const sourceContext = model === "lexion"
    ? "Siz 'Lexion' rejimidasiz — lex.uz amaliy qonunchilik va sud amaliyotiga chuqurroq tahlil bilan javob bering."
    : "Siz 'Manbali' rejimidasiz — qonunlar bazasi (RAG) asosida, har fikr aniq modda havolasi bilan.";

  const systemPrompt = `Siz professional O'zbekiston huquqshunosisiz. ${sourceContext}

Quyidagi savol/kazusni IRAC (Issue-Rule-Application-Conclusion) usulida yeching.

QOIDALAR:
1. Faqat berilgan moddalarga tayaning. Mavjud bo'lmagan modda raqamini o'ylab topmang.
2. Javob tuzilmasi:
   ## Muammo (Issue) — huquqiy masala(ni) aniqlang
   ## Qoida (Rule) — tegishli qonun moddalari va ularing mazmuni
   ## Tahlil (Application) — moddalarni kazus faktlariga tatbiq qiling
   ## Xulosa (Conclusion) — yakuniy huquqiy xulosa
3. O'zbek tilida, professional huquqiy uslubda yozing.
4. Javob oxirida savol bermang va taklif qilmang.
5. Topilgan modda raqami va mazmuni mos kelishini tekshiring; mos kelmasa raqam yozmang.

Tasdiqlangan moddalar:
${moddalarStr}`;

  const { text } = await callAIWithFallback({
    systemPrompt,
    messages: [{ role: "user", text: savolMatn }],
    maxTokens: 3000,
    temperature: 0.4,
    functionName: "chat-worker-stage3",
  });

  const sources = tasdiqlanganlar.map((t) => ({
    qonun_kodi: t.qonun_kodi,
    modda_raqami: t.modda_raqami,
    sarlavha: t.sarlavha,
  }));

  return { javob: text, sources };
}

// ── Process one job ─────────────────────────────────────────────────────────
async function processJob(job: {
  id: string; user_id: string; model: string; savol: string; retry_count: number;
}): Promise<void> {
  const jobId = job.id;
  console.log(`[chat-worker] Processing job ${jobId}, model=${job.model}`);

  try {
    // Update phase: qidiryapti
    await supabaseAdmin
      .from("chat_jobs")
      .update({ phase: "qidiryapti" })
      .eq("id", jobId);

    // Load qonunlar
    const { data: qonunlarData } = await supabaseAdmin
      .from("qonunlar")
      .select("kod, nom")
      .order("kod");
    const barchaQonunlar = (qonunlarData || []).map((q: any) => ({ kod: q.kod, nom: q.nom }));

    let tasdiqlanganlar: any[] = [];

    if (barchaQonunlar.length > 0) {
      // Stage 0: identify qonun codes
      const activeQonunlar = await stage0_QonunAniqlash(job.savol, barchaQonunlar);
      console.log(`[chat-worker] Job ${jobId}: stage0 qonunlar=${activeQonunlar.join(",")}`);

      // Stage 1: FTS search per qonun
      const allNomzodlar: any[] = [];
      for (const kod of activeQonunlar) {
        const moddalar = await stage1_Qidiruv(kod, job.savol, []);
        for (const m of moddalar) {
          allNomzodlar.push({ qonun_kodi: kod, ...m });
        }
      }
      console.log(`[chat-worker] Job ${jobId}: stage1 nomzodlar=${allNomzodlar.length}`);

      // Update phase: tasdiqlamoqda
      await supabaseAdmin
        .from("chat_jobs")
        .update({ phase: "tasdiqlamoqda" })
        .eq("id", jobId);

      // Stage 2: AI verification
      tasdiqlanganlar = await stage2_Tasdiqlash(job.savol, allNomzodlar);
      console.log(`[chat-worker] Job ${jobId}: stage2 tasdiqlangan=${tasdiqlanganlar.length}`);
    }

    // Update phase: yozmoqda
    await supabaseAdmin
      .from("chat_jobs")
      .update({ phase: "yozmoqda" })
      .eq("id", jobId);

    // Stage 3: IRAC answer
    const { javob, sources } = await stage3_IRACjavob(job.savol, job.model, tasdiqlanganlar);
    console.log(`[chat-worker] Job ${jobId}: stage3 done, javob=${javob.length} belgi`);

    // Save result
    await supabaseAdmin
      .from("chat_jobs")
      .update({
        status: "done",
        javob,
        sources: JSON.parse(JSON.stringify(sources)),
        phase: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`[chat-worker] Job ${jobId} done`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[chat-worker] Job ${jobId} xato:`, errMsg);

    // Auto-retry once
    if (job.retry_count < 1) {
      console.log(`[chat-worker] Job ${jobId}: auto-retry`);
      await supabaseAdmin
        .from("chat_jobs")
        .update({
          status: "queued",
          retry_count: job.retry_count + 1,
          phase: null,
          started_at: null,
        })
        .eq("id", jobId);
      return;
    }

    await supabaseAdmin
      .from("chat_jobs")
      .update({
        status: "failed",
        xato: errMsg.slice(0, 300),
        phase: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Claim and process up to CHAT_MAX_CONCURRENCY jobs
    const promises: Promise<void>[] = [];

    for (let i = 0; i < CHAT_MAX_CONCURRENCY; i++) {
      const { data: job } = await supabaseAdmin.rpc("claim_chat_job");

      if (!job) {
        console.log(`[chat-worker] No more queued jobs (slot ${i + 1})`);
        break;
      }

      console.log(`[chat-worker] Claimed job ${job.id} (slot ${i + 1}/${CHAT_MAX_CONCURRENCY})`);
      promises.push(processJob(job as any));
    }

    if (promises.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Navbatda ish yo'q" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Wait for all jobs to complete
    await Promise.allSettled(promises);

    return new Response(
      JSON.stringify({ processed: promises.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[chat-worker] xato:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message.slice(0, 200) : "Server xatosi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

