import { useState, useEffect, useCallback } from 'react';
import {
  Server, RefreshCw, CheckCircle, XCircle, Clock, Loader2,
  Activity, AlertTriangle, TrendingUp, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

interface JobRow {
  id: string;
  case_id: string;
  teacher_id: string;
  status: string;
  backend: number | null;
  service_job_id: string | null;
  source_count: number;
  created_at: string;
  finished_at: string | null;
  error: string | null;
  answer: string | null;
}

interface BackendStats {
  backend: number;
  total: number;
  done: number;
  error: number;
  queued: number;
  running: number;
  avgDurationSec: number | null;
}

interface SettingsInfo {
  url1: string;
  url2: string;
  url2Configured: boolean;
}

const POLL_MS = 10000;

function backendLabel(b: number | null): string {
  if (b === 2) return 'Render #2';
  return 'Render #1';
}

function backendColor(b: number | null): string {
  if (b === 2) return 'text-cyan-600 bg-cyan-50 border-cyan-300';
  return 'text-blue-600 bg-blue-50 border-blue-300';
}

function statusBadge(status: string) {
  switch (status) {
    case 'done':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300"><CheckCircle className="h-3 w-3" />Tayyor</span>;
    case 'error':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300"><XCircle className="h-3 w-3" />Xato</span>;
    case 'queued':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300"><Clock className="h-3 w-3" />Navbatda</span>;
    case 'running':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-300"><Loader2 className="h-3 w-3 animate-spin" />Bajarilmoqda</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-300">{status}</span>;
  }
}

function durationLabel(created: string, finished: string | null): string {
  if (!finished) return '—';
  const ms = new Date(finished).getTime() - new Date(created).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function ageLabel(created: string): string {
  const ms = Date.now() - new Date(created).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s oldin`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} daqiqa oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  const days = Math.floor(hr / 24);
  return `${days} kun oldin`;
}

export default function LmStudioPanel() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<SettingsInfo>({ url1: '', url2: '', url2Configured: false });
  const [filter, setFilter] = useState<'all' | 'active' | 'done' | 'error'>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [jobsRes, settingsRes] = await Promise.all([
        supabase
          .from('case_answer_jobs')
          .select('id, case_id, teacher_id, status, backend, service_job_id, source_count, created_at, finished_at, error, answer')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('settings')
          .select('key, text_value')
          .in('key', ['ANSWER_SERVICE_URL', 'ANSWER_SERVICE_URL_2']),
      ]);

      if (jobsRes.error) throw jobsRes.error;

      const sMap: Record<string, string> = {};
      (settingsRes.data || []).forEach((r: any) => { if (r.text_value) sMap[r.key] = r.text_value; });
      const url2 = (sMap['ANSWER_SERVICE_URL_2'] || '').trim();
      setSettings({
        url1: sMap['ANSWER_SERVICE_URL'] || '',
        url2,
        url2Configured: !!url2,
      });

      setJobs((jobsRes.data || []) as JobRow[]);
    } catch (e: any) {
      setError(e.message || 'Ma\'lumot yuklanmadi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Statistikalar ──
  const stats: BackendStats[] = (() => {
    const backends = [1, 2];
    return backends.map(b => {
      const bJobs = jobs.filter(j => (j.backend ?? 1) === b);
      const done = bJobs.filter(j => j.status === 'done');
      const errored = bJobs.filter(j => j.status === 'error');
      const queued = bJobs.filter(j => j.status === 'queued');
      const running = bJobs.filter(j => j.status === 'running');
      const durations = done
        .filter(j => j.finished_at)
        .map(j => (new Date(j.finished_at!).getTime() - new Date(j.created_at).getTime()) / 1000)
        .filter(d => d > 0 && d < 3600);
      const avgDurationSec = durations.length > 0 ? Math.round(durations.reduce((a, b2) => a + b2, 0) / durations.length) : null;
      return { backend: b, total: bJobs.length, done: done.length, error: errored.length, queued: queued.length, running: running.length, avgDurationSec };
    }).filter(s => settings.url2Configured || s.backend === 1);
  })();

  const totalActive = jobs.filter(j => j.status === 'queued' || j.status === 'running').length;
  const totalDone = jobs.filter(j => j.status === 'done').length;
  const totalError = jobs.filter(j => j.status === 'error').length;

  const filteredJobs = (() => {
    switch (filter) {
      case 'active': return jobs.filter(j => j.status === 'queued' || j.status === 'running');
      case 'done': return jobs.filter(j => j.status === 'done');
      case 'error': return jobs.filter(j => j.status === 'error');
      default: return jobs;
    }
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Sarlavha ── */}
      <Card className="border-2 border-slate-600 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/15 p-3 rounded-2xl">
                <Server className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">LM Studio</h1>
                <p className="text-slate-300 text-sm mt-1">
                  Render backend monitoring — so'rovlar, javoblar va xatolar
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-white/15 hover:bg-white/25 px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Yangilash
            </button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="border-2 border-red-300">
          <CardContent className="py-4 flex items-center gap-3 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-medium">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* ── Backend kartalari ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map(s => (
          <Card key={s.backend} className={`border-2 ${s.backend === 2 ? 'border-cyan-300' : 'border-blue-300'} shadow-md`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className={`p-2 rounded-lg ${s.backend === 2 ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}>
                    <Server className="h-5 w-5" />
                  </div>
                  {backendLabel(s.backend)}
                </CardTitle>
                {s.backend === 2 && !settings.url2Configured && (
                  <span className="text-xs text-gray-400 font-medium">Sozlanmagan</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-2xl font-black text-gray-700">{s.total}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">Jami</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-2xl font-black text-green-600">{s.done}</p>
                  <p className="text-[10px] text-green-600 font-bold uppercase">Tayyor</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2">
                  <p className="text-2xl font-black text-red-600">{s.error}</p>
                  <p className="text-[10px] text-red-600 font-bold uppercase">Xato</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-2">
                  <p className="text-2xl font-black text-yellow-600">{s.queued + s.running}</p>
                  <p className="text-[10px] text-yellow-600 font-bold uppercase">Faol</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  O'rtacha vaqt:
                </span>
                <span className="font-bold text-gray-700">
                  {s.avgDurationSec !== null ? (s.avgDurationSec < 60 ? `${s.avgDurationSec}s` : `${Math.floor(s.avgDurationSec / 60)}m ${s.avgDurationSec % 60}s`) : '—'}
                </span>
              </div>
              {s.error > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${s.total > 0 ? (s.done / s.total) * 100 : 0}%` }} />
                  <div className="bg-red-500 h-full" style={{ width: `${s.total > 0 ? (s.error / s.total) * 100 : 0}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Umumiy statistika ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border border-gray-200">
          <CardContent className="py-3 flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg"><Activity className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xl font-black text-gray-700">{totalActive}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Faol ish</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="py-3 flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xl font-black text-gray-700">{totalDone}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Tayyor</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="py-3 flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg"><XCircle className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xl font-black text-gray-700">{totalError}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase">Xato</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Backend konfiguratsiya ── */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />Backend konfiguratsiya</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Render #1 (asosiy):</span>
            <span className={`font-mono text-xs px-2 py-0.5 rounded ${settings.url1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {settings.url1 ? 'faol' : 'sozlanmagan'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Render #2 (qo'shimcha):</span>
            <span className={`font-mono text-xs px-2 py-0.5 rounded ${settings.url2Configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {settings.url2Configured ? 'faol' : 'sozlanmagan'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Yuklamani taqsimlash:</span>
            <span className={`font-mono text-xs px-2 py-0.5 rounded ${settings.url2Configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {settings.url2Configured ? 'ikki backend' : 'faqat #1'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Filtr tugmalari ── */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all', label: 'Barchasi', count: jobs.length },
          { key: 'active', label: 'Faol', count: totalActive },
          { key: 'done', label: 'Tayyor', count: totalDone },
          { key: 'error', label: 'Xato', count: totalError },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
              filter === f.key
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-slate-400'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* ── Ishlar jadvali ── */}
      {loading ? (
        <Card><CardContent className="py-16 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-gray-500">Yuklanmoqda...</p>
        </CardContent></Card>
      ) : filteredJobs.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Server className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-xl font-medium text-gray-500">Ishlar topilmadi</p>
          <p className="text-sm text-gray-400 mt-1">Ustozlar "AI javob" tugmasini bosganda ishlar shu yerda ko'rinadi</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filteredJobs.map(job => {
            const b = job.backend ?? 1;
            return (
              <Card key={job.id} className={`border ${job.status === 'error' ? 'border-red-200' : job.status === 'done' ? 'border-green-200' : 'border-gray-200'} hover:shadow-md transition-shadow`}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(job.status)}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${backendColor(job.backend)}`}>
                          {backendLabel(job.backend)}
                        </span>
                        {job.source_count > 0 && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {job.source_count} manba
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{ageLabel(job.created_at)}</span>
                      </div>
                      {job.error && (
                        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span className="break-words">{job.error}</span>
                        </div>
                      )}
                      {job.done && job.answer && (
                        <p className="text-xs text-gray-400 truncate">Javob: {job.answer.slice(0, 120)}...</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500">{durationLabel(job.created_at, job.finished_at)}</p>
                      {job.service_job_id && (
                        <p className="text-[10px] text-gray-400 font-mono mt-1">#{job.service_job_id.slice(0, 8)}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
}
