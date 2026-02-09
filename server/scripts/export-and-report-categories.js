/**
 * 1. Lấy toàn bộ danh mục (và số sản phẩm) từ MongoDB.
 * 2. Ghi ra file dữ liệu JSON.
 * 3. Tự động gom nhóm theo level / parent_id và tạo file báo cáo Markdown.
 *
 * Chạy từ thư mục server: node scripts/export-and-report-categories.js
 * Cần .env có MONGODB_URI.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurapc';

const ROOT = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'docs', 'data');
const DATA_FILE = path.join(DATA_DIR, 'categories-data.json');
const REPORT_FILE = path.join(ROOT, 'docs', 'BAO_CAO_DANH_MUC.md');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function fetchAllData() {
  const categories = await Category.find({})
    .sort({ level: 1, display_order: 1, name: 1 })
    .lean();

  let productCountByCategory = {};
  try {
    const agg = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    agg.forEach((row) => {
      const key = row._id != null ? String(row._id) : 'none';
      productCountByCategory[key] = row.count;
    });
  } catch {
    // Collection products có thể khác schema hoặc dùng category_id
    try {
      const agg = await Product.aggregate([
        { $group: { _id: '$category_id', count: { $sum: 1 } } },
      ]);
      agg.forEach((row) => {
        const key = row._id != null ? String(row._id) : 'none';
        productCountByCategory[key] = row.count;
      });
    } catch {}
  }

  const categoriesWithCount = categories.map((c) => {
    const idStr = c._id != null ? String(c._id) : '';
    const fromAgg = productCountByCategory[idStr];
    const fromDoc = c.product_count != null ? c.product_count : 0;
    return {
      ...c,
      _id: c._id,
      product_count_resolved: fromAgg != null ? fromAgg : fromDoc,
    };
  });

  return { categories: categoriesWithCount, productCountByCategory };
}

function buildGrouped(categories) {
  const byId = new Map();
  categories.forEach((c) => byId.set(String(c._id), { ...c, children: [] }));

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
  roots.forEach((r) => sortChildren(r));
  return roots;

  function sortChildren(node) {
    node.children.sort((a, b) => (a.display_order ?? a.order ?? 0) - (b.display_order ?? b.order ?? 0));
    node.children.forEach(sortChildren);
  }
}

function markdownReport(grouped, summary) {
  const lines = [];
  lines.push('# Báo cáo tổng hợp danh mục sản phẩm AuraPC');
  lines.push('');
  lines.push(`*Cập nhật: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}*`);
  lines.push('');
  lines.push('## 1. Tổng quan');
  lines.push('');
  lines.push('| Chỉ số | Giá trị |');
  lines.push('|--------|--------|');
  lines.push(`| Tổng số danh mục | ${summary.totalCategories} |`);
  lines.push(`| Tổng số sản phẩm (từ danh mục) | ${summary.totalProductsFromCategories} |`);
  lines.push(`| Sản phẩm không gán danh mục | ${summary.productsWithoutCategory} |`);
  lines.push('');
  lines.push('## 2. Danh mục theo nhóm (level / cha-con)');
  lines.push('');

  function writeNode(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const count = node.product_count_resolved ?? node.product_count ?? 0;
    const active = node.is_active !== false ? '✓' : '✗';
    const level = node.level ?? '-';
    lines.push(`${indent}- **${node.name}** \`${node.slug}\` | Level ${level} | SP: ${count} | ${active}`);
    node.children.forEach((child) => writeNode(child, depth + 1));
  }

  grouped.forEach((root) => writeNode(root));
  lines.push('');
  lines.push('## 3. Danh sách phẳng (theo thứ tự hiển thị)');
  lines.push('');
  lines.push('| STT | Tên | Slug | Level | Thứ tự | SP | Active |');
  lines.push('|-----|-----|------|-------|--------|----|--------|');

  function flatten(nodes, out = []) {
    nodes.forEach((n) => {
          out.push(n);
          flatten(n.children, out);
        });
    return out;
  }
  const flat = flatten(grouped);
  flat.forEach((c, i) => {
    const order = c.display_order ?? c.order ?? '-';
    const count = c.product_count_resolved ?? c.product_count ?? 0;
    const active = c.is_active !== false ? 'Có' : 'Không';
    lines.push(`| ${i + 1} | ${c.name} | ${c.slug} | ${c.level ?? '-'} | ${order} | ${count} | ${active} |`);
  });

  lines.push('');
  lines.push('---');
  lines.push('*Báo cáo được tạo bởi script `server/scripts/export-and-report-categories.js`.*');
  return lines.join('\n');
}

async function run() {
  console.log('Đang kết nối MongoDB...');
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Kết nối thành công:', mongoose.connection.name);
  } catch (err) {
    console.error('Lỗi kết nối:', err.message);
    process.exit(1);
  }

  try {
    const { categories, productCountByCategory } = await fetchAllData();
    ensureDir(DATA_DIR);

    const payload = {
      exportedAt: new Date().toISOString(),
      totalCategories: categories.length,
      categories,
      productCountByCategory,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Đã ghi dữ liệu:', DATA_FILE);

    const grouped = buildGrouped(categories);
    const totalFromCategories = categories.reduce((a, c) => a + (c.product_count_resolved ?? c.product_count ?? 0), 0);
    const summary = {
      totalCategories: categories.length,
      totalProductsFromCategories: totalFromCategories,
      productsWithoutCategory: productCountByCategory.none ?? 0,
    };
    const reportMd = markdownReport(grouped, summary);
    fs.writeFileSync(REPORT_FILE, reportMd, 'utf8');
    console.log('Đã ghi báo cáo:', REPORT_FILE);
  } catch (err) {
    console.error('Lỗi:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Đã ngắt kết nối MongoDB.');
  }
}

run();
