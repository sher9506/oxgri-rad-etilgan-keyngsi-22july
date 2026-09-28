import { useState, useRef, useEffect } from 'react';
import { Link, FileText, X, ChevronDown, BookOpen } from 'lucide-react';
import type { SourceItem } from '@/hooks/useAiAnswerJob';

const MAX_SOURCES = 10;
const MAX_SOURCE_TEXT = 100000;
const MAX_TITLE = 120;

interface SourcesBlockProps {
  sources: SourceItem[];
  onAdd: (source: SourceItem) => void;
  onRemove: (index: number) => void;
}

export function SourcesBlock({ sources, onAdd, onRemove }: SourcesBlockProps) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<'url' | 'text' | null>(null);

  const atLimit = sources.length >= MAX_SOURCES;

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
        style={{ maxHeight: open ? '2000px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="px-3 pb-3 space-y-2">
          {sources.length > 0 && (
            <div className="space-y-1.5">
              {sources.map((s, i) => (
                <SourceRow key={i} source={s} onRemove={() => onRemove(i)} />
              ))}
            </div>
          )}

          {adding === null && !atLimit && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAdding('url')}
                className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                aria-label="Havola manba qo'shish"
                style={{ minHeight: '44px' }}
              >
                <Link className="h-3 w-3" /> + Havola
              </button>
              <button
                type="button"
                onClick={() => setAdding('text')}
                className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold py-2 px-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                aria-label="Matn manba qo'shish"
                style={{ minHeight: '44px' }}
              >
                <FileText className="h-3 w-3" /> + Matn
              </button>
            </div>
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

          {atLimit && adding === null && (
            <p className="text-[10px] text-gray-400 text-center" title="Ko'pi bilan 10 ta manba">
              Ko'pi bilan 10 ta manba qo'shish mumkin
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
  const preview = isUrl ? source.url : source.content.slice(0, 80) + (source.content.length > 80 ? '…' : '');
  const badgeText = isModda ? 'Modda' : isUrl ? 'Havola' : 'Matn';
  const badgeClass = isModda
    ? 'bg-blue-100 text-blue-700 border-blue-200'
    : isUrl
    ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white border border-gray-200/80 group animate-in fade-in slide-in-from-top-1 duration-300"
    >
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
        {badgeText}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-gray-700 truncate">{source.title}</p>
        <p className="text-[10px] text-gray-400 truncate">{preview}</p>
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
    onAdd({ type: 'url', title: title.trim().slice(0, MAX_TITLE) || `Manba ${Date.now()}`, url: trimmedUrl });
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
      type: 'text',
      title: title.trim().slice(0, MAX_TITLE) || `Manba ${Date.now()}`,
      content: content.slice(0, MAX_SOURCE_TEXT),
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
        <span className="text-[9px] text-gray-400">{content.length} belgi</span>
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
