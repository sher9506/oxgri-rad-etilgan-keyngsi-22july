import { useState, useEffect, useCallback } from 'react';
import { Scale, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Loader2, MessageSquare, Star, Eye, ChevronLeft, Award } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
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
  created_at: string;
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

  // Form state
  const [sarlavha, setSarlavha] = useState('');
  const [tavsif, setTavsif] = useState('');
  const [qonunModdalar, setQonunModdalar] = useState('');
  const [tomonlar, setTomonlar] = useState<string[]>(['da\'vogar', 'javobgar']);
  const [tomonInput, setTomonInput] = useState('');
  const [aiRol, setAiRol] = useState<'qarshi_tomon' | 'sudya'>('qarshi_tomon');
  const [maxExchanges, setMaxExchanges] = useState(5);
  const [saving, setSaving] = useState(false);

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
    setEditingCase(null);
  };

  const handleSave = async () => {
    if (!user?.ustoz_id) return;
    if (!sarlavha.trim() || !tavsif.trim()) {
      toast({ title: 'Sarlavha va tavsif majburiy', variant: 'destructive' });
      return;
    }
    const clamped = Math.max(3, Math.min(10, maxExchanges));
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
    };

    if (editingCase) {
      const { error } = await supabase
        .from('moot_court_cases')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingCase.id);
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Kazus yangilandi' });
        setShowForm(false);
        resetForm();
        loadCases();
      }
    } else {
      const { error } = await supabase
        .from('moot_court_cases')
        .insert(payload);
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Yangi kazus yaratildi' });
        setShowForm(false);
        resetForm();
        loadCases();
      }
    }
    setSaving(false);
  };

  const handleEdit = (c: MootCase) => {
    setEditingCase(c);
    setSarlavha(c.sarlavha);
    setTavsif(c.tavsif);
    setQonunModdalar(c.qonun_moddalar);
    setTomonlar(c.tomonlar || []);
    setAiRol(c.ai_rol as 'qarshi_tomon' | 'sudya');
    setMaxExchanges(c.max_exchanges || 5);
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
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <button
          onClick={() => setViewingSession(null)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Natijalarga qaytish
        </button>

        <Card className="rounded-2xl shadow-sm border border-gray-100">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{viewingSession.moot_court_cases?.sarlavha || 'Kazus'}</CardTitle>
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
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto p-1">
              {(viewingSession.messages || []).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  }`}>
                    {msg.role !== 'user' && (
                      <div className="text-[10px] font-bold text-blue-600 mb-1">
                        {viewingSession.moot_court_cases?.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              {(!viewingSession.messages || viewingSession.messages.length === 0) && (
                <p className="text-center text-xs text-gray-400 py-8">Suhbat bo'sh</p>
              )}
            </div>

            <AiEvaluationView session={viewingSession} onSaveTeacherScore={saveTeacherScore} />
          </CardContent>
        </Card>
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

        <Card className="rounded-2xl shadow-sm border border-gray-100">
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label className="text-xs font-bold">Sarlavha *</Label>
              <Input
                value={sarlavha}
                onChange={e => setSarlavha(e.target.value)}
                placeholder="Masalan: Fuqarolik shartnomasi bo'yicha nizo"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Vaziyat tavsifi *</Label>
              <Textarea
                value={tavsif}
                onChange={e => setTavsif(e.target.value)}
                placeholder="Sud jarayoni vaziyatini batafsil yozing..."
                className="mt-1.5 min-h-[120px]"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Tegishli qonun/moddalar</Label>
              <Input
                value={qonunModdalar}
                onChange={e => setQonunModdalar(e.target.value)}
                placeholder="Masalan: Fuqarolik kodeksi 123-modda, 124-modda"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Tomonlar (talaba tanlashi mumkin)</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={tomonInput}
                  onChange={e => setTomonInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTomon(); } }}
                  placeholder="Masalan: da'vogar, javobgar..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTomon}>
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
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    aiRol === 'qarshi_tomon'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  🥷 Qarama-qarshi tomon
                </button>
                <button
                  onClick={() => setAiRol('sudya')}
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    aiRol === 'sudya'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  ⚖️ Sudya
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Nechta almashinuvdan keyin yakunlansin</Label>
              <div className="flex items-center gap-3 mt-1.5">
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={maxExchanges}
                  onChange={e => setMaxExchanges(parseInt(e.target.value) || 5)}
                  className="w-24"
                />
                <span className="text-xs text-gray-500">Talaba shuncha argument yuborgach, AI yakuniy nutq so'zlaydi va sessiya avtomatik yakunlanadi (3-10)</span>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingCase ? 'Saqlash' : 'Kazus yaratish'}
            </Button>
          </CardContent>
        </Card>
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
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Yangi kazus
          </Button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button
          onClick={() => setTab('kazuslar')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
            tab === 'kazuslar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Kazuslar ({cases.length})
        </button>
        <button
          onClick={() => setTab('natijalar')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
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
          <div className="space-y-3">
            {cases.map(c => (
              <Card key={c.id} className="rounded-2xl shadow-sm border border-gray-100">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-bold text-gray-900 truncate">{c.sarlavha}</h3>
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
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                        <Badge variant="outline" className="text-[10px]">
                          {c.ai_rol === 'sudya' ? '⚖️ Sudya' : '🥷 Qarshi tomon'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {c.max_exchanges || 5} almashinuv
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-50">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(c)} className="text-xs h-7">
                      <Edit className="h-3 w-3 mr-1" /> Tahrirlash
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleFaol(c)} className="text-xs h-7">
                      {c.faol ? (
                        <><ToggleRight className="h-3.5 w-3.5 mr-1 text-green-600" /> Faol</>
                      ) : (
                        <><ToggleLeft className="h-3.5 w-3.5 mr-1 text-gray-400" /> Nofaol</>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="text-xs h-7 text-red-500 hover:text-red-600">
                      <Trash2 className="h-3 w-3 mr-1" /> O'chirish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        sessions.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Hozircha sessiyalar yo'q</p>
            <p className="text-xs text-gray-400 mt-1">Talabalar yakunlagan sessiyalar shu yerda ko'rinadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => (
              <Card key={s.id} className="rounded-2xl shadow-sm border border-gray-100">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {s.moot_court_cases?.sarlavha || 'Kazus'}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Talaba: <span className="font-bold text-gray-700">{s.oquvchi_ismi}</span>
                        {s.oquvchi_tomon && <span className="ml-1.5 text-blue-600">• {s.oquvchi_tomon}</span>}
                      </p>
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
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-50">
                    <Button size="sm" variant="ghost" onClick={() => setViewingSession(s)} className="text-xs h-7">
                      <Eye className="h-3 w-3 mr-1" /> Suhbatni ko'rish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AiEvaluationView({ session, onSaveTeacherScore }: {
  session: MootSession;
  onSaveTeacherScore: (id: string, score: number) => void;
}) {
  const [teacherScore, setTeacherScore] = useState(session.teacher_score?.toString() || session.ai_score?.toString() || '');

  const breakdown = session.ai_score_breakdown || [];
  const hasEvaluation = session.ai_score !== null;

  if (!hasEvaluation) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-gray-400">
          <Award className="h-4 w-4" />
          <span className="text-xs font-medium">AI bahosi hali mavjud emas</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
      {/* AI Score Header */}
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-blue-500" />
        <span className="text-sm font-bold text-gray-900">AI bahosi: {session.ai_score}/10</span>
      </div>

      {/* Overall comment */}
      {session.ai_comment && (
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-[10px] font-bold text-blue-600 mb-1">Umumiy izoh</p>
          <p className="text-xs text-gray-700 leading-relaxed">{session.ai_comment}</p>
        </div>
      )}

      {/* Criteria breakdown */}
      {breakdown.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-700">Mezonlar bo'yicha batafsil:</p>
          {breakdown.map((c, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-800">{c.name}</span>
                <span className="text-xs font-bold text-blue-600">{c.score}/2</span>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">{c.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Teacher score override */}
      <div className="pt-3 border-t border-gray-100">
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
            className="w-24"
          />
          <Button
            size="sm"
            onClick={() => {
              const s = parseInt(teacherScore);
              if (s >= 0 && s <= 10) onSaveTeacherScore(session.id, s);
              else alert('Baho 0-10 orasida bo\'lishi kerak');
            }}
          >
            Saqlash
          </Button>
          {session.teacher_score !== null && session.teacher_score !== session.ai_score && (
            <span className="text-xs text-gray-500 ml-1">
              Ustoz bahosi: <span className="font-bold text-amber-600">{session.teacher_score}/10</span>
              <span className="text-gray-400 ml-1">(AI: {session.ai_score}/10)</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
