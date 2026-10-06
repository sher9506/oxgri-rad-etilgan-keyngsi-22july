// HukmKabineti — ustoz uchun Hukm boshqaruvi (3 tab: Yangi viktorina, Viktorinalarim, O'tkazilgan o'yinlar)
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gavel, Plus, FileText, Clock, Trash2, Edit3, Download, Play, List, BarChart3, Loader2, Sparkles, AlertCircle, CheckCircle2, Copy, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createQuiz, listQuizzes, getQuiz, updateQuiz, deleteQuiz, saveQuestions, parseText, startAIJob, getAIJob, createGame, listSessions, getSession, getReport } from '@/lib/hukmApi';
import { HukmHostScreen } from './HukmHostScreen';
import { HukmReport } from './HukmReport';
import { exportHukmDocx } from '@/lib/hukmDocx';

const EASE = [0.22, 1, 0.36, 1] as const;

interface Question {
  type: string;
  text: string;
  case_text?: string;
  options: { text: string; is_correct: boolean }[];
  time_limit_s: number;
  explanation: string;
  legal_basis: string;
  hint?: string;
  basis_check?: string | null;
  source?: string;
}

interface Quiz {
  id: string;
  owner: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
}

type TabKey = 'new' | 'list' | 'sessions';
type NewTab = 'ai' | 'manual' | 'text';

export function HukmKabineti() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>('list');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuiz, setEditingQuiz] = useState<{ id: string; title: string; questions: Question[] } | null>(null);
  const [hostScreen, setHostScreen] = useState<{ gameId: string; hostToken: string; quizTitle: string } | null>(null);
  const [reportSession, setReportSession] = useState<{ sessionId: string } | null>(null);

  const ustozId = user?.ustoz_id || '';

  const loadQuizzes = useCallback(async () => {
    if (!ustozId) return;
    setLoading(true);
    try {
      const data = await listQuizzes(ustozId);
      setQuizzes(data.quizzes || []);
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [ustozId, toast]);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  if (hostScreen) {
    return (
      <HukmHostScreen
        gameId={hostScreen.gameId}
        hostToken={hostScreen.hostToken}
        quizTitle={hostScreen.quizTitle}
        onExit={() => { setHostScreen(null); loadQuizzes(); }}
      />
    );
  }

  if (reportSession) {
    return (
      <HukmReport
        sessionId={reportSession.sessionId}
        ustozId={ustozId}
        onExit={() => setReportSession(null)}
      />
    );
  }

  if (editingQuiz) {
    return (
      <HukmEditor
        quizId={editingQuiz.id}
        title={editingQuiz.title}
        initialQuestions={editingQuiz.questions}
        ustozId={ustozId}
        onExit={() => { setEditingQuiz(null); loadQuizzes(); }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--navy-1), var(--gold))' }}>
          <Gavel className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="ff-serif text-xl md:text-2xl" style={{ color: 'var(--ink)' }}>Hukm kabineti</h1>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Jonli viktorina boshqaruvi</p>
        </div>
      </div>

      {/* Tablar */}
      <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
        <TabBtn icon={<List className="w-4 h-4" />} label="Viktorinalarim" active={tab === 'list'} onClick={() => setTab('list')} />
        <TabBtn icon={<Plus className="w-4 h-4" />} label="Yangi viktorina" active={tab === 'new'} onClick={() => setTab('new')} />
        <TabBtn icon={<BarChart3 className="w-4 h-4" />} label="O'tkazilgan o'yinlar" active={tab === 'sessions'} onClick={() => setTab('sessions')} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          {tab === 'list' && (
            <QuizList
              quizzes={quizzes}
              loading={loading}
              ustozId={ustozId}
              onEdit={async (q) => {
                try {
                  const data = await getQuiz(q.id, ustozId);
                  setEditingQuiz({ id: q.id, title: q.title, questions: data.questions || [] });
                } catch (err: any) {
                  toast({ title: 'Xato', description: err.message, variant: 'destructive' });
                }
              }}
              onStart={async (q) => {
                try {
                  const data = await getQuiz(q.id, ustozId);
                  if (!data.questions || data.questions.length === 0) {
                    toast({ title: 'Savollar yo\'q', description: 'Avval savol qo\'shing', variant: 'destructive' });
                    return;
                  }
                  const game = await createGame(ustozId, q.id);
                  setHostScreen({ gameId: game.game.id, hostToken: game.host_token, quizTitle: q.title });
                } catch (err: any) {
                  toast({ title: 'Xato', description: err.message, variant: 'destructive' });
                }
              }}
              onExport={(q, questions) => exportHukmDocx(q.title, questions)}
              onDelete={async (q) => {
                if (!confirm('Viktorinani o\'chirishni xohlaysizmi?')) return;
                try {
                  await deleteQuiz(q.id, ustozId);
                  toast({ title: 'O\'chirildi' });
                  loadQuizzes();
                } catch (err: any) {
                  toast({ title: 'Xato', description: err.message, variant: 'destructive' });
                }
              }}
              onGetQuestions={async (q) => {
                const data = await getQuiz(q.id, ustozId);
                return data.questions || [];
              }}
            />
          )}
          {tab === 'new' && (
            <NewQuizTab ustozId={ustozId} onCreated={(id, title, questions) => {
              setEditingQuiz({ id, title, questions });
            }} />
          )}
          {tab === 'sessions' && (
            <SessionsTab ustozId={ustozId} onOpen={(sessionId) => setReportSession({ sessionId })} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all"
      style={{
        background: active ? 'var(--ff-card)' : 'transparent',
        color: active ? 'var(--ink)' : 'var(--ink-muted)',
        boxShadow: active ? '0 2px 8px -2px rgba(13,27,66,.15)' : 'none',
      }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Viktorinalar ro'yxati ──────────────────────────────────────────────────────

function QuizList({ quizzes, loading, ustozId, onEdit, onStart, onExport, onDelete, onGetQuestions }: {
  quizzes: Quiz[];
  loading: boolean;
  ustozId: string;
  onEdit: (q: Quiz) => void;
  onStart: (q: Quiz) => void;
  onExport: (q: Quiz, questions: Question[]) => void;
  onDelete: (q: Quiz) => void;
  onGetQuestions: (q: Quiz) => Promise<Question[]>;
}) {
  const { toast } = useToast();
  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cobalt-1)' }} /></div>;
  }
  if (quizzes.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
        <Gavel className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--ink-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Hozircha viktorina yo'q. "Yangi viktorina" tabidan yarating.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {quizzes.map((q, i) => (
        <motion.div
          key={q.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, ease: EASE }}
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}
        >
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{q.title}</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
              {new Date(q.created_at).toLocaleDateString('uz-UZ')}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn icon={<Edit3 className="w-4 h-4" />} title="Tahrirlash" onClick={() => onEdit(q)} />
            <IconBtn icon={<Play className="w-4 h-4" />} title="O'yinni boshlash" onClick={() => onStart(q)} color="var(--success)" />
            <IconBtn icon={<Download className="w-4 h-4" />} title="Word'ga yuklash" onClick={async () => {
              try {
                const questions = await onGetQuestions(q);
                onExport(q, questions);
              } catch (err: any) {
                toast({ title: 'Xato', description: err.message, variant: 'destructive' });
              }
            }} />
            <IconBtn icon={<Trash2 className="w-4 h-4" />} title="O'chirish" onClick={() => onDelete(q)} color="#C2303D" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function IconBtn({ icon, title, onClick, color }: { icon: React.ReactNode; title: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-105"
      style={{ background: 'var(--panel-2)', color: color || 'var(--ink-body)' }}
    >
      {icon}
    </button>
  );
}

// ── Yangi viktorina tabi ───────────────────────────────────────────────────────

function NewQuizTab({ ustozId, onCreated }: { ustozId: string; onCreated: (id: string, title: string, questions: Question[]) => void }) {
  const [newTab, setNewTab] = useState<NewTab>('manual');
  const [title, setTitle] = useState('');
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);

  const ensureQuiz = async (): Promise<string | null> => {
    if (!title.trim()) {
      toast({ title: 'Sarlavha kerak', description: 'Viktorina nomini kiriting', variant: 'destructive' });
      return null;
    }
    setCreating(true);
    try {
      const data = await createQuiz(ustozId, title.trim());
      const id = data.quiz.id;
      toast({ title: 'Viktorina yaratildi' });
      return id;
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="text-sm font-semibold mb-1.5 block" style={{ color: 'var(--ink)' }}>Viktorina nomi</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Masalan: Jinoyat huquqi bo'yicha sinov"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
      </div>

      <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
        <TabBtn icon={<Edit3 className="w-4 h-4" />} label="Qo'lda qo'shish" active={newTab === 'manual'} onClick={() => setNewTab('manual')} />
        <TabBtn icon={<Sparkles className="w-4 h-4" />} label="FanFaster AI bilan" active={newTab === 'ai'} onClick={() => setNewTab('ai')} />
        <TabBtn icon={<FileText className="w-4 h-4" />} label="Matndan qo'yish" active={newTab === 'text'} onClick={() => setNewTab('text')} />
      </div>

      {newTab === 'manual' && <ManualEditor ustozId={ustozId} ensureQuiz={ensureQuiz} onCreated={onCreated} creating={creating} />}
      {newTab === 'ai' && <AIEditor ustozId={ustozId} ensureQuiz={ensureQuiz} onCreated={onCreated} />}
      {newTab === 'text' && <TextImport ustozId={ustozId} ensureQuiz={ensureQuiz} onCreated={onCreated} />}
    </div>
  );
}

// ── Qo'lda savol muharriri ─────────────────────────────────────────────────────

function ManualEditor({ ustozId, ensureQuiz, onCreated, creating }: {
  ustozId: string;
  ensureQuiz: () => Promise<string | null>;
  onCreated: (id: string, title: string, questions: Question[]) => void;
  creating: boolean;
}) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  function emptyQuestion(): Question {
    return {
      type: 'variant4',
      text: '',
      options: [{ text: '', is_correct: true }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }],
      time_limit_s: 20,
      explanation: '',
      legal_basis: '',
      hint: '',
      source: 'manual',
    };
  }

  const current = questions[activeIdx] || questions[0];

  function updateCurrent(updater: (q: Question) => Question) {
    setQuestions(prev => prev.map((q, i) => i === activeIdx ? updater(q) : q));
  }

  function validateQuestion(q: Question): boolean {
    if (!q.text.trim()) return false;
    if (q.options.length < 2) return false;
    const hasEmpty = q.options.some(o => !o.text.trim());
    if (hasEmpty) return false;
    const correctCount = q.options.filter(o => o.is_correct).length;
    if (correctCount !== 1) return false;
    return true;
  }

  async function handleSaveAll() {
    const validQuestions = questions.filter(validateQuestion);
    if (validQuestions.length === 0) {
      toast({ title: 'Savol yo\'q', description: 'Kamida bitta to\'liq savol kerak', variant: 'destructive' });
      return;
    }
    const quizId = await ensureQuiz();
    if (!quizId) return;
    setSaving(true);
    try {
      await saveQuestions(quizId, ustozId, validQuestions);
      toast({ title: 'Saqlandi', description: `${validQuestions.length} ta savol` });
      onCreated(quizId, '', validQuestions);
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveAll();
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Savol raqami tanlash */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className="flex-shrink-0 w-9 h-9 rounded-lg text-xs font-bold transition-all"
            style={{
              background: i === activeIdx ? 'var(--cobalt-1)' : validateQuestion(q) ? 'var(--success-tint)' : 'var(--panel-2)',
              color: i === activeIdx ? 'white' : validateQuestion(q) ? 'var(--success)' : 'var(--ink-muted)',
              border: '1px solid var(--line)',
            }}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => { setQuestions(prev => [...prev, emptyQuestion()]); setActiveIdx(questions.length); }}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--cobalt-1)' }}
        >
          <Plus className="w-4 h-4" />
        </button>
        {questions.length > 1 && (
          <button
            onClick={() => {
              if (questions.length === 1) return;
              setQuestions(prev => prev.filter((_, i) => i !== activeIdx));
              setActiveIdx(Math.max(0, activeIdx - 1));
            }}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: '#C2303D' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Savol matni */}
      <textarea
        value={current.text}
        onChange={(e) => updateCurrent(q => ({ ...q, text: e.target.value }))}
        placeholder="Savol matni..."
        rows={3}
        className="w-full px-4 py-3 rounded-xl text-sm mb-3 outline-none resize-none"
        style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />

      {/* Variantlar */}
      <div className="space-y-2 mb-3">
        {current.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => updateCurrent(q => ({ ...q, options: q.options.map((o, oi) => ({ ...o, is_correct: oi === i })) }))}
              className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all"
              style={{
                borderColor: opt.is_correct ? 'var(--success)' : 'var(--line)',
                background: opt.is_correct ? 'var(--success)' : 'transparent',
              }}
              aria-label={`Variant ${String.fromCharCode(65 + i)} to'g'ri`}
            >
              {opt.is_correct && <CheckCircle2 className="w-4 h-4 text-white mx-auto" />}
            </button>
            <span className="text-xs font-bold w-5" style={{ color: 'var(--ink-muted)' }}>{String.fromCharCode(65 + i)}</span>
            <input
              value={opt.text}
              onChange={(e) => updateCurrent(q => ({ ...q, options: q.options.map((o, oi) => oi === i ? { ...o, text: e.target.value } : o) }))}
              placeholder={`Variant ${String.fromCharCode(65 + i)}`}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </div>
        ))}
      </div>

      {/* Izoh va asos modda */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input
          value={current.explanation}
          onChange={(e) => updateCurrent(q => ({ ...q, explanation: e.target.value }))}
          placeholder="Izoh (ixtiyoriy)"
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <input
          value={current.legal_basis}
          onChange={(e) => updateCurrent(q => ({ ...q, legal_basis: e.target.value }))}
          placeholder="Asos modda (ixtiyoriy, masalan: JK 97-modda)"
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
      </div>

      {/* Taymer */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--ink-muted)' }}>Vaqt:</span>
        {[10, 20, 30, 60].map(t => (
          <button
            key={t}
            onClick={() => updateCurrent(q => ({ ...q, time_limit_s: t }))}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: current.time_limit_s === t ? 'var(--cobalt-1)' : 'var(--panel-2)',
              color: current.time_limit_s === t ? 'white' : 'var(--ink-body)',
              border: '1px solid var(--line)',
            }}
          >
            {t}s
          </button>
        ))}
      </div>

      <button
        onClick={handleSaveAll}
        disabled={saving || creating}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all"
        style={{ background: 'linear-gradient(135deg, var(--cobalt-1), var(--cobalt-2))' }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        {saving ? 'Saqlanmoqda...' : 'Saqlash va keyingisi (Ctrl+Enter)'}
      </button>
    </div>
  );
}

// ── AI savol tuzish ────────────────────────────────────────────────────────────

function AIEditor({ ustozId, ensureQuiz, onCreated }: {
  ustozId: string;
  ensureQuiz: () => Promise<string | null>;
  onCreated: (id: string, title: string, questions: Question[]) => void;
}) {
  const { toast } = useToast();
  const [sourceText, setSourceText] = useState('');
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<'oson' | 'o\'rta' | 'qiyin'>('o\'rta');
  const [instruction, setInstruction] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'queued' | 'processing' | 'done' | 'error'>('idle');
  const [jobError, setJobError] = useState('');
  const [aiQuestions, setAiQuestions] = useState<Question[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (jobId && jobStatus !== 'done' && jobStatus !== 'error') {
      pollRef.current = setInterval(async () => {
        try {
          const data = await getAIJob(jobId, ustozId);
          setJobStatus(data.job.status);
          if (data.job.status === 'done') {
            setAiQuestions(data.job.result?.questions || []);
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (data.job.status === 'error') {
            setJobError(data.job.error || 'Xato');
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // network error — keep polling
        }
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, jobStatus, ustozId]);

  async function handleStart() {
    if (!sourceText.trim() || sourceText.trim().length < 20) {
      toast({ title: 'Manba yetarli emas', description: 'Kamida 20 belgi kerak', variant: 'destructive' });
      return;
    }
    const quizId = await ensureQuiz();
    if (!quizId) return;
    try {
      setJobStatus('queued');
      setJobError('');
      setAiQuestions([]);
      const data = await startAIJob(ustozId, [{ type: 'text', content: sourceText }], { count, difficulty, instruction }, quizId);
      setJobId(data.job_id);
      toast({ title: 'AI ishga tushdi', description: 'Savollar tuzilmoqda...' });
    } catch (err: any) {
      setJobStatus('error');
      setJobError(err.message);
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    }
  }

  async function handleAcceptAI() {
    if (!jobId || aiQuestions.length === 0) return;
    const quizId = await ensureQuiz();
    if (!quizId) return;
    try {
      await saveQuestions(quizId, ustozId, aiQuestions);
      toast({ title: 'Saqlandi', description: `${aiQuestions.length} ta AI savol` });
      onCreated(quizId, '', aiQuestions);
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    }
  }

  return (
    <div>
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--cobalt-tint)', border: '1px solid var(--cobalt-line)' }}>
        <p className="text-sm" style={{ color: 'var(--ink-body)' }}>
          FanFaster AI manbangizdan 4 variantli savollar tuzadi, har savolga qisqa izoh va (manbada bo'lsa) asos modda yozadi.
          Manbada yo'q narsani yozmaslikka harakat qiladi, lekin siz baribir tekshirib chiqasiz.
        </p>
      </div>

      <label className="text-sm font-semibold mb-1.5 block" style={{ color: 'var(--ink)' }}>Manba matni</label>
      <textarea
        value={sourceText}
        onChange={(e) => setSourceText(e.target.value)}
        placeholder="Manba matnini shu yerga qo'ying..."
        rows={6}
        className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none resize-none"
        style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--ink-muted)' }}>Savollar soni (1-40)</label>
          <input
            type="number"
            min={1}
            max={40}
            value={count}
            onChange={(e) => setCount(Math.min(40, Math.max(1, parseInt(e.target.value) || 10)))}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          />
        </div>
        <div>
          <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--ink-muted)' }}>Qiyinlik</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
          >
            <option value="oson">Oson</option>
            <option value="o'rta">O'rta</option>
            <option value="qiyin">Qiyin</option>
          </select>
        </div>
      </div>

      <input
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Qo'shimcha izoh (ixtiyoriy)"
        className="w-full px-3 py-2 rounded-lg text-sm mb-4 outline-none"
        style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />

      {jobStatus === 'idle' && (
        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, var(--navy-1), var(--gold))' }}
        >
          <Sparkles className="w-4 h-4" />
          FanFaster AI bilan tuzish
        </button>
      )}

      {(jobStatus === 'queued' || jobStatus === 'processing') && (
        <div className="text-center py-6 rounded-xl" style={{ background: 'var(--panel-2)' }}>
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: 'var(--cobalt-1)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {jobStatus === 'queued' ? 'Manbalar tayyorlanmoqda...' : 'Savollar tuzilmoqda...'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Sahifa yopilsa ham ish davom etadi</p>
        </div>
      )}

      {jobStatus === 'error' && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#C2303D' }} />
          <p className="text-sm" style={{ color: 'var(--ink)' }}>{jobError}</p>
        </div>
      )}

      {jobStatus === 'done' && aiQuestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--success)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{aiQuestions.length} ta savol tayyor</span>
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              ({aiQuestions.filter(q => q.basis_check === 'unverified').length} ta modda raqamini tekshiring)
            </span>
          </div>
          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
            {aiQuestions.map((q, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--cobalt-1)' }}>{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>{q.text}</p>
                    {q.legal_basis && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--gold-tint)', color: 'var(--gold-ink)' }}>
                        {q.legal_basis}
                      </span>
                    )}
                    {q.basis_check === 'unverified' && (
                      <span className="inline-block mt-1 ml-1 text-xs px-2 py-0.5 rounded" style={{ background: '#FEF3C7', color: '#92400E' }}>
                        Modda raqamini tekshiring
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleAcceptAI}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: 'var(--success)' }}
          >
            <CheckCircle2 className="w-4 h-4" />
            Qabul qilish va saqlash
          </button>
        </div>
      )}
    </div>
  );
}

// ── Matndan import ─────────────────────────────────────────────────────────────

function TextImport({ ustozId, ensureQuiz, onCreated }: {
  ustozId: string;
  ensureQuiz: () => Promise<string | null>;
  onCreated: (id: string, title: string, questions: Question[]) => void;
}) {
  const { toast } = useToast();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<Question[]>([]);
  const [parsedMode, setParsedMode] = useState(false);

  async function handleParse() {
    if (!rawText.trim()) {
      toast({ title: 'Matn kerak' });
      return;
    }
    const quizId = await ensureQuiz();
    if (!quizId) return;
    try {
      const data = await parseText(quizId, ustozId, rawText);
      setParsed(data.questions || []);
      setParsedMode(true);
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    }
  }

  function isValid(q: Question): boolean {
    return !!q.text.trim() && q.options.length >= 2 && !q.options.some(o => !o.text.trim()) && q.options.filter(o => o.is_correct).length === 1;
  }

  async function handleSave(validOnly: boolean) {
    const toSave = validOnly ? parsed.filter(isValid) : parsed;
    if (toSave.length === 0) {
      toast({ title: 'Saqlash uchun savol yo\'q', variant: 'destructive' });
      return;
    }
    const quizId = await ensureQuiz();
    if (!quizId) return;
    try {
      await saveQuestions(quizId, ustozId, toSave);
      toast({ title: 'Saqlandi', description: `${toSave.length} ta savol` });
      onCreated(quizId, '', toSave);
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    }
  }

  if (!parsedMode) {
    return (
      <div>
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--cobalt-tint)', border: '1px solid var(--cobalt-line)' }}>
          <p className="text-sm" style={{ color: 'var(--ink-body)' }}>
            Format: "1. Savol" keyin A) B) C) D) qatorlari, to'g'ri javob "*" yoki "To'g'ri: B" bilan.
          </p>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`1. Jinoyat kodeksining qaysi moddasi...\nA) birinchi variant\nB) ikkinchi variant\n* C) uchinchi variant\nD) to'rtinchi variant\nIzoh: ...`}
          rows={10}
          className="w-full px-4 py-3 rounded-xl text-sm mb-4 outline-none resize-none font-mono text-xs"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button
          onClick={handleParse}
          className="w-full py-3 rounded-xl font-semibold text-sm text-white"
          style={{ background: 'var(--cobalt-1)' }}
        >
          Ko'rib chiqish
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          {parsed.length} ta savol topildi ({parsed.filter(isValid).length} to'g'ri)
        </span>
        <button onClick={() => setParsedMode(false)} className="text-xs" style={{ color: 'var(--cobalt-1)' }}>Orqaga</button>
      </div>
      <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
        {parsed.map((q, i) => {
          const valid = isValid(q);
          return (
            <div key={i} className="rounded-lg p-3" style={{ background: 'var(--ff-card)', border: `1px solid ${valid ? 'var(--line)' : '#FECACA'}` }}>
              <div className="flex items-start gap-2">
                {valid ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#C2303D' }} />}
                <div className="flex-1">
                  <p className="text-sm" style={{ color: 'var(--ink)' }}>{i + 1}. {q.text}</p>
                  <div className="mt-1 space-y-0.5">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="text-xs flex items-center gap-1.5" style={{ color: o.is_correct ? 'var(--success)' : 'var(--ink-muted)' }}>
                        <span className="font-bold">{String.fromCharCode(65 + oi)})</span>
                        {o.text}
                        {o.is_correct && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                    ))}
                  </div>
                  {!valid && <p className="text-xs mt-1" style={{ color: '#C2303D' }}>To'ldirilmagan yoki to'g'ri javob yo'q</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        <button onClick={() => handleSave(true)} className="flex-1 py-3 rounded-xl font-semibold text-sm text-white" style={{ background: 'var(--success)' }}>
          Faqat to'g'rilarini saqlash ({parsed.filter(isValid).length})
        </button>
        <button onClick={() => handleSave(false)} className="py-3 px-4 rounded-xl font-semibold text-sm" style={{ background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line)' }}>
          Hammasini saqlash
        </button>
      </div>
    </div>
  );
}

// ── Sessiyalar tabi ────────────────────────────────────────────────────────────

function SessionsTab({ ustozId, onOpen }: { ustozId: string; onOpen: (sessionId: string) => void }) {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listSessions(ustozId);
        setSessions(data.sessions || []);
      } catch (err: any) {
        toast({ title: 'Xato', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [ustozId, toast]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--cobalt-1)' }} /></div>;
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--ink-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Hozircha o'tkazilgan o'yin yo'q.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {sessions.map((s, i) => (
        <motion.button
          key={s.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, ease: EASE }}
          onClick={() => onOpen(s.id)}
          className="w-full rounded-xl p-4 text-left transition-all hover:scale-[1.01]"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{s.hukm_quizzes?.title || 'Viktorina'}</h3>
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>{new Date(s.started_at).toLocaleDateString('uz-UZ')}</span>
          </div>
          <div className="flex gap-3 text-xs" style={{ color: 'var(--ink-muted)' }}>
            <span>{s.player_count} o'quvchi</span>
            <span>O'rtacha: {s.avg_correct_pct}%</span>
            <span>PIN: {s.pin}</span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

// ── Savol muharriri (tahrirlash uchun) ───────────────────────────────────────

function HukmEditor({ quizId, title, initialQuestions, ustozId, onExit }: {
  quizId: string;
  title: string;
  initialQuestions: Question[];
  ustozId: string;
  onExit: () => void;
}) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [quizTitle, setQuizTitle] = useState(title);

  function emptyQuestion(): Question {
    return {
      type: 'variant4',
      text: '',
      options: [{ text: '', is_correct: true }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }],
      time_limit_s: 20,
      explanation: '',
      legal_basis: '',
      source: 'manual',
    };
  }

  const current = questions[activeIdx] || questions[0] || emptyQuestion();

  function updateCurrent(updater: (q: Question) => Question) {
    setQuestions(prev => prev.map((q, i) => i === activeIdx ? updater(q) : q));
  }

  function validateQuestion(q: Question): boolean {
    return !!q.text.trim() && q.options.length >= 2 && !q.options.some(o => !o.text.trim()) && q.options.filter(o => o.is_correct).length === 1;
  }

  async function handleSave() {
    const valid = questions.filter(validateQuestion);
    if (valid.length === 0) {
      toast({ title: 'Savol yo\'q', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveQuestions(quizId, ustozId, valid);
      toast({ title: 'Saqlandi', description: `${valid.length} ta savol` });
      onExit();
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    const valid = questions.filter(validateQuestion);
    if (valid.length === 0) {
      toast({ title: 'Savol yo\'q', variant: 'destructive' });
      return;
    }
    await exportHukmDocx(quizTitle || 'Viktorina', valid);
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onExit} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <X className="w-4 h-4" style={{ color: 'var(--ink)' }} />
        </button>
        <input
          value={quizTitle}
          onChange={(e) => setQuizTitle(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold outline-none"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <button onClick={handleExport} className="w-9 h-9 rounded-lg flex items-center justify-center" title="Word'ga yuklash" style={{ background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
          <Download className="w-4 h-4" style={{ color: 'var(--ink)' }} />
        </button>
      </div>

      {/* Savol raqamlari */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className="flex-shrink-0 w-9 h-9 rounded-lg text-xs font-bold transition-all"
            style={{
              background: i === activeIdx ? 'var(--cobalt-1)' : validateQuestion(q) ? 'var(--success-tint)' : 'var(--panel-2)',
              color: i === activeIdx ? 'white' : validateQuestion(q) ? 'var(--success)' : 'var(--ink-muted)',
              border: '1px solid var(--line)',
            }}
          >
            {i + 1}
          </button>
        ))}
        <button
          onClick={() => { setQuestions(prev => [...prev, emptyQuestion()]); setActiveIdx(questions.length); }}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--cobalt-1)' }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Savol matni */}
      <textarea
        value={current.text}
        onChange={(e) => updateCurrent(q => ({ ...q, text: e.target.value }))}
        placeholder="Savol matni..."
        rows={3}
        className="w-full px-4 py-3 rounded-xl text-sm mb-3 outline-none resize-none"
        style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
      />

      {/* Variantlar */}
      <div className="space-y-2 mb-3">
        {current.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => updateCurrent(q => ({ ...q, options: q.options.map((o, oi) => ({ ...o, is_correct: oi === i })) }))}
              className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all"
              style={{ borderColor: opt.is_correct ? 'var(--success)' : 'var(--line)', background: opt.is_correct ? 'var(--success)' : 'transparent' }}
            >
              {opt.is_correct && <CheckCircle2 className="w-4 h-4 text-white mx-auto" />}
            </button>
            <span className="text-xs font-bold w-5" style={{ color: 'var(--ink-muted)' }}>{String.fromCharCode(65 + i)}</span>
            <input
              value={opt.text}
              onChange={(e) => updateCurrent(q => ({ ...q, options: q.options.map((o, oi) => oi === i ? { ...o, text: e.target.value } : o) }))}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input
          value={current.explanation}
          onChange={(e) => updateCurrent(q => ({ ...q, explanation: e.target.value }))}
          placeholder="Izoh (ixtiyoriy)"
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
        <input
          value={current.legal_basis}
          onChange={(e) => updateCurrent(q => ({ ...q, legal_basis: e.target.value }))}
          placeholder="Asos modda (ixtiyoriy)"
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--ff-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4" style={{ color: 'var(--ink-muted)' }} />
        {[10, 20, 30, 60].map(t => (
          <button
            key={t}
            onClick={() => updateCurrent(q => ({ ...q, time_limit_s: t }))}
            className="px-3 py-1 rounded-lg text-xs font-semibold"
            style={{
              background: current.time_limit_s === t ? 'var(--cobalt-1)' : 'var(--panel-2)',
              color: current.time_limit_s === t ? 'white' : 'var(--ink-body)',
              border: '1px solid var(--line)',
            }}
          >
            {t}s
          </button>
        ))}
        {current.source === 'ai' && <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--cobalt-tint)', color: 'var(--cobalt-1)' }}><Sparkles className="w-3 h-3 inline" /> AI</span>}
        {current.source === 'text' && <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--gold-tint)', color: 'var(--gold-ink)' }}>Matndan</span>}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
          style={{ background: 'var(--cobalt-1)' }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Saqlash
        </button>
        {questions.length > 1 && (
          <button
            onClick={() => { setQuestions(prev => prev.filter((_, i) => i !== activeIdx)); setActiveIdx(Math.max(0, activeIdx - 1)); }}
            className="py-3 px-4 rounded-xl"
            style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: '#C2303D' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
