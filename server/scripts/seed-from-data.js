/**
 * Import data từ data/categories.json và data/products.ndjson vào MongoDB
 * theo đặc tả DATA_STRUCTURE_FOR_UI.md.
 * Chạy: node server/scripts/seed-from-data.js (từ thư mục gốc dự án, đã set MONGODB_URI)
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Category = require('../models/Category');
const Product = require('../models/Product');
const connectDB = require('../config/database');

const DATA_DIR = path.join(__dirname, '../../data');

async function seedCategories() {
  const file = path.join(DATA_DIR, 'categories.json');
  if (!fs.existsSync(file)) {
    console.warn('Không tìm thấy data/categories.json, bỏ qua.');
    return 0;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const list = JSON.parse(raw);
  if (!Array.isArray(list) || list.length === 0) {
    console.warn('categories.json rỗng hoặc không phải mảng.');
    return 0;
  }
  const docs = list.map((c) => ({
    category_id: c.category_id ?? c.slug,
    parent_id: c.parent_id ?? null,
    level: c.level ?? 1,
    name: c.name,
    slug: c.slug ?? c.category_id,
    source_url: c.source_url ?? '',
    source: c.source ?? '',
  }));
  await Category.deleteMany({});
  await Category.insertMany(docs);
  console.log(`Đã import ${docs.length} danh mục.`);
  return docs.length;
}

async function seedProducts() {
  const file = path.join(DATA_DIR, 'products.ndjson');
  if (!fs.existsSync(file)) {
    console.warn('Không tìm thấy data/products.ndjson, bỏ qua.');
    return 0;
  }
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim());
  const docs = [];
  for (const line of lines) {
    try {
      const p = JSON.parse(line);
      docs.push({
        product_id: p.product_id,
        handle: p.handle,
        slug: p.slug,
        name: p.name,
        price: p.price ?? 0,
        old_price: p.old_price ?? null,
        images: Array.isArray(p.images) ? p.images : [],
        category_id: p.category_id ?? '',
        category_ids: Array.isArray(p.category_ids) ? p.category_ids : [],
        specs: p.specs ?? {},
        description_html: p.description_html ?? '',
        active: true,
        featured: false,
      });
    } catch (e) {
      console.warn('Dòng NDJSON lỗi:', line.slice(0, 80));
    }
  }
  if (docs.length === 0) {
    console.warn('Không có sản phẩm hợp lệ.');
    return 0;
  }
  await Product.deleteMany({});
  const BATCH = 200;
  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    await Product.insertMany(batch);
  }
  console.log(`Đã import ${docs.length} sản phẩm.`);
  return docs.length;
}

async function main() {
  await connectDB();
  try {
    const catCount = await seedCategories();
    const prodCount = await seedProducts();
    console.log('Kết thúc: categories =', catCount, ', products =', prodCount);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
