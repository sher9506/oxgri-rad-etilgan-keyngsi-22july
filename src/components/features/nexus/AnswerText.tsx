import { useMemo, type ReactNode } from 'react';

const PUNCT = '.,;:!?';

function cleanText(raw: string): string {
  let t = raw.replace(/\r\n/g, '\n');
  t = t.replace(new RegExp(`[ \\t]+([${PUNCT}])`, 'g'), '$1');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function stripMarkdown(s: string): string {
  return s.replace(/^#+\s*/, '').replace(/^\*{1,2}(.*?)\*{1,2}$/, '$1').trim();
}

function isHeading(line: string, blockCount: number): boolean {
  if (blockCount < 2) return false;
  if (line.includes('\n')) return false;
  if (line.length > 70) return false;
  const stripped = stripMarkdown(line);
  if (!stripped) return false;
  const last = stripped[stripped.length - 1];
  return !PUNCT.includes(last);
}

const LIST_BULLET = /^[-\u2022*]\s+/;
const LIST_NUMBERED = /^\d+[.)]\s+/;

function isListItem(line: string): boolean {
  return LIST_BULLET.test(line) || LIST_NUMBERED.test(line);
}

function isBullet(line: string): boolean {
  return LIST_BULLET.test(line);
}

function stripListMarker(line: string): string {
  return line.replace(LIST_BULLET, '').replace(LIST_NUMBERED, '').trim();
}

// [217-modda](https://lex.uz/docs/...#:~:text=...) — javobdagi iqtibos: lex.uz'da aynan o'sha gapni ochadi.
// Faqat https://lex.uz havolalari qabul qilinadi (boshqa manzil oddiy matn bo'lib qoladi).
// Iqtibos tugmasi ([1] o'rnida): "217-modda", "47⁴-modda", "Plenum №4", "lex.uz". Qolganlari — matn ichidagi modda eslatmasi.
const CITE_CHIP = /^(\d+[⁰¹²³⁴⁵⁶⁷⁸⁹]*-modda|Plenum №\d+|[A-Z][A-Z']{0,4}-\d[\w/-]*|№[\w/-]+|lex\.uz)$/;
const CITE_LINK = /\[([^\]\n]{1,40})\]\((https:\/\/lex\.uz\/[^)\s]+)\)/g;

/**
 * Ekranda havolalar ko'payib ketmasin:
 *  1) matn ichidagi bir xil havola faqat birinchi uchraganda havola, keyingisi oddiy matn;
 *  2) shu havola oldinroq ko'rsatilgan bo'lsa, gap oxiridagi tugma ("161-modda") chiqmaydi;
 *  3) Plenum / hujjat tugmasi ("Plenum №26", "lex.uz") bitta abzatsda bir marta.
 */
export function dedupeLinks(text: string): string {
  const seen = new Set<string>();
  return text.split(/(\n\s*\n)/).map((para) => {
    const docChips = new Set<string>();
    return para.replace(/(, )?\[([^\]\n]{1,40})\]\((https:\/\/lex\.uz\/[^)\s]+)\)/g, (m, sep: string | undefined, label: string, href: string) => {
      const chip = CITE_CHIP.test(label);
      if (chip && !/^\d/.test(label)) {           // Plenum / farmon / lex.uz tugmasi: abzatsda hujjat bo'yicha bir marta
        const doc = href.split('#')[0];
        if (docChips.has(doc)) return '';
        docChips.add(doc);
        return m;
      }
      if (seen.has(href)) return chip ? '' : (sep ?? '') + label;
      seen.add(href);
      return m;
    }).replace(/(\s), (?=\[)/g, '$1');   // birinchi tugma olib tashlansa, qolgan "  , [..]" vergulsiz
  }).join('');
}

function renderBold(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) nodes.push(<span key={`${keyBase}-t${i}`}>{parts[i]}</span>);
    } else {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{parts[i]}</strong>);
    }
  }
  return nodes;
}

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(CITE_LINK)) {
    nodes.push(...renderBold(text.slice(last, m.index), `${keyBase}-s${k}`));
    nodes.push(
      <a key={`${keyBase}-c${k}`} className={CITE_CHIP.test(m[1]) ? 'nc-cite' : 'nc-lawlink'} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>
    );
    last = (m.index ?? 0) + m[0].length;
    k++;
  }
  nodes.push(...renderBold(text.slice(last), `${keyBase}-s${k}`));
  return nodes;
}

function boldLead(text: string, keyBase: string): ReactNode[] {
  if (text.startsWith('http')) return renderInline(text, keyBase);
  const colonIdx = text.replace(CITE_LINK, m => '_'.repeat(m.length)).indexOf(':');   // havola ichidagi "https:" hisoblanmaydi
  if (colonIdx > 0 && colonIdx <= 60 && !text.slice(0, colonIdx).includes('\n')) {
    const lead = text.slice(0, colonIdx + 1);
    const rest = text.slice(colonIdx + 1);
    const nodes: ReactNode[] = [<strong key={`${keyBase}-lead`}>{lead}</strong>];
    if (rest) nodes.push(...renderInline(rest, `${keyBase}-rest`));
    return nodes;
  }
  return renderInline(text, keyBase);
}

interface Block {
  type: 'heading' | 'ul' | 'ol' | 'para';
  lines: string[];
}

function parseBlocks(text: string): Block[] {
  const rawBlocks = text.split(/\n\n+/);
  const blocks: Block[] = [];

  for (const rawBlock of rawBlocks) {
    const blockText = rawBlock.trim();
    if (!blockText) continue;
    const lines = blockText.split('\n');

    if (isHeading(blockText, rawBlocks.filter(b => b.trim()).length)) {
      blocks.push({ type: 'heading', lines: [stripMarkdown(blockText)] });
      continue;
    }

    const allList = lines.every(l => isListItem(l.trim()));
    if (allList && lines.length > 0) {
      const isOl = !isBullet(lines[0].trim()) && LIST_NUMBERED.test(lines[0].trim());
      blocks.push({ type: isOl ? 'ol' : 'ul', lines: lines.map(l => stripListMarker(l.trim())) });
      continue;
    }

    blocks.push({ type: 'para', lines });
  }

  return blocks;
}

export default function AnswerText({ text, typing = false }: { text: string; typing?: boolean }) {
  const blocks = useMemo(() => {
    const cleaned = cleanText(dedupeLinks(typing ? text.replace(/\s*\[[^\]\n]*(?:\]\([^)\s]*)?$/, '') : text));
    if (!cleaned) return [];
    return parseBlocks(cleaned);
  }, [text, typing]);

  return (
    <div className={`nc-answer ${typing ? 'nc-answer-typing' : ''}`} aria-live={typing ? 'off' : 'polite'}>
      {blocks.map((block, i) => {
        const key = `b${i}`;
        if (block.type === 'heading') {
          return (
            <h3 key={key} className="nc-answer-h">
              {renderInline(block.lines[0], key)}
            </h3>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={key} className="nc-answer-list">
              {block.lines.map((li, j) => (
                <li key={`${key}-li${j}`}>{boldLead(li, `${key}-li${j}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={key} className="nc-answer-list">
              {block.lines.map((li, j) => (
                <li key={`${key}-li${j}`}>{boldLead(li, `${key}-li${j}`)}</li>
              ))}
            </ol>
          );
        }
        const paraText = block.lines.join('\n');
        return (
          <p key={key} className="nc-answer-p">
            {boldLead(paraText, key)}
          </p>
        );
      })}
    </div>
  );
}
