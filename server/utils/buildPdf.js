const PDFDocument = require('pdfkit');

const STEP_LABELS = {
  GPU: 'VGA',
  CPU: 'CPU',
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
  return Number(price).toLocaleString('vi-VN') + '₫';
}

/**
 * Tạo PDF cấu hình PC theo format Corsair
 * @param {Object} builder - { components: { GPU: { name, price, slug }, ... } }
 * @returns {Promise<Buffer>}
 */
function buildConfigPdf(builder) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const components = builder.components || {};
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN');

    // Tiêu đề
    doc.fontSize(18).font('Helvetica-Bold').text('THÔNG TIN CẤU HÌNH PC', { align: 'center' });
    doc.moveDown(0.5);

    // Lựa chọn linh kiện chính (GPU, CPU, MB)
    doc.fontSize(12).text('Lựa chọn linh kiện', { underline: true });
    doc.moveDown(0.3);

    for (const step of CORE_STEPS) {
      const comp = components[step];
      if (comp && comp.name) {
        const label = STEP_LABELS[step] || step;
        doc.fontSize(10).font('Helvetica-Bold').text(`${label.toUpperCase()}: `, { continued: true });
        doc.font('Helvetica').text(comp.name);
      }
    }
    doc.moveDown(1);

    // Bảng chi tiết đơn hàng
    doc.fontSize(12).font('Helvetica-Bold').text('Chi tiết đơn hàng', { underline: true });
    doc.moveDown(0.3);

    const otherSteps = Object.keys(STEP_LABELS).filter((s) => !CORE_STEPS.includes(s));
    let total = 0;
    for (const step of Object.keys(STEP_LABELS)) {
      const comp = components[step];
      if (comp && comp.name && (comp.price ?? 0) > 0) total += Number(comp.price ?? 0);
    }

    for (const step of otherSteps) {
      const comp = components[step];
      if (comp && comp.name) {
        const label = STEP_LABELS[step] || step;
        const price = comp.price ?? 0;
        doc.fontSize(10).font('Helvetica-Bold').text(label);
        doc.font('Helvetica').text(`  ${comp.name} - ${formatPrice(price)}`);
        doc.moveDown(0.2);
      }
    }

    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').text(`TỔNG CỘNG: ${formatPrice(total)}`);
    doc.moveDown(1);

    doc.fontSize(8).font('Helvetica').text(
      `Giá có thể thay đổi. Thông tin cấu hình được tạo ngày ${dateStr}.`,
      { color: '#666' }
    );

    doc.end();
  });
}

module.exports = { buildConfigPdf };
