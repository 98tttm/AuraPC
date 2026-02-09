/**
 * Script đọc MongoDB và in báo cáo danh mục + số sản phẩm.
 * Chạy từ thư mục server: node scripts/category-report.js
 * Cần có .env với MONGODB_URI.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aurapc';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Đã kết nối MongoDB:', mongoose.connection.name);
  } catch (err) {
    console.error('Lỗi kết nối MongoDB:', err.message);
    process.exit(1);
  }

  try {
    const categories = await Category.find({}).sort({ display_order: 1, level: 1, name: 1 }).lean();
    let countByCategoryId = {};
    try {
      const productCounts = await Product.aggregate([
        { $match: {} },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);
      productCounts.forEach((row) => {
        const key = row._id ? row._id.toString() : 'none';
        countByCategoryId[key] = row.count;
      });
    } catch {
      // collection products có thể khác schema
    }

    const report = categories.map((c) => {
      const idStr = c._id != null ? c._id.toString() : '';
      const fromDoc = c.product_count != null ? c.product_count : 0;
      const fromAgg = countByCategoryId[idStr];
      return {
        name: c.name,
        slug: c.slug,
        level: c.level ?? 0,
        display_order: c.display_order ?? c.order ?? 0,
        is_active: c.is_active !== false,
        productCount: fromAgg != null ? fromAgg : fromDoc,
      };
    });

    const totalFromDoc = report.reduce((a, r) => a + r.productCount, 0);
    const noCategory = countByCategoryId.none ?? 0;

    console.log('\n========== BÁO CÁO DANH MỤC AURAPC ==========\n');
    console.log('Tổng danh mục:', report.length);
    console.log('Tổng sản phẩm (từ product_count / aggregate):', totalFromDoc);
    console.log('Sản phẩm không có danh mục:', noCategory);
    console.log('\n--- Chi tiết (level 0 = danh mục gốc) ---\n');

    report.forEach((r, i) => {
      const activeStr = r.is_active ? '✓' : '✗';
      console.log(`${i + 1}. [${activeStr}] Lv${r.level} ${r.name} (slug: ${r.slug}) | display_order: ${r.display_order} | SP: ${r.productCount}`);
    });

    console.log('\n================================================\n');
  } catch (err) {
    console.error('Lỗi:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Đã ngắt kết nối MongoDB.');
  }
}

run();
