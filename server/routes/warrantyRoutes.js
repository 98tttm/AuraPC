const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

/** GET /api/warranty/lookup?q=<query> - public warranty lookup by serial number or order number */
router.get('/lookup', async (req, res) => {
  try {
    let q = (req.query.q || '').toString().trim().toUpperCase();
    if (!q) {
      return res.status(400).json({ error: 'Vui lòng nhập mã Serial Number hoặc mã đơn hàng' });
    }
    // Strip common prefixes users may copy from UI (e.g. "#ORD-AP260315ZEUHBV")
    q = q.replace(/^#?ORD-/, '');

    let order;
    let matchedSerial = null;

    if (q.startsWith('APC-')) {
      // Search by serial number
      order = await Order.findOne({
        status: 'delivered',
        'items.serialNumber': q,
      })
        .populate('items.product', 'name slug images warrantyMonths')
        .lean();
      matchedSerial = q;
    }

    if (!order) {
      // Fallback: search by order number
      order = await Order.findOne({
        status: 'delivered',
        orderNumber: q,
      })
        .populate('items.product', 'name slug images warrantyMonths')
        .lean();
    }

    if (!order) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin bảo hành. Vui lòng kiểm tra lại mã tra cứu.' });
    }

    const now = new Date();
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;

    const items = (order.items || [])
      .filter((item) => !matchedSerial || item.serialNumber === matchedSerial)
      .map((item) => {
        const product = item.product || {};
        const warrantyMonths = product.warrantyMonths || 24;
        let expiryDate = null;
        let warrantyStatus = 'unknown';

        if (deliveredAt) {
          expiryDate = new Date(deliveredAt);
          expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);
          warrantyStatus = now <= expiryDate ? 'valid' : 'expired';
        }

        const images = product.images || [];
        const firstImg = images[0];
        const productImage = typeof firstImg === 'string' ? firstImg : firstImg?.url || '';

        return {
          serialNumber: item.serialNumber || null,
          productName: item.name,
          productSlug: product.slug || null,
          productImage,
          qty: item.qty,
          price: item.price,
          warrantyMonths,
          purchaseDate: deliveredAt ? deliveredAt.toISOString() : null,
          expiryDate: expiryDate ? expiryDate.toISOString() : null,
          status: warrantyStatus,
        };
      });

    res.json({
      orderNumber: order.orderNumber,
      deliveredAt: order.deliveredAt,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống, vui lòng thử lại sau.' });
  }
});

module.exports = router;
