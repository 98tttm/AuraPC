const express = require('express');
const Faq = require('../models/Faq');

const router = express.Router();

/** GET /api/faqs - danh sách FAQ (công khai) */
router.get('/', async (req, res) => {
  try {
    const category = req.query.category;
    const q = category ? { category } : {};
    const list = await Faq.find(q).sort({ category: 1, order: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/faqs/:id - chi tiết một FAQ (công khai) */
router.get('/:id', async (req, res) => {
  try {
    const faq = await Faq.findById(req.params.id).lean();
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    res.json(faq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
