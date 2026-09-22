import { useState, useEffect, useRef, useCallback } from 'react';
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

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(proxyUrl(url), {
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Fayl yuklanmadi (${res.status})`);
  return res.blob();
}

// ── HIMOYA HOOK ───────────────────────────────────────────────────
function useProtection() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && ['c', 's', 'p', 'u', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === 'F12') { e.preventDefault(); e.stopPropagation(); }
    };
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);
}

// ── PDF VIEWER (pdf.js + canvas, himoyalangan) ────────────────────
function PdfViewer({ url, zoom }: { url: string; zoom: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const renderAllPages = useCallback(async (pdf: any) => {
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: (zoom / 100) * 1.5 });
      const canvas = canvasRefs.current[i - 1];
      if (!canvas) continue;
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  }, [zoom]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const blob = await fetchBlob(url);
        const arrayBuffer = await blob.arrayBuffer();

        if (!(window as any).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            s.onload = () => {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              resolve();
            };
            s.onerror = () => reject(new Error('pdf.js yuklanmadi'));
            document.head.appendChild(s);
          });
        }

        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        canvasRefs.current = new Array(pdf.numPages).fill(null);
        setLoading(false);
      } catch (err: any) {
        if (!cancelled) { setError(err?.message || 'PDF yuklanmadi'); setLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (pdfDoc && !loading) renderAllPages(pdfDoc);
  }, [zoom, pdfDoc, loading, renderAllPages]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-400" /></div>;
  if (error) return <div className="text-center p-20 text-red-500 font-medium">{error}</div>;

  return (
    <div ref={containerRef} className="h-full overflow-y-auto bg-slate-300 custom-scrollbar"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="flex flex-col items-center gap-4 py-6 px-4">
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="relative select-none"
            onContextMenu={(e) => e.preventDefault()}
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
            <div className="absolute -top-1 left-2 text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded pointer-events-none">
              {i + 1}/{numPages}
            </div>
            <canvas
              ref={el => { canvasRefs.current[i] = el; }}
              className="shadow-2xl bg-white block"
              style={{ userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
              onContextMenu={(e) => e.preventDefault()}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HTML VIEWER (sandboxed iframe, himoyalangan) ──────────────────
function HtmlViewer({ url, zoom }: { url: string; zoom: number }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let revoke: string | null = null;
    const load = async () => {
      try {
        const blob = await fetchBlob(url);
        const text = await blob.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        doc.querySelectorAll('a[href]').forEach(a => {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });

        const style = doc.createElement('style');
        style.textContent = `
          * { -webkit-user-select: none !important; user-select: none !important; }
          body { padding: 30px; font-family: 'Times New Roman', serif; line-height: 1.6; background: white; }
          a[href] { color: #2563eb !important; text-decoration: underline !important; cursor: pointer !important; }
          a[href]:hover { color: #1d4ed8 !important; }
        `;
        doc.head.appendChild(style);

        const script = doc.createElement('script');
        script.textContent = `
          document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
          document.addEventListener('copy', function(e) { e.preventDefault(); });
          document.addEventListener('cut', function(e) { e.preventDefault(); });
          document.addEventListener('keydown', function(e) {
            var ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && ['c','s','p','u','a'].indexOf(e.key.toLowerCase()) !== -1) { e.preventDefault(); e.stopPropagation(); }
            if (e.key === 'F12') { e.preventDefault(); }
          });
        `;
        doc.body.appendChild(script);

        const blob2 = new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
        const bUrl = URL.createObjectURL(blob2);
        revoke = bUrl;
        setBlobUrl(bUrl);
        setLoading(false);
      } catch (err: any) {
        setError(err?.message || 'HTML yuklanmadi');
        setLoading(false);
      }
    };
    load();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [url]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-400" /></div>;
  if (error) return <div className="text-center p-20 text-red-500 font-medium">{error}</div>;

  return (
    <iframe
      src={blobUrl}
      className="w-full h-full border-0 bg-white"
      title="Material ko'ruvchisi"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      style={{ zoom: `${zoom}%` }}
      onContextMenu={(e) => e.preventDefault()}
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
        const blob = await fetchBlob(url);
        const arrayBuffer = await blob.arrayBuffer();

        if (!(window as any).mammoth) {
          const s = document.createElement('script');
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
          await new Promise(r => { s.onload = () => r(undefined); document.head.appendChild(s); });
        }
        const result = await (window as any).mammoth.convertToHtml({ arrayBuffer });
        const parser = new DOMParser();
        const doc = parser.parseFromString(result.value, 'text/html');
        doc.querySelectorAll('a').forEach(a => {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        });
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
    <div className="h-full overflow-y-auto bg-slate-200 p-4 custom-scrollbar"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="mx-auto bg-white shadow-xl transition-all duration-200"
           style={{ maxWidth: `${(zoom / 100) * 210}mm`, padding: `${(zoom / 100) * 15}mm` }}>
        <div className="prose prose-slate max-w-none"
             style={{
               fontSize: `${(zoom / 100) * 11}pt`,
               fontFamily: "serif",
               userSelect: 'none',
               WebkitUserSelect: 'none',
             }}
             onContextMenu={(e) => e.preventDefault()}
             dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ── AUDIO/VIDEO VIEWER (blob, ichki) ──────────────────────────────
function AudioViewer({ url }: { url: string }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let revoke: string | null = null;
    const load = async () => {
      try {
        const blob = await fetchBlob(url);
        const bUrl = URL.createObjectURL(blob);
        revoke = bUrl;
        setBlobUrl(bUrl);
      } catch {
        setError('Audio yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [url]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-400" /></div>;
  if (error) return <div className="text-center p-20 text-red-500 font-medium">{error}</div>;

  return (
    <div className="h-full flex items-center justify-center bg-slate-900"
      onContextMenu={(e) => e.preventDefault()}>
      <audio src={blobUrl} controls className="w-80" onContextMenu={(e) => e.preventDefault()} />
    </div>
  );
}

function VideoViewer({ url }: { url: string }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let revoke: string | null = null;
    const load = async () => {
      try {
        const blob = await fetchBlob(url);
        const bUrl = URL.createObjectURL(blob);
        revoke = bUrl;
        setBlobUrl(bUrl);
      } catch {
        setError('Video yuklanmadi');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [url]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-400" /></div>;
  if (error) return <div className="text-center p-20 text-red-500 font-medium">{error}</div>;

  return (
    <div className="h-full flex items-center justify-center bg-black"
      onContextMenu={(e) => e.preventDefault()}>
      <video src={blobUrl} controls className="max-h-full" onContextMenu={(e) => e.preventDefault()} />
    </div>
  );
}

// ── MAIN VIEWER ───────────────────────────────────────────────────
export default function SecureViewer({ material, onOrqaga }: SecureViewerProps) {
  const [zoom, setZoom] = useState(100);
  useProtection();

  const renderViewer = () => {
    const tur = material.fayl_tur.toLowerCase();
    if (tur === 'pdf') return <PdfViewer url={material.fayl_url} zoom={zoom} />;
    if (tur.includes('html')) return <HtmlViewer url={material.fayl_url} zoom={zoom} />;
    if (tur.includes('doc')) return <DocxViewer url={material.fayl_url} zoom={zoom} />;
    if (tur === 'audio') return <AudioViewer url={material.fayl_url} />;
    if (tur === 'video') return <VideoViewer url={material.fayl_url} />;
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
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 hover:bg-white/10 rounded-md transition-all"><ZoomOut size={16} /></button>
            <span className="text-xs font-bold w-12 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(250, z + 10))} className="p-1.5 hover:bg-white/10 rounded-md transition-all"><ZoomIn size={16} /></button>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[10px] font-black text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
            HIMOYA REJIMI
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-slate-200" onContextMenu={(e) => e.preventDefault()}>
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
