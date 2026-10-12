import { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Loader2, ChevronLeft, CheckCircle, XCircle, Clock, Users, Award, AlertCircle, RotateCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type GameView = 'join' | 'lobby' | 'question' | 'answered' | 'reveal' | 'leaderboard' | 'finished' | 'mistakes';

const ANSWER_COLORS = ['#C2303D', '#2F6BE0', '#12805C', '#F2A93B'];
const ANSWER_TEXT_COLORS = ['#fff', '#fff', '#fff', '#1A1205'];
const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

async function hukmFetch(path: string, method = 'GET', body?: any) {
  const url = `${supabaseUrl}/functions/v1/hukm-api/${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

interface Mistake {
  question_index: number;
  text: string;
  my_choice: number;
  correct_index: number;
  options: { text: string }[];
  explanation: string;
  legal_basis: string;
}

export default function HukmOquvchi({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const talabaId = user?.talaba_id || '';
  const defaultNick = user ? `${user.ism} ${user.familiya}`.trim() : '';

  const [view, setView] = useState<GameView>('join');
  const [pin, setPin] = useState('');
  const [nickname, setNickname] = useState(defaultNick);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [gameId, setGameId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerToken, setPlayerToken] = useState('');
  const [gameState, setGameState] = useState<any>(null);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [myResult, setMyResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerPct, setTimerPct] = useState(1);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [mistakesLoading, setMistakesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyAnswered, setAlreadyAnswered] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQuestionIndexRef = useRef<number>(-1);
  const lastStatusRef = useRef<string>('');

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const fetchGameState = useCallback(async () => {
    if (!gameId || !playerId || !playerToken) return;
    const data = await hukmFetch(`game/${gameId}?player_id=${playerId}&player_token=${playerToken}`);
    if (!data?.id) return;
    setGameState(data);

    const status = data.status;
    const qIdx = data.current_index;

    // Reset per-question state when new question arrives
    if (qIdx !== lastQuestionIndexRef.current && status === 'question') {
      lastQuestionIndexRef.current = qIdx;
      setMyAnswer(null);
      setMyResult(null);
      setAlreadyAnswered(data.my_answer !== undefined && data.my_answer !== null);
      const limit = data.question?.time_limit_s || 20;
      setTimeLeft(limit);
      setTimerPct(1);
      stopTimer();
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const next = Math.max(0, prev - 1);
          setTimerPct(next / limit);
          return next;
        });
      }, 1000);
    }

    if (status !== lastStatusRef.current) {
      lastStatusRef.current = status;
      if (status === 'lobby') setView('lobby');
      else if (status === 'question') {
        setView(data.my_answer !== undefined && data.my_answer !== null ? 'answered' : 'question');
      }
      else if (status === 'reveal') {
        stopTimer();
        setMyResult(data.my_result || null);
        setView('reveal');
      }
      else if (status === 'leaderboard') setView('leaderboard');
      else if (status === 'finished') { setView('finished'); stopPolling(); stopTimer(); }
    } else if (status === 'question' && data.my_answer !== undefined && data.my_answer !== null) {
      setAlreadyAnswered(true);
      setView('answered');
    }
  }, [gameId, playerId, playerToken]);

  useEffect(() => {
    if (!gameId || !playerId || !playerToken) return;
    fetchGameState();
    stopPolling();
    pollRef.current = setInterval(fetchGameState, 2000);
    return () => { stopPolling(); stopTimer(); };
  }, [gameId, playerId, playerToken, fetchGameState]);

  const handleJoin = async () => {
    if (!pin.trim() || pin.trim().length !== 6) { setJoinError("PIN 6 raqamdan iborat bo'lishi kerak"); return; }
    if (!nickname.trim()) { setJoinError('Ismingizni kiriting'); return; }
    if (!talabaId) { setJoinError("Kirish kerak. Iltimos, tizimga kiring."); return; }
    setJoining(true);
    setJoinError('');
    const data = await hukmFetch('game/join', 'POST', { pin: pin.trim(), nickname: nickname.trim(), talaba_id: talabaId });
    setJoining(false);
    if (data?.player && data?.game_id && data?.player_token) {
      setGameId(data.game_id);
      setPlayerId(data.player.id);
      setPlayerToken(data.player_token);
      lastStatusRef.current = '';
      lastQuestionIndexRef.current = -1;
    } else {
      setJoinError(data?.error || "Qo'shilmadi. Qayta urinib ko'ring.");
    }
  };

  const handleAnswer = async (choice: number) => {
    if (alreadyAnswered || submitting || myAnswer !== null) return;
    setMyAnswer(choice);
    setSubmitting(true);
    stopTimer();
    const data = await hukmFetch(`game/${gameId}/answer`, 'POST', { player_id: playerId, player_token: playerToken, choice });
    setSubmitting(false);
    if (data?.received) {
      setView('answered');
      setAlreadyAnswered(true);
    } else {
      toast({ title: data?.error || 'Javob qabul qilinmadi', variant: 'destructive' });
      setMyAnswer(null);
    }
  };

  const handleLoadMistakes = async () => {
    setMistakesLoading(true);
    const data = await hukmFetch(`game/${gameId}/mistakes?player_id=${playerId}&player_token=${playerToken}`);
    setMistakesLoading(false);
    if (data?.mistakes) {
      setMistakes(data.mistakes);
      setView('mistakes');
    } else {
      toast({ title: data?.error || 'Xatolar yuklanmadi', variant: 'destructive' });
    }
  };

  const players = gameState?.players || [];
  const question = gameState?.question;
  const reveal = gameState?.reveal;
  const leaderboard = gameState?.leaderboard || [];
  const totalQ = gameState?.total_questions || 0;
  const currentIdx = gameState?.current_index ?? 0;

  // ── JOIN VIEW ───────────────────────────────────────────────────────────────
  if (view === 'join') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
              <Trophy className="h-7 w-7 text-amber-300" />
            </div>
            <h1 className="text-xl font-black" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>Hukm Viktorinasi</h1>
            <p className="text-sm text-gray-500">PIN kodni kiriting va o'yinga qo'shiling</p>
          </div>

          {!talabaId && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium text-amber-700">O'yinga kirish uchun tizimga kiring</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-bold">PIN kod</Label>
              <Input
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setJoinError(''); }}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                className="mt-1.5 rounded-xl text-center text-2xl font-black tracking-[0.3em]"
                style={{ color: '#2563eb' }}
                onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Taxallus (laqab)</Label>
              <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Ismingiz" className="mt-1.5 rounded-xl" onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }} />
            </div>
            {joinError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <p className="text-xs text-red-700">{joinError}</p>
              </div>
            )}
            <Button onClick={handleJoin} disabled={joining || !talabaId} className="w-full rounded-xl shadow-md shadow-blue-500/15" style={{ minHeight: '52px' }}>
              {joining ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {joining ? 'Qo\'shilmoqda...' : 'O\'yinga kirish'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── LOBBY VIEW ──────────────────────────────────────────────────────────────
  if (view === 'lobby') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 space-y-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
          <Trophy className="h-8 w-8 text-amber-300" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-lg font-black" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>O'yin kutilmoqda</h2>
          <p className="text-sm text-gray-500">Ustoz o'yinni boshlaguncha kuting</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-2.5">
          <Users className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-bold text-blue-700">{players.length} ta o'yinchi qo'shildi</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
          {players.slice(0, 12).map((p: any) => (
            <span key={p.id} className={`text-xs font-bold px-3 py-1 rounded-full ${p.id === playerId ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600'}`}>{p.nickname}</span>
          ))}
          {players.length > 12 && <span className="text-xs text-gray-400 px-2 py-1">+{players.length - 12}</span>}
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Kutilmoqda...</span>
        </div>
      </div>
    );
  }

  // ── QUESTION VIEW ───────────────────────────────────────────────────────────
  if (view === 'question' && question) {
    const circumference = 2 * Math.PI * 22;
    const offset = circumference * (1 - timerPct);
    const timerColor = timerPct > 0.5 ? '#22c55e' : timerPct > 0.25 ? '#f59e0b' : '#ef4444';

    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs">{currentIdx + 1} / {totalQ}</Badge>
          <svg width="52" height="52" className="shrink-0">
            <circle cx="26" cy="26" r="22" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="26" cy="26" r="22" fill="none" stroke={timerColor} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 26 26)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
            <text x="26" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1f2937">{timeLeft}</text>
          </svg>
        </div>

        {/* Question text */}
        {question.case_text && (
          <div className="rounded-2xl bg-amber-50/80 border border-amber-100/60 px-4 py-3">
            <p className="text-xs text-gray-600 leading-relaxed">{question.case_text}</p>
          </div>
        )}
        <div className="rounded-2xl bg-white border border-gray-100/80 shadow-sm px-4 py-4">
          <p className="text-base font-bold text-gray-900 leading-snug">{question.text}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-2.5">
          {(question.options || []).map((o: any, i: number) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={submitting || myAnswer !== null}
              className="flex items-center gap-3 rounded-2xl px-4 font-bold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-70"
              style={{
                background: myAnswer === i ? `${ANSWER_COLORS[i]}dd` : ANSWER_COLORS[i],
                color: ANSWER_TEXT_COLORS[i],
                minHeight: '64px',
                boxShadow: myAnswer === i ? `0 4px 16px ${ANSWER_COLORS[i]}60` : `0 2px 8px ${ANSWER_COLORS[i]}30`,
              }}
              aria-label={`${ANSWER_LABELS[i]} variantini tanlash`}
            >
              <span className="w-8 h-8 rounded-xl bg-black/15 flex items-center justify-center text-xs font-black shrink-0">{ANSWER_LABELS[i]}</span>
              <span className="flex-1 text-left">{o.text}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── ANSWERED VIEW ───────────────────────────────────────────────────────────
  if (view === 'answered') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <div className="text-center">
          <h2 className="text-base font-black" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>Javob qabul qilindi!</h2>
          <p className="text-sm text-gray-500 mt-1">Natija kutilmoqda...</p>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Boshqalar javob berishini kuting</span>
        </div>
      </div>
    );
  }

  // ── REVEAL VIEW ─────────────────────────────────────────────────────────────
  if (view === 'reveal' && reveal) {
    const isCorrect = myResult?.correct;
    const pointsEarned = myResult?.points || 0;

    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* My result */}
        <div className={`rounded-3xl p-5 text-center space-y-2 border-2 ${isCorrect ? 'bg-green-50 border-green-200' : myResult ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          {isCorrect !== undefined ? (
            <>
              <div className="flex justify-center">
                {isCorrect ? <CheckCircle className="h-10 w-10 text-green-500" /> : <XCircle className="h-10 w-10 text-red-400" />}
              </div>
              <p className="text-lg font-black" style={{ color: isCorrect ? '#166534' : '#991b1b' }}>
                {isCorrect ? 'To\'g\'ri!' : 'Noto\'g\'ri'}
              </p>
              {isCorrect && pointsEarned > 0 && (
                <p className="text-2xl font-black" style={{ color: '#2563eb' }}>+{pointsEarned}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 font-medium">Javob berilmadi</p>
          )}
        </div>

        {/* Correct answer */}
        <div className="grid grid-cols-1 gap-2">
          {(reveal.options || []).map((o: any, i: number) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-2xl px-4 border-2 font-bold text-sm ${i === reveal.correct_index ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-400 opacity-60'}`}
              style={{ minHeight: '52px' }}
            >
              <span className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 text-white" style={{ background: ANSWER_COLORS[i] || '#666' }}>{ANSWER_LABELS[i]}</span>
              <span className="flex-1">{o.text}</span>
              {i === reveal.correct_index && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
            </div>
          ))}
        </div>

        {/* Explanation */}
        {reveal.explanation && (
          <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 space-y-1">
            <p className="text-[11px] font-bold text-blue-600">Izoh</p>
            <p className="text-xs text-gray-700 leading-relaxed">{reveal.explanation}</p>
          </div>
        )}
        {reveal.legal_basis && (
          <p className="text-xs text-blue-600 font-medium px-1">📋 Asos: {reveal.legal_basis}</p>
        )}

        <div className="flex items-center gap-2 justify-center text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Keyingi savolni kuting</span>
        </div>
      </div>
    );
  }

  // ── LEADERBOARD VIEW ────────────────────────────────────────────────────────
  if (view === 'leaderboard') {
    const myRank = leaderboard.findIndex((p: any) => p.player_id === playerId) + 1;
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="text-center space-y-1">
          <Trophy className="h-8 w-8 text-amber-500 mx-auto" />
          <h2 className="text-lg font-black" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>Oraliq reyting</h2>
          {myRank > 0 && <p className="text-sm text-blue-600 font-bold">Sizning o'rningiz: {myRank}-o'rin</p>}
        </div>
        <div className="space-y-2">
          {leaderboard.slice(0, 5).map((p: any, i: number) => (
            <div key={p.player_id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${p.player_id === playerId ? 'border-blue-300 bg-blue-50' : 'border-gray-100/60 bg-white'} shadow-sm`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>{i + 1}</span>
              <span className={`flex-1 text-sm font-bold truncate ${p.player_id === playerId ? 'text-blue-700' : 'text-gray-900'}`}>{p.nickname}</span>
              <span className="text-sm font-black" style={{ color: '#2563eb' }}>{p.total_points}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 justify-center text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">O'yin davom etmoqda</span>
        </div>
      </div>
    );
  }

  // ── FINISHED VIEW ───────────────────────────────────────────────────────────
  if (view === 'finished') {
    const myRank = leaderboard.findIndex((p: any) => p.player_id === playerId) + 1;
    const myPoints = leaderboard.find((p: any) => p.player_id === playerId)?.total_points || 0;
    const top3 = leaderboard.slice(0, 3);
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
    const podiumHeights = top3.length >= 3 ? ['h-20', 'h-28', 'h-16'] : ['h-24'];
    const podiumColors = top3.length >= 3 ? ['bg-gray-200', 'bg-amber-300', 'bg-orange-200'] : ['bg-amber-300'];

    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
        <div className="text-center space-y-1">
          <Trophy className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-black" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>O'yin yakunlandi!</h2>
          {myRank > 0 && (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 border border-blue-200 px-4 py-2">
              <Award className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-700">{myRank}-o'rin • {myPoints} ball</span>
            </div>
          )}
        </div>

        {/* Podium */}
        {top3.length > 0 && (
          <div className="flex items-end justify-center gap-2 px-4">
            {podiumOrder.map((p: any, i: number) => p && (
              <div key={p.player_id} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-xs font-bold text-gray-700 truncate max-w-full text-center">{p.nickname}</span>
                <span className="text-xs font-black" style={{ color: '#2563eb' }}>{p.total_points}</span>
                <div className={`w-full rounded-t-2xl flex items-start justify-center pt-1.5 ${podiumHeights[i] || 'h-16'} ${podiumColors[i] || 'bg-gray-200'}`}>
                  <span className="text-sm font-black text-white/80">
                    {[top3.length >= 3 ? 2 : 1, 1, 3][i]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full leaderboard */}
        {leaderboard.length > 3 && (
          <div className="space-y-1.5">
            {leaderboard.slice(3).map((p: any, i: number) => (
              <div key={p.player_id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.player_id === playerId ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                <span className="text-xs font-bold text-gray-400 w-5 text-center">{i + 4}</span>
                <span className={`flex-1 text-sm font-bold ${p.player_id === playerId ? 'text-blue-700' : 'text-gray-700'}`}>{p.nickname}</span>
                <span className="text-sm font-black text-gray-600">{p.total_points}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={handleLoadMistakes} disabled={mistakesLoading} variant="outline" className="w-full rounded-xl">
            {mistakesLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCw className="h-4 w-4 mr-1.5" />}
            Xatolar daftarim
          </Button>
          <Button onClick={() => { setView('join'); setGameId(''); setPlayerId(''); setPlayerToken(''); setPin(''); setGameState(null); }} className="w-full rounded-xl" variant="outline">
            Yangi o'yinga qo'shilish
          </Button>
        </div>
      </div>
    );
  }

  // ── MISTAKES VIEW ───────────────────────────────────────────────────────────
  if (view === 'mistakes') {
    return (
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('finished')} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Natijaga qaytish
          </button>
          <Badge variant="secondary" className="text-xs ml-auto">{mistakes.length} ta xato</Badge>
        </div>
        <h2 className="text-base font-black" style={{ fontFamily: 'Source Serif 4, Georgia, serif' }}>Xatolar daftari</h2>
        {mistakes.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-700">Barcha savollar to'g'ri!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mistakes.map((m, i) => (
              <div key={i} className="rounded-3xl bg-white border border-gray-100/80 shadow-sm p-4 space-y-3">
                <p className="text-sm font-bold text-gray-900">{m.question_index + 1}. {m.text}</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {(m.options || []).map((o, j) => (
                    <div key={j} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border ${j === m.correct_index ? 'border-green-400 bg-green-50 text-green-800' : j === m.my_choice ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500 opacity-60'}`}>
                      <span className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: ANSWER_COLORS[j] || '#666' }}>{ANSWER_LABELS[j]}</span>
                      <span>{o.text}</span>
                      {j === m.correct_index && <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-auto shrink-0" />}
                      {j === m.my_choice && j !== m.correct_index && <XCircle className="h-3.5 w-3.5 text-red-400 ml-auto shrink-0" />}
                    </div>
                  ))}
                </div>
                {m.explanation && (
                  <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
                    <p className="text-[11px] font-bold text-blue-600 mb-0.5">Izoh</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{m.explanation}</p>
                  </div>
                )}
                {m.legal_basis && <p className="text-xs text-blue-600 font-medium">📋 {m.legal_basis}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
    </div>
  );
}
