// Nexus AI: chat = 1 NotebookLM daftar. submit, status va cleanup funksiyalari shu yerdan foydalanadi.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

export const FOLLOWUP_GRACE_MS = 10 * 60 * 1000;
const CHAT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const LEX_DOC_RE = /lex\.uz\/(?:[a-z]{2}\/)?docs\/(-?\d+)/i;

export function cleanChatId(v: unknown): string | null {
  return typeof v === "string" && CHAT_ID_RE.test(v) ? v : null;
}

/** lex.uz havolasidan hujjat raqami (manfiy bo'lishi mumkin): ".../docs/-6257288" -> "-6257288" */
export function lexDocId(url: string): string | null {
  const m = url.match(LEX_DOC_RE);
  return m ? m[1] : null;
}

export function parseUrlList(s: string | null | undefined): string[] {
  try {
    const a = JSON.parse(s ?? "[]");
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export interface KeepCfg {
  on: boolean;
  ttlHours: number;
  maxPerBackend: number;
}

export async function getKeepCfg(): Promise<KeepCfg> {
  const { data } = await sb
    .from("settings")
    .select("key, text_value")
    .in("key", ["NEXUS_KEEP_NOTEBOOK", "NEXUS_KEEP_TTL_HOURS", "NEXUS_MAX_KEPT_PER_BACKEND"]);
  const m: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) m[r.key] = String(r.text_value).trim();
  return {
    on: (m["NEXUS_KEEP_NOTEBOOK"] ?? "").toLowerCase() === "on",
    ttlHours: Math.min(Math.max(Number(m["NEXUS_KEEP_TTL_HOURS"]) || 5, 1), 12),
    maxPerBackend: Math.max(Number(m["NEXUS_MAX_KEPT_PER_BACKEND"]) || 120, 1),
  };
}

export interface ChatNotebook {
  id: string;
  chat_id: string;
  user_id: string;
  backend: number;
  profile: string;
  notebook_id: string;
  conversation_id: string | null;
  turns: number;
  lex_urls: string[] | null;
  last_topic: string | null;
  status: string;
  expires_at: string;
}

export async function getChatNotebook(
  chatId: string,
  userId: string,
  opts: { ignoreGrace?: boolean } = {},
): Promise<ChatNotebook | null> {
  const minExpiry = new Date(Date.now() + (opts.ignoreGrace ? 0 : FOLLOWUP_GRACE_MS)).toISOString();
  const { data } = await sb
    .from("nexus_chat_notebooks")
    .select("*")
    .eq("chat_id", chatId)
    .eq("user_id", String(userId))
    .eq("status", "active")
    .gt("expires_at", minExpiry)
    .maybeSingle();
  return (data as ChatNotebook) ?? null;
}

export async function expireChatNotebook(rowId: string): Promise<void> {
  await sb.from("nexus_chat_notebooks").update({ status: "expired" }).eq("id", rowId).eq("status", "active");
}

export async function canKeepOn(backend: number, cfg: KeepCfg): Promise<boolean> {
  const { count } = await sb
    .from("nexus_chat_notebooks")
    .select("id", { count: "exact", head: true })
    .eq("backend", backend)
    .in("status", ["active", "expired"]);
  return (count ?? 0) < cfg.maxPerBackend;
}

export async function deleteRemoteNotebook(
  baseUrl: string,
  key: string,
  profile: string,
  notebookId: string,
): Promise<boolean> {
  if (!baseUrl || !key) return false;
  try {
    const r = await fetch(`${baseUrl}/api/notebooks/delete`, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ notebook_id: notebookId, profile }),
      signal: AbortSignal.timeout(100_000),
    });
    return r.ok;
  } catch (e) {
    console.error("[nexus-notebooks] delete so'rovi xato:", e);
    return false;
  }
}

export interface KeepJob {
  id: string;
  chat_id: string | null;
  teacher_id: string;
  backend: number | null;
  chat_kazus_text?: string | null;
  lexion_urls?: string | null;
  chat_keep_requested?: boolean | null;
}

async function markHandled(jobId: string): Promise<void> {
  await sb.from("case_answer_jobs").update({ chat_keep_registered: true }).eq("id", jobId);
}

export async function registerKeptNotebook(
  job: KeepJob,
  svc: Record<string, unknown>,
  cfg: KeepCfg,
  remote: { baseUrl: string; key: string },
): Promise<void> {
  if (!svc || svc.kept !== true || !svc.notebook_id || !svc.profile) {
    if (job.chat_keep_requested) await markHandled(job.id);
    return;
  }
  const nid = String(svc.notebook_id);
  const profile = String(svc.profile);
  const convId = svc.conversation_id ? String(svc.conversation_id) : null;
  const turns = Number(svc.conversation_turns) || 0;
  let isNew = false;
  try {
    if (!job.chat_id) {
      isNew = true;
      throw new Error("chat_id yo'q");
    }
    const topic = (job.chat_kazus_text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const newIds = parseUrlList(job.lexion_urls).map(lexDocId).filter((x): x is string => !!x);

    const { data: cur } = await sb.from("nexus_chat_notebooks").select("*").eq("notebook_id", nid).maybeSingle();
    if (cur) {
      const merged = Array.from(new Set([...(cur.lex_urls ?? []), ...newIds]));
      const { error } = await sb
        .from("nexus_chat_notebooks")
        .update({
          conversation_id: convId ?? cur.conversation_id,
          turns: turns || (cur.turns ?? 0) + 1,
          lex_urls: merged,
          last_topic: topic || cur.last_topic,
        })
        .eq("id", cur.id);
      if (error) throw error;
    } else {
      isNew = true;
      await sb.from("nexus_chat_notebooks").update({ status: "expired" }).eq("chat_id", job.chat_id).eq("status", "active");
      const { error } = await sb.from("nexus_chat_notebooks").insert({
        chat_id: job.chat_id,
        user_id: String(job.teacher_id),
        backend: job.backend ?? 1,
        profile,
        notebook_id: nid,
        conversation_id: convId,
        turns: turns || 1,
        lex_urls: newIds,
        last_topic: topic,
        status: "active",
        expires_at: new Date(Date.now() + cfg.ttlHours * 3_600_000).toISOString(),
      });
      if (error) throw error;
    }
  } catch (e) {
    console.error("[nexus-notebooks] ro'yxatga olib bo'lmadi:", e);
    if (isNew) await deleteRemoteNotebook(remote.baseUrl, remote.key, profile, nid);
  }
  await markHandled(job.id);
}
