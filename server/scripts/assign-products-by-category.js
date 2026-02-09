/**
 * Lọc Category từ Product dựa trên danh mục thuần đã lọc (trong categories-data.json),
 * gán sản phẩm thuộc danh mục nào theo đúng cấu trúc level.
 *
 * Chạy từ thư mục server: node scripts/assign-products-by-category.js
 * Cần: docs/data/categories-data.json đã có (chạy export-and-report-categories.js trước).
 * Cần: .env có MONGODB_URI.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'docs', 'data');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories-data.json');
const OUTPUT_JSON = path.join(DATA_DIR, 'products-by-category.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'BAO_CAO_SAN_PHAM_THEO_DANH_MUC.md');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurapc';

function loadCategoriesData() {
  if (!fs.existsSync(CATEGORIES_FILE)) {
    throw new Error('Chưa có file docs/data/categories-data.json. Chạy: node scripts/export-and-report-categories.js');
  }
  const raw = fs.readFileSync(CATEGORIES_FILE, 'utf8');
  return JSON.parse(raw);
}

function buildGroupedTree(categories) {
  const byId = new Map();
  categories.forEach((c) => byId.set(String(c._id), { ...c, children: [], products: [] }));

  const roots = [];
  categories.forEach((c) => {
    const node = byId.get(String(c._id));
    if (!node) return;
    const parentId = c.parent_id != null ? String(c.parent_id) : null;
    if (!parentId || !byId.has(parentId)) {
      roots.push(node);
    } else {
      byId.get(parentId).children.push(node);
    }
  });

  roots.sort((a, b) => (a.display_order ?? a.order ?? 0) - (b.display_order ?? b.order ?? 0));
  roots.forEach(sortChildren);
  return { roots, byId };

  function sortChildren(node) {
    node.children.sort((a, b) => (a.display_order ?? a.order ?? 0) - (b.display_order ?? b.order ?? 0));
    node.children.forEach(sortChildren);
  }
}

function normalizeCategoryRef(val) {
  if (val == null) return null;
  return String(val);
}

async function fetchProductsRaw(db) {
  const col = db.collection('products');
  const cursor = col.find({});
  const list = await cursor.toArray();
  return list;
}

function assignProductsToTree(byId, products) {
  const validIds = new Set(byId.keys());
  const byCategory = new Map();
  validIds.forEach((id) => byCategory.set(id, []));

  let noCategory = 0;
  products.forEach((p) => {
    const ref = normalizeCategoryRef(p.category ?? p.category_id ?? p.categoryId);
    if (!ref || !validIds.has(ref)) {
      noCategory++;
      return;
    }
    byCategory.get(ref).push({
      _id: p._id,
      name: p.name || p.title,
      slug: p.slug || '',
      price: p.price,
      salePrice: p.sale_price ?? p.salePrice,
      sku: p.sku,
    });
  });

  byId.forEach((node, id) => {
    node.products = byCategory.get(id) || [];
  });

  return noCategory;
}

function toTreeForJson(node) {
  return {
    _id: node._id,
    name: node.name,
    slug: node.slug,
    level: node.level,
    display_order: node.display_order ?? node.order,
    productCount: node.products.length,
    products: node.products.map((p) => ({
      _id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      salePrice: p.salePrice,
    })),
    children: node.children.map(toTreeForJson),
  };
}

function markdownReport(roots, summary) {
  const lines = [];
  lines.push('# Báo cáo sản phẩm theo danh mục (theo cấu trúc level)');
  lines.push('');
  lines.push(`*Cập nhật: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}*`);
  lines.push('');
  lines.push('## 1. Tổng quan');
  lines.push('');
  lines.push('| Chỉ số | Giá trị |');
  lines.push('|--------|--------|');
  lines.push(`| Tổng danh mục (đã lọc) | ${summary.totalCategories} |`);
  lines.push(`| Tổng sản phẩm đã gán danh mục | ${summary.productsAssigned} |`);
  lines.push(`| Sản phẩm chưa gán danh mục | ${summary.productsUnassigned} |`);
  lines.push('');
  lines.push('## 2. Danh mục theo level – kèm sản phẩm thuộc danh mục');
  lines.push('');

  function writeNode(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const count = node.products.length;
    lines.push(`${indent}- **${node.name}** \`${node.slug}\` | Level ${node.level ?? '-'} | **${count}** sản phẩm`);
    if (node.products.length > 0) {
      node.products.slice(0, 20).forEach((p, i) => {
        const price = p.salePrice ?? p.price;
        const priceStr = price != null ? `${Number(price).toLocaleString('vi-VN')}₫` : '-';
        lines.push(`${indent}  ${i + 1}. ${p.name || p.slug || p._id} | ${priceStr}`);
      });
      if (node.products.length > 20) {
        lines.push(`${indent}  ... và ${node.products.length - 20} sản phẩm khác.`);
      }
    }
    node.children.forEach((child) => writeNode(child, depth + 1));
  }

  roots.forEach((r) => writeNode(r));
  lines.push('');
  lines.push('---');
  lines.push('*Báo cáo từ script `server/scripts/assign-products-by-category.js`. Danh mục lấy từ `docs/data/categories-data.json`.*');
  return lines.join('\n');
}

async function run() {
  console.log('Đang tải danh mục từ file đã lọc...');
  const { categories } = loadCategoriesData();
  const { roots, byId } = buildGroupedTree(categories);
  console.log('Số danh mục (đã gom nhóm):', roots.length, 'gốc, tổng node:', byId.size);

  console.log('Đang kết nối MongoDB...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Kết nối thành công:', mongoose.connection.name);
  } catch (err) {
    console.error('Lỗi kết nối:', err.message);
    process.exit(1);
  }

  try {
    const db = mongoose.connection.db;
    console.log('Đang đọc toàn bộ sản phẩm...');
    const products = await fetchProductsRaw(db);
    console.log('Tổng sản phẩm trong DB:', products.length);

    const productsUnassigned = assignProductsToTree(byId, products);
    const productsAssigned = products.length - productsUnassigned;

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const payload = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalCategories: byId.size,
        productsAssigned,
        productsUnassigned,
      },
      tree: roots.map(toTreeForJson),
    };
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Đã ghi:', OUTPUT_JSON);

    const md = markdownReport(roots, {
      totalCategories: byId.size,
      productsAssigned,
      productsUnassigned,
    });
    fs.writeFileSync(OUTPUT_MD, md, 'utf8');
    console.log('Đã ghi:', OUTPUT_MD);
  } catch (err) {
    console.error('Lỗi:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Đã ngắt kết nối MongoDB.');
  }
}

run();
