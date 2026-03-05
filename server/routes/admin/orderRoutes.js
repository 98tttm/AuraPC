const express = require('express');
const Order = require('../../models/Order');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'processing', 'shipped', 'cancelled'],
  confirmed: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

function canTransitionOrderStatus(current, next) {
  if (current === next) return true;
  const nextList = STATUS_TRANSITIONS[current] || [];
  return nextList.includes(next);
}

async function getOrderDetail(orderNumber) {
  return Order.findOne({ orderNumber })
    .populate('user', 'phoneNumber profile.fullName email avatar')
    .populate('items.product', 'name slug images price')
    .lean();
}

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
    const order = await getOrderDetail(req.params.orderNumber);
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
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!canTransitionOrderStatus(order.status, status)) {
      return res.status(400).json({ error: `Cannot change status from "${order.status}" to "${status}"` });
    }

    if (status === 'shipped' && order.cancelRequest?.status === 'pending') {
      return res.status(400).json({ error: 'Cannot ship order while cancellation request is pending' });
    }

    if (status === 'delivered' && order.returnRequest?.status === 'pending') {
      return res.status(400).json({ error: 'Cannot complete order while return request is pending' });
    }

    order.status = status;
    if (status === 'shipped' && !order.shippedAt) order.shippedAt = new Date();
    if (status === 'delivered') {
      if (!order.shippedAt) order.shippedAt = new Date();
      order.deliveredAt = new Date();
    }
    if (status === 'cancelled') order.cancelledAt = new Date();

    await order.save();

    const updated = await getOrderDetail(req.params.orderNumber);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /:orderNumber/cancel-request — approve/reject cancellation request */
router.put('/:orderNumber/cancel-request', async (req, res) => {
  try {
    const { action, note } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.cancelRequest?.status !== 'pending') {
      return res.status(400).json({ error: 'No pending cancellation request for this order' });
    }

    const adminNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';
    const now = new Date();

    if (action === 'approve') {
      order.status = 'cancelled';
      order.cancelledAt = now;
      order.cancelRequest.status = 'approved';
    } else {
      order.cancelRequest.status = 'rejected';
    }

    order.cancelRequest.resolvedAt = now;
    order.cancelRequest.resolvedBy = req.adminId;
    order.cancelRequest.note = adminNote;
    await order.save();

    const updated = await getOrderDetail(req.params.orderNumber);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /:orderNumber/return-request — approve/reject return request */
router.put('/:orderNumber/return-request', async (req, res) => {
  try {
    const { action, note } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.returnRequest?.status !== 'pending') {
      return res.status(400).json({ error: 'No pending return request for this order' });
    }

    const adminNote = typeof note === 'string' ? note.trim().slice(0, 300) : '';
    const now = new Date();

    if (action === 'approve') {
      order.status = 'cancelled';
      order.cancelledAt = now;
      order.returnRequest.status = 'approved';
    } else {
      order.returnRequest.status = 'rejected';
    }

    order.returnRequest.resolvedAt = now;
    order.returnRequest.resolvedBy = req.adminId;
    order.returnRequest.note = adminNote;
    await order.save();

    const updated = await getOrderDetail(req.params.orderNumber);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
