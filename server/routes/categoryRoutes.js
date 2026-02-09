const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const raw = await Category.find({ $or: [{ is_active: true }, { is_active: { $exists: false } }] })
      .sort({ level: 1, display_order: 1, order: 1, name: 1 })
      .lean();
    const categories = raw.map((c) => ({
      ...c,
      category_id: c.category_id || c.slug || String(c._id),
      slug: c.slug || c.category_id || String(c._id),
    }));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Báo cáo danh mục: tất cả categories + số sản phẩm. Đếm theo category_ids (unwind) và category_id/category (schema cũ). */
router.get('/report', async (req, res) => {
  try {
    const categories = await Category.find({})
      .sort({ level: 1, display_order: 1, order: 1, name: 1 })
      .lean();
    const countByCategoryId = {};
    try {
      const byCategoryIds = await Product.aggregate([
        { $project: { ids: { $concatArrays: [{ $ifNull: ['$category_ids', []] }, { $cond: [{ $and: [{ $ne: ['$category_id', null] }, { $ne: ['$category_id', ''] }] }, ['$category_id'], []] }] } } },
        { $unwind: '$ids' },
        { $match: { ids: { $nin: [null, '', []] } } },
        { $group: { _id: '$ids', count: { $sum: 1 } } },
      ]);
      byCategoryIds.forEach((row) => {
        if (row._id != null && row._id !== '') countByCategoryId[String(row._id)] = row.count;
      });
    } catch (e) {
      console.warn('[categories/report] aggregate error', e.message);
    }
    const report = categories.map((c) => {
      const cid = c.category_id || c.slug || (c._id != null ? String(c._id) : '');
      const fromDoc = c.product_count != null ? c.product_count : 0;
      const fromAgg = countByCategoryId[cid] ?? fromDoc;
      return {
        _id: c._id,
        category_id: c.category_id || c.slug || String(c._id),
        name: c.name,
        slug: c.slug || c.category_id || String(c._id),
        parent_id: c.parent_id,
        level: c.level ?? 0,
        display_order: c.display_order ?? c.order ?? 0,
        is_active: c.is_active !== false,
        productCount: typeof fromAgg === 'number' ? fromAgg : fromDoc,
      };
    });
    const totalFromDoc = report.reduce((a, r) => a + r.productCount, 0);
    res.json({
      summary: {
        totalCategories: report.length,
        totalProductsFromCategories: totalFromDoc,
        productsWithoutCategory: countByCategoryId.none ?? 0,
      },
      categories: report,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({
      slug: req.params.slug,
      $or: [{ is_active: true }, { is_active: { $exists: false } }],
    }).lean();
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
