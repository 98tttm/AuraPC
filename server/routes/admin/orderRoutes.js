const express = require('express');
const Order = require('../../models/Order');
const { requireAdmin } = require('../../middleware/auth');
const { createUserNotification } = require('../../utils/userNotifications');
const { emitOrderUpdated } = require('../../socket');

const router = express.Router();
router.use(requireAdmin);

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const ADMIN_MANUAL_STATUSES = ['processing', 'shipped'];
const STATUS_TRANSITIONS = {
  pending: ['processing'],
  confirmed: ['shipped'],
  processing: ['shipped'],
  shipped: [],
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
    if (!ADMIN_MANUAL_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Admin can only update orders to "processing" or "shipped"' });
    }

    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!canTransitionOrderStatus(order.status, status)) {
      return res.status(400).json({ error: `Cannot change status from "${order.status}" to "${status}" in admin flow` });
    }

    if (status === 'shipped' && order.cancelRequest?.status === 'pending') {
      return res.status(400).json({ error: 'Cannot ship order while cancellation request is pending' });
    }

    order.status = status;
    if (status === 'shipped' && !order.shippedAt) order.shippedAt = new Date();

    await order.save();

    const userId = order.user && order.user.toString ? order.user.toString() : order.user;
    if (userId) {
      const titles = { processing: 'Đơn đang xử lý', shipped: 'Đơn đang giao' };
      const messages = {
        processing: `Đơn #${order.orderNumber} đang được xử lý.`,
        shipped: `Đơn #${order.orderNumber} đã được gửi đi. Bạn có thể xác nhận đã nhận khi nhận được hàng.`,
      };
      await createUserNotification({
        userId,
        type: status === 'shipped' ? 'order_shipped' : 'order_processing',
        title: titles[status] || 'Cập nhật đơn hàng',
        message: messages[status] || `Đơn #${order.orderNumber} đã cập nhật.`,
        metadata: { orderNumber: order.orderNumber },
      });
    }

    const updated = await getOrderDetail(req.params.orderNumber);
    const userIdStatus = order.user && order.user.toString ? order.user.toString() : order.user;
    emitOrderUpdated({ orderNumber: order.orderNumber, status: order.status, userId: userIdStatus || undefined });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /:orderNumber/cancel — admin manually cancels an order */
router.put('/:orderNumber/cancel', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const order = await Order.findOne({ orderNumber: req.params.orderNumber });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const cancellableStatuses = ['pending', 'confirmed', 'processing', 'shipped'];
    if (!cancellableStatuses.includes(order.status)) {
      return res.status(400).json({ error: `Không thể hủy đơn ở trạng thái "${order.status}". Chỉ hủy được khi: ${cancellableStatuses.join(', ')}` });
    }

    const now = new Date();
    order.status = 'cancelled';
    order.cancelledAt = now;
    if (!order.cancelRequest) order.cancelRequest = {};
    order.cancelRequest.status = 'approved';
    order.cancelRequest.reason = typeof reason === 'string' ? reason.trim().slice(0, 300) : 'Admin hủy đơn';
    order.cancelRequest.resolvedAt = now;
    order.cancelRequest.resolvedBy = req.adminId;
    order.cancelRequest.note = 'Hủy bởi admin';
    await order.save();

    const userId = order.user && order.user.toString ? order.user.toString() : order.user;
    if (userId) {
      await createUserNotification({
        userId,
        type: 'order_cancel_approved',
        title: 'Đơn hàng đã bị hủy',
        message: `Đơn #${order.orderNumber} đã bị hủy bởi admin.${reason ? ' Lý do: ' + reason : ''}`,
        metadata: { orderNumber: order.orderNumber },
      });
    }

    const updated = await getOrderDetail(req.params.orderNumber);
    emitOrderUpdated({ orderNumber: order.orderNumber, status: order.status, userId: userId || undefined });
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

    const userId = order.user && order.user.toString ? order.user.toString() : order.user;
    if (userId) {
      await createUserNotification({
        userId,
        type: action === 'approve' ? 'order_cancel_approved' : 'order_cancel_rejected',
        title: action === 'approve' ? 'Đơn đã được hủy' : 'Yêu cầu hủy đơn không được duyệt',
        message: action === 'approve'
          ? `Đơn #${order.orderNumber} đã được hủy theo yêu cầu.`
          : `Yêu cầu hủy đơn #${order.orderNumber} không được duyệt.`,
        metadata: { orderNumber: order.orderNumber },
      });
    }

    const updated = await getOrderDetail(req.params.orderNumber);
    const userIdCancel = order.user && order.user.toString ? order.user.toString() : order.user;
    emitOrderUpdated({ orderNumber: order.orderNumber, status: order.status, userId: userIdCancel || undefined });
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

    const userId = order.user && order.user.toString ? order.user.toString() : order.user;
    if (userId) {
      await createUserNotification({
        userId,
        type: action === 'approve' ? 'order_return_approved' : 'order_return_rejected',
        title: action === 'approve' ? 'Yêu cầu hoàn trả đã được duyệt' : 'Yêu cầu hoàn trả không được duyệt',
        message: action === 'approve'
          ? `Đơn #${order.orderNumber} đã được duyệt hoàn trả.`
          : `Yêu cầu hoàn trả đơn #${order.orderNumber} không được duyệt.`,
        metadata: { orderNumber: order.orderNumber },
      });
    }

    const updated = await getOrderDetail(req.params.orderNumber);
    const userIdReturn = order.user && order.user.toString ? order.user.toString() : order.user;
    emitOrderUpdated({ orderNumber: order.orderNumber, status: order.status, userId: userIdReturn || undefined });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
