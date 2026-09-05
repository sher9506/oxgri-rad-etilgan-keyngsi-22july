import { useState, useEffect, useCallback, useRef } from 'react';
import { Scale, Loader2, Send, ChevronLeft, CheckCircle2, Gavel, MessageSquare, Award } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('moot_court_cases')
      .select('id, ustoz_ismi, sarlavha, tavsif, qonun_moddalar, tomonlar, ai_rol, faol, max_exchanges')
      .eq('faol', true)
      .order('created_at', { ascending: false });
    setCases((data || []) as MootCase[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const callMootCourtChat = async (payload: {
    caseId: string;
    sessionId?: string;
    messages: { role: string; text: string }[];
    studentSide?: string;
    isIntro?: boolean;
  }): Promise<{ reply?: string; error?: string; aiRol?: string; sessionEnded?: boolean }> => {
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
        toast({ title: 'Baholash xatosi', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Tarmoq xatosi', description: 'AI baholash amalga oshmadi', variant: 'destructive' });
    } finally {
      setEvaluating(false);
    }
  };

  const startCase = (c: MootCase) => {
    setActiveCase(c);
    setMessages([]);
    setSessionId(null);
    setSelectedSide('');
    setSessionEnded(false);
    setEvaluation(null);
    setSelectingSide(true);
  };

  const createSession = async (c: MootCase, side: string): Promise<string | null> => {
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
      });

      if (result.error) {
        toast({ title: 'Xatolik', description: result.error, variant: 'destructive' });
        setMessages(messages);
        return;
      }
      if (result.reply) {
        const aiMsg: ChatMessage = { role: 'assistant', text: result.reply, timestamp: Date.now() };
        setMessages([...newMessages, aiMsg]);

        // If session auto-ended, trigger evaluation
        if (result.sessionEnded) {
          setSessionEnded(true);
          toast({ title: 'Munozara yakunlandi', description: 'AI sizning bahoyingizni tayyorlayapti...' });
          triggerEvaluation(sessionId);
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
    toast({ title: 'Sessiya yakunlandi', description: 'AI baholashni boshlayapti...' });
    triggerEvaluation(sessionId);
  };

  if (!user || user.rol !== 'oquvchi') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Scale className="h-12 w-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 font-medium">Bu bo'lim faqat o'quvchilar uchun</p>
      </div>
    );
  }

  const aiRolLabel = activeCase?.ai_rol === 'sudya' ? 'Sudya' : 'Qarshi tomon';
  const aiRolIcon = activeCase?.ai_rol === 'sudya' ? '⚖️' : '🥷';
  const maxExchanges = activeCase?.max_exchanges || 5;
  const userMessageCount = messages.filter(m => m.role === 'user').length;

  // ─── SIDE SELECTION VIEW ───
  if (activeCase && selectingSide) {
    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <button
          onClick={() => { setActiveCase(null); setSelectingSide(false); }}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Orqaga
        </button>
        <Card className="rounded-2xl shadow-sm border border-gray-100">
          <CardContent className="pt-5 space-y-4">
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
                    className="w-full p-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 transition-all"
                  >
                    Men {side} tomonini himoya qilaman
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── CHAT VIEW ───
  if (activeCase && !selectingSide) {
    return (
      <div className="flex flex-col h-full max-h-[calc(100dvh-120px)] max-w-3xl mx-auto">
        {/* Sticky header */}
        <div className="shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => { setActiveCase(null); setMessages([]); setSessionId(null); setSelectingSide(false); setEvaluation(null); }}
              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Kazuslarga qaytish
            </button>
          </div>
          <Card className="rounded-2xl shadow-sm border border-gray-100 bg-white">
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">{activeCase.sarlavha}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{activeCase.tavsif}</p>
                  {activeCase.qonun_moddalar && (
                    <p className="text-[11px] text-blue-600 font-medium mt-1">📋 {activeCase.qonun_moddalar}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {selectedSide && (
                      <Badge variant="outline" className="text-[10px]">Siz: {selectedSide}</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{userMessageCount}/{maxExchanges} almashinuv</Badge>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{aiRolIcon} {aiRolLabel}</Badge>
              </div>
            </CardContent>
          </Card>
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
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-xs text-gray-400">AI suhbatni boshlayapti...</span>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-md'
                  : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-tl-md'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-gray-100">
                    <span className="text-sm">{aiRolIcon}</span>
                    <span className="text-[10px] font-bold text-blue-600">{aiRolLabel}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-xs text-gray-400">AI javob yozmoqda...</span>
              </div>
            </div>
          )}

          {/* Evaluation loading */}
          {evaluating && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium text-blue-600">AI sizning bahoyingizni tayyorlayapti...</span>
              </div>
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
          {sessionEnded && !evaluating && !evaluation && (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-xl mb-2">
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
                placeholder="Argumentingizni yozing..."
                className="flex-1 min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              <Button onClick={sendMessage} disabled={sending || !input.trim() || initializing} size="icon" className="h-11 w-11 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!sessionEnded && messages.length > 0 && (
            <Button
              onClick={endSession}
              variant="outline"
              size="sm"
              className="w-full mt-2 text-xs text-red-500 hover:text-red-600 border-red-200 hover:border-red-300"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cases.map(c => (
            <Card key={c.id} className="rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Scale className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{c.sarlavha}</h3>
                    <p className="text-[11px] text-gray-400">Ustoz: {c.ustoz_ismi}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-3 mb-2">{c.tavsif}</p>
                {c.qonun_moddalar && (
                  <p className="text-[11px] text-blue-600 font-medium mb-2">📋 {c.qonun_moddalar}</p>
                )}
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.tomonlar?.map(t => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                  ))}
                  <Badge variant="outline" className="text-[10px]">
                    {c.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {c.max_exchanges || 5} almashinuv
                  </Badge>
                </div>
                <Button size="sm" className="w-full" onClick={() => startCase(c)}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Boshlash
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="mt-4 rounded-2xl border-2 border-blue-100 bg-blue-50/50 overflow-hidden">
      <div className="bg-blue-500 text-white px-4 py-3 flex items-center gap-2">
        <Award className="h-5 w-5" />
        <span className="text-sm font-bold">AI Bahosi: {evaluation.total_score}/10</span>
      </div>
      <div className="p-4 space-y-3">
        {evaluation.overall_comment && (
          <div className="bg-white rounded-xl p-3 border border-blue-100">
            <p className="text-[10px] font-bold text-blue-600 mb-1">Umumiy izoh</p>
            <p className="text-xs text-gray-700 leading-relaxed">{evaluation.overall_comment}</p>
          </div>
        )}
        {evaluation.criteria.map((c, i) => (
          <div key={i} className="bg-white rounded-xl p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-800">{c.name}</span>
              <span className="text-xs font-bold text-blue-600">{c.score}/2</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">{c.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
