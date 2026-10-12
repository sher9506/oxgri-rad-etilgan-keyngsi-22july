// nexus-chat-history — foydalanuvchining chat tarixini qaytaradi.
// deploy-trigger Sat Oct 12 2026 18:55 UTC
// Auth: nexus-chats-status bilan AYNAN bir xil — body'dan user_id olinadi,
// service-role bilan o'sha user_id qatorlari xolos o'qiladi.
// verify_jwt = false (config.toml).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function sanitizeAnswer(text: string): string {
  if (!text) return text;
  return text
    .replace(/\bNotebookLM\b/gi, "manba")
    .replace(/\bGemini Notebook\b/gi, "manba")
    .replace(/\bNotebook\b/gi, "manba")
    .replace(/\s*\[\d+(?:\s*[-,]\s*\d+)*\]/g, "")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/  +/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
}

function parseLexionUrls(raw: string | null): string[] {
  if (!raw) return [];
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "string") urls.push(item);
      }
    }
  } catch { /* not JSON */ }
  if (urls.length === 0) {
    const regex = /https?:\/\/(?:www\.)?lex\.uz\/docs\/-?\d+/g;
    const matches = raw.match(regex);
    if (matches) urls = matches;
  }
  const filtered = urls.filter(u => /^https?:\/\/(?:www\.)?lex\.uz\/docs\/-?\d+$/.test(u));
  const unique: string[] = [];
  for (const u of filtered) {
    if (!unique.includes(u)) unique.push(u);
    if (unique.length >= 15) break;
  }
  return unique;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, mode, chat_id } = body as {
      user_id?: string;
      mode?: string;
      chat_id?: string;
    };

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id majburiy" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── mode: 'list' — chat ro'yxati ──
    if (mode === "list") {
      const nowIso = new Date().toISOString();

      // Faol chat_id lar (nexus_chat_notebooks: status='active', expires_at > now)
      const { data: activeNbs } = await sb
        .from("nexus_chat_notebooks")
        .select("chat_id")
        .eq("user_id", user_id)
        .eq("status", "active")
        .gt("expires_at", nowIso);

      const activeChatIds = (activeNbs ?? []).map(r => r.chat_id).filter(Boolean) as string[];

      // Barcha chat job'lar (deleted_at IS NULL, job_kind='chat')
      const { data: allJobs, error: jobsErr } = await sb
        .from("case_answer_jobs")
        .select("id, chat_id, chat_title, chat_kazus_text, status, created_at, answer, lexion_urls, lexion_phase, answer_mode")
        .eq("teacher_id", user_id)
        .eq("job_kind", "chat")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (jobsErr) {
        console.error("[nexus-chat-history] list xatosi:", jobsErr.message);
        return new Response(
          JSON.stringify({ error: "Tarixni olib bo'lmadi" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Chat bo'yicha guruhlash
      const chatMap = new Map<string, {
        chat_id: string;
        title: string;
        created_at: string;
        updated_at: string;
        message_count: number;
        has_pending: boolean;
        pending_job_id: string | null;
      }>();

      for (const job of allJobs ?? []) {
        const cid = job.chat_id;
        if (!cid) continue;

        let entry = chatMap.get(cid);
        if (!entry) {
          entry = {
            chat_id: cid,
            title: (job.chat_title || (job.chat_kazus_text || "").slice(0, 40) || "Chat").slice(0, 80),
            created_at: job.created_at,
            updated_at: job.created_at,
            message_count: 0,
            has_pending: false,
            pending_job_id: null,
          };
          chatMap.set(cid, entry);
        }

        if (new Date(job.created_at) < new Date(entry.created_at)) {
          entry.created_at = job.created_at;
        }
        if (new Date(job.created_at) > new Date(entry.updated_at)) {
          entry.updated_at = job.created_at;
        }

        if (job.status === "done") {
          entry.message_count++;
        }
        if (job.status === "queued" || job.status === "running") {
          entry.has_pending = true;
          entry.pending_job_id = job.id;
        }
      }

      let chats = Array.from(chatMap.values());

      // Faol chatlar birinchi, keyin eng so'nggi 30 ta tugagan chat
      const activeSet = new Set(activeChatIds);
      const activeChats = chats.filter(c => activeSet.has(c.chat_id));
      const inactiveChats = chats
        .filter(c => !activeSet.has(c.chat_id))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 30);

      // Faol chatlarni updated_at bo'yicha tartiblaymiz
      activeChats.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      chats = [...activeChats, ...inactiveChats];

      return new Response(
        JSON.stringify({ chats }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── mode: 'messages' — bitta chatning xabarlar ──
    if (mode === "messages") {
      if (!chat_id) {
        return new Response(
          JSON.stringify({ error: "chat_id majburiy" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: jobs, error: jobsErr } = await sb
        .from("case_answer_jobs")
        .select("id, status, chat_kazus_text, answer, error, created_at, lexion_urls, lexion_phase, answer_mode")
        .eq("teacher_id", user_id)
        .eq("job_kind", "chat")
        .eq("chat_id", chat_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);

      if (jobsErr) {
        console.error("[nexus-chat-history] messages xatosi:", jobsErr.message);
        return new Response(
          JSON.stringify({ error: "Xabarlarni olib bo'lmadi" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const messages = (jobs ?? []).map(job => {
        const lexionUrls = parseLexionUrls(job.lexion_urls ?? null);

        // Lexion bosqichida oraliq natija — answer to'ldirilmaydi
        const isLexionIntermediate = job.answer_mode === "lexion"
          && (job.lexion_phase === "lexion_searching" || job.lexion_phase === "answering")
          && job.status !== "done";

        const answer = (job.status === "done" && !isLexionIntermediate)
          ? sanitizeAnswer(job.answer ?? "")
          : null;

        return {
          job_id: job.id,
          status: job.status,
          question: job.chat_kazus_text ?? "",
          answer,
          error: job.status === "error" ? (job.error ?? null) : null,
          created_at: job.created_at,
          lexion_urls: lexionUrls.length > 0 ? lexionUrls : undefined,
          lexion_phase: job.lexion_phase ?? null,
          lexion_fallback: job.answer_mode === "general" && job.lexion_phase !== null && job.lexion_phase !== undefined,
        };
      });

      return new Response(
        JSON.stringify({ messages }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "mode 'list' yoki 'messages' bo'lishi kerak" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[nexus-chat-history] Xato:", err);
    return new Response(
      JSON.stringify({ error: "Tarixni olib bo'lmadi" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

