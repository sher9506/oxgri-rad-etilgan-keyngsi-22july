// HukmReport — ustoz hisobot ekrani (o'tkazilgan o'yin tahlili)
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Users, TrendingUp, Target, Flag, AlertCircle, Download, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getSession } from '@/lib/hukmApi';
import { exportHukmDocx } from '@/lib/hukmDocx';

const EASE = [0.22, 1, 0.36, 1] as const;

export function HukmReport({ sessionId, ustozId, onExit }: { sessionId: string; ustozId: string; onExit: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [showDifficult, setShowDifficult] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await getSession(sessionId, ustozId);
        setData(result);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, ustozId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cobalt-1)' }} /></div>;
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Hisobot topilmadi.</p>
        <button onClick={onExit} className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--panel-2)' }}>Orqaga</button>
      </div>
    );
  }

  const session = data.session;
  const perQuestion = data.per_question || [];
  const players = data.players || [];
  const summary = data.summary || [];

  // Ko'rsatkichlar
  const totalPlayers = session?.player_count || players.length;
  const avgCorrect = Math.round(players.reduce((s: number, p: any) => s + (p.correct_pct || 0), 0) / Math.max(1, players.length));
  const avgPoints = Math.round(players.reduce((s: number, p: any) => s + (p.total_points || 0), 0) / Math.max(1, players.length));
  const finishersPct = session?.finishers_pct || 0;

  // Qiyin savollar
  const difficultQuestions = perQuestion.filter((q: any) => q.difficult).slice(0, 5);

  // CSV eksport
  function handleCSV() {
    const rows = [
      ['O\'rin', 'Ism', 'Ball', 'To\'g\'ri %', 'Javoblar soni'],
      ...players.map((p: any, i: number) => [i + 1, p.nickname, p.total_points, `${p.correct_pct}%`, p.total_answers]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hukm-natijalar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onExit} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <X className="w-4 h-4" style={{ color: 'var(--ink)' }} />
        </button>
        <div className="flex-1">
          <h1 className="ff-serif text-xl" style={{ color: 'var(--ink)' }}>O'yin hisoboti</h1>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{session?.started_at ? new Date(session.started_at).toLocaleString('uz-UZ') : ''}</p>
        </div>
        <button onClick={handleCSV} className="w-9 h-9 rounded-lg flex items-center justify-center" title="CSV eksport" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <Download className="w-4 h-4" style={{ color: 'var(--ink)' }} />
        </button>
      </div>

      {/* 4 ko'rsatkich */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Users className="w-4 h-4" />} label="Qatnashchilar" value={totalPlayers} />
        <StatCard icon={<Target className="w-4 h-4" />} label="O'rtacha to'g'ri" value={`${avgCorrect}%`} />
        <StatCard icon={<TrendingUp className="w-4 h-4" />} label="O'rtacha ball" value={avgPoints} />
        <StatCard icon={<Flag className="w-4 h-4" />} label="Tugatganlar" value={`${finishersPct}%`} />
      </div>

      {/* Xulosa */}
      {summary.length > 0 && (
        <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>Xulosa</h3>
          {summary.map((s: string, i: number) => (
            <p key={i} className="text-sm mb-1" style={{ color: 'var(--ink-body)' }}>• {s}</p>
          ))}
        </div>
      )}

      {/* Reyting */}
      <div className="mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Reyting</h3>
        <div className="space-y-1.5">
          {players.map((p: any, i: number) => (
            <div key={p.player_id}>
              <button
                onClick={() => setExpandedPlayer(expandedPlayer === p.player_id ? null : p.player_id)}
                className="w-full rounded-lg p-3 flex items-center gap-3 transition-all"
                style={{ background: i === 0 ? 'var(--gold-tint)' : 'var(--ff-card)', border: '1px solid var(--line)' }}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: i === 0 ? 'var(--gold)' : 'var(--panel-2)', color: i === 0 ? 'white' : 'var(--ink)' }}>{i + 1}</span>
                <span className="flex-1 text-left text-sm font-semibold" style={{ color: 'var(--ink)' }}>{p.nickname}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--gold-ink)' }}>{p.total_points}</span>
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{p.correct_pct}%</span>
                {expandedPlayer === p.player_id ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} />}
              </button>
              <AnimatePresence>
                {expandedPlayer === p.player_id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 space-y-1">
                      {p.answers?.map((a: any, ai: number) => (
                        <div key={ai} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded" style={{ background: 'var(--panel-2)' }}>
                          <span className="font-bold w-6" style={{ color: 'var(--ink-muted)' }}>{ai + 1}.</span>
                          <span style={{ color: a.correct ? 'var(--success)' : '#C2303D' }}>
                            {a.correct ? 'To\'g\'ri' : 'Noto\'g\'ri'}
                          </span>
                          <span style={{ color: 'var(--ink-muted)' }}>— {a.choice !== null ? String.fromCharCode(65 + a.choice) : '—'}</span>
                          <span className="ml-auto font-bold" style={{ color: 'var(--gold-ink)' }}>{a.points} b</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Savollar tahlili */}
      <div className="mb-6">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Savollar tahlili</h3>
        <div className="space-y-1.5">
          {[...perQuestion].sort((a: any, b: any) => (b.wrong_pct || (100 - b.correct_pct)) - (a.wrong_pct || (100 - a.correct_pct))).map((q: any) => {
            const idx = q.question_index;
            const wrongPct = q.wrong_pct ?? (100 - q.correct_pct);
            return (
              <div key={idx}>
                <button
                  onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                  className="w-full rounded-lg p-3 text-left transition-all"
                  style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--ink-muted)' }}>{idx + 1}.</span>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--ink)' }}>{q.text}</span>
                    {q.difficult && <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: '#FEF2F2', color: '#C2303D' }}>XATO {q.wrong_pct || (100 - q.correct_pct)}%</span>}
                  </div>
                  {/* Xato chizig'i */}
                  <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--panel-2)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${q.correct_pct}%` }}
                      transition={{ duration: 0.5, ease: EASE }}
                      style={{ background: 'var(--success)' }}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${wrongPct}%` }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
                      style={{ background: wrongPct > 70 ? '#C2303D' : wrongPct > 50 ? 'var(--gold)' : 'var(--cobalt-1)' }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                    <span>To'g'ri: {q.correct_pct}%</span>
                    <span>Xato: {wrongPct}%</span>
                    <span>Javobsiz: {q.no_answer_count || 0}</span>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedQuestion === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 space-y-2">
                        {q.options?.map((opt: any, oi: number) => {
                          const total = q.total_answers || 1;
                          const optCount = q.option_counts?.[oi] || 0;
                          const optPct = Math.round((optCount / total) * 100);
                          return (
                            <div key={oi} className="flex items-center gap-2 text-xs">
                              <span className="font-bold w-5" style={{ color: oi === q.correct_index ? 'var(--success)' : 'var(--ink-muted)' }}>{String.fromCharCode(65 + oi)}</span>
                              <span className="flex-1" style={{ color: 'var(--ink-body)' }}>{opt.text}</span>
                              <span className="font-bold" style={{ color: oi === q.correct_index ? 'var(--success)' : 'var(--ink-muted)' }}>{optPct}%</span>
                            </div>
                          );
                        })}
                        {q.most_common_wrong != null && (
                          <div className="text-xs px-3 py-2 rounded" style={{ background: '#FEF2F2', color: '#C2303D' }}>
                            Eng ko'p adashilgan: {String.fromCharCode(65 + q.most_common_wrong)}, {q.most_common_wrong_pct}%
                          </div>
                        )}
                        {q.explanation && <p className="text-xs" style={{ color: 'var(--ink-body)' }}><b>Izoh:</b> {q.explanation}</p>}
                        {q.legal_basis && <p className="text-xs" style={{ color: 'var(--gold-ink)' }}><b>Asos:</b> {q.legal_basis}</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Diqqat talab qiladigan savollar */}
      {difficultQuestions.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: '#C2303D' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Diqqat talab qiladigan savollar</h3>
          </div>
          {showDifficult ? (
            <div className="rounded-xl p-6" style={{ background: 'var(--navy-1)' }}>
              {difficultQuestions.map((q: any) => (
                <div key={q.question_index} className="mb-6 last:mb-0">
                  <p className="text-white text-sm font-semibold mb-2">{q.question_index + 1}. {q.text}</p>
                  <p className="text-sm mb-1" style={{ color: 'var(--success-on-navy)' }}>To'g'ri: {q.options?.[q.correct_index]?.text}</p>
                  {q.explanation && <p className="text-sm" style={{ color: 'var(--on-navy-muted)' }}>{q.explanation}</p>}
                  {q.legal_basis && <p className="text-sm" style={{ color: 'var(--gold)' }}>{q.legal_basis}</p>}
                </div>
              ))}
              <button onClick={() => setShowDifficult(false)} className="text-xs mt-2" style={{ color: 'var(--on-navy-muted)' }}>Yopish</button>
            </div>
          ) : (
            <button onClick={() => setShowDifficult(true)} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
              Izoh bilan ko'rsatish ({difficultQuestions.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{label}</span>
      </div>
      <span className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

import { AnimatePresence } from 'framer-motion';
