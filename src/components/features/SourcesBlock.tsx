import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, FileText, X, ChevronDown, BookOpen, Upload, Loader2, AlertCircle, File } from 'lucide-react';
import type { SourceItem } from '@/hooks/useAiAnswerJob';

const MAX_SOURCES = 18;
const MAX_SOURCE_TEXT = 100000;
const MAX_TITLE = 120;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export interface ConfirmedSource {
  type: string;
  title: string;
}

interface SourcesBlockProps {
  sources: SourceItem[];
  onAdd: (source: SourceItem) => void;
  onRemove: (index: number) => void;
  linkedModdalar?: { modda: string; qonun: string; matn: string }[];
  onAddModdalar?: (moddalar: SourceItem[]) => void;
}

function genId() {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SourcesBlock({ sources, onAdd, onRemove, linkedModdalar, onAddModdalar }: SourcesBlockProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<'url' | 'text' | 'file' | null>(null);

  const atLimit = sources.length >= MAX_SOURCES;
  const hasLinkedModdalar = linkedModdalar && linkedModdalar.length > 0 && onAddModdalar;
  const roomForModdalar = MAX_SOURCES - sources.length >= (linkedModdalar?.length || 0);

  return (
    <div className="rounded-xl border border-gray-200/80 bg-gray-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        aria-expanded={open}
        aria-label="Manbalar blokini ochish yoki yopish"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
          <BookOpen className="h-3.5 w-3.5 text-gray-500" />
          Manbalar (ixtiyoriy)
          <span className="text-[10px] font-normal text-gray-400">{sources.length}/{MAX_SOURCES}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ maxHeight: open ? '3000px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="px-3 pb-3 space-y-2">
          {sources.length > 0 && (
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <SourceRow key={s.id} source={s} onRemove={() => onRemove(i)} />
              ))}
            </div>
          )}

          {adding === null && !atLimit && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdding('url')}
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  aria-label="Havola manba qo'shish"
                  style={{ minHeight: '44px' }}
                >
                  <Link className="h-3 w-3" /> + Havola
                </button>
                <button
                  type="button"
                  onClick={() => setAdding('text')}
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  aria-label="Matn manba qo'shish"
                  style={{ minHeight: '44px' }}
                >
                  <FileText className="h-3 w-3" /> + Matn
                </button>
                <button
                  type="button"
                  onClick={() => setAdding('file')}
                  className="inline-flex items-center justify-center gap-1 text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  aria-label="PDF yoki Word fayl qo'shish"
                  style={{ minHeight: '44px' }}
                >
                  <Upload className="h-3 w-3" /> + Fayl
                </button>
              </div>

              {hasLinkedModdalar && roomForModdalar && (
                <button
                  type="button"
                  onClick={() => onAddModdalar!(linkedModdalar!.map(m => ({
                    id: genId(),
                    type: 'text' as const,
                    title: `Modda ${m.modda} — ${m.qonun}`,
                    content: m.matn,
                    charCount: m.matn.length,
                  })))}
                  className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-bold py-2 px-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                  style={{ minHeight: '44px' }}
                  aria-label="Bog'langan moddalarni manba sifatida qo'shish"
                >
                  <BookOpen className="h-3 w-3" /> Bog'langan moddalarni qo'shish ({linkedModdalar!.length})
                </button>
              )}
              {hasLinkedModdalar && !roomForModdalar && (
                <p className="text-[10px] text-gray-400 text-center">
                  Moddalarni qo'shish uchun joy yetarli emas ({linkedModdalar!.length} ta, limit {MAX_SOURCES})
                </p>
              )}
            </>
          )}

          {adding === 'url' && (
            <AddUrlForm
              onAdd={(src) => { onAdd(src); setAdding(null); }}
              onCancel={() => setAdding(null)}
            />
          )}

          {adding === 'text' && (
            <AddTextForm
              onAdd={(src) => { onAdd(src); setAdding(null); }}
              onCancel={() => setAdding(null)}
            />
          )}

          {adding === 'file' && (
            <AddFileSource
              currentCount={sources.length}
              onAdd={(src) => onAdd(src)}
              onDone={() => setAdding(null)}
            />
          )}

          {atLimit && adding === null && (
            <p className="text-[10px] text-gray-400 text-center">
              Ko'pi bilan {MAX_SOURCES} ta manba qo'shish mumkin
            </p>
          )}

          <p className="text-[10px] text-gray-400 leading-relaxed">
            Manba qo'shsangiz, AI javob faqat shu manbalarga tayanadi. Qo'shmasangiz, umumiy qonunlar bazasidan foydalaniladi.
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ source, onRemove }: { source: SourceItem; onRemove: () => void }) {
  const isModda = source.title.startsWith('Modda ');
  const isUrl = source.type === 'url';
  const isFile = source.type === 'file';
  const charCount = source.charCount || (source.type !== 'url' ? source.content.length : 0);

  const preview = isUrl
    ? source.url
    : source.type !== 'url'
    ? source.content.slice(0, 80) + (source.content.length > 80 ? '…' : '')
    : '';

  let badgeText: string;
  let badgeClass: string;
  if (isModda) {
    badgeText = 'Modda';
    badgeClass = 'bg-blue-100 text-blue-700 border-blue-200';
  } else if (isUrl) {
    badgeText = 'Havola';
    badgeClass = 'bg-cyan-100 text-cyan-700 border-cyan-200';
  } else if (isFile && source.fileKind === 'pdf') {
    badgeText = 'PDF';
    badgeClass = 'bg-red-100 text-red-700 border-red-200';
  } else if (isFile && source.fileKind === 'docx') {
    badgeText = 'Word';
    badgeClass = 'bg-indigo-100 text-indigo-700 border-indigo-200';
  } else {
    badgeText = 'Matn';
    badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-gray-200/80 group animate-in fade-in slide-in-from-top-1 duration-300">
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
        {badgeText}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-700 truncate">{source.title}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {isUrl ? preview : `${charCount.toLocaleString('uz-UZ')} belgi`}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label={`"${source.title}" manbasini o'chirish`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddUrlForm({ onAdd, onCancel }: { onAdd: (s: SourceItem) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Havolani kiriting');
      return;
    }
    if (!trimmedUrl.match(/^https?:\/\/.+/i)) {
      setError('Havola http:// yoki https:// bilan boshlanishi kerak');
      return;
    }
    onAdd({ id: genId(), type: 'url', title: title.trim().slice(0, MAX_TITLE) || `Manba ${Date.now()}`, url: trimmedUrl, charCount: 0 });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Sarlavha (ixtiyoriy)"
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        maxLength={MAX_TITLE}
        aria-label="Manba sarlavhasi"
      />
      <input
        type="url"
        value={url}
        onChange={e => { setUrl(e.target.value); setError(''); }}
        placeholder="https://..."
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        aria-label="Manba havolasi"
        aria-invalid={!!error}
      />
      {error && <p className="text-[10px] text-red-500" role="alert">{error}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          className="flex-1 text-[11px] font-bold py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          style={{ minHeight: '44px' }}
        >
          Qo'shish
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-[11px] font-bold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          style={{ minHeight: '44px' }}
        >
          Bekor
        </button>
      </div>
    </div>
  );
}

function AddTextForm({ onAdd, onCancel }: { onAdd: (s: SourceItem) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(100, ta.scrollHeight) + 'px';
    }
  }, [content]);

  const submit = () => {
    if (!content.trim()) return;
    onAdd({
      id: genId(),
      type: 'text',
      title: title.trim().slice(0, MAX_TITLE) || `Manba ${Date.now()}`,
      content: content.slice(0, MAX_SOURCE_TEXT),
      charCount: content.length,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Sarlavha (ixtiyoriy)"
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        maxLength={MAX_TITLE}
        aria-label="Manba sarlavhasi"
      />
      <textarea
        ref={taRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Manba matnini shu yerga kiriting..."
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400 resize-none overflow-y-auto"
        style={{ minHeight: '100px' }}
        maxLength={MAX_SOURCE_TEXT}
        aria-label="Manba matni"
      />
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-400">{content.length.toLocaleString('uz-UZ')} belgi</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={submit}
            disabled={!content.trim()}
            className="flex-1 text-[11px] font-bold py-2 px-3 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
            style={{ minHeight: '44px' }}
          >
            Qo'shish
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-[11px] font-bold py-2 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ minHeight: '44px' }}
          >
            Bekor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File extraction ──────────────────────────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Use bundled worker (not CDN) to comply with CSP
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    textParts.push(pageText);
  }
  return textParts.join('\n\n');
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
      // Try to break at paragraph boundary
      const nextPara = text.indexOf('\n\n', end);
      const prevPara = text.lastIndexOf('\n\n', end);
      if (prevPara > start + maxLen * 0.5) {
        end = prevPara;
      } else if (nextPara < end + maxLen * 0.3) {
        end = nextPara;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
    while (start < text.length && text[start] === '\n') start++;
  }
  return chunks;
}

function baseName(name: string): string {
  return name.replace(/\.(pdf|docx)$/i, '');
}

interface FileExtractionState {
  fileName: string;
  status: 'extracting' | 'done' | 'error';
  error?: string;
  chunks?: { title: string; content: string; charCount: number }[];
}

function AddFileSource({ currentCount, onAdd, onDone }: {
  currentCount: number;
  onAdd: (s: SourceItem) => void;
  onDone: () => void;
}) {
  const [extractions, setExtractions] = useState<FileExtractionState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_SOURCES - currentCount;

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const validFiles = fileArr.filter(f => /\.(pdf|docx)$/i.test(f.name) && f.size <= MAX_FILE_SIZE);

    if (validFiles.length === 0) {
      setExtractions(prev => [...prev, {
        fileName: fileArr[0]?.name || 'Fayl',
        status: 'error',
        error: 'Faqat .pdf va .docx fayllar qabul qilinadi (15 MB gacha)',
      }]);
      return;
    }

    for (const file of validFiles) {
      const state: FileExtractionState = { fileName: file.name, status: 'extracting' };
      setExtractions(prev => [...prev, state]);
      const idx = extractions.length;

      try {
        const isPdf = /\.pdf$/i.test(file.name);
        const text = isPdf ? await extractPdfText(file) : await extractDocxText(file);

        if (!text.trim()) {
          setExtractions(prev => prev.map((e, i) =>
            i === idx ? { ...e, status: 'error', error: 'Bu faylda matn topilmadi. Skaner qilingan bo\'lishi mumkin, matnli fayl yuklang.' } : e
          ));
          continue;
        }

        const chunks = chunkText(text, MAX_SOURCE_TEXT);
        const base = baseName(file.name);

        if (chunks.length === 1) {
          const source: SourceItem = {
            id: genId(),
            type: 'file',
            title: base.slice(0, MAX_TITLE),
            content: chunks[0],
            fileKind: isPdf ? 'pdf' : 'docx',
            charCount: chunks[0].length,
          };
          onAdd(source);
          setExtractions(prev => prev.map((e, i) =>
            i === idx ? { ...e, status: 'done', chunks: [{ title: base, content: chunks[0], charCount: chunks[0].length }] } : e
          ));
        } else {
          // Multiple chunks — check if they fit
          if (currentCount + chunks.length > MAX_SOURCES) {
            setExtractions(prev => prev.map((e, i) =>
              i === idx ? { ...e, status: 'error', error: `${chunks.length} ta qismga bo'linadi, lekin limit yetarli emas (${remainingSlots} ta joy qoldi). Fayl qo'shilmadi.` } : e
            ));
            continue;
          }
          const chunkSources: SourceItem[] = chunks.map((c, ci) => ({
            id: genId(),
            type: 'file' as const,
            title: `${base} (${ci + 1}/${chunks.length})`.slice(0, MAX_TITLE),
            content: c,
            fileKind: (isPdf ? 'pdf' : 'docx') as 'pdf' | 'docx',
            charCount: c.length,
          }));
          chunkSources.forEach(s => onAdd(s));
          setExtractions(prev => prev.map((e, i) =>
            i === idx ? { ...e, status: 'done', chunks: chunks.map((c, ci) => ({ title: `${base} (${ci + 1}/${chunks.length})`, content: c, charCount: c.length })) } : e
          ));
        }
      } catch {
        setExtractions(prev => prev.map((e, i) =>
          i === idx ? { ...e, status: 'error', error: 'Faylni o\'qib bo\'lmadi. Fayl buzilgan yoki parolli bo\'lishi mumkin.' } : e
        ));
      }
    }
  }, [extractions.length, currentCount, remainingSlots, onAdd]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleClose = () => {
    setExtractions([]);
    onDone();
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => inputRef.current?.click()}
        className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
        role="button"
        tabIndex={0}
        aria-label="Fayl tanlash yoki shu yerga tashlash"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
        <p className="text-[11px] font-bold text-gray-600">Fayl tanlang yoki shu yerga tashlang</p>
        <p className="text-[10px] text-gray-400 mt-0.5">PDF, Word (.docx) — 15 MB gacha</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {extractions.map((ext, i) => (
        <div key={i} className={`rounded-lg border p-2 ${
          ext.status === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-2">
            {ext.status === 'extracting' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />}
            {ext.status === 'done' && <File className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            {ext.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-700 truncate">{ext.fileName}</p>
              {ext.status === 'extracting' && <p className="text-[10px] text-gray-400">Matn ajratilmoqda…</p>}
              {ext.status === 'done' && ext.chunks && (
                <p className="text-[10px] text-gray-400">
                  {ext.chunks.length === 1
                    ? `${ext.chunks[0].charCount.toLocaleString('uz-UZ')} belgi`
                    : `${ext.chunks.length} ta qism, ${ext.chunks.reduce((a, c) => a + c.charCount, 0).toLocaleString('uz-UZ')} belgi`}
                </p>
              )}
              {ext.status === 'error' && <p className="text-[10px] text-red-500" role="alert">{ext.error}</p>}
            </div>
            {ext.status === 'error' && (
              <button
                type="button"
                onClick={() => setExtractions(prev => prev.filter((_, j) => j !== i))}
                className="shrink-0 p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Xato xabarni yopish"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 text-[11px] font-bold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          style={{ minHeight: '44px' }}
        >
          Tayyor
        </button>
      </div>
    </div>
  );
}
