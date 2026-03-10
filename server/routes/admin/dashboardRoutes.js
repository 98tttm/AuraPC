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
      usersThisMonth,
      usersLastMonth,
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
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
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
      usersThisMonth,
      usersLastMonth,
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

/** GET /chart/revenue — doanh thu theo tháng (12 tháng gần nhất) */
router.get('/chart/revenue', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const [revenueData, customerData] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: start } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            newCustomers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const customerMap = customerData.reduce((acc, c) => { acc[c._id] = c.newCustomers; return acc; }, {});
    const data = revenueData.map(r => ({
      ...r,
      newCustomers: customerMap[r._id] || 0,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /chart/revenue-weekly — doanh thu theo tuần trong tháng hiện tại */
router.get('/chart/revenue-weekly', async (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Calculate week boundaries (7-day chunks from 1st of month)
    const weeks = [];
    let weekStart = new Date(startOfMonth);
    let weekNum = 1;
    while (weekStart <= endOfMonth) {
      const weekEnd = new Date(Math.min(
        new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999).getTime(),
        endOfMonth.getTime()
      ));
      weeks.push({ weekNum, start: new Date(weekStart), end: new Date(weekEnd) });
      weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() + 1);
      weekStart.setHours(0, 0, 0, 0);
      weekNum++;
    }

    // Count ALL orders (not just delivered) so chart shows activity
    const [revenueData, customerData] = await Promise.all([
      Order.aggregate([
        { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        { $match: { createdAt: { $gte: startOfMonth, $lte: endOfMonth } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            newCustomers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const revenueMap = {};
    for (const r of revenueData) { revenueMap[r._id] = r; }
    const customerMap = {};
    for (const c of customerData) { customerMap[c._id] = c.newCustomers; }

    // Aggregate per week
    const result = weeks.map(w => {
      let revenue = 0, orders = 0, newCustomers = 0;
      const cur = new Date(w.start);
      while (cur <= w.end) {
        const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (revenueMap[key]) {
          revenue += revenueMap[key].revenue;
          orders += revenueMap[key].orders;
        }
        if (customerMap[key]) {
          newCustomers += customerMap[key];
        }
        cur.setDate(cur.getDate() + 1);
      }
      const startDay = w.start.getDate();
      const endDay = w.end.getDate();
      return {
        _id: `W${w.weekNum}`,
        label: `${startDay}/${month + 1} - ${endDay}/${month + 1}`,
        revenue,
        orders,
        newCustomers,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /top-products — sản phẩm bán chạy nhất */
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const data = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'shipped', 'processing', 'confirmed'] } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: limit },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
