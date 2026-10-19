export { useLexNames } from '@/hooks/useLexNames';
export { useTypewriter } from '@/hooks/useTypewriter';

export type LexNames = Readonly<Record<string, string>>;

/** Remove machine citation markers, not substantive legal references. */
export function stripSourceWords(text: string): string {
  return text
    .replace(/\uE200[^\uE201]*\uE201/g, '')
    .replace(/【[^】]*†[^】]*】/g, '')
    .replace(/\[(?:sources?|manbalar?)\]/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** Preserve Markdown used by AnswerText while cleaning transport artifacts. */
export function prepareAnswer(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n').trim();
  const unfenced = normalized.replace(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/i, '$1');
  return stripSourceWords(unfenced).replace(/\n{3,}/g, '\n\n');
}

/** Document IDs are shared by the language-specific Lex.uz URL variants. */
export function lexDocumentId(url: string): string | null {
  return url.match(/(?:^|\/)docs\/(-?\d+)(?:[/?#]|$)/i)?.[1] ?? null;
}

export function lexDocName(url: string, names: LexNames = {}): string {
  const id = lexDocumentId(url);
  const baseUrl = url.split(/[?#]/)[0].replace(/\/$/, '');
  return names[url] || names[baseUrl] || (id ? names[id] : '') || 'Qonun hujjati · Lex.uz';
}
