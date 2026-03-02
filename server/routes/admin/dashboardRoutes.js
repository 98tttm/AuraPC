const express = require('express');
const Order = require('../../models/Order');
const User = require('../../models/User');
const Product = require('../../models/Product');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

/** GET /stats — tổng quan dashboard */
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      totalOrders,
      ordersThisMonth,
      ordersLastMonth,
      ordersByStatus,
      totalUsers,
      totalProducts,
      recentOrders,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { status: 'delivered' } },
        { $group: { _id: null, sum: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'delivered', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, sum: { $sum: '$total' } } },
      ]),
      Order.aggregate([
        { $match: { status: 'delivered', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, sum: { $sum: '$total' } } },
      ]),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Order.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      User.countDocuments(),
      Product.countDocuments({ active: true }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'phoneNumber profile.fullName')
        .lean(),
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.sum || 0,
      revenueThisMonth: revenueThisMonth[0]?.sum || 0,
      revenueLastMonth: revenueLastMonth[0]?.sum || 0,
      totalOrders,
      ordersThisMonth,
      ordersLastMonth,
      ordersByStatus: ordersByStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      totalUsers,
      totalProducts,
      recentOrders,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /chart/orders — số đơn hàng theo ngày (7 ngày gần nhất) */
router.get('/chart/orders', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const data = await Order.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /chart/revenue — doanh thu theo tháng (6 tháng gần nhất) */
router.get('/chart/revenue', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const data = await Order.aggregate([
      { $match: { status: 'delivered', createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
