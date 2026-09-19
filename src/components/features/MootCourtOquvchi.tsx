import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Scale, Loader2, Send, ChevronLeft, CheckCircle2, Gavel, MessageSquare, Award, AlertCircle, RotateCw, Search, ChevronDown, SlidersHorizontal, Lock, Sparkles, LogIn, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MootCase {
  id: string;
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
}

interface CompletedSessionInfo {
  case_id: string;
  session_id: string;
  ai_score: number | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: number;
}

interface ScoreCriterion {
  name: string;
  score: number;
  explanation: string;
}

interface Evaluation {
  criteria: ScoreCriterion[];
  total_score: number;
  overall_comment: string;
}

const diffStyles: Record<string, { gradient: string; glow: string; badge: string; label: string }> = {
  yengil: { gradient: 'from-emerald-50 via-transparent to-transparent', glow: 'shadow-[0_0_20px_-8px_rgba(16,185,129,0.25)]', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Yengil' },
  orta:   { gradient: 'from-blue-50 via-transparent to-transparent',    glow: 'shadow-[0_0_20px_-8px_rgba(59,130,246,0.25)]',  badge: 'bg-blue-100 text-blue-700 border-blue-200',     label: "O'rta" },
  qattiq: { gradient: 'from-red-50 via-transparent to-transparent',     glow: 'shadow-[0_0_20px_-8px_rgba(239,68,68,0.25)]',   badge: 'bg-red-100 text-red-700 border-red-200',         label: 'Qattiq' },
};

function getDiff(d: string) {
  return diffStyles[d] || diffStyles.orta;
}

export default function MootCourtOquvchi() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cases, setCases] = useState<MootCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCase, setActiveCase] = useState<MootCase | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectingSide, setSelectingSide] = useState(false);
  const [selectedSide, setSelectedSide] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [diffFilter, setDiffFilter] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [headerExpanded, setHeaderExpanded] = useState(false);

  // Retry tracking
  const [completedCases, setCompletedCases] = useState<CompletedSessionInfo[]>([]);

  // Guest mode
  const isGuest = !user || user.rol !== 'oquvchi';
  const [guestToken] = useState(() => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  const [guestStarted, setGuestStarted] = useState(false);
  const [guestLoginPrompt, setGuestLoginPrompt] = useState(false);

  // Filtered cases
  const filteredCases = useMemo(() => {
    let result = cases;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.sarlavha.toLowerCase().includes(q) ||
        c.tavsif.toLowerCase().includes(q)
      );
    }
    if (diffFilter.length > 0) {
      result = result.filter(c => diffFilter.includes(c.difficulty || 'orta'));
    }
    return result;
  }, [cases, searchQuery, diffFilter]);

  const visibleCases = filteredCases.slice(0, visibleCount);
  const toggleDiffFilter = (d: string) => {
    setDiffFilter(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
    setVisibleCount(10);
  };

  const loadCases = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('moot_court_cases')
      .select('id, ustoz_ismi, sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol, faol, max_exchanges, difficulty, allow_retry, is_public_demo')
      .eq('faol', true)
      .order('created_at', { ascending: false });
    // Guests only see public demo cases
    if (isGuest) {
      query.eq('is_public_demo', true);
    }
    const { data } = await query;
    setCases((data || []) as MootCase[]);
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    loadCases();
    // Load completed sessions for retry tracking (only for logged-in students)
    if (user?.rol === 'oquvchi' && user?.ism) {
      const studentName = `${user.ism} ${user.familiya || ''}`.trim();
      supabase
        .from('moot_court_sessions')
        .select('case_id, id, ai_score, status')
        .eq('oquvchi_ismi', studentName)
        .eq('status', 'yakunlangan')
        .then(({ data }) => {
          if (data) setCompletedCases(data.map(s => ({ case_id: s.case_id, session_id: s.id, ai_score: s.ai_score })));
        });
    }
  }, [loadCases, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const callMootCourtChat = async (payload: {
    caseId: string;
    sessionId?: string;
    messages: { role: string; text: string }[];
    studentSide?: string;
    isIntro?: boolean;
    guestToken?: string;
    studentName?: string;
  }): Promise<{ reply?: string; error?: string; aiRol?: string; sessionEnded?: boolean; isGuest?: boolean }> => {
    const res = await fetch(`${supabaseUrl}/functions/v1/moot-court-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { error: data?.error || 'Noma\'lum xatolik' };
    return data;
  };

  const triggerEvaluation = async (sid: string) => {
    setEvaluating(true);
    setEvalError(null);
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/moot-court-evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await res.json();
      if (data?.evaluation) {
        setEvaluation(data.evaluation);
      } else if (data?.error) {
        setEvalError(data.error);
      }
    } catch {
      setEvalError('Tarmoq xatosi: AI baholash amalga oshmadi');
    } finally {
      setEvaluating(false);
    }
  };

  const startCase = (c: MootCase) => {
    // Guest: only allow starting if not already in a guest session
    if (isGuest && guestStarted) {
      setGuestLoginPrompt(true);
      return;
    }
    setActiveCase(c);
    setMessages([]);
    setSessionId(null);
    setSelectedSide('');
    setSessionEnded(false);
    setEvaluation(null);
    setEvalError(null);
    setSelectingSide(true);
    setHeaderExpanded(false);
  };

  const createSession = async (c: MootCase, side: string): Promise<string | null> => {
    if (isGuest) {
      // Guest session: use guest_token, no real student name
      const { data, error } = await supabase
        .from('moot_court_sessions')
        .insert({
          case_id: c.id,
          oquvchi_ismi: 'Mehmon foydalanuvchi',
          oquvchi_tomon: side,
          messages: [],
          status: 'faol',
          guest_token: guestToken,
        })
        .select('id')
        .single();
      if (error) {
        toast({ title: 'Sessiya yaratilmadi', description: error.message, variant: 'destructive' });
        return null;
      }
      setSessionId(data.id);
      setGuestStarted(true);
      return data.id;
    }
    const oquvchiIsmi = `${user?.ism || ''} ${user?.familiya || ''}`.trim() || 'Talaba';
    const { data, error } = await supabase
      .from('moot_court_sessions')
      .insert({
        case_id: c.id,
        oquvchi_ismi: oquvchiIsmi,
        oquvchi_tomon: side,
        messages: [],
        status: 'faol',
      })
      .select('id')
      .single();
    if (error) {
      toast({ title: 'Sessiya yaratilmadi', description: error.message, variant: 'destructive' });
      return null;
    }
    setSessionId(data.id);
    setSessionEnded(false);
    return data.id;
  };

  const selectSide = async (side: string) => {
    setSelectedSide(side);
    setSelectingSide(false);
    if (!activeCase) return;
    setInitializing(true);
    const sid = await createSession(activeCase, side);
    if (!sid) {
      setInitializing(false);
      return;
    }
    try {
      const result = await callMootCourtChat({
        caseId: activeCase.id,
        sessionId: sid,
        messages: [],
        studentSide: side,
        isIntro: true,
        guestToken: isGuest ? guestToken : undefined,
        studentName: isGuest ? undefined : `${user?.ism || ''} ${user?.familiya || ''}`.trim(),
      });
      if (result.error) {
        toast({ title: 'AI bilan bog\'lanishda xatolik', description: result.error, variant: 'destructive' });
      } else if (result.reply) {
        const introMsg: ChatMessage = { role: 'assistant', text: result.reply, timestamp: Date.now() };
        setMessages([introMsg]);
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'AI bilan bog\'lanmadi', variant: 'destructive' });
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending || !activeCase || !sessionId || sessionEnded) return;
    const userMsg: ChatMessage = { role: 'user', text: input.trim(), timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    try {
      const result = await callMootCourtChat({
        caseId: activeCase.id,
        sessionId,
        messages: newMessages.map(m => ({ role: m.role, text: m.text })),
        studentSide: selectedSide,
        guestToken: isGuest ? guestToken : undefined,
        studentName: isGuest ? undefined : `${user?.ism || ''} ${user?.familiya || ''}`.trim(),
      });

      if (result.error) {
        if (result.error.includes('allaqachon yechgansiz')) {
          setSessionEnded(true);
          toast({ title: 'Siz bu kazusni allaqachon yechgansiz', description: 'Qayta yechish ruxsat berilmagan', variant: 'destructive' });
          return;
        }
        toast({ title: 'Xatolik', description: result.error, variant: 'destructive' });
        setMessages(messages);
        return;
      }
      if (result.reply) {
        const aiMsg: ChatMessage = { role: 'assistant', text: result.reply, timestamp: Date.now() };
        setMessages([...newMessages, aiMsg]);

        if (result.sessionEnded) {
          setSessionEnded(true);
          if (isGuest) {
            setGuestLoginPrompt(true);
          } else {
            toast({ title: 'Munozara yakunlandi', description: 'AI sizning bahoyingizni tayyorlayapti...' });
            triggerEvaluation(sessionId);
          }
        }
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'AI bilan bog\'lanmadi', variant: 'destructive' });
      setMessages(messages);
    } finally {
      setSending(false);
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    if (!confirm('Suhbatni yakunlaysizmi? AI sizning bahoyingizni tayyorlaydi.')) return;
    await supabase
      .from('moot_court_sessions')
      .update({ status: 'yakunlangan', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    setSessionEnded(true);
    if (isGuest) {
      setGuestLoginPrompt(true);
    } else {
      toast({ title: 'Sessiya yakunlandi', description: 'AI baholashni boshlayapti...' });
      triggerEvaluation(sessionId);
    }
  };

  // ─── GUEST LANDING VIEW (not logged in) ───
  if (isGuest && !activeCase && !guestStarted) {
    const demoCase = cases.find(c => c.is_public_demo) || cases[0];
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Hero */}
        <div className="text-center pt-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-100 to-blue-200 shadow-lg shadow-blue-500/10 mb-4">
            <Scale className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Moot Court</h2>
          <p className="text-sm text-gray-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Sud jarayoni simulyatsiyasi — AI bilan huquqiy bahs yuriting, dalillar keltiring va baho oling.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : demoCase ? (
          <div className="rounded-3xl bg-white shadow-xl border border-gray-100/80 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-blue-400 to-blue-600" />
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Namunaviy kazus</span>
              </div>
              <h3 className="text-base font-bold text-gray-900">{demoCase.sarlavha}</h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{demoCase.tavsif}</p>
              {demoCase.qonun_moddalar && (
                <p className="text-[11px] text-blue-600 font-medium">📋 {demoCase.qonun_moddalar}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {demoCase.tomonlar?.map(t => (
                  <Badge key={t} variant="outline" className="text-[10px] border-gray-200/80">{t}</Badge>
                ))}
                <Badge variant="outline" className="text-[10px] border-gray-200/80">
                  {demoCase.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                </Badge>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDiff(demoCase.difficulty).badge}`}>
                  {getDiff(demoCase.difficulty).label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
                <Lock className="h-3 w-3" />
                <span>Sinov rejimida atigi 2 ta almashinuv cheklovi bor</span>
              </div>
              <Button
                onClick={() => startCase(demoCase)}
                className="w-full rounded-xl shadow-lg shadow-blue-500/20"
                size="lg"
              >
                <Sparkles className="h-4 w-4 mr-2" /> Sinab ko'rish
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Scale className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Hozircha namunaviy kazuslar mavjud emas</p>
          </div>
        )}
      </div>
    );
  }

  const aiRolLabel = activeCase?.ai_rol === 'sudya' ? 'Sudya' : 'Qarshi tomon';
  const aiRolIcon = activeCase?.ai_rol === 'sudya' ? '⚖️' : '🥷';
  const aiColor = activeCase?.ai_rol === 'sudya' ? '#6366f1' : '#3b82f6';
  const maxExchanges = isGuest ? 2 : (activeCase?.max_exchanges || 5);
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const progressPct = Math.min(100, (userMessageCount / maxExchanges) * 100);

  // ─── SIDE SELECTION VIEW ───
  if (activeCase && selectingSide) {
    const diff = getDiff(activeCase.difficulty);
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <button
          onClick={() => { setActiveCase(null); setSelectingSide(false); }}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Orqaga
        </button>
        <div className={`relative overflow-hidden rounded-3xl bg-white shadow-lg ${diff.glow} border border-white/60`}>
          <div className={`absolute inset-0 bg-gradient-to-br ${diff.gradient} pointer-events-none`} />
          <div className="relative p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${diff.badge}`}>{diff.label}</span>
            </div>
            <h3 className="text-base font-bold text-gray-900">{activeCase.sarlavha}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{activeCase.tavsif}</p>
            {activeCase.qonun_moddalar && (
              <p className="text-[11px] text-blue-600 font-medium">📋 {activeCase.qonun_moddalar}</p>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <MessageSquare className="h-3 w-3" />
              <span>Sessiya {maxExchanges} ta almashinuvdan keyin avtomatik yakunlanadi</span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-700 mb-2">Tomoningizni tanlang:</p>
              <div className="space-y-2">
                {activeCase.tomonlar.map(side => (
                  <button
                    key={side}
                    onClick={() => selectSide(side)}
                    className="w-full p-3.5 rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md transition-all duration-300"
                  >
                    Men {side} tomonini himoya qilaman
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CHAT VIEW ───
  if (activeCase && !selectingSide) {
    return (
      <div className="flex flex-col h-full max-h-[calc(100dvh-120px)] max-w-3xl mx-auto">
        {/* Sticky glass header */}
        <div className="shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => { setActiveCase(null); setMessages([]); setSessionId(null); setSelectingSide(false); setEvaluation(null); }}
              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Kazuslarga qaytish
            </button>
          </div>
          <div className="rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg overflow-hidden">
            <div className="p-3">
              {/* Compact row — always visible */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 truncate">{activeCase.sarlavha}</h3>
                  {selectedSide && (
                    <Badge variant="outline" className="text-[10px] shrink-0">Siz: {selectedSide}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm">{aiRolIcon}</span>
                  <span className="text-[10px] font-bold text-gray-600 hidden sm:inline">{aiRolLabel}</span>
                  <button
                    onClick={() => setHeaderExpanded(prev => !prev)}
                    className="p-1 rounded-lg hover:bg-gray-100/80 transition-colors"
                  >
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${headerExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Progress bar — always visible */}
              <div className="mt-2 h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400 font-medium">{userMessageCount}/{maxExchanges} almashinuv</span>
                {isGuest && <span className="text-[10px] font-bold text-blue-500">Sinov rejimi</span>}
              </div>

              {/* Expandable detail section */}
              <div className={`grid transition-all duration-200 ease-out ${headerExpanded ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                  <div className="pt-2 border-t border-gray-100/60 space-y-1.5">
                    <p className="text-xs text-gray-500 leading-relaxed">{activeCase.tavsif}</p>
                    {activeCase.qonun_moddalar && (
                      <p className="text-[11px] text-blue-600 font-medium">📋 {activeCase.qonun_moddalar}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4 min-h-0 px-1">
          {messages.length === 0 && !initializing && (
            <div className="text-center py-8">
              <Gavel className="h-10 w-10 text-blue-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Sud jarayoni boshlanishini kutmoqda</p>
              <p className="text-xs text-gray-400 mt-1">AI o'zini tanishtiradi...</p>
            </div>
          )}
          {initializing && (
            <div className="flex justify-start mc-msg-in">
              <div className="bg-white shadow-md rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2 border border-gray-100/80">
                <div className="flex items-center gap-1">
                  <div className="mc-typing-dot" />
                  <div className="mc-typing-dot" />
                  <div className="mc-typing-dot" />
                </div>
                <span className="text-xs text-gray-400 ml-1">AI suhbatni boshlayapti...</span>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mc-msg-in mc-no-select`}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {msg.role === 'assistant' ? (
                <div className="max-w-[80%]">
                  {/* Role indicator line */}
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <div className="h-0.5 w-4 rounded-full" style={{ background: aiColor }} />
                    <span className="text-[10px] font-bold" style={{ color: aiColor }}>{aiRolIcon} {aiRolLabel}</span>
                  </div>
                  <div className="bg-white shadow-md text-gray-800 rounded-2xl rounded-tl-md px-4 py-3 border border-gray-100/80">
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-lg shadow-blue-500/20">
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex justify-start mc-msg-in">
              <div className="bg-white shadow-md rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1.5 border border-gray-100/80">
                <div className="mc-typing-dot" />
                <div className="mc-typing-dot" />
                <div className="mc-typing-dot" />
              </div>
            </div>
          )}

          {/* Evaluation loading */}
          {evaluating && (
            <div className="flex justify-center py-4 mc-msg-in">
              <div className="flex items-center gap-2 bg-blue-50/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-blue-100">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium text-blue-600">AI sizning bahoyingizni tayyorlayapti...</span>
              </div>
            </div>
          )}

          {/* Evaluation error with retry */}
          {evalError && !evaluating && (
            <div className="flex flex-col items-center gap-2 py-4 mc-msg-in">
              <div className="flex items-center gap-2 bg-red-50 rounded-xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-medium text-red-600">{evalError}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => sessionId && triggerEvaluation(sessionId)}
                className="text-xs"
              >
                <RotateCw className="h-3.5 w-3.5 mr-1" /> Baholashni qayta boshlash
              </Button>
            </div>
          )}

          {/* Evaluation results */}
          {evaluation && !evaluating && (
            <EvaluationCard evaluation={evaluation} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 pb-1">
          {/* Guest login prompt banner */}
          {isGuest && guestLoginPrompt && (
            <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 p-4 mb-2 text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-bold text-gray-800">Bu — sinov versiyasi edi</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                To'liq imkoniyatlar (ko'proq kazus, batafsil AI baholash, natijalar tarixi) uchun tizimga kiring
              </p>
              <Button
                onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
                className="w-full rounded-xl shadow-lg shadow-blue-500/20"
                size="sm"
              >
                <LogIn className="h-4 w-4 mr-2" /> Kirish
              </Button>
            </div>
          )}
          {sessionEnded && !evaluating && !evaluation && !evalError && !isGuest && (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-50/80 backdrop-blur-sm rounded-xl mb-2 border border-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs font-bold text-green-700">Sessiya yakunlandi</span>
            </div>
          )}
          {!sessionEnded && (
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                onPaste={e => e.preventDefault()}
                onDrop={e => e.preventDefault()}
                placeholder="Argumentingizni yozing (paste qilib bo'lmaydi)..."
                className="flex-1 min-h-[44px] max-h-32 resize-none rounded-2xl border-gray-200/80"
                rows={1}
              />
              <Button onClick={sendMessage} disabled={sending || !input.trim() || initializing} size="icon" className="h-11 w-11 shrink-0 rounded-xl shadow-lg shadow-blue-500/20">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!sessionEnded && messages.length > 0 && (
            <Button
              onClick={endSession}
              variant="outline"
              size="sm"
              className="w-full mt-2 text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300 rounded-xl"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Sessiyani yakunlash
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── CASE LIST VIEW ───
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-blue-600" />
        <h2 className="text-base font-bold text-gray-900">Moot Court</h2>
      </div>

      {/* Guest: login prompt if they already used their demo */}
      {isGuest && guestStarted && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/60 p-4 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-bold text-gray-800">Sinov versiyasi yakunlandi</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Siz bitta demo kazusni sinab ko'rdingiz. To'liq imkoniyatlar uchun tizimga kiring.
          </p>
          <Button
            onClick={() => window.dispatchEvent(new CustomEvent('open-login-modal'))}
            className="w-full rounded-xl shadow-lg shadow-blue-500/20"
            size="sm"
          >
            <LogIn className="h-4 w-4 mr-2" /> Kirish
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16">
          <Scale className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Hozircha faol kazuslar yo'q</p>
          <p className="text-xs text-gray-400 mt-1">Ustoz yangi kazus qo'shishini kutib turing</p>
        </div>
      ) : (
        <>
          {/* Search & filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setVisibleCount(10); }}
                placeholder="Kazus qidirish..."
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-gray-200/80 bg-white/80 backdrop-blur-sm text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {(['yengil', 'orta', 'qattiq'] as const).map(d => {
                const diff = getDiff(d);
                const active = diffFilter.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleDiffFilter(d)}
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all duration-200 ${
                      active ? diff.badge : 'bg-white text-gray-500 border-gray-200/80 hover:border-gray-300'
                    }`}
                  >
                    {diff.label}
                  </button>
                );
              })}
              {diffFilter.length > 0 && (
                <button
                    onClick={() => setDiffFilter([])}
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
                  const completedInfo = completedCases.find(cs => cs.case_id === c.id);
                  const isLocked = c.allow_retry === false && !!completedInfo;
                  return (
              <div
                key={c.id}
                className={`group relative overflow-hidden rounded-3xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100/80 ${diff.glow}`}
              >
                {/* Difficulty gradient accent */}
                <div className={`absolute inset-0 bg-gradient-to-br ${diff.gradient} pointer-events-none opacity-70`} />
                {/* Top accent bar */}
                <div className="relative h-1 bg-gradient-to-r from-blue-400/50 via-blue-500/30 to-transparent" />
                <div className="relative p-4">
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                      <Scale className="h-4.5 w-4.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate text-sm">{c.sarlavha}</h3>
                      <p className="text-[11px] text-gray-400">Ustoz: {c.ustoz_ismi}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${diff.badge} shrink-0`}>{diff.label}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{c.tavsif}</p>
                  {c.qonun_moddalar && (
                    <p className="text-[11px] text-blue-600 font-medium mb-2">📋 {c.qonun_moddalar}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {c.tomonlar?.map(t => (
                      <Badge key={t} variant="outline" className="text-[10px] border-gray-200/80">{t}</Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px] border-gray-200/80">
                      {c.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-gray-200/80">
                      {c.max_exchanges || 5} almashinuv
                    </Badge>
                  </div>
                  {isLocked ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gray-50 border border-gray-200/60 text-xs font-bold text-gray-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        Siz allaqachon yechgansiz
                      </div>
                      <Button size="sm" variant="outline" className="w-full rounded-xl text-xs" onClick={() => {
                        if (completedInfo?.session_id) {
                          supabase
                            .from('moot_court_sessions')
                            .select('*, moot_court_cases!case_id(*)')
                            .eq('id', completedInfo.session_id)
                            .maybeSingle()
                            .then(({ data }) => {
                              if (data) {
                                setActiveCase(data.moot_court_cases as MootCase);
                                setMessages((data.messages || []).map((m: any) => ({ role: m.role, text: m.text, timestamp: m.timestamp })));
                                setSessionId(data.id);
                                setSelectedSide(data.oquvchi_tomon || '');
                                setSessionEnded(true);
                                setSelectingSide(false);
                                setEvaluation(null);
                                if (data.ai_score) triggerEvaluation(data.id);
                              }
                            });
                        }
                      }}>
                        <Eye className="h-3 w-3 mr-1" /> Natijangizni ko'rish
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full rounded-xl shadow-md shadow-blue-500/10" onClick={() => startCase(c)}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> Boshlash
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
              {visibleCount < filteredCases.length && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(prev => prev + 10)}
                    className="rounded-xl text-xs"
                  >
                    Ko'proq ko'rsatish ({filteredCases.length - visibleCount} ta qoldi)
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Circular progress for criteria scores ─────────────────────────────────
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

function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  const total = evaluation.total_score;
  const maxTotal = 10;
  const totalPct = total / maxTotal;
  const totalColor = totalPct >= 0.8 ? '#10b981' : totalPct >= 0.5 ? '#f59e0b' : '#ef4444';
  const totalCircumference = 2 * Math.PI * 32;
  const totalOffset = totalCircumference * (1 - totalPct);

  return (
    <div className="mt-4 mc-msg-in">
      <div className="rounded-3xl overflow-hidden bg-white shadow-xl border border-gray-100/80">
        {/* Score header with circular ring */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 px-5 py-4 flex items-center gap-4">
          <svg width="76" height="76" className="shrink-0">
            <circle cx="38" cy="38" r="32" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
            <circle
              cx="38" cy="38" r="32" fill="none" stroke={totalColor} strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={totalCircumference}
              style={{ '--mc-circumference': `${totalCircumference}px`, '--mc-offset': `${totalOffset}px` } as React.CSSProperties}
              className="mc-ring-circle"
              transform="rotate(-90 38 38)"
            />
            <text x="38" y="40" textAnchor="middle" fontSize="18" fontWeight="700" fill="white">{total}</text>
            <text x="38" y="52" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.7)">/ {maxTotal}</text>
          </svg>
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-white/90" />
              <span className="text-sm font-bold text-white">AI Bahosi</span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              {totalPct >= 0.8 ? 'Ajoyib natija!' : totalPct >= 0.5 ? "Yaxshi, lekin yaxshilanishi mumkin" : 'Ko\'proq mashq kerak'}
            </p>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {evaluation.overall_comment && (
            <div className="bg-gradient-to-br from-blue-50/80 to-white rounded-2xl p-3 border border-blue-100/60">
              <p className="text-[10px] font-bold text-blue-600 mb-1">Umumiy izoh</p>
              <p className="text-xs text-gray-700 leading-relaxed">{evaluation.overall_comment}</p>
            </div>
          )}
          {evaluation.criteria.map((c, i) => (
            <div key={i} className="flex items-start gap-3 bg-gray-50/80 rounded-2xl p-3 border border-gray-100/60">
              <CircularProgress score={c.score} max={2} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 mb-0.5">{c.name}</p>
                <p className="text-[11px] text-gray-600 leading-relaxed">{c.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
