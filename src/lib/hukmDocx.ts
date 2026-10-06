// hukmDocx — Word .docx eksport uchun yordamchi
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';

interface Q {
  text: string;
  options: { text: string; is_correct: boolean }[];
  explanation: string;
  legal_basis: string;
  time_limit_s: number;
  source?: string;
  basis_check?: string | null;
}

function uz(s: string): string {
  return s.replace(/'/g, '\u2019');
}

export async function exportHukmDocx(title: string, questions: Q[], options?: { withAnswers?: boolean; withExplanations?: boolean; shuffle?: boolean }) {
  const withAnswers = options?.withAnswers ?? true;
  const withExplanations = options?.withExplanations ?? true;
  const shuffle = options?.shuffle ?? false;

  const dateStr = new Date().toLocaleDateString('uz-UZ');
  const cleanTitle = title.replace(/[^\w\s\-]/g, '').trim() || 'Viktorina';

  const children: Paragraph[] = [];

  // Sarlavha
  children.push(new Paragraph({
    children: [new TextRun({ text: uz(title), bold: true, size: 28, font: 'Times New Roman' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: uz(`Sana: ${dateStr}`), size: 22, font: 'Times New Roman', color: '666666' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  if (!withAnswers) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'F.I.Sh.: __________________', size: 22, font: 'Times New Roman' })],
      spacing: { after: 100 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Guruh: __________________', size: 22, font: 'Times New Roman' })],
      spacing: { after: 400 },
    }));
  }

  questions.forEach((q, i) => {
    // Savol
    children.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}. ${uz(q.text)}`, bold: true, size: 22, font: 'Times New Roman' })],
      spacing: { before: 200, after: 100 },
    }));

    // Variantlar
    let opts = [...q.options];
    if (shuffle) {
      opts = opts.sort(() => Math.random() - 0.5);
    }
    opts.forEach((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      const prefix = withAnswers && opt.is_correct ? '✓ ' : '';
      children.push(new Paragraph({
        children: [new TextRun({ text: `${prefix}${letter}) ${uz(opt.text)}`, size: 22, font: 'Times New Roman', bold: withAnswers && opt.is_correct })],
        indent: { left: 720 },
        spacing: { after: 60 },
      }));
    });

    // Izoh va asos modda
    if (withAnswers && withExplanations) {
      if (q.explanation) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Izoh: ${uz(q.explanation)}`, size: 20, font: 'Times New Roman', italics: true, color: '444444' })],
          indent: { left: 360 },
          spacing: { before: 80, after: 40 },
        }));
      }
      if (q.legal_basis) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `Asos: ${uz(q.legal_basis)}`, size: 20, font: 'Times New Roman', italics: true, color: '8A5F0A' })],
          indent: { left: 360 },
          spacing: { after: 80 },
        }));
      }
    }
  });

  // Javoblar kaliti (agar tanlangan bo'lsa)
  if (withAnswers) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Javoblar kaliti:', bold: true, size: 22, font: 'Times New Roman' })],
      spacing: { before: 400, after: 100 },
    }));
    const answerText = questions.map((q, i) => {
      const correctIdx = q.options.findIndex(o => o.is_correct);
      return `${i + 1}-${String.fromCharCode(65 + correctIdx)}`;
    }).join('  ');
    children.push(new Paragraph({
      children: [new TextRun({ text: answerText, size: 22, font: 'Times New Roman' })],
      spacing: { after: 200 },
    }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Hukm-${cleanTitle}-${dateStr}.docx`);
}
