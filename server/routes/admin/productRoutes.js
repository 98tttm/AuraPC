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
// Cached map: any category_id → its root (level 1) category
let _rootLookup = null;
let _rootLookupTime = 0;
const ROOT_LOOKUP_TTL = 5 * 60 * 1000; // 5 min

async function getRootLookup() {
  const now = Date.now();
  if (_rootLookup && now - _rootLookupTime < ROOT_LOOKUP_TTL) return _rootLookup;

  const allCats = await Category.find({}, 'name slug category_id parent_id').lean();
  const byId = new Map(); // category_id → cat doc
  for (const c of allCats) byId.set(c.category_id, c);

  // For each category, walk up parent_id chain to find root (parent_id === null)
  const toRoot = new Map(); // any category_id → root category { name, slug, category_id }
  for (const c of allCats) {
    let cur = c;
    const visited = new Set();
    while (cur.parent_id && byId.has(cur.parent_id) && !visited.has(cur.parent_id)) {
      visited.add(cur.category_id);
      cur = byId.get(cur.parent_id);
    }
    toRoot.set(c.category_id, { _id: cur._id, name: cur.name, slug: cur.slug, category_id: cur.category_id });
  }

  _rootLookup = toRoot;
  _rootLookupTime = now;
  return toRoot;
}

async function resolveCategories(items) {
  const needResolve = items.filter(
    (p) => !p.category || typeof p.category !== 'object' || !p.category.name
  );
  if (needResolve.length === 0) return items;

  const toRoot = await getRootLookup();

  for (const p of needResolve) {
    // Try category_ids array first, then category_id
    const candidates = [
      ...(p.category_ids || []),
      p.category_id,
    ].filter(Boolean);

    for (const cid of candidates) {
      if (toRoot.has(cid)) {
        p.category = toRoot.get(cid);
        break;
      }
    }
  }
  return items;
}

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search, stockStatus } = req.query;
    const filter = {};
    // Stock status filter: 'in-stock' (>=10), 'low-stock' (1-9), 'out-of-stock' (0)
    if (stockStatus === 'out-of-stock') {
      filter.stock = 0;
    } else if (stockStatus === 'low-stock') {
      filter.stock = { $gt: 0, $lt: 10 };
    } else if (stockStatus === 'in-stock') {
      filter.stock = { $gte: 10 };
    }
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

// Category distribution stats across ALL products
router.get('/category-stats', async (req, res) => {
  try {
    const toRoot = await getRootLookup();
    const products = await Product.find({}, 'category_ids category_id').lean();
    const counts = {};
    for (const p of products) {
      const candidates = [...(p.category_ids || []), p.category_id].filter(Boolean);
      let root = 'Khác';
      for (const cid of candidates) {
        if (toRoot.has(cid)) {
          root = toRoot.get(cid).name;
          break;
        }
      }
      counts[root] = (counts[root] || 0) + 1;
    }
    // Sort by count descending
    const stats = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    res.json({ stats, total: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock distribution stats across ALL products
router.get('/stock-stats', async (req, res) => {
  try {
    const [inStock, lowStock, outOfStock] = await Promise.all([
      Product.countDocuments({ stock: { $gte: 10 } }),
      Product.countDocuments({ stock: { $gt: 0, $lt: 10 } }),
      Product.countDocuments({ stock: 0 }),
    ]);
    res.json({
      stats: [
        { name: 'Còn hàng', count: inStock },
        { name: 'Sắp hết hàng', count: lowStock },
        { name: 'Hết hàng', count: outOfStock },
      ],
      total: inStock + lowStock + outOfStock,
    });
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
