// shablonlar — "Ariza namunalari" uchun shablon ma'lumotlari va .docx yig'uvchi
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { MEHNAT_SHABLONLAR } from './shablon-mehnat';
import { FUQAROLIK_SHABLONLAR } from './shablon-fuqarolik';
import { SHIKOYAT_SHABLONLAR } from './shablon-shikoyat';
import { MEHNAT2_SHABLONLAR } from './shablon-mehnat2';
import { OILA_SHABLONLAR } from './shablon-oila';
import { ZARAR_SHABLONLAR } from './shablon-zarar';
import { MULK_SHABLONLAR } from './shablon-mulk';
import { PROTSESS_SHABLONLAR } from './shablon-protsess';

export interface Field {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

export interface Shablon {
  id: string;
  title: string;
  short: string;
  fields: Field[];
  body: string; // {{key}} o'rinbosarlar
}

// Har bir guruh o'z faylida (yurxizmat.uz rasmiy namunalari, moddalar lex.uz'da tekshirilgan)
const byId = (id: string) => [...MEHNAT_SHABLONLAR, ...FUQAROLIK_SHABLONLAR, ...SHIKOYAT_SHABLONLAR].filter((s) => s.id === id);

export const BOLIMLAR: { nomi: string; shablonlar: Shablon[] }[] = [
  { nomi: 'Mehnat nizolari', shablonlar: [...MEHNAT_SHABLONLAR, ...MEHNAT2_SHABLONLAR, ...byId('mehnat-inspeksiya')] },
  { nomi: 'Oila va aliment', shablonlar: [...byId('aliment'), ...OILA_SHABLONLAR] },
  { nomi: "Qarz, zarar va iste'molchi", shablonlar: [...byId('qarz'), ...ZARAR_SHABLONLAR, ...byId('istemolchi')] },
  { nomi: 'Mulk, ijara va meros', shablonlar: MULK_SHABLONLAR },
  { nomi: 'Sud jarayoni: shikoyat va arizalar', shablonlar: PROTSESS_SHABLONLAR },
];

export const SHABLONLAR: Shablon[] = BOLIMLAR.flatMap((b) => b.shablonlar);

export function renderMatn(sh: Shablon, values: Record<string, string>): string {
  return sh.body.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k]?.trim() || '________');
}

export async function yuklabOlDocx(sh: Shablon, values: Record<string, string>) {
  saveAs(await Packer.toBlob(arizaDocx(sh, values)), `${sh.id}.docx`);
}

/** Rasmiy ko'rinishdagi .docx (A4, Times New Roman 14) — brauzerda ham, sinov skriptida ham bir xil. */
export function arizaDocx(sh: Shablon, values: Record<string, string>): Document {
  const cm = (n: number) => Math.round(n * 567); // 1 sm = 567 twip
  const lines = renderMatn(sh, values).split('\n');
  const norm = (t: string) => t.replace(/['ʼʻ’‘`]/g, "'").toUpperCase();
  // Sarlavha: birinchi "DA'VO ARIZASI" / "SHIKOYAT" / "...NOMA" kabi bosh harfli qator; undan oldingisi — o'ngdagi blok
  const isTitle = (t: string) => /^[A-Z' -]{5,60}$/.test(norm(t)) && t === t.toUpperCase() && /ARIZA|SHIKOYAT|NOMA/.test(norm(t));
  const titleIdx = lines.findIndex((l) => isTitle(l.trim()));
  const ilovaIdx = lines.findIndex((l, i) => i > titleIdx && /^ILOVA/.test(norm(l.trim())));
  const children = lines.map((line, i) => {
    const t = line.trim();
    const header = i < titleIdx;
    const title = i === titleIdx || (i === titleIdx + 1 && t.startsWith('(') && t.endsWith(')'));
    const center = title || norm(t) === "SO'RAYMAN:";
    const left = header || (ilovaIdx >= 0 && i >= ilovaIdx);
    return new Paragraph({
      children: [new TextRun({ text: (header ? t : line).replace(/([oOgG])'/g, '$1ʻ').replace(/'/g, 'ʼ'), font: 'Times New Roman', size: 28, bold: center })],
      alignment: center ? AlignmentType.CENTER : left ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      indent: header ? { left: cm(8.5) } : center || left || !t ? undefined : { firstLine: cm(1.25) },
      spacing: { line: 276, before: i === titleIdx ? 240 : 0, after: 0 },
    });
  });
  return new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 28 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: cm(2), bottom: cm(2), right: cm(2), left: cm(3) } } },
      children,
    }],
  });
}
