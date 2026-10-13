import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { Trophy, Plus, Play, Loader2, ChevronLeft, BarChart2, Users, Clock, Trash2, Eye, Copy, CheckCircle, XCircle, Sparkles, FileText, UploadCloud, AlignLeft, Gavel, Share2, QrCode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { hostResume } from '@/lib/hukmApi';
import { useHukmGameChannel } from '@/hooks/useHukmGameChannel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface HukmQuiz {
  id: string;
  owner: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}

interface HukmQuestion {
  id?: string;
  type: string;
  text: string;
  case_text: string;
  options: { text: string; is_correct: boolean }[];
  time_limit_s: number;
  explanation: string;
  legal_basis: string;
  hint: string;
  source?: string;
}

interface HukmSession {
  id: string;
  quiz_id: string;
  game_id: string;
  pin: string;
  started_at: string;
  ended_at?: string;
  player_count: number;
  avg_correct_pct: number;
  avg_points: number;
  finishers_pct: number;
  hukm_quizzes?: { title: string };
}

type HukmView = 'list' | 'create_quiz' | 'edit_questions' | 'host_game' | 'sessions' | 'session_detail' | 'ai_job';

async function hukmFetch(path: string, method = 'GET', body?: any) {
  const url = `${supabaseUrl}/functions/v1/hukm-api/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function HukmKabineti({ ustozId, onNavigate }: { ustozId?: string; onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const effectiveUstozId = ustozId || user?.ustoz_id;

  const [view, setView] = useState<HukmView>('list');
  const [quizzes, setQuizzes] = useState<HukmQuiz[]>([]);
  const [sessions, setSessions] = useState<HukmSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<HukmQuiz | null>(null);
  const [questions, setQuestions] = useState<HukmQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Quiz form
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [savingQuiz, setSavingQuiz] = useState(false);

  // Game hosting
  const [activeGame, setActiveGame] = useState<any>(null);
  const [hostToken, setHostToken] = useState('');
  const [creatingGame, setCreatingGame] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  // Host resume
  const [resumableGame, setResumableGame] = useState<any>(null);
  const [resumeChecking, setResumeChecking] = useState(true);

  // Host game state via channel
  const hostStateRef = useRef<any>(null);
  const handleHostStateUpdate = useCallback((state: any) => {
    if (!state?.id) return;
    hostStateRef.current = state;
    setActiveGame(state);
  }, []);

  const isLobbyOrQuestion = activeGame?.status === 'lobby' || activeGame?.status === 'question';

  useHukmGameChannel({
    gameId: activeGame?.id || null,
    tokens: { host_token: hostToken },
    onState: handleHostStateUpdate,
    enabled: !!activeGame?.id && !!hostToken,
    fastPoll: isLobbyOrQuestion,
  });

  // Host resume check on mount
  useEffect(() => {
    if (!effectiveUstozId) return;
    hostResume(effectiveUstozId)
      .then(data => {
        if (data?.game) {
          setResumableGame({ ...data.game, host_token: data.host_token });
        }
        setResumeChecking(false);
      })
      .catch(() => setResumeChecking(false));
  }, [effectiveUstozId]);

  // AI savol yaratish
  const [aiText, setAiText] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState("o'rta");
  const [aiJobId, setAiJobId] = useState('');
  const [aiJobStatus, setAiJobStatus] = useState<'idle' | 'queued' | 'processing' | 'done' | 'error'>('idle');
  const [aiQuestions, setAiQuestions] = useState<HukmQuestion[]>([]);
  const [aiError, setAiError] = useState('');

  // Question editor
  const [editingQuestion, setEditingQuestion] = useState<HukmQuestion | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingQuestions, setSavingQuestions] = useState(false);

  // Parse text
  const [parseText, setParseText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [showParseInput, setShowParseInput] = useState(false);

  const loadQuizzes = useCallback(async () => {
    if (!effectiveUstozId) return;
    setLoading(true);
    const data = await hukmFetch(`quiz?ustoz_id=${effectiveUstozId}`);
    setQuizzes(data?.quizzes || []);
    setLoading(false);
  }, [effectiveUstozId]);

  const loadSessions = useCallback(async () => {
    if (!effectiveUstozId) return;
    setLoading(true);
    const data = await hukmFetch(`sessions?ustoz_id=${effectiveUstozId}`);
    setSessions(data?.sessions || []);
    setLoading(false);
  }, [effectiveUstozId]);

  useEffect(() => {
    if (view === 'list') loadQuizzes();
    else if (view === 'sessions') loadSessions();
  }, [view, loadQuizzes, loadSessions]);

  useEffect(() => {
    if (view === 'edit_questions' && activeQuiz) {
      setQuestionsLoading(true);
      hukmFetch(`quiz/${activeQuiz.id}?ustoz_id=${effectiveUstozId}`).then(data => {
        setQuestions(data?.questions || []);
        setQuestionsLoading(false);
      });
    }
  }, [view, activeQuiz, effectiveUstozId]);

  // AI job polling
  useEffect(() => {
    if (!aiJobId || aiJobStatus === 'idle' || aiJobStatus === 'done' || aiJobStatus === 'error') return;
    const interval = setInterval(async () => {
      const data = await hukmFetch(`quiz-ai/${aiJobId}?ustoz_id=${effectiveUstozId}`);
      const job = data?.job;
      if (!job) return;
      if (job.status === 'done') {
        setAiJobStatus('done');
        setAiQuestions(job.result?.questions || []);
        clearInterval(interval);
      } else if (job.status === 'error') {
        setAiJobStatus('error');
        setAiError(job.error || 'AI xatosi');
        clearInterval(interval);
      } else {
        setAiJobStatus(job.status);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [aiJobId, aiJobStatus, effectiveUstozId]);



  const handleCreateQuiz = async () => {
    if (!quizTitle.trim()) { toast({ title: 'Sarlavha kerak', variant: 'destructive' }); return; }
    setSavingQuiz(true);
    const data = await hukmFetch('quiz', 'POST', { ustoz_id: effectiveUstozId, title: quizTitle.trim(), description: quizDesc.trim() });
    setSavingQuiz(false);
    if (data?.quiz) {
      toast({ title: 'Viktorina yaratildi' });
      setActiveQuiz(data.quiz);
      setQuizTitle('');
      setQuizDesc('');
      setView('edit_questions');
    } else {
      toast({ title: data?.error || 'Xatolik', variant: 'destructive' });
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Bu viktorinani o'chirishni istaysizmi? Barcha savollar ham o'chiriladi.")) return;
    const data = await hukmFetch(`quiz/${id}?ustoz_id=${effectiveUstozId}`, 'DELETE');
    if (data?.success) { toast({ title: "O'chirildi" }); loadQuizzes(); }
    else toast({ title: data?.error || 'Xatolik', variant: 'destructive' });
  };

  const handleSaveQuestions = async (qs: HukmQuestion[]) => {
    if (!activeQuiz) return;
    setSavingQuestions(true);
    const data = await hukmFetch(`quiz/${activeQuiz.id}/questions`, 'POST', { ustoz_id: effectiveUstozId, questions: qs });
    setSavingQuestions(false);
    if (data?.success) {
      toast({ title: `${data.count} ta savol saqlandi` });
      setQuestions(qs);
    } else {
      toast({ title: data?.error || 'Xatolik', variant: 'destructive' });
    }
  };

  const handleStartGame = async (quiz: HukmQuiz) => {
    if (!effectiveUstozId) return;
    setCreatingGame(true);
    const data = await hukmFetch('game', 'POST', { ustoz_id: effectiveUstozId, quiz_id: quiz.id });
    setCreatingGame(false);
    if (data?.game && data?.host_token) {
      setActiveGame(data.game);
      setHostToken(data.host_token);
      setActiveQuiz(quiz);
      setView('host_game');
    } else {
      toast({ title: data?.error || "O'yin yaratilmadi", variant: 'destructive' });
    }
  };

  const handleGameAction = async (action: string, extra?: any) => {
    if (!activeGame || !hostToken) return;
    const data = await hukmFetch(`game/${activeGame.id}/${action}`, 'POST', { host_token: hostToken, ...extra });
    if (data?.success) {
      const updated = await hukmFetch(`game/${activeGame.id}?host_token=${hostToken}`);
      if (updated?.id) setActiveGame(updated);
      if (data?.finished) {
        toast({ title: "O'yin yakunlandi" });
        setActiveGame(null);
        setHostToken('');
        setView('sessions');
      }
    } else {
      toast({ title: data?.error || 'Xatolik', variant: 'destructive' });
    }
  };

  const handleAiGenerate = async () => {
    if (!effectiveUstozId) return;
    if (aiText.trim().length < 30) { toast({ title: 'Kamida 30 belgi matn kerak', variant: 'destructive' }); return; }
    if (!activeQuiz) { toast({ title: 'Avval viktorinani oching', variant: 'destructive' }); return; }
    setAiJobStatus('queued');
    setAiError('');
    const data = await hukmFetch('quiz-ai', 'POST', {
      ustoz_id: effectiveUstozId,
      quiz_id: activeQuiz.id,
      sources: [{ type: 'text', content: aiText }],
      settings: { count: aiCount, difficulty: aiDifficulty },
    });
    if (data?.job_id) {
      setAiJobId(data.job_id);
    } else {
      setAiJobStatus('error');
      setAiError(data?.error || 'Job yaratilmadi');
    }
  };

  const handleApplyAiQuestions = () => {
    const merged = [...questions, ...aiQuestions];
    setQuestions(merged);
    handleSaveQuestions(merged);
    setAiJobStatus('idle');
    setAiQuestions([]);
    setAiText('');
    setView('edit_questions');
    toast({ title: `${aiQuestions.length} ta savol qo'shildi` });
  };

  const handleParseText = async () => {
    if (!activeQuiz || !parseText.trim()) return;
    setParsing(true);
    const data = await hukmFetch(`quiz/${activeQuiz.id}/parse-text`, 'POST', { ustoz_id: effectiveUstozId, text: parseText });
    setParsing(false);
    if (data?.questions?.length) {
      const merged = [...questions, ...data.questions];
      setQuestions(merged);
      await handleSaveQuestions(merged);
      setParseText('');
      setShowParseInput(false);
      toast({ title: `${data.questions.length} ta savol tahlil qilindi` });
    } else {
      toast({ title: 'Savollar topilmadi. Formatni tekshiring.', variant: 'destructive' });
    }
  };

  const handleCopyPin = () => {
    if (activeGame?.pin) {
      navigator.clipboard.writeText(activeGame.pin).catch(() => {});
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (activeGame?.pin) {
      const link = `${window.location.origin}/?pin=${activeGame.pin}`;
      navigator.clipboard.writeText(link).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // QR kod generatsiyasi — lobby'da PIN havolasini kodlash
  useEffect(() => {
    if (view === 'host_game' && activeGame?.pin && activeGame.status === 'lobby') {
      const url = `${window.location.origin}/hukm?pin=${activeGame.pin}`;
      QRCode.toDataURL(url, { width: 220, margin: 2, color: { dark: '#0D1B42', light: '#FFFFFF' } })
        .then(setQrUrl)
        .catch(() => setQrUrl(''));
    } else {
      setQrUrl('');
    }
  }, [view, activeGame?.pin, activeGame?.status]);

  const handleResumeGame = async () => {
    if (!resumableGame?.host_token) return;
    setActiveGame(resumableGame);
    setHostToken(resumableGame.host_token);
    setResumableGame(null);
    setView('host_game');
  };

  const handleEndResumable = async () => {
    if (!effectiveUstozId || !resumableGame?.id) return;
    await hukmFetch(`game/${resumableGame.id}/finish`, 'POST', { host_token: resumableGame.host_token });
    setResumableGame(null);
  };

  // Question editor helpers
  const openEditQuestion = (q: HukmQuestion, idx: number) => { setEditingQuestion({ ...q }); setEditingIndex(idx); };
  const openNewQuestion = () => setEditingQuestion({ type: 'variant4', text: '', case_text: '', options: [{ text: '', is_correct: true }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }], time_limit_s: 20, explanation: '', legal_basis: '', hint: '' });

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;
    if (!editingQuestion.text.trim()) { toast({ title: 'Savol matni kerak', variant: 'destructive' }); return; }
    if (editingQuestion.options.filter(o => o.is_correct).length !== 1) { toast({ title: 'Aynan 1 ta to\'g\'ri variant kerak', variant: 'destructive' }); return; }
    const updated = editingIndex !== null
      ? questions.map((q, i) => i === editingIndex ? editingQuestion : q)
      : [...questions, editingQuestion];
    handleSaveQuestions(updated);
    setEditingQuestion(null);
    setEditingIndex(null);
  };

  const handleDeleteQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx);
    handleSaveQuestions(updated);
  };

  if (!effectiveUstozId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Trophy className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Bu bo'lim faqat ustozlar uchun</p>
      </div>
    );
  }

  // ── HOST GAME VIEW ──────────────────────────────────────────────────────────
  if (view === 'host_game' && activeGame) {
    const status = activeGame.status;
    const players = activeGame.players || [];
    const question = activeGame.question;
    const reveal = activeGame.reveal;
    const leaderboard = activeGame.leaderboard || [];
    const totalQ = activeGame.total_questions || 0;
    const currentIdx = activeGame.current_index ?? -1;
    const isFinished = status === 'finished';

    const answerColors = ['#C2303D', '#2F6BE0', '#12805C', '#F2A93B'];
    const answerLabels = ['A', 'B', 'C', 'D'];

    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setActiveGame(null); setHostToken(''); setView('list'); }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Ro'yxatga qaytish
          </button>
          <Badge variant={isFinished ? 'secondary' : 'default'} className="text-xs">
            {status === 'lobby' ? 'Lobby' : status === 'question' ? `Savol ${currentIdx + 1}/${totalQ}` : status === 'reveal' ? 'Natija' : status === 'leaderboard' ? 'Reyting' : 'Yakunlangan'}
          </Badge>
        </div>

        {/* PIN Card */}
        {status === 'lobby' && (
          <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)' }}>
            <div className="p-6 text-white text-center space-y-2">
              <p className="text-sm font-bold opacity-70">Qo'shilish PIN kodi</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-5xl font-black tracking-widest" style={{ fontFamily: 'Source Serif 4, Georgia, serif', letterSpacing: '0.12em', color: '#fbbf24' }}>
                  {activeGame.pin?.slice(0, 3)} {activeGame.pin?.slice(3)}
                </span>
                <button onClick={handleCopyPin} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition" aria-label="PIN'ni nusxalash">
                  {copiedPin ? <CheckCircle className="h-5 w-5 text-green-300" /> : <Copy className="h-5 w-5 text-white/70" />}
                </button>
              </div>
              <p className="text-xs opacity-60">O'yinchilar bu PIN bilan qo'shiladi</p>
              {/* QR kod */}
              {qrUrl && (
                <div className="flex flex-col items-center gap-1.5 mt-3">
                  <div className="rounded-2xl p-3 bg-white shadow-lg">
                    <img src={qrUrl} alt="QR kod" className="w-[200px] h-[200px]" />
                  </div>
                  <p className="text-[11px] opacity-50">Telefon kamerasi bilan skanerlang</p>
                </div>
              )}
              {/* Share link */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <button onClick={handleCopyLink} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold transition" aria-label="Havolani nusxalash">
                  {copiedLink ? <CheckCircle className="h-3.5 w-3.5 text-green-300" /> : <Share2 className="h-3.5 w-3.5" />}
                  {copiedLink ? 'Nusxalandi' : 'Havolani nusxalash'}
                </button>
              </div>
            </div>
            <div className="bg-white/10 px-6 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-white/70">{players.length} ta o'yinchi</span>
              <div className="flex flex-wrap gap-1.5 max-w-[70%] justify-end">
                {players.slice(0, 8).map((p: any) => (
                  <span key={p.id} className="text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full text-white">{p.nickname}</span>
                ))}
                {players.length > 8 && <span className="text-[11px] text-white/60">+{players.length - 8}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Question display */}
        {status === 'question' && question && (
          <div className="rounded-3xl bg-white border border-gray-100/80 shadow-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-600">{currentIdx + 1}/{totalQ}</span>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Users className="h-3.5 w-3.5" />
                {activeGame.answered_count}/{players.length} javob berdi
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                {question.time_limit_s}s
              </div>
            </div>
            <p className="text-base font-bold text-gray-900 leading-snug">{question.text}</p>
            <div className="grid grid-cols-2 gap-2">
              {(question.options || []).map((o: any, i: number) => (
                <div key={i} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-white font-bold text-sm" style={{ background: answerColors[i] || '#666' }}>
                  <span className="w-6 h-6 rounded-lg bg-black/20 flex items-center justify-center text-xs shrink-0">{answerLabels[i]}</span>
                  <span className="flex-1 truncate">{o.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reveal */}
        {status === 'reveal' && reveal && (
          <div className="rounded-3xl bg-white border border-gray-100/80 shadow-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">{reveal.text}</h3>
            <div className="grid grid-cols-2 gap-2">
              {(reveal.options || []).map((o: any, i: number) => (
                <div key={i} className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 font-bold text-sm border-2 ${i === reveal.correct_index ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-500 opacity-60'}`}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0" style={{ background: answerColors[i] || '#666', color: '#fff' }}>{answerLabels[i]}</span>
                  <span className="flex-1 truncate">{o.text}</span>
                  {i === reveal.correct_index && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                </div>
              ))}
            </div>
            {reveal.explanation && (
              <div className="rounded-xl bg-blue-50 border border-blue-100/60 p-3">
                <p className="text-xs font-bold text-blue-700 mb-0.5">Izoh</p>
                <p className="text-xs text-gray-700">{reveal.explanation}</p>
              </div>
            )}
            {reveal.legal_basis && (
              <p className="text-xs text-blue-600 font-medium">📋 Asos: {reveal.legal_basis}</p>
            )}
            {/* Taqsimot */}
            {activeGame.distribution && (
              <div className="flex gap-2 items-end h-12 mt-2">
                {activeGame.distribution.map((cnt: number, i: number) => {
                  const max = Math.max(...activeGame.distribution, 1);
                  const h = Math.round((cnt / max) * 44) + 4;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[10px] font-bold text-gray-500">{cnt}</span>
                      <div className="w-full rounded-t-md" style={{ height: h, background: i === reveal.correct_index ? '#22c55e' : '#e5e7eb' }} />
                      <span className="text-[10px] font-bold" style={{ color: answerColors[i] || '#666' }}>{answerLabels[i]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {(status === 'leaderboard' || status === 'finished') && (
          <div className="rounded-3xl bg-white border border-gray-100/80 shadow-lg p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h3 className="text-sm font-bold text-gray-900">{status === 'finished' ? 'Yakuniy reyting' : 'Reyting'}</h3>
            </div>
            {leaderboard.slice(0, 5).map((p: any, i: number) => (
              <div key={p.player_id} className="flex items-center gap-3 rounded-2xl bg-gray-50/80 border border-gray-100/60 px-3 py-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'}`}>{i + 1}</span>
                <span className="flex-1 text-sm font-bold text-gray-900 truncate">{p.nickname}</span>
                <span className="text-sm font-black" style={{ color: '#2563eb' }}>{p.total_points}</span>
              </div>
            ))}
          </div>
        )}

        {/* Host Controls */}
        <div className="flex flex-wrap gap-2">
          {status === 'lobby' && (
            <>
              <Button onClick={() => handleGameAction('start')} className="rounded-xl shadow-md shadow-blue-500/15">
                <Play className="h-4 w-4 mr-1.5" /> Boshlash
              </Button>
              <Button variant="outline" onClick={() => handleGameAction('lock', { locked: !activeGame.settings?.lobby_locked })} className="rounded-xl text-xs">
                {activeGame.settings?.lobby_locked ? 'Lobby qulfini ochish' : 'Lobbini qulflash'}
              </Button>
            </>
          )}
          {status === 'question' && (
            <Button onClick={() => handleGameAction('reveal')} className="rounded-xl shadow-md shadow-blue-500/15">Natijani ko'rsat</Button>
          )}
          {status === 'reveal' && (
            <>
              <Button onClick={() => handleGameAction('next')} className="rounded-xl shadow-md shadow-blue-500/15">
                {currentIdx + 1 >= totalQ ? 'Yakunlash' : 'Keyingi savol'}
              </Button>
              <Button variant="outline" onClick={() => handleGameAction('leaderboard')} className="rounded-xl text-xs">Reytingni ko'rsat</Button>
            </>
          )}
          {status === 'leaderboard' && (
            <Button onClick={() => handleGameAction('next')} className="rounded-xl shadow-md shadow-blue-500/15">
              {currentIdx + 1 >= totalQ ? 'Yakunlash' : 'Davom etish'}
            </Button>
          )}
          {status !== 'finished' && (
            <Button variant="outline" onClick={() => handleGameAction('finish')} className="rounded-xl text-xs text-red-600 hover:text-red-700 border-red-200">
              O'yinni yakunlash
            </Button>
          )}
          {status === 'finished' && (
            <Button onClick={() => { setActiveGame(null); setHostToken(''); setView('sessions'); }} className="rounded-xl">
              Natijalarga o'tish
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── QUESTION EDITOR ─────────────────────────────────────────────────────────
  if (editingQuestion) {
    const q = editingQuestion;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => { setEditingQuestion(null); setEditingIndex(null); }} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Savollar ro'yxatiga qaytish
        </button>
        <div className="rounded-3xl bg-white border border-gray-100/80 shadow-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">{editingIndex !== null ? 'Savolni tahrirlash' : 'Yangi savol'}</h3>
          <div>
            <Label className="text-xs font-bold">Savol matni *</Label>
            <Textarea value={q.text} onChange={e => setEditingQuestion({ ...q, text: e.target.value })} placeholder="Savol matnini yozing..." className="mt-1.5 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-bold">Kazus matni (ixtiyoriy)</Label>
            <Textarea value={q.case_text} onChange={e => setEditingQuestion({ ...q, case_text: e.target.value })} placeholder="Kazus vaziyatini yozing..." className="mt-1.5 rounded-xl min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold">Variantlar (1 ta to'g'ri) *</Label>
            {q.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setEditingQuestion({ ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === i })) })}
                  className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-black text-xs transition ${opt.is_correct ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'bg-gray-100 text-gray-400 border border-gray-200 hover:border-gray-400'}`}
                  aria-label={`${['A', 'B', 'C', 'D'][i]} variantini to'g'ri deb belgilash`}
                >
                  {['A', 'B', 'C', 'D'][i]}
                </button>
                <Input value={opt.text} onChange={e => setEditingQuestion({ ...q, options: q.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) })} placeholder={`${['A', 'B', 'C', 'D'][i]} varianti`} className="flex-1 rounded-xl" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Taymer (soniya)</Label>
              <Input type="number" min={5} max={120} value={q.time_limit_s} onChange={e => setEditingQuestion({ ...q, time_limit_s: parseInt(e.target.value) || 20 })} className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold">Asos modda (ixtiyoriy)</Label>
              <Input value={q.legal_basis} onChange={e => setEditingQuestion({ ...q, legal_basis: e.target.value })} placeholder="JK 97-modda..." className="mt-1.5 rounded-xl" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-bold">Izoh (ixtiyoriy)</Label>
            <Textarea value={q.explanation} onChange={e => setEditingQuestion({ ...q, explanation: e.target.value })} placeholder="Nega bu javob to'g'ri..." className="mt-1.5 rounded-xl min-h-[70px]" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSaveQuestion} disabled={savingQuestions} className="flex-1 rounded-xl shadow-md shadow-blue-500/15">
              {savingQuestions ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Saqlash
            </Button>
            <Button variant="outline" onClick={() => { setEditingQuestion(null); setEditingIndex(null); }} className="rounded-xl">Bekor qilish</Button>
          </div>
        </div>
      </div>
    );
  }

  // ── EDIT QUESTIONS VIEW ─────────────────────────────────────────────────────
  if (view === 'edit_questions' && activeQuiz) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setView('list'); setActiveQuiz(null); setQuestions([]); }} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Ro'yxatga qaytish
          </button>
          <Badge variant="secondary" className="text-xs">{questions.length} ta savol</Badge>
        </div>

        <div className="rounded-3xl bg-white border border-gray-100/80 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-900 truncate">{activeQuiz.title}</h2>
          {activeQuiz.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{activeQuiz.description}</p>}
        </div>

        {/* Asboblar */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={openNewQuestion} className="rounded-xl shadow-md shadow-blue-500/15">
            <Plus className="h-4 w-4 mr-1" /> Savol qo'shish
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView('ai_job')} className="rounded-xl">
            <Sparkles className="h-4 w-4 mr-1 text-violet-500" /> AI bilan yaratish
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowParseInput(!showParseInput)} className="rounded-xl">
            <AlignLeft className="h-4 w-4 mr-1 text-gray-500" /> Matndan import
          </Button>
        </div>

        {/* Parse text input */}
        {showParseInput && (
          <div className="rounded-2xl border border-dashed border-gray-300/80 bg-gray-50/50 p-4 space-y-2">
            <Label className="text-xs font-bold">Matndan savol tahlil qilish</Label>
            <p className="text-[11px] text-gray-400">Format: <code>1. Savol? A) Variant B) Variant... To'g'ri: A Izoh: ...</code></p>
            <Textarea value={parseText} onChange={e => setParseText(e.target.value)} placeholder="Savollar matnini shu yerga yapishting..." className="rounded-xl min-h-[100px]" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleParseText} disabled={parsing} className="rounded-xl">
                {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
                Tahlil qilish
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowParseInput(false); setParseText(''); }} className="rounded-xl">Bekor</Button>
            </div>
          </div>
        )}

        {/* Questions list */}
        {questionsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 rounded-3xl border-2 border-dashed border-gray-200">
            <UploadCloud className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Hozircha savollar yo'q</p>
            <p className="text-xs text-gray-400 mt-1">Qo'lda, AI yordamida yoki matndan qo'shing</p>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => (
              <div key={i} className="group rounded-2xl bg-white border border-gray-100/80 shadow-sm hover:shadow-md transition-all duration-200 p-3.5">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 line-clamp-2">{q.text}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {q.options.map((o, j) => (
                        <span key={j} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.is_correct ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {['A','B','C','D'][j]}: {o.text.slice(0, 20)}{o.text.length > 20 ? '…' : ''}
                        </span>
                      ))}
                      <span className="text-[10px] text-gray-400 px-1">{q.time_limit_s}s</span>
                      {q.source === 'ai' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">AI</span>}
                      {q.legal_basis && <span className="text-[10px] text-blue-600">📋 {q.legal_basis.slice(0, 20)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" onClick={() => openEditQuestion(q, i)} className="h-7 w-7 p-0 rounded-lg">
                      <Eye className="h-3.5 w-3.5 text-gray-400" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteQuestion(i)} className="h-7 w-7 p-0 rounded-lg text-red-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {questions.length > 0 && (
          <Button onClick={() => handleStartGame(activeQuiz)} disabled={creatingGame} className="w-full rounded-xl shadow-md shadow-blue-500/15">
            {creatingGame ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Play className="h-4 w-4 mr-1.5" />}
            O'yin boshlash ({questions.length} ta savol)
          </Button>
        )}
      </div>
    );
  }

  // ── AI JOB VIEW ─────────────────────────────────────────────────────────────
  if (view === 'ai_job') {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => setView('edit_questions')} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Savollar ro'yxatiga qaytish
        </button>
        <div className="rounded-3xl bg-white border border-gray-100/80 shadow-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <h3 className="text-sm font-bold text-gray-800">AI bilan savol yaratish</h3>
          </div>
          <div>
            <Label className="text-xs font-bold">Manba matni *</Label>
            <Textarea value={aiText} onChange={e => setAiText(e.target.value)} placeholder="Darslik, qonun matni yoki mavzu tushuntirishini shu yerga joylashtiring..." className="mt-1.5 rounded-xl min-h-[140px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Savollar soni</Label>
              <Input type="number" min={1} max={40} value={aiCount} onChange={e => setAiCount(parseInt(e.target.value) || 10)} className="mt-1.5 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-bold">Qiyinlik</Label>
              <select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400">
                <option value="oson">Oson</option>
                <option value="o'rta">O'rta</option>
                <option value="qiyin">Qiyin</option>
              </select>
            </div>
          </div>
          {aiJobStatus === 'idle' || aiJobStatus === 'error' ? (
            <Button onClick={handleAiGenerate} className="w-full rounded-xl shadow-md shadow-violet-500/15" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
              <Sparkles className="h-4 w-4 mr-1.5" /> AI savol tuzsin
            </Button>
          ) : null}
          {(aiJobStatus === 'queued' || aiJobStatus === 'processing') && (
            <div className="flex items-center gap-3 rounded-2xl bg-violet-50 border border-violet-200 p-4">
              <Loader2 className="h-5 w-5 animate-spin text-violet-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-violet-700">AI savollar tayyorlanmoqda...</p>
                <p className="text-xs text-gray-500">Bu 1-3 daqiqa olishi mumkin. Sahifani yopmang.</p>
              </div>
            </div>
          )}
          {aiJobStatus === 'error' && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 p-3">
              <XCircle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{aiError}</p>
            </div>
          )}
          {aiJobStatus === 'done' && aiQuestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-sm font-bold text-green-700">{aiQuestions.length} ta savol tayyor!</p>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {aiQuestions.map((q, i) => (
                  <div key={i} className="rounded-xl bg-gray-50/80 border border-gray-100/60 p-3">
                    <p className="text-xs font-bold text-gray-900 line-clamp-2">{i + 1}. {q.text}</p>
                    {q.legal_basis && <p className="text-[10px] text-blue-600 mt-0.5">📋 {q.legal_basis}</p>}
                  </div>
                ))}
              </div>
              <Button onClick={handleApplyAiQuestions} className="w-full rounded-xl shadow-md shadow-blue-500/15">
                Savollarni qo'shish ({aiQuestions.length} ta)
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── SESSIONS VIEW ───────────────────────────────────────────────────────────
  if (view === 'sessions') {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-2">
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Ro'yxatga qaytish
          </button>
          <BarChart2 className="h-5 w-5 text-blue-600 ml-2" />
          <h2 className="text-base font-bold text-gray-900">O'tkazilgan o'yinlar</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <BarChart2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Hozircha o'tkazilgan o'yinlar yo'q</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.map(s => (
              <div key={s.id} className="rounded-3xl bg-white border border-gray-100/80 shadow-sm hover:shadow-md transition-all duration-200 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{s.hukm_quizzes?.title || 'Viktorina'}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">{new Date(s.started_at).toLocaleString('uz-UZ')}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-blue-50/80 p-2 text-center">
                    <p className="text-lg font-black text-blue-700">{s.player_count}</p>
                    <p className="text-[10px] text-gray-500">O'yinchi</p>
                  </div>
                  <div className="rounded-xl bg-green-50/80 p-2 text-center">
                    <p className="text-lg font-black text-green-700">{Math.round(s.avg_correct_pct)}%</p>
                    <p className="text-[10px] text-gray-500">To'g'ri</p>
                  </div>
                  <div className="rounded-xl bg-amber-50/80 p-2 text-center">
                    <p className="text-lg font-black text-amber-700">{Math.round(s.avg_points)}</p>
                    <p className="text-[10px] text-gray-500">O'rt.ball</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CREATE QUIZ VIEW ────────────────────────────────────────────────────────
  if (view === 'create_quiz') {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors">
          <ChevronLeft className="h-4 w-4" /> Ro'yxatga qaytish
        </button>
        <div className="rounded-3xl bg-white border border-gray-100/80 shadow-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-800">Yangi viktorina yaratish</h3>
          <div>
            <Label className="text-xs font-bold">Sarlavha *</Label>
            <Input value={quizTitle} onChange={e => setQuizTitle(e.target.value)} placeholder="Masalan: JK Umumiy qism bo'yicha test" className="mt-1.5 rounded-xl" onKeyDown={e => { if (e.key === 'Enter') handleCreateQuiz(); }} />
          </div>
          <div>
            <Label className="text-xs font-bold">Tavsif (ixtiyoriy)</Label>
            <Textarea value={quizDesc} onChange={e => setQuizDesc(e.target.value)} placeholder="Qisqacha izoh..." className="mt-1.5 rounded-xl" />
          </div>
          <Button onClick={handleCreateQuiz} disabled={savingQuiz} className="w-full rounded-xl shadow-md shadow-blue-500/15">
            {savingQuiz ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Yaratish va savollar qo'shish
          </Button>
        </div>
      </div>
    );
  }

  // ── MAIN LIST VIEW ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-bold text-gray-900">Hukm Viktorina</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setView('sessions')} className="rounded-xl text-xs">
            <BarChart2 className="h-4 w-4 mr-1" /> Natijalar
          </Button>
          <Button size="sm" onClick={() => setView('create_quiz')} className="rounded-xl shadow-md shadow-blue-500/15">
            <Plus className="h-4 w-4 mr-1" /> Yangi viktorina
          </Button>
        </div>
      </div>

      {/* Davom etayotgan o'yin banneri */}
      {resumableGame && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Gavel className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-blue-900 truncate">Davom etayotgan o'yin bor (PIN {resumableGame.pin})</p>
              <p className="text-xs text-blue-600 truncate">{resumableGame.quiz_title || 'Viktorina'}</p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" onClick={handleResumeGame} className="rounded-lg text-xs">Davom ettirish</Button>
            <Button size="sm" variant="outline" onClick={handleEndResumable} className="rounded-lg text-xs text-red-600 border-red-200">Tugatish</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border-2 border-dashed border-gray-200">
          <Trophy className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Hozircha viktorinalar yo'q</p>
          <p className="text-xs text-gray-400 mt-1">"Yangi viktorina" tugmasini bosing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quizzes.map(quiz => (
            <div key={quiz.id} className="group rounded-3xl bg-white border border-gray-100/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{quiz.title}</h3>
                {quiz.description && <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{quiz.description}</p>}
                <p className="text-[10px] text-gray-400 mt-1">{new Date(quiz.created_at).toLocaleDateString('uz-UZ')}</p>
              </div>
              <div className="flex gap-1.5 pt-2 border-t border-gray-100/60 flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => { setActiveQuiz(quiz); setView('edit_questions'); }} className="text-xs h-7 rounded-lg">
                  <Eye className="h-3 w-3 mr-1" /> Savollar
                </Button>
                <Button size="sm" onClick={() => handleStartGame(quiz)} disabled={creatingGame} className="text-xs h-7 rounded-xl shadow-sm shadow-blue-500/15">
                  {creatingGame ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  O'yin
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteQuiz(quiz.id)} className="text-xs h-7 rounded-lg text-red-400 hover:text-red-600 ml-auto">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
