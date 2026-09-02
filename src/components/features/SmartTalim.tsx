import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, BookOpen, CreditCard, X, Send, Loader2,
  Library, Lock, BookMarked, Zap,
  ArrowLeft, Check, CheckCircle2, RotateCcw,
  ExternalLink, MessageSquare, AlertCircle, Filter,
  ChevronDown, ChevronUp, Plus, Minus,
  Sparkles, Copy, Download, RefreshCw,
  CheckCheck, Search, Globe, FileText, Info,
  PanelLeftOpen, Clock, Trash2, ChevronRight,
  AlertTriangle, History
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Bolim { id: string; nomi: string; _chunk_soni?: number; }

interface CitationDoc {
  ref: number; material_id: string; bolim_id: string; bob_id: string;
  bolim_nomi: string; bob_nomi: string; material_nomi: string; matn: string; score?: number;
}

interface ChatMessage {
  rol: 'user' | 'ai';
  matn: string;
  citations?: CitationDoc[];
  cached?: boolean;
  tashqi?: boolean;
  loading?: boolean;
  stats?: RagStats;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number; // timestamp
  updatedAt: number;
}

interface FleshKarta {
  savol: string; javob: string;
  holat: 'noma_lum' | 'bilaman' | 'bilmayman';
}

type View = 'chat' | 'flesh' | 'konspekt';
const DEMO_KEY = 'smart_talim_demo_v3';
const CHAT_HISTORY_KEY = 'smart_talim_chat_history_v1';
const HISTORY_WARN_KEY = 'smart_talim_history_warned';
const HISTORY_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 kun

// ── API helpers ───────────────────────────────────────────────────────────────
interface RagStats { ilike_hits: number; fts_hits: number; keyword_hits: number; phrase_hits: number; final_docs: number; strategy: string; expanded_terms: string[]; }

async function ragQuery(params: {
  query: string; bolim_id?: string; top_k?: number;
  messages?: { role: string; content: string }[];
}): Promise<{ answer: string; citations: CitationDoc[]; cached: boolean; stats?: RagStats; hasContext: boolean }> {
  const { data, error } = await supabase.functions.invoke('rag-pipeline', {
    body: {
      query: params.query, bolim_id: params.bolim_id,
      top_k: params.top_k ?? 10, messages: params.messages ?? [], use_cache: true,
    },
  });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) { try { const t = await error.context?.text(); msg = t || msg; } catch {} }
    throw new Error(msg);
  }
  const docs: CitationDoc[] = (data?.documents || []).map((d: any, i: number) => ({
    ref: i + 1, material_id: d.material_id, bolim_id: d.bolim_id, bob_id: d.bob_id,
    bolim_nomi: d.bolim_nomi, bob_nomi: d.bob_nomi, material_nomi: d.material_nomi,
    matn: d.matn, score: d.score,
  }));
  return {
    answer: data?.answer || '',
    citations: docs,
    cached: data?.cached ?? false,
    stats: data?.retrieval_stats,
    hasContext: docs.length > 0,
  };
}

async function callAI(messages: { role: string; content: string }[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke('onspace-ai-text', { body: { messages } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try { const t = await error.context?.text(); if (t?.includes('402')) return '⚠️ AI vaqtincha ishlamayapti.'; } catch {}
    }
    throw new Error(error.message);
  }
  return data?.choices?.[0]?.message?.content || data?.reply || '';
}

// ── Chat tarixi storage ───────────────────────────────────────────────────────
function loadChatHistory(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) return [];
    const sessions: ChatSession[] = JSON.parse(raw);
    const now = Date.now();
    return sessions.filter(s => now - s.updatedAt < HISTORY_TTL_MS);
  } catch { return []; }
}

function saveChatHistory(sessions: ChatSession[]) {
  try {
    const now = Date.now();
    const active = sessions.filter(s => now - s.updatedAt < HISTORY_TTL_MS);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(active));
  } catch {}
}

function getSessionsExpiringSoon(sessions: ChatSession[]): number {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return sessions.filter(s => (HISTORY_TTL_MS - (now - s.updatedAt)) < oneDayMs).length;
}

// ── Markdown formatter ────────────────────────────────────────────────────────
function formatMd(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono text-violet-700">$1</code>')
    .replace(/^#{3}\s(.+)$/gm, '<h3 class="font-bold text-sm text-slate-800 mt-3 mb-1">$1</h3>')
    .replace(/^#{2}\s(.+)$/gm, '<h2 class="font-bold text-sm text-violet-700 mt-3 mb-1.5 border-b border-violet-100 pb-0.5">$1</h2>')
    .replace(/^#{1}\s(.+)$/gm, '<h2 class="font-bold text-base text-slate-900 mt-4 mb-2">$1</h2>')
    .replace(/^[-•]\s(.+)$/gm, '<li class="ml-4 list-disc text-slate-700 my-0.5">$1</li>')
    .replace(/^(\d+)\.\s(.+)$/gm, '<li class="ml-4 list-decimal text-slate-700 my-0.5">$2</li>')
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/gs, m => `<ul class="my-1.5 space-y-0.5">${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(?<!>)\n(?!<)/g, '<br/>');
}

// ── Citation renderer ─────────────────────────────────────────────────────────
function renderWithCitations(
  text: string, citations: CitationDoc[],
  onCite: (c: CitationDoc) => void
) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    if (m) {
      const ref = parseInt(m[1]);
      const c = citations.find(x => x.ref === ref);
      if (c) return (
        <button key={i} onClick={() => onCite(c)}
          className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-all hover:scale-105 cursor-pointer"
          title={`${c.bolim_nomi} › ${c.material_nomi}`}>
          {ref}<ExternalLink className="h-2.5 w-2.5" />
        </button>
      );
    }
    return (
      <span key={i} className="prose-sm"
        dangerouslySetInnerHTML={{ __html: formatMd(part) }} />
    );
  });
}

// ── Dinamik shablon savollar (o'quv materialdan olinadi) ─────────────────────
const DEFAULT_SUGGESTED = [
  { icon: '⚖️', text: 'Jinoyat uchun javobgarlik nima?' },
  { icon: '📜', text: 'Shartnoma tuzish qoidalari' },
  { icon: '🏛️', text: 'Prokuratura vakolatlari' },
  { icon: '⚔️', text: 'Sud jarayoni bosqichlari' },
  { icon: '👮', text: 'Fuqarolarning asosiy huquqlari' },
  { icon: '💼', text: 'Mehnat shartnomasi shartlari' },
];

const ICONS = ['⚖️', '📜', '🏛️', '⚔️', '👮', '💼', '📋', '🔍', '📚', '🗂️', '⚡', '🎯'];

async function fetchDynamicSuggestions(bolimlarIds: string[]): Promise<{ icon: string; text: string }[]> {
  try {
    let q = supabase.from('sj_savollar').select('savol').limit(30);
    if (bolimlarIds.length === 0) {
      // Barcha savollardan oladi
    }
    const { data } = await q;
    if (!data || data.length === 0) return DEFAULT_SUGGESTED;
    const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 6);
    return shuffled.map((d, i) => ({
      icon: ICONS[i % ICONS.length],
      text: d.savol.slice(0, 60),
    }));
  } catch {
    return DEFAULT_SUGGESTED;
  }
}

// ── Word export (docx) ────────────────────────────────────────────────────────
function downloadAsWord(title: string, content: string) {
  // HTML-based RTF/DOC export
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 2cm; line-height: 1.6; }
  h1 { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 20px; }
  h2 { font-size: 13pt; font-weight: bold; color: #4f46e5; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
  h3 { font-size: 12pt; font-weight: bold; margin-top: 15px; }
  p, li { margin: 4px 0; }
  ul, ol { padding-left: 20px; }
  strong { font-weight: bold; }
</style>
</head>
<body>
<h1>${title}</h1>
${content
  .split('\n')
  .map(line => {
    if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
    if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
    if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
    if (line.startsWith('- ') || line.startsWith('• ')) return `<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
    if (line.match(/^\d+\.\s/)) return `<li>${line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`;
    if (line.trim() === '') return '<br/>';
    return `<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
  })
  .join('\n')}
</body>
</html>`;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\w\s]/g, '').slice(0, 40) || 'konspekt'}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
interface SmartTalimProps {
  onNavigateToMaterial?: (bolimId: string, bobId: string, materialId: string) => void;
}

export default function SmartTalim({ onNavigateToMaterial }: SmartTalimProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<View>('chat');
  const [bolimlar, setBolimlar] = useState<Bolim[]>([]);
  const [tanlananBolimlar, setTanlananBolimlar] = useState<string[]>([]);
  const [bolimlarYuklanyapti, setBolimlarYuklanyapti] = useState(false);

  // Manba paneli (chap tomondan)
  const [manbaPanel, setManbaPanel] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationDoc | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat tarixi
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [tarixPanel, setTarixPanel] = useState(false);
  const [historyWarned, setHistoryWarned] = useState(false);

  // Dinamik suggested questions
  const [suggestedQ, setSuggestedQ] = useState(DEFAULT_SUGGESTED);

  // Flash
  const [fleshKartalar, setFleshKartalar] = useState<FleshKarta[]>([]);
  const [kartaIdx, setKartaIdx] = useState(0);
  const [kartaOchiq, setKartaOchiq] = useState(false);
  const [fleshMavzu, setFleshMavzu] = useState('');
  const [fleshSon, setFleshSon] = useState(10);
  const [fleshLoading, setFleshLoading] = useState(false);
  // Flash: 1-qadam manba, 2-qadam mavzu
  const [fleshStep, setFleshStep] = useState<'manba' | 'mavzu'>('manba');
  const [fleshTanlananBolim, setFleshTanlananBolim] = useState<string>('');
  const [fleshTanlananBolimNomi, setFleshTanlananBolimNomi] = useState<string>('');

  // Konspekt
  const [konspektMavzu, setKonspektMavzu] = useState('');
  const [konspektMatn, setKonspektMatn] = useState('');
  const [konspektLoading, setKonspektLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const demoUsed = !isAuthenticated && localStorage.getItem(DEMO_KEY) === '1';

  useEffect(() => { loadBolimlar(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, chatLoading]);

  // Chat tarixi yuklash
  useEffect(() => {
    const sessions = loadChatHistory();
    setChatSessions(sessions);
    // 3 kun ogohlantirish
    const warned = localStorage.getItem(HISTORY_WARN_KEY);
    const expiringSoon = getSessionsExpiringSoon(sessions);
    if (sessions.length > 0 && !warned && expiringSoon > 0) {
      setHistoryWarned(true);
    }
  }, []);

  // Dinamik savollar yuklash
  useEffect(() => {
    fetchDynamicSuggestions(tanlananBolimlar).then(setSuggestedQ);
  }, [tanlananBolimlar]);

  const loadBolimlar = async () => {
    setBolimlarYuklanyapti(true);
    try {
      const { data } = await supabase.from('om_bolimlar').select('id,nomi')
        .eq('faol', true).eq('admin_bloklangan', false).order('tartib', { ascending: true });
      const { data: chunks } = await supabase.from('om_chunks').select('bolim_id');
      const cm: Record<string, number> = {};
      (chunks || []).forEach((c: any) => { cm[c.bolim_id] = (cm[c.bolim_id] || 0) + 1; });
      setBolimlar((data || []).map((b: any) => ({ ...b, _chunk_soni: cm[b.id] || 0 })));
    } finally { setBolimlarYuklanyapti(false); }
  };

  const requireLogin = () => window.dispatchEvent(new CustomEvent('open-login-modal'));
  const markDemo = () => { if (!isAuthenticated) localStorage.setItem(DEMO_KEY, '1'); };

  const openMaterial = useCallback((c: CitationDoc) => {
    setSelectedCitation(null);
    if (onNavigateToMaterial) {
      onNavigateToMaterial(c.bolim_id, c.bob_id, c.material_id);
    } else {
      window.dispatchEvent(new CustomEvent('deeplink-oqmat', {
        detail: { subPath: `${c.bolim_id}/${c.bob_id}/${c.material_id}` }
      }));
    }
  }, [onNavigateToMaterial]);

  const toggleBolim = (id: string) => setTanlananBolimlar(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  // Chat sessiyasini saqlash
  const saveSession = (sessionId: string, msgs: ChatMessage[], title?: string) => {
    setChatSessions(prev => {
      const existing = prev.find(s => s.id === sessionId);
      let updated: ChatSession[];
      if (existing) {
        updated = prev.map(s => s.id === sessionId
          ? { ...s, messages: msgs, updatedAt: Date.now() }
          : s
        );
      } else {
        const firstUserMsg = msgs.find(m => m.rol === 'user');
        const sessionTitle = title || firstUserMsg?.matn.slice(0, 50) || 'Yangi suhbat';
        const newSession: ChatSession = {
          id: sessionId,
          title: sessionTitle,
          messages: msgs,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        updated = [newSession, ...prev].slice(0, 20); // max 20 sessiya
      }
      saveChatHistory(updated);
      return updated;
    });
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setTarixPanel(false);
  };

  const deleteSession = (sessionId: string) => {
    setChatSessions(prev => {
      const updated = prev.filter(s => s.id !== sessionId);
      saveChatHistory(updated);
      return updated;
    });
    if (currentSessionId === sessionId) {
      setMessages([]);
      setCurrentSessionId(null);
    }
  };

  const newChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSelectedCitation(null);
    setTarixPanel(false);
  };

  // ── CHAT ──────────────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const userText = (text || input).trim();
    if (!userText || chatLoading) return;
    if (!isAuthenticated && demoUsed) { requireLogin(); return; }
    if (!isAuthenticated) markDemo();

    setInput('');
    if (inputRef.current) { inputRef.current.style.height = '44px'; }
    const newMessages = [...messages, { rol: 'user' as const, matn: userText }];
    setMessages(newMessages);
    setChatLoading(true);

    // Sessiya ID yaratish
    const sessionId = currentSessionId || `session_${Date.now()}`;
    if (!currentSessionId) setCurrentSessionId(sessionId);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.rol === 'user' ? 'user' : 'assistant',
        content: m.matn,
      }));
      const bolimId = tanlananBolimlar.length === 1 ? tanlananBolimlar[0] : undefined;
      const result = await ragQuery({ query: userText, bolim_id: bolimId, top_k: 10, messages: history });

      const aiMsg: ChatMessage = {
        rol: 'ai', matn: result.answer,
        citations: result.citations, cached: result.cached,
        tashqi: !result.hasContext,
        stats: result.stats,
      };
      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);
      saveSession(sessionId, finalMessages);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        rol: 'ai',
        matn: e.message?.includes('402')
          ? '⚠️ AI vaqtincha ishlamayapti. Iltimos, keyinroq urinib ko\'ring.'
          : `⚠️ ${e.message?.slice(0, 200) || 'Xatolik yuz berdi'}`,
        citations: [],
      };
      const finalMessages = [...newMessages, errMsg];
      setMessages(finalMessages);
      saveSession(sessionId, finalMessages);
    } finally { setChatLoading(false); }
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setSelectedCitation(null);
  };

  // ── FLASH CARDS ───────────────────────────────────────────────────────────
  const createFlesh = async () => {
    if (!fleshMavzu.trim()) { toast({ title: 'Mavzu kiriting', variant: 'destructive' }); return; }
    if (!isAuthenticated && demoUsed) { requireLogin(); return; }
    if (!isAuthenticated) markDemo();
    setFleshLoading(true);
    try {
      const bolimId = fleshTanlananBolim || (tanlananBolimlar.length === 1 ? tanlananBolimlar[0] : undefined);
      const result = await ragQuery({ query: fleshMavzu, bolim_id: bolimId || undefined, top_k: 10 });
      const kontekst = result.citations.length > 0
        ? 'Materiallar asosida yarat:\n' + result.citations.map(c => c.matn.slice(0, 600)).join('\n\n')
        : '';
      const systemMsg = kontekst
        ? `Faqat quyidagi materiallar asosida flesh kartalar yarat. O'zingizdan to'qima.\n${kontekst}`
        : 'Umumiy bilimdan flesh kartalar yarat.';
      const actualSon = Math.min(fleshSon, 15);
      const reply = await callAI([
        { role: 'system', content: systemMsg },
        { role: 'user', content: `"${fleshMavzu}" mavzusida ${actualSon} ta flesh karta (maksimal ${actualSon} ta). JSON formatda qaytargil: [{"savol":"...","javob":"..."},...]` },
      ]);
      const clean = reply.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(clean);
      const limited = parsed.slice(0, 15);
      setFleshKartalar(limited.map((k: any) => ({ savol: k.savol, javob: k.javob, holat: 'noma_lum' as const })));
      setKartaIdx(0); setKartaOchiq(false);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message?.slice(0, 100) || 'Xatolik', variant: 'destructive' });
    } finally { setFleshLoading(false); }
  };

  // ── KONSPEKT ──────────────────────────────────────────────────────────────
  const createKonspekt = async () => {
    if (!konspektMavzu.trim()) { toast({ title: 'Mavzu kiriting', variant: 'destructive' }); return; }
    if (!isAuthenticated && demoUsed) { requireLogin(); return; }
    if (!isAuthenticated) markDemo();
    setKonspektLoading(true); setKonspektMatn('');
    try {
      const bolimId = tanlananBolimlar.length === 1 ? tanlananBolimlar[0] : undefined;
      const result = await ragQuery({ query: konspektMavzu, bolim_id: bolimId, top_k: 10 });
      const kontekst = result.citations.length > 0
        ? result.citations.map(c => `${c.bolim_nomi} › ${c.material_nomi}:\n${c.matn.slice(0, 700)}`).join('\n\n')
        : '';
      const systemMsg = kontekst
        ? `Faqat quyidagi materiallar asosida konspekt yoz:\n${kontekst}`
        : 'Umumiy bilimdan konspekt yoz.';
      const reply = await callAI([
        { role: 'system', content: systemMsg },
        { role: 'user', content: `"${konspektMavzu}" mavzusida batafsil konspekt:\n## 1. Asosiy tushunchalar\n## 2. Ta'riflar\n## 3. Qonuniy asoslar\n## 4. Amaliy misollar\n## 5. Muhim xulosalar\nMarkdown, O'zbek tili.` },
      ]);
      setKonspektMatn(reply);
    } catch (e: any) {
      toast({ title: 'Xato', description: e.message?.slice(0, 100) || 'Xatolik', variant: 'destructive' });
    } finally { setKonspektLoading(false); }
  };

  const copyKonspekt = () => {
    navigator.clipboard?.writeText(konspektMatn).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadKonspekt = () => {
    downloadAsWord(konspektMavzu, konspektMatn);
    toast({ title: '📥 Word fayl yuklanmoqda...' });
  };

  const hasFilter = tanlananBolimlar.length > 0;
  const indexedBolimlar = bolimlar.filter(b => (b._chunk_soni || 0) > 0);

  // ── FLASH KARTA VIEW ──────────────────────────────────────────────────────
  if (view === 'flesh' && fleshKartalar.length > 0) {
    const karta = fleshKartalar[kartaIdx];
    const bilaman = fleshKartalar.filter(k => k.holat === 'bilaman').length;
    const bilmayman = fleshKartalar.filter(k => k.holat === 'bilmayman').length;
    const qoldi = fleshKartalar.filter(k => k.holat === 'noma_lum').length;
    const progress = ((kartaIdx + 1) / fleshKartalar.length) * 100;

    return (
      <div className="max-w-lg mx-auto h-full flex flex-col gap-4 p-4 pb-6">
        <div className="flex items-center justify-between">
          <button onClick={() => { setFleshKartalar([]); setFleshMavzu(''); setFleshStep('manba'); }}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-violet-600 px-3 py-1.5 rounded-xl hover:bg-violet-50 transition-all">
            <ArrowLeft className="h-4 w-4" /> Orqaga
          </button>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <Check className="h-3 w-3" />{bilaman}
            </span>
            <span className="flex items-center gap-1 text-xs font-black text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
              <X className="h-3 w-3" />{bilmayman}
            </span>
            <span className="text-xs font-bold text-slate-400">{kartaIdx + 1}/{fleshKartalar.length}</span>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }} />
        </div>
        <div className="text-center">
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {fleshTanlananBolimNomi || 'Barcha manbalar'} · {fleshMavzu}
          </span>
        </div>
        {qoldi === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-1">Barakalla! 🎉</h2>
            <p className="text-slate-500 text-sm mb-2">{bilaman}/{fleshKartalar.length} kartani bildingiz</p>
            <div className="flex items-center gap-3 mb-6">
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-600">{bilaman}</p>
                <p className="text-xs text-slate-400">Bilaman</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-red-500">{bilmayman}</p>
                <p className="text-xs text-slate-400">Bilmayman</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                setFleshKartalar(p => p.map(k => ({ ...k, holat: 'noma_lum' })));
                setKartaIdx(0); setKartaOchiq(false);
              }} className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-black hover:bg-violet-700 transition-all">
                <RotateCcw className="h-4 w-4" /> Qayta
              </button>
              <button onClick={() => { setFleshKartalar([]); setFleshMavzu(''); setFleshStep('manba'); }}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-black hover:bg-slate-200 transition-all">
                Chiqish
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div onClick={() => setKartaOchiq(!kartaOchiq)}
              className="flex-1 bg-white rounded-2xl border-2 border-slate-100 shadow-lg cursor-pointer flex flex-col items-center justify-center p-8 text-center hover:shadow-xl transition-all active:scale-[0.99] select-none"
              style={{ minHeight: 200 }}>
              <div className={`text-xs font-black uppercase tracking-widest mb-4 px-3 py-1 rounded-full ${kartaOchiq ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-violet-600 bg-violet-50 border border-violet-200'}`}>
                {kartaOchiq ? '✅ Javob' : '❓ Savol'}
              </div>
              <p className="text-base font-bold text-slate-900 leading-relaxed">
                {kartaOchiq ? karta.javob : karta.savol}
              </p>
              {!kartaOchiq && (
                <div className="mt-6 flex items-center gap-2 text-slate-300">
                  <div className="w-6 h-px bg-slate-200" />
                  <span className="text-xs">tap — javobni ko'ring</span>
                  <div className="w-6 h-px bg-slate-200" />
                </div>
              )}
              {kartaOchiq && (
                <div className="mt-5 pt-4 border-t border-slate-100 w-full">
                  <p className="text-[11px] font-bold text-slate-400 uppercase mb-1">Savol</p>
                  <p className="text-xs text-slate-500">{karta.savol}</p>
                </div>
              )}
            </div>
            {kartaOchiq ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {
                  setFleshKartalar(p => p.map((k, i) => i === kartaIdx ? { ...k, holat: 'bilmayman' } : k));
                  if (kartaIdx < fleshKartalar.length - 1) { setKartaIdx(i => i + 1); setKartaOchiq(false); }
                  else { setKartaOchiq(false); }
                }} className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-black text-sm transition-all active:scale-95">
                  <X className="h-4 w-4" /> Bilmayman
                </button>
                <button onClick={() => {
                  setFleshKartalar(p => p.map((k, i) => i === kartaIdx ? { ...k, holat: 'bilaman' } : k));
                  if (kartaIdx < fleshKartalar.length - 1) { setKartaIdx(i => i + 1); setKartaOchiq(false); }
                  else { setKartaOchiq(false); }
                }} className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-black text-sm transition-all active:scale-95">
                  <Check className="h-4 w-4" /> Bilaman
                </button>
              </div>
            ) : (
              <div className="flex justify-between px-1">
                <button disabled={kartaIdx === 0} onClick={() => { setKartaIdx(i => i - 1); setKartaOchiq(false); }}
                  className="text-sm font-bold text-slate-400 hover:text-slate-700 disabled:opacity-30 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all">
                  ← Oldingi
                </button>
                <button disabled={kartaIdx === fleshKartalar.length - 1} onClick={() => { setKartaIdx(i => i + 1); setKartaOchiq(false); }}
                  className="text-sm font-bold text-slate-400 hover:text-slate-700 disabled:opacity-30 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all">
                  Keyingi →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── KONSPEKT VIEW ─────────────────────────────────────────────────────────
  if (view === 'konspekt' && konspektMatn) {
    return (
      <div className="max-w-3xl mx-auto h-full flex flex-col gap-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
          <button onClick={() => setKonspektMatn('')}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-violet-600 transition-all">
            <ArrowLeft className="h-4 w-4" /> Yangi konspekt
          </button>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <BookMarked className="h-4 w-4 text-violet-500" />
            <span className="truncate max-w-[120px]">{konspektMavzu}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadKonspekt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-all">
              <Download className="h-3.5 w-3.5" />Word
            </button>
            <button onClick={copyKonspekt}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${copied ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700'}`}>
              {copied ? <><CheckCheck className="h-3.5 w-3.5" />Nusxalandi!</> : <><Copy className="h-3.5 w-3.5" />Nusxalash</>}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white p-6 md:p-8">
            <h1 className="text-xl font-black text-slate-900 mb-6 pb-4 border-b-2 border-violet-100">{konspektMavzu}</h1>
            <div className="text-sm leading-relaxed text-slate-700 space-y-1">
              {konspektMatn.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} className="text-base font-black text-violet-700 mt-5 mb-2 pb-1 border-b border-violet-100">{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-bold text-slate-800 mt-4 mb-1.5">{line.slice(4)}</h3>;
                if (line.startsWith('# ')) return <h1 key={i} className="text-lg font-black text-slate-900 mt-5 mb-3">{line.slice(2)}</h1>;
                if (line.startsWith('- ') || line.startsWith('• ')) return (
                  <div key={i} className="flex items-start gap-2 my-1">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  </div>
                );
                if (line.match(/^\d+\.\s/)) return (
                  <li key={i} className="ml-5 list-decimal text-slate-700 my-0.5"
                    dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                );
                if (line.trim() === '---') return <hr key={i} className="my-4 border-slate-100" />;
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return <p key={i} className="my-0.5" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />;
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN UI ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto flex" style={{ height: 'calc(100vh - 90px)', minHeight: 0 }}>

      {/* ── MANBA PANEL (chap tomondan chiqadi) ── */}
      {manbaPanel && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setManbaPanel(false)} />
          <div className="fixed left-0 top-0 bottom-0 z-40 w-72 bg-white border-r border-slate-200 shadow-2xl flex flex-col animate-slide-in-left">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-violet-50">
              <div className="flex items-center gap-2">
                <Library className="h-4 w-4 text-violet-600" />
                <span className="font-black text-sm text-violet-800">O'quv Manbalar</span>
              </div>
              <button onClick={() => setManbaPanel(false)} className="p-1.5 hover:bg-white rounded-lg transition-all">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {bolimlarYuklanyapti ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Yuklanmoqda...
                </div>
              ) : indexedBolimlar.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Hali indekslanmagan materiallar yo'q
                </div>
              ) : (
                <>
                  {/* Barchasi */}
                  <button onClick={() => setTanlananBolimlar([])}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${!hasFilter ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-violet-50'}`}>
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left font-semibold">Barcha manbalar</span>
                    {!hasFilter && <Check className="h-3.5 w-3.5" />}
                  </button>
                  {indexedBolimlar.map(b => {
                    const sel = tanlananBolimlar.includes(b.id);
                    return (
                      <button key={b.id} onClick={() => toggleBolim(b.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${sel ? 'bg-violet-100 text-violet-800 border border-violet-300' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
                        <BookOpen className="h-4 w-4 flex-shrink-0 text-violet-400" />
                        <span className="flex-1 font-medium leading-tight">{b.nomi}</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ${sel ? 'bg-violet-200 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                          {b._chunk_soni}
                        </span>
                        {sel && <Check className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
            {hasFilter && (
              <div className="px-3 py-2 border-t border-slate-100">
                <button onClick={() => setTanlananBolimlar([])}
                  className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all">
                  Filterni tozalash
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── CHAT TARIXI PANEL (chap tomondan) ── */}
      {tarixPanel && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20" onClick={() => setTarixPanel(false)} />
          <div className="fixed left-0 top-0 bottom-0 z-40 w-72 bg-white border-r border-slate-200 shadow-2xl flex flex-col animate-slide-in-left">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-600" />
                <span className="font-black text-sm text-slate-800">Chat tarixi</span>
              </div>
              <button onClick={() => setTarixPanel(false)} className="p-1.5 hover:bg-white rounded-lg transition-all">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            {/* 3 kun ogohlantirish */}
            <div className="px-3 py-2 bg-amber-50 border-b border-amber-100">
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Chat tarixi <strong>3 kun</strong> saqlangach avtomatik o'chadi. Muhim ma'lumotlarni saqlang.
                </p>
              </div>
            </div>
            <div className="p-2">
              <button onClick={newChat}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-all border border-violet-200">
                <Plus className="h-4 w-4" /> Yangi suhbat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {chatSessions.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Hali suhbat yo'q
                </div>
              ) : chatSessions.map(session => {
                const daysLeft = Math.ceil((HISTORY_TTL_MS - (Date.now() - session.updatedAt)) / (24 * 60 * 60 * 1000));
                const isActive = session.id === currentSessionId;
                return (
                  <div key={session.id}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-violet-100 border border-violet-300' : 'hover:bg-slate-50 border border-transparent'}`}
                    onClick={() => loadSession(session)}>
                    <MessageSquare className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{session.title}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {session.messages.length} xabar ·
                        <span className={daysLeft <= 1 ? 'text-red-400 font-bold' : 'text-slate-400'}> {daysLeft}k qoldi</span>
                      </p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-lg transition-all text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── ASOSIY KONTENT ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">

        {/* ── TOP NAVIGATION ── */}
        <div className="flex-shrink-0 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between px-3 py-2 gap-2">
            {/* Chap tugmalar */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => { setTarixPanel(true); setManbaPanel(false); }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all relative"
                title="Chat tarixi">
                <History className="h-4 w-4" />
                {chatSessions.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-violet-500 text-white rounded-full text-[8px] font-black flex items-center justify-center">
                    {Math.min(chatSessions.length, 9)}
                  </span>
                )}
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-purple-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                <Brain className="h-[18px] w-[18px] text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-black text-slate-900 leading-none">Smart Ta'lim</p>
                <p className="text-[9px] text-slate-400 leading-none mt-0.5">AI yordamida o'rgan</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {[
                { id: 'chat', icon: MessageSquare, label: 'Chat' },
                { id: 'flesh', icon: CreditCard, label: 'Flash' },
                { id: 'konspekt', icon: BookMarked, label: 'Konspekt' },
              ].map(tab => (
                <button key={tab.id}
                  onClick={() => setView(tab.id as View)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === tab.id ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
                  <tab.icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Manba tugmasi */}
            <button
              onClick={() => { setManbaPanel(true); setTarixPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${hasFilter ? 'bg-violet-50 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-200'}`}>
              <PanelLeftOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manba</span>
              {hasFilter && (
                <span className="w-4 h-4 bg-violet-600 text-white rounded-full text-[9px] font-black flex items-center justify-center">{tanlananBolimlar.length}</span>
              )}
            </button>
          </div>

          {/* Filter ko'rsatgich satri */}
          {hasFilter && (
            <div className="px-4 py-1.5 bg-violet-50 border-t border-violet-100 flex items-center gap-2 flex-wrap">
              <Filter className="h-3 w-3 text-violet-500 flex-shrink-0" />
              <span className="text-[10px] text-violet-600 font-semibold">Filtr:</span>
              {tanlananBolimlar.map(id => {
                const b = bolimlar.find(x => x.id === id);
                return b ? (
                  <span key={id} className="flex items-center gap-1 text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200 font-semibold">
                    {b.nomi}
                    <button onClick={() => toggleBolim(id)}><X className="h-2.5 w-2.5" /></button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          {/* 3 kun ogohlantirish — kichkina */}
          {historyWarned && (
            <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                <p className="text-[10px] text-amber-700">Chat tarixi 3 kun saqlangach o'chadi</p>
              </div>
              <button onClick={() => { setHistoryWarned(false); localStorage.setItem(HISTORY_WARN_KEY, '1'); }}
                className="text-[10px] text-amber-500 font-bold hover:text-amber-700 ml-2">OK</button>
            </div>
          )}
        </div>

        {/* ── CHAT VIEW ── */}
        {view === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/40">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center min-h-[280px] text-center select-none">
                  <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mb-4 border border-violet-100 shadow-sm">
                    <Sparkles className="h-8 w-8 text-violet-500" />
                  </div>
                  <h2 className="text-lg font-black text-slate-800 mb-1">O'quv materiallardan so'rang</h2>
                  <p className="text-sm text-slate-400 max-w-sm font-medium mb-4 leading-relaxed">
                    Darslik mazmunidan to'g'ridan-to'g'ri javob olasiz va manba ko'rsatiladi
                  </p>
                  {!isAuthenticated && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-5 max-w-sm">
                      <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <div className="text-left flex-1">
                        <p className="text-xs font-black text-amber-800">1 ta bepul so'rov</p>
                        <p className="text-[11px] text-amber-600">To'liq foydalanish uchun kiring</p>
                      </div>
                      <button onClick={requireLogin}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black rounded-lg transition-all">
                        Kirish
                      </button>
                    </div>
                  )}
                  {/* Dinamik shablon savollar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg w-full">
                    {suggestedQ.map((q, i) => (
                      <button key={i} onClick={() => sendMessage(q.text)}
                        className="flex items-start gap-2 p-3 bg-white hover:bg-violet-50 border border-slate-200 hover:border-violet-200 rounded-xl text-left transition-all group text-xs font-medium text-slate-600">
                        <span className="text-base flex-shrink-0">{q.icon}</span>
                        <span className="group-hover:text-violet-700 transition-colors leading-snug">{q.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.rol === 'user' ? 'justify-end' : 'justify-start'} gap-2.5`}>
                  {msg.rol === 'ai' && (
                    <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                      <Brain className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="max-w-[85%] space-y-2">
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.rol === 'user'
                        ? 'bg-violet-600 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
                    }`}>
                      {msg.rol === 'user'
                        ? msg.matn
                        : <div className="prose-sm">{renderWithCitations(msg.matn, msg.citations || [], setSelectedCitation)}</div>
                      }
                    </div>

                    {/* Tashqi bilim (manba topilmasa) */}
                    {msg.rol === 'ai' && msg.tashqi && (
                      <div className="flex items-center gap-1.5 ml-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        <span className="text-[10px] text-amber-700 font-semibold">
                          O'quv materialda topilmadi — umumiy bilimdan javob berildi. Tekshirish tavsiya etiladi.
                        </span>
                      </div>
                    )}

                    {/* Cache + Stats */}
                    {msg.rol === 'ai' && (msg.cached || msg.stats) && (
                      <div className="ml-1 flex items-center gap-1.5 flex-wrap">
                        {msg.cached && (
                          <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">⚡ Keshdan</span>
                        )}
                        {msg.stats && !msg.cached && msg.stats.final_docs > 0 && (
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            📄 {msg.stats.final_docs} manba · {msg.stats.strategy}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Citations */}
                    {msg.rol === 'ai' && (msg.citations?.length ?? 0) > 0 && (
                      <div className="space-y-1">
                        {msg.citations!.map(c => (
                          <button key={c.ref} onClick={() => setSelectedCitation(selectedCitation?.ref === c.ref ? null : c)}
                            className={`flex items-center gap-2 w-full text-left px-3 py-2 border rounded-xl transition-all group ${
                              selectedCitation?.ref === c.ref
                                ? 'bg-violet-50 border-violet-300'
                                : 'bg-white border-slate-100 hover:border-violet-200 hover:bg-violet-50/50'
                            }`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-all ${
                              selectedCitation?.ref === c.ref
                                ? 'bg-violet-600 text-white'
                                : 'bg-violet-100 text-violet-700 group-hover:bg-violet-600 group-hover:text-white'
                            }`}>{c.ref}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-slate-400 font-medium truncate">{c.bolim_nomi}</p>
                              <p className="text-xs font-semibold text-slate-700 truncate">{c.material_nomi}</p>
                            </div>
                            <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-violet-500 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Citation preview */}
                    {msg.rol === 'ai' && selectedCitation && msg.citations?.some(c => c.ref === selectedCitation.ref) && (
                      <div className="bg-white border-2 border-violet-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 bg-violet-600 text-white rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0">{selectedCitation.ref}</span>
                            <span className="text-xs font-bold text-violet-800 truncate">{selectedCitation.material_nomi}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => openMaterial(selectedCitation)}
                              className="text-[10px] font-black text-violet-600 hover:text-violet-800 px-2 py-1 bg-white border border-violet-200 rounded-lg transition-all">
                              Ochish →
                            </button>
                            <button onClick={() => setSelectedCitation(null)} className="text-slate-400 hover:text-slate-600 p-1">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="px-3 py-2.5 text-xs text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
                          {selectedCitation.matn.slice(0, 400)}{selectedCitation.matn.length > 400 ? '…' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-2">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">Javob yozilmoqda...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-slate-100 bg-white px-4 pt-2 pb-3">
              {messages.length > 0 && (
                <div className="flex justify-end mb-1.5">
                  <button onClick={clearChat}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-all">
                    <RefreshCw className="h-3 w-3" /> Yangi suhbat
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 bg-slate-50 border-2 border-slate-200 rounded-2xl px-3 py-2.5 focus-within:border-violet-400 focus-within:bg-white transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder="O'quv materiallar bo'yicha savol yozing..."
                  rows={1}
                  className="flex-1 resize-none bg-transparent outline-none text-sm text-slate-700 placeholder-slate-300 min-h-[22px] max-h-32 leading-relaxed"
                  style={{ overflow: 'hidden auto' }}
                  onInput={e => {
                    const t = e.target as HTMLTextAreaElement;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                  }}
                />
                <button onClick={() => sendMessage()} disabled={chatLoading || !input.trim()}
                  className="p-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-xl transition-all active:scale-90 flex-shrink-0 self-end shadow-sm">
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Disclaimer */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-400 text-center">
                  Smart Ta'lim AI xato qilishi mumkin — muhim ma'lumotlarni qayta tekshiring
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── FLASH SETUP (2-bosqich) ── */}
        {view === 'flesh' && fleshKartalar.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50/40 overflow-y-auto">
            <div className="w-full max-w-md space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CreditCard className="h-7 w-7 text-amber-500" />
                </div>
                <h2 className="text-lg font-black text-slate-900">Flash Kartalar</h2>
                <p className="text-sm text-slate-400 mt-1">Mavzudan avtomatik yaratiladi (max 15 ta)</p>
              </div>

              {!isAuthenticated && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs font-medium text-amber-700 flex-1">1 ta bepul · To'liq uchun kiring</p>
                  <button onClick={requireLogin} className="text-[11px] font-black px-2.5 py-1.5 bg-amber-500 text-white rounded-lg">Kirish</button>
                </div>
              )}

              {/* 2-bosqich UI */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Bosqich ko'rsatgich */}
                <div className="flex border-b border-slate-100">
                  {[
                    { num: 1, label: 'Manba tanlash', active: fleshStep === 'manba' },
                    { num: 2, label: 'Mavzu kiriting', active: fleshStep === 'mavzu' },
                  ].map(s => (
                    <div key={s.num} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition-all ${s.active ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-400' : 'text-slate-400'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${s.active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{s.num}</span>
                      {s.label}
                    </div>
                  ))}
                </div>

                <div className="p-5">
                  {/* QADAM 1: Manba tanlash */}
                  {fleshStep === 'manba' && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-600">O'quv manbasini tanlang:</p>
                      {bolimlarYuklanyapti ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /></div>
                      ) : (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          <button
                            onClick={() => { setFleshTanlananBolim(''); setFleshTanlananBolimNomi('Barcha manbalar'); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${!fleshTanlananBolim ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-amber-50/50'}`}>
                            <Globe className="h-4 w-4 text-amber-400 flex-shrink-0" />
                            <span className="font-semibold flex-1">Barcha manbalar</span>
                            {!fleshTanlananBolim && <Check className="h-4 w-4 text-amber-500" />}
                          </button>
                          {indexedBolimlar.map(b => (
                            <button key={b.id}
                              onClick={() => { setFleshTanlananBolim(b.id); setFleshTanlananBolimNomi(b.nomi); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${fleshTanlananBolim === b.id ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-amber-50/50'}`}>
                              <BookOpen className="h-4 w-4 text-amber-400 flex-shrink-0" />
                              <span className="font-medium flex-1">{b.nomi}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{b._chunk_soni}</span>
                              {fleshTanlananBolim === b.id && <Check className="h-4 w-4 text-amber-500" />}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => setFleshStep('mavzu')}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2">
                        Keyingi <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* QADAM 2: Mavzu */}
                  {fleshStep === 'mavzu' && (
                    <div className="space-y-4">
                      {fleshTanlananBolim && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="font-semibold truncate">{fleshTanlananBolimNomi}</span>
                          <button onClick={() => setFleshStep('manba')} className="ml-auto text-amber-400 hover:text-amber-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <div>
                        <label className="text-xs font-black text-slate-600 block mb-2">Mavzu yozing (o'zingiz istagan)</label>
                        <input
                          type="text"
                          placeholder="Masalan: Jinoyat uchun javobgarlik"
                          value={fleshMavzu}
                          onChange={e => setFleshMavzu(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && createFlesh()}
                          className="w-full px-4 py-3 border-2 border-slate-200 focus:border-amber-400 rounded-xl text-sm outline-none transition-colors bg-slate-50 focus:bg-white"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Karta soni (max 15):</label>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                          <button onClick={() => setFleshSon(p => Math.max(3, p - 1))}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-amber-300 transition-all">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-black text-slate-900 text-sm">{fleshSon}</span>
                          <button onClick={() => setFleshSon(p => Math.min(15, p + 1))}
                            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:border-amber-300 transition-all">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-xs text-slate-400">(3–15)</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setFleshStep('manba')}
                          className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all">
                          ← Orqaga
                        </button>
                        <button onClick={createFlesh} disabled={fleshLoading || !fleshMavzu.trim()}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl font-black text-sm transition-all">
                          {fleshLoading
                            ? <><Loader2 className="h-4 w-4 animate-spin" />AI yaratmoqda...</>
                            : <><Zap className="h-4 w-4" />Kartalar yaratish</>
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KONSPEKT SETUP ── */}
        {view === 'konspekt' && !konspektMatn && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50/40">
            <div className="w-full max-w-md space-y-5">
              <div className="text-center">
                <div className="w-14 h-14 bg-purple-50 border border-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <BookMarked className="h-7 w-7 text-purple-500" />
                </div>
                <h2 className="text-lg font-black text-slate-900">Konspekt Yaratish</h2>
                <p className="text-sm text-slate-400 mt-1">Word (.doc) sifatida yuklab olish mumkin</p>
              </div>

              {!isAuthenticated && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs font-medium text-amber-700 flex-1">1 ta bepul · To'liq uchun kiring</p>
                  <button onClick={requireLogin} className="text-[11px] font-black px-2.5 py-1.5 bg-amber-500 text-white rounded-lg">Kirish</button>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div>
                  <label className="text-xs font-black text-slate-600 block mb-2">Mavzu nomi</label>
                  <input
                    type="text"
                    placeholder="Masalan: Sud tizimining tuzilishi"
                    value={konspektMavzu}
                    onChange={e => setKonspektMavzu(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && createKonspekt()}
                    className="w-full px-4 py-3 border-2 border-slate-200 focus:border-purple-400 rounded-xl text-sm outline-none transition-colors bg-slate-50 focus:bg-white"
                  />
                </div>
                {hasFilter && (
                  <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                    <Filter className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="font-semibold">{tanlananBolimlar.length} ta manba filtrlangan</span>
                  </div>
                )}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
                  <p className="font-bold text-slate-600 mb-1">📋 Tarkib:</p>
                  <div className="space-y-0.5">
                    {['Asosiy tushunchalar', "Ta'riflar", 'Qonuniy asoslar', 'Amaliy misollar', 'Muhim xulosalar'].map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-4 h-4 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-black text-[9px]">{i + 1}</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={createKonspekt} disabled={konspektLoading || !konspektMavzu.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl font-black text-sm transition-all active:scale-[0.98]">
                  {konspektLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Yaratilmoqda...</>
                    : <><BookMarked className="h-4 w-4" />Konspekt yaratish</>
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in-left {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-left { animation: slide-in-left 0.25s ease-out; }
      `}</style>
    </div>
  );
}
