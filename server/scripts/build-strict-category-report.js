/**
 * PIPELINE CHẶT CHẼ: Đọc MongoDB → Chuẩn hóa cấu trúc → Gán sản phẩm theo danh mục → Xuất JSON + MD.
 * Một lệnh xử lý toàn bộ, cấu trúc output được định nghĩa rõ ràng.
 *
 * Chạy: cd server && node scripts/build-strict-category-report.js
 * Cần: .env có MONGODB_URI.
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurapc';
const ROOT = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'docs', 'data');
const STRICT_JSON = path.join(DATA_DIR, 'structured-categories-and-products.json');
const REPORT_MD = path.join(ROOT, 'docs', 'BAO_CAO_DANH_MUC.md');
const REPORT_PRODUCTS_MD = path.join(ROOT, 'docs', 'BAO_CAO_SAN_PHAM_THEO_DANH_MUC.md');
const SCHEMA_VERSION = '1.0';

// --- Chuẩn hóa dữ liệu (strict shape) ---

function normalizeCategory(raw) {
  const id = raw._id != null ? String(raw._id) : null;
  if (id === null || id === '') return null;
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name.trim() : String(raw.name || ''),
    slug: typeof raw.slug === 'string' ? raw.slug.trim() : String(raw.slug || raw.name || id),
    level: Number(raw.level) >= 0 ? Number(raw.level) : 0,
    parent_id: raw.parent_id != null && raw.parent_id !== '' ? String(raw.parent_id) : null,
    display_order: Number(raw.display_order ?? raw.order ?? 0) || 0,
    is_active: raw.is_active !== false && raw.active !== false,
  };
}

function normalizeProduct(raw) {
  const id = raw._id != null ? String(raw._id) : null;
  if (id === null || id === '') return null;
  const categoryRef =
    raw.category ??
    raw.category_id ??
    raw.categoryId ??
    raw.primaryCategoryId ??
    (Array.isArray(raw.categoryIds) && raw.categoryIds.length > 0 ? raw.categoryIds[0] : null);
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name.trim() : (raw.title != null ? String(raw.title).trim() : ''),
    slug: typeof raw.slug === 'string' ? raw.slug.trim() : '',
    price: typeof raw.price === 'number' ? raw.price : Number(raw.price) || 0,
    sale_price: raw.sale_price != null ? Number(raw.sale_price) : (raw.salePrice != null ? Number(raw.salePrice) : null),
    category_ref: categoryRef != null && categoryRef !== '' ? String(categoryRef) : null,
  };
}

// --- Build cây danh mục chặt chẽ (chỉ node có id hợp lệ, parent phải tồn tại hoặc null) ---

function buildStrictTree(categories) {
  const byId = new Map();
  for (const c of categories) {
    if (!c || !c.id) continue;
    byId.set(c.id, {
      ...c,
      product_count: 0,
      products: [],
      children: [],
    });
  }

  const roots = [];
  for (const c of categories) {
    if (!c || !c.id) continue;
    const node = byId.get(c.id);
    if (!node) continue;
    const parentId = c.parent_id && c.parent_id !== c.id ? c.parent_id : null;
    if (!parentId) {
      roots.push(node);
    } else {
      const parent = byId.get(parentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  const sortNode = (node) => {
    node.children.sort((a, b) => {
      const o = (a.display_order || 0) - (b.display_order || 0);
      return o !== 0 ? o : (a.name || '').localeCompare(b.name || '');
    });
    node.children.forEach(sortNode);
  };
  roots.sort((a, b) => {
    const o = (a.display_order || 0) - (b.display_order || 0);
    return o !== 0 ? o : (a.name || '').localeCompare(b.name || '');
  });
  roots.forEach(sortNode);

  return { roots, byId };
}

// --- Gán sản phẩm vào danh mục (chỉ gán khi category_ref khớp id danh mục có trong cây) ---

function assignProductsToTree(byId, products) {
  const validIds = new Set(byId.keys());
  const byCategory = new Map();
  validIds.forEach((id) => byCategory.set(id, []));

  const unassigned = [];
  for (const p of products) {
    if (!p || !p.id) continue;
    const ref = p.category_ref;
    if (!ref || !validIds.has(ref)) {
      unassigned.push(p);
      continue;
    }
    byCategory.get(ref).push({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      sale_price: p.sale_price,
    });
  }

  byId.forEach((node, id) => {
    node.products = byCategory.get(id) || [];
    node.product_count = node.products.length;
  });

  return unassigned;
}

// --- Xuất cây cho JSON (strict shape, không thừa field) ---

function toStrictNode(node) {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    level: node.level,
    display_order: node.display_order,
    parent_id: node.parent_id,
    is_active: node.is_active,
    product_count: node.product_count,
    products: node.products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      sale_price: p.sale_price,
    })),
    children: node.children.map(toStrictNode),
  };
}

function toFlatList(roots, out = []) {
  for (const node of roots) {
    out.push({
      id: node.id,
      name: node.name,
      slug: node.slug,
      level: node.level,
      display_order: node.display_order,
      parent_id: node.parent_id,
      product_count: node.product_count,
    });
    toFlatList(node.children, out);
  }
  return out;
}

// --- Markdown báo cáo danh mục (chặt chẽ) ---

function buildCategoriesMd(roots, summary) {
  const L = [];
  L.push('# Báo cáo tổng hợp danh mục sản phẩm AuraPC');
  L.push('');
  L.push(`**Cập nhật:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')} | **Schema:** ${SCHEMA_VERSION}`);
  L.push('');
  L.push('## 1. Tổng quan');
  L.push('');
  L.push('| Chỉ số | Giá trị |');
  L.push('|--------|--------|');
  L.push(`| Tổng danh mục | ${summary.totalCategories} |`);
  L.push(`| Danh mục gốc (level 0) | ${summary.totalRoots} |`);
  L.push(`| Tổng sản phẩm đã gán | ${summary.productsAssigned} |`);
  L.push(`| Sản phẩm chưa gán danh mục | ${summary.productsUnassigned} |`);
  if (summary.productsUnassigned > 0 && summary.productsAssigned === 0) {
    L.push('');
    L.push('> **Lưu ý:** Sản phẩm trong MongoDB hiện không có trường tham chiếu danh mục (`category` / `primaryCategoryId` / `categoryIds`). Để gán sản phẩm theo danh mục, cần cập nhật collection `products` từ nguồn có sẵn (vd. `data/products.ndjson`) hoặc đồng bộ trường `category` (ObjectId) với `categories._id`.');
  }
  L.push('');
  L.push('## 2. Cây danh mục (theo level, display_order)');
  L.push('');

  function writeNode(n, depth) {
    const indent = '  '.repeat(depth);
    const active = n.is_active ? '✓' : '✗';
    L.push(`${indent}- **${n.name}** \`${n.slug}\` | Level ${n.level} | SP: ${n.product_count} | ${active}`);
    n.children.forEach((c) => writeNode(c, depth + 1));
  }
  roots.forEach((r) => writeNode(r, 0));

  L.push('');
  L.push('## 3. Bảng phẳng (danh mục)');
  L.push('');
  L.push('| STT | Id | Tên | Slug | Level | Thứ tự | Số SP |');
  L.push('|-----|-----|-----|------|-------|--------|-------|');
  const flat = toFlatList(roots);
  flat.forEach((c, i) => {
    L.push(`| ${i + 1} | ${c.id} | ${c.name} | ${c.slug} | ${c.level} | ${c.display_order} | ${c.product_count} |`);
  });
  L.push('');
  L.push('---');
  L.push('*Tạo bởi `server/scripts/build-strict-category-report.js`.*');
  return L.join('\n');
}

// --- Markdown báo cáo sản phẩm theo danh mục (chặt chẽ) ---

function buildProductsByCategoryMd(roots, summary) {
  const L = [];
  L.push('# Báo cáo sản phẩm theo danh mục (cấu trúc level)');
  L.push('');
  L.push(`**Cập nhật:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
  L.push('');
  L.push('## Tổng quan');
  L.push('');
  L.push('| Chỉ số | Giá trị |');
  L.push('|--------|--------|');
  L.push(`| Danh mục | ${summary.totalCategories} |`);
  L.push(`| Sản phẩm đã gán | ${summary.productsAssigned} |`);
  L.push(`| Sản phẩm chưa gán | ${summary.productsUnassigned} |`);
  L.push('');
  L.push('## Danh mục và sản phẩm (theo level)');
  L.push('');

  function writeNode(n, depth) {
    const indent = '  '.repeat(depth);
    L.push(`${indent}- **${n.name}** \`${n.slug}\` (Level ${n.level}) — **${n.product_count}** sản phẩm`);
    const show = n.products.slice(0, 15);
    show.forEach((p, i) => {
      const price = p.sale_price ?? p.price;
      const priceStr = price != null ? `${Number(price).toLocaleString('vi-VN')}₫` : '-';
      L.push(`${indent}  ${i + 1}. ${p.name || p.slug || p.id} | ${priceStr}`);
    });
    if (n.products.length > 15) L.push(`${indent}  ... +${n.products.length - 15} sản phẩm khác`);
    n.children.forEach((c) => writeNode(c, depth + 1));
  }
  roots.forEach((r) => writeNode(r, 0));

  L.push('');
  L.push('---');
  L.push('*Tạo bởi `server/scripts/build-strict-category-report.js`.*');
  return L.join('\n');
}

// --- Main ---

async function run() {
  console.log('Kết nối MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('DB:', mongoose.connection.name);

  const categoriesCol = db.collection('categories');
  const productsCol = db.collection('products');

  console.log('Đọc categories...');
  const rawCategories = await categoriesCol.find({}).sort({ level: 1, display_order: 1, name: 1 }).toArray();
  const categories = rawCategories.map(normalizeCategory).filter(Boolean);
  console.log('Danh mục hợp lệ:', categories.length);

  const { roots, byId } = buildStrictTree(categories);
  const totalRoots = roots.length;

  console.log('Đọc products...');
  const rawProducts = await productsCol.find({}).toArray();
  const products = rawProducts.map(normalizeProduct).filter(Boolean);
  console.log('Sản phẩm hợp lệ:', products.length);

  const unassigned = assignProductsToTree(byId, products);
  const productsAssigned = products.length - unassigned.length;
  console.log('Sản phẩm đã gán danh mục:', productsAssigned, '| Chưa gán:', unassigned.length);

  const summary = {
    totalCategories: byId.size,
    totalRoots,
    totalProducts: products.length,
    productsAssigned,
    productsUnassigned: unassigned.length,
  };

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      summary: {
        totalCategories: summary.totalCategories,
        totalRoots: summary.totalRoots,
        totalProducts: summary.totalProducts,
        productsAssigned: summary.productsAssigned,
        productsUnassigned: summary.productsUnassigned,
      },
    },
    categoriesTree: roots.map(toStrictNode),
    categoriesFlat: toFlatList(roots),
    unassignedProducts: unassigned.map((p) => ({ id: p.id, name: p.name, slug: p.slug, category_ref: p.category_ref })),
  };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(STRICT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  console.log('Đã ghi:', STRICT_JSON);

  fs.writeFileSync(REPORT_MD, buildCategoriesMd(roots, summary), 'utf8');
  console.log('Đã ghi:', REPORT_MD);

  fs.writeFileSync(REPORT_PRODUCTS_MD, buildProductsByCategoryMd(roots, summary), 'utf8');
  console.log('Đã ghi:', REPORT_PRODUCTS_MD);

  await mongoose.disconnect();
  console.log('Xong.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
