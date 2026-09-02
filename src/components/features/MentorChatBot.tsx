import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Bot, X, Send, Loader2, Minimize2, Maximize2,
  BrainCircuit, Trophy, Star, Zap, Sparkles, RotateCcw,
  ChevronRight, ExternalLink,
  FileUp, CheckSquare, Square, Play, Globe, Check,
  PlusSquare, Clock, BookOpen, ChevronDown, Edit2,
  BarChart2, Brain, Expand, Shrink, Plus,
  FileText, Users, Target, Flame, Eye, AlertTriangle,
  RefreshCw, ChevronLeft, ChevronUp, GraduationCap, Search,
  User, ArrowLeft, BookMarked
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, Area, AreaChart
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface MaterialAnalysis {
  bolim_nomi: string; bob_nomi: string; material_nomi: string;
  tavsif: string; mavzu: string; ishonch: number;
}

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp?: number;
  isWordResult?: boolean;
  wordParsedData?: WordParsedTest | null;
  savedTestKod?: string;
  isKazusForm?: boolean;
  isKazusSaved?: boolean;
  savedKazusKod?: string;
  isMaterialUploadPrompt?: boolean;
  isMaterialAnalysis?: boolean;
  materialAnalysisData?: MaterialAnalysis | null;
  materialAnalysisFile?: { name: string; tur: string; size: number; file?: File } | null;
  materialSaved?: boolean;
  savedBolimId?: string;
  citationMeta?: CitationMeta[] | null;
  intent?: string;
  isAnalitikaClarify?: boolean;
  analyticsData?: any;
  analyticsType?: string;
}

interface WordParsedTest { savollar: ParsedSavol[]; testNomi: string; }
interface ParsedSavol { savol: string; variantlar: string[]; togriJavob: number; vaqt_sekund: number; izoh?: string; link?: string; }

interface StudentContext {
  ism?: string; familiya?: string; kurs?: string; guruh?: string; loginId?: string;
  totalXp?: number; currentLevel?: number; badges?: string[]; reytingOrni?: number;
  testNatijalari?: { testNomi: string; foiz: number; togriSoni: number; xatoSoni: number; savolSoni: number; xatoMavzular: string[]; xatoSavollar?: { savol: string; togriJavob: string }[]; sana?: string; }[];
  kazusNatijalari?: { mavzu: string; ball: number; maksimalBall: number; foiz?: number; kazuslarTafsiloti?: { index: number; ball: number; izoh: string }[]; xatoKazuslar?: { mavzu: string; ball: number }[]; sana?: string; }[];
  korilganMateriallar?: { bolimNomi: string; bobNomi: string }[];
  zaifFanlar?: string[]; kuchliFantlar?: string[]; joriySahifa?: string;
  mavjudTestlar?: { nomi: string; kod: string; faol: boolean }[];
  mavjudKazuslar?: { mavzu: string; kod: string; faol: boolean }[];
  mavjudMateriallar?: { nomi: string; id: string }[];
  savol_javob_bolimlar?: { nomi: string; savolSoni: number }[];
}

interface CitationMeta { ref: number; material_id: string; bolim_id: string; bob_id: string; bolim_nomi: string; bob_nomi: string; material_nomi: string; }

// ─── MESSAGE RENDERER ─────────────────────────────────────────────────────────
type NavLink = { type: 'nav'; tab: string; label: string; extra?: { kod?: string; tur?: 'test' | 'kazus'; materialId?: string } };
type TextPart = { type: 'text'; html: string };
type MessagePart = TextPart | NavLink;

function formatMarkdownTable(lines: string[]): string {
  // Separator satirlarini filtrlash (faqat |, -, :, bo'shliq bo'lgan satrlar)
  const dataRows = lines.filter(l => !/^\s*\|?[\s\-:|]+\|\s*$/.test(l) && l.trim().startsWith('|'));
  if (dataRows.length < 2) return lines.join('\n');

  const parseRow = (row: string): string[] => {
    const parts = row.split('|');
    // Birinchi va oxirgi bo'sh elementlarni olib tashlash
    if (parts[0]?.trim() === '') parts.shift();
    if (parts[parts.length - 1]?.trim() === '') parts.pop();
    return parts.map(c => c.trim());
  };

  let html = '<div class="overflow-x-auto my-3"><table class="w-full text-xs border-collapse rounded-xl overflow-hidden shadow-sm">';
  
  // Header
  const headerCells = parseRow(dataRows[0]);
  html += '<thead><tr>';
  headerCells.forEach(cell => {
    const content = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    html += `<th class="px-3 py-2 bg-violet-600 text-white font-bold text-left border border-violet-500 whitespace-nowrap text-[11px]">${content || '&nbsp;'}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Body rows
  dataRows.slice(1).forEach((row, i) => {
    const cells = parseRow(row);
    const rowClass = i % 2 === 0 ? 'bg-white' : 'bg-violet-50/40';
    html += `<tr class="${rowClass} hover:bg-violet-50 transition-colors">`;
    cells.forEach(cell => {
      const content = cell.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') || '&nbsp;';
      html += `<td class="px-3 py-2 border border-gray-100 text-gray-700 text-[11px]">${content}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function formatPlainText(text: string): string {
  // Markdown jadvallarni line-by-line parse qilish
  const inputLines = text.split('\n');
  const outputParts: string[] = [];
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      outputParts.push(formatMarkdownTable(tableBuffer));
    } else {
      outputParts.push(...tableBuffer);
    }
    tableBuffer = [];
  };

  for (const line of inputLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.includes('|')) {
      tableBuffer.push(line);
    } else {
      if (tableBuffer.length > 0) flushTable();
      outputParts.push(line);
    }
  }
  if (tableBuffer.length > 0) flushTable();

  // Jadvallar HTML bo'lsa, ularni saqlagan holda qolgan formatlamani qo'llamiz
  return outputParts.join('\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^### (.+)$/gm, '<p class="text-xs font-black text-violet-700 uppercase tracking-wider mt-2 mb-1">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="text-sm font-black text-gray-800 mt-2 mb-1">$1</p>')
    .replace(/(<li>.*?<\/li>\n?)+/gs, m => `<ul class="list-disc pl-4 space-y-0.5 my-1">${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/(?<!>)\n(?!<)/g, '<br/>');
}

function parseMessageParts(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const regex = /\[\[(NAV|TEST|KAZUS|MATERIAL):([^\|]+)\|([^\]]+)\]\]/g;
  let lastIndex = 0; let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) { const s = text.slice(lastIndex, match.index); if (s) parts.push({ type: 'text', html: formatPlainText(s) }); }
    const [, linkType, param, label] = match; const p = param.trim(); const l = label.trim();
    if (linkType === 'NAV') parts.push({ type: 'nav', tab: p, label: l });
    else if (linkType === 'TEST') parts.push({ type: 'nav', tab: 'sinov', label: l, extra: { kod: p, tur: 'test' } });
    else if (linkType === 'KAZUS') parts.push({ type: 'nav', tab: 'sinov', label: l, extra: { kod: p, tur: 'kazus' } });
    else if (linkType === 'MATERIAL') parts.push({ type: 'nav', tab: 'oqmatlar', label: l, extra: { materialId: p } });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) { const r = text.slice(lastIndex); if (r) parts.push({ type: 'text', html: formatPlainText(r) }); }
  return parts;
}

function getNavColor(part: NavLink) {
  if (part.extra?.tur === 'test') return 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200';
  if (part.extra?.tur === 'kazus') return 'bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200';
  if (part.extra?.materialId) return 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200';
  return 'bg-violet-100 border-violet-300 text-violet-700 hover:bg-violet-200';
}
function getNavIcon(part: NavLink) {
  if (part.extra?.tur === 'test') return '📝';
  if (part.extra?.tur === 'kazus') return '📋';
  if (part.extra?.materialId) return '📚';
  return '→';
}

function MessageRenderer({ text, onNav, citationMeta }: {
  text: string; onNav?: (tab: string, extra?: { kod?: string; tur?: 'test' | 'kazus'; materialId?: string }) => void; citationMeta?: CitationMeta[] | null;
}) {
  const parts = useMemo(() => parseMessageParts(text), [text]);

  const renderTextWithCitations = (html: string) => {
    if (!citationMeta || citationMeta.length === 0) return <span className="prose-sm" dangerouslySetInnerHTML={{ __html: html }} />;
    const withCitations = html.replace(/\[([0-9]+)\]/g, (match, num) => {
      const n = parseInt(num);
      if (n === 0) return `<span class="inline-flex items-center mx-0.5 px-1.5 py-0.5 text-[9px] font-black rounded bg-gray-200 text-gray-500 border border-gray-300">[0]</span>`;
      const meta = citationMeta.find(c => c.ref === n); if (!meta) return match;
      return `<span data-citation="${n}" class="citation-ref inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 text-[10px] font-black rounded-md bg-violet-100 text-violet-700 border border-violet-300 cursor-pointer hover:bg-violet-200 transition-all" title="${meta.bolim_nomi} › ${meta.bob_nomi}">[${n}]</span>`;
    });
    return (
      <span className="prose-sm" dangerouslySetInnerHTML={{ __html: withCitations }}
        onClick={(e) => {
          const target = (e.target as HTMLElement).closest('[data-citation]');
          if (target) { const n = parseInt(target.getAttribute('data-citation') || '0'); const meta = citationMeta.find(c => c.ref === n); if (meta) onNav?.('oqmatlar', { materialId: meta.material_id }); }
        }} />
    );
  };

  return (
    <div className="leading-relaxed text-sm">
      {parts.map((part, i) => {
        if (part.type === 'text') return <span key={i}>{renderTextWithCitations(part.html)}</span>;
        return (
          <button key={i} onClick={() => onNav?.(part.tab, part.extra)}
            className={`inline-flex items-center gap-1.5 mx-0.5 my-1 px-3 py-1.5 text-xs font-bold rounded-lg border-2 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-sm ${getNavColor(part)}`}>
            <span>{getNavIcon(part)}</span>
            <span className="truncate max-w-[200px]">{part.label}</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

// ─── WORD PARSE ───────────────────────────────────────────────────────────────
function parseIzohLink(text: string): { cleanText: string; izoh?: string; link?: string } {
  let izoh: string | undefined; let link: string | undefined; let cleanText = text;
  const im = text.match(/\[(?:izoh|изоҳ|изох)-([^\]]+)\]/i);
  if (im) { izoh = im[1].trim(); cleanText = cleanText.replace(im[0], '').trim(); }
  const lm = text.match(/\[(?:link|линк)-(https?:\/\/[^\]]+)\]/i);
  if (lm) { link = lm[1].trim(); cleanText = cleanText.replace(lm[0], '').trim(); }
  return { cleanText, izoh, link };
}

function extractVariantsFromText(text: string): { variants: string[]; correctIdx: number } {
  const parts = text.split(/\s*(?:^|\s)(\*?[A-D\u0410-\u0413][\.\)\-]\s+)/).filter(p => p.trim().length > 0);
  const variants: string[] = []; let correctIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].match(/^\*?[A-D\u0410-\u0413][\.\)\-]\s+$/)) {
      if (parts[i].includes('*')) correctIdx = variants.length;
      variants.push((parts[i + 1] || '').trim()); i++;
    }
  }
  return { variants, correctIdx };
}

function parseWordHtmlToTests(htmlContent: string, defaultVaqt = 30): ParsedSavol[] {
  if (!htmlContent.trim()) return [];
  const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
  const elements = Array.from(doc.body.children);
  const qRegex = /^\s*\d+\.\s+/; const vRegex = /^\s*\*?[A-D\u0410-\u0413][\.\)\-]\s+/;
  const results: ParsedSavol[] = [];
  let curSavol = ''; let curVars: string[] = []; let detectedCorrect = 0; let started = false;
  const saveP = () => {
    if (!curSavol) return;
    const sp = parseIzohLink(curSavol.replace(/<[^>]+>/g, ''));
    const extracted = extractVariantsFromText(curSavol);
    const extractVL = (vars: string[]) => {
      let iz: string | undefined; let lk: string | undefined;
      const clean = vars.map(v => { const p = parseIzohLink(v.replace(/<[^>]+>/g, '')); if (p.izoh) iz = p.izoh; if (p.link) lk = p.link; return v.replace(/\[(?:izoh|изоҳ|изох)-[^\]]+\]/gi, '').replace(/\[(?:link|линк)-https?:\/\/[^\]]+\]/gi, '').trim(); });
      return { clean, iz, lk };
    };
    if (extracted.variants.length >= 2) {
      const rt = curSavol.split(/\s*(?:^|\s)(\*?[A-D\u0410-\u0413][\.\)\-]\s+)/)[0];
      const { clean, iz, lk } = extractVL(extracted.variants.slice(0, 4));
      results.push({ savol: rt, variantlar: clean, togriJavob: extracted.correctIdx, vaqt_sekund: defaultVaqt, izoh: sp.izoh || iz, link: sp.link || lk });
    } else if (curVars.length >= 2) {
      const { clean, iz, lk } = extractVL(curVars.slice(0, 4));
      results.push({ savol: curSavol, variantlar: clean, togriJavob: detectedCorrect, vaqt_sekund: defaultVaqt, izoh: sp.izoh || iz, link: sp.link || lk });
    }
  };
  elements.forEach(el => {
    const text = el.textContent || ''; const oh = el.outerHTML;
    if (!started) { if (text.trim().match(qRegex)) started = true; else return; }
    if (qRegex.test(text)) { saveP(); curSavol = oh.replace(/>\s*\d+\.\s+/i, '>'); curVars = []; detectedCorrect = 0; }
    else if (vRegex.test(text)) { if (text.trim().startsWith('*')) detectedCorrect = curVars.length; curVars.push(oh.replace(/>\s*(\*?)([A-D\u0410-\u0413])[\.\)\-]\s+/i, '>')); }
    else { if (curSavol && curVars.length === 0) curSavol += oh; else if (curVars.length > 0) curVars[curVars.length - 1] += oh; }
  });
  saveP();
  return results;
}

// ─── TEZKOR SAVOLLAR ──────────────────────────────────────────────────────────
const TEZKOR_SAVOLLAR = [
  { label: '📊 Natijalarim tahlili', text: 'Mening test va kazus natijalarimni batafsil tahlil qilib ber — qayerda xato qildim, necha foiz oldim, nima qilishim kerak?' },
  { label: '🗺️ Sayt xaritasi — kliklanadigan havolalar', text: "Saytda qaysi bo'limlarda nimalar bor? Mavjud testlar, kazuslar va materiallar bilan birga havola bilan tushuntir." },
  { label: '🎯 Bugungi tavsiya', text: "Natijalarimga qarab bugun qaysi testni yechishimni yoki qaysi materialni o'qishimni maslahat ber — havola bilan." },
  { label: '❓ Sinov qanday boshlanadi?', text: 'Test yoki kazusni qanday boshlashni bosqichma-bosqich tushuntir.' },
];
const USTOZ_TEZKOR_SAVOLLAR = [
  { label: '📊 Test natijalarini tahlil qil', text: 'Barcha testlarim natijalarini tahlil qil. Kim alochi, kim past natija oldi, qaysi savolda eng ko\'p xato bor?' },
  { label: '📋 Kazus natijalarini tahlil qil', text: 'Barcha kazuslarim natijalarini tahlil qil. O\'rtacha ball, e\'tibordan chetda qolgan elementlar va tavsiyalar ber.' },
  { label: '🏆 Har testdan 1 ta alochini top', text: 'Har bir testimdan eng yuqori natija olgan 1 ta o\'quvchini top va jadvalli ko\'rsat.' },
  { label: '⚠️ Past natijali o\'quvchilar', text: 'Qaysi o\'quvchilarim 50% dan past natija olmoqda? Ularni test va kazus bo\'yicha ko\'rsat.' },
  { label: '📚 Material ko\'rishlar statistikasi', text: 'O\'quv materiallarimni necha o\'quvchi ko\'rdi? Eng ommabop va eng kam ko\'rilganlarini ko\'rsat.' },
  { label: '📝 Word fayldan test yaratish', text: 'Word fayldan test yaratmoqchiman' },
  { label: '📋 Yangi kazus yaratish', text: 'Yangi kazus yaratmoqchiman' },
  { label: "📚 O'quv material yuklash", text: "O'quv material yuklamoqchiman" },
];

function getSahifaNomi(activeTab: string): string {
  const map: Record<string, string> = {
    haqida: 'Bosh sahifa', sinov: 'Sinov boshlash', natijalar: 'Real vaqt natijalari',
    mavjud_testlar: 'Mavjud testlar', mavjud_kazuslar: 'Mavjud kazuslar',
    oqmatlar: "O'quv materiallari", savol_javob: 'Savol-Javob', profil: 'Profil',
    reyting: 'Reyting', yordam: 'Yordam', ustoz: 'Ustoz kabineti',
  };
  return map[activeTab] || activeTab;
}

const APAL = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#ec4899','#f97316','#6366f1','#84cc16'];
const COLORS_MAP = { green: '#10b981', red: '#ef4444', blue: '#3b82f6', amber: '#f59e0b', purple: '#8b5cf6', gray: '#94a3b8' };

// ─── YORDAMCHI ─────────────────────────────────────────────────────────────────
const CustomBarTooltip2 = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-xl shadow-2xl border border-white/10 text-xs">
      <p className="font-bold mb-1 text-gray-300">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.color }}>{p.name}: <span className="font-black">{p.value}</span></p>
      ))}
    </div>
  );
};

const MiniStatCard = ({ label, value, sub, color = 'blue', icon: Icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: any }) => {
  const cols: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
  };
  return (
    <div className={`border-2 rounded-xl p-3 ${cols[color] || cols.blue}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
        <p className="text-[9px] font-bold opacity-70 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
};

const FoizBar2 = ({ foiz }: { foiz: number }) => {
  const color = foiz >= 85 ? '#10b981' : foiz >= 70 ? '#3b82f6' : foiz >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${foiz}%`, background: color }} />
      </div>
      <span className="text-[10px] font-black w-8 text-right" style={{ color }}>{foiz}%</span>
    </div>
  );
};

// ─── USTOZ ANALITIKA PANELI (admin panel bilan bir xil ko'rinish) ─────────────
interface AnalyticsPanelProps {
  type: 'testlar' | 'kazuslar' | 'materiallar';
  data: any;
  onClose: () => void;
  onTypeChange: (t: 'testlar' | 'kazuslar' | 'materiallar') => void;
  loading: boolean;
  aiTavsiya: string;
  aiLoading: boolean;
  onNavigate?: (tab: string, extra?: any) => void;
  ustozId?: string;
  ustozIsmi?: string;
}

function AnalyticsPanel({ type, data, onTypeChange, loading, aiTavsiya, aiLoading, onNavigate, ustozId, ustozIsmi }: AnalyticsPanelProps) {
  const [aktifTab, setAktifTab] = useState<'testlar' | 'kazuslar' | 'materiallar'>(type);
  const [tanlanganTest, setTanlanganTest] = useState<any | null>(null);
  const [tanlanganToplam, setTanlanganToplam] = useState<any | null>(null);
  const [testJavoblar, setTestJavoblar] = useState<any[]>([]);
  const [kazusJavoblar, setKazusJavoblar] = useState<any[]>([]);
  const [ichkiLoading, setIchkiLoading] = useState(false);
  const [rosterOchiq, setRosterOchiq] = useState(false);
  const [kengaytSavol, setKengaytSavol] = useState<number | null>(null);
  const [umumiyStats, setUmumiyStats] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [xatolarTop3, setXatolarTop3] = useState<any[]>([]);

  // Tab o'zgarganda ota komponentni xabardor qilish
  useEffect(() => {
    setAktifTab(type);
    setTanlanganTest(null);
    setTanlanganToplam(null);
    setRosterOchiq(false);
  }, [type]);

  // Umumiy statistika hisoblash
  useEffect(() => {
    if (!data) return;
    const testlar = data?.testlar || [];
    const toplamlar = data?.toplamlar || [];
    const materiallar = data?.materiallar || [];

    const jami_test_javob = testlar.reduce((s: number, t: any) => s + (t.javoblar_soni || 0), 0);
    const jami_kazus_javob = toplamlar.reduce((s: number, t: any) => s + (t.javoblar_soni || 0), 0);
    const jami_korishlar = materiallar.reduce((s: number, m: any) => s + (m.korish_soni || 0), 0);

    setUmumiyStats({
      jami_testlar: testlar.length,
      jami_toplamlar: toplamlar.length,
      jami_materiallar: materiallar.length,
      jami_test_javoblar: jami_test_javob,
      jami_kazus_javoblar: jami_kazus_javob,
      jami_korishlar,
    });

    // Trend data (oxirgi 7 kun)
    const trend: Record<string, { sana: string; testlar: number; kazuslar: number }> = {};
    const bugun = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(bugun); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      trend[key] = { sana: key.slice(5), testlar: 0, kazuslar: 0 };
    }
    testlar.forEach((t: any) => {
      (t.barcha_oquvchilar || []).forEach((_: any) => {
        const key = new Date().toISOString().split('T')[0];
        if (trend[key]) trend[key].testlar++;
      });
    });
    setTrendData(Object.values(trend));

    // Xato savollar top3
    const xatoArr: any[] = [];
    testlar.forEach((t: any) => {
      (t.xato_savollar || []).forEach((x: any) => {
        xatoArr.push({ ...x, testNomi: t.test_nomi, xatoFoiz: x.foiz });
      });
    });
    setXatolarTop3(xatoArr.sort((a, b) => b.xatoFoiz - a.xatoFoiz).slice(0, 3));
  }, [data]);

  const testniOch = async (test: any) => {
    setTanlanganTest(test);
    setIchkiLoading(true);
    setRosterOchiq(false);
    setKengaytSavol(null);
    try {
      const { data: jd } = await supabase.from('test_javoblar').select('*').eq('test_kod', test.test_kod);
      setTestJavoblar(jd || []);
    } finally { setIchkiLoading(false); }
  };

  const toplamniOch = async (toplam: any) => {
    setTanlanganToplam(toplam);
    setIchkiLoading(true);
    setRosterOchiq(false);
    try {
      const { data: jd } = await supabase.from('javoblar').select('*').eq('toplam_kod', toplam.toplam_kod).not('baho', 'is', null);
      setKazusJavoblar(jd || []);
    } finally { setIchkiLoading(false); }
  };

  const testlar = (data?.testlar || []);
  const toplamlar = (data?.toplamlar || []);
  const materiallar = (data?.materiallar || []);

  const tabs = [
    { id: 'testlar' as const, label: 'Testlar', icon: FileText, color: 'blue', cnt: testlar.length },
    { id: 'kazuslar' as const, label: 'Kazuslar', icon: Brain, color: 'purple', cnt: toplamlar.length },
    { id: 'materiallar' as const, label: 'Materiallar', icon: BookOpen, color: 'teal', cnt: materiallar.length },
  ];
  const activeColors: Record<string, string> = {
    blue: 'border-blue-500 text-blue-700 bg-blue-50',
    purple: 'border-purple-500 text-purple-700 bg-purple-50',
    teal: 'border-teal-500 text-teal-700 bg-teal-50',
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="bg-white/10 p-2 rounded-xl border border-white/20">
          <BarChart2 className="h-4 w-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm">Mening Analitikam</p>
          <p className="text-slate-400 text-[10px]">{ustozIsmi || ''} — faqat o'z ma'lumotlari</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {/* Tab navigatsiya */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        {tabs.map(tab => (
          <button key={tab.id}
            onClick={() => { onTypeChange(tab.id); setTanlanganTest(null); setTanlanganToplam(null); setRosterOchiq(false); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-[11px] font-black border-b-2 transition-all ${
              aktifTab === tab.id ? activeColors[tab.color] : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}>
            <tab.icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
              aktifTab === tab.id ? 'bg-white' : 'bg-gray-100 text-gray-500'
            }`}>{tab.cnt}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            <p className="text-xs text-gray-400 font-medium">Ma'lumotlar yuklanmoqda...</p>
          </div>
        ) : (
          <>
            {/* ══ UMUMIY STATISTIKA ══ */}
            {!tanlanganTest && !tanlanganToplam && umumiyStats && (
              <div className="grid grid-cols-3 gap-2">
                <MiniStatCard label="Testlar" value={umumiyStats.jami_testlar} icon={FileText} color="blue" />
                <MiniStatCard label="Test yechildi" value={umumiyStats.jami_test_javoblar} icon={Users} color="green" />
                <MiniStatCard label="Kazus yechildi" value={umumiyStats.jami_kazus_javoblar} icon={Brain} color="purple" />
                <MiniStatCard label="Ko'rishlar" value={umumiyStats.jami_korishlar} icon={Eye} color="teal" />
                <MiniStatCard label="Materiallar" value={umumiyStats.jami_materiallar} icon={BookMarked} color="amber" />
                <MiniStatCard label="Kazuslar" value={umumiyStats.jami_toplamlar} icon={Target} color="blue" />
              </div>
            )}

            {/* Xato savollar zaif nuqtasi */}
            {aktifTab === 'testlar' && !tanlanganTest && xatolarTop3.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-red-500 p-1.5 rounded-lg"><AlertTriangle className="h-3.5 w-3.5 text-white" /></div>
                  <h3 className="font-black text-red-800 text-xs">🔴 Eng qiyin savollar (top-3)</h3>
                </div>
                <div className="space-y-1.5">
                  {xatolarTop3.map((s: any, i: number) => (
                    <div key={i} className="bg-white border border-red-100 rounded-lg p-2">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[9px] font-black text-red-500">{s.testNomi?.slice(0, 20)}</span>
                        <span className="text-xs font-black text-red-600">{s.xatoFoiz}% xato</span>
                      </div>
                      <p className="text-[10px] text-gray-600 line-clamp-1">{s.savol}</p>
                      <FoizBar2 foiz={100 - (s.xatoFoiz || 0)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ TESTLAR TAB ══ */}
            {aktifTab === 'testlar' && (() => {
              const filteredTestlar = testlar.filter((t: any) => t.javoblar_soni > 0);

              // Test ichki sahifa
              if (tanlanganTest) {
                if (ichkiLoading) return (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                    <p className="text-xs text-gray-400">Tahlil yuklanmoqda...</p>
                  </div>
                );
                const savollar = tanlanganTest.savollar || [];
                const rosterJadval = [...testJavoblar].sort((a, b) => b.foiz - a.foiz);
                const ortachaFoiz = testJavoblar.length > 0
                  ? Math.round(testJavoblar.reduce((s, j) => s + (j.foiz || 0), 0) / testJavoblar.length) : 0;
                const pieData = [
                  { name: "To'g'ri", value: testJavoblar.reduce((s, j) => s + (j.togri_soni || 0), 0) },
                  { name: "Xato", value: testJavoblar.reduce((s, j) => s + (j.xato_soni || 0), 0) },
                  { name: "Javobsiz", value: testJavoblar.reduce((s, j) => s + (j.javob_berilmagan || 0), 0) },
                ];
                return (
                  <div className="space-y-3">
                    <button onClick={() => { setTanlanganTest(null); setTestJavoblar([]); }}
                      className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5" /> Testlar ro'yxatiga qaytish
                    </button>
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-4 text-white">
                      <h2 className="text-sm font-black mb-1">{tanlanganTest.test_nomi}</h2>
                      <div className="flex flex-wrap gap-2 text-[10px] text-blue-100">
                        <span>Kod: <strong className="text-white">{tanlanganTest.test_kod}</strong></span>
                        <span>{savollar.length} savol</span>
                        <span>{testJavoblar.length} qatnashuvchi</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStatCard label="Qatnashuvchi" value={testJavoblar.length} icon={Users} color="blue" />
                      <MiniStatCard label="O'rtacha" value={`${ortachaFoiz}%`} icon={Target}
                        color={ortachaFoiz >= 70 ? 'green' : ortachaFoiz >= 50 ? 'amber' : 'red'} />
                    </div>

                    {/* O'quvchilar roster */}
                    <div className="bg-white border-2 border-indigo-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-indigo-50"
                        onClick={() => setRosterOchiq(v => !v)}>
                        <div className="flex items-center gap-2">
                          <div className="bg-indigo-100 p-1.5 rounded-lg"><Users className="h-3.5 w-3.5 text-indigo-600" /></div>
                          <p className="font-black text-xs text-gray-800">O'quvchilar ro'yxati</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{rosterJadval.length} ta</span>
                          {rosterOchiq ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                        </div>
                      </div>
                      {rosterOchiq && (
                        <div className="border-t border-indigo-100 max-h-48 overflow-y-auto">
                          {rosterJadval.map((j: any, idx: number) => (
                            <div key={j.id} className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 border-b border-indigo-50 last:border-0">
                              <span className="w-5 text-center font-black text-[10px] text-gray-400">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs text-gray-800 truncate">{j.oquvchi_ismi}</p>
                                <div className="flex gap-1.5 text-[9px]">
                                  <span className="text-green-600 font-bold">✓{j.togri_soni}</span>
                                  <span className="text-red-600 font-bold">✗{j.xato_soni}</span>
                                </div>
                              </div>
                              <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${
                                j.foiz >= 70 ? 'text-green-600 bg-green-50' : j.foiz >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                              }`}>{j.foiz}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pie chart */}
                    {pieData[0].value + pieData[1].value > 0 && (
                      <div className="bg-white border border-gray-100 rounded-xl p-3">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Javoblar taqsimoti</p>
                        <div className="flex items-center gap-3">
                          <ResponsiveContainer width={120} height={120}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={3} dataKey="value">
                                {pieData.map((_, i) => <Cell key={i} fill={[COLORS_MAP.green, COLORS_MAP.red, COLORS_MAP.gray][i]} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex-1 space-y-1.5">
                            {pieData.map((p, i) => {
                              const colors = [COLORS_MAP.green, COLORS_MAP.red, COLORS_MAP.gray];
                              return (
                                <div key={i} className="flex items-center justify-between p-1.5 rounded-lg border"
                                  style={{ borderColor: colors[i] + '40', background: colors[i] + '10' }}>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors[i] }} />
                                    <span className="text-[10px] font-bold text-gray-700">{p.name}</span>
                                  </div>
                                  <span className="text-sm font-black" style={{ color: colors[i] }}>{p.value}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Qiyin savollar */}
                    {tanlanganTest.xato_savollar?.length > 0 && (
                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Flame className="h-4 w-4 text-red-600" />
                          <p className="font-black text-red-800 text-xs">Eng qiyin savollar</p>
                        </div>
                        <div className="space-y-2">
                          {tanlanganTest.xato_savollar.slice(0, 3).map((s: any, i: number) => (
                            <div key={i} className="bg-white border border-red-100 rounded-lg p-2"
                              onClick={() => setKengaytSavol(kengaytSavol === i ? null : i)}
                              style={{ cursor: 'pointer' }}>
                              <div className="flex justify-between items-center mb-0.5">
                                <span className="text-[9px] font-black text-red-500">Savol {s.savol_index}</span>
                                <span className="text-xs font-black text-red-600">{s.foiz}% xato</span>
                              </div>
                              <p className="text-[10px] text-gray-700 line-clamp-2">{s.savol}</p>
                              <FoizBar2 foiz={100 - (s.foiz || 0)} />
                              {s.oquvchilar?.length > 0 && kengaytSavol === i && (
                                <p className="text-[9px] text-red-700 mt-1">Xato qilganlar: {s.oquvchilar.slice(0, 5).join(', ')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* A'lochilar vs past */}
                    <div className="grid grid-cols-1 gap-2">
                      {tanlanganTest.alochi_oquvchilar?.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                          <p className="text-[9px] font-black text-emerald-600 uppercase mb-1.5">🏆 A'lochilar</p>
                          {tanlanganTest.alochi_oquvchilar.slice(0, 3).map((o: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs py-0.5">
                              <span className="text-gray-700">{['🥇','🥈','🥉'][i]} {o.ism}</span>
                              <span className="font-black text-emerald-700">{o.foiz}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {tanlanganTest.past_oquvchilar?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5">
                          <p className="text-[9px] font-black text-red-500 uppercase mb-1">⚠️ 50%dan past ({tanlanganTest.past_oquvchilar.length} ta)</p>
                          <p className="text-[10px] text-red-800">{tanlanganTest.past_oquvchilar.slice(0, 5).map((o: any) => typeof o === 'string' ? o : o.ism).join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Testlar ro'yxati
              if (!filteredTestlar.length) return (
                <div className="text-center py-12 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Hali test javoblari yo'q</p>
                  <p className="text-[10px] mt-1">Talabalar test yechganda statistika paydo bo'ladi</p>
                </div>
              );
              return (
                <div className="space-y-2">
                  {/* Taqqoslash grafik */}
                  {filteredTestlar.length > 1 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Testlar taqqoslama</p>
                      <ResponsiveContainer width="100%" height={100}>
                        <BarChart data={filteredTestlar.slice(0, 8).map((t: any) => ({ name: (t.test_nomi || '').slice(0, 7) + '…', foiz: t.ortacha_foiz }))} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 7, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} domain={[0, 100]} />
                          <Tooltip content={<CustomBarTooltip2 />} />
                          <Bar dataKey="foiz" name="O'rtacha %" radius={[3, 3, 0, 0]}>
                            {filteredTestlar.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={APAL[i % APAL.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {filteredTestlar.map((test: any) => (
                    <div key={test.test_kod}
                      className="bg-white border-2 border-gray-100 hover:border-blue-300 rounded-xl p-3 cursor-pointer transition-all group hover:shadow-sm"
                      onClick={() => testniOch(test)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                          test.ortacha_foiz >= 70 ? 'bg-green-100 text-green-700' : test.ortacha_foiz >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>{test.ortacha_foiz}%</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 group-hover:text-blue-700 truncate">{test.test_nomi}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono text-gray-400">#{test.test_kod}</span>
                            <span className="text-[9px] font-bold text-blue-600">{test.javoblar_soni} qatnashuvchi</span>
                          </div>
                          <FoizBar2 foiz={test.ortacha_foiz} />
                        </div>
                        <BarChart2 className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ══ KAZUSLAR TAB ══ */}
            {aktifTab === 'kazuslar' && (() => {
              const filteredToplamlar = toplamlar.filter((t: any) => t.javoblar_soni > 0);

              // Kazus ichki sahifa
              if (tanlanganToplam) {
                if (ichkiLoading) return (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-2" />
                    <p className="text-xs text-gray-400">Yuklanmoqda...</p>
                  </div>
                );
                const rosterJadval = kazusJavoblar.map(j => {
                  const jami = (j.baho || []).reduce((s: number, b: any) => s + (b.ball || 0), 0);
                  const maks = (j.baho || []).length * 30;
                  return { ...j, jami, maks, foiz: maks > 0 ? Math.round((jami / maks) * 100) : 0 };
                }).sort((a, b) => b.foiz - a.foiz);
                return (
                  <div className="space-y-3">
                    <button onClick={() => { setTanlanganToplam(null); setKazusJavoblar([]); }}
                      className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-purple-600 transition-colors">
                      <ChevronLeft className="h-3.5 w-3.5" /> Kazuslar ro'yxatiga qaytish
                    </button>
                    <div className="bg-gradient-to-r from-purple-600 to-violet-700 rounded-xl p-4 text-white">
                      <h2 className="text-sm font-black mb-1">{tanlanganToplam.mavzu}</h2>
                      <div className="flex flex-wrap gap-2 text-[10px] text-purple-100">
                        <span>Kod: <strong className="text-white">{tanlanganToplam.toplam_kod}</strong></span>
                        <span>{kazusJavoblar.length} javob</span>
                      </div>
                    </div>

                    {/* O'quvchilar */}
                    <div className="bg-white border-2 border-purple-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-purple-50"
                        onClick={() => setRosterOchiq(v => !v)}>
                        <div className="flex items-center gap-2">
                          <div className="bg-purple-100 p-1.5 rounded-lg"><Users className="h-3.5 w-3.5 text-purple-600" /></div>
                          <p className="font-black text-xs text-gray-800">O'quvchilar ro'yxati</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{rosterJadval.length} ta</span>
                          {rosterOchiq ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                        </div>
                      </div>
                      {rosterOchiq && (
                        <div className="border-t border-purple-100 max-h-48 overflow-y-auto">
                          {rosterJadval.map((j: any, idx: number) => (
                            <div key={j.id} className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 border-b border-purple-50 last:border-0">
                              <span className="w-5 text-center font-black text-[10px] text-gray-400">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs text-gray-800 truncate">{j.oquvchi_ismi}</p>
                                <p className="text-[9px] text-gray-400">{j.jami}/{j.maks} ball</p>
                              </div>
                              <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg ${
                                j.foiz >= 70 ? 'text-green-600 bg-green-50' : j.foiz >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
                              }`}>{j.foiz}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Kazus tahlil */}
                    {tanlanganToplam.kazuslar_tahlil?.length > 0 && (
                      <div className="bg-white border border-gray-100 rounded-xl p-3">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Kazus ball taqsimoti</p>
                        <ResponsiveContainer width="100%" height={90}>
                          <BarChart data={tanlanganToplam.kazuslar_tahlil.map((k: any) => ({ name: `K${k.kazus_index}`, ball: k.ortacha_ball }))} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} domain={[0, 30]} />
                            <Tooltip content={<CustomBarTooltip2 />} />
                            <Bar dataKey="ball" name="Ball" radius={[3, 3, 0, 0]}>
                              {tanlanganToplam.kazuslar_tahlil.map((k: any, i: number) => <Cell key={i} fill={k.ortacha_foiz >= 70 ? '#10b981' : k.ortacha_foiz >= 50 ? '#f59e0b' : '#ef4444'} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-2 space-y-1">
                          {tanlanganToplam.kazuslar_tahlil.map((k: any) => (
                            <div key={k.kazus_index} className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-500 w-6 font-mono">K{k.kazus_index}</span>
                              <div className="flex-1"><FoizBar2 foiz={k.ortacha_foiz} /></div>
                              {k.yetishmayotganlar?.length > 0 && (
                                <span className="text-[8px] text-orange-600 bg-orange-50 px-1 py-0.5 rounded truncate max-w-[70px]">❗{k.yetishmayotganlar[0]?.slice(0, 12)}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {tanlanganToplam.alochi_oquvchilar?.length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                        <p className="text-[9px] font-black text-emerald-600 uppercase mb-1.5">🏆 A'lochilar</p>
                        {tanlanganToplam.alochi_oquvchilar.slice(0, 3).map((o: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-700">{['🥇','🥈','🥉'][i]} {o.ism}</span>
                            <span className="font-black text-emerald-700">{o.foiz}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (!filteredToplamlar.length) return (
                <div className="text-center py-12 text-gray-400">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Hali kazus javoblari yo'q</p>
                </div>
              );
              return (
                <div className="space-y-2">
                  {filteredToplamlar.map((toplam: any) => (
                    <div key={toplam.toplam_kod}
                      className="bg-white border-2 border-gray-100 hover:border-purple-300 rounded-xl p-3 cursor-pointer transition-all group hover:shadow-sm"
                      onClick={() => toplamniOch(toplam)}>
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                          toplam.ortacha_foiz >= 70 ? 'bg-green-100 text-green-700' : toplam.ortacha_foiz >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>{toplam.ortacha_foiz}%</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 group-hover:text-purple-700 truncate">{toplam.mavzu}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono text-gray-400">#{toplam.toplam_kod}</span>
                            <span className="text-[9px] font-bold text-purple-600">{toplam.javoblar_soni} javob</span>
                          </div>
                          <FoizBar2 foiz={toplam.ortacha_foiz} />
                        </div>
                        <Brain className="h-4 w-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ══ MATERIALLAR TAB ══ */}
            {aktifTab === 'materiallar' && (() => {
              if (!materiallar.length) return (
                <div className="text-center py-12 text-gray-400">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Hali o'quv materiallar yo'q</p>
                </div>
              );
              const summary = data?.summary;
              return (
                <div className="space-y-2">
                  {summary && (
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStatCard label="Jami bo'lim" value={summary.jami_bolim || materiallar.length} icon={BookOpen} color="teal" />
                      <MiniStatCard label="Faol" value={summary.faol_bolim || materiallar.filter((m: any) => m.faol).length} icon={Eye} color="green" />
                      <MiniStatCard label="Ko'rishlar" value={summary.jami_korishlar || materiallar.reduce((s: number, m: any) => s + (m.korish_soni || 0), 0)} icon={Eye} color="blue" />
                      <MiniStatCard label="Eng ommabop" value={(summary.eng_ommabop || materiallar[0]?.bolim_nomi || '—').slice(0, 10)} color="amber" />
                    </div>
                  )}
                  {/* Trend */}
                  {summary?.trendData?.length > 0 && (
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Oxirgi 7 kun ko'rishlar</p>
                      <ResponsiveContainer width="100%" height={70}>
                        <BarChart data={summary.trendData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                          <XAxis dataKey="sana" tick={{ fontSize: 7, fill: '#94a3b8' }} />
                          <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} />
                          <Tooltip content={<CustomBarTooltip2 />} />
                          <Bar dataKey="soni" name="Ko'rishlar" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {materiallar.map((m: any, i: number) => {
                    const isOpen = tanlanganTest?.id === m.bolim_id;
                    const korishSoni = m.korish_soni || 0;
                    const signal = korishSoni >= 10 ? '🔥' : korishSoni >= 5 ? '🟢' : korishSoni > 0 ? '⚠️' : '⚪';
                    return (
                      <div key={m.bolim_id} className={`border-2 rounded-xl overflow-hidden transition-all ${
                        isOpen ? 'border-teal-300 shadow-sm' : 'border-gray-100 hover:border-teal-200'
                      }`}>
                        <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-teal-50 bg-white"
                          onClick={() => setTanlanganTest(isOpen ? null : { id: m.bolim_id })}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
                            style={{ background: APAL[i % APAL.length] + '20', color: APAL[i % APAL.length] }}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs text-gray-800 truncate">{m.bolim_nomi}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                m.faol ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              }`}>{m.faol ? 'Faol' : 'Yashirin'}</span>
                              <span className="text-[9px] text-gray-400">{m.bob_soni || 0} bob · {m.material_soni || 0} mat.</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 mr-2">
                            <p className="text-lg font-black" style={{ color: APAL[i % APAL.length] }}>{korishSoni} {signal}</p>
                            <p className="text-[8px] text-gray-400">ko'rish</p>
                          </div>
                          {m.korilgan_oquvchilar?.length > 0
                            ? isOpen ? <ChevronUp className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                            : <div className="w-3.5" />}
                        </div>
                        {isOpen && m.korilgan_oquvchilar?.length > 0 && (
                          <div className="border-t border-teal-100 bg-teal-50/30">
                            <div className="px-3 py-2 border-b border-teal-100">
                              <p className="text-[9px] font-black text-teal-700 uppercase">Ko'rgan o'quvchilar ({m.korilgan_oquvchilar.length} ta)</p>
                            </div>
                            <div className="divide-y divide-teal-50 max-h-36 overflow-y-auto">
                              {m.korilgan_oquvchilar.map((oq: string, oi: number) => (
                                <div key={oi} className="flex items-center gap-2 px-3 py-2 hover:bg-teal-100">
                                  <div className="w-6 h-6 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 font-black text-[9px]">{oq[0]}</div>
                                  <span className="flex-1 text-xs font-medium text-gray-700">{oq}</span>
                                  <Eye className="h-3 w-3 text-teal-400" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {isOpen && (!m.korilgan_oquvchilar || m.korilgan_oquvchilar.length === 0) && (
                          <div className="border-t border-gray-100 p-3 bg-gray-50 text-center">
                            <p className="text-[10px] text-gray-400">Hali hech kim ko'rmagan</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* AI Tavsiya */}
            {(aiLoading || aiTavsiya) && (
              <div className={`rounded-xl border-2 p-3 mt-1 ${
                aktifTab === 'testlar' ? 'bg-blue-50 border-blue-200' :
                aktifTab === 'kazuslar' ? 'bg-purple-50 border-purple-200' : 'bg-teal-50 border-teal-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center ${
                    aktifTab === 'testlar' ? 'bg-blue-600' : aktifTab === 'kazuslar' ? 'bg-purple-600' : 'bg-teal-600'
                  }`}><BrainCircuit className="h-3 w-3 text-white" /></div>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${
                    aktifTab === 'testlar' ? 'text-blue-700' : aktifTab === 'kazuslar' ? 'text-purple-700' : 'text-teal-700'
                  }`}>AI Pedagogik tavsiya</p>
                  {aiLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400 ml-auto" />}
                </div>
                {aiTavsiya && <p className={`text-xs leading-relaxed ${
                  aktifTab === 'testlar' ? 'text-blue-900' : aktifTab === 'kazuslar' ? 'text-purple-900' : 'text-teal-900'
                }`}>{aiTavsiya}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MATERIAL TAHLIL KARTA ────────────────────────────────────────────────────
interface MaterialTahlilKartaProps {
  analysis: MaterialAnalysis; fileInfo: { name: string; tur: string; size: number; file?: File };
  onConfirm: (edited: MaterialAnalysis) => void; isSaving?: boolean; saved?: boolean; onNavigate?: (tab: string) => void;
}

function MaterialTahlilKarta({ analysis, fileInfo, onConfirm, isSaving, saved, onNavigate }: MaterialTahlilKartaProps) {
  const [bolimNomi, setBolimNomi] = useState(analysis.bolim_nomi);
  const [bobNomi, setBobNomi] = useState(analysis.bob_nomi);
  const [materialNomi, setMaterialNomi] = useState(analysis.material_nomi);
  const [tavsif, setTavsif] = useState(analysis.tavsif || '');
  const [editing, setEditing] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const emoji: Record<string, string> = { html: '🌐', pdf: '📕', docx: '📄', audio: '🎵', video: '🎬' };
  const hajm = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  if (saved) return (
    <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Check className="h-5 w-5 text-green-600" /><p className="font-black text-green-800 text-sm">Material muvaffaqiyatli saqlandi!</p></div>
      <div className="bg-white rounded-xl p-3 border border-green-200 space-y-1.5 text-xs">
        <p className="text-gray-500">📁 <span className="font-bold text-gray-700">{fileInfo.name}</span></p>
        <p className="text-gray-500">Bo'lim: <span className="font-bold text-green-700">{bolimNomi}</span></p>
        <p className="text-gray-500">Bob: <span className="font-bold text-blue-700">{bobNomi}</span></p>
        <p className="text-[11px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">⚠️ faol=false • ommaviy=false — "Ommalashtirish" tugmasini bosguncha ko'rinmaydi</p>
      </div>
      <button onClick={() => onNavigate?.('ustoz')} className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all">
        <BookOpen className="h-3.5 w-3.5" /> O'quv materiallar kabinetiga o'tish
      </button>
    </div>
  );

  if (confirmed && !editing) return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 space-y-3">
      <p className="font-black text-blue-800 text-sm">📋 Tasdiqlash:</p>
      <div className="space-y-2 text-xs">{[{ l: "BO'LIM NOMI", v: bolimNomi }, { l: 'BOB NOMI', v: bobNomi }, { l: 'MATERIAL NOMI', v: materialNomi }, ...(tavsif ? [{ l: 'TAVSIF', v: tavsif }] : [])].map(({ l, v }) => (<div key={l} className="bg-white p-2.5 rounded-xl border border-blue-200"><p className="text-gray-400 font-bold mb-0.5 text-[10px]">{l}:</p><p className="text-gray-900 font-bold">{v}</p></div>))}</div>
      <div className="flex gap-2">
        <button onClick={() => setConfirmed(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">← Orqaga</button>
        <button onClick={() => onConfirm({ bolim_nomi: bolimNomi, bob_nomi: bobNomi, material_nomi: materialNomi, tavsif, mavzu: analysis.mavzu, ishonch: analysis.ishonch })} disabled={isSaving} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-xs font-black">
          {isSaving ? <><Loader2 className="h-3 w-3 animate-spin" />Saqlanmoqda...</> : '✅ Tasdiqlayman va Saqlash'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-2.5 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4" /><p className="font-black text-sm">AI Material Tahlili</p>
        <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{analysis.ishonch || 85}% ishonch</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="bg-white border border-teal-200 rounded-xl p-2.5 flex items-center gap-2.5">
          <span className="text-2xl">{emoji[fileInfo.tur] || '📁'}</span>
          <div className="min-w-0"><p className="text-xs font-bold text-gray-800 truncate">{fileInfo.name}</p><p className="text-[10px] text-gray-400">{hajm(fileInfo.size)} • {fileInfo.tur.toUpperCase()}</p></div>
        </div>
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-black text-teal-600 uppercase tracking-wider">🤖 AI taklifi:</p>
          {editing ? (
            <div className="space-y-2">
              {([{ label: "Bo'lim nomi:", val: bolimNomi, set: setBolimNomi }, { label: 'Bob nomi:', val: bobNomi, set: setBobNomi }, { label: 'Material nomi:', val: materialNomi, set: setMaterialNomi }] as { label: string; val: string; set: (v: string) => void }[]).map(({ label, val, set }) => (
                <div key={label}><label className="text-[10px] font-black text-teal-700 mb-1 block">{label}</label><input value={val} onChange={e => set(e.target.value)} className="w-full px-3 py-2 border-2 border-teal-300 rounded-xl text-xs focus:outline-none focus:border-teal-500" /></div>
              ))}
              <div><label className="text-[10px] font-black text-teal-700 mb-1 block">Bo'lim tavsifi (max 25 so'z):</label><textarea value={tavsif} onChange={e => setTavsif(e.target.value)} rows={2} className="w-full px-3 py-2 border-2 border-teal-300 rounded-xl text-xs resize-none focus:outline-none focus:border-teal-500" /></div>
              <button onClick={() => setEditing(false)} className="w-full py-2 bg-teal-600 text-white rounded-xl text-xs font-black">✅ Tahrirlashni tugatish</button>
            </div>
          ) : (
            <div className="space-y-1.5">{([{ label: "BO'LIM:", val: bolimNomi }, { label: 'BOB:', val: bobNomi }, { label: 'MATERIAL:', val: materialNomi }, ...(tavsif ? [{ label: 'TAVSIF:', val: tavsif }] : [])] as { label: string; val: string }[]).map(({ label, val }) => (<div key={label} className="flex items-start gap-2"><span className="text-[10px] font-black text-teal-600 w-20 flex-shrink-0 mt-0.5">{label}</span><span className="text-xs text-gray-800 font-bold">{val}</span></div>))}</div>
          )}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"><p className="text-[10px] text-amber-700 font-bold">⚠️ Saqlangach: <strong>faol=false</strong> • <strong>ommaviy=false</strong></p></div>
        {!editing && <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-1.5 py-2.5 bg-white border-2 border-teal-300 hover:bg-teal-50 text-teal-700 rounded-xl text-xs font-bold transition-all"><Edit2 className="h-3.5 w-3.5" /> Tahrirlash</button>
          <button onClick={() => setConfirmed(true)} className="flex items-center justify-center gap-1.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all active:scale-95">✅ Tasdiqlayman</button>
        </div>}
      </div>
    </div>
  );
}

// ─── KAZUS YARATISH FORMA ─────────────────────────────────────────────────────
interface KazusYaratishFormaProps {
  onSave: (data: { savol: string; javob: string; mavzu: string; modelTur: string; allowRetake: boolean; vaqtDaqiqa: number }) => void;
  isSaving?: boolean;
}
function KazusYaratishForma({ onSave, isSaving }: KazusYaratishFormaProps) {
  const [savol, setSavol] = useState(''); const [javob, setJavob] = useState(''); const [mavzu, setMavzu] = useState('');
  const [modelTur, setModelTur] = useState<'oddiy' | 'protsesual'>('oddiy'); const [allowRetake, setAllowRetake] = useState(false);
  const [vaqtDaqiqa, setVaqtDaqiqa] = useState(30); const [tasdiqlandi, setTasdiqlandi] = useState(false); const [sozlamalarOchiq, setSozlamalarOchiq] = useState(false);
  const inputBase = 'w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 resize-none focus:outline-none focus:border-emerald-400 transition-all placeholder-gray-400 leading-relaxed';
  return (
    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 flex items-center gap-2"><PlusSquare className="h-4 w-4" /><p className="font-black text-sm">Yangi Kazus Yaratish</p><span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full">AI yordamchingiz</span></div>
      <div className="p-3 space-y-3">
        <div className="bg-white border border-emerald-200 rounded-xl px-3 py-2 text-[10px] text-emerald-800 leading-relaxed"><p className="font-bold mb-0.5">ℹ️ Ko'rsatmalar:</p><p>• <strong>Kazus matni</strong> — o'quvchiga beriladigan savol/vaziyat</p><p>• <strong>Model javob</strong> — to'g'ri javob (AI baholash uchun)</p><p>• Saqlangach <strong>is_active=false</strong> va <strong>ommaviy=false</strong></p></div>
        <div><label className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-1 block">📋 1. Kazus matni <span className="text-red-500">*</span></label><textarea value={savol} onChange={e => setSavol(e.target.value)} rows={5} className={inputBase} placeholder="Masalan: Fuqaro A 2023-yil may oyida davlat mulkini o'zlashtirganlikda gumonlanmoqda..." /><p className="text-[9px] text-gray-400 mt-0.5">{savol.length} belgi</p></div>
        <div><label className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-1 block">✅ 2. Model javob <span className="text-red-500">*</span></label><textarea value={javob} onChange={e => setJavob(e.target.value)} rows={5} className={inputBase} placeholder="O'zbekiston Respublikasi JK 167-moddasi bo'yicha..." /><p className="text-[9px] text-gray-400 mt-0.5">{javob.length} belgi</p></div>
        <div><label className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-1 block">🏷️ Mavzu nomi</label><input type="text" value={mavzu} onChange={e => setMavzu(e.target.value)} placeholder="Masalan: Korrupsiya va jinoyiy javobgarlik" className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-emerald-400 transition-all placeholder-gray-400" /></div>
        <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
          <button onClick={() => setSozlamalarOchiq(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50 transition-all"><span>⚙️ Qo'shimcha sozlamalar</span><ChevronDown className={`h-3.5 w-3.5 transition-transform ${sozlamalarOchiq ? 'rotate-180' : ''}`} /></button>
          {sozlamalarOchiq && <div className="border-t border-emerald-100 p-3 space-y-2">
            <button onClick={() => setAllowRetake(v => !v)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${allowRetake ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-emerald-200'}`}>{allowRetake ? <CheckSquare className="h-3.5 w-3.5 flex-shrink-0" /> : <Square className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />}<div className="text-left"><span className="block">Qayta yechishga ruxsat berish</span><span className="text-[10px] font-normal text-gray-400">Talaba kazusni bir necha bor qaytadan topshira oladi</span></div></button>
            <div><p className="text-[10px] font-bold text-gray-500 mb-1">Kazus modeli:</p><div className="grid grid-cols-2 gap-1.5">{(['oddiy', 'protsesual'] as const).map(t => (<button key={t} onClick={() => setModelTur(t)} className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border-2 transition-all ${modelTur === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'}`}>{t === 'oddiy' ? '📝 Oddiy' : '📄 Protsesual'}</button>))}</div></div>
            <div><label className="text-[10px] font-bold text-gray-500 mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> Vaqt (daqiqa):</label><input type="number" min={1} max={180} value={vaqtDaqiqa} onChange={e => setVaqtDaqiqa(Math.max(1, Math.min(180, Number(e.target.value) || 30)))} className="w-24 bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-400 text-center" /></div>
          </div>}
        </div>
        {!tasdiqlandi ? (
          <button onClick={() => setTasdiqlandi(true)} disabled={!savol.trim() || !javob.trim()} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all active:scale-95">{!savol.trim() || !javob.trim() ? "⚠️ Kazus matni va javobni to'ldiring" : "✅ Ko'rib chiqish va saqlash"}</button>
        ) : (
          <div className="bg-teal-50 border-2 border-teal-300 rounded-xl p-3 space-y-2">
            <p className="text-xs font-black text-teal-800">📋 Saqlashdan oldin tekshiring:</p>
            <div className="text-[11px] text-gray-700 space-y-0.5"><p>• <strong>Mavzu:</strong> {mavzu || 'Mavzusiz'}</p><p>• <strong>Savol:</strong> {savol.slice(0, 60)}{savol.length > 60 ? '...' : ''}</p><p>• <strong>Model tur:</strong> {modelTur} | <strong>Vaqt:</strong> {vaqtDaqiqa} daqiqa</p><p>• <strong>Holat:</strong> Yashirin (is_active=false, ommaviy=false)</p></div>
            <div className="flex gap-2">
              <button onClick={() => setTasdiqlandi(false)} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold">← O'zgartirish</button>
              <button onClick={() => onSave({ savol: savol.trim(), javob: javob.trim(), mavzu: mavzu.trim() || 'Mavzusiz', modelTur, allowRetake, vaqtDaqiqa: vaqtDaqiqa || 30 })} disabled={isSaving} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5">{isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saqlanmoqda...</> : '💾 Bazaga saqlash'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KAZUS SAQLANGAN KARTA ────────────────────────────────────────────────────
function KazusSaqlangandKarta({ kod, onStart, onPublish }: { kod: string; onStart: (k: string) => void; onPublish: (k: string) => void }) {
  return (
    <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-600" /><p className="font-black text-emerald-800 text-sm">Kazus muvaffaqiyatli saqlandi!</p></div>
      <div className="bg-white rounded-xl p-3 border border-emerald-200"><p className="text-xs text-gray-500 mb-1">Kazus kodi:</p><p className="text-3xl font-black text-emerald-700 tracking-widest">{kod}</p><p className="text-xs text-gray-400 mt-1">is_active=false • ommaviy=false</p></div>
      <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2.5 border border-amber-200">⚠️ Kazus hali yashirin. Faollashtirish uchun quyidagi tugmalarni bosing.</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onStart(kod)} className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"><Play className="h-3.5 w-3.5" />START</button>
        <button onClick={() => onPublish(kod)} className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"><Globe className="h-3.5 w-3.5" />Ommalashtirish</button>
      </div>
    </div>
  );
}

// ─── WORD TEST NATIJA KARTASI ─────────────────────────────────────────────────
interface WordTestCardProps {
  parsedData: WordParsedTest; onSave: (allowRetake: boolean, showCorrect: boolean) => void;
  savedKod?: string; onStartTest?: (k: string) => void; onPublish?: (k: string) => void; isSaving?: boolean;
}
function WordTestCard({ parsedData, onSave, savedKod, onStartTest, onPublish, isSaving }: WordTestCardProps) {
  const [allowRetake, setAllowRetake] = useState(false); const [showCorrect, setShowCorrect] = useState(true); const [confirmed, setConfirmed] = useState(false);
  if (savedKod) return (
    <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2"><Check className="h-5 w-5 text-green-600" /><p className="font-black text-green-800 text-sm">Test muvaffaqiyatli saqlandi!</p></div>
      <div className="bg-white rounded-xl p-3 border border-green-200"><p className="text-xs text-gray-500 mb-1">Test kodi:</p><p className="text-3xl font-black text-green-700 tracking-widest">{savedKod}</p><p className="text-xs text-gray-400 mt-1">{parsedData.savollar.length} ta savol • is_active=false • ommaviy=false</p></div>
      <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2.5 border border-amber-200">⚠️ Test hali yashirin. Faollashtirish uchun quyidagi tugmalarni bosing.</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onStartTest?.(savedKod)} className="flex items-center justify-center gap-1.5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"><Play className="h-3.5 w-3.5" />START</button>
        <button onClick={() => onPublish?.(savedKod)} className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"><Globe className="h-3.5 w-3.5" />Ommalashtirish</button>
      </div>
    </div>
  );
  if (confirmed) return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4 space-y-3">
      <p className="font-black text-blue-800 text-sm">✅ Sozlamalar belgilandi</p>
      <div className="space-y-1.5 text-xs">{[{ state: allowRetake, label: "Qayta yechishga ruxsat" }, { state: showCorrect, label: "To'g'ri javobni ko'rsatish" }].map(({ state, label }) => (<div key={label} className="flex items-center gap-2">{state ? <CheckSquare className="h-3.5 w-3.5 text-blue-600" /> : <Square className="h-3.5 w-3.5 text-gray-400" />}<span className={state ? 'text-blue-700 font-semibold' : 'text-gray-500'}>{label}</span></div>))}</div>
      <button onClick={() => onSave(allowRetake, showCorrect)} disabled={isSaving} className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2">{isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saqlanmoqda...</> : '💾 Testni saqlash (bazaga)'}</button>
    </div>
  );
  return (
    <div className="bg-violet-50 border-2 border-violet-300 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between"><p className="font-black text-violet-800 text-sm">📝 {parsedData.savollar.length} ta savol ajratildi</p><span className="text-xs bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold border border-violet-200">{parsedData.testNomi.slice(0, 20)}</span></div>
      <div className="max-h-40 overflow-y-auto space-y-1.5">{parsedData.savollar.slice(0, 5).map((s, i) => (<div key={i} className="bg-white rounded-lg p-2 border border-violet-200 text-xs"><p className="font-semibold text-gray-800 truncate">{i + 1}. <span dangerouslySetInnerHTML={{ __html: s.savol }} /></p><div className="flex gap-1 mt-1 flex-wrap">{s.variantlar.map((v, vi) => (<span key={vi} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.togriJavob === vi ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500'}`}>{String.fromCharCode(65 + vi)})</span>))}</div></div>))}{parsedData.savollar.length > 5 && <p className="text-xs text-violet-500 text-center py-1">... va yana {parsedData.savollar.length - 5} ta savol</p>}</div>
      <div className="bg-white border border-violet-200 rounded-xl p-3 space-y-2">
        <p className="text-xs font-black text-gray-600 mb-2">Sozlamalarni belgilang:</p>
        <button onClick={() => setAllowRetake(!allowRetake)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${allowRetake ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-200'}`}>{allowRetake ? <CheckSquare className="h-3.5 w-3.5 flex-shrink-0" /> : <Square className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />}Qayta yechishga ruxsat berish</button>
        <button onClick={() => setShowCorrect(!showCorrect)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${showCorrect ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-green-200'}`}>{showCorrect ? <CheckSquare className="h-3.5 w-3.5 flex-shrink-0" /> : <Square className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />}To'g'ri javobni ko'rsatish</button>
      </div>
      <button onClick={() => setConfirmed(true)} className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black transition-all active:scale-95">✅ Tasdiqlash va Saqlashga tayyor</button>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface MentorChatBotProps {
  activeTab?: string;
  onNavigate?: (tab: string, extra?: { kod?: string; tur?: 'test' | 'kazus'; materialId?: string }) => void;
}

export default function MentorChatBot({ activeTab, onNavigate }: MentorChatBotProps) {
  const { user, isAuthenticated } = useAuth();
  const [ochiq, setOchiq] = useState(false);
  const [kichik, setKichik] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [yuklanyapti, setYuklanyapti] = useState(false);
  const [studentCtx, setStudentCtx] = useState<StudentContext>({});
  const [ctxYuklandi, setCtxYuklandi] = useState(false);
  const [ctxYuklanyapti, setCtxYuklanyapti] = useState(false);
  const [plusMenuOchiq, setPlusMenuOchiq] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const [mentorFaol, setMentorFaol] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [wordParsing, setWordParsing] = useState(false);
  const [testSaving, setTestSaving] = useState(false);
  const wordFileRef = useRef<HTMLInputElement>(null);
  const [kazusSaving, setKazusSaving] = useState(false);
  const [materialAnalyzing, setMaterialAnalyzing] = useState(false);
  const [materialSaving, setMaterialSaving] = useState(false);
  const materialFileRef = useRef<HTMLInputElement>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [analyticsType, setAnalyticsType] = useState<'testlar' | 'kazuslar' | 'materiallar'>('testlar');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [aiTavsiya, setAiTavsiya] = useState('');
  const [aiTavsiyaLoading, setAiTavsiyaLoading] = useState(false);
  const [wideMode, setWideMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyticsCacheRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) setPlusMenuOchiq(false); };
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler);
  }, []);
  useEffect(() => { pulseTimerRef.current = setInterval(() => setPulse(p => !p), 4000); return () => { if (pulseTimerRef.current) clearInterval(pulseTimerRef.current); }; }, []);
  useEffect(() => { supabase.from('settings').select('value').eq('key', 'AI_MENTOR_FAOL').maybeSingle().then(({ data }) => setMentorFaol(data?.value ?? true)); }, []);
  useEffect(() => { if (ochiq && isAuthenticated && user && !ctxYuklandi) studentContextYuklash(); }, [ochiq, isAuthenticated, user]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (ochiq && !kichik && !analyticsOpen) setTimeout(() => inputRef.current?.focus(), 150); }, [ochiq, kichik, analyticsOpen]);
  useEffect(() => { if (!ochiq && messages.length > 0) { const last = messages[messages.length - 1]; if (last.role === 'model') setUnreadCount(c => c + 1); } }, [messages.length]);
  useEffect(() => { if (!(window as any).mammoth) { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'; document.head.appendChild(s); } }, []);

  const isUstozMode = user?.rol === 'ustoz';

  // ─── ANALYTICS ────────────────────────────────────────────────────────────
  const buildAnalyticsSummary = (type: string, data: any): string => {
    if (!data) return '';
    if (type === 'testlar') { const t = data.testlar || []; if (!t.length) return ''; const low = t.filter((x: any) => x.ortacha_foiz < 60); return `Jami ${t.length} test. O'rtacha ${data.summary?.umumiy_ortacha || 0}%. Past natijali: ${low.map((x: any) => x.test_nomi + ' ' + x.ortacha_foiz + '%').join(', ') || "yo'q"}.`; }
    if (type === 'kazuslar') { const t = data.toplamlar || []; if (!t.length) return ''; const low = t.filter((x: any) => x.ortacha_foiz < 60); return `Jami ${t.length} kazus. O'rtacha ${data.summary?.umumiy_ortacha || 0}%. Past natijali: ${low.map((x: any) => x.mavzu + ' ' + x.ortacha_foiz + '%').join(', ') || "yo'q"}.`; }
    if (type === 'materiallar') { const m = data.materiallar || []; if (!m.length) return ''; return `Jami ${m.length} bo'lim. Faol: ${data.summary?.faol_bolim || 0}. Ko'rishlar: ${data.summary?.jami_korishlar || 0}. Eng ommabop: ${data.summary?.eng_ommabop || '—'}.`; }
    return '';
  };

  const fetchAnalytics = useCallback(async (type: 'testlar' | 'kazuslar' | 'materiallar') => {
    if (!user?.ustoz_id || user?.rol !== 'ustoz') return;
    if (analyticsCacheRef.current[type]) { setAnalyticsData(analyticsCacheRef.current[type]); return; }
    setAnalyticsLoading(true); setAnalyticsData(null); setAiTavsiya('');
    try {
      const { data, error } = await supabase.functions.invoke('mentor-chat', { body: { messages: [{ role: 'user', parts: [{ text: 'analytics' }] }], mode: 'analytics_fetch', ustozId: user.ustoz_id, ustozIsmi: `${user.ism} ${user.familiya}`, analyticsType: type } });
      if (error) throw error;
      const result = data?.data || {};
      analyticsCacheRef.current[type] = result; setAnalyticsData(result);
      setAiTavsiyaLoading(true);
      const summary = buildAnalyticsSummary(type, result);
      if (summary) {
        const { data: aiData } = await supabase.functions.invoke('mentor-chat', { body: { messages: [{ role: 'user', parts: [{ text: `Ustoz uchun ${type} analitikasi:\n${summary}\n\nQisqa, aniq, amaliy pedagogik tavsiya yoz (max 3 gap, o'zbek tilida).` }] }], mode: 'chat', ustozId: user.ustoz_id, ustozIsmi: `${user.ism} ${user.familiya}` } });
        if (aiData?.reply) setAiTavsiya(aiData.reply.slice(0, 400));
      }
    } catch (e) { console.error('[analytics fetch]', e); } finally { setAnalyticsLoading(false); setAiTavsiyaLoading(false); }
  }, [user]);

  const openAnalytics = (type: 'testlar' | 'kazuslar' | 'materiallar') => {
    if (!isUstozMode || !user?.ustoz_id) return;
    setAnalyticsOpen(true); setAnalyticsType(type); setWideMode(true); setAiTavsiya(''); fetchAnalytics(type);
  };
  const handleAnalyticsTypeChange = (type: 'testlar' | 'kazuslar' | 'materiallar') => { setAnalyticsType(type); setAiTavsiya(''); fetchAnalytics(type); };

  // ─── STUDENT CONTEXT ──────────────────────────────────────────────────────
  const studentContextYuklash = async (_majburiy = false) => {
    if (!user) return;
    const loginId = user.login || ''; setCtxYuklanyapti(true);
    const oquvchiIsm = `${user.ism} ${user.familiya}`;
    const ctx: StudentContext = { ism: user.ism, familiya: user.familiya, kurs: user.kurs, guruh: user.guruh, loginId, joriySahifa: getSahifaNomi(activeTab || 'haqida') };
    try {
      let talabaProm: Promise<any> = Promise.resolve(null); let reytingProm: Promise<any> = Promise.resolve(null);
      if (user.rol === 'oquvchi' && loginId) { talabaProm = supabase.from('talabalar').select('total_xp, current_level, badges').eq('login_id', loginId).maybeSingle(); reytingProm = supabase.from('talabalar').select('login_id, total_xp').order('total_xp', { ascending: false }).limit(300); }
      let testJavoblarProm: Promise<any> = Promise.resolve({ data: [] }); let kazusJavoblarProm: Promise<any> = Promise.resolve({ data: [] }); let korishlarProm: Promise<any> = Promise.resolve({ data: [] });
      if (user.rol === 'oquvchi') { testJavoblarProm = supabase.from('test_javoblar').select('test_kod, togri_soni, xato_soni, javob_berilmagan, foiz, javoblar, sarflangan_vaqt, created_at').eq('oquvchi_ismi', oquvchiIsm).order('created_at', { ascending: false }).limit(15); kazusJavoblarProm = supabase.from('javoblar').select('toplam_kod, baho, javoblar, created_at').eq('oquvchi_ismi', oquvchiIsm).order('created_at', { ascending: false }).limit(8); korishlarProm = supabase.from('om_korishlar').select('bolim_id').eq('oquvchi_ismi', oquvchiIsm).order('created_at', { ascending: false }).limit(5); }
      const omTP = supabase.from('testlar').select('kod, test_nomi, is_active').eq('ommaviy', true).order('created_at', { ascending: false }).limit(25);
      const omKP = supabase.from('toplamlar').select('kod, mavzu, is_active').eq('ommaviy', true).order('created_at', { ascending: false }).limit(25);
      const omBP = supabase.from('om_bolimlar').select('id, nomi').eq('faol', true).eq('admin_bloklangan', false).order('tartib', { ascending: true }).limit(30);
      const sjBP = supabase.from('sj_bolimlar').select('id, nomi').eq('faol', true).order('tartib', { ascending: true }).limit(15);
      const [taS, reS, tjS, kjS, krS, otS, okS, omBS, sjBS] = await Promise.all([talabaProm, reytingProm, testJavoblarProm, kazusJavoblarProm, korishlarProm, omTP, omKP, omBP, sjBP]);
      if (taS?.data) { ctx.totalXp = taS.data.total_xp || 0; ctx.currentLevel = taS.data.current_level || 1; ctx.badges = Array.isArray(taS.data.badges) ? taS.data.badges as string[] : []; }
      if (reS?.data) { const orni = (reS.data as any[]).findIndex(r => r.login_id === loginId); if (orni >= 0) ctx.reytingOrni = orni + 1; }
      if (user.rol === 'oquvchi') {
        const testJavoblar = tjS?.data || [];
        if (testJavoblar.length > 0) {
          const testKodlar = [...new Set(testJavoblar.map((t: any) => t.test_kod))] as string[];
          const { data: tDB } = await supabase.from('testlar').select('kod, test_nomi, savollar').in('kod', testKodlar);
          const testMap: Record<string, any> = {}; (tDB || []).forEach((t: any) => { testMap[t.kod] = t; });
          const allT: any[] = [];
          for (const j of testJavoblar) {
            const test = testMap[j.test_kod]; const savollar: any[] = test?.savollar || [];
            const savolSoni = savollar.length || (j.togri_soni + j.xato_soni + (j.javob_berilmagan || 0));
            const xatoMavzular: string[] = []; const xatoSavollar: { savol: string; togriJavob: string }[] = [];
            if (savollar.length > 0 && Array.isArray(j.javoblar)) {
              (j.javoblar as any[]).forEach((jav: any) => {
                const idx = jav.savol_index !== undefined ? jav.savol_index : jav.index; if (idx === undefined || idx === null) return;
                const savol = savollar[idx]; if (!savol) return;
                const bJ = jav.javob !== undefined ? jav.javob : jav.answer; const tJ = savol.togriJavob !== undefined ? savol.togriJavob : savol.correctAnswer;
                if ((bJ === undefined || bJ === -1 || bJ !== tJ) && savol.savol) { xatoMavzular.push(savol.savol.slice(0, 80)); let togriMatn = ''; if (Array.isArray(savol.variantlar) && tJ !== undefined) { const v = savol.variantlar[tJ]; togriMatn = typeof v === 'string' ? v : (v?.matn || v?.text || String(v || '')); } if (togriMatn) xatoSavollar.push({ savol: savol.savol.slice(0, 100), togriJavob: togriMatn.slice(0, 100) }); }
              });
            }
            allT.push({ testKod: j.test_kod, testNomi: test?.test_nomi || j.test_kod, foiz: j.foiz || 0, togriSoni: j.togri_soni || 0, xatoSoni: j.xato_soni || 0, savolSoni, xatoMavzular: xatoMavzular.slice(0, 7), xatoSavollar: xatoSavollar.slice(0, 5), sana: j.created_at ? new Date(j.created_at).toLocaleDateString('uz-UZ') : undefined });
          }
          ctx.testNatijalari = testJavoblar.map((j: any) => { const t = allT.find(a => a.testKod === j.test_kod); if (!t) return null; return { testNomi: t.testNomi, foiz: t.foiz, togriSoni: t.togriSoni, xatoSoni: t.xatoSoni, savolSoni: t.savolSoni, xatoMavzular: t.xatoMavzular, xatoSavollar: t.xatoSavollar, sana: t.sana }; }).filter(Boolean) as any[];
          const zaif: string[] = []; const kuchli: string[] = [];
          ctx.testNatijalari!.forEach(t => { if (t.foiz < 60) zaif.push(`${t.testNomi} (${t.foiz}%)`); else if (t.foiz >= 80) kuchli.push(`${t.testNomi} (${t.foiz}%)`); });
          if (zaif.length) ctx.zaifFanlar = zaif; if (kuchli.length) ctx.kuchliFantlar = kuchli;
        }
        const kazusJavoblar = kjS?.data || [];
        if (kazusJavoblar.length > 0) {
          const kodlar2 = [...new Set(kazusJavoblar.map((j: any) => j.toplam_kod))] as string[];
          const { data: toplamlar } = await supabase.from('toplamlar').select('kod, mavzu').in('kod', kodlar2);
          const tMap: Record<string, any> = {}; (toplamlar || []).forEach((t: any) => { tMap[t.kod] = t; });
          ctx.kazusNatijalari = kazusJavoblar.map((j: any) => { const baho = Array.isArray(j.baho) ? j.baho : []; const toplamBall = baho.reduce((s: number, b: any) => s + (b.ball || 0), 0); const maksimalBall = baho.length * 30; const foiz = maksimalBall > 0 ? Math.round((toplamBall / maksimalBall) * 100) : 0; return { mavzu: tMap[j.toplam_kod]?.mavzu || j.toplam_kod, ball: toplamBall, maksimalBall, foiz, kazuslarTafsiloti: baho.map((b: any) => ({ index: b.kazus_index + 1, ball: b.ball || 0, izoh: b.izoh?.slice(0, 120) || '' })).slice(0, 5), xatoKazuslar: baho.filter((b: any) => (b.ball || 0) < 15).map((b: any) => ({ mavzu: `Kazus ${b.kazus_index + 1}`, ball: b.ball || 0 })), sana: j.created_at ? new Date(j.created_at).toLocaleDateString('uz-UZ') : undefined }; });
        }
        const korishlar = krS?.data || [];
        if (korishlar.length > 0) { const bolimIds = korishlar.map((k: any) => k.bolim_id); const { data: bolimlar } = await supabase.from('om_bolimlar').select('id, nomi').in('id', bolimIds); const bMap: Record<string, string> = {}; (bolimlar || []).forEach((b: any) => { bMap[b.id] = b.nomi; }); ctx.korilganMateriallar = korishlar.map((k: any) => ({ bolimNomi: bMap[k.bolim_id] || "Noma'lum", bobNomi: '' })); }
      }
      if ((otS?.data || []).length > 0) ctx.mavjudTestlar = (otS.data as any[]).map(t => ({ nomi: t.test_nomi, kod: t.kod, faol: t.is_active || false }));
      if ((okS?.data || []).length > 0) ctx.mavjudKazuslar = (okS.data as any[]).map(k => ({ mavzu: k.mavzu || k.kod, kod: k.kod, faol: k.is_active || false }));
      if ((omBS?.data || []).length > 0) { const { data: omM } = await supabase.from('om_materiallar').select('id, nomi, bolim_id').order('tartib', { ascending: true }).limit(100); const bMap: Record<string, string> = {}; (omBS.data || []).forEach((b: any) => { bMap[b.id] = b.nomi; }); ctx.mavjudMateriallar = (omM || []).map((m: any) => ({ nomi: bMap[m.bolim_id] ? `${bMap[m.bolim_id]} — ${m.nomi}` : m.nomi, id: m.id })); }
      const sjBolimlar = sjBS?.data || [];
      if (sjBolimlar.length > 0) { const bolimIds = (sjBolimlar as any[]).map((b: any) => b.id); const { data: savollar } = await supabase.from('sj_savollar').select('bolim_id').in('bolim_id', bolimIds); const sMap: Record<string, number> = {}; (savollar || []).forEach((s: any) => { sMap[s.bolim_id] = (sMap[s.bolim_id] || 0) + 1; }); ctx.savol_javob_bolimlar = (sjBolimlar as any[]).map((b: any) => ({ nomi: b.nomi, savolSoni: sMap[b.id] || 0 })); }
    } catch (e) { console.warn('[MentorChatBot] Context xatosi:', e); }
    setStudentCtx(ctx); setCtxYuklandi(true); setCtxYuklanyapti(false);
  };

  // ─── WORD FAYL ────────────────────────────────────────────────────────────
  const handleWordFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || user?.rol !== 'ustoz') return;
    e.target.value = ''; setWordParsing(true);
    setMessages(prev => [...prev, { role: 'user', parts: [{ text: `📎 Word fayl yuklandi: ${file.name}` }], timestamp: Date.now() }]);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const arrayBuffer = ev.target?.result as ArrayBuffer;
        const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
        const savollar = parseWordHtmlToTests(result.value);
        if (savollar.length === 0) { setMessages(prev => [...prev, { role: 'model', parts: [{ text: "⚠️ Word fayldan test topilmadi. Format: `1. Savol...` va `A) Variant...` bo'lishi kerak." }], timestamp: Date.now() }]); setWordParsing(false); return; }
        const testNomi = file.name.replace(/\.docx?$/i, '').replace(/_/g, ' ').trim() || 'Yangi test';
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `✅ **${savollar.length} ta savol ajratildi!**\n\nTest nomi: **${testNomi}**\n\nSozlamalarni belgilab, testni bazaga saqlang.` }], timestamp: Date.now(), isWordResult: true, wordParsedData: { savollar, testNomi } }]);
      } catch (err: any) { setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ Word faylni o'qishda xatolik: ${err.message}` }], timestamp: Date.now() }]); }
      finally { setWordParsing(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  // ─── MATERIAL FAYL ────────────────────────────────────────────────────────
  const handleMaterialFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || user?.rol !== 'ustoz') return;
    e.target.value = '';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const faylTur = ['html','htm'].includes(ext) ? 'html' : ext === 'pdf' ? 'pdf' : ['doc','docx'].includes(ext) ? 'docx' : ['mp3','wav','ogg','m4a'].includes(ext) ? 'audio' : ['mp4','webm','ogv','mov'].includes(ext) ? 'video' : 'other';
    if (faylTur === 'other') { setMessages(prev => [...prev, { role: 'model', parts: [{ text: "⚠️ Bu fayl turi qo'llab-quvvatlanmaydi. HTML, PDF, Word, Audio yoki Video yuklang." }], timestamp: Date.now() }]); return; }
    setMessages(prev => [...prev, { role: 'user', parts: [{ text: `📚 O'quv material yuklandi: ${file.name}` }], timestamp: Date.now() }]);
    setMaterialAnalyzing(true);
    try {
      let materialMatn = '';
      if (faylTur === 'html') { const text = await file.text(); const doc = new DOMParser().parseFromString(text, 'text/html'); materialMatn = (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000); }
      else if (faylTur === 'docx') { if (!(window as any).mammoth) { await new Promise(r => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'; s.onload = r; document.head.appendChild(s); }); } const buf = await file.arrayBuffer(); const result = await (window as any).mammoth.convertToHtml({ arrayBuffer: buf }); const doc = new DOMParser().parseFromString(result.value, 'text/html'); materialMatn = (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000); }
      const { data, error } = await supabase.functions.invoke('mentor-chat', { body: { messages: [{ role: 'user', parts: [{ text: `Material: ${file.name}` }] }], mode: 'material_tahlil', materialMatn, faylNom: file.name, faylTur } });
      if (error || !data?.parsed) throw new Error(error?.message || 'AI tahlil natijalari olinmadi');
      const analysis: MaterialAnalysis = data.parsed;
      if (!analysis.material_nomi) analysis.material_nomi = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `📊 **Material tahlil qilindi!**\n\nAI quyidagi struktura taklif qilmoqda. Tasdiqlang yoki tahrirlang:` }], timestamp: Date.now(), isMaterialAnalysis: true, materialAnalysisData: analysis, materialAnalysisFile: { name: file.name, tur: faylTur, size: file.size, file } }]);
    } catch (err: any) { setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ Material tahlilida xatolik: ${err.message}` }], timestamp: Date.now() }]); }
    finally { setMaterialAnalyzing(false); }
  };

  // ─── MATERIAL SAQLASH ─────────────────────────────────────────────────────
  const handleSaveMaterial = async (msgIndex: number, analysis: MaterialAnalysis, fileInfo: { name: string; tur: string; size: number; file?: File }) => {
    if (!user?.ustoz_id || !fileInfo.file) return; setMaterialSaving(true);
    try {
      const { data: exB } = await supabase.from('om_bolimlar').select('id').eq('ustoz_id', user.ustoz_id).ilike('nomi', analysis.bolim_nomi.trim()).maybeSingle();
      let bolimId: string;
      if (exB?.id) { bolimId = exB.id; } else { const { data: nB, error: bErr } = await supabase.from('om_bolimlar').insert({ ustoz_id: user.ustoz_id, ustoz_ismi: `${user.ism} ${user.familiya}`, nomi: analysis.bolim_nomi.trim(), tavsif: analysis.tavsif?.trim() || null, faol: false, tartib: 0, admin_bloklangan: false }).select('id').single(); if (bErr || !nB) throw bErr || new Error("Bo'lim yaratilmadi"); bolimId = nB.id; }
      const { data: exBob } = await supabase.from('om_boblar').select('id').eq('bolim_id', bolimId).ilike('nomi', analysis.bob_nomi.trim()).maybeSingle();
      let bobId: string;
      if (exBob?.id) { bobId = exBob.id; } else { const { data: nBob, error: bobErr } = await supabase.from('om_boblar').insert({ bolim_id: bolimId, nomi: analysis.bob_nomi.trim(), tartib: 0, yashirin: false }).select('id').single(); if (bobErr || !nBob) throw bobErr || new Error('Bob yaratilmadi'); bobId = nBob.id; }
      const path = `${bolimId}/${bobId}/${Date.now()}_${fileInfo.file.name}`;
      const { error: upErr } = await supabase.storage.from('oq-materiallar').upload(path, fileInfo.file, { upsert: true }); if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('oq-materiallar').getPublicUrl(path);
      const { error: matErr } = await supabase.from('om_materiallar').insert({ bob_id: bobId, bolim_id: bolimId, nomi: analysis.material_nomi.trim() || fileInfo.name.replace(/\.[^.]+$/, ''), fayl_url: urlData.publicUrl, fayl_tur: fileInfo.tur, fayl_hajm: fileInfo.size, tartib: 0 }); if (matErr) throw matErr;
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, materialSaved: true, savedBolimId: bolimId } : m));
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `✅ **Material muvaffaqiyatli saqlandi!**\n\n📁 **${fileInfo.name}**\n📂 Bo'lim: **${analysis.bolim_nomi}**\n\n⚠️ Material hali yashirin. Kabinetda bo'limni faollashtiring.` }], timestamp: Date.now() }]);
    } catch (err: any) { setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ Saqlashda xatolik: ${err.message}` }], timestamp: Date.now() }]); }
    finally { setMaterialSaving(false); }
  };

  // ─── KAZUS SAQLASH ────────────────────────────────────────────────────────
  const handleSaveKazus = async (data: { savol: string; javob: string; mavzu: string; modelTur: string; allowRetake: boolean; vaqtDaqiqa: number }, msgIndex: number) => {
    if (!user?.ustoz_id) return; setKazusSaving(true);
    try {
      const kod = Math.floor(10000 + Math.random() * 90000).toString();
      const { error } = await supabase.from('toplamlar').insert({ kod, ustoz_ismi: `${user.ism} ${user.familiya}`, ustoz_id: user.ustoz_id, kazuslar: [{ kazus: data.savol.trim(), javob: data.javob.trim() }], mavzu: data.mavzu.trim() || 'Mavzusiz', vaqt_daqiqa: data.vaqtDaqiqa || 30, is_active: false, ommaviy: false, narx: 0, copy_paste_ruxsat: true, allow_retake: data.allowRetake, model_tur: data.modelTur || 'oddiy' });
      if (error) throw error;
      setMessages(prev => prev.map((m, i) => i === msgIndex ? { ...m, isKazusSaved: true, savedKazusKod: kod } : m));
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `✅ **Kazus muvaffaqiyatli saqlandi!**\n\nKod: **${kod}** | Mavzu: ${data.mavzu || 'Mavzusiz'}\n\n⚠️ Kazus hali yashirin.` }], timestamp: Date.now(), isKazusSaved: true, savedKazusKod: kod }]);
    } catch (e: any) { setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ Kazusni saqlashda xatolik: ${e.message}` }], timestamp: Date.now() }]); }
    finally { setKazusSaving(false); }
  };

  const handleStartKazus = async (kod: string) => { const { error } = await supabase.from('toplamlar').update({ is_active: true }).eq('kod', kod); if (!error) setMessages(prev => [...prev, { role: 'model', parts: [{ text: `▶️ Kazus **${kod}** faollashtirildi!\n\n[[KAZUS:${kod}|Kazusni ko'rish]]` }], timestamp: Date.now() }]); };
  const handlePublishKazus = async (kod: string) => { const { error } = await supabase.from('toplamlar').update({ ommaviy: true }).eq('kod', kod); if (!error) setMessages(prev => [...prev, { role: 'model', parts: [{ text: `🌐 Kazus **${kod}** ommalashtirildi!` }], timestamp: Date.now() }]); };

  // ─── TEST SAQLASH ─────────────────────────────────────────────────────────
  const handleSaveWordTest = async (parsedData: WordParsedTest, allowRetake: boolean, showCorrect: boolean) => {
    if (!user?.ustoz_id || !parsedData.savollar.length) return; setTestSaving(true);
    try {
      const kod = Math.floor(10000 + Math.random() * 90000).toString();
      const { error } = await supabase.from('testlar').insert({ kod, test_nomi: parsedData.testNomi, ustoz_id: user.ustoz_id, ustoz_ismi: `${user.ism} ${user.familiya}`, savollar: parsedData.savollar, vaqt_daqiqa: 30, timer_turi: 'umumiy', show_correct_answers: showCorrect, allow_retake: allowRetake, is_active: false, ommaviy: false, narx: 0 });
      if (error) throw error;
      setMessages(prev => prev.map(m => m.isWordResult && m.wordParsedData === parsedData ? { ...m, savedTestKod: kod } : m));
    } catch (e: any) { setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ Testni saqlashda xatolik: ${e.message}` }], timestamp: Date.now() }]); }
    finally { setTestSaving(false); }
  };

  const handleStartTest = async (kod: string) => { const { error } = await supabase.from('testlar').update({ is_active: true }).eq('kod', kod); if (!error) setMessages(prev => [...prev, { role: 'model', parts: [{ text: `▶️ Test **${kod}** faollashtirildi!\n\n[[TEST:${kod}|Testni ko'rish]]` }], timestamp: Date.now() }]); };
  const handlePublishTest = async (kod: string) => { const { error } = await supabase.from('testlar').update({ ommaviy: true }).eq('kod', kod); if (!error) setMessages(prev => [...prev, { role: 'model', parts: [{ text: `🌐 Test **${kod}** ommalashtirildi!` }], timestamp: Date.now() }]); };

  const handleNavClick = (tab: string, extra?: { kod?: string; tur?: 'test' | 'kazus'; materialId?: string }) => { setKichik(true); onNavigate?.(tab, extra); };

  // ─── CLIENT-SIDE INTENT DETECTION (0 token) ────────────────────────────
  const detectLocalIntent = (text: string): string | null => {
    const t = text.toLowerCase().trim();
    // Test yaratish kalit so'zlari
    const testKeywords = [
      'test yarat', 'test tuz', 'test joyla', 'test yukla', 'test qo\'sh',
      'testni yukla', 'testni yarat', 'testni joyla', 'testimni yukla',
      'yangi test', 'word yukla', 'word fayl', 'test saqla',
      'тест яратmоқchiman', 'тест тузмоқchiman',
    ];
    // Kazus yaratish kalit so'zlari
    const kazusKeywords = [
      'kazus yarat', 'kazus yukla', 'kazus joyla', 'kazus tuz', 'kazus qo\'sh',
      'kazusni yukla', 'kazusni yarat', 'yangi kazus', 'kazus saqla',
      'toplam yarat', 'toplam yukla', 'toplam joyla',
    ];
    // Material kalit so'zlari
    const materialKeywords = [
      'material yukla', 'material joyla', 'material yarat', 'material qo\'sh',
      'o\'quv material', 'oʻquv material', 'material saqla',
      'fayl yukla', 'pdf yukla', 'html yukla', 'kitob yukla',
    ];
    if (testKeywords.some(kw => t.includes(kw))) return 'YARATISH_TEST';
    if (kazusKeywords.some(kw => t.includes(kw))) return 'YARATISH_KAZUS';
    if (materialKeywords.some(kw => t.includes(kw))) return 'YARATISH_MATERIAL';
    return null;
  };

  // ─── XABAR YUBORISH ───────────────────────────────────────────────────────
  const xabarYuborish = async (matn?: string) => {
    const trimmed = (matn || input).trim();
    if (!trimmed || yuklanyapti) return;

    // 0 token: client-side intent detection
    if (isUstozMode) {
      const localIntent = detectLocalIntent(trimmed);
      if (localIntent) {
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: trimmed }], timestamp: Date.now() }]);
        setInput('');
        if (localIntent === 'YARATISH_TEST') {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: '📝 Word faylni yuklang — testni o\'zim ajratib, platformaga joylashtirib beraman.' }], timestamp: Date.now() }]);
          setTimeout(() => wordFileRef.current?.click(), 300);
        } else if (localIntent === 'YARATISH_KAZUS') {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: '📋 Kazus matnini va model javobini kiriting:' }], timestamp: Date.now(), isKazusForm: true }]);
        } else if (localIntent === 'YARATISH_MATERIAL') {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: "📚 Fayl yuklang — AI bo'lim, bob va material nomini avtomatik aniqlab, platformaga joylashtirib beraman:" }], timestamp: Date.now(), isMaterialUploadPrompt: true }]);
          setTimeout(() => materialFileRef.current?.click(), 300);
        }
        return;
      }
    }

    const newUserMsg: Message = { role: 'user', parts: [{ text: trimmed }], timestamp: Date.now() };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages); setInput(''); setYuklanyapti(true);

    try {
      const currentCtx: StudentContext = { ...studentCtx, joriySahifa: getSahifaNomi(activeTab || '') };
      const contextMessages = updatedMessages.slice(-12).map(m => ({ role: m.role, parts: m.parts }));
      const invokeBody: any = { messages: contextMessages, studentContext: currentCtx, requestorLoginId: studentCtx.loginId || '' };
      if (user?.rol === 'ustoz') { invokeBody.ustozId = user.ustoz_id; invokeBody.ustozIsmi = `${user.ism} ${user.familiya}`; }

      const { data, error } = await supabase.functions.invoke('mentor-chat', { body: invokeBody });
      if (error) {
        let errMsg = error.message;
        if (error instanceof FunctionsHttpError) { try { const t = await error.context?.text?.(); if (t) { try { errMsg = JSON.parse(t).error || t; } catch { errMsg = t; } } } catch {} }
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `⚠️ ${errMsg}` }], timestamp: Date.now() }]); return;
      }

      if (data) {
        const intent = data.intent || '';

        // C. YARATISH — darhol action, yo'naltirish yo'q
        if (intent === 'YARATISH_TEST') {
          const reply = data.reply || '📝 Word fayl yuklang — testni o\'zim ajratib, platformaga joylashtirib beraman.';
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: reply }], timestamp: Date.now() }]);
          setTimeout(() => wordFileRef.current?.click(), 400);
          return;
        }
        if (intent === 'YARATISH_KAZUS') {
          const reply = data.reply || '📋 Kazus matnini va model javobini kiriting:';
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: reply }], timestamp: Date.now(), isKazusForm: true }]);
          return;
        }
        if (intent === 'YARATISH_MATERIAL') {
          const reply = data.reply || "📚 Fayl yuklang — AI bo'lim, bob va material nomini avtomatik aniqlab, platformaga joylashtirib beraman:";
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: reply }], timestamp: Date.now(), isMaterialUploadPrompt: true }]);
          setTimeout(() => materialFileRef.current?.click(), 400);
          return;
        }

        // B. ANALITIKA CLARIFY
        if (intent === 'ANALITIKA_CLARIFY' && data.reply) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.reply }], timestamp: Date.now(), isAnalitikaClarify: true, citationMeta: null }]); return;
        }

        // B. ANALITIKA — AI tahlil javobi bilan birga
        if ((intent === 'ANALITIKA' || intent === 'ANALITIKA_AUTO' || intent === 'STUDENT_PROFILE') && (data.analyticsData || data.analyticsAll || data.reply)) {
          // Chat ichida matn tahlil ko'rsatish
          if (data.reply) {
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.reply }], timestamp: Date.now(), citationMeta: null }]);
          }
          // Analytics panelni cache ga saqlash (fon da)
          if (data.analyticsData && data.analyticsType) {
            const aType = data.analyticsType as 'testlar' | 'kazuslar' | 'materiallar';
            analyticsCacheRef.current[aType] = data.analyticsData;
            // Agar reply bo'lmasa — vizual panel ochish
            if (!data.reply) {
              setAnalyticsData(data.analyticsData); setAnalyticsType(aType); setAnalyticsOpen(true); setWideMode(true);
            }
          }
          // analyticsAll (barcha 3 tur) ham cache ga
          if (data.analyticsAll) {
            const all = data.analyticsAll;
            if (all.testlar) analyticsCacheRef.current['testlar'] = all.testlar;
            if (all.kazuslar) analyticsCacheRef.current['kazuslar'] = all.kazuslar;
            if (all.materiallar) analyticsCacheRef.current['materiallar'] = all.materiallar;
          }
          return;
        }

        // A & UMUMIY & QIDIRUV — oddiy javob (tugmalar MessageRenderer ichida ko'rsatiladi)
        if (data.reply) {
          setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.reply }], timestamp: Date.now(), citationMeta: data.citationMeta || null }]);
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: "⚠️ Bir necha daqiqadan so'ng qayta urinib ko'ring." }], timestamp: Date.now() }]);
    } finally { setYuklanyapti(false); }
  };

  const chatniTozalash = () => {
    setMessages([]); setCtxYuklandi(false); setStudentCtx({});
    setMaterialAnalyzing(false); setAnalyticsOpen(false); setAnalyticsData(null); setAiTavsiya('');
    analyticsCacheRef.current = {};
    if (isAuthenticated && user) setTimeout(() => studentContextYuklash(true), 100);
  };

  const handleOpen = () => { setOchiq(true); setUnreadCount(0); setKichik(false); if (!ctxYuklandi && isAuthenticated && user) setTimeout(() => studentContextYuklash(), 200); };

  // Plus menu action handler
  const handlePlusAction = (intent: string) => {
    setPlusMenuOchiq(false);
    if (intent === 'YARATISH_TEST') { setMessages(prev => [...prev, { role: 'model', parts: [{ text: '📝 Word fayl yuklang — testni o\'zim ajratib, platformaga joylashtirib beraman.' }], timestamp: Date.now() }]); setTimeout(() => wordFileRef.current?.click(), 200); }
    else if (intent === 'YARATISH_KAZUS') { setMessages(prev => [...prev, { role: 'model', parts: [{ text: '📋 Kazus matnini va model javobini kiriting:' }], timestamp: Date.now(), isKazusForm: true }]); }
    else if (intent === 'YARATISH_MATERIAL') { setMessages(prev => [...prev, { role: 'model', parts: [{ text: "📚 Fayl yuklang — AI avtomatik tahlil qilib, platformaga joylashtirib beraman:" }], timestamp: Date.now(), isMaterialUploadPrompt: true }]); setTimeout(() => materialFileRef.current?.click(), 200); }
    else if (intent === 'ANALITIKA_TEST') openAnalytics('testlar');
    else if (intent === 'ANALITIKA_KAZUS') openAnalytics('kazuslar');
    else if (intent === 'ANALITIKA_MATERIAL') openAnalytics('materiallar');
  };

  // AI Mentor faqat ustoz uchun (o'quvchi uchun ko'rsatilmaydi)
  // Lekin o'quvchi uchun ham boshqa jarayon bo'lsa ko'rsatiladi (kelajakda)
  if (!isUstozMode) return null;

  const hiddenTabs = ['admin', 'faceid', 'bot_yangilik'];
  if (hiddenTabs.includes(activeTab || '') || !mentorFaol) return null;

  const showAnalyticsPanel = analyticsOpen && isUstozMode && !!user?.ustoz_id;
  const ustozIsmiToliq = user ? `${user.ism} ${user.familiya}` : '';
  const hasContext = isAuthenticated && user && (studentCtx.totalXp !== undefined || (studentCtx.testNatijalari?.length ?? 0) > 0 || (studentCtx.korilganMateriallar?.length ?? 0) > 0 || (studentCtx.mavjudTestlar?.length ?? 0) > 0);
  const testlarSoni = studentCtx.testNatijalari?.length || 0;
  const kazuslarSoni = studentCtx.kazusNatijalari?.length || 0;
  const anyLoading = yuklanyapti || wordParsing || materialAnalyzing;
  const chatWidth = wideMode && ochiq && !kichik ? 'w-[95vw] md:w-[700px] lg:w-[820px] max-w-[95vw]' : 'w-[360px] md:w-[420px]';

  const plusMenuItems = [
    { label: '📝 Test yaratish (Word)', intent: 'YARATISH_TEST', color: 'text-blue-700 hover:bg-blue-50' },
    { label: '📋 Kazus yaratish', intent: 'YARATISH_KAZUS', color: 'text-emerald-700 hover:bg-emerald-50' },
    { label: "📚 O'quv material joylash", intent: 'YARATISH_MATERIAL', color: 'text-teal-700 hover:bg-teal-50' },
    { label: '📊 Test analitikasi', intent: 'ANALITIKA_TEST', color: 'text-blue-700 hover:bg-blue-50' },
    { label: '🧠 Kazus analitikasi', intent: 'ANALITIKA_KAZUS', color: 'text-purple-700 hover:bg-purple-50' },
    { label: '📖 Material analitikasi', intent: 'ANALITIKA_MATERIAL', color: 'text-teal-700 hover:bg-teal-50' },
  ];

  return (
    <>
      {!ochiq && (
        <button onClick={handleOpen}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-full shadow-lg shadow-violet-500/25 transition-all active:scale-95 border border-violet-400/30 ${pulse ? 'shadow-violet-500/50 shadow-xl' : ''}`}
          title="FanFaster AI Mentor">
          <div className="relative"><Sparkles className="h-3.5 w-3.5" />{pulse && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />}</div>
          <span className="text-[11px] font-black hidden sm:inline">AI Mentor</span>
          {unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{unreadCount}</span>}
        </button>
      )}

      {ochiq && (
        <div className={`fixed z-[200] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transition-all duration-300 ${kichik ? 'bottom-4 right-4 w-72 h-12' : `bottom-4 right-4 ${chatWidth} h-[640px] max-h-[93vh]`}`}
          style={{ boxShadow: '0 20px 60px rgba(109, 40, 217, 0.25), 0 8px 20px rgba(0,0,0,0.12)' }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><BrainCircuit className="h-4 w-4" /></div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border border-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm leading-tight">FanFaster AI</p>
              {!kichik && <p className="text-violet-200 text-[10px] leading-tight">{analyticsOpen ? '📊 Analitika ko\'rinishi' : materialAnalyzing ? '🧠 Material tahlil...' : wordParsing ? '⏳ Word fayl tahlil...' : ctxYuklanyapti ? "⏳ Yuklanmoqda..." : yuklanyapti ? '💭 Tahlil qilmoqda...' : 'Shaxsiy Raqamli Murabbiyngiz'}</p>}
            </div>
            <div className="flex items-center gap-1">
              {isUstozMode && !kichik && (
                <button onClick={() => analyticsOpen ? (setAnalyticsOpen(false), setWideMode(false)) : openAnalytics('testlar')}
                  className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 px-2 ${analyticsOpen ? 'bg-white/30 text-white' : 'hover:bg-white/20'}`} title="Analitika">
                  <BarChart2 className="h-3.5 w-3.5" /><span className="hidden sm:inline text-[10px] font-black">Analitika</span>
                </button>
              )}
              {!kichik && isUstozMode && (
                <button onClick={() => setWideMode(w => !w)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title={wideMode ? 'Kichraytirish' : 'Kengaytirish'}>
                  {wideMode ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
                </button>
              )}
              <button onClick={chatniTozalash} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Yangilash"><RotateCcw className="h-3.5 w-3.5" /></button>
              <button onClick={() => setKichik(k => !k)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">{kichik ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}</button>
              <button onClick={() => { setOchiq(false); setWideMode(false); setAnalyticsOpen(false); }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {!kichik && showAnalyticsPanel && (
            <AnalyticsPanel type={analyticsType} data={analyticsData} loading={analyticsLoading} aiTavsiya={aiTavsiya} aiLoading={aiTavsiyaLoading}
              onClose={() => { setAnalyticsOpen(false); setWideMode(false); }} onTypeChange={handleAnalyticsTypeChange} onNavigate={handleNavClick}
              ustozId={user?.ustoz_id} ustozIsmi={ustozIsmiToliq} />
          )}

          {!kichik && !analyticsOpen && (
            <>
              {hasContext && (
                <div className="px-3 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-1.5 overflow-x-auto flex-shrink-0 no-scrollbar">
                  {studentCtx.totalXp !== undefined && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 border bg-violet-50 border-violet-300 text-violet-700"><Zap className="h-2.5 w-2.5" />{studentCtx.totalXp} XP</span>}
                  {studentCtx.currentLevel !== undefined && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 border bg-amber-50 border-amber-300 text-amber-700"><Star className="h-2.5 w-2.5" />Daraja {studentCtx.currentLevel}</span>}
                  {!!studentCtx.reytingOrni && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 border bg-blue-50 border-blue-300 text-blue-700"><Trophy className="h-2.5 w-2.5" />#{studentCtx.reytingOrni}</span>}
                  {testlarSoni > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 border bg-blue-50 border-blue-300 text-blue-700">📝 {testlarSoni}</span>}
                  {kazuslarSoni > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 border bg-emerald-50 border-emerald-300 text-emerald-700">📋 {kazuslarSoni}</span>}
                </div>
              )}

              {!isAuthenticated && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mb-4"><Bot className="h-8 w-8 text-violet-600" /></div>
                  <p className="font-black text-gray-800 mb-2">FanFaster AI Mentor</p>
                  <p className="text-sm text-gray-500 mb-4">Shaxsiy AI mentordan foydalanish uchun tizimga kiring.</p>
                  <button onClick={() => { setOchiq(false); window.dispatchEvent(new CustomEvent('open-login-modal')); }} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl transition-all">Kirish</button>
                </div>
              )}

              {isAuthenticated && ctxYuklanyapti && messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
                  <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Ma'lumotlaringiz yuklanmoqda...</p>
                </div>
              )}

              {isAuthenticated && !ctxYuklanyapti && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
                  {messages.length === 0 && !yuklanyapti && (
                    <div className="space-y-2">
                      <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 text-center">
                        <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mx-auto mb-2"><BrainCircuit className="h-6 w-6 text-violet-600" /></div>
                        <p className="font-black text-sm text-violet-800 mb-1">Salom{user?.ism ? `, ${user.ism}` : ''}! 👋</p>
                        <p className="text-xs text-violet-600 leading-relaxed">{isUstozMode ? 'Test, kazus yoki material yaratishda va analitika uchun yordam beraman.' : testlarSoni > 0 || kazuslarSoni > 0 ? `${testlarSoni} test va ${kazuslarSoni} kazus natijalaringizni tahlil qilishga tayyorman.` : "Natijalaringizni tahlil qilaman, saytdagi kontentni topa olaman."}</p>
                      </div>
                      <div className="space-y-1.5">
                        {(isUstozMode ? USTOZ_TEZKOR_SAVOLLAR : TEZKOR_SAVOLLAR).map((s, i) => (
                          <button key={i} onClick={() => xabarYuborish(s.text)} disabled={yuklanyapti}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-xl text-left transition-all group disabled:opacity-50">
                            <span className="text-xs text-gray-700 group-hover:text-violet-700 font-medium">{s.label}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-violet-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'model' && <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>}
                      <div className={`max-w-[85%] ${msg.role === 'user' ? 'px-3 py-2.5 rounded-2xl bg-violet-600 text-white rounded-tr-sm text-sm leading-relaxed' : 'w-full'}`}>
                        {msg.role === 'model' ? (
                          <div className="space-y-2">
                            <div className="bg-white text-gray-800 shadow-sm border border-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5">
                              <MessageRenderer text={msg.parts[0].text} onNav={handleNavClick} citationMeta={msg.citationMeta} />
                            </div>
                            {msg.isMaterialUploadPrompt && (
                              <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-3">
                                <input type="file" ref={materialFileRef} accept=".html,.htm,.pdf,.doc,.docx,.mp3,.wav,.mp4,.webm,.mov" onChange={handleMaterialFileChange} className="hidden" />
                                <button onClick={() => materialFileRef.current?.click()} disabled={materialAnalyzing}
                                  className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-black transition-all active:scale-95 shadow-md">
                                  {materialAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" />AI tahlil qilmoqda...</> : <><FileUp className="h-4 w-4" />Fayl tanlash</>}
                                </button>
                                <p className="text-[10px] text-teal-600 mt-2 text-center">HTML · PDF · Word (.docx) · Audio · Video</p>
                              </div>
                            )}
                            {msg.isMaterialAnalysis && msg.materialAnalysisData && msg.materialAnalysisFile && (
                              <MaterialTahlilKarta analysis={msg.materialAnalysisData} fileInfo={msg.materialAnalysisFile}
                                onConfirm={(edited) => handleSaveMaterial(idx, edited, msg.materialAnalysisFile!)}
                                isSaving={materialSaving} saved={msg.materialSaved} onNavigate={handleNavClick} />
                            )}
                            {msg.isWordResult && msg.wordParsedData && (
                              <WordTestCard parsedData={msg.wordParsedData} savedKod={msg.savedTestKod}
                                onSave={(ar, sc) => handleSaveWordTest(msg.wordParsedData!, ar, sc)}
                                onStartTest={handleStartTest} onPublish={handlePublishTest} isSaving={testSaving} />
                            )}
                            {msg.isAnalitikaClarify && isUstozMode && user?.ustoz_id && (
                              <div className="flex flex-col gap-2 mt-2">
                                {([{ type: 'testlar' as const, label: '📝 Testlarim statistikasi', color: 'bg-blue-600 hover:bg-blue-700' }, { type: 'kazuslar' as const, label: '📋 Kazuslarim statistikasi', color: 'bg-purple-600 hover:bg-purple-700' }, { type: 'materiallar' as const, label: "📚 O'quv materiallarim", color: 'bg-teal-600 hover:bg-teal-700' }]).map(opt => (
                                  <button key={opt.type} onClick={() => openAnalytics(opt.type)} className={`flex items-center justify-center gap-2 py-2.5 ${opt.color} text-white rounded-xl text-xs font-black transition-all active:scale-95`}>{opt.label}</button>
                                ))}
                              </div>
                            )}
                            {msg.isKazusForm && !msg.isKazusSaved && <KazusYaratishForma onSave={(data) => handleSaveKazus(data, idx)} isSaving={kazusSaving} />}
                            {msg.isKazusSaved && msg.savedKazusKod && <KazusSaqlangandKarta kod={msg.savedKazusKod} onStart={handleStartKazus} onPublish={handlePublishKazus} />}
                          </div>
                        ) : msg.parts[0].text}
                      </div>
                    </div>
                  ))}

                  {anyLoading && (
                    <div className="flex justify-start">
                      <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2"><BrainCircuit className="h-3.5 w-3.5 text-white" /></div>
                      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {isAuthenticated && !ctxYuklanyapti && (
                <div className="p-3 border-t border-gray-100 bg-white flex-shrink-0">
                  <input type="file" ref={wordFileRef} accept=".docx,.doc" onChange={handleWordFileChange} className="hidden" />
                  <input type="file" ref={materialFileRef} accept=".html,.htm,.pdf,.doc,.docx,.mp3,.wav,.mp4,.webm,.mov" onChange={handleMaterialFileChange} className="hidden" />
                  <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 focus-within:border-violet-400 rounded-xl transition-all px-2 py-1.5">
                    {isUstozMode && (
                      <div className="relative flex-shrink-0" ref={plusMenuRef}>
                        <button onClick={() => setPlusMenuOchiq(v => !v)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-95 ${plusMenuOchiq ? 'bg-violet-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`} title="Imkoniyatlar">
                          <Plus className="h-4 w-4" />
                        </button>
                        {plusMenuOchiq && (
                          <div className="absolute bottom-10 left-0 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-10 py-1">
                            {plusMenuItems.map(item => (
                              <button key={item.intent} onClick={() => handlePlusAction(item.intent)}
                                className={`w-full text-left px-3 py-2.5 text-xs font-bold ${item.color} transition-all`}>{item.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && xabarYuborish()}
                      placeholder={isUstozMode ? "Test nomi, kazus kodi, material nomi..." : "Savolingizni yozing..."}
                      className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400 py-0.5" disabled={anyLoading} />
                    <button onClick={() => xabarYuborish()} disabled={!input.trim() || anyLoading}
                      className="w-7 h-7 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white rounded-lg flex items-center justify-center transition-all active:scale-95 flex-shrink-0">
                      {yuklanyapti ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-400 text-center mt-1.5">FanFaster AI • Nom yoki kodni yozing — darhol toping</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
