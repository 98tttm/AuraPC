const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, PageBreak, TabStopType, TabStopPosition } = require('docx');
const fs = require('fs');

// ===== STYLE CONFIG =====
const FONT = 'Times New Roman';
const FONT_SIZE = 26; // 13pt
const H1_SIZE = 32;
const H2_SIZE = 28;
const H3_SIZE = 26;
const H4_SIZE = 26;
const LINE_SPACING = 360; // 1.5 line

// ===== HELPERS =====
function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || FONT_SIZE, bold: opts.bold, italics: opts.italics, color: opts.color || '000000', underline: opts.underline ? {} : undefined });
}

function p(text, opts = {}) {
  const children = [];
  // Parse **bold** and *italic* markers
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      children.push(run(part.slice(2, -2), { ...opts, bold: true }));
    } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      children.push(run(part.slice(1, -1), { ...opts, italics: true }));
    } else if (part) {
      children.push(run(part, opts));
    }
  }
  return new Paragraph({
    spacing: { after: 120, line: opts.lineSpacing || LINE_SPACING },
    indent: opts.indent ? { firstLine: 720 } : undefined,
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children,
  });
}

function heading(level, text) {
  const sizes = [H1_SIZE, H2_SIZE, H3_SIZE, H4_SIZE];
  const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
  return new Paragraph({
    heading: headingLevels[level - 1],
    spacing: { before: level <= 2 ? 360 : 240, after: 200, line: LINE_SPACING },
    children: [run(text, { size: sizes[level - 1], bold: true })],
  });
}

function h1(t) { return heading(1, t); }
function h2(t) { return heading(2, t); }
function h3(t) { return heading(3, t); }
function h4(t) { return heading(4, t); }

function bullet(text, level = 0) {
  const children = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      children.push(run(part.slice(2, -2), { bold: true }));
    } else if (part) {
      children.push(run(part));
    }
  }
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 80, line: LINE_SPACING },
    children,
  });
}

function numberedItem(text, level = 0) {
  const children = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      children.push(run(part.slice(2, -2), { bold: true }));
    } else if (part) {
      children.push(run(part));
    }
  }
  return new Paragraph({
    numbering: { reference: 'numbers', level },
    spacing: { after: 80, line: LINE_SPACING },
    children,
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 60, after: 60 }, children: [] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// Table helpers
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const tBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const cellPad = { top: 60, bottom: 60, left: 100, right: 100 };

function makeTable(colWidths, headers, rows) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        children: headers.map((h, i) => new TableCell({
          borders: tBorders,
          width: { size: colWidths[i], type: WidthType.DXA },
          shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
          margins: cellPad,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(h, { bold: true, size: 24 })] })],
        })),
      }),
      ...rows.map(row => new TableRow({
        children: row.map((c, i) => new TableCell({
          borders: tBorders,
          width: { size: colWidths[i], type: WidthType.DXA },
          margins: cellPad,
          children: [new Paragraph({ children: [run(c, { size: 24 })] })],
        })),
      })),
    ],
  });
}

function figureCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200 },
    children: [run(text, { italics: true, size: 24 })],
  });
}

module.exports = {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, LevelFormat, PageBreak,
  run, p, h1, h2, h3, h4, bullet, numberedItem, spacer, pageBreak,
  makeTable, figureCaption, FONT, FONT_SIZE, LINE_SPACING,
  thinBorder, tBorders, cellPad,
};
