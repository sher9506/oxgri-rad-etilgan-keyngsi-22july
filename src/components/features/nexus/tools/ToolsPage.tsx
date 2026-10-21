// Mini App vositalari: ?tool=menu|aliment|boj|shablon|sud. Bot savolga qarab shu sahifalarga tugma beradi.
import { lazy, Suspense } from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import './tools.css';

const AlimentKalkulyator = lazy(() => import('./AlimentKalkulyator'));
const DavlatBojiKalkulyator = lazy(() => import('./DavlatBojiKalkulyator'));
const Shablonlar = lazy(() => import('./Shablonlar'));
const SudManzillari = lazy(() => import('./SudManzillari'));

export const TOOLS = [
  { id: 'aliment', icon: '👶', title: 'Aliment kalkulyatori', desc: "Bolalar soni va daromad bo'yicha oylik summa" },
  { id: 'boj', icon: '🧮', title: 'Davlat boji kalkulyatori', desc: "Sudga murojaat uchun to'lov" },
  { id: 'shablon', icon: '📄', title: 'Ariza namunalari', desc: "Tayyor da'vo arizalari va shikoyatlar (Word)" },
  { id: 'sud', icon: '🏛', title: 'Sud manzillari', desc: 'Viloyat va tuman sudlari, telefonlar' },
] as const;
export type ToolId = typeof TOOLS[number]['id'];

// Telefonda klaviatura chiqqanda yozilayotgan maydon ko'rinib tursin (Telegram webview o'zi surmaydi)
const keepInView = (e: React.FocusEvent) => {
  const el = e.target as HTMLElement;
  if (el.matches('input, textarea')) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
};

export default function ToolsPage({ tool, sh, onChange, onChat }: { tool: string; sh?: string; onChange: (t: string) => void; onChat: () => void }) {
  const back = () => onChange('menu');
  const page =
    tool === 'aliment' ? <AlimentKalkulyator onBack={back} /> :
    tool === 'boj' ? <DavlatBojiKalkulyator onBack={back} /> :
    tool === 'shablon' ? <Shablonlar onBack={back} initialId={sh} /> :
    tool === 'sud' ? <SudManzillari onBack={back} /> : null;
  if (page) return <div className="nasher-tools" onFocusCapture={keepInView}><Suspense fallback={<div className="p-6 text-center text-slate-500">Yuklanmoqda…</div>}>{page}</Suspense></div>;

  return (
    <div className="nasher-tools mx-auto max-w-md p-4">
      <h1 className="mb-1 text-xl font-bold">🧰 Vositalar</h1>
      <p className="mb-4 text-sm text-slate-500">Tez hisob-kitob va tayyor hujjatlar. Savol bo'lsa — NaSher AI chatiga yozing.</p>
      <div className="space-y-2">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-sm active:bg-slate-100">
            <span className="text-2xl">{t.icon}</span>
            <span className="flex-1">
              <span className="block font-semibold">{t.title}</span>
              <span className="block text-xs text-slate-500">{t.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        ))}
      </div>
      <button onClick={onChat} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 font-semibold text-white">
        <MessageSquare className="h-4 w-4" /> NaSher AI ga savol berish
      </button>
    </div>
  );
}
