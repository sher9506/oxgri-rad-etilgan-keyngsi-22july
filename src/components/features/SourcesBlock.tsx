import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, FileText, X, ChevronDown, BookOpen, Upload, Loader2, AlertCircle, File } from 'lucide-react';
import type { SourceItem } from '@/hooks/useAiAnswerJob';
import { supabase } from '@/lib/supabase';

const MAX_SOURCES = 18;
const MAX_SOURCE_TEXT = 100000;
const MAX_TITLE = 120;
const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40 MB

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
  teacherId?: string;
}

function genId() {
  return `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let _fileSourcesFlag: boolean | null = null;
async function fetchFileSourcesFlag(): Promise<boolean> {
  if (_fileSourcesFlag !== null) return _fileSourcesFlag;
  try {
    const { data } = await supabase
      .from('settings')
      .select('text_value')
      .eq('key', 'answer_file_sources_enabled')
      .maybeSingle();
    _fileSourcesFlag = data?.text_value === 'true';
  } catch {
    _fileSourcesFlag = false;
  }
  return _fileSourcesFlag;
}

export function SourcesBlock({ sources, onAdd, onRemove, linkedModdalar, onAddModdalar, teacherId }: SourcesBlockProps) {
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
              teacherId={teacherId}
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SourceRow({ source, onRemove }: { source: SourceItem; onRemove: () => void }) {
  const isModda = source.title.startsWith('Modda ');
  const isUrl = source.type === 'url';
  const isFile = source.type === 'file';
  const isStorageFile = isFile && !source.content && !!source.storagePath;
  const charCount = source.charCount || (source.type !== 'url' && source.content ? source.content.length : 0);

  const preview = isUrl
    ? source.url
    : source.type !== 'url' && source.content
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
          {isUrl ? preview : isStorageFile ? formatFileSize(source.fileSize || 0) : `${charCount.toLocaleString('uz-UZ')} belgi`}
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
            className="flex-1 text-[11px] font-bold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            style={{ minHeight: '44px' }}
          >
            Bekor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── File extraction (used when answer_file_sources_enabled = FALSE) ──
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
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
  const fullText = textParts.join('\n\n');
  console.log(`[SourcesBlock] PDF: ${file.name}, ${pdf.numPages} sahifa, ${fullText.length} belgi`);
  return fullText;
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  console.log(`[SourcesBlock] DOCX: ${file.name}, ${result.value.length} belgi`);
  return result.value;
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLen;
    if (end < text.length) {
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
  status: 'uploading' | 'extracting' | 'done' | 'error';
  error?: string;
  chunks?: { title: string; content: string; charCount: number }[];
  fileSize?: number;
}

// Sanitize filename: remove non-ASCII, spaces, special chars; keep extension
function safeFileName(originalName: string): string {
  const ext = originalName.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
  const base = ext ? originalName.slice(0, -(ext.length + 1)) : originalName;
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'file';
  return ext ? `${safeBase}.${ext}` : safeBase;
}

// Upload file to Supabase Storage (case-sources bucket)
async function uploadToStorage(
  file: File,
  teacherId: string
): Promise<{ path: string; size: number } | null> {
  const fileId = crypto.randomUUID();
  const safeName = safeFileName(file.name);
  const ext = safeName.split('.').pop() || '';
  const path = `${teacherId}/${fileId}/${safeName}`;

  const { error } = await supabase.storage
    .from('case-sources')
    .upload(path, file, {
      contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      upsert: false,
    });

  if (error) {
    console.error('[SourcesBlock] Storage upload error:', error.message);
    return null;
  }
  return { path, size: file.size };
}

function AddFileSource({ currentCount, onAdd, onDone, teacherId }: {
  currentCount: number;
  onAdd: (s: SourceItem) => void;
  onDone: () => void;
  teacherId?: string;
}) {
  const [extractions, setExtractions] = useState<FileExtractionState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileMode, setFileMode] = useState<'storage' | 'extract' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const remainingSlots = MAX_SOURCES - currentCount;

  // Determine mode once on mount
  useEffect(() => {
    fetchFileSourcesFlag().then(flag => {
      setFileMode(flag ? 'storage' : 'extract');
    });
  }, []);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (!fileMode) return;
    const fileArr = Array.from(files);

    for (const file of fileArr) {
      // Validate extension
      if (!/\.(pdf|docx)$/i.test(file.name)) {
        setExtractions(prev => [...prev, {
          fileName: file.name,
          status: 'error',
          error: 'Faqat PDF yoki Word (.docx) qabul qilinadi',
        }]);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        setExtractions(prev => [...prev, {
          fileName: file.name,
          status: 'error',
          error: `Fayl juda katta (maksimum 40MB)`,
        }]);
        continue;
      }

      const idx = extractions.length;
      const isPdf = /\.pdf$/i.test(file.name);

      if (fileMode === 'storage') {
        // ── Storage mode: upload file, no text extraction ──
        setExtractions(prev => [...prev, {
          fileName: file.name,
          status: 'uploading',
          fileSize: file.size,
        }]);

        try {
          if (!teacherId) {
            setExtractions(prev => prev.map((e, i) =>
              i === idx ? { ...e, status: 'error', error: 'Fayl yuklash uchun tizimga kirish kerak' } : e
            ));
            continue;
          }

          const result = await uploadToStorage(file, teacherId);
          if (!result) {
            setExtractions(prev => prev.map((e, i) =>
              i === idx ? { ...e, status: 'error', error: 'Fayl yuklanmadi. Keyinroq urinib ko\'ring.' } : e
            ));
            continue;
          }

          const source: SourceItem = {
            id: genId(),
            type: 'file',
            title: baseName(file.name).slice(0, MAX_TITLE),
            content: '',
            fileKind: isPdf ? 'pdf' : 'docx',
            charCount: 0,
            storagePath: result.path,
            fileSize: result.size,
          };
          onAdd(source);
          setExtractions(prev => prev.map((e, i) =>
            i === idx ? { ...e, status: 'done', fileSize: result.size } : e
          ));
        } catch {
          setExtractions(prev => prev.map((e, i) =>
            i === idx ? { ...e, status: 'error', error: 'Fayl yuklanmadi. Keyinroq urinib ko\'ring.' } : e
          ));
        }
      } else {
        // ── Extract mode: text extraction in browser (original behavior) ──
        setExtractions(prev => [...prev, {
          fileName: file.name,
          status: 'extracting',
          fileSize: file.size,
        }]);

        try {
          const text = isPdf ? await extractPdfText(file) : await extractDocxText(file);

          if (!text.trim()) {
            setExtractions(prev => prev.map((e, i) =>
              i === idx ? { ...e, status: 'error', error: 'Bu faylda matn topilmadi. Skaner qilingan bo\'lishi mumkin, matnli fayl yuklang.' } : e
            ));
            continue;
          }

          if (text.trim().length < 50) {
            setExtractions(prev => prev.map((e, i) =>
              i === idx ? { ...e, status: 'error', error: `Fayldan atigi ${text.trim().length} belgi o'qildi. Skaner qilingan PDF yoki bo'sh Word fayl bo'lishi mumkin.` } : e
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
    }
  }, [extractions.length, currentCount, remainingSlots, onAdd, fileMode]);

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

  const sizeLabel = fileMode === 'storage' ? '40 MB gacha' : '15 MB gacha';

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
        <p className="text-[10px] text-gray-400 mt-0.5">PDF, Word (.docx) — {sizeLabel}</p>
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
            {(ext.status === 'extracting' || ext.status === 'uploading') && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 shrink-0" />}
            {ext.status === 'done' && <File className="h-3.5 w-3.5 text-green-500 shrink-0" />}
            {ext.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-700 truncate">{ext.fileName}</p>
              {ext.status === 'uploading' && <p className="text-[10px] text-gray-400">Yuklanmoqda…</p>}
              {ext.status === 'extracting' && <p className="text-[10px] text-gray-400">Matn ajratilmoqda…</p>}
              {ext.status === 'done' && ext.chunks && (
                <p className="text-[10px] text-gray-400">
                  {ext.chunks.length === 1
                    ? `${ext.chunks[0].charCount.toLocaleString('uz-UZ')} belgi`
                    : `${ext.chunks.length} ta qism, ${ext.chunks.reduce((a, c) => a + c.charCount, 0).toLocaleString('uz-UZ')} belgi`}
                </p>
              )}
              {ext.status === 'done' && !ext.chunks && ext.fileSize && (
                <p className="text-[10px] text-gray-400">{formatFileSize(ext.fileSize)}</p>
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
