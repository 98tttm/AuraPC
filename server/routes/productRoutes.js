const express = require('express');
const Product = require('../models/Product');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, search, featured, page = 1, limit = 12 } = req.query;
    const filter = { active: true };
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (search && search.trim()) {
      filter.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { shortDescription: new RegExp(search.trim(), 'i') },
      ];
    }
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 12);
    const [items, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(Math.min(50, parseInt(limit, 10) || 12))
        .lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const items = await Product.find({ active: true, featured: true })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-slug/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      active: true,
    })
      .populate('category', 'name slug')
      .lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
