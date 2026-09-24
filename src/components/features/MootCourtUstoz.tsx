import { useState, useEffect, useCallback, useMemo } from 'react';
import { Scale, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, MessageSquare, Star, Eye, ChevronLeft, Award, RotateCw, AlertCircle, ArrowRight, Search, ChevronDown, SlidersHorizontal, FolderOpen, BookMarked, RefreshCw, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface MootCase {
  id: string;
  ustoz_id: string;
  ustoz_ismi: string;
  sarlavha: string;
  tavsif: string;
  qonun_moddalar: string;
  tomonlar: string[];
  ai_rol: string;
  faol: boolean;
  max_exchanges: number;
  difficulty: string;
  allow_retry: boolean;
  is_public_demo: boolean;
  created_at: string;
  tadqiqot_holati?: string;
  tasdiqlangan_moddalar?: any[];
  namunaviy_javob?: string | null;
}

interface ScoreCriterion {
  name: string;
  score: number;
  explanation: string;
}

interface MootSession {
  id: string;
  case_id: string;
  oquvchi_ismi: string;
  oquvchi_tomon: string;
  messages: { role: string; text: string; timestamp?: number }[];
  status: string;
  balo: number | null;
  izoh: string | null;
  ai_score: number | null;
  ai_score_breakdown: ScoreCriterion[] | null;
  ai_comment: string | null;
  teacher_score: number | null;
  created_at: string;
  moot_court_cases?: MootCase;
}

const diffStyles: Record<string, { gradient: string; glow: string; badge: string; label: string }> = {
  yengil: { gradient: 'from-emerald-50 via-transparent to-transparent', glow: 'shadow-[0_0_20px_-8px_rgba(16,185,129,0.25)]', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Yengil' },
  orta:   { gradient: 'from-blue-50 via-transparent to-transparent',    glow: 'shadow-[0_0_20px_-8px_rgba(59,130,246,0.25)]',  badge: 'bg-blue-100 text-blue-700 border-blue-200',     label: "O'rta" },
  qattiq: { gradient: 'from-red-50 via-transparent to-transparent',     glow: 'shadow-[0_0_20px_-8px_rgba(239,68,68,0.25)]',   badge: 'bg-red-100 text-red-700 border-red-200',         label: 'Qattiq' },
};

function getDiff(d: string) {
  return diffStyles[d] || diffStyles.orta;
}

function CircularProgress({ score, max }: { score: number; max: number }) {
  const r = 16;
  const circumference = 2 * Math.PI * r;
  const pct = score / max;
  const offset = circumference * (1 - pct);
  const color = pct >= 0.9 ? '#10b981' : pct >= 0.5 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="40" height="40" className="shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={{ '--mc-circumference': `${circumference}px`, '--mc-offset': `${offset}px` } as React.CSSProperties}
        className="mc-ring-circle"
        transform="rotate(-90 20 20)"
      />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1f2937">{score}/{max}</text>
    </svg>
  );
}

export default function MootCourtUstoz() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'kazuslar' | 'natijalar'>('kazuslar');
  const [cases, setCases] = useState<MootCase[]>([]);
  const [sessions, setSessions] = useState<MootSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCase, setEditingCase] = useState<MootCase | null>(null);
  const [viewingSession, setViewingSession] = useState<MootSession | null>(null);

  // Search & filter state (kazuslar)
  const [caseSearch, setCaseSearch] = useState('');
  const [caseDiffFilter, setCaseDiffFilter] = useState<string[]>([]);
  const [caseStatusFilter, setCaseStatusFilter] = useState<string[]>([]);
  const [caseVisibleCount, setCaseVisibleCount] = useState(10);

  // Natijalar grouped state
  const [selectedCaseForResults, setSelectedCaseForResults] = useState<string | null>(null);
  const [resultSearch, setResultSearch] = useState('');

  // Form state
  const [sarlavha, setSarlavha] = useState('');
  const [tavsif, setTavsif] = useState('');
  const [qonunModdalar, setQonunModdalar] = useState('');
  const [tomonlar, setTomonlar] = useState<string[]>(['da\'vogar', 'javobgar']);
  const [tomonInput, setTomonInput] = useState('');
  const [aiRol, setAiRol] = useState<'qarshi_tomon' | 'sudya'>('qarshi_tomon');
  const [maxExchanges, setMaxExchanges] = useState(5);
  const [difficulty, setDifficulty] = useState<'yengil' | 'orta' | 'qattiq'>('orta');
  const [allowRetry, setAllowRetry] = useState(true);
  const [isPublicDemo, setIsPublicDemo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggeringResearch, setTriggeringResearch] = useState(false);

  const loadCases = useCallback(async () => {
    if (!user?.ustoz_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('moot_court_cases')
      .select('*')
      .eq('ustoz_id', user.ustoz_id)
      .order('created_at', { ascending: false });
    setCases((data || []) as MootCase[]);
    setLoading(false);
  }, [user?.ustoz_id]);

  const loadSessions = useCallback(async () => {
    if (!user?.ustoz_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('moot_court_sessions')
      .select('*, moot_court_cases!case_id(*)')
      .eq('moot_court_cases.ustoz_id', user.ustoz_id)
      .order('created_at', { ascending: false });
    setSessions((data || []) as MootSession[]);
    setLoading(false);
  }, [user?.ustoz_id]);

  useEffect(() => {
    if (tab === 'kazuslar') loadCases();
    else loadSessions();
  }, [tab, loadCases, loadSessions]);

  const resetForm = () => {
    setSarlavha('');
    setTavsif('');
    setQonunModdalar('');
    setTomonlar(['da\'vogar', 'javobgar']);
    setAiRol('qarshi_tomon');
    setMaxExchanges(5);
    setDifficulty('orta');
    setAllowRetry(true);
    setIsPublicDemo(false);
    setEditingCase(null);
  };

  const handleSave = async () => {
    if (!user?.ustoz_id) return;
    if (!sarlavha.trim() || !tavsif.trim()) {
      toast({ title: 'Sarlavha va tavsif majburiy', variant: 'destructive' });
      return;
    }
    const clamped = Math.max(3, Math.min(8, maxExchanges));
    setSaving(true);
    const payload = {
      ustoz_id: user.ustoz_id,
      ustoz_ismi: `${user.ism} ${user.familiya}`,
      sarlavha: sarlavha.trim(),
      tavsif: tavsif.trim(),
      qonun_moddalar: qonunModdalar.trim(),
      tomonlar: tomonlar.filter(t => t.trim()),
      ai_rol: aiRol,
      max_exchanges: clamped,
      difficulty,
      allow_retry: allowRetry,
      is_public_demo: isPublicDemo,
    };

    if (editingCase) {
      const { error } = await supabase
        .from('moot_court_cases')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingCase.id);
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Kazus yangilandi', description: 'Qonun moddalari tadqiqoti fon rejimida yangilanadi' });
        setShowForm(false);
        resetForm();
        loadCases();
        triggerResearch(editingCase.id);
      }
    } else {
      const { data: newCase, error } = await supabase
        .from('moot_court_cases')
        .insert(payload).select('id').single();
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Yangi kazus yaratildi', description: 'Qonun moddalari tadqiqoti fon rejimida boshlandi' });
        setShowForm(false);
        resetForm();
        loadCases();
        if (newCase?.id) triggerResearch(newCase.id);
      }
    }
    setSaving(false);
  };

  const triggerResearch = async (caseId: string) => {
    setTriggeringResearch(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/case-research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ caseId, action: 'run' }),
      });
      const data = await res.json();
      if (data?.success) {
        const holat = data.holat || 'tayyor';
        const tasdiqSoni = data.step2?.tasdiqlanganlar?.length || 0;
        toast({
          title: holat === 'tayyor' ? 'Tadqiqot tayyor' : holat === 'qisman' ? 'Tadqiqot qisman' : 'Tadqiqot xatosi',
          description: holat === 'tayyor' ? `${tasdiqSoni} ta qonun moddasi tasdiqlandi` : holat === 'qisman' ? 'AI modda topa olmadi yoki bazada qonunlar yetarli emas' : data.error || 'Xatolik yuz berdi',
        });
        loadCases();
      } else if (data?.error) {
        toast({ title: 'Tadqiqot xatosi', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'Tadqiqot amalga oshmadi', variant: 'destructive' });
    } finally {
      setTriggeringResearch(false);
    }
  };

  const handleEdit = (c: MootCase) => {
    setEditingCase(c);
    setSarlavha(c.sarlavha);
    setTavsif(c.tavsif);
    setQonunModdalar(c.qonun_moddalar);
    setTomonlar(c.tomonlar || []);
    setAiRol(c.ai_rol as 'qarshi_tomon' | 'sudya');
    setMaxExchanges(c.max_exchanges || 5);
    setDifficulty((c.difficulty as 'yengil' | 'orta' | 'qattiq') || 'orta');
    setAllowRetry(c.allow_retry !== false);
    setIsPublicDemo(c.is_public_demo === true);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kazusni o\'chirishni istaysizmi? Barcha sessiyalar ham o\'chiriladi.')) return;
    const { error } = await supabase.from('moot_court_cases').delete().eq('id', id);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Kazus o\'chirildi' });
      loadCases();
    }
  };

  const toggleFaol = async (c: MootCase) => {
    await supabase
      .from('moot_court_cases')
      .update({ faol: !c.faol, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    loadCases();
  };

  const addTomon = () => {
    const t = tomonInput.trim();
    if (t && !tomonlar.includes(t)) {
      setTomonlar([...tomonlar, t]);
      setTomonInput('');
    }
  };

  const removeTomon = (t: string) => {
    setTomonlar(tomonlar.filter(x => x !== t));
  };

  const [reevaluating, setReevaluating] = useState(false);

  const reevaluateSession = async (sessionId: string) => {
    setReevaluating(true);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/moot-court-evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data?.evaluation) {
        toast({ title: 'AI bahosi tayyor' });
        loadSessions();
        const { data: updated } = await supabase
          .from('moot_court_sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle();
        if (updated) setViewingSession(updated as MootSession);
      } else if (data?.error) {
        toast({ title: 'Baholash xatosi', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'AI baholash amalga oshmadi', variant: 'destructive' });
    } finally {
      setReevaluating(false);
    }
  };

  const saveTeacherScore = async (sessionId: string, score: number) => {
    const { error } = await supabase
      .from('moot_court_sessions')
      .update({ teacher_score: score, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (error) {
      toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Baho saqlandi' });
      loadSessions();
      setViewingSession(prev => prev ? { ...prev, teacher_score: score } : null);
    }
  };

  // Filtered cases (kazuslar tab)
  const filteredCases = useMemo(() => {
    let result = cases;
    if (caseSearch.trim()) {
      const q = caseSearch.toLowerCase();
      result = result.filter(c =>
        c.sarlavha.toLowerCase().includes(q) ||
        c.tavsif.toLowerCase().includes(q)
      );
    }
    if (caseDiffFilter.length > 0) {
      result = result.filter(c => caseDiffFilter.includes(c.difficulty || 'orta'));
    }
    if (caseStatusFilter.length > 0) {
      result = result.filter(c => {
        const status = c.faol ? 'faol' : 'nofaol';
        return caseStatusFilter.includes(status);
      });
    }
    return result;
  }, [cases, caseSearch, caseDiffFilter, caseStatusFilter]);

  const visibleCases = filteredCases.slice(0, caseVisibleCount);

  // Grouped sessions by case
  const sessionsByCase = useMemo(() => {
    const groups: Record<string, { case: MootCase; sessions: MootSession[] }> = {};
    for (const s of sessions) {
      const caseId = s.case_id;
      if (!groups[caseId]) {
        groups[caseId] = { case: s.moot_court_cases!, sessions: [] };
      }
      groups[caseId].sessions.push(s);
    }
    let groupList = Object.values(groups);
    if (resultSearch.trim()) {
      const q = resultSearch.toLowerCase();
      groupList = groupList.filter(g =>
        g.case?.sarlavha?.toLowerCase().includes(q) ||
        g.sessions.some(s => s.oquvchi_ismi?.toLowerCase().includes(q))
      );
    }
    return groupList;
  }, [sessions, resultSearch]);

  const filteredSessionsForCase = useMemo(() => {
    if (!selectedCaseForResults) return [];
    let result = sessions.filter(s => s.case_id === selectedCaseForResults);
    if (resultSearch.trim()) {
      const q = resultSearch.toLowerCase();
      result = result.filter(s =>
        s.oquvchi_ismi?.toLowerCase().includes(q) ||
        s.moot_court_cases?.sarlavha?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sessions, selectedCaseForResults, resultSearch]);

  if (!user || user.rol !== 'ustoz') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Scale className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 font-medium">Bu bo'lim faqat ustozlar uchun</p>
      </div>
    );
  }

  // Session detail view
  if (viewingSession) {
    const aiScore = viewingSession.ai_score;
    const teacherScore = viewingSession.teacher_score;
    const hasBoth = aiScore !== null && teacherScore !== null && aiScore !== teacherScore;
    const aiColor = aiScore !== null ? (aiScore >= 8 ? '#10b981' : aiScore >= 5 ? '#f59e0b' : '#ef4444') : '#3b82f6';
    const aiCircumference = 2 * Math.PI * 32;
    const aiPct = aiScore !== null ? aiScore / 10 : 0;
    const aiOffset = aiCircumference * (1 - aiPct);

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <button
          onClick={() => setViewingSession(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Natijalarga qaytish
        </button>

        <div className="rounded-3xl bg-white shadow-lg border border-gray-100/80 overflow-hidden">
          <div className="p-4 border-b border-gray-100/80">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-gray-900">{viewingSession.moot_court_cases?.sarlavha || 'Kazus'}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Talaba: <span className="font-bold text-gray-700">{viewingSession.oquvchi_ismi}</span>
                  {viewingSession.oquvchi_tomon && (
                    <span className="ml-2 text-blue-600">• {viewingSession.oquvchi_tomon}</span>
                  )}
                </p>
              </div>
              <Badge variant={viewingSession.status === 'yakunlangan' ? 'default' : 'secondary'}>
                {viewingSession.status === 'yakunlangan' ? 'Yakunlangan' : 'Faol'}
              </Badge>
            </div>
          </div>
          <div className="p-4">
            {/* AI score ring + teacher comparison */}
            {aiScore !== null && (
              <div className="flex items-center gap-4 mb-4 rounded-2xl bg-gradient-to-br from-gray-50/80 to-white p-4 border border-gray-100/60">
                <svg width="76" height="76" className="shrink-0">
                  <circle cx="38" cy="38" r="32" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                  <circle
                    cx="38" cy="38" r="32" fill="none" stroke={aiColor} strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={aiCircumference}
                    style={{ '--mc-circumference': `${aiCircumference}px`, '--mc-offset': `${aiOffset}px` } as React.CSSProperties}
                    className="mc-ring-circle"
                    transform="rotate(-90 38 38)"
                  />
                  <text x="38" y="40" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1f2937">{aiScore}</text>
                  <text x="38" y="52" textAnchor="middle" fontSize="10" fill="#9ca3af">/ 10</text>
                </svg>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-bold text-gray-900">AI bahosi</span>
                  </div>
                  {hasBoth && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-bold text-gray-500">AI: {aiScore}</span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <span className="text-xs font-bold text-amber-600">Ustoz: {teacherScore}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${teacherScore > aiScore ? 'bg-green-100 text-green-700' : teacherScore < aiScore ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                        {teacherScore > aiScore ? `+${teacherScore - aiScore}` : teacherScore < aiScore ? `${teacherScore - aiScore}` : '='}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[400px] overflow-y-auto p-1">
              {(viewingSession.messages || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mc-msg-in mc-no-select`} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
                  {msg.role !== 'user' ? (
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <div className="h-0.5 w-4 rounded-full bg-blue-400" />
                        <span className="text-[10px] font-bold text-blue-600">
                          {viewingSession.moot_court_cases?.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                        </span>
                      </div>
                      <div className="bg-gray-50 text-gray-800 rounded-2xl rounded-tl-md px-4 py-3 border border-gray-100/60">
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[80%] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-md shadow-blue-500/20">
                      <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                    </div>
                  )}
                </div>
              ))}
              {(!viewingSession.messages || viewingSession.messages.length === 0) && (
                <p className="text-center text-xs text-gray-400 py-8">Suhbat bo'sh</p>
              )}
            </div>

            <AiEvaluationView session={viewingSession} onSaveTeacherScore={saveTeacherScore} onReevaluate={reevaluateSession} reevaluating={reevaluating} />
          </div>
        </div>
      </div>
    );
  }

  // Form view
  if (showForm) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setShowForm(false); resetForm(); }}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Ro'yxatga qaytish
          </button>
          <h2 className="text-sm font-bold text-gray-800">
            {editingCase ? 'Kazusni tahrirlash' : 'Yangi Moot Court kazusi'}
          </h2>
        </div>

        <div className="rounded-3xl bg-white shadow-lg border border-gray-100/80 overflow-hidden">
          <div className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-bold">Sarlavha *</Label>
              <Input
                value={sarlavha}
                onChange={e => setSarlavha(e.target.value)}
                placeholder="Masalan: Fuqarolik shartnomasi bo'yicha nizo"
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Vaziyat tavsifi *</Label>
              <Textarea
                value={tavsif}
                onChange={e => setTavsif(e.target.value)}
                placeholder="Sud jarayoni vaziyatini batafsil yozing..."
                className="mt-1.5 min-h-[120px] rounded-xl"
              />
            </div>

            <div className="rounded-2xl border border-blue-100/80 bg-blue-50/40 p-3.5">
              <div className="flex items-start gap-2">
                <RefreshCw className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-blue-700">Qonun moddalari avtomatik tadqiq etiladi</p>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Kazus yaratilgach, sun'iy intellekt tavsifga tayanib mos qonun moddalarini nomzod qilib ko'rsatadi va ular bazadagi tasdiqlangan moddalar bilan solishtiriladi. Natija kazus kartasida ko'rinadi.
                  </p>
                  {editingCase?.tadqiqot_holati && (
                    <div className="mt-2">
                      <ResearchBadge holat={editingCase.tadqiqot_holati} moddalarSoni={editingCase.tasdiqlangan_moddalar?.length || 0} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Qo'shimcha qonun/moddalar (ixtiyoriy, erkin matn)</Label>
              <Input
                value={qonunModdalar}
                onChange={e => setQonunModdalar(e.target.value)}
                placeholder="Masalan: Fuqarolik kodeksi 123-modda, 124-modda"
                className="mt-1.5 rounded-xl"
              />
              <p className="text-[10px] text-gray-400 mt-1">Avtomatik tadqiqot topa olmagan moddalar uchun qo'lda yozishingiz mumkin</p>
            </div>

            <div>
              <Label className="text-xs font-bold">Tomonlar (talaba tanlashi mumkin)</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={tomonInput}
                  onChange={e => setTomonInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTomon(); } }}
                  placeholder="Masalan: da'vogar, javobgar..."
                  className="flex-1 rounded-xl"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTomon} className="rounded-xl">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tomonlar.map(t => (
                  <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => removeTomon(t)}>
                    {t} ✕
                  </Badge>
                ))}
                {tomonlar.length === 0 && (
                  <span className="text-xs text-gray-400">Tomonlar yo'q — talaba tomon tanlamasdan o'ynaydi</span>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">AI roli</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  onClick={() => setAiRol('qarshi_tomon')}
                  className={`p-3 rounded-2xl border-2 text-sm font-bold transition-all duration-300 ${
                    aiRol === 'qarshi_tomon'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-500/10'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  🥷 Qarama-qarshi tomon
                </button>
                <button
                  onClick={() => setAiRol('sudya')}
                  className={`p-3 rounded-2xl border-2 text-sm font-bold transition-all duration-300 ${
                    aiRol === 'sudya'
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md shadow-blue-500/10'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  ⚖️ Sudya
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Qiyinlik darajasi</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setDifficulty('yengil')}
                  className={`p-3 rounded-2xl border-2 text-center transition-all duration-300 ${
                    difficulty === 'yengil'
                      ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-500/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`text-sm font-bold ${difficulty === 'yengil' ? 'text-emerald-700' : 'text-gray-500'}`}>Yengil</div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-tight">AI sodda savollar beradi, yo'l ko'rsatadi — yangi boshlovchilar uchun</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('orta')}
                  className={`p-3 rounded-2xl border-2 text-center transition-all duration-300 ${
                    difficulty === 'orta'
                      ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-500/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`text-sm font-bold ${difficulty === 'orta' ? 'text-amber-700' : 'text-gray-500'}`}>O'rta</div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-tight">AI standart advokat/sudya kabi savol beradi va asosli e'tiroz bildiradi</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty('qattiq')}
                  className={`p-3 rounded-2xl border-2 text-center transition-all duration-300 ${
                    difficulty === 'qattiq'
                      ? 'border-red-500 bg-red-50 shadow-md shadow-red-500/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`text-sm font-bold ${difficulty === 'qattiq' ? 'text-red-700' : 'text-gray-500'}`}>Qattiq</div>
                  <div className="text-[10px] text-gray-400 mt-1 leading-tight">AI qattiq, tajribali advokat kabi qiynaydi — yuqori darajadagi talabalar uchun</div>
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Nechta almashinuvdan keyin yakunlansin</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  type="number"
                  min={3}
                  max={8}
                  value={maxExchanges}
                  onChange={e => setMaxExchanges(parseInt(e.target.value) || 5)}
                  className="w-24 rounded-xl"
                />
                <span className="text-xs text-gray-500">Talaba shuncha argument yuborgach, AI yakuniy nutq so'zlaydi va sessiya avtomatik yakunlanadi (3-8)</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-gray-200/80 bg-gray-50/50">
              <div>
                <Label className="text-xs font-bold">Talaba qayta yecha oladimi?</Label>
                <p className="text-[11px] text-gray-400 mt-0.5">Yoqilgan bo'lsa, talaba bu kazusni xohlagancha qayta yechishi mumkin. O'chirilgan bo'lsa, faqat bitta urinish.</p>
              </div>
              <button
                type="button"
                onClick={() => setAllowRetry(!allowRetry)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${allowRetry ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${allowRetry ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-gray-200/80 bg-gray-50/50">
              <div>
                <Label className="text-xs font-bold">Ommaviy namuna (demo)</Label>
                <p className="text-[11px] text-gray-400 mt-0.5">Yoqilgan bo'lsa, tizimga kirmagan mehmonlar bu kazusni sinab ko'rishi mumkin (faqat 2 almashinuv).</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublicDemo(!isPublicDemo)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${isPublicDemo ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isPublicDemo ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl shadow-lg shadow-blue-500/20">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCase ? 'Saqlash' : 'Kazus yaratish'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">Moot Court</h2>
        </div>
        {tab === 'kazuslar' && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="rounded-xl shadow-md shadow-blue-500/10">
            <Plus className="h-4 w-4 mr-1" /> Yangi kazus
          </Button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100/80 rounded-2xl">
        <button
          onClick={() => { setTab('kazuslar'); setSelectedCaseForResults(null); setResultSearch(''); }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 ${
            tab === 'kazuslar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Kazuslar ({cases.length})
        </button>
        <button
          onClick={() => { setTab('natijalar'); setSelectedCaseForResults(null); }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all duration-300 ${
            tab === 'natijalar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Natijalar ({sessions.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : tab === 'kazuslar' ? (
        cases.length === 0 ? (
          <div className="text-center py-16">
            <Scale className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Hozircha kazuslar yo'q</p>
            <p className="text-xs text-gray-400 mt-1">"Yangi kazus" tugmasini bosing</p>
          </div>
        ) : (
          <>
            {/* Search & filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={caseSearch}
                  onChange={e => { setCaseSearch(e.target.value); setCaseVisibleCount(10); }}
                  placeholder="Kazus qidirish..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                {(['yengil', 'orta', 'qattiq'] as const).map(d => {
                  const diff = getDiff(d);
                  const active = caseDiffFilter.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => { setCaseDiffFilter(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]); setCaseVisibleCount(10); }}
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-200 ${active ? diff.badge : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'}`}
                    >
                      {diff.label}
                    </button>
                  );
                })}
                <span className="w-px h-4 bg-gray-200 mx-0.5" />
                {(['faol', 'nofaol'] as const).map(s => {
                  const active = caseStatusFilter.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => { setCaseStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); setCaseVisibleCount(10); }}
                      className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-200 ${active ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'}`}
                    >
                      {s === 'faol' ? 'Faol' : 'Nofaol'}
                    </button>
                  );
                })}
                {(caseDiffFilter.length > 0 || caseStatusFilter.length > 0) && (
                  <button
                    onClick={() => { setCaseDiffFilter([]); setCaseStatusFilter([]); }}
                    className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors px-1"
                  >
                    Tozalash
                  </button>
                )}
              </div>
            </div>

            {filteredCases.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Qidiruv bo'yicha kazus topilmadi</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {visibleCases.map((c) => {
                    const diff = getDiff(c.difficulty);
                    return (
                      <div
                        key={c.id}
                        className={`group relative overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100/80 ${diff.glow}`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${diff.gradient} pointer-events-none opacity-70`} />
                        <div className="relative h-1 bg-gradient-to-r from-blue-400/50 via-blue-500/30 to-transparent" />
                        <div className="relative p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <h3 className="font-bold text-gray-900 truncate text-sm">{c.sarlavha}</h3>
                                <Badge variant={c.faol ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                                  {c.faol ? 'Faol' : 'Nofaol'}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-2">{c.tavsif}</p>
                              {c.qonun_moddalar && (
                                <p className="text-[11px] text-blue-600 font-medium mt-1.5">📋 {c.qonun_moddalar}</p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-2">
                                {c.tomonlar?.map(t => (
                                  <Badge key={t} variant="outline" className="text-[10px] border-gray-200/80">{t}</Badge>
                                ))}
                                <Badge variant="outline" className="text-[10px] border-gray-200/80">
                                  {c.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] border-gray-200/80">
                                  {c.max_exchanges || 5} almashinuv
                                </Badge>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diff.badge}`}>{diff.label}</span>
                                {c.allow_retry === false && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">↻ 1 urinish</span>
                                )}
                                {c.is_public_demo && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">Demo</span>
                                )}
                                <ResearchBadge holat={c.tadqiqot_holati || 'kutmoqda'} moddalarSoni={c.tasdiqlangan_moddalar?.length || 0} />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100/60">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(c)} className="text-xs h-7 rounded-lg">
                              <Edit className="h-3 w-3 mr-1" /> Tahrirlash
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleFaol(c)} className="text-xs h-7 rounded-lg">
                              {c.faol ? (
                                <><ToggleRight className="h-3.5 w-3.5 mr-1 text-green-600" /> Faol</>
                              ) : (
                                <><ToggleLeft className="h-3.5 w-3.5 mr-1 text-gray-400" /> Nofaol</>
                              )}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => triggerResearch(c.id)} disabled={triggeringResearch} className="text-xs h-7 rounded-lg">
                              {triggeringResearch ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                              Tadqiqot
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="text-xs h-7 text-red-500 hover:text-red-600 rounded-lg">
                              <Trash2 className="h-3 w-3 mr-1" /> O'chirish
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {caseVisibleCount < filteredCases.length && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCaseVisibleCount(prev => prev + 10)}
                      className="rounded-xl text-xs"
                    >
                      Ko'proq ko'rsatish ({filteredCases.length - caseVisibleCount} ta qoldi)
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )
      ) : (
        /* ── NATIJALAR: Two-step grouped navigation ── */
        sessions.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Hozircha sessiyalar yo'q</p>
            <p className="text-xs text-gray-400 mt-1">Talabalar yakunlagan sessiyalar shu yerda ko'rinadi</p>
          </div>
        ) : (
          <>
            {/* Search for results */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={resultSearch}
                onChange={e => { setResultSearch(e.target.value); setSelectedCaseForResults(null); }}
                placeholder="Kazus yoki talaba ismi bo'yicha qidirish..."
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            {selectedCaseForResults ? (
              /* Step 2: sessions for selected case */
              <>
                <button
                  onClick={() => setSelectedCaseForResults(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Kazuslar ro'yxatiga qaytish
                </button>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900">
                    {sessionsByCase.find(g => g.case?.id === selectedCaseForResults)?.case?.sarlavha || 'Kazus'}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {filteredSessionsForCase.length} ta natija
                  </Badge>
                </div>
                {filteredSessionsForCase.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">Bu kazus bo'yicha natija topilmadi</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredSessionsForCase.map(s => {
                      const diff = getDiff(s.moot_court_cases?.difficulty || 'orta');
                      return (
                        <div
                          key={s.id}
                          className={`group relative overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 ${diff.glow}`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${diff.gradient} pointer-events-none opacity-50`} />
                          <div className="relative p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-bold text-gray-900 truncate">
                                  {s.oquvchi_ismi}
                                </h3>
                                {s.oquvchi_tomon && <span className="text-xs text-blue-600">{s.oquvchi_tomon}</span>}
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {new Date(s.created_at).toLocaleString('uz-UZ')}
                                </p>
                                {s.ai_score !== null && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <Award className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-xs font-bold text-gray-700">AI: {s.ai_score}/10</span>
                                    {s.teacher_score !== null && (
                                      <span className="text-xs font-bold text-amber-600 ml-1">Ustoz: {s.teacher_score}/10</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <Badge variant={s.status === 'yakunlangan' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                                {s.status === 'yakunlangan' ? 'Yakunlangan' : 'Faol'}
                              </Badge>
                            </div>
                            <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-100/60">
                              <Button size="sm" variant="ghost" onClick={() => setViewingSession(s)} className="text-xs h-7 rounded-lg">
                                <Eye className="h-3 w-3 mr-1" /> Suhbatni ko'rish
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Step 1: case groups */
              sessionsByCase.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Qidiruv bo'yicha natija topilmadi</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sessionsByCase.map(g => {
                    const diff = getDiff(g.case?.difficulty || 'orta');
                    return (
                      <button
                        key={g.case?.id}
                        onClick={() => { setSelectedCaseForResults(g.case?.id || ''); setResultSearch(''); }}
                        className={`group relative w-full overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border border-gray-100/80 text-left ${diff.glow}`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${diff.gradient} pointer-events-none opacity-50`} />
                        <div className="relative p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                              <FolderOpen className="h-4.5 w-4.5 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-gray-900 truncate">{g.case?.sarlavha || 'Kazus'}</h3>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {g.sessions.length} ta natija
                                {g.sessions.filter(s => s.status === 'yakunlangan').length > 0 && (
                                  <span className="ml-1.5">• {g.sessions.filter(s => s.status === 'yakunlangan').length} yakunlangan</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${diff.badge}`}>{diff.label}</span>
                            <ChevronLeft className="h-4 w-4 text-gray-300 rotate-180 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </>
        )
      )}
    </div>
  );
}

function ResearchBadge({ holat, moddalarSoni }: { holat: string; moddalarSoni: number }) {
  if (holat === 'tayyor') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
        <CheckCircle className="h-2.5 w-2.5" /> {moddalarSoni} modda
      </span>
    );
  }
  if (holat === 'jarayonda') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Tadqiqot
      </span>
    );
  }
  if (holat === 'qisman') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
        <AlertCircle className="h-2.5 w-2.5" /> Qisman
      </span>
    );
  }
  if (holat === 'xato') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 inline-flex items-center gap-1">
        <XCircle className="h-2.5 w-2.5" /> Xato
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 inline-flex items-center gap-1">
      <Clock className="h-2.5 w-2.5" /> Kutmoqda
    </span>
  );
}

function AiEvaluationView({ session, onSaveTeacherScore, onReevaluate, reevaluating }: {
  session: MootSession;
  onSaveTeacherScore: (id: string, score: number) => void;
  onReevaluate: (id: string) => void;
  reevaluating: boolean;
}) {
  const [teacherScore, setTeacherScore] = useState(session.teacher_score?.toString() || session.ai_score?.toString() || '');

  const breakdown = session.ai_score_breakdown || [];
  const hasEvaluation = session.ai_score !== null;

  if (!hasEvaluation) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100/80 space-y-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Award className="h-4 w-4" />
          <span className="text-xs font-medium">AI bahosi hali mavjud emas</span>
        </div>
        {reevaluating ? (
          <div className="flex items-center gap-2 bg-blue-50/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-blue-100">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-xs font-medium text-blue-600">AI baholamoqda...</span>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onReevaluate(session.id)}
            className="text-xs rounded-xl"
          >
            <RotateCw className="h-3.5 w-3.5 mr-1" /> AI baholashni qayta boshlash
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100/80 space-y-4">
      {/* Overall comment */}
      {session.ai_comment && (
        <div className="bg-gradient-to-br from-blue-50/80 to-white rounded-2xl p-3 border border-blue-100/60">
          <p className="text-[10px] font-bold text-blue-600 mb-1">Umumiy izoh</p>
          <p className="text-xs text-gray-700 leading-relaxed">{session.ai_comment}</p>
        </div>
      )}

      {/* Criteria breakdown with circular progress */}
      {breakdown.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">Mezonlar bo'yicha batafsil:</p>
          {breakdown.map((c, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50/80 rounded-2xl p-3 border border-gray-100/60">
              <CircularProgress score={c.score} max={2} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 mb-0.5">{c.name}</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">{c.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Teacher score override */}
      <div className="pt-3 border-t border-gray-100/80">
        <Label className="text-xs font-bold">Yakuniy baho (ustoz)</Label>
        <p className="text-[11px] text-gray-400 mb-2">Standart holatda AI bahosi bilan to'ldirilgan. Istalgan songa o'zgartiring.</p>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={0}
            max={10}
            value={teacherScore}
            onChange={e => setTeacherScore(e.target.value)}
            placeholder="Masalan: 8"
            className="w-24 rounded-xl"
          />
          <Button
            size="sm"
            onClick={() => {
              const s = parseInt(teacherScore);
              if (s >= 0 && s <= 10) onSaveTeacherScore(session.id, s);
              else alert('Baho 0-10 orasida bo\'lishi kerak');
            }}
            className="rounded-xl shadow-md shadow-blue-500/10"
          >
            Saqlash
          </Button>
          {session.teacher_score !== null && session.teacher_score !== session.ai_score && (
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-xs text-gray-500">
                AI: <span className="font-bold text-blue-600">{session.ai_score}</span>
              </span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-500">
                Ustoz: <span className="font-bold text-amber-600">{session.teacher_score}</span>
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${session.teacher_score > session.ai_score ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {session.teacher_score > session.ai_score ? `+${session.teacher_score - session.ai_score!}` : `${session.teacher_score - session.ai_score!}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
