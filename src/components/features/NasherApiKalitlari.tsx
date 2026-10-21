import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Play, Trash2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

type Pool = 'voice' | 'fast' | 'router';
type ModelPool = Pool;
interface Counts { ok: number; quota: number; errors: number }
interface KeyRow {
  id: string; label: string; masked: string; enabled: boolean;
  last_test_at: string | null; last_test_status: string | null; today: Counts; week: Counts;
}
interface TestResult { ok: boolean; status: string; message: string }

const POOLS: { pool: Pool; title: string; limit: number; fallback: string }[] = [
  { pool: 'voice', title: '🎤 Ovoz API (ovozli xabarni matnga)', limit: 10, fallback: 'foydalanuvchiga «kuting» xabari' },
  { pool: 'fast', title: "⚡ Tez rejim API (Lo'nda)", limit: 15, fallback: 'avtomatik Chuqur rejim' },
  { pool: 'router', title: '🧭 Rejim tanlovchi API (botda: Tez yoki Chuqur)', limit: 3, fallback: "tez havzaning 3 ta kaliti, ular ham ishlamasa — Tez rejim" },
];
const MODEL_LABELS: Record<ModelPool, string> = { fast: 'Tez rejim modeli', voice: 'Ovoz modeli', router: 'Router modeli' };

/** nasher-keys edge funksiyasini chaqirish; non-2xx javobdagi {error} matnini ham chiqaradi. */
async function callKeys(adminCode: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('nasher-keys', { body, headers: { 'x-admin-code': adminCode } });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* matn emas */ }
    throw new Error(msg);
  }
  return data;
}

const statusClass = (s: string | null) =>
  s === 'ok' ? 'bg-green-100 text-green-700' : s?.includes('429') ? 'bg-amber-100 text-amber-700' : s ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500';
const resultClass = (r: TestResult) =>
  r.ok ? 'bg-green-50 text-green-700 border-green-200' : r.status.includes('429') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200';

function PoolCard({ adminCode, pool, title, limit, fallback }: { adminCode: string } & (typeof POOLS)[number]) {
  const { toast } = useToast();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await callKeys(adminCode, { action: 'list', pool });
      setKeys(data.keys ?? []);
    } catch (e) {
      console.error(`[NasherApiKalitlari] ${pool} ro'yxati:`, e);
      toast({ title: "Kalitlar o'qilmadi", description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setLoading(false); }
  }, [adminCode, pool, toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag);
    try {
      const data = await callKeys(adminCode, body);
      if (data?.test) setResult(data.test);
      await load();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (body.action === 'add' || body.action === 'test') setResult({ ok: false, status: 'xato', message: msg });
      else toast({ title: 'Xatolik', description: msg, variant: 'destructive' });
      return false;
    } finally { setBusy(null); }
  };

  const add = async () => {
    const k = apiKey.trim();
    if (!/^(AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_.-]{20,})$/.test(k)) { setResult({ ok: false, status: 'xato', message: "Kalit AIza… yoki AQ. bilan boshlanishi kerak" }); return; }
    setResult(null);
    if (await run('add', { action: 'add', pool, api_key: k, label: label.trim() })) { setApiKey(''); setLabel(''); }
  };

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-lg">{title} <span className="text-sm font-normal text-slate-500">({keys.length}/{limit})</span></CardTitle>
        <p className="text-xs text-slate-500">Kalitlar navbat bilan ishlatiladi; biri band bo'lsa keyingisiga o'tadi; hammasi band bo'lsa: {fallback}.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input type="password" placeholder="AIza… yoki AQ.…" value={apiKey} onChange={e => setApiKey(e.target.value)} className="font-mono" autoComplete="off" />
          <Input placeholder="Nomi (ixtiyoriy)" value={label} onChange={e => setLabel(e.target.value)} className="sm:w-48" />
          <Button onClick={add} disabled={!!busy || keys.length >= limit} className="bg-blue-600 text-white hover:bg-blue-700">
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}Qo'shish va sinash
          </Button>
        </div>
        {result && <div className={`text-sm border rounded-md px-3 py-2 ${resultClass(result)}`}>{result.message}</div>}

        {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : keys.length === 0 ? (
          <p className="text-sm text-slate-500">Hali kalit qo'shilmagan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500 border-b">
                <tr><th className="py-2 pr-2">Nomi</th><th className="pr-2">Kalit</th><th className="pr-2">Holat</th><th className="pr-2">Oxirgi sinov</th><th className="pr-2">Bugun</th><th className="pr-2">7 kun</th><th></th></tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id} className={`border-b ${k.enabled ? '' : 'opacity-50'}`}>
                    <td className="py-2 pr-2">{k.label || '—'}</td>
                    <td className="pr-2 font-mono">{k.masked}</td>
                    <td className="pr-2"><span className={`px-2 py-0.5 rounded-full text-xs ${statusClass(k.last_test_status)}`}>{k.last_test_status ?? 'sinalmagan'}</span></td>
                    <td className="pr-2 text-slate-500 whitespace-nowrap">{k.last_test_at ? new Date(k.last_test_at).toLocaleString('uz-UZ') : '—'}</td>
                    <td className="pr-2 whitespace-nowrap">
                      <span className="text-green-700">✓ {k.today.ok}</span> <span className="text-amber-700">⏳ {k.today.quota}</span> <span className="text-red-700">✗ {k.today.errors}</span>
                    </td>
                    <td className="pr-2 whitespace-nowrap text-slate-500">{k.week.ok + k.week.quota + k.week.errors} ({k.week.ok} ok)</td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="outline" className="bg-white" disabled={!!busy} onClick={() => run(k.id, { action: 'test', id: k.id })}>
                          {busy === k.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}<span className="ml-1">Sinash</span>
                        </Button>
                        <Switch checked={k.enabled} disabled={!!busy} onCheckedChange={v => run('t' + k.id, { action: 'toggle', id: k.id, enabled: v })} className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-300" />
                        <Button size="sm" variant="outline" className="bg-white text-red-600 hover:bg-red-50" disabled={!!busy}
                          onClick={() => confirm(`${k.masked} kalitini o'chirasizmi?`) && run('d' + k.id, { action: 'delete', id: k.id })}>
                          <Trash2 className="w-3 h-3 mr-1" />O'chirish
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModelSettings({ adminCode }: { adminCode: string }) {
  const { toast } = useToast();
  const [models, setModels] = useState<Record<ModelPool, string>>({ fast: '', voice: '', router: '' });
  const [saving, setSaving] = useState<ModelPool | null>(null);

  useEffect(() => {
    callKeys(adminCode, { action: 'models' }).then(d => d?.models && setModels(d.models)).catch(e => {
      console.error('[NasherApiKalitlari] modellar:', e);
      toast({ title: "Modellar o'qilmadi", description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    });
  }, [adminCode, toast]);

  const save = async (pool: ModelPool) => {
    setSaving(pool);
    try {
      const d = await callKeys(adminCode, { action: 'set_model', pool, model: models[pool].trim() });
      if (d?.models) setModels(d.models);
      toast({ title: 'Saqlandi', description: `${MODEL_LABELS[pool]}: ${models[pool].trim()}` });
    } catch (e) {
      toast({ title: 'Xatolik', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setSaving(null); }
  };

  return (
    <Card className="bg-white">
      <CardHeader><CardTitle className="text-lg">🧠 Modellar</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {(Object.keys(MODEL_LABELS) as ModelPool[]).map(p => (
          <div key={p} className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="sm:w-40 text-sm text-slate-600">{MODEL_LABELS[p]}</span>
            <Input value={models[p]} onChange={e => setModels(m => ({ ...m, [p]: e.target.value }))} className="font-mono" placeholder="gemini-3-flash-preview" />
            <Button onClick={() => save(p)} disabled={saving !== null} className="bg-blue-600 text-white hover:bg-blue-700">
              {saving === p ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}Saqlash
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface FastJob { id: string; created_at: string; finished_at: string | null; status: string; answer_mode: string; lexion_fallback_reason: string | null }

/** Oxirgi tez savollar: necha soniyada javob berildi yoki nega Chuqur rejimga o'tdi */
function FastLog({ adminCode }: { adminCode: string }) {
  const [jobs, setJobs] = useState<FastJob[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    callKeys(adminCode, { action: 'fast_log' }).then(d => setJobs(d?.jobs ?? [])).catch(e => {
      console.error('[NasherApiKalitlari] fast_log:', e);
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [adminCode]);
  useEffect(load, [load]);

  const sec = (j: FastJob) => j.finished_at ? Math.round((Date.parse(j.finished_at) - Date.parse(j.created_at)) / 1000) + ' s' : '…';
  return (
    <Card className="bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">⚡ Oxirgi tez savollar</CardTitle>
        <Button variant="outline" size="sm" onClick={load}>Yangilash</Button>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {error && <p className="text-red-600">{error}</p>}
        {jobs?.length === 0 && <p className="text-slate-500">Hali tez savol yo'q.</p>}
        {jobs?.map(j => (
          <div key={j.id} className="flex flex-wrap gap-x-3 border-b py-1">
            <span className="text-slate-500">{new Date(j.created_at).toLocaleString('uz-UZ')}</span>
            {j.answer_mode === 'fast'
              ? <span className="text-green-700">✅ Tez · {j.status} · {sec(j)}</span>
              : <span className="text-amber-700">↪ Chuqurga o'tdi · {j.status}</span>}
            {j.lexion_fallback_reason && <span className="w-full break-all font-mono text-xs text-red-700">{j.lexion_fallback_reason}</span>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Kalitlar bo'limi alohida PIN bilan himoyalangan: sayt kodida ochiq turgan admin kodi bilan kirib bo'lmaydi.
// PIN Supabase secret NASHER_ADMIN_CODE ga teng bo'lishi kerak; brauzerda faqat shu oyna yopilguncha saqlanadi.
const PIN_KEY = 'nasher_keys_pin';

export default function NasherApiKalitlari() {
  const [pin, setPin] = useState(() => { try { return sessionStorage.getItem(PIN_KEY) ?? ''; } catch { return ''; } });
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const enter = async () => {
    setChecking(true); setError('');
    try {
      await callKeys(draft.trim(), { action: 'models' });   // PIN to'g'riligini tekshirish
      try { sessionStorage.setItem(PIN_KEY, draft.trim()); } catch { /* shaxsiy rejim */ }
      setPin(draft.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "PIN noto'g'ri");
    } finally {
      setChecking(false);
    }
  };

  if (!pin) {
    return (
      <div className="max-w-sm space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">🔐 API kalitlari</h2>
        <p className="text-sm text-slate-500">Bu bo'lim alohida PIN bilan himoyalangan (admin panel kodidan boshqa).</p>
        <input type="password" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && enter()}
          className="w-full rounded-md border px-3 py-2" placeholder="PIN kod" />
        <button onClick={enter} disabled={!draft.trim() || checking} className="w-full rounded-md bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50">
          {checking ? 'Tekshirilmoqda…' : 'Kirish'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {POOLS.map(p => <PoolCard key={p.pool} adminCode={pin} {...p} />)}
      <FastLog adminCode={pin} />
      <ModelSettings adminCode={pin} />
    </div>
  );
}
