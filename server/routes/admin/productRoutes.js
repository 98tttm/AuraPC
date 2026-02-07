const express = require('express');
const Product = require('../../models/Product');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (search && search.trim()) {
      filter.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { slug: new RegExp(search.trim(), 'i') },
      ];
    }
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      Product.countDocuments(filter),
    ]);
    res.json({ items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
