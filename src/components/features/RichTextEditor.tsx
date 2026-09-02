/**
 * RichTextEditor — Word/DOCX formatini saqlagan holda paste qilish imkoniyati.
 * - Word dan nusxa ko'chirilganda formatlash (bo'linmalar, qalinlik, kursiv) saqlanadi
 * - AI tahlili uchun plain text chiqarish usuli mavjud
 * - AI mantig'iga ta'sir qilmaydi
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
  disablePaste?: boolean;
  className?: string;
}

export interface RichTextEditorRef {
  /** AI uchun sof matn (HTML tegsiz) */
  getPlainText: () => string;
  focus: () => void;
}

// ── Word HTML-ni tozalash (ortiqcha Word-specific atribut va teglar olib tashlanadi) ──
function cleanWordHtml(html: string): string {
  // DOM parser yordamida tozalash
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function processNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;

      // Word-specific atributlarni olib tashlash
      const attrsToRemove = [];
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (
          attr.name.startsWith('v:') ||
          attr.name.startsWith('o:') ||
          attr.name.startsWith('w:') ||
          attr.name === 'lang' ||
          attr.name === 'xml:lang' ||
          (attr.name === 'class' && /Mso|mso/.test(attr.value)) ||
          (attr.name === 'style' && /mso-|font-family.*Calibri|font-family.*Times/i.test(attr.value))
        ) {
          attrsToRemove.push(attr.name);
        }
      }
      attrsToRemove.forEach(a => el.removeAttribute(a));

      // style atributini tozalash (faqat muhim qismlar qoldiradi)
      const style = el.getAttribute('style');
      if (style) {
        const allowed = style
          .split(';')
          .map(s => s.trim())
          .filter(s => {
            const prop = s.split(':')[0]?.trim().toLowerCase();
            return [
              'font-weight', 'font-style', 'text-decoration',
              'text-align', 'margin-left', 'padding-left',
            ].includes(prop);
          })
          .join('; ');
        if (allowed) el.setAttribute('style', allowed);
        else el.removeAttribute('style');
      }

      // Barcha bolalarni rekursiv qayta ishlash
      Array.from(node.childNodes).forEach(processNode);
    }
  }

  processNode(doc.body);

  // Keraksiz Word teglarini sof teglarga almashtirish
  let result = doc.body.innerHTML;

  // <o:p> — Word paragraf teglari
  result = result.replace(/<o:p[^>]*>/gi, '').replace(/<\/o:p>/gi, '');
  // <w:...> teglar
  result = result.replace(/<w:[^>]+>/gi, '').replace(/<\/w:[^>]+>/gi, '');
  // <m:...> math teglar
  result = result.replace(/<m:[^>]+>/gi, '').replace(/<\/m:[^>]+>/gi, '');
  // XML namespace declarations
  result = result.replace(/xmlns[^=]*="[^"]*"/gi, '');
  // Multiple empty paragraphs
  result = result.replace(/(<p[^>]*>\s*<\/p>\s*){3,}/gi, '<p></p><p></p>');
  // Empty spans
  result = result.replace(/<span[^>]*>\s*<\/span>/gi, '');
  // <div> -> <p>
  result = result.replace(/<div([^>]*)>/gi, '<p$1>').replace(/<\/div>/gi, '</p>');

  return result;
}

// ── Plain text: HTML teglarini olib tashlash (AI uchun) ──
export function htmlToPlainText(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // <br>, <p>, <div>, <li> ni newline bilan almashtirish
  function extract(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const inner = Array.from(node.childNodes).map(extract).join('');
      if (['p', 'div', 'br', 'li', 'tr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        return inner + '\n';
      }
      return inner;
    }
    return '';
  }

  return extract(doc.body)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Asosiy komponent ──────────────────────────────────────────────────────────
const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  ({ value, onChange, placeholder, minHeight = 160, readOnly = false, disablePaste = false, className = '' }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isComposing = useRef(false);
    const lastHtml = useRef('');
    const [isFocused, setIsFocused] = useState(false);

    // Tashqi ref orqali usullarni expose qilish
    useImperativeHandle(ref, () => ({
      getPlainText: () => {
        const el = editorRef.current;
        if (!el) return '';
        return htmlToPlainText(el.innerHTML);
      },
      focus: () => editorRef.current?.focus(),
    }));

    // value prop o'zgarganda editorni yangilash (tashqaridan)
    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if (el.innerHTML !== value && !isFocused) {
        el.innerHTML = value || '';
        lastHtml.current = value || '';
      }
    }, [value, isFocused]);

    const handleInput = useCallback(() => {
      if (isComposing.current) return;
      const el = editorRef.current;
      if (!el) return;
      const html = el.innerHTML;
      if (html !== lastHtml.current) {
        lastHtml.current = html;
        onChange(html);
      }
    }, [onChange]);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      if (disablePaste) {
        e.preventDefault();
        return;
      }

      const clipboardData = e.clipboardData;

      // Word yoki boshqa HTML manba mavjudmi?
      const htmlContent = clipboardData.getData('text/html');
      const plainText = clipboardData.getData('text/plain');

      if (htmlContent && htmlContent.trim()) {
        e.preventDefault();

        // Word HTML-ini tozalash
        const cleaned = cleanWordHtml(htmlContent);

        // Hozirgi tanlangan joyga paste qilish
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();

          const fragment = document.createRange().createContextualFragment(cleaned);
          range.insertNode(fragment);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        // onChange ni chaqirish
        setTimeout(() => {
          const el = editorRef.current;
          if (el) {
            lastHtml.current = el.innerHTML;
            onChange(el.innerHTML);
          }
        }, 0);
      }
      // Plain text bo'lsa — oddiy paste (brauzer o'zi qiladi)
    }, [disablePaste, onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      // Tab bosilganda indent qo'shish
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      }
    }, []);

    const isEmpty = !value || value === '<br>' || value === '<p><br></p>' || value.trim() === '';

    return (
      <div
        className={`relative rounded-xl border-2 transition-all duration-200 ${
          isFocused
            ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.1)]'
            : 'border-gray-200 hover:border-gray-300'
        } ${readOnly ? 'bg-gray-50' : 'bg-white'} ${className}`}
      >
        {/* Placeholder */}
        {isEmpty && !isFocused && (
          <div
            className="absolute top-0 left-0 right-0 px-4 py-3 text-gray-400 text-sm pointer-events-none select-none"
            style={{ minHeight }}
          >
            {placeholder}
          </div>
        )}

        {/* Word paste belgisi */}
        {!readOnly && isFocused && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded-full pointer-events-none opacity-80">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
            </svg>
            Word paste qo'llab-quvvatlanadi
          </div>
        )}

        {/* Asosiy editor */}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onCompositionStart={() => { isComposing.current = true; }}
          onCompositionEnd={() => {
            isComposing.current = false;
            handleInput();
          }}
          style={{ minHeight }}
          className={`
            px-4 py-3 text-sm text-gray-800 leading-relaxed outline-none
            overflow-y-auto
            [&_p]:mb-2 [&_p:last-child]:mb-0
            [&_b]:font-bold [&_strong]:font-bold
            [&_i]:italic [&_em]:italic
            [&_u]:underline
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
            [&_li]:mb-1
            [&_h1]:text-xl [&_h1]:font-black [&_h1]:mb-2
            [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2
            [&_h3]:text-base [&_h3]:font-bold [&_h3]:mb-1
            [&_table]:border-collapse [&_table]:w-full [&_table]:mb-3
            [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm
            [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:font-bold [&_th]:bg-gray-50
          `}
        />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
