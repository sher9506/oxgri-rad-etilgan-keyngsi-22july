import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

interface Material {
  id: string;
  nomi: string;
  fayl_url: string;
  fayl_tur: string;
}

interface SecureViewerProps {
  material: Material;
  onOrqaga: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function proxyUrl(originalUrl: string): string {
  return `${SUPABASE_URL}/functions/v1/proxy-file?url=${encodeURIComponent(originalUrl)}`;
}

// ── HTML VIEWER ───────────────────────────────────────────────────
function HtmlViewer({ url, zoom }: { url: string; zoom: number }) {
  return (
    <iframe
      src={proxyUrl(url)}
      className="w-full h-full border-0 bg-white"
      title="Material ko'ruvchisi"
      sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      style={{ zoom: `${zoom}%` }}
    />
  );
}

// ── PDF VIEWER ────────────────────────────────────────────────────
function PdfViewer({ url, zoom }: { url: string; zoom: number }) {
  return (
    <iframe
      src={proxyUrl(url)}
      className="w-full h-full border-0 bg-slate-300"
      title="PDF material ko'ruvchisi"
      style={{ zoom: `${zoom}%` }}
    />
  );
}

// ── WORD (DOCX) VIEWER ────────────────────────────────────────────
function DocxViewer({ url, zoom }: { url: string; zoom: number }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const proxied = proxyUrl(url);
        const res = await fetch(proxied, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        if (!res.ok) { setError('Fayl yuklanmadi'); setLoading(false); return; }
        const arrayBuffer = await res.arrayBuffer();

        if (!(window as any).mammoth) {
          const s = document.createElement('script');
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
          await new Promise(r => { s.onload = r; document.head.appendChild(s); });
        }
        const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.value, 'text/html');
        doc.querySelectorAll('a').forEach(a => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); });
        setHtml(doc.body.innerHTML);
      } catch {
        setError('Fayl yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [url]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;
  if (error) return <div className="text-center p-20 text-red-500 font-medium">{error}</div>;

  return (
    <div className="h-full overflow-y-auto bg-slate-200 p-4 custom-scrollbar">
      <div className="mx-auto bg-white shadow-xl transition-all duration-200"
           style={{ maxWidth: `${(zoom / 100) * 210}mm`, padding: `${(zoom / 100) * 15}mm` }}>
        <div className="prose prose-slate max-w-none select-none"
             style={{ fontSize: `${(zoom / 100) * 11}pt`, fontFamily: "serif" }}
             dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ── MAIN VIEWER ───────────────────────────────────────────────────
export default function SecureViewer({ material, onOrqaga }: SecureViewerProps) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    const prevent = (e: any) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('copy', prevent);
    };
  }, []);

  const proxiedAudioUrl = proxyUrl(material.fayl_url);
  const renderViewer = () => {
    const tur = material.fayl_tur.toLowerCase();
    if (tur === 'pdf') return <PdfViewer url={material.fayl_url} zoom={zoom} />;
    if (tur.includes('html')) return <HtmlViewer url={material.fayl_url} zoom={zoom} />;
    if (tur.includes('doc')) return <DocxViewer url={material.fayl_url} zoom={zoom} />;
    if (tur === 'audio') return <div className="h-full flex items-center justify-center bg-slate-900"><audio src={proxiedAudioUrl} controls className="w-80" /></div>;
    if (tur === 'video') return <div className="h-full flex items-center justify-center bg-black"><video src={proxiedAudioUrl} controls className="max-h-full" /></div>;
    return <div className="text-center p-20">Format tanilmadi</div>;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-100 flex flex-col">
      <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={onOrqaga} className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <span className="font-bold text-sm truncate max-w-[150px] md:max-w-md">{material.nomi}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-black/30 rounded-lg p-1 border border-white/10">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 hover:bg-white/10 rounded-md transition-all"><ZoomOut size={16}/></button>
            <span className="text-xs font-bold w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(250, z + 10))} className="p-1.5 hover:bg-white/10 rounded-md transition-all"><ZoomIn size={16}/></button>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-black text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
             HIMOYA REJIMI
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-slate-200">
        {renderViewer()}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .prose p { margin-bottom: 1em; line-height: 1.5; }
      `}</style>
    </div>
  );
}
