const PDFDocument = require('pdfkit');

function formatPrice(price) {
  if (price == null || price === '') return '0₫';
  return Number(price).toLocaleString('vi-VN') + '₫';
}

/**
 * Tạo PDF hóa đơn điện tử từ đơn hàng
 * @param {Object} order - Order document (saved, có items, shippingAddress, total, orderNumber, createdAt)
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

    const addr = order.shippingAddress || {};
    const orderDate = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—';

    // ----- Header -----
    doc.fontSize(20).font('Helvetica-Bold').text('AuraPC', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(14).font('Helvetica').text('HÓA ĐƠN ĐIỆN TỬ', { align: 'center' });
    doc.moveDown(1);

    // ----- Thông tin đơn hàng -----
    doc.fontSize(11).font('Helvetica-Bold').text('Thông tin đơn hàng');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Mã đơn hàng: ${order.orderNumber}`);
    doc.text(`Ngày lập: ${orderDate}`);
    doc.text(`Loại hóa đơn: ${invoiceType === 'company' ? 'Công ty' : 'Cá nhân'}`);
    doc.moveDown(0.8);

    // ----- Người mua / Địa chỉ giao hàng -----
    doc.fontSize(11).font('Helvetica-Bold').text('Thông tin người nhận / Giao hàng');
    doc.font('Helvetica').fontSize(10);
    doc.text(`Họ tên: ${addr.fullName || '—'}`);
    doc.text(`Số điện thoại: ${addr.phone || '—'}`);
    doc.text(`Email: ${addr.email || '—'}`);
    const fullAddress = [addr.address, addr.ward, addr.district, addr.city].filter(Boolean).join(', ') || '—';
    doc.text(`Địa chỉ: ${fullAddress}`);
    doc.moveDown(0.8);

    // ----- Bảng sản phẩm -----
    doc.fontSize(11).font('Helvetica-Bold').text('Chi tiết sản phẩm');
    doc.moveDown(0.3);

    const tableTop = doc.y;
    const colStt = 50;
    const colName = 80;
    const colPrice = 320;
    const colQty = 400;
    const colTotal = 450;
    const colWidth = 100;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('STT', colStt, tableTop);
    doc.text('Tên sản phẩm', colName, tableTop);
    doc.text('Đơn giá', colPrice, tableTop);
    doc.text('SL', colQty, tableTop);
    doc.text('Thành tiền', colTotal, tableTop);
    doc.moveTo(50, tableTop + 14).lineTo(550, tableTop + 14).stroke();
    doc.moveDown(0.2);

    let y = tableTop + 22;
    const items = order.items || [];
    let subtotal = 0;

    doc.font('Helvetica');
    items.forEach((item, idx) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.qty) || 1;
      const lineTotal = price * qty;
      subtotal += lineTotal;
      const name = (item.name || '').substring(0, 50);
      doc.fontSize(9).text(String(idx + 1), colStt, y);
      doc.text(name, colName, y, { width: 230 });
      doc.text(formatPrice(price), colPrice, y, { width: 75, align: 'right' });
      doc.text(String(qty), colQty, y, { width: 25, align: 'right' });
      doc.text(formatPrice(lineTotal), colTotal, y, { width: colWidth, align: 'right' });
      y += 22;
    });

    doc.moveDown(0.5);
    const shipFee = Number(order.shippingFee) || 0;
    const discount = Number(order.discount) || 0;
    const total = Number(order.total) || 0;

    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(`Tạm tính: ${formatPrice(subtotal)}`, 350, y);
    y += 18;
    if (shipFee > 0) {
      doc.text(`Phí vận chuyển: ${formatPrice(shipFee)}`, 350, y);
      y += 18;
    }
    if (discount > 0) {
      doc.text(`Giảm giá: -${formatPrice(discount)}`, 350, y);
      y += 18;
    }
    doc.fontSize(11).text(`TỔNG CỘNG: ${formatPrice(total)}`, 350, y);
    doc.moveDown(1.5);

    // ----- Footer -----
    doc.font('Helvetica').fontSize(9).fillColor('#666');
    doc.text('Hóa đơn điện tử được lập tự động bởi AuraPC. Cảm ơn bạn đã mua hàng.', 50, doc.y, { align: 'center', width: 500 });
    doc.moveDown(0.5);
    doc.text('Trân trọng.', { align: 'center' });
    doc.text('AuraPC', { align: 'center' });

    doc.end();
  });
}

module.exports = { buildInvoicePdf };
