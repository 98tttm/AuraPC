const express = require('express');
const User = require('../../models/User');
const Order = require('../../models/Order');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

/** GET / — danh sách tất cả users (phân trang, tìm kiếm) */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { phoneNumber: new RegExp(escaped, 'i') },
        { 'profile.fullName': new RegExp(escaped, 'i') },
        { email: new RegExp(escaped, 'i') },
        { username: new RegExp(escaped, 'i') },
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      User.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      User.countDocuments(filter),
    ]);

    // Đếm số đơn hàng cho từng user
    const userIds = items.map((u) => u._id);
    const orderCounts = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const countMap = orderCounts.reduce((acc, o) => { acc[o._id.toString()] = o.count; return acc; }, {});
    const enriched = items.map((u) => ({ ...u, orderCount: countMap[u._id.toString()] || 0 }));

    res.json({ items: enriched, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /:id — chi tiết user + đơn hàng gần đây */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-__v').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recentOrders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const totalSpent = await Order.aggregate([
      { $match: { user: user._id, status: 'delivered' } },
      { $group: { _id: null, sum: { $sum: '$total' } } },
    ]);

    res.json({
      ...user,
      recentOrders,
      totalSpent: totalSpent[0]?.sum || 0,
      orderCount: await Order.countDocuments({ user: user._id }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
