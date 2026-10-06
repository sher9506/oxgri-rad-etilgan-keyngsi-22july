// HukmHostScreen — ustoz ekrani (lobby, savol, reveal, leaderboard)
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import { Loader2, Users, Lock, Unlock, Play, ArrowRight, Eye, Trophy, Flag, UserX, X } from 'lucide-react';
import { getGameState, hostAction } from '@/lib/hukmApi';

const EASE = [0.22, 1, 0.36, 1] as const;

export function HukmHostScreen({ gameId, hostToken, quizTitle, onExit }: {
  gameId: string;
  hostToken: string;
  quizTitle: string;
  onExit: () => void;
}) {
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await getGameState(gameId, { host_token: hostToken });
      setState(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gameId, hostToken]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 1000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [poll]);

  useEffect(() => {
    const url = `${window.location.origin}/hukm`;
    QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: '#0D1B42', light: '#FFFFFF' } })
      .then(setQrUrl)
      .catch(() => {});
  }, []);

  async function act(action: string, body?: any) {
    try {
      await hostAction(gameId, action, hostToken, body);
      await poll();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--cobalt-1)' }} /></div>;
  }

  if (error && !state) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <p className="text-sm" style={{ color: '#C2303D' }}>{error}</p>
        <button onClick={onExit} className="mt-4 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--panel-2)' }}>Orqaga</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col items-center" style={{ background: 'var(--navy-1)' }}>
      {/* Header */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gold), var(--navy-3))' }}>
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="ff-serif text-lg text-white">{quizTitle}</h1>
            <p className="text-xs" style={{ color: 'var(--on-navy-muted)' }}>Hukm — jonli viktorina</p>
          </div>
        </div>
        <button onClick={onExit} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,.1)' }}>
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {state?.status === 'lobby' && (
          <Lobby key="lobby" state={state} qrUrl={qrUrl} onStart={() => act('start')} onLock={() => act('lock', { locked: !state.settings?.lobby_locked })} onKick={(pid) => act('kick', { player_id: pid })} />
        )}
        {state?.status === 'question' && (
          <QuestionView key="q" state={state} onNext={() => act('reveal')} />
        )}
        {state?.status === 'reveal' && (
          <RevealView key="reveal" state={state} onNext={() => act('leaderboard')} />
        )}
        {state?.status === 'leaderboard' && (
          <LeaderboardView key="lb" state={state} onNext={() => act('next')} />
        )}
        {state?.status === 'finished' && (
          <FinishedView key="fin" state={state} onExit={onExit} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Lobby ──────────────────────────────────────────────────────────────────────

function Lobby({ state, qrUrl, onStart, onLock, onKick }: {
  state: any;
  qrUrl: string;
  onStart: () => void;
  onLock: () => void;
  onKick: (pid: string) => void;
}) {
  const pin = state.pin;
  const pinStr = `${pin.slice(0, 3)} ${pin.slice(3)}`;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="w-full max-w-3xl flex flex-col items-center"
    >
      <p className="text-sm mb-2" style={{ color: 'var(--on-navy-muted)' }}>O'quvchilar quyidagi kod orqali qo'shilsin:</p>
      {/* Katta PIN */}
      <div className="ff-serif text-6xl md:text-8xl font-bold mb-4" style={{ color: 'var(--gold)' }}>
        {pinStr}
      </div>

      {/* QR */}
      {qrUrl && (
        <div className="rounded-2xl p-3 mb-4" style={{ background: 'white' }}>
          <img src={qrUrl} alt="QR" className="w-40 h-40" />
        </div>
      )}
      <p className="text-xs mb-6" style={{ color: 'var(--on-navy-muted)' }}>{window.location.origin}/hukm</p>

      {/* O'yinchilar */}
      <div className="w-full mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: 'var(--on-navy-muted)' }} />
            <span className="text-sm text-white font-semibold">{state.players?.length || 0} o'yinchi</span>
          </div>
          <button onClick={onLock} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,.1)' }}>
            {state.settings?.lobby_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {state.settings?.lobby_locked ? 'Qulflangan' : 'Qulflash'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.players?.map((p: any, i: number) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, ease: EASE }}
              className="flex items-center gap-2 px-3 py-2 rounded-full"
              style={{ background: 'rgba(255,255,255,.1)' }}
            >
              <span className="text-sm text-white">{p.nickname}</span>
              <button onClick={() => onKick(p.id)} className="opacity-50 hover:opacity-100">
                <UserX className="w-3.5 h-3.5" style={{ color: '#FF6B6B' }} />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Boshlash tugmasi */}
      <button
        onClick={onStart}
        disabled={(state.players?.length || 0) === 0}
        className="px-8 py-4 rounded-2xl font-bold text-base text-white flex items-center gap-2 transition-all"
        style={{
          background: (state.players?.length || 0) === 0 ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg, var(--gold), var(--gold-deep))',
          opacity: (state.players?.length || 0) === 0 ? 0.5 : 1,
        }}
      >
        <Play className="w-5 h-5" />
        O'yinni boshlash
      </button>
    </motion.div>
  );
}

// ── Savol ko'rinishi ───────────────────────────────────────────────────────────

function QuestionView({ state, onNext }: { state: any; onNext: () => void }) {
  const q = state.question;
  if (!q) return null;
  const correctIdx = state.correct_index;
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="w-full max-w-4xl"
    >
      <div className="text-center mb-4">
        <span className="text-sm" style={{ color: 'var(--on-navy-muted)' }}>
          Savol {(state.current_index || 0) + 1} / {state.total_questions}
        </span>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Users className="w-5 h-5" style={{ color: 'var(--gold)' }} />
          <span className="text-2xl font-bold text-white">{state.answered_count || 0}</span>
          <span className="text-sm" style={{ color: 'var(--on-navy-muted)' }}>/ {state.players?.length || 0} javob</span>
        </div>
      </div>

      <h2 className="ff-serif text-2xl md:text-4xl text-white text-center mb-8 px-4">{q.text}</h2>

      {/* 2x2 variantlar */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {q.options?.map((opt: any, i: number) => {
          const colors = [
            { bg: 'rgba(194,48,61,.2)', border: '#C2303D', shape: 'shield' },
            { bg: 'rgba(47,107,224,.2)', border: '#2F6BE0', shape: 'diamond' },
            { bg: 'rgba(18,128,92,.2)', border: '#12805C', shape: 'circle' },
            { bg: 'rgba(242,169,59,.2)', border: '#F2A93B', shape: 'square' },
          ];
          const c = colors[i] || colors[0];
          return (
            <div key={i} className="rounded-2xl p-6 flex items-center gap-3" style={{ background: c.bg, border: `2px solid ${c.border}` }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c.border }}>
                <span className="text-white font-bold text-sm">{String.fromCharCode(65 + i)}</span>
              </div>
              <span className="text-white text-sm md:text-base font-semibold">{opt.text}</span>
            </div>
          );
        })}
      </div>

      {/* Host uchun to'g'ri javob belgilanmagan — reveal'da ko'rinadi */}
      <div className="text-center">
        <button
          onClick={onNext}
          className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 mx-auto"
          style={{ background: 'rgba(255,255,255,.15)' }}
        >
          <Eye className="w-4 h-4" />
          Javoblarni ochish
        </button>
      </div>
    </motion.div>
  );
}

// ── Reveal ────────────────────────────────────────────────────────────────────

function RevealView({ state, onNext }: { state: any; onNext: () => void }) {
  const r = state.reveal;
  if (!r) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="w-full max-w-4xl"
    >
      <h2 className="ff-serif text-xl md:text-2xl text-white text-center mb-4 px-4">{r.text}</h2>

      {/* Taqsimot */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {r.options?.map((opt: any, i: number) => {
          const isCorrect = i === r.correct_index;
          const count = state.distribution?.[i] || 0;
          const total = state.distribution?.reduce((s: number, c: number) => s + c, 0) || 1;
          const pct = Math.round((count / total) * 100);
          const colors = ['#C2303D', '#2F6BE0', '#12805C', '#F2A93B'];
          return (
            <div key={i} className="rounded-xl p-4 relative overflow-hidden" style={{
              background: isCorrect ? `${colors[i]}30` : 'rgba(255,255,255,.05)',
              border: `2px solid ${isCorrect ? colors[i] : 'rgba(255,255,255,.15)'}`,
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm" style={{ color: colors[i] }}>{String.fromCharCode(65 + i)}</span>
                <span className="text-white text-sm flex-1">{opt.text}</span>
                {isCorrect && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--success)', color: 'white' }}>TO'G'RI</span>}
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.1)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, ease: EASE }}
                  style={{ height: '100%', background: colors[i] }}
                />
              </div>
              <span className="text-xs mt-1 block" style={{ color: 'var(--on-navy-muted)' }}>{count} ta ({pct}%)</span>
            </div>
          );
        })}
      </div>

      {/* Izoh va asos modda */}
      {(r.explanation || r.legal_basis) && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(255,255,255,.08)' }}>
          {r.explanation && <p className="text-sm text-white mb-1"><span className="font-semibold" style={{ color: 'var(--gold)' }}>Izoh: </span>{r.explanation}</p>}
          {r.legal_basis && <p className="text-sm text-white"><span className="font-semibold" style={{ color: 'var(--gold)' }}>Asos: </span>{r.legal_basis}</p>}
        </div>
      )}

      {/* Mini leaderboard */}
      {state.leaderboard && state.leaderboard.length > 0 && (
        <div className="mb-4 space-y-1">
          {state.leaderboard.slice(0, 3).map((p: any, i: number) => (
            <div key={p.player_id} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: i === 0 ? 'rgba(201,154,59,.2)' : 'rgba(255,255,255,.05)' }}>
              <span className="text-sm text-white">{i + 1}. {p.nickname}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{p.total_points}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-center">
        <button onClick={onNext} className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 mx-auto" style={{ background: 'rgba(255,255,255,.15)' }}>
          <Trophy className="w-4 h-4" />
          Reyting
        </button>
      </div>
    </motion.div>
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

function LeaderboardView({ state, onNext }: { state: any; onNext: () => void }) {
  const board = state.leaderboard || [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="w-full max-w-2xl"
    >
      <h2 className="ff-serif text-2xl text-white text-center mb-6">Reyting</h2>
      <div className="space-y-2 mb-6">
        {board.map((p: any, i: number) => (
          <motion.div
            key={p.player_id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, ease: EASE }}
            className="flex items-center justify-between px-4 py-3 rounded-xl"
            style={{ background: i === 0 ? 'rgba(201,154,59,.2)' : 'rgba(255,255,255,.05)', border: i === 0 ? '1px solid rgba(201,154,59,.4)' : '1px solid rgba(255,255,255,.1)' }}
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: i === 0 ? 'var(--gold)' : 'rgba(255,255,255,.15)' }}>{i + 1}</span>
              <span className="text-sm text-white">{p.nickname}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--gold)' }}>{p.total_points}</span>
          </motion.div>
        ))}
      </div>
      <div className="text-center">
        <button onClick={onNext} className="px-6 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 mx-auto" style={{ background: 'rgba(255,255,255,.15)' }}>
          <ArrowRight className="w-4 h-4" />
          {state.current_index + 1 >= state.total_questions ? 'Yakunlash' : 'Keyingi savol'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Finished ───────────────────────────────────────────────────────────────────

function FinishedView({ state, onExit }: { state: any; onExit: () => void }) {
  const board = state.leaderboard || [];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="w-full max-w-2xl"
    >
      <h2 className="ff-serif text-3xl text-white text-center mb-6">O'yin tugadi</h2>
      {/* Podium */}
      {board.length >= 3 && (
        <div className="flex items-end justify-center gap-2 mb-6">
          <PodiumCol rank={2} nickname={board[1]?.nickname} points={board[1]?.total_points} height={100} color="rgba(255,255,255,.2)" />
          <PodiumCol rank={1} nickname={board[0]?.nickname} points={board[0]?.total_points} height={140} color="var(--gold)" />
          <PodiumCol rank={3} nickname={board[2]?.nickname} points={board[2]?.total_points} height={80} color="rgba(255,255,255,.15)" />
        </div>
      )}
      <div className="space-y-1 mb-6">
        {board.slice(3).map((p: any, i: number) => (
          <div key={p.player_id} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,.05)' }}>
            <span className="text-sm text-white">{i + 4}. {p.nickname}</span>
            <span className="text-sm" style={{ color: 'var(--on-navy-muted)' }}>{p.total_points}</span>
          </div>
        ))}
      </div>
      <div className="text-center">
        <button onClick={onExit} className="px-6 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: 'rgba(255,255,255,.15)' }}>
          Hisobotga
        </button>
      </div>
    </motion.div>
  );
}

function PodiumCol({ rank, nickname, points, height, color }: { rank: number; nickname: string; points: number; height: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-white mb-1 max-w-[80px] truncate">{nickname}</span>
      <span className="text-sm font-bold mb-2" style={{ color: 'var(--gold)' }}>{points}</span>
      <motion.div
        initial={{ height: 0 }}
        animate={{ height }}
        transition={{ duration: 0.5, ease: EASE, delay: rank * 0.1 }}
        className="w-20 rounded-t-lg flex items-start justify-center pt-2"
        style={{ background: color }}
      >
        <span className="text-lg font-bold text-white">{rank}</span>
      </motion.div>
    </div>
  );
}
