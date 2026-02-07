const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AP${y}${m}${d}${r}`;
}

router.post('/', async (req, res) => {
  try {
    const { items, shippingAddress, shippingFee = 0, discount = 0 } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }
    const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.qty || 1), 0) + (Number(shippingFee) || 0) - (Number(discount) || 0);
    const order = new Order({
      orderNumber: generateOrderNumber(),
      items: items.map((i) => ({
        product: i.product,
        name: i.name,
        price: i.price,
        qty: i.qty,
      })),
      shippingAddress: shippingAddress || {},
      total: Math.max(0, total),
      shippingFee: Number(shippingFee) || 0,
      discount: Number(discount) || 0,
      status: 'pending',
    });
    await order.save();
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.product', 'name slug images')
      .lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
