const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Roboto-Regular.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'Roboto-Bold.ttf');
const FONT_ITALIC = path.join(FONT_DIR, 'Roboto-Italic.ttf');

const COLOR_PRIMARY = '#1a1a2e';
const COLOR_ACCENT = '#f97316';
const COLOR_GOLD = '#ffb81c';
const COLOR_TEXT = '#1a1a1a';
const COLOR_MUTED = '#6b7280';
const COLOR_BORDER = '#e5e7eb';
const COLOR_BG = '#f8f9fa';

const STEP_LABELS = {
  GPU: 'VGA (Card đồ họa)',
  CPU: 'CPU (Bộ xử lý)',
  MB: 'Bo mạch chủ',
  CASE: 'Vỏ case',
  COOLING: 'Tản nhiệt',
  MEMORY: 'RAM',
  STORAGE: 'Ổ cứng',
  PSU: 'Nguồn',
  FANS: 'Quạt',
  MONITOR: 'Màn hình',
  KEYBOARD: 'Bàn phím',
  MOUSE: 'Chuột',
  HEADSET: 'Tai nghe',
};

const CORE_STEPS = ['GPU', 'CPU', 'MB'];

function formatPrice(price) {
  if (price == null || price <= 0) return 'Liên hệ';
  return Number(price).toLocaleString('vi-VN') + 'đ';
}

/**
 * Tạo PDF cấu hình PC (hỗ trợ tiếng Việt đầy đủ)
 * @param {Object} builder - { components: { GPU: { name, price, slug }, ... }, shareId, name }
 * @returns {Promise<Buffer>}
 */
function buildConfigPdf(builder) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Register Vietnamese-compatible fonts
    doc.registerFont('Regular', FONT_REGULAR);
    doc.registerFont('Bold', FONT_BOLD);
    doc.registerFont('Italic', FONT_ITALIC);

    const pageW = doc.page.width;
    const margin = 50;
    const contentW = pageW - margin * 2;
    const components = builder.components || {};
    const now = new Date();
    const dateStr = now.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // ═══════════════════════════════════════════════
    // HEADER — Dark brand bar
    // ═══════════════════════════════════════════════
    doc.rect(0, 0, pageW, 80).fill(COLOR_PRIMARY);
    doc.font('Bold').fontSize(22).fillColor('#ffffff')
      .text('AURAPC', margin, 18, { width: contentW });
    doc.font('Regular').fontSize(9).fillColor('#94a3b8')
      .text('Aura Builder — Cấu hình PC theo phong cách của bạn', margin, 44, { width: contentW });

    doc.font('Bold').fontSize(13).fillColor(COLOR_GOLD)
      .text('CẤU HÌNH PC', margin, 22, { width: contentW, align: 'right' });
    doc.font('Regular').fontSize(9).fillColor('#94a3b8')
      .text(`Ngày tạo: ${dateStr}`, margin, 42, { width: contentW, align: 'right' });

    doc.y = 100;

    // ═══════════════════════════════════════════════
    // CONFIG NAME (if any)
    // ═══════════════════════════════════════════════
    if (builder.name) {
      doc.font('Bold').fontSize(11).fillColor(COLOR_TEXT)
        .text(`Tên cấu hình: ${builder.name}`, margin, doc.y);
      doc.y += 8;
    }

    // ═══════════════════════════════════════════════
    // CORE COMPONENTS — Highlighted section
    // ═══════════════════════════════════════════════
    doc.font('Bold').fontSize(10).fillColor(COLOR_ACCENT)
      .text('LINH KIỆN CHÍNH', margin, doc.y);
    doc.y += 8;

    let coreY = doc.y;
    doc.rect(margin, coreY, contentW, 0).fill('transparent'); // placeholder

    let coreCount = 0;
    for (const step of CORE_STEPS) {
      const comp = components[step];
      if (!comp || !comp.name) continue;
      coreCount++;

      // Accent left bar
      doc.rect(margin, coreY, 3, 20).fill(COLOR_ACCENT);

      const label = STEP_LABELS[step] || step;
      doc.font('Bold').fontSize(9).fillColor(COLOR_ACCENT)
        .text(label.toUpperCase(), margin + 12, coreY + 2, { width: 120 });
      doc.font('Regular').fontSize(9).fillColor(COLOR_TEXT)
        .text(comp.name, margin + 135, coreY + 2, { width: contentW - 280 });
      doc.font('Bold').fontSize(9).fillColor(COLOR_TEXT)
        .text(formatPrice(comp.price), margin + contentW - 130, coreY + 2, { width: 130, align: 'right' });

      coreY += 26;
    }

    if (coreCount === 0) {
      doc.font('Italic').fontSize(9).fillColor(COLOR_MUTED)
        .text('Chưa chọn linh kiện chính', margin + 12, coreY + 2);
      coreY += 26;
    }

    doc.y = coreY + 12;

    // ═══════════════════════════════════════════════
    // OTHER COMPONENTS — Table
    // ═══════════════════════════════════════════════
    const otherSteps = Object.keys(STEP_LABELS).filter((s) => !CORE_STEPS.includes(s));
    const hasOther = otherSteps.some((s) => components[s]?.name);

    if (hasOther) {
      doc.font('Bold').fontSize(10).fillColor(COLOR_ACCENT)
        .text('LINH KIỆN BỔ SUNG', margin, doc.y);
      doc.y += 8;

      // Table header
      let tY = doc.y;
      doc.rect(margin, tY, contentW, 20).fill(COLOR_PRIMARY);
      doc.font('Bold').fontSize(8).fillColor('#ffffff');
      doc.text('Loại', margin + 8, tY + 5, { width: 100 });
      doc.text('Sản phẩm', margin + 115, tY + 5, { width: contentW - 260 });
      doc.text('Giá', margin + contentW - 138, tY + 5, { width: 130, align: 'right' });
      tY += 20;

      let rowIdx = 0;
      for (const step of otherSteps) {
        const comp = components[step];
        if (!comp || !comp.name) continue;

        if (rowIdx % 2 === 0) {
          doc.rect(margin, tY, contentW, 20).fill(COLOR_BG);
        }

        const label = STEP_LABELS[step] || step;
        doc.font('Bold').fontSize(8).fillColor(COLOR_TEXT)
          .text(label, margin + 8, tY + 5, { width: 100 });
        doc.font('Regular').fontSize(8).fillColor(COLOR_TEXT)
          .text(comp.name, margin + 115, tY + 5, { width: contentW - 260 });
        doc.font('Bold').fontSize(8).fillColor(COLOR_TEXT)
          .text(formatPrice(comp.price), margin + contentW - 138, tY + 5, { width: 130, align: 'right' });

        tY += 20;
        rowIdx++;
      }

      // Bottom line
      doc.strokeColor(COLOR_PRIMARY).lineWidth(0.5)
        .moveTo(margin, tY).lineTo(margin + contentW, tY).stroke();
      doc.y = tY;
    }

    // ═══════════════════════════════════════════════
    // TOTAL
    // ═══════════════════════════════════════════════
    let total = 0;
    for (const step of Object.keys(STEP_LABELS)) {
      const comp = components[step];
      if (comp?.name && (comp.price ?? 0) > 0) total += Number(comp.price ?? 0);
    }

    doc.y += 16;
    const totalY = doc.y;

    // Total box
    doc.rect(margin + contentW - 220, totalY - 4, 220, 30).fill(COLOR_PRIMARY);
    doc.font('Bold').fontSize(11).fillColor('#ffffff')
      .text('TỔNG CỘNG:', margin + contentW - 212, totalY + 3, { width: 110, align: 'left' });
    doc.font('Bold').fontSize(11).fillColor(COLOR_GOLD)
      .text(formatPrice(total), margin + contentW - 100, totalY + 3, { width: 92, align: 'right' });

    // ═══════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════
    doc.y = totalY + 50;
    doc.strokeColor(COLOR_BORDER).lineWidth(0.5)
      .moveTo(margin, doc.y).lineTo(margin + contentW, doc.y).stroke();
    doc.y += 10;

    doc.font('Italic').fontSize(8).fillColor(COLOR_MUTED)
      .text(
        'Giá có thể thay đổi theo thời điểm. Vui lòng liên hệ AuraPC để được tư vấn chi tiết.',
        margin, doc.y, { width: contentW, align: 'center' }
      );
    doc.y += 14;
    doc.font('Regular').fontSize(8).fillColor(COLOR_MUTED)
      .text(`Cấu hình được tạo ngày ${dateStr} bởi Aura Builder.`, margin, doc.y, { width: contentW, align: 'center' });
    doc.y += 20;
    doc.font('Bold').fontSize(9).fillColor(COLOR_PRIMARY)
      .text('AuraPC — Gaming PC & Linh kiện chính hãng', margin, doc.y, { width: contentW, align: 'center' });

    doc.end();
  });
}

module.exports = { buildConfigPdf };
