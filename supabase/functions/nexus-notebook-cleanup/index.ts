// Nexus AI: chat daftarlarini tozalash (pg_cron har 10 daqiqada chaqiradi).
// 1) Muddati o'tgan daftarlarni tegishli Render orqali o'chiradi.
// 2) Ro'yxatga olinmay qolgan daftarlarni Render'dan so'rab ro'yxatga oladi (reconcile).
// verify_jwt = false (config.toml), x-cron-secret bilan himoyalangan.
import { createClient } from "npm:@supabase/supabase-js@2";
import { deleteRemoteNotebook, getKeepCfg, registerKeptNotebook } from "../_shared/nexus-notebooks.ts";

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_DELETE_ATTEMPTS = 8;
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function getBackends(): Promise<{ key: string; urls: Record<number, string> }> {
  const { data } = await sb
    .from("settings")
    .select("key, text_value")
    .in("key", ["ANSWER_SERVICE_URL", "ANSWER_SERVICE_KEY", "ANSWER_SERVICE_URL_2", "ANSWER_SERVICE_URL_3"]);
  const m: Record<string, string> = {};
  for (const r of data ?? []) if (r.text_value) m[r.key] = String(r.text_value).trim();
  return {
    key: m["ANSWER_SERVICE_KEY"] ?? "",
    urls: { 1: m["ANSWER_SERVICE_URL"] ?? "", 2: m["ANSWER_SERVICE_URL_2"] ?? "", 3: m["ANSWER_SERVICE_URL_3"] ?? "" },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const { data: secretRow } = await sb.from("settings").select("text_value").eq("key", "CRON_SECRET").maybeSingle();
  const secret = secretRow?.text_value ?? "";
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "forbidden" }, 403);

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const { key, urls } = await getBackends();
  const keepCfg = await getKeepCfg();
  const summary = { deleted: 0, delete_failed: 0, registered: 0, lost: 0, pending: 0 };

  // 1) O'chirish: muddati o'tgan yoki "expired" deb belgilangan daftarlar
  const { data: due } = await sb
    .from("nexus_chat_notebooks")
    .select("*")
    .in("status", ["active", "expired"])
    .or(`expires_at.lt.${nowIso},status.eq.expired`)
    .lt("delete_attempts", MAX_DELETE_ATTEMPTS)
    .order("expires_at", { ascending: true })
    .limit(10);

  await Promise.allSettled((due ?? []).map(async (row: Record<string, unknown>) => {
    const ok = await deleteRemoteNotebook(urls[row.backend as number] ?? "", key, row.profile as string, row.notebook_id as string);
    if (ok) {
      await sb.from("nexus_chat_notebooks").update({ status: "deleted", deleted_at: new Date().toISOString() }).eq("id", row.id as string);
      summary.deleted++;
    } else {
      const attempts = (row.delete_attempts as number ?? 0) + 1;
      await sb
        .from("nexus_chat_notebooks")
        .update({
          delete_attempts: attempts,
          last_error: "Render orqali o'chirib bo'lmadi",
          status: attempts >= MAX_DELETE_ATTEMPTS ? "failed" : row.status,
        })
        .eq("id", row.id as string);
      if (attempts >= MAX_DELETE_ATTEMPTS) console.error(`[nexus-cleanup] DAFTAR O'CHMADI (qo'lda tekshiring): ${row.notebook_id} profil=${row.profile}`);
      summary.delete_failed++;
    }
  }));

  // 2) Reconcile: Render'da tayyor bo'lgan, lekin hech kim ro'yxatga olmagan daftarlar
  const { data: pend } = await sb
    .from("case_answer_jobs")
    .select("id, chat_id, teacher_id, backend, service_job_id, chat_kazus_text, lexion_urls")
    .eq("chat_keep_requested", true)
    .eq("chat_keep_registered", false)
    .not("service_job_id", "is", null)
    .lt("created_at", new Date(now - 4 * 60_000).toISOString())
    .gt("created_at", new Date(now - 8 * 3_600_000).toISOString())
    .limit(10);

  await Promise.allSettled((pend ?? []).map(async (p: Record<string, unknown>) => {
    const base = urls[p.backend as number ?? 1] ?? "";
    if (!base) return;
    try {
      const r = await fetch(`${base}/api/jobs/${p.service_job_id}`, {
        headers: { "X-API-Key": key },
        signal: AbortSignal.timeout(60_000),
      });
      if (r.status === 404) {
        await sb.from("case_answer_jobs").update({ chat_keep_registered: true }).eq("id", p.id as string);
        summary.lost++;
        return;
      }
      if (!r.ok) return;
      const svc = await r.json();
      const st = String(svc.status ?? "").toLowerCase();
      if (st === "done") {
        await registerKeptNotebook({ ...p, chat_keep_requested: true } as unknown as Parameters<typeof registerKeptNotebook>[0], svc, keepCfg, { baseUrl: base, key });
        summary.registered++;
      } else if (st === "error") {
        await sb.from("case_answer_jobs").update({ chat_keep_registered: true }).eq("id", p.id as string);
      } else {
        summary.pending++;
      }
    } catch (e) {
      console.error("[nexus-cleanup] reconcile xato:", e);
    }
  }));

  // 3) Stale chat job'larni tozalash: 25 daqiqadan eski faol Nexus chat job'lari
  const staleCutoff = new Date(now - 25 * 60_000).toISOString();
  const { data: staleJobs } = await sb
    .from("case_answer_jobs")
    .select("id, teacher_id, created_at")
    .eq("job_kind", "chat")
    .in("status", ["queued", "running"])
    .is("case_id", null)
    .lt("created_at", staleCutoff)
    .limit(20);

  const staleIds = (staleJobs ?? []).map((r: Record<string, unknown>) => r.id as string);
  if (staleIds.length > 0) {
    const { error: staleErr } = await sb
      .from("case_answer_jobs")
      .update({ status: "error", error: "Server qayta ishga tushdi, savolni qayta yuboring.", finished_at: new Date().toISOString() })
      .in("id", staleIds);
    if (staleErr) console.error("[nexus-cleanup] stale job tozalash xatosi:", staleErr.message);
    else console.log(`[nexus-cleanup] ${staleIds.length} ta stale chat job error ga o'tdi`);
  }

  return json({ ok: true, ...summary, stale_cleaned: staleIds.length });
});
