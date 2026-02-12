const express = require('express');
const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const router = express.Router();

// In production should read userId from verified JWT.
const getUserId = (req) => req.headers['x-user-id'] || req.body?.userId || req.query?.userId;

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const collapseItems = (items) => {
  const byProduct = new Map();
  for (const item of items || []) {
    const product = normalizeId(item?.product);
    const quantity = Number(item?.quantity) || 0;
    if (!product || quantity <= 0) continue;
    byProduct.set(product, (byProduct.get(product) || 0) + quantity);
  }
  return Array.from(byProduct.entries()).map(([product, quantity]) => ({ product, quantity }));
};

const normalizeCartItems = (cart) => {
  const currentItems = Array.isArray(cart?.items) ? cart.items : [];
  const collapsedItems = collapseItems(currentItems);
  const changed =
    collapsedItems.length !== currentItems.length ||
    collapsedItems.some((next, idx) => {
      const cur = currentItems[idx];
      return normalizeId(cur?.product) !== next.product || Number(cur?.quantity) !== next.quantity;
    });

  if (changed) cart.items = collapsedItems;
  return changed;
};

async function resolveProductObjectId(rawProductId) {
  const productId = String(rawProductId || '').trim();
  if (!productId) return null;
  if (mongoose.Types.ObjectId.isValid(productId)) return productId;

  const product = await Product.findOne({ product_id: productId }).select('_id').lean();
  return product?._id ? String(product._id) : null;
}

async function getPopulatedItems(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();
  if (!cart || !Array.isArray(cart.items)) return [];
  return cart.items
    .filter((item) => item.product)
    .map((item) => ({ product: item.product, quantity: item.quantity }));
}

router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.json({ success: true, items: [] });

    const cart = await Cart.findOne({ user: userId });
    if (cart && normalizeCartItems(cart)) {
      await cart.save();
    }

    const items = await getPopulatedItems(userId);
    res.json({ success: true, items });
  } catch (err) {
    console.error('[GET /api/cart]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { userId, items } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    if (Array.isArray(items)) {
      for (const localItem of items) {
        const productId = await resolveProductObjectId(localItem?.productId);
        const qty = Number(localItem?.quantity) || 0;
        if (!productId || qty <= 0) continue;

        const existingItem = cart.items.find((i) => normalizeId(i.product) === productId);
        if (existingItem) {
          existingItem.quantity = Math.max(Number(existingItem.quantity) || 0, qty);
        } else {
          cart.items.push({ product: productId, quantity: qty });
        }
      }
    }

    normalizeCartItems(cart);
    await cart.save();
    const populatedItems = await getPopulatedItems(userId);
    res.json({ success: true, items: populatedItems });
  } catch (err) {
    console.error('[POST /api/cart/sync]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Login required' });
    if (!productId) return res.status(400).json({ success: false, message: 'Missing productId' });

    const resolvedProductId = await resolveProductObjectId(productId);
    if (!resolvedProductId) return res.status(400).json({ success: false, message: 'Invalid productId' });

    const qty = Math.max(1, Number(quantity) || 1);

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find((i) => normalizeId(i.product) === resolvedProductId);
    if (existingItem) {
      existingItem.quantity += qty;
    } else {
      cart.items.push({ product: resolvedProductId, quantity: qty });
    }

    normalizeCartItems(cart);
    await cart.save();
    const populatedItems = await getPopulatedItems(userId);
    res.json({ success: true, items: populatedItems });
  } catch (err) {
    console.error('[POST /api/cart/add]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update', async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'Login required' });
    if (!productId) return res.status(400).json({ success: false, message: 'Missing productId' });

    const resolvedProductId = await resolveProductObjectId(productId);
    if (!resolvedProductId) return res.status(400).json({ success: false, message: 'Invalid productId' });

    const qty = Number(quantity) || 0;
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.json({ success: true, items: [] });
    }

    if (qty <= 0) {
      cart.items = cart.items.filter((i) => normalizeId(i.product) !== resolvedProductId);
    } else {
      const item = cart.items.find((i) => normalizeId(i.product) === resolvedProductId);
      if (item) item.quantity = qty;
      else cart.items.push({ product: resolvedProductId, quantity: qty });
    }

    normalizeCartItems(cart);
    await cart.save();
    const populatedItems = await getPopulatedItems(userId);
    res.json({ success: true, items: populatedItems });
  } catch (err) {
    console.error('[PUT /api/cart/update]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/remove', async (req, res) => {
  try {
    const userId = getUserId(req);
    const productId = String(req.query?.productId || '').trim();

    if (!userId) return res.status(400).json({ success: false, message: 'Login required' });
    if (!productId) return res.status(400).json({ success: false, message: 'Missing productId' });

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.json({ success: true, removedCount: 0, items: [] });
    }

    const resolvedProductId = await resolveProductObjectId(productId);
    const targetIds = new Set([productId, ...(resolvedProductId ? [resolvedProductId] : [])]);

    const beforeCount = cart.items.length;
    cart.items = cart.items.filter((i) => !targetIds.has(normalizeId(i.product)));
    normalizeCartItems(cart);

    const afterCount = cart.items.length;
    if (afterCount !== beforeCount || cart.isModified('items')) {
      await cart.save();
    }

    const populatedItems = await getPopulatedItems(userId);
    res.json({ success: true, removedCount: beforeCount - afterCount, items: populatedItems });
  } catch (err) {
    console.error('[DELETE /api/cart/remove]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
