/**
 * Product Routes — AuraPC
 * Main route definitions for /api/products/*
 *
 * Logic extracted into:
 *  - utils/productFilters.js     — filter building, category helpers, normalization
 *  - utils/productNormalizers.js  — spec normalization functions
 *  - utils/filterOptionsConfig.js — per-category filter extraction config
 */
const express = require('express');
const Product = require('../models/Product');
const { extractBrandFromName } = require('../utils/brandExtract');
const {
  buildProductFilter,
  getCategoryIdsIncludingDescendants,
  resolveCategoryForProducts,
  normalizeProductForUI,
} = require('../utils/productFilters');
const { CATEGORY_FILTER_MAP, ALL_SPEC_KEYS, NUMERIC_FIELDS } = require('../utils/filterOptionsConfig');

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
 *  GET /api/products — List products with filters
 * ───────────────────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  try {
    const { filter, sort, skip, limit, page } = await buildProductFilter(req.query);
    const [rawItems, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
    const resolved = await resolveCategoryForProducts(rawItems);
    const items = resolved.map(normalizeProductForUI);
    res.json({ items, total, page, limit });
  } catch (err) {
    console.error('[GET /api/products]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
 *  GET /api/products/filter-options — Normalized filter values
 * ───────────────────────────────────────────────────────────── */
router.get('/filter-options', async (req, res) => {
  try {
    const { category } = req.query;

    // Build base filter (active products + category)
    const filter = { $and: [{ $or: [{ active: true }, { active: { $exists: false } }] }] };
    if (category) {
      const categoryIds = await getCategoryIdsIncludingDescendants(category);
      if (categoryIds.length > 0) {
        filter.$and.push({
          $or: [
            { category_id: { $in: categoryIds } },
            { category_ids: { $in: categoryIds } },
          ],
        });
      }
    }

    const products = await Product.find(filter).select('brand name specs techSpecs').lean();

    // ── Extract brands ──
    const brandSet = new Set();
    for (const p of products) {
      const b = (p.brand || '').trim();
      if (b) brandSet.add(b);
      const fromName = extractBrandFromName(p.name);
      if (fromName) brandSet.add(fromName);
    }

    // ── Extract spec filters using per-category config ──
    const specSets = {};
    const getSpec = (p, keys) => {
      for (const src of [p.specs, p.techSpecs]) {
        if (!src) continue;
        for (const k of keys) {
          const v = src[k];
          if (v != null && String(v).trim()) return String(v).trim();
        }
      }
      return null;
    };

    const catSlug = category ? String(category).trim() : null;
    const filterConfigs = catSlug ? (CATEGORY_FILTER_MAP[catSlug] || []) : [];

    for (const cfg of filterConfigs) {
      if (!specSets[cfg.target]) specSets[cfg.target] = new Set();
    }

    for (const p of products) {
      for (const cfg of filterConfigs) {
        const raw = getSpec(p, cfg.keys);
        if (!raw) continue;
        if (cfg.normalize) {
          const normalized = cfg.normalize(raw);
          if (normalized) {
            if (Array.isArray(normalized)) {
              normalized.forEach(v => specSets[cfg.target].add(v));
            } else {
              specSets[cfg.target].add(normalized);
            }
          }
        } else {
          specSets[cfg.target].add(raw);
        }
      }
    }

    // ── Build result ──
    const numericSort = (a, b) => {
      const numA = parseFloat(a.replace(/[^\d.]/g, ''));
      const numB = parseFloat(b.replace(/[^\d.]/g, ''));
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    };

    const specs = {};
    for (const key of ALL_SPEC_KEYS) {
      const set = specSets[key];
      if (!set || set.size === 0) {
        specs[key] = [];
      } else {
        const arr = Array.from(set);
        specs[key] = NUMERIC_FIELDS.has(key) ? arr.sort(numericSort) : arr.sort();
      }
    }

    res.json({
      brands: Array.from(brandSet).sort(),
      specs,
      total: products.length,
    });
  } catch (err) {
    console.error('[GET /api/products/filter-options]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
 *  GET /api/products/featured — Featured products
 * ───────────────────────────────────────────────────────────── */
router.get('/featured', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);
    const raw = await Product.find({
      $or: [{ active: true }, { active: { $exists: false } }],
      featured: true,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const resolved = await resolveCategoryForProducts(raw);
    const items = resolved.map(normalizeProductForUI);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
 *  GET /api/products/by-slug/:slug — Single product by slug
 * ───────────────────────────────────────────────────────────── */
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const raw = await Product.findOne({
      slug: req.params.slug,
      $or: [{ active: true }, { active: { $exists: false } }],
    }).lean();
    if (!raw) return res.status(404).json({ error: 'Product not found' });
    const [resolved] = await resolveCategoryForProducts([raw]);
    const product = normalizeProductForUI(resolved);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
 *  GET /api/products/:id — Single product by ID
 * ───────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const raw = await Product.findById(req.params.id).lean();
    if (!raw) return res.status(404).json({ error: 'Product not found' });
    const [resolved] = await resolveCategoryForProducts([raw]);
    const product = normalizeProductForUI(resolved);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
