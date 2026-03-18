const PDFDocument = require('pdfkit');
const path = require('path');

const FONT_DIR = path.join(__dirname, '..', 'fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Roboto-Regular.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'Roboto-Bold.ttf');
const FONT_ITALIC = path.join(FONT_DIR, 'Roboto-Italic.ttf');

// Brand colors
const COLOR_PRIMARY = '#1a1a2e';
const COLOR_ACCENT = '#f97316';
const COLOR_TEXT = '#1a1a1a';
const COLOR_MUTED = '#6b7280';
const COLOR_BORDER = '#e5e7eb';
const COLOR_BG_HEADER = '#f8f9fa';

function formatPrice(price) {
  if (price == null || price === '' || price === 0) return '0đ';
  return Number(price).toLocaleString('vi-VN') + 'đ';
}

function drawLine(doc, x1, y, x2, color = COLOR_BORDER) {
  doc.strokeColor(color).lineWidth(0.5).moveTo(x1, y).lineTo(x2, y).stroke();
}

/**
 * Tạo PDF hóa đơn điện tử từ đơn hàng (hỗ trợ tiếng Việt đầy đủ)
 * @param {Object} order
 * @param {string} invoiceType - 'personal' | 'company'
 * @returns {Promise<Buffer>}
 */
function buildInvoicePdf(order, invoiceType = 'personal') {
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
    const addr = order.shippingAddress || {};
    const orderDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('vi-VN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

    // ═══════════════════════════════════════════════
    // HEADER — Brand bar
    // ═══════════════════════════════════════════════
    doc.rect(0, 0, pageW, 80).fill(COLOR_PRIMARY);
    doc.font('Bold').fontSize(22).fillColor('#ffffff')
      .text('AURAPC', margin, 18, { width: contentW });
    doc.font('Regular').fontSize(9).fillColor('#94a3b8')
      .text('Gaming PC & Linh kiện chính hãng', margin, 44, { width: contentW });

    // Invoice title — right side of header
    doc.font('Bold').fontSize(14).fillColor('#ffffff')
      .text('HÓA ĐƠN ĐIỆN TỬ', margin, 22, { width: contentW, align: 'right' });
    doc.font('Regular').fontSize(9).fillColor(COLOR_ACCENT)
      .text(`#${order.orderNumber}`, margin, 42, { width: contentW, align: 'right' });

    doc.y = 100;

    // ═══════════════════════════════════════════════
    // ORDER INFO + CUSTOMER INFO (2 columns)
    // ═══════════════════════════════════════════════
    const infoY = doc.y;
    const colLeft = margin;
    const colRight = margin + contentW / 2 + 10;
    const colHalfW = contentW / 2 - 10;

    // Left column — Order info
    doc.font('Bold').fontSize(10).fillColor(COLOR_ACCENT)
      .text('THÔNG TIN ĐƠN HÀNG', colLeft, infoY);
    let y = infoY + 18;
    doc.font('Regular').fontSize(9).fillColor(COLOR_TEXT);
    doc.text(`Mã đơn hàng:  `, colLeft, y, { continued: true });
    doc.font('Bold').text(order.orderNumber || '—');
    y += 16;
    doc.font('Regular').text(`Ngày lập:  ${orderDate}`, colLeft, y);
    y += 16;
    const typeLabel = invoiceType === 'company' ? 'Công ty' : 'Cá nhân';
    doc.text(`Loại hóa đơn:  ${typeLabel}`, colLeft, y);
    y += 16;
    const methodLabels = {
      momo: 'Ví MoMo', zalopay: 'ZaloPay', atm: 'ATM / Chuyển khoản',
      cod: 'Thanh toán khi nhận hàng', qr: 'QR chuyển khoản',
    };
    doc.text(`Thanh toán:  ${methodLabels[order.paymentMethod] || order.paymentMethod || '—'}`, colLeft, y);

    // Right column — Customer info
    doc.font('Bold').fontSize(10).fillColor(COLOR_ACCENT)
      .text('THÔNG TIN NGƯỜI NHẬN', colRight, infoY);
    let y2 = infoY + 18;
    doc.font('Regular').fontSize(9).fillColor(COLOR_TEXT);
    doc.text(`Họ tên:  ${addr.fullName || '—'}`, colRight, y2, { width: colHalfW });
    y2 += 16;
    doc.text(`Điện thoại:  ${addr.phone || '—'}`, colRight, y2, { width: colHalfW });
    y2 += 16;
    doc.text(`Email:  ${addr.email || '—'}`, colRight, y2, { width: colHalfW });
    y2 += 16;
    const fullAddress = [addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ') || '—';
    doc.text(`Địa chỉ:  ${fullAddress}`, colRight, y2, { width: colHalfW });

    doc.y = Math.max(y, y2) + 30;

    // ═══════════════════════════════════════════════
    // PRODUCT TABLE
    // ═══════════════════════════════════════════════
    doc.font('Bold').fontSize(10).fillColor(COLOR_ACCENT)
      .text('CHI TIẾT SẢN PHẨM', margin, doc.y);
    doc.y += 8;

    // Table header
    const tableX = margin;
    const colWidths = { stt: 30, name: 230, price: 90, qty: 40, total: 100 };
    const tableW = contentW;
    let tY = doc.y;

    // Header background
    doc.rect(tableX, tY, tableW, 22).fill(COLOR_PRIMARY);

    doc.font('Bold').fontSize(8).fillColor('#ffffff');
    let cx = tableX + 8;
    doc.text('STT', cx, tY + 6, { width: colWidths.stt });
    cx += colWidths.stt;
    doc.text('Tên sản phẩm', cx, tY + 6, { width: colWidths.name });
    cx += colWidths.name;
    doc.text('Đơn giá', cx, tY + 6, { width: colWidths.price, align: 'right' });
    cx += colWidths.price;
    doc.text('SL', cx, tY + 6, { width: colWidths.qty, align: 'center' });
    cx += colWidths.qty;
    doc.text('Thành tiền', cx, tY + 6, { width: colWidths.total, align: 'right' });

    tY += 22;
    const items = order.items || [];
    let subtotal = 0;

    items.forEach((item, idx) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 1;
      const lineTotal = price * qty;
      subtotal += lineTotal;
      const name = (item.name || 'Sản phẩm').substring(0, 55);

      // Alternate row background
      if (idx % 2 === 0) {
        doc.rect(tableX, tY, tableW, 22).fill(COLOR_BG_HEADER);
      }

      doc.font('Regular').fontSize(8).fillColor(COLOR_TEXT);
      cx = tableX + 8;
      doc.text(String(idx + 1), cx, tY + 6, { width: colWidths.stt });
      cx += colWidths.stt;
      doc.text(name, cx, tY + 6, { width: colWidths.name });
      cx += colWidths.name;
      doc.text(formatPrice(price), cx, tY + 6, { width: colWidths.price, align: 'right' });
      cx += colWidths.price;
      doc.text(String(qty), cx, tY + 6, { width: colWidths.qty, align: 'center' });
      cx += colWidths.qty;
      doc.font('Bold').text(formatPrice(lineTotal), cx, tY + 6, { width: colWidths.total, align: 'right' });

      tY += 22;

      // Page break check
      if (tY > doc.page.height - 150) {
        doc.addPage();
        tY = 50;
      }
    });

    // Bottom line of table
    drawLine(doc, tableX, tY, tableX + tableW, COLOR_PRIMARY);

    // ═══════════════════════════════════════════════
    // TOTALS — right-aligned
    // ═══════════════════════════════════════════════
    tY += 12;
    const totalsX = tableX + tableW - 200;
    const totalsLabelW = 110;
    const totalsValueW = 90;

    doc.font('Regular').fontSize(9).fillColor(COLOR_MUTED);
    doc.text('Tạm tính:', totalsX, tY, { width: totalsLabelW, align: 'right' });
    doc.font('Regular').fillColor(COLOR_TEXT)
      .text(formatPrice(subtotal), totalsX + totalsLabelW, tY, { width: totalsValueW, align: 'right' });
    tY += 18;

    const shipFee = Number(order.shippingFee) || 0;
    if (shipFee > 0) {
      doc.font('Regular').fillColor(COLOR_MUTED)
        .text('Phí vận chuyển:', totalsX, tY, { width: totalsLabelW, align: 'right' });
      doc.fillColor(COLOR_TEXT)
        .text(formatPrice(shipFee), totalsX + totalsLabelW, tY, { width: totalsValueW, align: 'right' });
      tY += 18;
    }

    const discount = Number(order.discount) || 0;
    if (discount > 0) {
      doc.font('Regular').fillColor(COLOR_MUTED)
        .text('Giảm giá:', totalsX, tY, { width: totalsLabelW, align: 'right' });
      doc.fillColor('#16a34a')
        .text(`-${formatPrice(discount)}`, totalsX + totalsLabelW, tY, { width: totalsValueW, align: 'right' });
      tY += 18;
    }

    // Total line
    drawLine(doc, totalsX, tY, totalsX + totalsLabelW + totalsValueW, COLOR_ACCENT);
    tY += 8;

    const total = Number(order.total) || 0;
    doc.font('Bold').fontSize(12).fillColor(COLOR_PRIMARY)
      .text('TỔNG CỘNG:', totalsX, tY, { width: totalsLabelW, align: 'right' });
    doc.font('Bold').fontSize(12).fillColor(COLOR_ACCENT)
      .text(formatPrice(total), totalsX + totalsLabelW, tY, { width: totalsValueW, align: 'right' });

    // ═══════════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════════
    tY += 40;
    if (tY > doc.page.height - 100) {
      doc.addPage();
      tY = 50;
    }

    drawLine(doc, margin, tY, margin + contentW, COLOR_BORDER);
    tY += 12;

    doc.font('Italic').fontSize(8).fillColor(COLOR_MUTED)
      .text(
        'Hóa đơn điện tử được lập tự động bởi hệ thống AuraPC. Đây là hóa đơn hợp lệ và không cần chữ ký.',
        margin, tY, { width: contentW, align: 'center' }
      );
    tY += 14;
    doc.font('Regular').fontSize(8).fillColor(COLOR_MUTED)
      .text('Cảm ơn quý khách đã mua hàng tại AuraPC!', margin, tY, { width: contentW, align: 'center' });
    tY += 20;
    doc.font('Bold').fontSize(9).fillColor(COLOR_PRIMARY)
      .text('AuraPC — Gaming PC & Linh kiện chính hãng', margin, tY, { width: contentW, align: 'center' });

    doc.end();
  });
}

module.exports = { buildInvoicePdf };
