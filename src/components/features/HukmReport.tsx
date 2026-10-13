// HukmReport — ustoz hisobot ekrani (tab'lar: Umumiy, Savollar, O'quvchilar)
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Users, TrendingUp, Target, Flag, AlertCircle, Download, X, ChevronDown, ChevronUp, BarChart2, Settings2, Tag } from 'lucide-react';
import { getSession, getAnalyticsSession, getAnalyticsGroup, getGradeScale, setGradeScale, setSessionGroup, getTagOptions } from '@/lib/hukmApi';
import ErrorBoundary from '@/components/ErrorBoundary';

const EASE = [0.22, 1, 0.36, 1] as const;

type TabKey = 'umumiy' | 'savollar' | 'oquvchilar' | 'guruh' | 'baho';

export function HukmReport({ sessionId, ustozId, onExit }: { sessionId: string; ustozId: string; onExit: () => void }) {
  return (
    <ErrorBoundary variant="local" onReset={onExit}>
      <HukmReportInner sessionId={sessionId} ustozId={ustozId} onExit={onExit} />
    </ErrorBoundary>
  );
}

function HukmReportInner({ sessionId, ustozId, onExit }: { sessionId: string; ustozId: string; onExit: () => void }) {
  const [tab, setTab] = useState<TabKey>('umumiy');
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [groupData, setGroupData] = useState<any>(null);
  const [gradeScale, setGradeScale] = useState<any>(null);
  const [tagOpts, setTagOpts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [showDifficult, setShowDifficult] = useState(false);
  const [groupLabel, setGroupLabel] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [sessResult, analyticsResult, scaleResult, tagsResult] = await Promise.all([
          getSession(sessionId, ustozId),
          getAnalyticsSession(sessionId, ustozId).catch(() => null),
          getGradeScale(ustozId).catch(() => null),
          getTagOptions(ustozId).catch(() => null),
        ]);
        setData(sessResult);
        setAnalytics(analyticsResult);
        setGradeScale(scaleResult?.scale || null);
        setTagOpts(tagsResult || null);
        if (sessResult?.session?.group_label) setGroupLabel(sessResult.session.group_label);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, ustozId]);

  const loadGroupData = async () => {
    try {
      const gd = await getAnalyticsGroup(ustozId);
      setGroupData(gd);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (tab === 'guruh' && !groupData) loadGroupData();
  }, [tab]);

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
  const perQuestion = analytics?.questions || data.per_question || [];
  const players = analytics?.students || data.players || [];
  const summary = data.summary || [];
  const guestCount = analytics?.guest_count || 0;

  const totalPlayers = session?.player_count || players.length;
  const avgCorrect = players.length > 0 ? Math.round(players.reduce((s: number, p: any) => s + (p.correct_pct || 0), 0) / players.length) : 0;
  const avgPoints = players.length > 0 ? Math.round(players.reduce((s: number, p: any) => s + (p.total_points || 0), 0) / players.length) : 0;
  const finishersPct = session?.finishers_pct || 0;

  const difficultQuestions = perQuestion.filter((q: any) => q.flags?.includes('review') || q.difficult).slice(0, 5);

  function handleCSV() {
    const aq = analytics?.questions || perQuestion;
    const header = [
      "O'rin", 'Ism', 'Ball', "To'g'ri %", 'Baho', 'Taxmin', 'Javoblar soni',
      ...aq.map((_: any, i: number) => `S${i + 1}`),
      ...aq.map((_: any, i: number) => `Vaqt${i + 1}(ms)`),
    ];
    const rows = [header];
    for (const p of players) {
      const ansMap: Record<number, any> = {};
    (p.answers || []).forEach((a: any) => { ansMap[a.question_index] = a; });
      const row = [
        p.rank || '',
        p.full_name || p.nickname || '',
        p.total_points || 0,
        `${p.correct_pct || 0}%`,
        p.grade || '',
        p.is_guess ? 'Taxmin' : '',
        p.total_answers || (p.answers || []).length,
        ...aq.map((q: any, i: number) => {
          const a = ansMap[i];
          if (!a) return '—';
          return a.correct ? 'T' : String.fromCharCode(65 + (a.choice ?? -1));
        }),
        ...aq.map((q: any, i: number) => {
          const a = ansMap[i];
          return a?.elapsed_ms != null ? a.elapsed_ms : '—';
        }),
      ];
      rows.push(row);
    }
    // Savol statistikasi qatori
    rows.push([]);
    rows.push(['Savol tahlili']);
    rows.push(['#', 'Savol', 'Kodeks', 'Mavzu', "To'g'ri %", 'D-indeks', 'Status', 'Eng ko\'p adashilgan']);
    aq.forEach((q: any, i: number) => {
      rows.push([
        i + 1,
        (q.text || '').slice(0, 50),
        q.kodeks_nomi || q.tag || '',
        q.mavzu || '',
        `${q.correct_pct ?? 0}%`,
        q.discrimination_index != null ? q.discrimination_index.toFixed(2) : '—',
        q.verdict || q.flags?.join(',') || '',
        q.most_common_wrong != null ? String.fromCharCode(65 + q.most_common_wrong) : '—',
      ]);
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Hukm-natijalar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleSaveGroup = async () => {
    setSavingGroup(true);
    try {
      await setSessionGroup(sessionId, ustozId, groupLabel.trim() || null);
    } catch (err) {
      console.error(err);
    }
    setSavingGroup(false);
  };

  const handleSaveScale = async (scale: string, t5: number, t4: number, t3: number) => {
    try {
      const result = await setGradeScale(ustozId, scale, t5, t4, t3);
      setGradeScale(result.scale);
    } catch (err) {
      console.error(err);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'umumiy', label: 'Umumiy', icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { key: 'savollar', label: 'Savollar', icon: <Target className="w-3.5 h-3.5" /> },
    { key: 'oquvchilar', label: "O'quvchilar", icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'guruh', label: 'Guruh', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: 'baho', label: 'Baho', icon: <Settings2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
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

      {/* Tab'lar */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
            style={{
              background: tab === t.key ? 'var(--cobalt-1)' : 'var(--panel-2)',
              color: tab === t.key ? 'white' : 'var(--ink-muted)',
              border: '1px solid var(--line)',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── UMUMIY TAB ── */}
      {tab === 'umumiy' && (
        <div>
          {/* Guruh belgilash */}
          <div className="flex items-center gap-2 mb-4 rounded-lg p-3" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
            <Tag className="w-4 h-4 shrink-0" style={{ color: 'var(--ink-muted)' }} />
            <input
              value={groupLabel}
              onChange={e => setGroupLabel(e.target.value)}
              placeholder="Guruh nomi (masalan: 2024-Yuridik-1)"
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: 'var(--ink)' }}
            />
            <button onClick={handleSaveGroup} disabled={savingGroup} className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{ background: 'var(--cobalt-1)', color: 'white' }}>
              {savingGroup ? '...' : 'Saqlash'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<Users className="w-4 h-4" />} label="Qatnashchilar" value={totalPlayers} />
            <StatCard icon={<Target className="w-4 h-4" />} label="O'rtacha to'g'ri" value={`${avgCorrect}%`} />
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="O'rtacha ball" value={avgPoints} />
            <StatCard icon={<Flag className="w-4 h-4" />} label="Tugatganlar" value={`${finishersPct}%`} />
          </div>

          {guestCount > 0 && (
            <p className="text-xs mb-4" style={{ color: 'var(--ink-muted)' }}>{guestCount} ta mehmon (talaba ro'yxatidan emas)</p>
          )}

          {summary.length > 0 && (
            <div className="rounded-xl p-4 mb-6" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
              <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>Xulosa</h3>
              {summary.map((s: string, i: number) => (
                <p key={i} className="text-sm mb-1" style={{ color: 'var(--ink-body)' }}>{'\u2022'} {s}</p>
              ))}
            </div>
          )}

          {/* Reyting — top 5 qisqa */}
          <div className="mb-6">
            <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Reyting (top 5)</h3>
            <div className="space-y-1.5">
              {players.slice(0, 5).map((p: any, i: number) => (
                <div key={p.player_id || i} className="rounded-lg p-3 flex items-center gap-3" style={{ background: i === 0 ? 'var(--gold-tint)' : 'var(--ff-card)', border: '1px solid var(--line)' }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: i === 0 ? 'var(--gold)' : 'var(--panel-2)', color: i === 0 ? 'white' : 'var(--ink)' }}>{i + 1}</span>
                  <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>{p.full_name || p.nickname}</span>
                  {p.grade && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: gradeColor(p.grade), color: 'white' }}>{p.grade}</span>}
                  <span className="text-sm font-bold" style={{ color: 'var(--gold-ink)' }}>{p.total_points}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{p.correct_pct}%</span>
                </div>
              ))}
            </div>
            {players.length > 5 && (
              <button onClick={() => setTab('oquvchilar')} className="text-xs mt-2 font-bold" style={{ color: 'var(--cobalt-1)' }}>Barchasini ko'rish ({players.length})</button>
            )}
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
      )}

      {/* ── SAVOLLAR TAB ── */}
      {tab === 'savollar' && (
        <div>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Savollar tahlili ({perQuestion.length})</h3>
          <div className="space-y-1.5">
            {[...perQuestion].sort((a: any, b: any) => (a.correct_pct ?? 100) - (b.correct_pct ?? 100)).map((q: any) => {
              const idx = q.question_index;
              const wrongPct = 100 - (q.correct_pct ?? 0);
              return (
                <div key={idx}>
                  <button
                    onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                    className="w-full rounded-lg p-3 text-left transition-all"
                    style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--ink-muted)' }}>{idx + 1}.</span>
                      {(q.kodeks_nomi || q.mavzu) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--panel-2)', color: 'var(--ink-muted)' }}>{q.kodeks_nomi || q.mavzu}</span>
                      )}
                      <span className="text-sm flex-1 truncate" style={{ color: 'var(--ink)' }}>{q.text}</span>
                      {q.flags?.includes('review') && <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: '#FEF2F2', color: '#C2303D' }}>Tekshiruv</span>}
                      {q.flags?.includes('easy') && <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: '#F0FDF4', color: '#12805C' }}>Oson</span>}
                      {q.flags?.includes('good') && <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: '#EFF6FF', color: '#2F6BE0' }}>Yaxshi</span>}
                    </div>
                    <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--panel-2)' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${q.correct_pct ?? 0}%` }} transition={{ duration: 0.5, ease: EASE }} style={{ background: 'var(--success)' }} />
                      <motion.div initial={{ width: 0 }} animate={{ width: `${wrongPct}%` }} transition={{ duration: 0.5, ease: EASE, delay: 0.1 }} style={{ background: wrongPct > 70 ? '#C2303D' : wrongPct > 50 ? 'var(--gold)' : 'var(--cobalt-1)' }} />
                    </div>
                    <div className="flex justify-between mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
                      <span>To'g'ri: {q.correct_pct ?? 0}%</span>
                      <span>Xato: {wrongPct}%</span>
                      {q.discrimination_index != null && <span>D: {q.discrimination_index.toFixed(2)}</span>}
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedQuestion === idx && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="p-3 space-y-2">
                          {q.options?.map((opt: any, oi: number) => {
                            const total = q.total_answers || q.total_players || 1;
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
                          {q.discrimination_index != null && (
                            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                              Farqlash indeksi (D): <b>{q.discrimination_index.toFixed(2)}</b>
                              {q.discrimination_index < 0.2 && ' — past farqlash (savol qayta ko\'rib chiqilishi kerak)'}
                              {q.discrimination_index >= 0.2 && q.discrimination_index < 0.4 && ' — o\'rtacha'}
                              {q.discrimination_index >= 0.4 && ' — yaxshi farqlash'}
                            </p>
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
      )}

      {/* ── O'QUVCHILAR TAB ── */}
      {tab === 'oquvchilar' && (
        <div>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>O'quvchilar ({players.length})</h3>
          <div className="space-y-1.5">
            {players.map((p: any, i: number) => (
              <div key={p.player_id || i}>
                <button
                  onClick={() => setExpandedPlayer(expandedPlayer === (p.player_id || i) ? null : (p.player_id || i))}
                  className="w-full rounded-lg p-3 flex items-center gap-3 transition-all"
                  style={{ background: i === 0 ? 'var(--gold-tint)' : 'var(--ff-card)', border: '1px solid var(--line)' }}
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: i === 0 ? 'var(--gold)' : 'var(--panel-2)', color: i === 0 ? 'white' : 'var(--ink)' }}>{i + 1}</span>
                  <div className="flex-1 text-left min-w-0">
                    <span className="text-sm font-semibold block truncate" style={{ color: 'var(--ink)' }}>{p.full_name || p.nickname}</span>
                    {p.is_guess && <span className="text-[10px] font-bold" style={{ color: '#C2303D' }}>Taxminiy javob</span>}
                    {p.needs_help && <span className="text-[10px] font-bold ml-1" style={{ color: '#F2A93B' }}>Yordam kerak</span>}
                  </div>
                  {p.grade && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: gradeColor(p.grade), color: 'white' }}>{p.grade}</span>}
                  <span className="text-sm font-bold" style={{ color: 'var(--gold-ink)' }}>{p.total_points}</span>
                  <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{p.correct_pct}%</span>
                  {expandedPlayer === (p.player_id || i) ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} />}
                </button>
                <AnimatePresence>
                  {expandedPlayer === (p.player_id || i) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="p-3 space-y-1">
                        {p.answers?.map((a: any, ai: number) => (
                          <div key={ai} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded" style={{ background: 'var(--panel-2)' }}>
                            <span className="font-bold w-6" style={{ color: 'var(--ink-muted)' }}>{ai + 1}.</span>
                            <span style={{ color: a.correct ? 'var(--success)' : '#C2303D' }}>{a.correct ? "To'g'ri" : "Noto'g'ri"}</span>
                            <span style={{ color: 'var(--ink-muted)' }}>— {a.choice !== null && a.choice !== undefined ? String.fromCharCode(65 + a.choice) : '—'}</span>
                            {a.elapsed_ms != null && <span style={{ color: 'var(--ink-muted)' }}>{(a.elapsed_ms / 1000).toFixed(1)}s</span>}
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
      )}

      {/* ── GURUH TAHLILI TAB ── */}
      {tab === 'guruh' && (
        <GroupTab data={groupData} loading={!groupData} onReload={loadGroupData} />
      )}

      {/* ── BAHO SHKALASI TAB ── */}
      {tab === 'baho' && (
        <GradeScaleTab scale={gradeScale} onSave={handleSaveScale} tags={tagOpts} />
      )}
    </div>
  );
}

// ── GURUH TAHLILI KOMPONENTI ──
function GroupTab({ data, loading, onReload }: { data: any; loading: boolean; onReload: () => void }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin mb-3" style={{ color: 'var(--cobalt-1)' }} />
        <button onClick={onReload} className="text-xs" style={{ color: 'var(--ink-muted)' }}>Qayta yuklash</button>
      </div>
    );
  }

  if (!data || !data.heat || data.heat.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ink-muted)', opacity: 0.3 }} />
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Guruh bo'yicha ma'lumot yo'q</p>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>O'quvchilarni talaba sifatida qo'shing va savollarga teglar qo'ying</p>
      </div>
    );
  }

  const { heat, tags, weak_topics, guest_count, groups } = data;

  return (
    <div className="space-y-6">
      {groups?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g: string) => (
            <span key={g} className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'var(--panel-2)', color: 'var(--ink)' }}>{g}</span>
          ))}
        </div>
      )}

      {guest_count > 0 && (
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{guest_count} ta mehmon hisobga olinmagan</p>
      )}

      {/* Issiqlik xaritasi */}
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Talaba × Mavzu issiqlik xaritasi</h3>
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--line)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--panel-2)' }}>
                <th className="text-left p-2 font-bold sticky left-0" style={{ color: 'var(--ink)' }}>Talaba</th>
                {tags.map((t: string) => (
                  <th key={t} className="p-2 font-bold text-center min-w-[80px]" style={{ color: 'var(--ink-muted)' }}>{t.slice(0, 12)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.map((row: any) => (
                <tr key={row.talaba_id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td className="p-2 font-semibold sticky left-0 whitespace-nowrap" style={{ background: 'var(--ff-card)', color: 'var(--ink)' }}>{row.name}</td>
                  {row.tags.map((cell: any, ci: number) => (
                    <td key={ci} className="p-2 text-center" style={{ background: heatBg(cell.correct_pct), color: cell.count > 0 ? (cell.correct_pct >= 50 ? '#fff' : '#C2303D') : 'var(--ink-muted)' }}>
                      {cell.count > 0 ? `${cell.correct_pct}%` : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: 'var(--ink-muted)' }}>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#12805C' }} /> 75%+</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#F2A93B' }} /> 50-74%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: '#C2303D' }} /> &lt;50%</span>
        </div>
      </div>

      {/* Zaif mavzular */}
      {weak_topics?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4" style={{ color: '#C2303D' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>Eng zaif mavzular (top 5)</h3>
          </div>
          <div className="space-y-2">
            {weak_topics.map((wt: any) => (
              <div key={wt.tag} className="rounded-lg p-3 flex items-center gap-3" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
                <span className="text-sm font-bold flex-1" style={{ color: 'var(--ink)' }}>{wt.tag}</span>
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{wt.student_count} ta talaba</span>
                <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{wt.answer_count} ta javob</span>
                <span className="text-sm font-bold px-2 py-0.5 rounded" style={{ background: heatBg(wt.correct_pct), color: 'white' }}>{wt.correct_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BAHO SHKALASI KOMPONENTI ──
function GradeScaleTab({ scale, onSave, tags }: { scale: any; onSave: (scale: string, t5: number, t4: number, t3: number) => void; tags: any }) {
  const [scaleType, setScaleType] = useState(scale?.scale || '5');
  const [t5, setT5] = useState(scale?.t5 ?? 86);
  const [t4, setT4] = useState(scale?.t4 ?? 71);
  const [t3, setT3] = useState(scale?.t3 ?? 55);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(scaleType, t5, t4, t3);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Baho shkalasi sozlamalari</h3>
        <div className="rounded-xl p-4 space-y-4" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
          <div>
            <label className="text-xs font-bold" style={{ color: 'var(--ink)' }}>Shkala turi</label>
            <div className="flex gap-2 mt-1.5">
              {['5', '4', '3'].map(s => (
                <button
                  key={s}
                  onClick={() => setScaleType(s)}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition"
                  style={{ background: scaleType === s ? 'var(--cobalt-1)' : 'var(--panel-2)', color: scaleType === s ? 'white' : 'var(--ink)', border: '1px solid var(--line)' }}
                >
                  {s} ballik
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(scaleType === '5' ? ['5 (A)', '4 (B)', '3 (C)'] : scaleType === '4' ? ['4 (A)', '3 (B)', '2 (C)'] : ['3 (A)', '2 (B)', '1 (C)']).map((label, i) => {
              const val = [t5, t4, t3][i];
              const setter = [setT5, setT4, setT3][i];
              return (
                <div key={i}>
                  <label className="text-xs font-bold" style={{ color: 'var(--ink)' }}>{label} min %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={val}
                    onChange={e => setter(parseInt(e.target.value) || 0)}
                    className="w-full mt-1.5 rounded-lg px-3 py-2 text-sm"
                    style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  />
                </div>
              );
            })}
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-bold" style={{ background: 'var(--cobalt-1)', color: 'white' }}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>

      {tags && (tags.kodeks?.length > 0 || tags.mavzu?.length > 0 || tags.groups?.length > 0) && (
        <div>
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--ink)' }}>Teglar va guruhlar</h3>
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
            {tags.kodeks?.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Kodekslar</p>
                <div className="flex flex-wrap gap-1">
                  {tags.kodeks.map((k: string) => <span key={k} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--panel-2)', color: 'var(--ink-muted)' }}>{k}</span>)}
                </div>
              </div>
            )}
            {tags.mavzu?.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Mavzular</p>
                <div className="flex flex-wrap gap-1">
                  {tags.mavzu.map((m: string) => <span key={m} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--panel-2)', color: 'var(--ink-muted)' }}>{m}</span>)}
                </div>
              </div>
            )}
            {tags.groups?.length > 0 && (
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Guruhlar</p>
                <div className="flex flex-wrap gap-1">
                  {tags.groups.map((g: string) => <span key={g} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--panel-2)', color: 'var(--ink-muted)' }}>{g}</span>)}
                </div>
              </div>
            )}
          </div>
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

function gradeColor(grade: string): string {
  const g = parseInt(grade);
  if (g >= 5) return '#12805C';
  if (g >= 4) return '#2F6BE0';
  if (g >= 3) return '#F2A93B';
  return '#C2303D';
}

function heatBg(pct: number): string {
  if (pct >= 75) return '#12805C';
  if (pct >= 50) return '#F2A93B';
  if (pct > 0) return '#C2303D';
  return 'var(--panel-2)';
}
