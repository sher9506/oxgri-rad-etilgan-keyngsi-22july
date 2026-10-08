import { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit, MessageSquare, Clock, AlertCircle, CheckCircle2,
  Users, Zap, BookOpen, TrendingUp, Loader2, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface StatRow {
  id: string;
  user_login: string | null;
  user_ism: string | null;
  user_rol: string | null;
  rejim: string | null;
  savol_matn: string | null;
  javob_matn: string | null;
  xato: boolean;
  xato_matn: string | null;
  sarflangan_sekund: number;
  session_id: string | null;
  created_at: string;
}

interface SummaryRow {
  user_login: string;
  user_ism: string;
  user_rol: string;
  savol_soni: number;
  xato_soni: number;
  umumiy_vaqt: number;
  rejimlar: string[];
}

function formatVaqt(sekund: number): string {
  if (sekund < 60) return `${sekund}s`;
  const m = Math.floor(sekund / 60);
  const s = sekund % 60;
  return `${m}m ${s}s`;
}

export default function AdminAiChatMonitor() {
  const { user } = useAuth();
  const userLogin = user?.login || '';
  const [stats, setStats] = useState<StatRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'summary' | 'history'>('summary');
  const [search, setSearch] = useState('');
  const [filterRejim, setFilterRejim] = useState<'all' | 'lexion' | 'manba'>('all');
  const [filterError, setFilterError] = useState<'all' | 'errors' | 'ok'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, summaryRes] = await Promise.all([
        supabase.functions.invoke('fanfaster-ai-chat', {
          body: { mode: 'admin_stats', user_login: userLogin },
        }),
        supabase.functions.invoke('fanfaster-ai-chat', {
          body: { mode: 'admin_summary', user_login: userLogin },
        }),
      ]);

      if (statsRes.data?.stats) setStats(statsRes.data.stats as StatRow[]);
      if (summaryRes.data?.summary) setSummary(summaryRes.data.summary as SummaryRow[]);
    } catch (e) {
      console.warn('[AdminAiChatMonitor] yuklash xatosi:', e);
    } finally {
      setLoading(false);
    }
  }, [userLogin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Filtered stats ──────────────────────────────────────────────────────
  const filteredStats = stats.filter(s => {
    if (filterRejim !== 'all' && s.rejim !== filterRejim) return false;
    if (filterError === 'errors' && !s.xato) return false;
    if (filterError === 'ok' && s.xato) return false;
    if (search) {
      const q = search.toLowerCase();
      const match = (s.user_ism || '').toLowerCase().includes(q)
        || (s.user_login || '').toLowerCase().includes(q)
        || (s.savol_matn || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // ── Overall stats ───────────────────────────────────────────────────────
  const totalSavol = summary.reduce((s, r) => s + r.savol_soni, 0);
  const totalXato = summary.reduce((s, r) => s + r.xato_soni, 0);
  const totalVaqt = summary.reduce((s, r) => s + r.umumiy_vaqt, 0);
  const totalUsers = summary.length;
  const lexionCount = stats.filter(s => s.rejim === 'lexion').length;
  const manbaCount = stats.filter(s => s.rejim === 'manba').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500">AI Chat monitoring yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
          <BrainCircuit className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-gray-800 text-sm">FanFaster AI Chat — Monitoring</h2>
          <p className="text-xs text-gray-500">Foydalanuvchilar savollari, vaqt va xatolar nazorati</p>
        </div>
      </div>

      {/* ── Overall stats cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Jami savollar</p>
          </div>
          <p className="text-2xl font-black text-gray-800">{totalSavol}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Foydalanuvchilar</p>
          </div>
          <p className="text-2xl font-black text-gray-800">{totalUsers}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-amber-500" />
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Umumiy vaqt</p>
          </div>
          <p className="text-2xl font-black text-gray-800">{formatVaqt(totalVaqt)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Xatolar</p>
          </div>
          <p className="text-2xl font-black text-gray-800">
            {totalXato}
            {totalSavol > 0 && (
              <span className="text-[10px] font-normal text-gray-400 ml-1">
                ({Math.round((totalXato / totalSavol) * 100)}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Rejim distribution ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-600 uppercase">Lexion rejimi</p>
            <p className="text-xl font-black text-blue-800">{lexionCount}</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Manba rejimi</p>
            <p className="text-xl font-black text-emerald-800">{manbaCount}</p>
          </div>
        </div>
      </div>

      {/* ── Tab toggle ──────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('summary')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            tab === 'summary' ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Foydalanuvchilar bo'yicha
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
            tab === 'history' ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Savol tarixi
        </button>
      </div>

      {/* ── Summary tab ─────────────────────────────────────────────────── */}
      {tab === 'summary' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {summary.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Hali ma'lumot yo'q</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-bold text-gray-600">Foydalanuvchi</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">Rol</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-600">Savollar</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-600">Xatolar</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-600">Vaqt</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600">Rejim</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sort((a, b) => b.savol_soni - a.savol_soni).map((row, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">
                        {row.user_ism || row.user_login || 'Anonim'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          row.user_rol === 'ustoz' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {row.user_rol || 'o\'quvchi'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-gray-700">{row.savol_soni}</td>
                      <td className="px-3 py-2 text-center">
                        {row.xato_soni > 0 ? (
                          <span className="font-bold text-red-600">{row.xato_soni}</span>
                        ) : (
                          <span className="text-gray-300">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">{formatVaqt(row.umumiy_vaqt)}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          {row.rejimlar.map(r => (
                            <span key={r} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              r === 'manba' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>{r}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ─────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-[180px]">
              <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ism yoki savol matni bo'yicha qidirish..."
                className="flex-1 text-xs outline-none bg-transparent"
              />
            </div>
            <select
              value={filterRejim}
              onChange={e => setFilterRejim(e.target.value as any)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
            >
              <option value="all">Barcha rejimlar</option>
              <option value="lexion">Lexion</option>
              <option value="manba">Manba</option>
            </select>
            <select
              value={filterError}
              onChange={e => setFilterError(e.target.value as any)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none"
            >
              <option value="all">Barchasi</option>
              <option value="errors">Faqat xatolar</option>
              <option value="ok">Faqat muvaffaqiyatli</option>
            </select>
          </div>

          {/* Stats list */}
          <div className="space-y-2">
            {filteredStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Filtr bo'yicha hech narsa topilmadi</p>
            ) : (
              filteredStats.map((stat, i) => (
                <div
                  key={stat.id || i}
                  className={`bg-white border rounded-xl p-3 ${
                    stat.xato ? 'border-red-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        stat.xato ? 'bg-red-100' : stat.rejim === 'manba' ? 'bg-emerald-100' : 'bg-blue-100'
                      }`}>
                        {stat.xato ? (
                          <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">
                          {stat.user_ism || stat.user_login || 'Anonim'}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            stat.user_rol === 'ustoz' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>{stat.user_rol || 'o\'quvchi'}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            stat.rejim === 'manba' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                          }`}>{stat.rejim || 'lexion'}</span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(stat.created_at).toLocaleString('uz-UZ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] text-gray-400 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {stat.sarflangan_sekund || 0}s
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2 mt-1">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Savol:</p>
                    <p className="text-xs text-gray-700 line-clamp-2">{stat.savol_matn || '—'}</p>
                  </div>
                  {!stat.xato && stat.javob_matn && (
                    <div className="bg-blue-50 rounded-lg p-2 mt-1">
                      <p className="text-[10px] font-bold text-blue-500 uppercase mb-0.5">Javob:</p>
                      <p className="text-xs text-gray-700 line-clamp-2">{stat.javob_matn}</p>
                    </div>
                  )}
                  {stat.xato && stat.xato_matn && (
                    <div className="bg-red-50 rounded-lg p-2 mt-1">
                      <p className="text-[10px] font-bold text-red-500 uppercase mb-0.5">Xato:</p>
                      <p className="text-xs text-red-700 line-clamp-2">{stat.xato_matn}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
