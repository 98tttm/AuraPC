const { Document, Packer, Paragraph, TextRun, Header, Footer, AlignmentType,
  HeadingLevel, PageNumber, LevelFormat, PageBreak, TabStopType } = require('docx');
const fs = require('fs');

const { run, p, h1, spacer, FONT, FONT_SIZE, LINE_SPACING } = require('./report-helpers');
const chapter1 = require('./ch1-overview');
const chapter2 = require('./ch2-theory');
const chapter3 = require('./ch3-analysis');
const chapter4 = require('./ch4-development');
const chapter5 = require('./ch5-conclusion');

// ===== COVER PAGE =====
function coverPage() {
  const center = AlignmentType.CENTER;
  const line = (text, size, bold = false, spacing = {}) => new Paragraph({
    alignment: center,
    spacing: { after: 0, ...spacing },
    children: [new TextRun({ text, font: FONT, size, bold })],
  });

  return [
    line('BỘ GIÁO DỤC VÀ ĐÀO TẠO', 28, true),
    line('TRƯỜNG ĐẠI HỌC KINH TẾ - LUẬT', 28, true),
    line('KHOA HỆ THỐNG THÔNG TIN', 28, true, { after: 600 }),

    new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),

    line('BÁO CÁO ĐỒ ÁN', 36, true),
    line('MÔN HỌC: PHÁT TRIỂN ỨNG DỤNG WEB', 28, true, { after: 400 }),

    new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),

    line('XÂY DỰNG WEBSITE THƯƠNG MẠI ĐIỆN TỬ', 40, true),
    line('AURAPC — NỀN TẢNG MUA SẮM PC GAMING', 40, true, { after: 600 }),

    new Paragraph({ spacing: { before: 300, after: 100 }, children: [] }),

    new Paragraph({
      alignment: center,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Giảng viên hướng dẫn: ', font: FONT, size: 26 }),
        new TextRun({ text: '..............................', font: FONT, size: 26 }),
      ],
    }),
    new Paragraph({
      alignment: center,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: 'Nhóm sinh viên thực hiện: ', font: FONT, size: 26 }),
        new TextRun({ text: '..............................', font: FONT, size: 26 }),
      ],
    }),

    new Paragraph({ spacing: { before: 600, after: 0 }, children: [] }),
    line('TP. Hồ Chí Minh, 2026', 26, false),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ===== TABLE OF CONTENTS (manual) =====
function tableOfContents() {
  const tocLine = (text, level = 0) => new Paragraph({
    spacing: { after: 60, line: 320 },
    indent: level > 0 ? { left: level * 360 } : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: level === 0 ? 26 : 24,
        bold: level === 0,
      }),
    ],
  });

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'MỤC LỤC', font: FONT, size: 32, bold: true })],
    }),

    tocLine('CHƯƠNG 1: TỔNG QUAN'),
    tocLine('1.1. Tổng quan về đồ án', 1),
    tocLine('1.1.1. Lý do chọn đề tài', 2),
    tocLine('1.1.2. Mục tiêu đồ án', 2),
    tocLine('1.2. Tổng quan về AuraPC', 1),
    tocLine('1.2.1. Ý nghĩa thương hiệu', 2),
    tocLine('1.2.2. Tầm nhìn - Sứ mệnh - Mục tiêu - Triết lý', 2),
    tocLine('1.2.4. Sản phẩm', 2),
    tocLine('1.3. Phân tích kinh doanh', 1),
    tocLine('1.3.1. Khách hàng mục tiêu', 2),
    tocLine('1.3.2. Phân tích thị trường', 2),
    tocLine('1.3.3. Phân tích đối thủ cạnh tranh', 2),
    spacer(),

    tocLine('CHƯƠNG 2: CƠ SỞ LÝ THUYẾT'),
    tocLine('2.1. Cơ sở lý thuyết', 1),
    tocLine('2.1.1. HyperText Markup Language', 2),
    tocLine('2.1.2. Cascading Style Sheets', 2),
    tocLine('2.1.3. JavaScript và TypeScript', 2),
    tocLine('2.1.4. HTTP và Cơ chế REST API', 2),
    tocLine('2.1.5. JSON Web Token (JWT)', 2),
    tocLine('2.1.6. Node.js và Express.js', 2),
    tocLine('2.1.7. Three.js và khái niệm 3D trên Web', 2),
    tocLine('2.1.8. Angular Framework', 2),
    tocLine('2.1.9. Cơ sở dữ liệu NoSQL', 2),
    tocLine('2.2. Công cụ sử dụng', 1),
    tocLine('2.2.1. MongoDB và Mongoose', 2),
    tocLine('2.2.2. Visual Studio Code', 2),
    tocLine('2.2.3. Git và GitHub', 2),
    tocLine('2.2.4. Draw.io', 2),
    tocLine('2.2.5. Figma', 2),
    tocLine('2.2.7. Postman', 2),
    tocLine('2.2.8. Blender', 2),
    tocLine('2.2.9. N8N', 2),
    spacer(),

    tocLine('CHƯƠNG 3: PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG'),
    tocLine('3.1. Sitemap', 1),
    tocLine('3.2. Sơ đồ Use Case', 1),
    tocLine('3.3. Sơ đồ BPMN', 1),
    tocLine('3.4. DFD (Data Flow Diagram)', 1),
    tocLine('3.5. Thiết kế cơ sở dữ liệu trên MongoDB', 1),
    spacer(),

    tocLine('CHƯƠNG 4: TỔ CHỨC VÀ XÂY DỰNG WEBSITE'),
    tocLine('4.1. Bộ nhận diện thương hiệu', 1),
    tocLine('4.2. Giao diện website (Frontend)', 1),
    tocLine('4.3. Phát triển website (Backend)', 1),
    spacer(),

    tocLine('CHƯƠNG 5: TỔNG KẾT'),
    tocLine('5.1. Đánh giá đồ án', 1),
    tocLine('5.2. Hướng phát triển trong tương lai', 1),

    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ===== MAIN =====
async function main() {
  console.log('Generating AuraPC Report...');

  const sections = [
    ...coverPage(),
    ...tableOfContents(),
    ...chapter1(),
    new Paragraph({ children: [new PageBreak()] }),
    ...chapter2(),
    new Paragraph({ children: [new PageBreak()] }),
    ...chapter3(),
    new Paragraph({ children: [new PageBreak()] }),
    ...chapter4(),
    new Paragraph({ children: [new PageBreak()] }),
    ...chapter5(),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: FONT_SIZE },
          paragraph: { spacing: { line: LINE_SPACING } },
        },
        heading1: {
          run: { font: FONT, size: 32, bold: true, color: '1A237E' },
          paragraph: { spacing: { before: 480, after: 240 } },
        },
        heading2: {
          run: { font: FONT, size: 28, bold: true, color: '283593' },
          paragraph: { spacing: { before: 360, after: 200 } },
        },
        heading3: {
          run: { font: FONT, size: 26, bold: true, color: '37474F' },
          paragraph: { spacing: { before: 240, after: 160 } },
        },
        heading4: {
          run: { font: FONT, size: 26, bold: true, italics: true, color: '455A64' },
          paragraph: { spacing: { before: 200, after: 120 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [
            { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          ],
        },
        {
          reference: 'numbers',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2)', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 },
            size: { width: 12240, height: 15840 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Báo cáo đồ án — AuraPC', font: FONT, size: 20, italics: true, color: '999999' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Trang ', font: FONT, size: 20 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 20 }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = __dirname + '/AuraPC-BaoCao-DoAn.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`Report generated: ${outPath}`);
  console.log(`File size: ${(buffer.length / 1024).toFixed(0)} KB`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
