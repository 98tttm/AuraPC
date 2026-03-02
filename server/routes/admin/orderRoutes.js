const express = require('express');
const Order = require('../../models/Order');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

/** GET / — danh sách tất cả đơn hàng (phân trang, lọc) */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, from, to, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59');
    }
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { orderNumber: new RegExp(escaped, 'i') },
        { 'shippingAddress.fullName': new RegExp(escaped, 'i') },
        { 'shippingAddress.phone': new RegExp(escaped, 'i') },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'phoneNumber profile.fullName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /:orderNumber — chi tiết đơn hàng */
router.get('/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('user', 'phoneNumber profile.fullName email avatar')
      .populate('items.product', 'name slug images price')
      .lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /:orderNumber/status — cập nhật trạng thái đơn hàng */
router.put('/:orderNumber/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findOneAndUpdate(
      { orderNumber: req.params.orderNumber },
      { status },
      { new: true }
    ).lean();

    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
