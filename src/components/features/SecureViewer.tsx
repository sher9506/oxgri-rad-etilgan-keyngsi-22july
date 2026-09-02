import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, ZoomIn, ZoomOut, Shield, FileText } from 'lucide-react';

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

// ── HTML VIEWER ───────────────────────────────────────────────────
function HtmlViewer({ url, zoom }: { url: string; zoom: number }) {
  const [htmlContent, setHtmlContent] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch(url, { cache: 'no-cache' }).then(res => res.text()).then(text => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      // Barcha a elementlarini target=_blank qilish
      doc.querySelectorAll('a[href]').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
      // Stil va tooltip script qo'shish
      const style = doc.createElement('style');
      style.textContent = `
        * { -webkit-user-select: none !important; user-select: none !important; }
        body { padding: 30px; font-family: 'Times New Roman', serif; line-height: 1.6; background: white; font-size: ${zoom}%; }
        a[href] { color: #2563eb !important; text-decoration: underline !important; cursor: pointer !important; }
        a[href]:hover { color: #1d4ed8 !important; }
        #__link_tooltip { position: fixed; bottom: 8px; left: 8px; background: rgba(0,0,0,0.8); color: #fff;
          padding: 4px 10px; border-radius: 6px; font-size: 11px; max-width: 80vw; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; z-index: 9999; pointer-events: none;
          font-family: monospace; display: none; }
      `;
      doc.head.appendChild(style);
      // Tooltip script
      const script = doc.createElement('script');
      script.textContent = `
        document.addEventListener('DOMContentLoaded', function() {
          var tip = document.createElement('div');
          tip.id = '__link_tooltip';
          document.body.appendChild(tip);
          document.querySelectorAll('a[href]').forEach(function(a) {
            a.addEventListener('mouseenter', function() { tip.textContent = a.href; tip.style.display = 'block'; });
            a.addEventListener('mouseleave', function() { tip.style.display = 'none'; });
          });
        });
      `;
      doc.body.appendChild(script);
      setHtmlContent(doc.documentElement.outerHTML);
    });
  }, [url, zoom]);

  return <iframe ref={iframeRef} srcDoc={htmlContent} className="w-full h-full border-0 bg-white" title="h-v"
    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin" />;
}

// ── PDF VIEWER (barcha sahifalar birga scroll) ───────────────────
function PdfViewer({ url, zoom }: { url: string; zoom: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const renderAllPages = useCallback(async (pdf: any) => {
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
      const pdfPage = await pdf.getPage(i);
      const viewport = pdfPage.getViewport({ scale: (zoom / 100) * 1.5 });
      const canvas = canvasRefs.current[i - 1];
      if (!canvas) continue;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext('2d');
      pdfPage.render({ canvasContext: ctx, viewport });
    }
  }, [zoom]);

  useEffect(() => {
    const loadPdf = () => {
      (window as any).pdfjsLib.getDocument(url).promise.then((pdf: any) => {
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        setLoading(false);
      });
    };
    const pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      const s = document.createElement('script');
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = () => {
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        loadPdf();
      };
      document.head.appendChild(s);
    } else loadPdf();
  }, [url]);

  useEffect(() => {
    if (pdfDoc && !loading) renderAllPages(pdfDoc);
  }, [zoom, pdfDoc, loading, renderAllPages]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-400" /></div>;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-slate-300 custom-scrollbar">
      <div className="flex flex-col items-center gap-4 py-6 px-4">
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="relative">
            <div className="absolute -top-1 left-2 text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{i+1}/{numPages}</div>
            <canvas
              ref={el => { canvasRefs.current[i] = el; }}
              className="shadow-2xl bg-white block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WORD (DOCX) VIEWER ────────────────────────────────────────────
function DocxViewer({ url, zoom }: { url: string; zoom: number }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!(window as any).mammoth) {
        const s = document.createElement('script');
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
        await new Promise(r => { s.onload = r; document.head.appendChild(s); });
      }
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
      // linklarni target=_blank qil
      const parser = new DOMParser();
      const doc = parser.parseFromString(result.value, 'text/html');
      doc.querySelectorAll('a').forEach(a => { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); });
      setHtml(doc.body.innerHTML);
      setLoading(false);
    };
    load();
  }, [url]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;

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

  const renderViewer = () => {
    const tur = material.fayl_tur.toLowerCase();
    if (tur === 'pdf') return <PdfViewer url={material.fayl_url} zoom={zoom} />;
    if (tur.includes('html')) return <HtmlViewer url={material.fayl_url} zoom={zoom} />;
    if (tur.includes('doc')) return <DocxViewer url={material.fayl_url} zoom={zoom} />;
    if (tur === 'audio') return <div className="h-full flex items-center justify-center bg-slate-900"><audio src={material.fayl_url} controls className="w-80" /></div>;
    if (tur === 'video') return <div className="h-full flex items-center justify-center bg-black"><video src={material.fayl_url} controls className="max-h-full" /></div>;
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