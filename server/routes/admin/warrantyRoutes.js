const express = require('express');
const Order = require('../../models/Order');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

/** Build a flat list of warranty items from delivered orders */
async function buildWarrantyItems(filter = {}, { page = 1, limit = 20 } = {}) {
  const orders = await Order.find({
    status: 'delivered',
    'items.serialNumber': { $ne: null },
    ...filter,
  })
    .populate('items.product', 'name slug images warrantyMonths')
    .populate('user', 'phoneNumber profile.fullName')
    .sort({ deliveredAt: -1 })
    .lean();

  const now = new Date();
  const items = [];

  for (const order of orders) {
    const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;

    for (const item of order.items || []) {
      if (!item.serialNumber) continue;

      const product = item.product || {};
      const warrantyMonths = product.warrantyMonths || 24;
      let expiryDate = null;
      let status = 'unknown';

      if (deliveredAt) {
        expiryDate = new Date(deliveredAt);
        expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);
        status = now <= expiryDate ? 'valid' : 'expired';
      }

      const images = product.images || [];
      const firstImg = images[0];
      const productImage = typeof firstImg === 'string' ? firstImg : firstImg?.url || '';

      items.push({
        serialNumber: item.serialNumber,
        productName: item.name,
        productSlug: product.slug || null,
        productImage,
        qty: item.qty,
        price: item.price,
        warrantyMonths,
        orderNumber: order.orderNumber,
        customerName: order.user?.profile?.fullName || '',
        customerPhone: order.user?.phoneNumber || '',
        purchaseDate: deliveredAt ? deliveredAt.toISOString() : null,
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
        status,
      });
    }
  }

  return items;
}

/** GET / — list all warranty records (paginated, filterable) */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const allItems = await buildWarrantyItems();

    // Apply filters
    let filtered = allItems;
    if (status === 'valid' || status === 'expired') {
      filtered = filtered.filter((i) => i.status === status);
    }
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filtered = filtered.filter((i) =>
        (i.serialNumber || '').toLowerCase().includes(s) ||
        (i.orderNumber || '').toLowerCase().includes(s) ||
        (i.productName || '').toLowerCase().includes(s) ||
        (i.customerName || '').toLowerCase().includes(s) ||
        (i.customerPhone || '').includes(s)
      );
    }

    // Paginate
    const total = filtered.length;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const items = filtered.slice(skip, skip + limitNum);

    res.json({ items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /stats — warranty statistics */
router.get('/stats', async (req, res) => {
  try {
    const allItems = await buildWarrantyItems();
    const valid = allItems.filter((i) => i.status === 'valid').length;
    const expired = allItems.filter((i) => i.status === 'expired').length;
    res.json({ total: allItems.length, valid, expired });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
