// HukmOquvchi — o'quvchi ekrani (PIN kirish, savol, natija, xatolar)
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gavel, Loader2, CheckCircle2, XCircle, Trophy, BookOpen, ArrowRight, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { joinGame, getGameState, submitAnswer, getMistakes } from '@/lib/hukmApi';

const EASE = [0.22, 1, 0.36, 1] as const;

// Javob ranglari va shakllari
const ANSWER_STYLES = [
  { color: '#C2303D', name: 'qalqon' },
  { color: '#2F6BE0', name: 'olmos' },
  { color: '#12805C', name: 'doira' },
  { color: '#F2A93B', name: 'kvadrat' },
];

export function HukmOquvchi({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [screen, setScreen] = useState<'pin' | 'lobby' | 'question' | 'waiting' | 'reveal' | 'finished' | 'mistakes'>('pin');
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState('');
  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerToken, setPlayerToken] = useState('');
  const [state, setState] = useState<any>(null);
  const [myChoice, setMyChoice] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const talabaId = user?.talaba_id || '';
  const defaultNick = user ? `${user.ism || ''} ${user.familiya || ''}`.trim() : '';

  useEffect(() => {
    if (!nickname && defaultNick) setNickname(defaultNick);
  }, [defaultNick]);

  const poll = useCallback(async () => {
    if (!gameId || !playerId || !playerToken) return;
    try {
      const data = await getGameState(gameId, { player_token: playerToken, player_id: playerId });
      setState(data);
      setError('');
      // Ekran holatini yangilash
      if (data.status === 'lobby') setScreen('lobby');
      else if (data.status === 'question') {
        setScreen('question');
        setMyChoice(data.my_answer ?? null);
      } else if (data.status === 'reveal') {
        setScreen('reveal');
      } else if (data.status === 'leaderboard') {
        setScreen('reveal'); // leaderboard ham reveal ko'rinishida
      } else if (data.status === 'finished') {
        setScreen('finished');
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    } catch (err: any) {
      // network xato — davom et
    }
  }, [gameId, playerId, playerToken]);

  useEffect(() => {
    if (gameId && playerId && playerToken && screen !== 'finished' && screen !== 'pin') {
      if (!pollRef.current) {
        pollRef.current = setInterval(poll, 1000);
      }
    }
    return () => {
      if (pollRef.current && (screen === 'finished' || screen === 'pin')) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [gameId, playerId, playerToken, screen, poll]);

  async function handleJoin() {
    if (!talabaId) {
      toast({ title: 'Kirish kerak', description: 'Avval tizimga kiring', variant: 'destructive' });
      return;
    }
    if (pin.length !== 6) {
      toast({ title: 'PIN noto\'g\'ri', description: '6 raqamli kod kiriting' });
      return;
    }
    setJoining(true);
    setError('');
    try {
      const data = await joinGame(pin, nickname || defaultNick || 'O\'yinchi', talabaId);
      setGameId(data.game_id);
      setPlayerId(data.player.id);
      setPlayerToken(data.player_token);
      setScreen('lobby');
      poll();
    } catch (err: any) {
      setError(err.message);
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setJoining(false);
    }
  }

  async function handleAnswer(choice: number) {
    if (myChoice !== null) return; // already answered
    setMyChoice(choice);
    setScreen('waiting');
    try {
      await submitAnswer(gameId, playerId, playerToken, choice);
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
      setMyChoice(null);
      setScreen('question');
    }
  }

  async function handleShowMistakes() {
    try {
      const data = await getMistakes(gameId, playerId, playerToken);
      setMistakes(data.mistakes || []);
      setScreen('mistakes');
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    }
  }

  // ── PIN kiritish ekrani ──
  if (screen === 'pin') {
    return (
      <div className="max-w-md mx-auto p-4 md:p-6 min-h-[60vh] flex flex-col justify-center">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, var(--navy-1), var(--gold))' }}>
            <Gavel className="w-8 h-8 text-white" />
          </div>
          <h1 className="ff-serif text-2xl mb-2" style={{ color: 'var(--ink)' }}>Hukm</h1>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Ustozingiz bergan kod orqali viktorinaga qo'shiling</p>
        </div>

        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 raqamli kod"
          inputMode="numeric"
          className="w-full px-4 py-4 rounded-xl text-2xl text-center font-bold tracking-[0.3em] outline-none mb-3"
          style={{ background: 'var(--ff-card)', border: '2px solid var(--line)', color: 'var(--ink)' }}
        />
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value.slice(0, 20))}
          placeholder="Ismingiz (ixtiyoriy)"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />

        {error && <p className="text-sm text-center mb-3" style={{ color: '#C2303D' }}>{error}</p>}

        <button
          onClick={handleJoin}
          disabled={joining || pin.length !== 6}
          className="w-full py-4 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
          style={{
            background: pin.length === 6 ? 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' : 'var(--panel-2)',
            opacity: pin.length === 6 ? 1 : 0.5,
          }}
        >
          {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          Qo'shilish
        </button>
      </div>
    );
  }

  // ── Lobby (kutish) ──
  if (screen === 'lobby') {
    return (
      <div className="max-w-md mx-auto p-6 min-h-[60vh] flex flex-col justify-center items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: 'var(--cobalt-1)' }} />
          <h2 className="ff-serif text-xl mb-2" style={{ color: 'var(--ink)' }}>Lobby'da kutyapsiz</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>O'yin boshlanishini kuting.</p>
          <div className="rounded-xl p-4" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>O'yinchilar soni:</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{state?.players?.length || 0}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Savol ekrani ──
  if (screen === 'question' || screen === 'waiting') {
    const q = state?.question;
    if (!q) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cobalt-1)' }} /></div>;

    return (
      <div className="max-w-md mx-auto p-4 min-h-[80vh] flex flex-col">
        <div className="text-center mb-3">
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>Savol {(state.current_index || 0) + 1} / {state.total_questions}</span>
        </div>

        {/* Taymer chizig'i */}
        <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'var(--panel-2)' }}>
          <TimerBar key={state.current_index} timeLimit={q.time_limit_s || 20} />
        </div>

        {/* Savol matni */}
        {q.text && (
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="ff-serif text-lg md:text-xl mb-6 text-center"
            style={{ color: 'var(--ink)' }}
          >
            {q.text}
          </motion.h2>
        )}

        {/* 4 ta javob tugmasi */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {q.options?.map((opt: any, i: number) => {
            const s = ANSWER_STYLES[i] || ANSWER_STYLES[0];
            const selected = myChoice === i;
            const answered = myChoice !== null;
            return (
              <motion.button
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05, ease: EASE }}
                onClick={() => handleAnswer(i)}
                disabled={answered}
                className="rounded-2xl p-4 flex flex-col items-center justify-center gap-2 transition-all min-h-[120px]"
                style={{
                  background: selected ? s.color : `${s.color}15`,
                  border: `2px solid ${s.color}`,
                  opacity: answered && !selected ? 0.4 : 1,
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color }}>
                  <span className="text-white font-bold text-sm">{String.fromCharCode(65 + i)}</span>
                </div>
                <span className="text-sm font-semibold text-center" style={{ color: selected ? 'white' : 'var(--ink)' }}>{opt.text}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Javob qabul qilindi */}
        {screen === 'waiting' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
          >
            <CheckCircle2 className="w-8 h-8 mx-auto mb-1" style={{ color: 'var(--success)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Javob qabul qilindi</p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Boshqa o'yinchilar javobini kutmoqda...</p>
          </motion.div>
        )}
      </div>
    );
  }

  // ── Reveal (natija) ──
  if (screen === 'reveal') {
    const r = state?.reveal;
    if (!r) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cobalt-1)' }} /></div>;
    const myResult = state?.my_result;
    const isCorrect = myResult?.correct;

    return (
      <div className="max-w-md mx-auto p-4 min-h-[80vh] flex flex-col">
        {/* Natija belgisi */}
        {myResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="text-center mb-4"
          >
            {isCorrect ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'var(--success-tint)' }}>
                <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--success)' }} />
                <span className="font-bold text-sm" style={{ color: 'var(--success)' }}>To'g'ri! +{myResult.points} ball</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: '#FEF2F2' }}>
                <XCircle className="w-5 h-5" style={{ color: '#C2303D' }} />
                <span className="font-bold text-sm" style={{ color: '#C2303D' }}>Noto'g'ri</span>
              </div>
            )}
          </motion.div>
        )}

        <h2 className="ff-serif text-lg mb-4 text-center" style={{ color: 'var(--ink)' }}>{r.text}</h2>

        {/* Variantlar to'g'ri/noto'g'ri belgi bilan */}
        <div className="space-y-2 mb-4">
          {r.options?.map((opt: any, i: number) => {
            const isCorrectOpt = i === r.correct_index;
            const myPick = myChoice === i;
            const s = ANSWER_STYLES[i] || ANSWER_STYLES[0];
            return (
              <div
                key={i}
                className="rounded-xl p-3 flex items-center gap-2 transition-all"
                style={{
                  background: isCorrectOpt ? 'var(--success-tint)' : myPick ? '#FEF2F2' : 'var(--panel-2)',
                  border: `2px solid ${isCorrectOpt ? 'var(--success)' : myPick ? '#C2303D' : 'var(--line)'}`,
                }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.color }}>
                  <span className="text-white font-bold text-xs">{String.fromCharCode(65 + i)}</span>
                </div>
                <span className="text-sm flex-1" style={{ color: 'var(--ink)' }}>{opt.text}</span>
                {isCorrectOpt && <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--success)' }} />}
                {myPick && !isCorrectOpt && <XCircle className="w-5 h-5" style={{ color: '#C2303D' }} />}
              </div>
            );
          })}
        </div>

        {/* Izoh va asos modda */}
        {(r.explanation || r.legal_basis) && (
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--cobalt-tint)', border: '1px solid var(--cobalt-line)' }}>
            {r.explanation && <p className="text-sm mb-2" style={{ color: 'var(--ink-body)' }}><b>Izoh:</b> {r.explanation}</p>}
            {r.legal_basis && <p className="text-sm" style={{ color: 'var(--gold-ink)' }}><b>Asos modda:</b> {r.legal_basis}</p>}
          </div>
        )}

        {/* Mini reyting */}
        {state?.leaderboard && state.leaderboard.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--ink-muted)' }}>Reyting</p>
            {state.leaderboard.slice(0, 5).map((p: any, i: number) => (
              <div key={p.player_id} className="flex items-center justify-between px-3 py-1.5 rounded-lg mb-1" style={{
                background: p.player_id === playerId ? 'var(--gold-tint)' : 'var(--panel-2)',
              }}>
                <span className="text-sm" style={{ color: 'var(--ink)' }}>{i + 1}. {p.nickname}{p.player_id === playerId ? ' (Siz)' : ''}</span>
                <span className="text-sm font-bold" style={{ color: 'var(--gold-ink)' }}>{p.total_points}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--ink-muted)' }}>Keyingi savolni kuting...</p>
      </div>
    );
  }

  // ── Yakuniy natija ──
  if (screen === 'finished') {
    const board = state?.leaderboard || [];
    const myEntry = board.find((p: any) => p.player_id === playerId);
    const myRank = board.findIndex((p: any) => p.player_id === playerId) + 1;

    return (
      <div className="max-w-md mx-auto p-4 min-h-[80vh] flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="text-center mb-6"
        >
          <Trophy className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--gold)' }} />
          <h2 className="ff-serif text-2xl mb-2" style={{ color: 'var(--ink)' }}>O'yin tugadi</h2>
          {myEntry && (
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl" style={{ background: 'var(--gold-tint)' }}>
              <div>
                <p className="text-xs" style={{ color: 'var(--gold-ink)' }}>O'rin</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{myRank}</p>
              </div>
              <div className="w-px h-10" style={{ background: 'var(--gold)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--gold-ink)' }}>Ball</p>
                <p className="text-2xl font-bold" style={{ color: 'var(--gold)' }}>{myEntry.total_points}</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Top 5 */}
        <div className="space-y-1.5 mb-6">
          {board.slice(0, 5).map((p: any, i: number) => (
            <div key={p.player_id} className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{
              background: p.player_id === playerId ? 'var(--gold-tint)' : 'var(--ff-card)',
              border: '1px solid var(--line)',
            }}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: i === 0 ? 'var(--gold)' : 'var(--panel-2)', color: i === 0 ? 'white' : 'var(--ink)' }}>{i + 1}</span>
              <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>{p.nickname}{p.player_id === playerId ? ' (Siz)' : ''}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--gold-ink)' }}>{p.total_points}</span>
            </div>
          ))}
        </div>

        {/* Tugmalar */}
        <div className="space-y-2">
          <button
            onClick={handleShowMistakes}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            <BookOpen className="w-4 h-4" />
            Xatolarim
          </button>
          <button
            onClick={() => { setScreen('pin'); setPin(''); setGameId(''); setPlayerId(''); setPlayerToken(''); setState(null); setMyChoice(null); }}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: 'var(--cobalt-1)' }}
          >
            <Home className="w-4 h-4" />
            Bosh o'yinga qaytish
          </button>
        </div>
      </div>
    );
  }

  // ── Xatolarim ──
  if (screen === 'mistakes') {
    return (
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setScreen('finished')} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
            <ArrowRight className="w-4 h-4 rotate-180" style={{ color: 'var(--ink)' }} />
          </button>
          <h1 className="ff-serif text-xl" style={{ color: 'var(--ink)' }}>Xatolarim</h1>
        </div>

        {mistakes.length === 0 ? (
          <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--success-tint)', border: '1px solid var(--success)' }}>
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--success)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>Hamma savolga to'g'ri javob berdingiz!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mistakes.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, ease: EASE }}
                className="rounded-xl p-4"
                style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}
              >
                <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{m.question_index + 1}. {m.text}</p>
                <div className="space-y-1 mb-2">
                  {m.options?.map((opt: any, oi: number) => {
                    const isCorrect = oi === m.correct_index;
                    const myPick = m.my_choice === oi;
                    return (
                      <div key={oi} className="flex items-center gap-2 text-xs">
                        <span className="font-bold" style={{ color: isCorrect ? 'var(--success)' : myPick ? '#C2303D' : 'var(--ink-muted)' }}>
                          {String.fromCharCode(65 + oi)})
                        </span>
                        <span style={{ color: isCorrect ? 'var(--success)' : myPick ? '#C2303D' : 'var(--ink-body)' }}>
                          {opt.text}
                        </span>
                        {isCorrect && <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success)' }} />}
                        {myPick && !isCorrect && <XCircle className="w-3 h-3" style={{ color: '#C2303D' }} />}
                      </div>
                    );
                  })}
                </div>
                {m.explanation && <p className="text-xs mb-1" style={{ color: 'var(--ink-body)' }}><b>Izoh:</b> {m.explanation}</p>}
                {m.legal_basis && <p className="text-xs" style={{ color: 'var(--gold-ink)' }}><b>Asos:</b> {m.legal_basis}</p>}
              </motion.div>
            ))}
          </div>
        )}

        <button
          onClick={() => { setScreen('pin'); setPin(''); setGameId(''); setPlayerId(''); setPlayerToken(''); setState(null); setMyChoice(null); setMistakes([]); }}
          className="w-full mt-6 py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--cobalt-1)' }}
        >
          Bosh o'yinga qaytish
        </button>
      </div>
    );
  }

  return null;
}

// Timer bar komponenti
function TimerBar({ timeLimit }: { timeLimit: number }) {
  const reduceMotion = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return (
    <motion.div
      initial={reduceMotion.current ? undefined : { width: '100%' }}
      animate={reduceMotion.current ? undefined : { width: '0%' }}
      transition={{ duration: timeLimit, ease: 'linear' }}
      style={{
        height: '100%',
        width: reduceMotion.current ? '50%' : '100%',
        background: 'linear-gradient(90deg, var(--success), var(--gold), #C2303D)',
        borderRadius: 'inherit',
      }}
    />
  );
}
