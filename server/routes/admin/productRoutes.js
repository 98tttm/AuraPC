const express = require('express');
const Product = require('../../models/Product');
const Category = require('../../models/Category');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

/**
 * Resolve category for products that don't have a populated category object.
 * Tries: category (ObjectId populate), primaryCategoryId (numeric _id), category_id (string).
 */
async function resolveCategories(items) {
  const needResolve = items.filter(
    (p) => !p.category || typeof p.category !== 'object' || !p.category.name
  );
  if (needResolve.length === 0) return items;

  // Collect all possible category IDs to look up
  const numericIds = new Set();
  const stringIds = new Set();
  for (const p of needResolve) {
    if (p.primaryCategoryId != null) numericIds.add(p.primaryCategoryId);
    if (p.category_id) stringIds.add(p.category_id);
    if (p.categoryIds?.length) p.categoryIds.forEach((id) => numericIds.add(id));
  }

  // Batch lookup categories
  const lookupFilter = [];
  if (numericIds.size > 0) lookupFilter.push({ _id: { $in: [...numericIds] } });
  if (stringIds.size > 0) lookupFilter.push({ category_id: { $in: [...stringIds] } });

  let catMap = new Map();
  if (lookupFilter.length > 0) {
    const cats = await Category.find({ $or: lookupFilter }, 'name slug').lean();
    for (const c of cats) {
      catMap.set(String(c._id), c);
      if (c.category_id) catMap.set(c.category_id, c);
    }
  }

  // Attach resolved category
  for (const p of needResolve) {
    if (p.primaryCategoryId != null && catMap.has(String(p.primaryCategoryId))) {
      p.category = catMap.get(String(p.primaryCategoryId));
    } else if (p.category_id && catMap.has(p.category_id)) {
      p.category = catMap.get(p.category_id);
    } else if (p.categoryIds?.length) {
      for (const cid of p.categoryIds) {
        if (catMap.has(String(cid))) {
          p.category = catMap.get(String(cid));
          break;
        }
      }
    }
  }
  return items;
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const filter = {};
    if (category) {
      // Support filtering by category _id (numeric or ObjectId) or category_id string
      filter.$or = [
        { category: category },
        { primaryCategoryId: isNaN(category) ? undefined : Number(category) },
        { category_id: category },
      ].filter((f) => Object.values(f)[0] !== undefined);
    }
    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchFilter = [
        { name: new RegExp(escapedSearch, 'i') },
        { slug: new RegExp(escapedSearch, 'i') },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
        delete filter.$or;
      } else {
        filter.$or = searchFilter;
      }
    }
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [items, total] = await Promise.all([
      Product.find(filter).populate('category', 'name slug').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      Product.countDocuments(filter),
    ]);
    await resolveCategories(items);
    res.json({ items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await resolveCategories([product]);
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
