const express = require('express');
const Blog = require('../models/Blog');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;
    const filter = { published: true };
    const [items, total] = await Promise.all([
      Blog.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Blog.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/by-slug/:slug', async (req, res) => {
  try {
    const post = await Blog.findOne({
      slug: req.params.slug,
      published: true,
    }).lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
